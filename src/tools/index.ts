import type { EventBus } from "../eventBus.js";
import { safeReadFile, safeExecuteCode } from "./security.js";
import { searchWeb } from "./search.js";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

// Complete tool registry matching standard OpenAI/Groq function calling format
export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  search_web: {
    type: "function",
    function: {
      name: "search_web",
      description:
        "Searches the web for up-to-date benchmarks, competitor pricing, feature matrices, and technical documentation.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The targeted search query to execute (e.g. 'Cursor IDE pricing 2026' or 'Windsurf Cascade engine').",
          },
        },
        required: ["query"],
      },
    },
  },
  read_file: {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Safely reads documentation or source files within the workspace root. Rejects path traversal and sensitive files.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Relative file path within the project workspace (e.g. 'README.md' or 'src/skills/registry.json').",
          },
        },
        required: ["filePath"],
      },
    },
  },
  execute_python: {
    type: "function",
    function: {
      name: "execute_python",
      description:
        "Executes Python code or mathematical/data calculations inside a constrained, scrubbed process sandbox.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "Python script or arithmetic statements to execute and evaluate.",
          },
        },
        required: ["code"],
      },
    },
  },
  execute_calc: {
    type: "function",
    function: {
      name: "execute_calc",
      description:
        "Performs high-precision numerical or statistical calculations in an isolated evaluation environment.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "Calculation expression or benchmark formulas.",
          },
        },
        required: ["code"],
      },
    },
  },
};

/**
 * Filters the global tool definitions by the tools enabled for a specific agent.
 */
export function getAgentToolDefinitions(enabledTools: string[]): ToolDefinition[] {
  const defs: ToolDefinition[] = [];
  for (const name of enabledTools) {
    if (TOOL_DEFINITIONS[name]) {
      defs.push(TOOL_DEFINITIONS[name]);
    }
  }
  return defs;
}

export interface DispatchResult {
  toolName: string;
  success: boolean;
  output: string;
}

/**
 * Dispatches and executes a tool call safely, broadcasting typed telemetry events
 * to the EventBus so that the 3D office and frontend display real-time tool state.
 */
export async function dispatchTool(
  toolName: string,
  rawArgs: string | Record<string, any>,
  agentId: string,
  eventBus?: EventBus
): Promise<DispatchResult> {
  // Parse arguments if provided as JSON string
  let parsedArgs: Record<string, any> = {};
  if (typeof rawArgs === "string") {
    try {
      parsedArgs = JSON.parse(rawArgs);
    } catch {
      parsedArgs = { raw: rawArgs };
    }
  } else if (typeof rawArgs === "object" && rawArgs !== null) {
    parsedArgs = rawArgs;
  }

  // Emit tool.invoked event
  if (eventBus) {
    eventBus.emit({
      type: "tool.invoked",
      agentId,
      toolName,
      args: parsedArgs,
      ts: Date.now(),
    });
  }

  try {
    let output = "";

    switch (toolName) {
      case "search_web": {
        const query = parsedArgs.query || parsedArgs.q || String(rawArgs);
        const results = await searchWeb(query);
        output = results
          .map((r, i) => `[Result ${i + 1}] ${r.title} (${r.url}):\n${r.snippet}`)
          .join("\n\n");
        break;
      }

      case "read_file": {
        const filePath = parsedArgs.filePath || parsedArgs.path || parsedArgs.file || String(rawArgs);
        output = safeReadFile(filePath);
        break;
      }

      case "execute_python":
      case "execute_calc": {
        const code = parsedArgs.code || parsedArgs.script || String(rawArgs);
        output = await safeExecuteCode(code);
        break;
      }

      default:
        throw new Error(`Unrecognized tool: "${toolName}". Available tools: ${Object.keys(TOOL_DEFINITIONS).join(", ")}`);
    }

    const summary = output.length > 300 ? `${output.slice(0, 300)}... [${output.length} bytes total]` : output;

    // Emit tool.result event
    if (eventBus) {
      eventBus.emit({
        type: "tool.result",
        agentId,
        toolName,
        summary,
        ts: Date.now(),
      });
    }

    return {
      toolName,
      success: true,
      output,
    };
  } catch (err: any) {
    const errorSummary = `Error: ${err.message || String(err)}`;

    if (eventBus) {
      eventBus.emit({
        type: "tool.result",
        agentId,
        toolName,
        summary: errorSummary,
        ts: Date.now(),
      });
    }

    return {
      toolName,
      success: false,
      output: errorSummary,
    };
  }
}
