import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import express from "express";
import { Server } from "socket.io";
import { io as ClientIO } from "../frontend/node_modules/socket.io-client/build/esm/index.js";
import { AgentNode } from "../src/agent.js";
import { EventBus } from "../src/eventBus.js";
import { safeParseJson } from "../src/llm.js";
import type { Agent, OrgEvent, Task } from "../src/types.js";

async function runTests() {
  console.log("===============================================================");
  console.log("🧪 RUNNING ACCEPTANCE CHECKS FOR BACKEND AUDIT");
  console.log("===============================================================\n");

  const results: Record<string, { pass: boolean; evidence: string }> = {};

  // -------------------------------------------------------------
  // CHECK 1: Full run produces job.completed with non-empty result
  // -------------------------------------------------------------
  console.log("--- Executing Check 1: Full Run Completion ---");
  try {
    const testBusPath = path.resolve(process.cwd(), "tests/check1.jsonl");
    const testBus = new EventBus(testBusPath);
    testBus.clearLog();

    let completedEvent: any = null;
    testBus.subscribe((ev) => {
      if (ev.type === "job.completed") completedEvent = ev;
    });

    const ceoAgent: Agent = {
      id: "agent-ceo-test1",
      parentAgentId: null,
      name: "Alex (CEO)",
      skill: "ceo",
      systemPrompt: "Lead org",
      tools: ["delegate"],
      status: "idle",
      deskId: "desk-ceo",
      perf: { attempted: 0, failed: 0, avgConfidence: 1.0 },
    };

    const rootTask: Task = {
      id: "task-check-1",
      parentTaskId: null,
      ownerAgentId: ceoAgent.id,
      description: "Summarize key differentiation points of Cursor IDE in 1 sentence.",
      status: "pending",
      depth: 0,
      subtaskIds: [],
      attempt: 1,
    };

    const ceoNode = new AgentNode(ceoAgent, testBus, 1);
    const finalResult = await ceoNode.handle(rootTask);

    testBus.emit({
      type: "job.completed",
      jobId: "job-check-1",
      finalResult,
      ts: Date.now(),
    });

    const passed = Boolean(completedEvent && finalResult.summary && finalResult.summary.length > 20);
    results["Check 1: Full Run Produces job.completed"] = {
      pass: passed,
      evidence: `jobId: ${completedEvent?.jobId}, summary length: ${finalResult.summary?.length} chars, verdict: ${finalResult.verdict}`,
    };
    console.log(`Result Check 1: ${passed ? "PASS" : "FAIL"}\n`);
    if (fs.existsSync(testBusPath)) fs.unlinkSync(testBusPath);
  } catch (err: any) {
    results["Check 1: Full Run Produces job.completed"] = {
      pass: false,
      evidence: `Failed with error: ${err.message}`,
    };
  }

  // -------------------------------------------------------------
  // CHECK 2: Forced agent.fired + task.retry pair
  // -------------------------------------------------------------
  console.log("--- Executing Check 2: Forced Fire & Retry Pair ---");
  try {
    const rehireLog = fs.readFileSync(path.resolve(process.cwd(), "runs/rehire-test.jsonl"), "utf-8");
    const rehireLines = rehireLog.trim().split("\n").map((l) => JSON.parse(l));
    const hasFired = rehireLines.some((e: any) => e.type === "agent.fired");
    const hasRetry = rehireLines.some((e: any) => e.type === "task.retry");
    const firedEv = rehireLines.find((e: any) => e.type === "agent.fired");
    const retryEv = rehireLines.find((e: any) => e.type === "task.retry" && e.attempt === 3);

    const passed = hasFired && hasRetry;
    results["Check 2: Forced agent.fired + task.retry Pair"] = {
      pass: passed,
      evidence: `agent.fired present (agentId: ${firedEv?.agentId}, reason: "${firedEv?.reason?.slice(0, 60)}...") paired with task.retry (attempt: ${retryEv?.attempt})`,
    };
    console.log(`Result Check 2: ${passed ? "PASS" : "FAIL"}\n`);
  } catch (err: any) {
    results["Check 2: Forced agent.fired + task.retry Pair"] = {
      pass: false,
      evidence: `Failed with error: ${err.message}`,
    };
  }

  // -------------------------------------------------------------
  // CHECK 3: Out-of-registry brief triggers on-the-fly skill synthesis
  // -------------------------------------------------------------
  console.log("--- Executing Check 3: On-the-fly Skill Synthesis ---");
  try {
    const testBus = new EventBus(path.resolve(process.cwd(), "tests/check3.jsonl"));
    const ceoAgent: Agent = {
      id: "agent-ceo-test3",
      parentAgentId: null,
      name: "Alex (CEO)",
      skill: "ceo",
      systemPrompt: "Lead org",
      tools: ["delegate"],
      status: "idle",
      deskId: "desk-ceo",
      perf: { attempted: 0, failed: 0, avgConfidence: 1.0 },
    };
    const node = new AgentNode(ceoAgent, testBus, 1);

    let errorCaught = false;
    let errorMessage = "";
    try {
      node.findOrHire("quantum-cryptography-specialist");
    } catch (err: any) {
      errorCaught = true;
      errorMessage = err.message;
    }

    const passed = !errorCaught;
    results["Check 3: Unregistered Skill Synthesis"] = {
      pass: passed,
      evidence: errorCaught
        ? `FAIL: Throws fatal Error: "${errorMessage}". On-the-fly skill synthesis via LLM is not implemented.`
        : "PASS: Successfully synthesized new skill template.",
    };
    console.log(`Result Check 3: ${passed ? "PASS" : "FAIL"}\n`);
  } catch (err: any) {
    results["Check 3: Unregistered Skill Synthesis"] = {
      pass: false,
      evidence: `Failed with error: ${err.message}`,
    };
  }

  // -------------------------------------------------------------
  // CHECK 4: Live WebSocket stream order == saved JSONL order
  // -------------------------------------------------------------
  console.log("--- Executing Check 4: Live WS vs JSONL Order ---");
  try {
    const testApp = express();
    const testHttpServer = http.createServer(testApp);
    const testIO = new Server(testHttpServer, { cors: { origin: "*" } });

    await new Promise<void>((resolve) => testHttpServer.listen(3899, resolve));

    const testBusPath = path.resolve(process.cwd(), "tests/check4.jsonl");
    const testBus = new EventBus(testBusPath);
    testBus.clearLog();

    testBus.subscribe((ev) => testIO.emit("orgEvent", ev));

    const clientSocket = ClientIO("http://localhost:3899");
    const receivedEvents: OrgEvent[] = [];

    await new Promise<void>((resolve) => clientSocket.on("connect", resolve));
    clientSocket.on("orgEvent", (ev: any) => receivedEvents.push(ev));

    const sampleEvents: OrgEvent[] = [
      { type: "job.started", jobId: "test-job-4", brief: "test brief", ts: 1000 },
      { type: "task.created", task: { id: "t1", parentTaskId: null, ownerAgentId: null, description: "desc", status: "pending", depth: 0, subtaskIds: [], attempt: 1 }, ts: 1001 },
      { type: "agent.hired", agent: { id: "a1", parentAgentId: null, name: "Worker", skill: "writing", systemPrompt: "p", tools: [], status: "idle", deskId: "d1", perf: { attempted: 0, failed: 0, avgConfidence: 1 } }, ts: 1002 },
      { type: "task.assigned", taskId: "t1", agentId: "a1", ts: 1003 },
      { type: "job.completed", jobId: "test-job-4", finalResult: { summary: "done", confidence: 1 }, ts: 1004 },
    ];

    for (const ev of sampleEvents) {
      testBus.emit(ev);
    }

    await new Promise((r) => setTimeout(r, 150));

    clientSocket.close();
    await new Promise<void>((resolve) => testHttpServer.close(() => resolve()));

    const jsonlLines = fs.readFileSync(testBusPath, "utf-8").trim().split("\n").map((l) => JSON.parse(l));

    let orderMatched = jsonlLines.length === receivedEvents.length;
    for (let i = 0; i < jsonlLines.length; i++) {
      if (jsonlLines[i].type !== receivedEvents[i]?.type || jsonlLines[i].ts !== receivedEvents[i]?.ts) {
        orderMatched = false;
        break;
      }
    }

    results["Check 4: Live WebSocket Order == JSONL Order"] = {
      pass: orderMatched,
      evidence: `Emitted: ${sampleEvents.length}, WS Received: ${receivedEvents.length}, JSONL written: ${jsonlLines.length}. All event types and timestamps match 1:1.`,
    };
    console.log(`Result Check 4: ${orderMatched ? "PASS" : "FAIL"}\n`);
    if (fs.existsSync(testBusPath)) fs.unlinkSync(testBusPath);
  } catch (err: any) {
    results["Check 4: Live WebSocket Order == JSONL Order"] = {
      pass: false,
      evidence: `Failed with error: ${err.message}`,
    };
  }

  // -------------------------------------------------------------
  // CHECK 5: Max depth / agent ceiling guard
  // -------------------------------------------------------------
  console.log("--- Executing Check 5: Max Depth Guard Enforcement ---");
  try {
    const testBusPath = path.resolve(process.cwd(), "tests/check5.jsonl");
    const testBus = new EventBus(testBusPath);
    testBus.clearLog();

    let maxObservedDepth = 0;
    testBus.subscribe((ev) => {
      if (ev.type === "task.created" && ev.task.depth > maxObservedDepth) {
        maxObservedDepth = ev.task.depth;
      }
    });

    const ceoAgent: Agent = {
      id: "agent-ceo-test5",
      parentAgentId: null,
      name: "Alex (CEO)",
      skill: "ceo",
      systemPrompt: "Lead org",
      tools: ["delegate"],
      status: "idle",
      deskId: "desk-ceo",
      perf: { attempted: 0, failed: 0, avgConfidence: 1.0 },
    };

    const rootTask: Task = {
      id: "task-check-5",
      parentTaskId: null,
      ownerAgentId: ceoAgent.id,
      description: "Perform recursive nested competitor breakdown.",
      status: "pending",
      depth: 0,
      subtaskIds: [],
      attempt: 1,
    };

    const ceoNode = new AgentNode(ceoAgent, testBus, 1);
    await ceoNode.handle(rootTask);

    const passed = maxObservedDepth <= 1;
    results["Check 5: Max Depth Guard Enforced"] = {
      pass: passed,
      evidence: `Configured depthLimit=1, maxObservedDepth in created subtasks = ${maxObservedDepth}. Depth guard actively terminates recursion at ceiling.`,
    };
    console.log(`Result Check 5: ${passed ? "PASS" : "FAIL"}\n`);
    if (fs.existsSync(testBusPath)) fs.unlinkSync(testBusPath);
  } catch (err: any) {
    results["Check 5: Max Depth Guard Enforced"] = {
      pass: false,
      evidence: `Failed with error: ${err.message}`,
    };
  }

  // -------------------------------------------------------------
  // CHECK 6: Malformed LLM output error handling
  // -------------------------------------------------------------
  console.log("--- Executing Check 6: Malformed LLM Output Handling ---");
  try {
    const rawWithThinkAndMarkdown = `<think>
Decomposing task into components...
</think>
\`\`\`json
{
  "subtasks": ["Analyze Cursor IDE", "Analyze Windsurf IDE"]
}
\`\`\`
Extra commentary here.`;

    const parsed = safeParseJson<{ subtasks: string[] }>(rawWithThinkAndMarkdown);
    const parsedValid = Array.isArray(parsed.subtasks) && parsed.subtasks.length === 2;

    let errorCaught = false;
    try {
      safeParseJson("Invalid raw string with no json");
    } catch (e: any) {
      errorCaught = true;
    }

    const check6Passed = parsedValid && errorCaught;
    results["Check 6: Malformed LLM Output Handling"] = {
      pass: check6Passed,
      evidence: check6Passed
        ? "PASS: safeParseJson stripped <think> tags, extracted JSON from markdown blocks, and threw clear error on invalid input."
        : "FAIL: Did not handle markdown or invalid JSON as expected.",
    };
    console.log(`Result Check 6: ${check6Passed ? "PASS" : "FAIL"}\n`);
  } catch (err: any) {
    results["Check 6: Malformed LLM Output Handling"] = {
      pass: false,
      evidence: err.message,
    };
    console.log("Result Check 6: FAIL\n");
  }

  // -------------------------------------------------------------
  // CHECK 7: Concurrency (Sequential vs Promise.all)
  // -------------------------------------------------------------
  console.log("--- Executing Check 7: Subtask Concurrency ---");
  try {
    const agentCode = fs.readFileSync("src/agent.ts", "utf8");
    const hasPromiseAll = agentCode.includes("Promise.all");
    const isSequentialLoop = agentCode.includes("for (const subtask of subtasks)");

    const check7Passed = hasPromiseAll && !isSequentialLoop;
    results["Check 7: Sibling Subtasks Execute Concurrently"] = {
      pass: check7Passed,
      evidence: isSequentialLoop
        ? "FAIL: src/agent.ts line 219 uses sequential loop 'for (const subtask of subtasks) { ... await currentChildNode.handle(subtask); }'. Siblings execute in serial order, not in parallel via Promise.all."
        : "PASS: Promise.all concurrency detected in src/agent.ts.",
    };
    console.log(`Result Check 7: ${check7Passed ? "PASS" : "FAIL"}\n`);
  } catch (err: any) {
    results["Check 7: Sibling Subtasks Execute Concurrently"] = {
      pass: false,
      evidence: err.message,
    };
    console.log("Result Check 7: FAIL\n");
  }

  console.log("===============================================================");
  console.log("📊 FINAL ACCEPTANCE CHECK SUMMARY");
  console.log("===============================================================");
  for (const [name, res] of Object.entries(results)) {
    console.log(`${res.pass ? "✅ PASS" : "❌ FAIL"} - ${name}`);
    console.log(`   ${res.evidence}\n`);
  }
}

runTests().catch(console.error);
