# 🏢 Cubicle: The Recursive AI Teammate Org

> **An autonomous, self-structuring AI organization where agents dynamically hire managers, spawn leaf specialists, evaluate deliverables against strict critique rubrics, recycle idle workers, fire failing agents, and stream real-time organizational cognition into an interactive 3D virtual office.**

---

## 🌟 Why It's Different

Most multi-agent frameworks rely on **flat, hardcoded pipelines** (e.g., `Planner → Fixed Worker A → Fixed Worker B → Aggregator`). While suitable for predictable, toy scripts, flat pipelines crumble when faced with open-ended enterprise business objectives requiring varying levels of abstraction, dynamic role allocation, and rigorous quality verification.

**Cubicle introduces a genuine recursive organizational architecture:**

1. **Recursive Organizational Hierarchy (Dynamic Tree, Not Static Chains):**
   - Every agent is an instance of a universal problem-solving node (`AgentNode.handle()`).
   - A CEO agent assesses a strategic brief: if it is atomic, it executes directly; if complex, it decomposes the problem and dynamically **hires** specialist managers (e.g., Research Manager, Synthesis Manager), who in turn decompose and hire leaf specialists (Data Analysts, Web Researchers, Technical Writers).
   - The team structure expands and contracts dynamically based on the brief. A simple landing page summary spawns just 2–3 agents, while a deep competitive intelligence memo autonomously scales up to an 8+ person multi-tier organization.

2. **Agent Pool Recycling & Resource Efficiency:**
   - Instead of unbounded agent creation, Cubicle maintains an active `organizationPool`.
   - When a manager needs a specific capability, `findOrHire()` first inspects the pool for existing `idle` agents matching the required skill.
   - Agents return to `idle` upon task completion, allowing workers to be efficiently recycled across sibling tasks or subsequent project phases without runaway desk clutter.

3. **On-the-Fly Dynamic Skill Synthesis:**
   - The organization is not constrained to hardcoded role templates. If a decomposed task requires an unregistered skill (e.g., `"quantum-cryptography-specialist"`), the system engages an LLM-powered HR Architect (`synthesizeSkillTemplate`) to synthesize the persona, system prompt, toolset, and rubric on the fly.
   - The synthesized template is immediately cached into the organization's registry and staffed with a newly minted specialist.

4. **Autonomous Quality Governance (Fire & Rehire Loop):**
   - Leaf deliverables are rigorously evaluated against strict quality criteria by an adversarial verifier (`critiqueTask`).
   - If an agent produces failing output, they are granted a retry attempt with explicit failure feedback.
   - If an agent fails twice on a task, the manager **fires the failing agent** (`agent.fired`), permanently marks them as terminated, and immediately hires a replacement agent (`agent.hired`) with previous failure modes injected as explicit negative constraints into their system prompt.

5. **Concurrent Sibling Execution:**
   - Sibling subtasks generated during decomposition execute in parallel via `Promise.all()`, allowing multiple workers to research, write, and analyze simultaneously across desks in the 3D office.

6. **Authentic Inter-Agent Messaging & Total Observability:**
   - Agents communicate through genuine typed dialogue events (`message`) emitted over the `EventBus` when delegating subtasks downward and reporting deliverables upward.
   - Every state transition—hiring, firing, task creation, decomposition, assignment, retry, dialogue, and completion—is an append-only event streamed in real time over WebSockets to drive the 3D office, speech bubbles, and reactive task tree.

---

