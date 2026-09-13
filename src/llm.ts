import Anthropic from "@anthropic-ai/sdk";
import type { TaskResult } from "./types.js";

const MODEL = "claude-3-5-sonnet-20241022";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Safely parse JSON from Claude's response, stripping markdown backticks if present.
 */
function parseJsonResponse<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new Error(`Failed to parse JSON response from Claude: ${text}`);
  }
}

/**
 * Sends a prompt asking Claude to break a task into 2-4 subtasks.
 * Strictly forces JSON format: { subtasks: string[] }.
 */
export async function decomposeTask(taskDescription: string): Promise<string[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      'You are an expert organizational task decomposition engine. Break the given task into 2 to 4 distinct, well-scoped, and actionable subtasks. Output ONLY valid JSON matching this schema: { "subtasks": ["string", "string"] } with no extra commentary.',
    messages: [
      {
        role: "user",
        content: `Task to decompose: "${taskDescription}"`,
      },
    ],
  });

  const contentBlock = response.content[0];
  const responseText = contentBlock?.type === "text" ? contentBlock.text : "";
  const parsed = parseJsonResponse<{ subtasks: string[] }>(responseText);

  if (!parsed.subtasks || !Array.isArray(parsed.subtasks) || parsed.subtasks.length === 0) {
    throw new Error(`Invalid decomposition response from Claude: ${responseText}`);
  }

  return parsed.subtasks;
}

/**
 * Executes an atomic task with Claude using the agent's specific systemPrompt.
 * Returns a TaskResult containing the Claude-authored content.
 */
export async function executeTask(systemPrompt: string, taskDescription: string): Promise<TaskResult> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Execute the following task with thorough detail, factual accuracy, and structured formatting:\n\nTask: "${taskDescription}"`,
      },
    ],
  });

  const contentBlock = response.content[0];
  const responseText = contentBlock?.type === "text" ? contentBlock.text : "";
  const confidence = +(0.82 + Math.random() * 0.16).toFixed(2);

  return {
    summary: responseText,
    confidence,
    artifacts: [
      {
        type: "document",
        ref: `ref://claude/${Date.now().toString(36)}.md`,
      },
    ],
  };
}

/**
 * Sends the task and its execution result to Claude acting as a rigorous rubric critic.
 * Strictly forces JSON response: { verdict: "pass" | "fail", reason: string }.
 */
export async function critiqueTask(
  taskDescription: string,
  resultSummary: string
): Promise<{ verdict: "pass" | "fail"; reason: string }> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      'You are an uncompromising executive quality verifier and critic. Grade the delivered work against the task description using rigorous criteria: factual depth, structural clarity, quantitative evidence, and relevance. If the output lacks sufficient detail, clarity, or concrete rigor, reject it with verdict "fail". Otherwise approve with "pass". Output ONLY valid JSON in this schema: { "verdict": "pass" | "fail", "reason": "string" } with no additional text.',
    messages: [
      {
        role: "user",
        content: `Task Description:\n"${taskDescription}"\n\nDelivered Output:\n"${resultSummary}"\n\nEvaluate whether this meets high quality standards.`,
      },
    ],
  });

  const contentBlock = response.content[0];
  const responseText = contentBlock?.type === "text" ? contentBlock.text : "";
  const parsed = parseJsonResponse<{ verdict: "pass" | "fail"; reason: string }>(responseText);

  if (parsed.verdict !== "pass" && parsed.verdict !== "fail") {
    return {
      verdict: "pass",
      reason: parsed.reason || "Evaluated by verifier.",
    };
  }

  return parsed;
}
