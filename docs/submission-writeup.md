# 🏆 Track Submission: Autonomous AI Teammates
## Project: Cubicle — The Recursive Autonomous AI Organization

---

### Executive Summary

Modern multi-agent frameworks are almost universally constructed as **flat, static pipelines** (e.g., `Planner → fixed 3 workers → Aggregator`). While functional for predictable, linear scripts, flat pipelines cannot adapt to varying task complexities, lack mechanisms for internal resource recycling, and operate as opaque black boxes when deliverables fail.

**Cubicle** reimagines autonomous multi-agent systems from first principles as a **recursive, self-structuring organization**. Starting with only a CEO agent and a high-level strategic brief, the organization autonomously determines how many management tiers and leaf specialists to hire, equips them with sandboxed tools, verifies deliverables against adversarial critique rubrics, self-corrects via Reflexion, terminates underperforming agents, and streams its entire cognitive lifecycle in real time into an interactive 3D virtual office with live token telemetry.

---

### Architecture & Judging Criteria Alignment

```
                        ┌───────────────────────────────┐
                        │           CEO Agent           │
                        └──────────────┬────────────────┘
                                       │ (decomposes with rationale & hires)
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     ┌─────────────────────┐                       ┌─────────────────────┐
     │  Research Manager   │                       │  Synthesis Manager  │
     └──────────┬──────────┘                       └──────────┬──────────┘
                │                                             │
        ┌───────┴───────┐                             ┌───────┴───────┐
        ▼               ▼                             ▼               ▼
 ┌─────────────┐ ┌─────────────┐               ┌─────────────┐ ┌─────────────┐
 │ Web Analyst │ │ Data Analyst│               │ Writer Node │ │ Critic Node │
 └─────────────┘ └─────────────┘               └─────────────┘ └─────────────┘
        │               │
        │ (Tool Call)   │ (Attempt 1: Fails Critique)
        ▼               ▼
 ┌─────────────┐ ┌───────────────────────────────────────────┐
 │ Sandboxed   │ │ Reflexion: Autonomous Self-Correction     │
 │ Dispatcher  │ │ (Emits "Self-Correction", retries agent)  │
 └─────────────┘ └─────────────────────┬─────────────────────┘
                                       │ (Attempt 2: Repeated Failure)
                                       ▼
                                [AGENT TERMINATED]
                                       │ (Rehire with corrective directive)
                                       ▼
                                ┌─────────────┐
                                │ Replacement │
                                └─────────────┘
```

---

#### 1. Scalability — Dynamic Recursive Teaming & Dynamic Skill Synthesis
- **Universal Problem-Solving Loop:** Every agent in Cubicle is an instance of a universal recursive class (`AgentNode`). At every organizational level (CEO, Department Lead, Specialist), the agent evaluates:
  $$\text{Task} \longrightarrow \begin{cases} \text{Execute directly via sandboxed tools} & \text{if atomic} \\ \text{Decompose} \rightarrow \text{Hire specialists} \rightarrow \text{Execute concurrently} \rightarrow \text{Synthesize} & \text{if complex} \end{cases}$$
