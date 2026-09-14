# 🏆 Track Submission: Autonomous AI Teammates
## Project: Cubicle — The Recursive Autonomous AI Organization

---

### Executive Summary

Modern multi-agent frameworks are almost universally constructed as **flat, static DAG pipelines** (e.g., Planner $\rightarrow$ fixed 3 workers $\rightarrow$ Aggregator). While functional for predictable, linear scripts, flat pipelines cannot adapt to varying task complexities, lack mechanisms for internal resource recycling, and operate as opaque black boxes when deliverables fail.

**Cubicle** reimagines autonomous multi-agent systems from first principles as a **recursive, self-structuring organization**. Starting with only a CEO agent and a high-level strategic brief, the organization autonomously determines how many management tiers and leaf specialists to hire, verifies deliverables against adversarial critique rubrics, recycles idle workers, terminates underperforming agents, and streams its entire cognitive lifecycle in real time into an interactive 3D virtual office.

---

### Architecture & Judging Criteria Alignment

```
                        ┌───────────────────────────────┐
                        │           CEO Agent           │
                        └──────────────┬────────────────┘
                                       │ (decomposes & hires)
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
                                                      │ (fails rubric 2x)
                                                      ▼
                                               [AGENT TERMINATED]
                                                      │ (rehire with feedback)
                                                      ▼
                                               ┌─────────────┐
                                               │ Replacement │
                                               └─────────────┘
```

#### 1. Scalability — Dynamic Recursive Teaming via `AgentNode.handle()`
- **Universal Problem-Solving Loop:** Every agent in Cubicle is an instance of a universal recursive class (`AgentNode`). At every organizational level (CEO, Department Lead, Specialist), the agent evaluates:
  $$\text{Task} \longrightarrow \begin{cases} \text{Execute directly via tools} & \text{if atomic} \\ \text{Decompose} \rightarrow \text{Hire specialists} \rightarrow \text{Execute concurrently} \rightarrow \text{Synthesize} & \text{if complex} \end{cases}$$
- **Problem-Proportional Team Sizing:** 
  - A lightweight landing page query spawns a compact 2–3 agent pod ([simple-task.jsonl](file:///Users/shankar/PROJECTS/Cubicle/runs/simple-task.jsonl)).
  - An enterprise competitive intelligence memo autonomously expands into an 8-agent, 2-tier corporate structure with dedicated research and synthesis divisions ([hero-run.jsonl](file:///Users/shankar/PROJECTS/Cubicle/runs/hero-run.jsonl)).
- **Concurrent Sibling Execution:** Sibling subtasks generated during decomposition execute in parallel via `Promise.all()`, allowing multiple agents across workstations to analyze, write, and verify simultaneously.
- **Worker Pool Recycling:** Instead of unbounded agent creation, Cubicle maintains an `organizationPool`. When a skill is needed, the system first scans for existing `idle` agents, reactivating them and eliminating runaway resource bloat.
- **On-the-Fly Dynamic Skill Synthesis:** If a task demands a capability absent from `registry.json` (e.g., `"quantum-cryptography-specialist"`), an LLM HR Architect (`synthesizeSkillTemplate`) dynamically crafts the persona, system prompt, toolset, and rubric at runtime, expanding organizational competence without code edits.

#### 2. Reliability — Autonomous Quality Governance (Fire & Rehire)
- **Adversarial Critique Step:** Deliverables are never assumed correct. Every leaf artifact is audited by an automated verifier against strict criteria (empirical grounding, structural adherence, absence of fluff).
- **Two-Failure Termination Threshold:** Each agent tracks historical performance metrics (`attempted`, `failed`, `avgConfidence`). If a worker produces two failing deliverables on a subtask, the manager executes a hard termination:
  - Emits `agent.fired`, triggering a departure sequence in the 3D office.
  - Hires a replacement specialist (`agent.hired`).
  - Dynamically injects the failure reason as an explicit negative constraint in the replacement's system prompt (`"IMPORTANT CORRECTIVE DIRECTIVE: Avoid previous failure mode: [...]"`).
  - Verified and recorded end-to-end in [rehire-test.jsonl](file:///Users/shankar/PROJECTS/Cubicle/runs/rehire-test.jsonl).
- **Defensive Regex-Based JSON Parsing:** `safeParseJson()` proactively strips model reasoning tokens (`<think>...</think>`), extracts JSON payloads from markdown blocks, and handles edge-case truncations gracefully.
- **Deterministic Recursion Guard:** Hard recursion bounds (`depthLimit`) guarantee that execution terminates deterministically without runaway delegation loops.

#### 3. UX & Observability — Total Spatial & Cognitive Transparency
- **Decoupled Event-Driven Core:** All orchestrator state transitions are broadcast as append-only, strongly-typed WebSocket events (`OrgEvent`). The frontend is a pure reactive renderer driven by Zustand.
- **Authentic Inter-Agent Messaging:** Dialogue is not fabricated on the client; the orchestrator emits genuine `message` events for task delegation and result delivery, rendering transient 3D speech bubbles above agents' workstations.
- **3D Virtual Office (React Three Fiber + Drei + React Spring):**
  - **Spatial Desk Assignment:** Spawning agents smoothly scale from 0 to 1 as they occupy designated cubicles; fired agents scale down and vacate.
  - **Working Glow & Visual Telemetry:** Active agents display rotating emissive halos at their desks while processing tasks.
  - **Cinematic Camera Automation:** Smooth camera sweeps establish the office on job start and zoom into the CEO desk upon deliverable presentation.
- **Hierarchical Task Tree Side Panel:** Displays the live recursive task breakdown, owner agent assignments, retry counters, and deliverable status indicators.
- **Fail-Safe Replay Engine:** Built-in 2x speed replay toggle allows instant, deterministic playback of pre-recorded production runs, eliminating live demo network and rate-limit risks.

---

### Technical Specifications

| Layer | Technologies & Implementations |
| :--- | :--- |
| **Execution Core** | Node.js, TypeScript, Groq SDK (`qwen/qwen3.8-27b`), Dynamic Token Backoff Retries |
| **Transport** | Express 5, Socket.IO 4.8, Append-Only JSONL Event Stream |
| **3D Presentation** | React 19, Vite, Three.js, React Three Fiber, Drei, React Spring, Zustand |
| **Governance** | Automated LLM critique rubric, 2-strike firing logic, Prompt memory injection |
| **Audit Verification** | 7/7 automated acceptance tests passing (`npx tsx tests/acceptance.ts`) |

---

### Conclusion

Cubicle bridges the gap between static pipelines and true autonomous teammates. By pairing **recursive hierarchical decomposition** with **autonomous organizational governance** and an **observability-first 3D interface**, it demonstrates what enterprise-grade autonomous AI teams look, feel, and act like.
