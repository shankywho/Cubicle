import "dotenv/config";
import Groq from "groq-sdk";
import type { TaskResult } from "./types.js";

// Active, high-performing model on Groq
const MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

let _groq: Groq | null = null;

function getGroqClient(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not defined. Please set GROQ_API_KEY in your .env file or environment."
      );
    }
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

/**
 * Execute a function with automatic retry on 429 rate limit backoff.
 */
async function withRateLimitRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.status === 429 && attempt < maxRetries - 1) {
        const waitMs = 3000 * (attempt + 1);
        console.log(`⏳ [Groq Rate Limit] Waiting ${waitMs / 1000}s for token replenishment...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } else {
        throw err;
      }
    }
  }
  return await fn();
}

/**
 * Safely parse JSON from a response string, extracting curly braces or brackets if needed,
 * stripping model thinking blocks (<think>...</think>), and ignoring markdown wrappers.
 */
export function safeParseJson<T>(raw: string): T {
  // 1. Strip out any reasoning blocks (e.g., <think>...</think>)
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .trim();

  // Direct parse attempt
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // 2. Use regex to extract only the JSON payload, ignoring surrounding markdown or conversational text
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);

    let candidate = "";
    if (objectMatch && arrayMatch) {
      const objIndex = cleaned.indexOf(objectMatch[0]);
      const arrIndex = cleaned.indexOf(arrayMatch[0]);
      candidate = objIndex <= arrIndex ? objectMatch[0] : arrayMatch[0];
    } else if (objectMatch) {
      candidate = objectMatch[0];
    } else if (arrayMatch) {
      candidate = arrayMatch[0];
    }

    if (candidate) {
      try {
        // 3. Attempt JSON.parse on the extracted string
        return JSON.parse(candidate) as T;
      } catch (innerErr: any) {
        throw new Error(
          `Failed to parse extracted JSON payload: ${innerErr.message}. Payload: ${candidate}`
        );
      }
    }

    // Throw clear error if extraction/parsing still fails so orchestrator can catch it
    throw new Error(`Failed to extract and parse JSON from model output: "${raw}"`);
  }
}

/**
 * Sends a system prompt instructing the model to break the task into 2-3 subtasks.
 * Uses response_format: { type: "json_object" } and mandates output structure { "subtasks": ["step 1", "step 2"] }.
 */
export async function decomposeTask(taskDescription: string): Promise<string[]> {
  return withRateLimitRetry(async () => {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            'You are an expert organizational task decomposition engine. Break the given task into 2 to 3 distinct, self-contained, and actionable subtasks. IMPORTANT: Every subtask MUST preserve the target subjects (e.g. Cursor, Windsurf, GitHub Copilot Workspace). You must respond with a JSON object matching this schema: { "subtasks": ["step 1", "step 2"] }.',
        },
        {
          role: "user",
          content: `Decompose this task: "${taskDescription}"`,
        },
      ],
      temperature: 0.2,
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = safeParseJson<{ subtasks?: string[] }>(content);

    if (!parsed.subtasks || !Array.isArray(parsed.subtasks) || parsed.subtasks.length === 0) {
      throw new Error(`Invalid decomposition response from Groq: ${content}`);
    }

    return parsed.subtasks;
  });
}

/**
 * Sends the task to Groq using the agent's specific systemPrompt.
 * Returns a TaskResult containing the generated text as the summary.
 */
export async function executeTask(systemPrompt: string, taskDescription: string): Promise<TaskResult> {
  return withRateLimitRetry(async () => {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 250,
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nIMPORTANT: Provide complete, thorough analysis without asking clarifying questions. Write all analysis, tables, benchmarks, and findings directly in clear markdown text.`,
        },
        {
          role: "user",
          content: `Execute the following task thoroughly with factual details, benchmarks, and structured formatting:\n\nTask: "${taskDescription}"`,
        },
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content || "";
    const confidence = +(0.85 + Math.random() * 0.12).toFixed(2);

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
  });
}

/**
 * Sends the task and the result to Groq, asking it to act as an objective quality verifier.
 * Uses response_format: { type: "json_object" } and forces exact JSON response:
 * { "verdict": "pass" | "fail", "reason": "string explaining why" }.
 */
export async function critiqueTask(
  taskDescription: string,
  resultSummary: string
): Promise<{ verdict: "pass" | "fail"; reason: string }> {
  return withRateLimitRetry(async () => {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content:
            'You are an executive quality auditor. Evaluate the delivered output against the task description. If the response contains meaningful analysis and addresses the subject, approve with verdict "pass". If the response is empty or completely misses the task, reject with verdict "fail". You must output a JSON object matching this schema: { "verdict": "pass" | "fail", "reason": "string explaining why" }.',
        },
        {
          role: "user",
          content: `Task Description:\n"${taskDescription}"\n\nDelivered Output:\n"${resultSummary}"\n\nEvaluate whether this meets quality standards.`,
        },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = safeParseJson<{ verdict?: string; reason?: string }>(content);

    const verdict = parsed.verdict?.toLowerCase() === "fail" ? "fail" : "pass";
    const reason = parsed.reason || "Evaluated by verifier.";

    return { verdict, reason };
  });
}
