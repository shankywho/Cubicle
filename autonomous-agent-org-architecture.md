# Autonomous AI Org — Architecture Plan
### Track 3: Autonomous AI Teammates

## 1. The core idea, made concrete

You're building a **recursive agent org**, not a flat multi-agent pipeline. That recursion is the differentiator vs. most hackathon multi-agent demos — most teams do "planner → 3 fixed workers." You want "planner → hires however many managers/workers the problem actually needs, and those can hire further," which is a much stronger story for judges because it visibly scales with problem complexity.

The loop, applied at every level of the org (this is the "Claude-style" problem-solving loop you mentioned):

```
receive_task(task)
  → assess: is this atomic enough to execute directly?
      YES → execute (leaf agent, uses real tools) → self-critique → return result
      NO  → decompose into subtasks
            → for each subtask: find or hire an agent with matching skill
            → delegate (agent.receive_task recurses)
            → collect results from children
            → verify/aggregate → if a child failed twice, fire it, hire a
              replacement (possibly different skill/prompt), retry once
            → synthesize combined result → return upward
```

Same function at every level (CEO, Manager, Worker) — just the granularity of "task" changes. This is also why it's easy to implement: one recursive `Agent.handle(task)` method, not N different agent classes.

## 2. Pick ONE concrete demo problem domain

An "org that can solve anything" is not demoable in 3 minutes. Judges need to watch it solve *one* real, legible problem end-to-end. Recommended (easiest to make genuinely real, not scripted-looking):

**"AI Research & Deliverable Team"** — you give the CEO agent a broad brief, e.g. *"Research the competitive landscape for X and produce a decision memo with a recommendation."*
- CEO hires a **Research Manager** and a **Synthesis Manager**
- Research Manager hires 2–4 **Research Agents** (real `web_search` tool calls, one per competitor/sub-question)
- Synthesis Manager hires a **Data Agent** (real code execution — e.g. tabulate/score findings) and a **Writer Agent** (drafts the memo) and a **Critic Agent** (grades the draft against a rubric; if it fails, Writer gets fired/retried)
- CEO assembles final memo, presented as a real downloadable doc

Why this one: every leaf action maps to a *real* Claude tool call (web search, code execution) so nothing has to be faked, the org naturally has 2 management layers (shows recursion, not just one level), and "fire the writer, hire a better one" has an obvious, judge-legible trigger (critic score < threshold).

(Alternative if your audience is more dev-tooling: "AI Dev Team ships a feature" — Architect hires Backend/Frontend/Test agents, Test agent fails → Backend agent fired/replaced, PR opens at the end. Same architecture, swap the skill library and tools.)

## 3. System architecture

```
┌─────────────────────┐      WebSocket event stream      ┌──────────────────────────┐
│  Orchestrator (Node/ │ ───────────────────────────────► │  Frontend (React +       │
│  TS or Python)       │                                   │  react-three-fiber)      │
│  - recursive Agent   │ ◄─────────────────────────────── │  - 3D office scene       │
│    class             │      task injection (start job)   │  - org-chart / task-tree │
│  - Anthropic SDK      │                                   │    side panel            │
│    (real calls)       │                                   │  - live event log        │
│  - skill registry      │                                                              │
│  - perf tracker (fire/hire logic)                                                     │
└──────────────────────┘                                   └──────────────────────────┘
```

**Event model** (single source of truth — both the 3D scene and the org-chart panel are just renderers of this stream, so they never desync):

```
agent.hired    { id, parentId, name, skill, deskId }
agent.fired    { id, reason }
task.created   { id, parentTaskId, description, ownerAgentId }
task.decomposed{ taskId, subtaskIds: [...] }
task.assigned  { taskId, agentId }
task.result    { taskId, result, confidence, verdict }
task.retry     { taskId, attempt, feedback }
message        { fromAgentId, toAgentId, content }   // for chat bubbles
```

Persist this event log (even just an array/JSON file) — it's your replay/demo-safety net (see §5) and doubles as free structured logging for the "explain what happened" part of your pitch.

**Skill registry**: a small library of skill templates (name, system-prompt fragment, allowed tools, e.g. `web-research`, `data-analysis`, `writing`, `critique`, `code-backend`). When a parent needs to hire, it either picks the best-matching existing template or asks Claude to synthesize a new one on the fly (system-prompt generation) — this is a nice "look, it invents a new kind of specialist" demo beat.

**Performance tracking / firing logic**: per agent, track `{tasksAttempted, tasksFailed, avgCriticScore}`. Simple rule: fail (critic score below threshold, or exception) twice on the same task → fire, hire replacement with the failure feedback folded into its system prompt ("previous attempt failed because X — avoid that").

## 4. Frontend (3D office)

- **react-three-fiber** + `drei` helpers — fastest path to a decent-looking 3D scene without hand-rolling WebGL.
- Keep agent avatars simple (capsule + nameplate + color = skill, or low-poly readyplayer.me-style rigs if you have time) — the *event-driven behavior* (walking to a desk on hire, walking out on fire, "talking" bubble on message, glowing outline while task in-progress) sells the demo far more than avatar fidelity.
- Camera: default orbit view of the floor, but add 1–2 scripted camera moves (e.g. fly-in on hire, zoom on the critic verdict) — cinematic beats matter a lot for judge impact.
- Side panel: live task tree (collapsible, mirrors `task.decomposed`) — this is what actually proves "it broke the problem down," since 3D alone can't show reasoning.

## 5. De-risking the live demo (important)

Real LLM calls in front of judges are a liability (latency, flaky web search, API hiccups). Do the hybrid you chose:
- Build the **real pipeline** as the source of truth and run it beforehand, save the full event log.
- Add a **replay mode** that streams a saved event log at demo speed — visually identical to live, zero risk.
- Keep a **live mode** available too (toggle) so you can prove it's real if asked/if time allows, but default your stage demo to replay of a real run.

## 6. Suggested week-plus roadmap

| Days | Focus |
|---|---|
| 1–2 | Orchestrator core: recursive `Agent.handle(task)`, skill registry, event log, WebSocket server. Mock LLM calls first — validate the recursion/hire/fire logic end-to-end on paper before spending API budget. |
| 2–3 | Swap in real Anthropic API calls for leaf agents (web_search, code execution) and the critic/verification step. |
| 3–4 | Frontend scaffold: r3f office, desks, agents spawning/despawning on WS events. |
| 4–5 | Task-tree panel, skill badges, chat bubbles, fire→rehire animation. |
| 5–6 | Visual polish (lighting, camera beats), build the replay-mode safety net, run and save 2–3 full real pipeline executions. |
| 6–7 | Demo script, video, README, buffer for bugs. |

## 7. Suggested stack

- Backend: **Node.js + TypeScript**, `@anthropic-ai/sdk`, `socket.io`
- Frontend: **React + react-three-fiber + drei + zustand** (for the event-stream store)
- No heavy agent framework needed — the recursion is simple enough that a framework adds more constraint than value here, and hand-rolling it makes "how it works" much easier to explain to judges.
