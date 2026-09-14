import fs from "node:fs";
import path from "node:path";
import { AgentNode, organizationPool } from "../src/agent.js";
import { EventBus } from "../src/eventBus.js";
import type { Agent, Task } from "../src/types.js";

async function verifyPoolConcurrency() {
  console.log("===============================================================");
  console.log("🧪 TESTING CONCURRENT IDLE AGENT POOL CLAIMING");
  console.log("===============================================================\n");

  const testBusPath = path.resolve(process.cwd(), "tests/race-test.jsonl");
  const testBus = new EventBus(testBusPath);
  testBus.clearLog();

  // 1. Pre-seed the organizationPool with exactly ONE idle web-research agent
  organizationPool.length = 0; // reset pool

  const preExistingAgent: Agent = {
    id: "agent-web-research-existing",
    parentAgentId: null,
    name: "Pre-existing Research Analyst",
    skill: "web-research",
    systemPrompt: "Conduct search",
    tools: ["search_web"],
    status: "idle",
    deskId: "desk-existing",
    perf: { attempted: 5, failed: 0, avgConfidence: 0.95 },
  };

  const preExistingNode = new AgentNode(preExistingAgent, testBus, 2);
  organizationPool.push(preExistingNode);

  console.log("Initial organizationPool state:");
  console.log(`- Total agents: ${organizationPool.length}`);
  console.log(`- Agent ID: ${organizationPool[0].profile.id}, Status: ${organizationPool[0].profile.status}\n`);

  // 2. Set up parent manager node
  const managerAgent: Agent = {
    id: "agent-manager-test",
    parentAgentId: null,
    name: "Test Manager",
    skill: "manager-research",
    systemPrompt: "Lead research",
    tools: ["delegate"],
    status: "idle",
    deskId: "desk-mgr",
    perf: { attempted: 0, failed: 0, avgConfidence: 1.0 },
  };
  const managerNode = new AgentNode(managerAgent, testBus, 2);

  // 3. Simultaneously request 2 agents for web-research concurrently
  console.log("👉 Triggering 2 concurrent findOrHire calls for 'web-research' via Promise.all...");
  const [claimA, claimB] = await Promise.all([
    managerNode.findOrHire("web-research", "Investigate Cursor AI Editor architecture"),
    managerNode.findOrHire("web-research", "Investigate Windsurf Cascade engine"),
  ]);

  console.log("\nResults of concurrent findOrHire:");
  console.log(`- Claim A agent ID: ${claimA.profile.id} (Status: ${claimA.profile.status})`);
  console.log(`- Claim B agent ID: ${claimB.profile.id} (Status: ${claimB.profile.status})`);
  console.log(`- Total agents in pool: ${organizationPool.length}\n`);

  // Assertions
  const claimedExisting = claimA.profile.id === preExistingAgent.id || claimB.profile.id === preExistingAgent.id;
  const distinctAgents = claimA.profile.id !== claimB.profile.id;
  const poolExpanded = organizationPool.length === 2;

  console.log("Assertions:");
  console.log(`1. One claim received existing idle agent: ${claimedExisting ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`2. Sibling claims received distinct agents: ${distinctAgents ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`3. Second claim allocated a new worker into pool: ${poolExpanded ? "✅ PASS" : "❌ FAIL"}`);

  if (fs.existsSync(testBusPath)) fs.unlinkSync(testBusPath);

  if (claimedExisting && distinctAgents && poolExpanded) {
    console.log("\n🎉 RACE TEST VERIFIED: No double-booking occurs under concurrent dispatch!");
    process.exit(0);
  } else {
    console.error("\n💥 RACE TEST FAILED: Double booking or incorrect pool behavior detected!");
    process.exit(1);
  }
}

verifyPoolConcurrency().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