## 🏗️ Layered System Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│ LAYER 4 — Presentation                                                     │
│  React App (Vite + TypeScript)                                             │
│   ├─ 3D Office Scene (react-three-fiber + drei + react-spring)             │
│   ├─ Org Chart / Task Tree Panel (nested recursive hierarchy)              │
│   ├─ Transient 3D Speech Bubbles & Working Glow Indicators                 │
│   ├─ Scripted Cinematic Camera Controller (Orbit / Sweep / CEO Close-up)   │
│   └─ Control Bar (Live/Replay mode toggle, Run selector, Reset trigger)    │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 3 — Transport                                                        │
│  Socket.IO (WebSocket) — one channel, typed events, append-only stream     │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 2 — Orchestration Core                                               │
│  Orchestrator Service (Node.js / TypeScript / Express)                    │
│   ├─ AgentNode (recursive class: hire/decompose/execute/verify/report)     │
│   ├─ Skill Registry (templates + on-the-fly dynamic synthesis)             │
│   ├─ Agent Pool Recycling (organizationPool for idle worker reuse)         │
│   ├─ Performance Tracker & Strike Guard (enforces 2-failure fire/rehire)   │
│   ├─ Authentic Dialogue Dispatcher (parent-child inter-agent messages)     │
│   └─ EventBus (emits every state change as an append-only typed OrgEvent)  │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 1 — Execution & LLM Reasoning                                        │
│  Ultra-Low Latency Inference (Groq SDK / qwen3.8-27b / llama-3.3-70b)      │
│   ├─ decomposeTask (strict JSON schema decomposition with fallback regex)  │
│   ├─ executeTask (domain-specialized leaf reasoning & deliverable creation)│
│   ├─ critiqueTask (adversarial rubric grading: pass/fail + critique reason)│
│   └─ synthesizeSkillTemplate (dynamic on-the-fly HR role creation)         │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 0 — Persistence & Replay Safety Net                                  │
│  runs/*.jsonl (append-only JSON Lines event logs)                          │
│   ├─ hero-run.jsonl (Full enterprise competitive research memo run)        │
│   ├─ simple-task.jsonl (Compact 2-3 agent atomic landing-page summary)     │
│   └─ rehire-test.jsonl (Real critique rejection, firing & rehire sequence) │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 🚦 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js** v18.0.0 or higher (v24 LTS recommended)
- **npm** v9.0.0 or higher
- A **Groq API Key** (free tier available at [console.groq.com](https://console.groq.com))

### 2. Clone & Install Dependencies

Clone the repository and install dependencies for both the backend and the frontend:

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

Add your Groq API credentials and port configuration:

```env
GROQ_API_KEY=gsk_your_groq_api_key_here
PORT=3000
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
     - `hero-run.jsonl`: Comprehensive competitive analysis demonstrating full multi-department team scaling.
     - `simple-task.jsonl`: Minimal single-task execution showing atomic efficiency.
     - `rehire-test.jsonl`: Strict critique rubric failure triggering agent termination and replacement.
   - Click **▶️ Start Replay (2x)** to stream the pre-recorded run into the 3D office at 2x presentation speed.

2. **Live Mode (Autonomous Real-Time LLM Execution):**
   - Toggle to **Live Mode**.
   - Click **⚡ Start Live AI Run** to dispatch the CEO brief to the orchestrator. Watch as real Groq LLM inference calls decompose the problem, hire specialists, spawn 3D avatars, and stream dialogue bubbles live.

3. **3D Office Navigation:**
   - **Left Click + Drag**: Orbit and inspect agent workstations.
   - **Right Click + Drag**: Pan across the office floor.
   - **Scroll Wheel**: Zoom into individual desks or step back for the macro view.
   - **Cinematic Transitions**: Automatic camera sweeps on job start, and close zoom on the CEO desk upon delivery.

4. **Multi-Scenario Generator Script:**
   - Run `npm run generate-runs` from the root directory to execute all 3 scenarios sequentially against live Groq inference and record fresh `.jsonl` traces into `runs/`.

5. **Acceptance Test Suite:**
   - Run `npx tsx tests/acceptance.ts` to execute the full 7-point automated audit verifying full run completion, fire/retry loops, on-the-fly skill synthesis, live WebSocket ordering, max-depth recursion guards, robust JSON parsing, and subtask concurrency.
