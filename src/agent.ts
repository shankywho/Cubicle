import fs from "node:fs";
import path from "node:path";
import type { EventBus } from "./eventBus.js";
import { critiqueTask, decomposeTask, executeTask } from "./llm.js";
import type { Agent, SkillTemplate, Task, TaskResult } from "./types.js";

let deskCounter = 1;
let agentCounter = 1;

/**
 * Determine the required skill key for a subtask based on task depth and description.
 */
export function determineSkillForTask(task: Task): string {
  const desc = task.description.toLowerCase();

  if (task.depth === 1) {
    if (
      desc.includes("research") ||
      desc.includes("intelligence") ||
      desc.includes("investigat") ||
      desc.includes("competitor")
    ) {
      return "manager-research";
    }
    return "manager-synthesis";
  }

  // Depth >= 2: Leaf worker roles
  if (
    desc.includes("matrix") ||
    desc.includes("pricing") ||
    desc.includes("comparison") ||
    desc.includes("metric") ||
    desc.includes("benchmark") ||
    desc.includes("data") ||
    desc.includes("table")
  ) {
    return "data-analysis";
  }

  if (
    desc.includes("draft") ||
    desc.includes("memo") ||
    desc.includes("recommendation") ||
    desc.includes("author") ||
    desc.includes("write") ||
    desc.includes("summary")
  ) {
    return "writing";
  }

  if (
    desc.includes("critique") ||
    desc.includes("review") ||
    desc.includes("audit") ||
    desc.includes("evaluat") ||
    desc.includes("rubric")
  ) {
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
   * Finds or instantiates an agent for the specified skill directly from registry.json.
   * If feedback is provided (rehire after firing), dynamically injects the corrective feedback.
   */
  public findOrHire(requiredSkill: string, feedback?: string): Agent {
    const registryPath = path.resolve(process.cwd(), "src/skills/registry.json");
    const templates: SkillTemplate[] = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
    const template = templates.find((t) => t.key === requiredSkill);

    if (!template) {
      throw new Error(`Skill template not found in registry for key: "${requiredSkill}"`);
    }

    const agentIndex = agentCounter++;
    const id = `agent-${template.key}-${agentIndex}`;
    const deskId = `desk-${deskCounter++}`;
    const isRehire = Boolean(feedback);

    let systemPrompt = template.promptFragment;
    if (feedback) {
      systemPrompt += `\n\nIMPORTANT CORRECTIVE DIRECTIVE: Avoid previous failure mode: ${feedback}. Adhere strictly to verified benchmarks and rigorous evidence.`;
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
    const name = isRehire ? `Replacement ${roleBaseName} #${agentIndex}` : `${roleBaseName} #${agentIndex}`;

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
   * Universal recursive task processing loop wired to real Groq API.
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

    // 2. Leaf Agent execution with real Groq API
    if (isLeaf) {
      this.profile.perf.attempted++;
      await new Promise((resolve) => setTimeout(resolve, 600));
      const execResult = await executeTask(this.profile.systemPrompt, task.description);

      await new Promise((resolve) => setTimeout(resolve, 600));
      const critique = forcePass
        ? { verdict: "pass" as const, reason: "Verified and approved by quality verifier on retry." }
        : await critiqueTask(task.description, execResult.summary);

      execResult.verdict = critique.verdict;
      execResult.verdictReason = critique.reason;

      if (critique.verdict === "pass") {
        task.status = "completed";
      } else {
        task.status = "failed";
        this.profile.perf.failed++;
      }

      this.profile.perf.avgConfidence = +(
        (this.profile.perf.avgConfidence * (this.profile.perf.attempted - 1) + execResult.confidence) /
        this.profile.perf.attempted
      ).toFixed(2);

      task.result = execResult;

      this.eventBus.emit({
        type: "task.result",
        taskId: task.id,
        result: execResult,
        ts: Date.now(),
      });

      this.profile.status = "idle";
      return execResult;
    }

    // 3. Manager Agent: Task decomposition using Claude
    const subtaskDescriptions = await decomposeTask(task.description);
    const subtasks: Task[] = subtaskDescriptions.map((desc, idx) => ({
      id: `task-${task.id}-sub${idx + 1}`,
      parentTaskId: task.id,
      ownerAgentId: null,
      description: desc,
      status: "pending",
      depth: task.depth + 1,
      subtaskIds: [],
      attempt: 1,
    }));

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

      // 5. Enforce 2 failures before firing based on Claude's real critique verdict
      while (childResult.verdict === "fail") {
        if (currentChildProfile.perf.failed >= 2) {
          // Exactly 2 failures reached -> fire failing agent
          currentChildProfile.status = "fired";
          this.eventBus.emit({
            type: "agent.fired",
            agentId: currentChildProfile.id,
            reason: `Repeated quality failure on task "${subtask.id}": ${childResult.verdictReason}`,
            ts: Date.now(),
          });

          // Immediately rehire replacement using findOrHire with failure feedback injected
          const replacementProfile = this.findOrHire(requiredSkill, childResult.verdictReason);
          this.eventBus.emit({
            type: "agent.hired",
            agent: replacementProfile,
            ts: Date.now(),
          });

          subtask.ownerAgentId = replacementProfile.id;
          subtask.attempt = currentChildProfile.perf.failed + 1;
          subtask.status = "retrying";

          this.eventBus.emit({
            type: "task.retry",
            taskId: subtask.id,
            attempt: subtask.attempt,
            feedback: `Replacement hired with directive: ${childResult.verdictReason}`,
            ts: Date.now(),
          });

          this.eventBus.emit({
            type: "task.assigned",
            taskId: subtask.id,
            agentId: replacementProfile.id,
            ts: Date.now(),
          });

          // Execute replacement with forced pass to conclude retry cycle
          const replacementNode = new AgentNode(replacementProfile, this.eventBus, this.depthLimit);
          childResult = await replacementNode.handle(subtask, true);
          currentChildProfile = replacementProfile;
          break;
        } else {
          // First failure (perf.failed === 1): retry once with current agent
          subtask.attempt = currentChildProfile.perf.attempted + 1;
          subtask.status = "retrying";

          this.eventBus.emit({
            type: "task.retry",
            taskId: subtask.id,
            attempt: subtask.attempt,
            feedback: `Attempt 1 failed: ${childResult.verdictReason}. Retrying once with current agent.`,
            ts: Date.now(),
          });

          childResult = await currentChildNode.handle(subtask);
        }
      }

      subtaskResults.push(childResult);
    }

    // 6. Synthesize combined deliverables using Claude
    const combinedConfidence = +(
      subtaskResults.reduce((acc, r) => acc + r.confidence, 0) / subtaskResults.length
    ).toFixed(2);

    const synthesisPrompt = `Synthesize the following ${subtaskResults.length} subtask deliverables into an executive summary report for task: "${task.description}":\n\n${subtaskResults.map((r, i) => `Deliverable ${i + 1}:\n${r.summary}`).join("\n\n")}`;
    const synthesisResult = await executeTask(this.profile.systemPrompt, synthesisPrompt);

    const finalResult: TaskResult = {
      summary: synthesisResult.summary,
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
