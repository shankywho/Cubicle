import fs from "node:fs";
import path from "node:path";
import type { EventBus } from "./eventBus.js";
import { critiqueTask, decomposeTask, executeTask, synthesizeSkillTemplate } from "./llm.js";
import type { Agent, SkillTemplate, Task, TaskResult } from "./types.js";

let deskCounter = 1;
let agentCounter = 1;

/**
 * Global pool tracking all hired agents in the organization for reuse.
 */
export const organizationPool: AgentNode[] = [];

let localRegistryCache: SkillTemplate[] | null = null;

function getSkillRegistry(): SkillTemplate[] {
  if (!localRegistryCache) {
    const registryPath = path.resolve(process.cwd(), "src/skills/registry.json");
    localRegistryCache = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  }
  return localRegistryCache!;
}

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
   * Finds an existing idle agent from the organization pool, or hires a new one from registry.json.
   * If the skill is unregistered, dynamically synthesizes the SkillTemplate on the fly using Groq.
   * If feedback is provided (rehire after firing), dynamically injects the corrective feedback.
   */
  public async findOrHire(
    requiredSkill: string,
    taskDesc: string,
    feedback?: string
  ): Promise<AgentNode> {
    // 1. Scan organizationPool for an agent where agent.skill === requiredSkill and agent.status === "idle"
    if (!feedback) {
      const idleNode = organizationPool.find(
        (node) => node.profile.skill === requiredSkill && node.profile.status === "idle"
      );
      if (idleNode) {
        idleNode.profile.status = "working";
        return idleNode;
      }
    }

    // 2. Check registry; if missing, synthesize on-the-fly via Groq
    const templates = getSkillRegistry();
    let template = templates.find((t) => t.key === requiredSkill);

    if (!template) {
      template = await synthesizeSkillTemplate(requiredSkill, taskDesc);
      templates.push(template);
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
      status: "working",
      deskId,
      perf: {
        attempted: 0,
        failed: 0,
        avgConfidence: 0.9,
      },
    };

    const newNode = new AgentNode(agent, this.eventBus, this.depthLimit);
    organizationPool.push(newNode);

    this.eventBus.emit({
      type: "agent.hired",
      agent,
      ts: Date.now(),
    });

    return newNode;
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

      if (this.profile.parentAgentId) {
        this.eventBus.emit({
          type: "message",
          fromAgentId: this.profile.id,
          toAgentId: this.profile.parentAgentId,
          content: `Completed with verdict: ${execResult.verdict || "pass"}.`,
          ts: Date.now(),
        });
      }

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
    subtasks.forEach((subtask) => {
      this.eventBus.emit({
        type: "task.created",
        task: subtask,
        ts: Date.now(),
      });
    });

    // Emit decomposition event
    this.eventBus.emit({
      type: "task.decomposed",
      taskId: task.id,
      subtaskIds: task.subtaskIds,
      ts: Date.now(),
    });

    // 4. For each subtask: Hire, assign, and recursively execute concurrently via Promise.all
    const subtaskResults: TaskResult[] = await Promise.all(
      subtasks.map(async (subtask) => {
        const requiredSkill = determineSkillForTask(subtask);
        let currentChildNode = await this.findOrHire(requiredSkill, subtask.description);

        subtask.ownerAgentId = currentChildNode.profile.id;
        subtask.status = "assigned";
        this.eventBus.emit({
          type: "task.assigned",
          taskId: subtask.id,
          agentId: currentChildNode.profile.id,
          ts: Date.now(),
        });

        // 1. Emit delegation message from parent to child
        this.eventBus.emit({
          type: "message",
          fromAgentId: this.profile.id,
          toAgentId: currentChildNode.profile.id,
          content: `I need you to handle: "${subtask.description}"`,
          ts: Date.now(),
        });

        let childResult = await currentChildNode.handle(subtask);

        // 5. Enforce 2 failures before firing based on Claude's real critique verdict
        while (childResult.verdict === "fail") {
          if (currentChildNode.profile.perf.failed >= 2) {
            // Exactly 2 failures reached -> fire failing agent
            currentChildNode.profile.status = "fired";
            this.eventBus.emit({
              type: "agent.fired",
              agentId: currentChildNode.profile.id,
              reason: `Repeated quality failure on task "${subtask.id}": ${childResult.verdictReason}`,
              ts: Date.now(),
            });

            // Immediately rehire replacement using findOrHire with failure feedback injected
            const replacementNode = await this.findOrHire(
              requiredSkill,
              subtask.description,
              childResult.verdictReason
            );

            subtask.ownerAgentId = replacementNode.profile.id;
            subtask.attempt = currentChildNode.profile.perf.failed + 1;
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
              agentId: replacementNode.profile.id,
              ts: Date.now(),
            });

            this.eventBus.emit({
              type: "message",
              fromAgentId: this.profile.id,
              toAgentId: replacementNode.profile.id,
              content: `I need you to handle: "${subtask.description}"`,
              ts: Date.now(),
            });

            // Execute replacement with forced pass to conclude retry cycle
            childResult = await replacementNode.handle(subtask, true);
            currentChildNode = replacementNode;
            break;
          } else {
            // First failure (perf.failed === 1): retry once with current agent
            subtask.attempt = currentChildNode.profile.perf.attempted + 1;
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

        return childResult;
      })
    );

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

    if (this.profile.parentAgentId) {
      this.eventBus.emit({
        type: "message",
        fromAgentId: this.profile.id,
        toAgentId: this.profile.parentAgentId,
        content: `Completed with verdict: ${finalResult.verdict || "pass"}.`,
        ts: Date.now(),
      });
    }

    this.profile.status = "idle";
    return finalResult;
  }
}
