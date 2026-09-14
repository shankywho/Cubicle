import fs from "node:fs";
import path from "node:path";
import { safeReadFile, safeExecuteCode } from "../src/tools/security.js";
import { searchWeb } from "../src/tools/search.js";
import { executeTask, critiqueTask } from "../src/llm.js";
import { EventBus } from "../src/eventBus.js";

async function runToolDispatcherTests() {
  console.log("===============================================================");
  console.log("🧪 TESTING HARDENED TOOL DISPATCHER & SECURITY CONFINEMENT");
  console.log("===============================================================\n");

  const testBusPath = path.resolve(process.cwd(), "tests/tool-test.jsonl");
  const testBus = new EventBus(testBusPath);
  testBus.clearLog();

  const events: any[] = [];
  testBus.subscribe((e) => events.push(e));

  // -------------------------------------------------------------
  // TEST 1: Path Traversal & Sensitive File Defense
  // -------------------------------------------------------------
  console.log("👉 [1/4] Testing Path Traversal Defense & Sensitive File Blocklist...");
  
  let traversalBlocked = false;
  try {
    safeReadFile("../../.env");
  } catch (err: any) {
    if (err.message.includes("path traversal attempt")) {
      traversalBlocked = true;
    }
  }

  let envBlocked = false;
  try {
    safeReadFile(".env");
  } catch (err: any) {
    if (err.message.includes("protected or sensitive file")) {
      envBlocked = true;
    }
  }

  let validFileRead = false;
  try {
    const content = safeReadFile("README.md");
    if (content.includes("Cubicle")) {
      validFileRead = true;
    }
  } catch (err: any) {
    console.error("Valid file read failed:", err);
  }

  console.log(`- Path Traversal (../../.env) Blocked: ${traversalBlocked ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`- Sensitive File (.env) Blocked: ${envBlocked ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`- Valid File (README.md) Allowed: ${validFileRead ? "✅ PASS" : "❌ FAIL"}\n`);

  // -------------------------------------------------------------
  // TEST 2: Process Sandbox & Environment Scrubbing
  // -------------------------------------------------------------
  console.log("👉 [2/4] Testing Sandboxed Process & Environment Secret Scrubbing...");
  
  let mathOutputCorrect = false;
  try {
    const mathRes = await safeExecuteCode("print(1337 * 2)");
    if (mathRes.trim() === "2674") {
      mathOutputCorrect = true;
    }
  } catch (err: any) {
    console.error("Math exec error:", err);
  }

  let envScrubbed = false;
  try {
    const envRes = await safeExecuteCode("import os; print('GROQ_API_KEY' in os.environ)");
    if (envRes.trim() === "False") {
      envScrubbed = true;
    }
  } catch (err: any) {
    console.error("Env check error:", err);
  }

  console.log(`- Sandboxed Code Execution Output: ${mathOutputCorrect ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`- Environment Scrubbed (GROQ_API_KEY inaccessible): ${envScrubbed ? "✅ PASS" : "❌ FAIL"}\n`);

  // -------------------------------------------------------------
  // TEST 3: Search Engine Retrieval
  // -------------------------------------------------------------
  console.log("👉 [3/4] Testing Search Engine with Factual Benchmark Grounding...");
  
  const searchResults = await searchWeb("Cursor IDE pricing 2026", 2);
  const searchValid =
    searchResults.length > 0 &&
    searchResults.some((r) => r.snippet.toLowerCase().includes("cursor") || r.snippet.toLowerCase().includes("pro"));

  console.log(`- Search Returned Valid Factual Snippets: ${searchValid ? "✅ PASS" : "❌ FAIL"}\n`);

  // -------------------------------------------------------------
  // TEST 4: Multi-Turn End-to-End Tool Dispatch Loop via LLM
  // -------------------------------------------------------------
  console.log("👉 [4/4] Testing Multi-Turn Tool Dispatch Loop with Real LLM Execution...");
  
  const systemPrompt =
    "You are a specialized competitive research analyst with access to search tools. Search the web for exact pricing details and cite real numbers.";
  const taskDesc = "Research and summarize the exact pricing and plan names for Cursor IDE.";

  const execResult = await executeTask(
    systemPrompt,
    taskDesc,
    ["search_web"],
    "agent-analyst-test",
    testBus
  );

  const toolInvokedEmitted = events.some(
    (e) => e.type === "tool.invoked" && e.toolName === "search_web"
  );
  const toolResultEmitted = events.some(
    (e) => e.type === "tool.result" && e.toolName === "search_web"
  );
  const toolArtifactsAttached =
    Boolean(execResult.artifacts) &&
    execResult.artifacts!.some((a) => a.type === "tool-observation");

  console.log(`- Event 'tool.invoked' Emitted on EventBus: ${toolInvokedEmitted ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`- Event 'tool.result' Emitted on EventBus: ${toolResultEmitted ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`- Tool Observation Artifact Attached: ${toolArtifactsAttached ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`- Final Grounded Summary Length: ${execResult.summary.length} chars`);

  // Test critique verification grounded in tool observations
  const critique = await critiqueTask(taskDesc, execResult.summary, execResult.toolSummary);
  console.log(`- Quality Critique Grounding Verdict: ${critique.verdict.toUpperCase()} (Reason: ${critique.reason})`);

  if (fs.existsSync(testBusPath)) fs.unlinkSync(testBusPath);

  const allPassed =
    traversalBlocked &&
    envBlocked &&
    validFileRead &&
    mathOutputCorrect &&
    envScrubbed &&
    searchValid &&
    toolInvokedEmitted &&
    toolResultEmitted &&
    toolArtifactsAttached &&
    critique.verdict === "pass";

  if (allPassed) {
    console.log("\n===============================================================");
    console.log("🎉 ALL HARDENED TOOL DISPATCHER CHECKS PASSED EMPIRICALLY!");
    console.log("===============================================================\n");
    process.exit(0);
  } else {
    console.error("\n💥 SOME TOOL DISPATCHER CHECKS FAILED!");
    process.exit(1);
  }
}

runToolDispatcherTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
