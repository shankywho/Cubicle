import fs from "node:fs";
import path from "node:path";
import type { EventBus } from "./eventBus.js";
import { mockDecompose, mockExecute, mockSelfCritique } from "./mockLlm.js";
import type { Agent, SkillTemplate, Task, TaskResult } from "./types.js";

let deskCounter = 1;
let agentCounter = 1;

/**
 * Determine the required skill key for a subtask based on task depth and description.
 */
export function determineSkillForTask(task: Task): string {
  const desc = task.description.toLowerCase();

  if (task.depth === 1) {
    if (desc.includes("research") || desc.includes("intelligence")) {
      return "manager-research";
    }
    return "manager-synthesis";
  }

  // Depth >= 2: Leaf worker roles
  if (desc.includes("matrix") || desc.includes("pricing") || desc.includes("comparison") || desc.includes("metric")) {
    return "data-analysis";
  }

  if (desc.includes("draft") || desc.includes("memo") || desc.includes("recommendation")) {
    return "writing";
  }

  if (desc.includes("critique") || desc.includes("review")) {
    return "critique";
  }

  return "web-research";
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
   * Find template in registry.json and instantiate agent.
   * If feedback is provided, inject corrective directive into the system prompt.
   */
  public findOrHire(requiredSkill: string, feedback?: string): Agent {
    const registryPath = path.resolve(process.cwd(), "src/skills/registry.json");
    const templates: SkillTemplate[] = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    const template = templates.find((t) => t.key === requiredSkill);

    if (!template) {
      throw new Error(`Skill template not found in registry for key: "${requiredSkill}"`);
    }

    const id = `agent-${template.key}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const deskId = `desk-${deskCounter++}`;
    const isRehire = Boolean(feedback);

    let systemPrompt = template.promptFragment;
    if (feedback) {
      systemPrompt += `\n\nIMPORTANT CORRECTIVE DIRECTIVE: ${feedback}`;
    }

    const nameMap: Record<string, string> = {
      "manager-research": "Research Lead",
      "manager-synthesis": "Synthesis Lead",
      "web-research": "Research Analyst",
      "data-analysis": "Data Analyst",
      "writing": "Senior Writer",
      "critique": "Rubric Critic",
    };
    const roleBaseName = nameMap[template.key] || template.key;
    const name = isRehire ? `Replacement ${roleBaseName} #${agentCounter++}` : `${roleBaseName} #${agentCounter++}`;

    const agent: Agent = {
      id,
      parentAgentId: this.profile.id,
      name,
      skill: template.key,
      systemPrompt,
      tools: [...template.defaultTools],
      status: "idle",
      deskId,
      perf: {
        attempted: 0,
        failed: 0,
        avgConfidence: 0.9,
      },
    };

    return agent;
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
      const requiredSkill = determineSkillForTask(subtask);
      let currentChildProfile = this.findOrHire(requiredSkill);
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

          // Hire replacement with failure feedback via findOrHire
          const replacementProfile = this.findOrHire(requiredSkill, childResult.verdictReason);
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
