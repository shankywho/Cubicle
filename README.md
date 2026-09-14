# 🏢 Cubicle: The Recursive AI Teammate Org

> **An autonomous, self-structuring AI organization where agents dynamically hire managers, spawn leaf specialists, evaluate deliverables against strict critique rubrics, self-correct via Reflexion, recycle idle workers, fire failing agents, and stream real-time organizational cognition into an interactive 3D virtual office.**

---

## 🌟 Why It's Different

Most multi-agent frameworks rely on **flat, hardcoded pipelines** (e.g., `Planner → Fixed Worker A → Fixed Worker B → Aggregator`). While suitable for predictable, toy scripts, flat pipelines crumble when faced with open-ended enterprise business objectives requiring varying levels of abstraction, dynamic role allocation, and rigorous quality verification.

**Cubicle introduces a genuine recursive organizational architecture:**

1. **Recursive Organizational Hierarchy (Dynamic Tree, Not Static Chains):**
   - Every agent is an instance of a universal problem-solving node (`AgentNode.handle()`).
   - A CEO agent assesses a strategic brief: if atomic, it executes directly; if complex, it decomposes the problem and dynamically **hires** specialist managers (e.g., Research Manager, Synthesis Manager), who in turn decompose and hire leaf specialists (Data Analysts, Web Researchers, Technical Writers).
   - The team structure expands and contracts dynamically based on the brief. A simple landing page summary spawns just 2–3 agents, while a deep competitive intelligence memo autonomously scales up to an 8+ person multi-tier organization with enforced depth limits (`depthLimit: 2`).

2. **Agent Pool Recycling & Resource Efficiency:**
   - Instead of unbounded agent creation, Cubicle maintains an active `organizationPool`.
   - When a manager needs a specific capability, `findOrHire()` first inspects the pool for existing `idle` agents matching the required skill.
   - Agents return to `idle` upon task completion, allowing workers to be efficiently recycled across sibling tasks or subsequent project phases without runaway desk clutter or allocation overhead.

3. **On-the-Fly Dynamic Skill Synthesis:**
   - The organization is not constrained to hardcoded role templates. If a decomposed task requires an unregistered skill (e.g., `"quantum-cryptography-specialist"`), the system engages an LLM-powered HR Architect (`synthesizeSkillTemplate`) to synthesize the persona, system prompt, toolset, and rubric on the fly.
   - The synthesized template is immediately cached into the organization's registry and staffed with a newly minted specialist.

4. **Autonomous Quality Governance (Reflexion → Fire & Rehire):**
   - Leaf deliverables are rigorously evaluated against strict quality criteria and tool observation ground truth by an adversarial verifier (`critiqueTask`).
   - **Attempt 1 (Reflexion Self-Correction):** If an agent produces failing output, they are **not** immediately fired. Instead, the orchestrator invokes `reflectOnFailure()` to generate an autonomous 1-sentence root-cause self-reflection. The agent emits a live `Self-Correction: [reflection]` message over the event stream, appends this reflection to task retry feedback, and retries the same agent.
   - **Attempt 2 (Two-Strike Termination):** Only if the agent fails a second time is it fired (`agent.fired`), permanently marked as terminated, and replaced with a fresh hire (`agent.hired`) with previous failure modes injected as explicit negative constraints into their system prompt.

5. **Hardened Tool Dispatcher & Sandboxed Execution:**
   - **Path Traversal Defense:** `safeReadFile` anchors all operations to the workspace root, rigorously rejecting escape sequences (`../../.env`) and blocking sensitive configuration/credential patterns (`.env*`, `.git`, `.key`, `.pem`, `id_rsa`).
   - **Process Isolation:** `safeExecuteCode` executes arbitrary code in an isolated `python3` subprocess with scrubbed environment variables (`SCRUBBED_ENV` excluding `GROQ_API_KEY` and host secrets), a 3-second timeout ceiling, and 50 KB buffer caps.
   - **Web Search & Deterministic Fallback:** `searchWeb` leverages Tavily API when configured, with offline deterministic fixture benchmarks ensuring zero runtime demo breakage.
   - **Multi-Turn Tool Execution Loop:** Up to 3 turns per task, parsing OpenAI tool calls and XML fallback tags, concluded by a forced-exit synthesis pass that omits tools to guarantee markdown deliverable generation.