- **Problem-Proportional Team Sizing:** 
  - A lightweight landing page query spawns a compact 2–3 agent pod ([simple-task.jsonl](file:///Users/shankar/PROJECTS/Cubicle/runs/simple-task.jsonl)).
  - An enterprise competitive intelligence memo autonomously expands into an 8-agent, 2-tier corporate structure with dedicated research and synthesis divisions ([hero-run.jsonl](file:///Users/shankar/PROJECTS/Cubicle/runs/hero-run.jsonl)).
- **On-the-Fly Dynamic Skill Synthesis:** If a task demands a capability absent from the skill registry (e.g., `"quantum-cryptography-specialist"`), an LLM HR Architect (`synthesizeSkillTemplate`) dynamically crafts the persona, system prompt, toolset, and rubric at runtime, expanding organizational competence without code modifications.
- **Concurrent Sibling Execution:** Sibling subtasks generated during decomposition execute in parallel via `Promise.all()`, allowing multiple agents across workstations to analyze, write, and verify simultaneously.
- **Worker Pool Recycling:** Instead of unbounded agent creation, Cubicle maintains an `organizationPool`. When a skill is needed, the system first scans for existing `idle` agents, reactivating them and eliminating runaway resource bloat.

---

#### 2. Reliability — Two-Strike Governance Gate & Sandboxed Tool Dispatch
- **Two-Strike Quality Governance Gate:** Deliverables are never assumed correct; every leaf artifact is evaluated against strict rubrics and tool ground truth by an adversarial auditor (`critiqueTask`):
  - **Attempt 1 (Reflexion Self-Correction):** The agent is not fired. The orchestrator calls `reflectOnFailure()`, generating a concise 1-sentence self-reflection. The agent emits a live `Self-Correction: [reflection]` message event, appends this reflection to task retry feedback, and retries the same agent.
  - **Attempt 2 (Termination & Replacement):** If the agent fails a second time, the manager executes a hard termination: emits `agent.fired`, vacates the desk, hires a fresh replacement (`agent.hired`), and injects the failure reason as an explicit corrective constraint in the replacement's system prompt ([rehire-test.jsonl](file:///Users/shankar/PROJECTS/Cubicle/runs/rehire-test.jsonl)).
- **Hardened Tool Dispatcher & Process Sandboxing:**
  - `safeReadFile`: Strict path traversal defense (`path.resolve(WORKSPACE_ROOT, p).startsWith(WORKSPACE_ROOT)`), blocking access to `.env*`, `.git`, private keys, and files over 64 KB.
  - `safeExecuteCode`: Runs isolated Python subprocesses with a scrubbed environment (`SCRUBBED_ENV` stripped of `GROQ_API_KEY` and host secrets), 3000 ms execution timeout, and 50 KB buffer caps.
  - Multi-turn tool execution loop with forced-exit synthesis pass omitting tools to prevent infinite LLM tool recursion.
- **Defensive Parsing & Guardrails:** `safeParseJson()` proactively strips model reasoning tokens (`<think>...</think>`), extracts JSON payloads from markdown blocks, and handles edge-case truncations. A static `depthLimit` guard guarantees finite recursion depth.

---

#### 3. UX & Observability — Total Spatial, Cognitive & Cost Transparency
- **Decoupled Event-Driven Core:** All orchestrator state transitions are broadcast as append-only, strongly-typed WebSocket events (`OrgEvent`). The frontend is a pure reactive renderer driven by Zustand.
- **Authentic Inter-Agent Messaging:** Dialogue is not fabricated on the client; the orchestrator emits genuine `message` events for task delegation, self-correction, and result delivery, rendering transient 3D speech bubbles above agents' workstations.
- **Decision Explainability:** Task decomposition events emit explicit `rationale` strings displayed in subtle, italicized typography directly beneath task descriptions in the hierarchy tree.
- **Live Telemetry & Guardrails HUD:** A glassmorphism HUD anchored in the bottom-left corner surfaces live accumulated token consumption, dynamic API cost attribution ($0.0008 / 1K tokens), active recursion ceilings (`Max Depth: 2`), and governance states (`Reflexion → Fire`).
- **3D Virtual Office (React Three Fiber + Drei + React Spring):**
  - **Spatial Desk Assignment:** Spawning agents smoothly scale from 0 to 1 as they occupy designated cubicles; fired agents scale down and vacate.
  - **Working Halos & Cinematic Camera:** Active agents display rotating emissive halos at their desks while processing tasks. Camera sweeps establish the office on job start and zoom into the CEO desk upon delivery.
- **Fail-Safe Replay Engine:** Built-in 2x speed replay toggle allows instant, deterministic playback of pre-recorded production runs, eliminating live demo rate-limit and network risks.

---

### Technical Specifications

| Layer | Technologies & Implementations |
| :--- | :--- |
| **Inference Core** | Groq SDK (`qwen/qwen3.8-27b`), Dynamic Token Rate-Limit Backoff Retries |
| **Tool Dispatcher** | Sandboxed `python3` child process, Scrubbed Env, Workspace Root Path-Traversal Defense |
| **Orchestration** | Node.js, TypeScript, Recursive `AgentNode`, Idle Pool Reuse, Reflexion Self-Correction |
| **Transport** | Express 5, Socket.IO 4.8, Append-Only JSONL Event Stream with 1:1 WS Parity |
| **3D Presentation** | React 19, Vite, Three.js, React Three Fiber, Drei, React Spring, Zustand |
| **Acceptance Suite**| **8/8 automated acceptance checks passing** (`npx tsx tests/acceptance.ts`) |

---

### Conclusion

Cubicle bridges the gap between brittle static pipelines and true autonomous teammates. By pairing **recursive hierarchical decomposition** with **autonomous two-strike governance (Reflexion → Fire)**, **sandboxed tool security**, and an **observability-first 3D interface with live token attribution**, it demonstrates what enterprise-grade autonomous AI organizations look, feel, and act like.
