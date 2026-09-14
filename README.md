# 🏢 Cubicle — Autonomous AI Organization

> **An autonomous, recursively self-structuring AI organization where agents dynamically hire managers, spawn leaf specialists, evaluate deliverables against strict rubrics, fire failing workers, and stream real-time organizational cognition into a 3D virtual office.**

---

## 🌟 Why It's Different

Most multi-agent frameworks rely on **flat, hardcoded pipelines** (e.g., `Planner → Fixed Worker A → Fixed Worker B → Aggregator`). While suitable for predictable scripts, flat pipelines crumble when faced with open-ended business objectives requiring varying levels of abstraction and quality verification.

**Cubicle introduces a recursive organizational architecture:**
- **Dynamic Hierarchy, Not Static Chains:** Agents are instances of a universal problem-solving node (`AgentNode.handle()`). A CEO agent assesses a brief: if it is atomic, it executes directly; if complex, it decomposes the problem and dynamically **hires** specialist managers (e.g., Research Manager, Synthesis Manager), who in turn hire leaf specialists (Data Analysts, Web Researchers, Technical Writers).
- **Scale Matches Problem Complexity:** A simple landing page summary spawns just 2–3 agents, while a deep competitive intelligence memo autonomously scales up to an 8-person multi-department hierarchy.
- **Autonomous Quality Governance (Fire & Rehire):** Leaf deliverables are rigorously evaluated by automated critique rubrics. If an agent fails quality verification twice on a task, the manager **fires the underperforming agent**, updates their status to `fired`, and immediately hires a replacement with previous failure modes injected as explicit negative constraints in their system prompt.
- **Pure Event-Driven Observability:** Every decision—hiring, firing, task creation, decomposition, assignment, retry, dialogue message, and completion—is emitted as an append-only event stream over WebSocket, driving an interactive 3D virtual office scene and live task tree side panel in real time.

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
│  Socket.IO (WebSocket) — single-channel, typed events, append-only stream │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 2 — Orchestration Core                                               │
│  Orchestrator Service (Node.js / TypeScript / Express)                    │
│   ├─ AgentNode (universal recursive class: hire/decompose/execute/verify) │
│   ├─ Skill Registry (manager-research, manager-synthesis, data-analysis,..)│
│   ├─ Performance Tracker (enforces 2-failure fire/rehire threshold)        │
│   ├─ Task Tree & State Selectors (Zustand reactive store)                  │
│   └─ EventBus (emits every lifecycle transition as a typed OrgEvent)       │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 1 — Execution & LLM Reasoning                                        │
│  Ultra-Low Latency Inference (Groq SDK / llama-3.3-70b / qwen3.8-27b)      │
│   ├─ decomposeTask (strict JSON schema decomposition)                      │
│   ├─ executeTask (domain-specialized leaf reasoning & tool execution)      │
│   └─ critiqueTask (adversarial rubric grading: pass/fail + critique reason)│
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 0 — Persistence & Replay Safety Net                                  │
│  runs/*.jsonl (append-only JSON Lines event logs)                          │
│   ├─ hero-run.jsonl (Full 8-agent multi-tier enterprise research run)      │
│   ├─ simple-task.jsonl (Compact 2-3 agent atomic landing-page summary)     │
│   └─ rehire-test.jsonl (Real critique rejection, firing & rehire sequence) │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 🚦 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- A **Groq API Key** (available free at [console.groq.com](https://console.groq.com))

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

Add your Groq API credentials:

```env
GROQ_API_KEY=gsk_your_groq_api_key_here
PORT=3000
```

### 4. Running the Application

You can launch the backend event streaming server and the frontend 3D client concurrently:

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
*Opens the Vite application at `http://localhost:5173`.*

---

## 🎮 Interactive Controls & Demo Modes

Once the frontend is running at `http://localhost:5173`:

1. **Replay Mode (Instant & Deterministic Demo):**
   - Select **Replay Mode** on the bottom control bar.
   - Choose a pre-recorded real run from the dropdown:
     - `hero-run.jsonl`: Comprehensive competitive analysis demonstrating full multi-department team scaling.
     - `simple-task.jsonl`: Minimal single-task execution showing atomic efficiency.
     - `rehire-test.jsonl`: Strict critique rubric failure triggering agent termination and replacement.
   - Click **▶️ Start Replay (2x)** to stream the run into the 3D office at 2x presentation speed.
2. **Live Mode (Autonomous Real-Time LLM Execution):**
   - Toggle to **Live Mode**.
   - Click **⚡ Start Live AI Run** to dispatch the CEO brief to the orchestrator, invoking real Groq inference models that autonomously hire and coordinate agents in real time.
3. **3D Office Navigation:**
   - **Left Click + Drag**: Orbit and inspect agent workstations.
   - **Right Click + Drag**: Pan across the floor.
   - **Scroll Wheel**: Zoom into individual desks or step back for the macro view.
   - **Cinematic Transitions**: Automatic camera sweeps on job start, and close zoom on CEO desk on completion.
4. **Generating New Runs:**
   - Execute `npm run generate-runs` from the root directory to run all 3 scenarios sequentially through the live Groq engine and record fresh `.jsonl` runs into `runs/`.
