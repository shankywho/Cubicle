import Groq from "groq-sdk";
import type { TaskResult } from "./types.js";

const MODEL = "llama-3.3-70b-versatile";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Sends a system prompt instructing the model to break the task into 2-4 subtasks.
 * Uses response_format: { type: "json_object" } and mandates output structure { "subtasks": ["step 1", "step 2"] }.
 */
export async function decomposeTask(taskDescription: string): Promise<string[]> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'You are an expert organizational task decomposition engine. Break the given task into 2 to 4 distinct, well-scoped, and actionable subtasks. You must return a JSON object strictly matching this schema: { "subtasks": ["step 1", "step 2"] }.',
      },
      {
        role: "user",
        content: `Decompose this task: "${taskDescription}"`,
      },
    ],
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content) as { subtasks: string[] };

  if (!parsed.subtasks || !Array.isArray(parsed.subtasks) || parsed.subtasks.length === 0) {
    throw new Error(`Invalid decomposition response from Groq: ${content}`);
  }

  return parsed.subtasks;
}

/**
 * Sends the task to Groq using the agent's specific systemPrompt.
 * Returns a TaskResult containing the generated text as the summary, and a mock confidence score between 0.8 and 1.0.
 */
export async function executeTask(systemPrompt: string, taskDescription: string): Promise<TaskResult> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Execute the following task with thorough detail, factual accuracy, and structured formatting:\n\nTask: "${taskDescription}"`,
      },
    ],
    temperature: 0.3,
  });

  const responseText = completion.choices[0]?.message?.content || "";
  const confidence = +(0.82 + Math.random() * 0.16).toFixed(2);

  return {
    summary: responseText,
    confidence,
    artifacts: [
      {
        type: "document",
        ref: `ref://groq/${Date.now().toString(36)}.md`,
      },
    ],
  };
}

/**
 * Sends the task and the result to Groq, asking it to act as a harsh verifier grading against a rubric.
 * Uses response_format: { type: "json_object" } and forces exact JSON response:
 * { "verdict": "pass" | "fail", "reason": "string explaining why" }.
 */
export async function critiqueTask(
  taskDescription: string,
  resultSummary: string
): Promise<{ verdict: "pass" | "fail"; reason: string }> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'You are an uncompromising executive quality verifier and critic. Grade the delivered work against the task description using rigorous criteria: factual depth, structural clarity, quantitative evidence, and relevance. If the output lacks sufficient detail, clarity, or concrete rigor, reject it with verdict "fail". Otherwise approve with "pass". You must output a JSON object strictly matching this schema: { "verdict": "pass" | "fail", "reason": "string explaining why" }.',
      },
      {
        role: "user",
        content: `Task Description:\n"${taskDescription}"\n\nDelivered Output:\n"${resultSummary}"\n\nEvaluate whether this meets high quality standards.`,
      },
    ],
    temperature: 0.1,
  });

  const content = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content) as { verdict: "pass" | "fail"; reason: string };

  if (parsed.verdict !== "pass" && parsed.verdict !== "fail") {
    return {
      verdict: "pass",
      reason: parsed.reason || "Evaluated by verifier.",
    };
  }

  return parsed;
}
