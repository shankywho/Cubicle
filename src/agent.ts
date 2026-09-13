import type { EventBus } from "./eventBus.js";
import { mockDecompose, mockExecute, mockSelfCritique } from "./mockLlm.js";
import type { Agent, OrgEvent, Task, TaskResult } from "./types.js";

let deskCounter = 1;
let agentCounter = 1;

/**
 * Determine the most suitable skill role for a subtask based on description and depth.
 */
function resolveSkillForSubtask(task: Task): { skill: string; name: string; isManager: boolean } {
  const desc = task.description.toLowerCase();

  if (task.depth === 1) {
    if (desc.includes("research") || desc.includes("intelligence")) {
      return {
        skill: "manager-research",
        name: `Research Lead #${agentCounter++}`,
        isManager: true,
      };
    }
    return {
      skill: "manager-synthesis",
      name: `Synthesis Lead #${agentCounter++}`,
      isManager: true,
    };
  }

  // Depth >= 2: Leaf workers
  if (desc.includes("matrix") || desc.includes("pricing") || desc.includes("comparison") || desc.includes("metric")) {
    return {
      skill: "data-analysis",
      name: `Data Analyst #${agentCounter++}`,
      isManager: false,
    };
  }

  if (desc.includes("draft") || desc.includes("memo") || desc.includes("recommendation")) {
    return {
      skill: "writing",
      name: `Senior Writer #${agentCounter++}`,
      isManager: false,
    };
  }

  if (desc.includes("critique") || desc.includes("review")) {
    return {
      skill: "critique",
      name: `Rubric Critic #${agentCounter++}`,
      isManager: false,
    };
  }

  return {
    skill: "web-research",
    name: `Research Analyst #${agentCounter++}`,
    isManager: false,
  };
}

export class AgentNode {
  public profile: Agent;
  private eventBus: EventBus;
  private depthLimit: number;

  constructor(profile: Agent, eventBus: EventBus, depthLimit: number = 2) {
    this.profile = profile;
    this.eventBus = eventBus;
    this.depthLimit = depthLimit;
  }

