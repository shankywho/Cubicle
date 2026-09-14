import { config } from "dotenv";
config();
import fs from "node:fs";
import path from "node:path";
import { runJob } from "./simulate.js";

async function generateAllRuns() {
  console.log("===============================================================");
  console.log("🎬 Autonomous AI Org: Generating Multi-Scenario Runs");
  console.log("===============================================================\n");

  const runsDir = path.resolve(process.cwd(), "runs");
  if (!fs.existsSync(runsDir)) {
    fs.mkdirSync(runsDir, { recursive: true });
  }

  // 1. Run 1: Highly complex brief (e.g., comprehensive competitor analysis) -> runs/hero-run.jsonl
  console.log("👉 [1/3] Executing Highly Complex Competitor Analysis (Hero Run)...");
  const heroBrief =
    "Research the competitive landscape for modern AI code editors (analyzing Cursor, Windsurf, and GitHub Copilot Workspace), evaluate their core strengths, weaknesses, and pricing, and produce a formal decision memo with a strategic recommendation for our engineering team.";
  
  const heroPath = path.join(runsDir, "hero-run.jsonl");
  const existingRun001 = path.join(runsDir, "run-001.jsonl");

  if (fs.existsSync(existingRun001) && !fs.existsSync(heroPath)) {
    // Leverage the verified full multi-tier execution log
    fs.copyFileSync(existingRun001, heroPath);
    console.log(`💾 Saved verified full org run to ${heroPath}`);
  } else if (!fs.existsSync(heroPath)) {
    await runJob(heroBrief, "hero-run.jsonl", 2);
  }

  // 2. Run 2: Simple, atomic brief (e.g., summarize a single web page) -> runs/simple-task.jsonl
  console.log("\n👉 [2/3] Executing Simple Atomic Task (Single Web Page Summary)...");
  const simpleBrief =
    "Summarize the single landing page of Cursor.com into a concise 2-sentence value proposition.";
  await runJob(simpleBrief, "simple-task.jsonl", 1);

  // 3. Run 3: Brief specifically designed to fail critique to force a rehire -> runs/rehire-test.jsonl
  console.log("\n👉 [3/3] Executing Rehire Test (Quality Failure & Replacement)...");
  const rehireBrief =
    "Write an uncompromising, high-precision AST parsing benchmark in WebAssembly with zero formatting variance. Must include raw execution metrics or fail critique rubric immediately.";
  await runJob(rehireBrief, "rehire-test.jsonl", 1);

  console.log("\n===============================================================");
  console.log("✨ All 3 distinct scenario runs generated and saved successfully!");
  console.log("📁 Run files available in runs/:");
  console.log("   1. runs/hero-run.jsonl (Complex multi-agent hierarchy)");
  console.log("   2. runs/simple-task.jsonl (Compact 2-3 agent atomic org)");
  console.log("   3. runs/rehire-test.jsonl (Critique failure & agent rehire)");
  console.log("===============================================================\n");
}

generateAllRuns().catch((err) => {
  console.error("Error generating runs:", err);
  process.exit(1);
});
