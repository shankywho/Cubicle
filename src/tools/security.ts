import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Base directory to anchor all file operations
const WORKSPACE_ROOT = path.resolve(process.cwd());

// Blacklist of sensitive files and directories that must never be read
const SENSITIVE_PATTERNS: RegExp[] = [
  /(^|[/\\])\.env($|[/\\])/i,
  /(^|[/\\])\.env\..*/i,
  /(^|[/\\])\.git($|[/\\])/i,
  /id_rsa/i,
  /node_modules/i,
  /\.pem$/i,
  /\.key$/i,
];

/**
 * Safely reads a file from the workspace with strict path-traversal prevention
 * and blacklisting of sensitive configuration/secret files.
 */
export function safeReadFile(filePath: string): string {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Invalid file path parameter: must be a non-empty string.");
  }

  // 1. Resolve absolute path anchored against WORKSPACE_ROOT
  const resolvedPath = path.resolve(WORKSPACE_ROOT, filePath.trim());

  // 2. Reject path traversal escaping workspace root
  if (!resolvedPath.startsWith(WORKSPACE_ROOT)) {
    throw new Error(`Access denied: path traversal attempt outside workspace root: "${filePath}"`);
  }

  // 3. Reject access to sensitive configuration, secrets, or git directories
  const relativePath = path.relative(WORKSPACE_ROOT, resolvedPath);
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(resolvedPath) || pattern.test(relativePath))) {
    throw new Error(`Access denied: attempted access to protected or sensitive file: "${filePath}"`);
  }

  // 4. Verify file existence and file type
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found in workspace: "${filePath}"`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw new Error(`Target is not a regular file: "${filePath}"`);
  }

  // 5. Enforce 64 KB maximum payload limit
  if (stat.size > 64 * 1024) {
    throw new Error(`Access denied: file size (${stat.size} bytes) exceeds maximum allowable 64KB limit.`);
  }

  return fs.readFileSync(resolvedPath, "utf-8");
}

/**
 * Safely executes Python or math code inside a constrained child process
 * with scrubbed environment variables (preventing API key exfiltration),
 * hard execution timeout, and output buffer cap.
 */
export async function safeExecuteCode(code: string): Promise<string> {
  if (!code || typeof code !== "string") {
    throw new Error("Invalid code parameter: must be a non-empty string.");
  }

  // Scrubbed environment containing only basic system paths.
  // Secrets like GROQ_API_KEY and TAVILY_API_KEY are strictly excluded.
  const SCRUBBED_ENV: NodeJS.ProcessEnv = {
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin",
    PYTHONUNBUFFERED: "1",
    NODE_ENV: "production",
  };

  try {
    const { stdout, stderr } = await execFileAsync(
      "python3",
      ["-c", code],
      {
        timeout: 3000, // 3 second hard timeout
        maxBuffer: 50 * 1024, // 50 KB max buffer
        env: SCRUBBED_ENV,
      }
    );

    const output = (stdout || "").trim();
    const errors = (stderr || "").trim();

    if (errors && !output) {
      return `Execution error:\n${errors}`;
    }

    return output || (errors ? `Output:\n${output}\nWarnings:\n${errors}` : "Execution completed with no output.");
  } catch (err: any) {
    if (err.killed || err.signal === "SIGTERM") {
      throw new Error("Execution terminated: process exceeded 3000ms hard runtime limit.");
    }
    // Fallback: If python3 is not available on host, evaluate simple arithmetic safely
    if (err.code === "ENOENT") {
      return fallbackSafeEval(code);
    }
    throw new Error(`Execution failed: ${err.message || String(err)}`);
  }
}

/**
 * Fallback arithmetic evaluator for simple benchmark calculations if python3 is unavailable.
 */
function fallbackSafeEval(code: string): string {
  // Allow only digits, basic arithmetic operators, Math functions, and whitespace
  const sanitized = code.replace(/print\((.*)\)/g, "$1").trim();
  const allowedPattern = /^[0-9+\-*/()., %^<>=!&|eE\sMath.minmaxabsroundfloorceilsqrt]+$/;
  if (!allowedPattern.test(sanitized)) {
    throw new Error("Execution unavailable: python3 is not installed and code contains non-arithmetic tokens.");
  }
  try {
    const fn = new Function(`"use strict"; return (${sanitized});`);
    const val = fn();
    return String(val);
  } catch (e: any) {
    throw new Error(`Arithmetic evaluation failed: ${e.message}`);
  }
}