6. **Live Token Telemetry & Guardrails HUD:**
   - Every LLM completion tracks prompt, completion, and total tokens across all execution turns and critique passes.
   - The React frontend features a glassmorphic **Telemetry & Guardrails HUD** positioned over the 3D scene displaying live accumulated token counts, dynamic API cost attribution ($0.0008 / 1K tokens), active recursion depth ceilings (`Max Depth: 2`), and governance states (`Reflexion → Fire`).
   - Task decomposition events emit explicit `rationale` strings displayed in the task tree for instant explainability.

7. **Concurrent Sibling Execution:**
   - Sibling subtasks generated during decomposition execute in parallel via `Promise.all()`, allowing multiple workers to research, write, and analyze simultaneously across desks in the 3D office.

8. **Authentic Inter-Agent Messaging & Total Observability:**
   - Agents communicate through genuine typed dialogue events (`message`) emitted over the `EventBus` when delegating subtasks downward and reporting deliverables upward.
   - Every state transition—hiring, firing, task creation, decomposition, assignment, retry, dialogue, tool invocation, and completion—is an append-only event streamed in real time over WebSockets to drive the 3D office, speech bubbles, and reactive task tree.

---

## 🏗️ Layered System Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│ LAYER 4 — Presentation & Observability                                    │
│  React App (Vite + TypeScript)                                             │
│   ├─ 3D Office Scene (react-three-fiber + drei + react-spring)             │
│   ├─ Telemetry & Guardrails HUD (Live tokens, est. API cost, depth limits) │
│   ├─ Org Chart / Task Tree Panel (nested hierarchy + explainability rationale)
│   ├─ Transient 3D Speech Bubbles & Working Glow Indicators                 │
│   ├─ Scripted Cinematic Camera Controller (Orbit / Sweep / CEO Close-up)   │
│   └─ Control Bar (Live/Replay mode toggle, Run selector, Reset trigger)    │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 3 — Transport & Event Streaming                                      │
│  Socket.IO (WebSocket) — single channel, typed events, append-only stream  │
│   ├─ Real-time broadcast of all OrgEvent lifecycle transitions             │
│   └─ Strict ordering parity between live WebSocket stream & JSONL disk logs│
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 2 — Orchestration & Governance Core                                 │
│  Orchestrator Service (Node.js / TypeScript / Express)                    │
│   ├─ AgentNode (recursive class: hire/decompose/execute/verify/report)     │
│   ├─ Skill Registry (built-in templates + on-the-fly dynamic synthesis)   │
│   ├─ Agent Pool Recycling (organizationPool for zero-overhead worker reuse)│
│   ├─ Reflexion & Governance (1st fail: self-reflection -> 2nd fail: fire)  │
│   ├─ Token Attribution Aggregator (aggregates exec + critique usage)      │
│   ├─ Authentic Dialogue Dispatcher (parent-child inter-agent messages)     │
│   └─ EventBus (emits every state change as an append-only typed OrgEvent)  │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 1 — Tool Dispatcher & Sandboxed Execution                           │
│  Hardened Tooling Runtime                                                 │
│   ├─ safeReadFile (path traversal defense, .env/.git blocklist, 64KB cap)   │
│   ├─ safeExecuteCode (isolated subprocess, scrubbed env, 3s timeout)       │
│   ├─ searchWeb (Tavily integration with deterministic offline fixtures)    │
│   └─ dispatchTool (emits tool.invoked and tool.result telemetry events)    │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 0 — Inference & Persistence                                          │
│  Groq SDK (qwen/qwen3.8-27b / llama-3.3-70b) + runs/*.jsonl logs          │
│   ├─ decomposeTask (schema-enforced decomposition with explainability)    │
│   ├─ executeTask (multi-turn tool-calling loop with forced-synthesis pass) │
│   ├─ critiqueTask (adversarial rubric evaluation grounded in observations) │
│   ├─ reflectOnFailure (autonomous root-cause self-reflection generator)    │
│   └─ hero-run.jsonl / simple-task.jsonl / rehire-test.jsonl (replay traces)│
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 🚦 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js** v18.0.0 or higher (v24 LTS recommended)
- **npm** v9.0.0 or higher
- A **Groq API Key** (free tier available at [console.groq.com](https://console.groq.com))
- *(Optional)* A **Tavily API Key** for live web searches

### 2. Clone & Install Dependencies

Clone the repository and install dependencies for both the backend and frontend:

```bash
git clone https://github.com/shankywho/Cubicle.git
cd Cubicle

# Install root orchestrator and backend dependencies
npm install

# Install frontend 3D visualization dependencies
cd frontend
npm install --legacy-peer-deps
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env 2>/dev/null || touch .env
```

Add your API credentials and port configuration:

```env
GROQ_API_KEY=gsk_your_groq_api_key_here
PORT=3000

# Optional: Live web search API key (falls back to deterministic fixtures if omitted)
TAVILY_API_KEY=tvly-your_key_here
```

### 4. Running the Application

Launch the backend event streaming server and the frontend 3D client in separate terminals:

#### Terminal 1: Backend Event Server
```bash
npm run serve
```
*Starts the Express and Socket.IO server on `http://localhost:3000`.*

#### Terminal 2: Frontend 3D Office Client
```bash
cd frontend
npm run dev
```
*Launches the Vite React application at `http://localhost:5173`.*

---

## 🎮 Interactive Controls & Demo Modes

Open your browser to `http://localhost:5173`:

1. **Replay Mode (Instant, Deterministic Demo):**
   - Select **Replay Mode** in the bottom control bar.
   - Choose a scenario from the dropdown:
     - `hero-run.jsonl`: Comprehensive competitive analysis demonstrating full multi-tier team scaling, tool observations, and token attribution.
     - `simple-task.jsonl`: Minimal single-task execution showing atomic efficiency.
     - `rehire-test.jsonl`: Critique failure triggering Reflexion self-correction on attempt 1, followed by termination and replacement on attempt 2.
   - Click **▶️ Start Replay (2x)** to stream the pre-recorded run into the 3D office at 2x presentation speed.

2. **Live Mode (Autonomous Real-Time LLM Execution):**
   - Toggle to **Live Mode**.
   - Click **⚡ Start Live AI Run** to dispatch the CEO brief to the orchestrator. Watch as real Groq LLM inference calls decompose the problem, hire specialists, spawn 3D avatars, invoke tools, and stream dialogue bubbles live.

3. **Telemetry & Guardrails HUD:**
   - Monitor live token consumption and calculated API cost in the glassmorphism HUD in the bottom-left corner.
   - View explainability rationales directly beneath decomposed subtasks in the task tree panel.

4. **Multi-Scenario Generator Script:**
   - Run `npm run generate-runs` from the root directory to execute all 3 scenarios sequentially against live Groq inference and record fresh `.jsonl` traces into `runs/`.

5. **Acceptance Test Suite:**
   - Run `npx tsx tests/acceptance.ts` to execute the full 8-point automated audit verifying full run completion, fire/retry loops, on-the-fly skill synthesis, live WebSocket ordering, max-depth recursion guards, robust JSON parsing, subtask concurrency, and hardened tool dispatch security.

---

## 🔮 Future Work

1. **Model Context Protocol (MCP) Integration:**
   - Expose the Cubicle orchestrator as an MCP server, enabling external IDEs, tools, and agents to interact with the recursive organization as a single unified teammate.
   - Add MCP client adapters allowing agents to dynamically mount external tool servers (e.g., GitHub, PostgreSQL, Linear).

2. **Cross-Run Episodic & Semantic Memory:**
   - Introduce a persistent vector store memory layer allowing agents to retain lessons, tool observations, and critique directives across separate jobs, preventing recurring mistakes and accelerating recurring organizational workflows.
