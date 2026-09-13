import type { Agent, Task, TaskResult } from "./types.js";

/**
 * Simulate decomposition of a complex task into 2–3 subtasks.
 */
export async function mockDecompose(task: Task): Promise<Task[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  const baseDepth = task.depth + 1;

  if (task.depth === 0) {
    // CEO level decomposition -> Research and Synthesis manager tasks
    return [
      {
        id: `task-${task.id}-sub1`,
        parentTaskId: task.id,
        ownerAgentId: null,
        description:
          "Conduct in-depth competitive intelligence on Cursor, Windsurf, and Copilot Workspace",
        status: "pending",
        depth: baseDepth,
        subtaskIds: [],
        attempt: 1,
      },
      {
        id: `task-${task.id}-sub2`,
        parentTaskId: task.id,
        ownerAgentId: null,
        description:
          "Synthesize competitive findings, perform metric analysis, and author final decision memo",
        status: "pending",
        depth: baseDepth,
        subtaskIds: [],
        attempt: 1,
      },
    ];
  }

  // Manager level decomposition -> Leaf worker subtasks
  if (task.description.toLowerCase().includes("intelligence") || task.description.toLowerCase().includes("research")) {
    return [
      {
        id: `task-${task.id}-sub1`,
        parentTaskId: task.id,
        ownerAgentId: null,
        description: "Research Cursor capabilities, architecture, pricing, and enterprise adoption",
        status: "pending",
        depth: baseDepth,
        subtaskIds: [],
        attempt: 1,
      },
      {
        id: `task-${task.id}-sub2`,
        parentTaskId: task.id,
        ownerAgentId: null,
        description: "Research Windsurf (Codeium) cascade flow, features, and multi-file workflows",
        status: "pending",
        depth: baseDepth,
        subtaskIds: [],
        attempt: 1,
      },
      {
        id: `task-${task.id}-sub3`,
        parentTaskId: task.id,
        ownerAgentId: null,
        description: "Research GitHub Copilot Workspace specs, task-centric flow, and ecosystem lock-in",
        status: "pending",
        depth: baseDepth,
        subtaskIds: [],
        attempt: 1,
      },
    ];
  }

  // Synthesis subtasks
  return [
    {
      id: `task-${task.id}-sub1`,
      parentTaskId: task.id,
      ownerAgentId: null,
      description: "Tabulate feature comparison matrix, context limits, and pricing models",
      status: "pending",
      depth: baseDepth,
      subtaskIds: [],
      attempt: 1,
    },
    {
      id: `task-${task.id}-sub2`,
      parentTaskId: task.id,
      ownerAgentId: null,
      description: "Draft comprehensive executive decision memo with strategic recommendation",
      status: "pending",
      depth: baseDepth,
      subtaskIds: [],
      attempt: 1,
    },
  ];
}

/**
 * Simulate leaf execution of an atomic task by an agent.
 */
export async function mockExecute(agent: Agent, task: Task): Promise<TaskResult> {
  await new Promise((resolve) => setTimeout(resolve, 80));

  const confidence = +(0.82 + Math.random() * 0.16).toFixed(2);
  return {
    summary: `Completed "${task.description}" via skill [${agent.skill}] with tool invocation.`,
    confidence,
    artifacts: [
      {
        type: "document",
        ref: `ref://${agent.skill}/${task.id}.json`,
      },
    ],
  };
}

/**
 * Simulate self-critique/rubric check.
 * Configured with a ~30% failure rate to exercise the retry/firing logic.
 */
export async function mockSelfCritique(
  agent: Agent,
  task: Task,
  result: TaskResult
): Promise<{ verdict: "pass" | "fail"; reason: string }> {
  await new Promise((resolve) => setTimeout(resolve, 40));

  // In the demo scenario, initial writer drafts intentionally fail rubric checks twice
  // to exercise and visibly showcase the fire-and-rehire mechanism.
  const isInitialWriter = agent.skill === "writing" && !agent.name.includes("Replacement") && task.attempt <= 2;
  const failed = isInitialWriter || Math.random() < 0.3;

  if (failed) {
    return {
      verdict: "fail",
      reason: `Critique score (6.4/10) below minimum threshold (8.0/10): Insufficient detail or incomplete benchmark validation for task "${task.description}".`,
    };
  }

  return {
    verdict: "pass",
    reason: `Critique score (9.2/10): Execution strictly meets quality criteria and rubrics for task "${task.description}".`,
  };
}