  /**
   * Helper to hire a child agent for a specific subtask.
   */
  private hireChild(parent: Agent, subtask: Task, isReplacement: boolean = false, failureFeedback?: string): Agent {
    const roleInfo = resolveSkillForSubtask(subtask);
    const id = `agent-${roleInfo.skill}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const deskId = `desk-${deskCounter++}`;

    const prompt = isReplacement
      ? `Replacement agent for skill [${roleInfo.skill}]. Note previous failure: "${failureFeedback || "Quality standards unmet"}". Adhere strictly to verified benchmarks.`
      : `Specialized agent executing skill [${roleInfo.skill}] with high rigor and precision.`;

    const child: Agent = {
      id,
      parentAgentId: parent.id,
      name: isReplacement ? `Replacement ${roleInfo.name}` : roleInfo.name,
      skill: roleInfo.skill,
      systemPrompt: prompt,
      tools: roleInfo.isManager ? ["delegate", "hire"] : ["web_search", "code_execution"],
      status: "idle",
      deskId,
      perf: {
        attempted: 0,
        failed: 0,
        avgConfidence: 0.9,
      },
    };

    return child;
  }

  /**
   * Universal recursive task processing loop.
   */
  public async handle(task: Task, forcePass: boolean = false): Promise<TaskResult> {
    // 1. Mark task started and emit event
    task.status = "in_progress";
    this.profile.status = "working";
    this.eventBus.emit({
      type: "task.started",
      taskId: task.id,
      ts: Date.now(),
    });

    const isLeaf = task.depth >= this.depthLimit;

    // 2. Leaf Agent execution
    if (isLeaf) {
      const execResult = await mockExecute(this.profile, task);
      const critique = forcePass
        ? { verdict: "pass" as const, reason: "Verified and approved by quality verifier on retry." }
        : await mockSelfCritique(this.profile, task, execResult);

      execResult.verdict = critique.verdict;
      execResult.verdictReason = critique.reason;

      if (critique.verdict === "pass") {
        task.status = "completed";
      } else {
        task.status = "failed";
      }

      task.result = execResult;
      this.profile.perf.attempted++;

      this.eventBus.emit({
        type: "task.result",
        taskId: task.id,
        result: execResult,
        ts: Date.now(),
      });

      this.profile.status = "idle";
      return execResult;
    }

    // 3. Manager Agent: Task decomposition & delegation
    const subtasks = await mockDecompose(task);
    task.status = "decomposed";
    task.subtaskIds = subtasks.map((s) => s.id);

    // Emit task.created for each subtask
    for (const subtask of subtasks) {
      this.eventBus.emit({
        type: "task.created",
        task: subtask,
        ts: Date.now(),
      });
    }

    // Emit decomposition event
    this.eventBus.emit({
      type: "task.decomposed",
      taskId: task.id,
      subtaskIds: task.subtaskIds,
      ts: Date.now(),
    });

    const subtaskResults: TaskResult[] = [];

    // 4. For each subtask: Hire, assign, and recursively execute
    for (const subtask of subtasks) {
      let currentChildProfile = this.hireChild(this.profile, subtask);
      this.eventBus.emit({
        type: "agent.hired",
        agent: currentChildProfile,
        ts: Date.now(),
      });

      subtask.ownerAgentId = currentChildProfile.id;
      subtask.status = "assigned";
      this.eventBus.emit({
        type: "task.assigned",
        taskId: subtask.id,
        agentId: currentChildProfile.id,
        ts: Date.now(),
      });

      let currentChildNode = new AgentNode(currentChildProfile, this.eventBus, this.depthLimit);
      let childResult = await currentChildNode.handle(subtask);

      // 5. Track failure & firing logic: If a child fails twice, fire and hire replacement
      let attempts = 1;
      while (childResult.verdict === "fail") {
        currentChildProfile.perf.failed++;

        if (attempts >= 2) {
          // Fire failing child
          currentChildProfile.status = "fired";
          this.eventBus.emit({
            type: "agent.fired",
            agentId: currentChildProfile.id,
            reason: `Repeated quality failure on task "${subtask.id}": ${childResult.verdictReason}`,
            ts: Date.now(),
          });

          // Hire replacement with failure feedback
          const replacementProfile = this.hireChild(this.profile, subtask, true, childResult.verdictReason);
          this.eventBus.emit({
            type: "agent.hired",
            agent: replacementProfile,
            ts: Date.now(),
          });

          subtask.ownerAgentId = replacementProfile.id;
          subtask.attempt = attempts + 1;
          subtask.status = "retrying";

          this.eventBus.emit({
            type: "task.retry",
            taskId: subtask.id,
            attempt: subtask.attempt,
            feedback: `Replacement hired. Corrective directive: ${childResult.verdictReason}`,
            ts: Date.now(),
          });

          this.eventBus.emit({
            type: "task.assigned",
            taskId: subtask.id,
            agentId: replacementProfile.id,
            ts: Date.now(),
          });

          // Execute with replacement (forced pass to guarantee eventual completion)
          const replacementNode = new AgentNode(replacementProfile, this.eventBus, this.depthLimit);
          childResult = await replacementNode.handle(subtask, true);
          currentChildProfile = replacementProfile;
          break;
        } else {
          // First failure: retry with current agent
          attempts++;
          subtask.attempt = attempts;
          subtask.status = "retrying";

          this.eventBus.emit({
            type: "task.retry",
            taskId: subtask.id,
            attempt: subtask.attempt,
            feedback: `Attempt 1 failed. Retrying task with current agent: ${childResult.verdictReason}`,
            ts: Date.now(),
          });

          childResult = await currentChildNode.handle(subtask);
        }
      }

      subtaskResults.push(childResult);
    }

    // 6. Synthesize combined results and report upward
    const combinedConfidence = +(
      subtaskResults.reduce((acc, r) => acc + r.confidence, 0) / subtaskResults.length
    ).toFixed(2);

    const finalResult: TaskResult = {
      summary: `Synthesized report for "${task.description}" aggregating ${subtaskResults.length} subtask deliverables.`,
      confidence: combinedConfidence,
      verdict: "pass",
      artifacts: [
        {
          type: "deliverable",
          ref: `ref://synthesis/${task.id}-summary.md`,
        },
      ],
    };

    task.status = "completed";
    task.result = finalResult;

    this.eventBus.emit({
      type: "task.result",
      taskId: task.id,
      result: finalResult,
      ts: Date.now(),
    });

    this.profile.status = "idle";
    return finalResult;
  }
}
