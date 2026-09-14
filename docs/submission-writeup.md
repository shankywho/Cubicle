# 🏆 Track Submission: Autonomous AI Teammates
## Project: Cubicle — The Recursive Autonomous AI Organization

---

### Executive Summary

Modern multi-agent systems are almost exclusively built as **flat, hardcoded DAG pipelines** (e.g., Planner $\rightarrow$ fixed 3 workers). While effective for static workflows, flat pipelines cannot adapt to varying task complexities, lack mechanisms for internal quality control, and operate as opaque black boxes.

**Cubicle** reimagines autonomous multi-agent systems from first principles as a **recursive, self-structuring organization**. Starting with only a CEO agent and an executive brief, the organization autonomously determines how many management tiers and leaf specialists to hire, verifies deliverables against adversarial critique rubrics, terminates underperforming agents, and visualizes its entire cognitive lifecycle in an interactive 3D virtual office.

---

### Core Innovation Mapped to Judging Criteria

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
 │ Web Search  │ │ Data Analyst│               │ Writer Node │ │ Critic Node │
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
- **Universal Problem-Solving Loop:** Rather than maintaining distinct agent classes, every agent in Cubicle is an instance of a universal `AgentNode`. At every tier (CEO, Department Lead, Specialist), the agent evaluates:
  $$\text{Task} \longrightarrow \begin{cases} \text{Execute directly via tools} & \text{if atomic} \\ \text{Decompose} \rightarrow \text{Hire specialists} \rightarrow \text{Aggregate} & \text{if complex} \end{cases}$$
- **Problem-Proportional Team Sizing:** 
  - A lightweight landing page query spawns a compact 2–3 agent pod ([simple-task.jsonl](file:///Users/shankar/PROJECTS/Cubicle/runs/simple-task.jsonl)).
  - A comprehensive enterprise competitor analysis autonomously expands into an 8-agent, 2-tier corporate structure with dedicated research and synthesis divisions ([hero-run.jsonl](file:///Users/shankar/PROJECTS/Cubicle/runs/hero-run.jsonl)).
- **Zero Hardcoding:** Hierarchy depth, role specialization, and task delegation are emergent properties negotiated at runtime via structured JSON schema decomposition.

#### 2. Reliability — Autonomous Quality Governance (Fire & Rehire)
- **Adversarial Critique Step:** Leaf deliverables are not assumed correct. Every execution is audited by an automated verifier agent against strict domain rubrics (format adherence, empirical grounding, absence of placeholder content).
- **Two-Failure Termination Threshold:** Each agent tracks its historical performance metrics (`attempted`, `failed`, `avgConfidence`). If a worker produces two consecutive failing deliverables on a subtask, the supervising manager immediately terminates the agent:
  - Emits an `agent.fired` event, triggering an exit animation in the 3D office.
  - Recruits a replacement specialist (`agent.hired`).
  - Automatically injects the previous failure reason into the replacement's system prompt as an explicit corrective constraint (`"Avoid previous failure mode: [...]"`).
- **Demonstrated in Production:** Captured and verified end-to-end in [rehire-test.jsonl](file:///Users/shankar/PROJECTS/Cubicle/runs/rehire-test.jsonl).

#### 3. UX & Observability — Real-Time Spatial & Cognitive Transparency
- **Decoupled Event-Driven Core:** All orchestrator state transitions are broadcast as append-only, strongly-typed WebSocket events (`OrgEvent`). The frontend is a pure reactive renderer, guaranteeing that the 3D office and task tree never desynchronize.
- **3D Virtual Office (React Three Fiber + Drei + React Spring):**
  - **Spatial Desk Assignment:** Spawning agents smoothly scale from 0 to 1 as they occupy designated workstations; fired agents scale down and vacate.
  - **Working Glow & Animations:** Active agents exhibit rotating emissive halos at their desks while processing tasks.
  - **Transient 3D Chat Bubbles:** HTML dialogue bubbles dynamically appear above agents' heads during task handoffs, tool execution, and critique verdicts, self-expiring after 4 seconds.
  - **Cinematic Camera Automation:** Smooth lerp camera sweeps on workflow milestones (macro floor establishing shot on job start, close zoom on CEO desk on final deliverable).
- **Hierarchical Task Tree Side Panel:** Displays the live recursive task breakdown, displaying parent-child relationships, owner agent tags, retry counters, and color-coded status badges.
- **Fail-Safe Replay Engine:** Built-in 2x speed replay toggle allows instant, deterministic playback of pre-recorded production runs, eliminating live demo network/token risks.

---

### Technical Specifications

| Layer | Technologies & Implementations |
| :--- | :--- |
| **Execution Core** | Node.js, TypeScript, Groq SDK (`qwen/qwen3.8-27b`, `llama-3.3-70b-versatile`), Exponential Backoff Rate-Limit Retries |
| **Transport** | Express 5, Socket.IO 4.8, Append-Only JSONL Event Stream |
| **3D Presentation** | React 19, Vite, Three.js, React Three Fiber, Drei, React Spring, Zustand |
| **Quality Control** | Automated LLM rubric evaluator, 2-strike firing logic, Prompt memory injection |
| **Reproducibility** | `npm run generate-runs`, `npm run serve`, `npm run dev` |

---

### Conclusion

Cubicle bridges the gap between static scripting and true autonomous collaboration. By pairing **recursive hierarchical decomposition** with **rigorous organizational governance** and an **observability-first 3D interface**, it demonstrates what next-generation autonomous AI teammates should look, feel, and act like.
