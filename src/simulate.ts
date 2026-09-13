import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { AgentNode } from "./agent.js";
import { EventBus } from "./eventBus.js";
import type { Agent, OrgEvent, Task } from "./types.js";

async function main() {
  console.log("===============================================================");
  console.log("🚀 Starting Autonomous AI Org: Orchestrator Simulation");
  console.log("===============================================================\n");

  const eventBus = new EventBus();

  // Reset log file for a clean simulation trace
  eventBus.clearLog();

  // Format terminal events cleanly as they occur
  eventBus.subscribe((event: OrgEvent) => {
    const time = new Date(event.ts).toISOString().split("T")[1]?.replace("Z", "") || "";
    switch (event.type) {
      case "job.started":
        console.log(`\x1b[36m[${time}] [JOB STARTED]\x1b[0m Brief: "${event.brief}"`);
        break;
      case "agent.hired":
        console.log(
          `\x1b[32m[${time}] [AGENT HIRED]\x1b[0m ${event.agent.name} (Role: ${event.agent.skill}, Desk: ${event.agent.deskId})`
        );
        break;
      case "agent.fired":
        console.log(`\x1b[31m[${time}] [AGENT FIRED]\x1b[0m ID: ${event.agentId} | Reason: ${event.reason}`);
        break;
      case "task.created":
        console.log(
          `\x1b[34m[${time}] [TASK CREATED]\x1b[0m (${event.task.id}) Depth ${event.task.depth}: "${event.task.description}"`
        );
        break;
      case "task.decomposed":
        console.log(
          `\x1b[35m[${time}] [DECOMPOSED]\x1b[0m Task (${event.taskId}) -> [${event.subtaskIds.join(", ")}]`
        );
        break;
      case "task.assigned":
        console.log(
          `\x1b[33m[${time}] [ASSIGNED]\x1b[0m Task (${event.taskId}) assigned to Agent (${event.agentId})`
        );
        break;
      case "task.started":
        console.log(`\x1b[90m[${time}] [TASK STARTED]\x1b[0m Task (${event.taskId}) execution in progress...`);
        break;
      case "task.retry":
        console.log(
          `\x1b[31m[${time}] [RETRY #${event.attempt}]\x1b[0m Task (${event.taskId}) feedback: "${event.feedback}"`
        );
        break;
      case "task.result":
        const verdictColor = event.result.verdict === "pass" ? "\x1b[32m" : "\x1b[31m";
        console.log(
          `${verdictColor}[${time}] [TASK RESULT]\x1b[0m Task (${event.taskId}): Verdict=${event.result.verdict} (Confidence: ${event.result.confidence})`
        );
        break;
      case "job.completed":
        console.log(`\n\x1b[32m[${time}] [JOB COMPLETED]\x1b[0m Job ID: ${event.jobId}`);
        console.log(`\x1b[1mFinal Result Summary:\x1b[0m ${event.finalResult.summary}`);
        break;
    }
  });

  const ceoAgent: Agent = {
    id: "agent-ceo-001",
    parentAgentId: null,
    name: "Alex (CEO)",
    skill: "ceo",
    systemPrompt: "Lead and orchestrate recursive AI organization to fulfill strategic business objectives.",
    tools: ["delegate", "hire"],
    status: "idle",
    deskId: "desk-ceo",
    perf: { attempted: 0, failed: 0, avgConfidence: 1.0 },
  };

  const rootTask: Task = {
    id: "task-root-001",
    parentTaskId: null,
    ownerAgentId: ceoAgent.id,
    description:
      "Research the competitive landscape for modern AI code editors (analyzing Cursor, Windsurf, and GitHub Copilot Workspace), evaluate their core strengths, weaknesses, and pricing, and produce a formal decision memo with a strategic recommendation for our engineering team.",
    status: "pending",
    depth: 0,
    subtaskIds: [],
    attempt: 1,
  };

  const jobId = "job-demo-001";

  // 1. Emit job.started
  eventBus.emit({
    type: "job.started",
    jobId,
    brief: rootTask.description,
    ts: Date.now(),
  });

  // 2. Initialize CEO node and handle root task
  const ceoNode = new AgentNode(ceoAgent, eventBus, 2);
  const finalResult = await ceoNode.handle(rootTask);

  // 3. Emit job.completed
  eventBus.emit({
    type: "job.completed",
    jobId,
    finalResult,
    ts: Date.now(),
  });

  // 4. Capture run into runs/run-001.jsonl
  const runsDir = path.resolve(process.cwd(), "runs");
  if (!fs.existsSync(runsDir)) {
    fs.mkdirSync(runsDir, { recursive: true });
  }
  const runFilePath = path.join(runsDir, "run-001.jsonl");
  fs.copyFileSync(eventBus.getLogPath(), runFilePath);

  console.log("\n===============================================================");
  console.log(`✅ Simulation successfully executed!`);
  console.log(`📝 Event log written to: ${eventBus.getLogPath()}`);
  console.log(`💾 Captured end-to-end run saved to: ${runFilePath}`);
  console.log("===============================================================\n");
}

main().catch((err) => {
  console.error("Simulation error:", err);
  process.exit(1);
});
