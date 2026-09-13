# Autonomous AI Org — Detailed Architecture & Phase Plan

## Part A — Detailed Architecture

### A.1 Layered system view

```
┌───────────────────────────────────────────────────────────────────────────┐
│ LAYER 4 — Presentation                                                     │
│  React app                                                                 │
│   ├─ 3D Office Scene (react-three-fiber)                                   │
│   ├─ Org Chart / Task Tree Panel                                           │
│   ├─ Event Log / Console                                                   │
│   └─ Control Bar (Start Job, Live/Replay toggle, Speed control)            │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 3 — Transport                                                        │
│  Socket.IO (WebSocket) — one channel, typed events, append-only stream     │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 2 — Orchestration (the actual "product")                             │
│  Orchestrator service (Node/TS)                                            │
│   ├─ Agent (recursive class — hire/decompose/execute/verify/report)        │
│   ├─ Skill Registry (templates + on-the-fly synthesis)                     │
│   ├─ Performance Tracker (success/fail counts → fire decisions)            │
│   ├─ Task Store (in-memory tree + persisted JSON)                          │
│   └─ Event Bus (emits every state change as a typed event)                 │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 1 — Execution / Tools                                                │
│  Anthropic API (Claude) with tool use:                                     │
│   web_search · code_execution · file/doc generation · (custom tools)       │
├───────────────────────────────────────────────────────────────────────────┤
│ LAYER 0 — Persistence                                                      │
│  event_log.jsonl (append-only, per run) — powers replay mode + debugging   │
└───────────────────────────────────────────────────────────────────────────┘
```

Everything above Layer 2 is a *renderer* of the event stream. Nothing in the frontend holds authoritative state — this is what lets you build "live mode" and "replay mode" with the same rendering code, just a different event source.

### A.2 Core data model

```ts
// A Task is any unit of work at any level of the org.
interface Task {
  id: string;
  parentTaskId: string | null;
  ownerAgentId: string | null;      // who currently owns it
  description: string;
  status: "pending" | "decomposed" | "assigned" | "in_progress"
        | "completed" | "failed" | "retrying";
  depth: number;                    // 0 = root/CEO level
  subtaskIds: string[];
  attempt: number;
  result?: TaskResult;
}

interface TaskResult {
  summary: string;
  artifacts?: { type: string; ref: string }[]; // e.g. doc, table, code diff
  confidence: number;      // 0–1, self-reported by the agent
  verdict?: "pass" | "fail"; // set by a critic/verifier step
  verdictReason?: string;
}

// An Agent is a role instance in the org, not a raw LLM call.
interface Agent {
  id: string;
  parentAgentId: string | null;
  name: string;                 // display name for the UI
  skill: string;                 // key into SkillRegistry
  systemPrompt: string;          // may be synthesized, not just templated
  tools: string[];               // subset available to this agent
  status: "hiring" | "idle" | "working" | "fired";
  deskId: string;                // for 3D placement
  perf: { attempted: number; failed: number; avgConfidence: number };
}

interface SkillTemplate {
  key: string;               // "web-research", "data-analysis", "writing", "critique", ...
  promptFragment: string;
  defaultTools: string[];
  isManager: boolean;        // managers decompose+hire; leaves execute
}
```

### A.3 Event stream (the contract between backend and frontend)

```ts
type OrgEvent =
  | { type: "job.started"; jobId: string; brief: string; ts: number }
  | { type: "agent.hired"; agent: Agent; ts: number }
  | { type: "agent.fired"; agentId: string; reason: string; ts: number }
  | { type: "task.created"; task: Task; ts: number }
  | { type: "task.decomposed"; taskId: string; subtaskIds: string[]; ts: number }
  | { type: "task.assigned"; taskId: string; agentId: string; ts: number }
  | { type: "task.started"; taskId: string; ts: number }
  | { type: "task.result"; taskId: string; result: TaskResult; ts: number }
  | { type: "task.retry"; taskId: string; attempt: number; feedback: string; ts: number }
  | { type: "message"; fromAgentId: string; toAgentId: string; content: string; ts: number }
  | { type: "job.completed"; jobId: string; finalResult: TaskResult; ts: number };
```

Every backend state change emits exactly one of these. The frontend never infers state — it only ever applies events to a local store (zustand), in order. This is also literally your replay format: `event_log.jsonl` is just this array serialized one-per-line.

### A.4 The recursive agent algorithm (pseudocode)

```
async function handle(agent, task):
  emit(task.started, task.id)

  if isAtomic(task):                       # leaf-level, single well-scoped action
      result = await execute(agent, task)   # real Claude call w/ tools
      result.verdict = await selfCritique(agent, task, result)
      emit(task.result, task.id, result)
      report(agent.parent, task, result)
      return

  subtasks = await decompose(agent, task)   # Claude call: "break this into N steps"
  emit(task.decomposed, task.id, subtasks.map(t => t.id))

  for subtask in subtasks:
      childAgent = findOrHire(agent, requiredSkill(subtask))
      emit(task.assigned, subtask.id, childAgent.id)
      spawn handle(childAgent, subtask)      # recurses — fire-and-await-all

  results = await awaitAll(subtasks)
  verdicts = evaluate(results)               # aggregate pass/fail

  for (subtask, result) in zip(subtasks, results):
      if result.verdict == "fail":
          perf[result.agentId].failed += 1
          if perf[result.agentId].failed >= 2:
              fire(result.agentId, reason="repeated failure")
              newAgent = hire(agent, requiredSkill(subtask), feedback=result.verdictReason)
              emit(task.retry, subtask.id, attempt+1, result.verdictReason)
              spawn handle(newAgent, subtask)   # single retry with new hire

  finalResult = synthesize(agent, task, results)
  emit(task.result, task.id, finalResult)
  report(agent.parent, task, finalResult)
```

This one function, called on the root task with the CEO agent, produces the entire run — every hire, fire, decomposition and message is just a side effect (an emitted event) of this loop executing recursively.

---

## Part B — Phase-by-Phase Plan (explicit input → output per phase)

Each phase below states: **Goal**, **Input** (what must exist before starting), **Output** (concrete artifact that proves the phase is done), and **Done when** (acceptance check).

### Phase 0 — Problem & Demo Scenario Definition
- **Goal:** Lock the one concrete problem the org solves (see prior recommendation: research/deliverable team), and script the exact demo brief.
- **Input:** Track theme, your team's tool/domain preference.
- **Output:**
  - A written 2–3 sentence "job brief" the CEO agent will receive (e.g. *"Research the competitive landscape for X and produce a decision memo with a recommendation."*)
  - A list of the skill templates you'll need (`web-research`, `data-analysis`, `writing`, `critique`, maybe `manager-research`, `manager-synthesis`)
  - A one-page description of what "success" looks like (what the final artifact is — a doc, a memo, a report)
- **Done when:** You can say out loud, in one breath, what goes in and what comes out of the whole system.

### Phase 1 — Orchestrator Core (mocked execution)
- **Goal:** Validate the recursion/hire/fire logic *before* spending any API budget or frontend time.
- **Input:** Phase 0 brief + skill list; Node/TS project scaffold.
- **Output:**
  - `Agent` class implementing the pseudocode in A.4, with `execute()`, `decompose()`, `selfCritique()` all **stubbed** (return canned/random results, including some artificial failures to exercise firing logic)
  - `event_log.jsonl` produced from a full mocked run of the Phase 0 brief
  - A CLI script: `npm run simulate` prints the org tree + final result to console
- **Done when:** Running the mock produces a plausible event log containing at least one `agent.fired` and one `task.retry`, and a `job.completed` with a non-empty final result.

### Phase 2 — Skill Registry & Hiring/Firing Logic
- **Goal:** Make hiring decisions real (not random) — match skill to task, and support synthesizing a new skill template when nothing fits.
- **Input:** Output of Phase 1 (working mock orchestrator).
- **Output:**
  - `skills/registry.json` (or module) with the templates from Phase 0
  - `findOrHire()` implementation: picks best existing idle agent by skill match → else instantiates from template → else (stretch) asks Claude to synthesize a new `SkillTemplate` on the fly
  - Performance tracker wired to real fire threshold (configurable, default: 2 failures)
- **Done when:** Feeding the mock orchestrator a brief that needs a skill *not* in your predefined list results in a synthesized new skill template being hired, visible in the event log.

### Phase 3 — Real LLM Integration
- **Goal:** Replace every stub with a real Anthropic API call.
- **Input:** Phase 2 orchestrator; Anthropic API key; tool access (web_search, code execution).
- **Output:**
  - `execute()` → real Claude call with the agent's `systemPrompt` + `tools`, returns a real `TaskResult`
  - `decompose()` → real Claude call that returns a structured JSON list of subtasks (use a strict JSON-output prompt)
  - `selfCritique()` / verifier step → real Claude call scoring the result against a rubric, returning `pass`/`fail` + reason
  - At least one full **real** end-to-end run, saved as `runs/run-001.jsonl`
- **Done when:** A real run on the Phase 0 brief completes, produces a genuine final artifact (e.g. an actual memo, not placeholder text), and the saved event log looks materially different from the Phase 1 mock (real subtask descriptions, real content).

### Phase 4 — Event Server (WebSocket)
- **Goal:** Stream the orchestrator's events live over the network instead of only writing to a file.
- **Input:** Phase 3 orchestrator (emits `OrgEvent`s already).
- **Output:**
  - `server.ts`: Socket.IO server; `POST /jobs` starts a run; every `OrgEvent` emitted is broadcast on the socket
  - A minimal test client (can be a `wscat` session or a 10-line script) that prints incoming events in real time during a run
- **Done when:** Starting a job via the API and watching the raw socket stream shows events arriving in real time, in order, matching the saved JSONL from Phase 3.

### Phase 5 — Frontend Scaffold (3D Office)
- **Goal:** Stand up the 3D scene and get it receiving the live event stream, before worrying about animation polish.
- **Input:** Phase 4 running server; desk layout plan (how many desks, arranged how).
- **Output:**
  - React app with react-three-fiber canvas, static office (floor, desks, lighting)
  - Zustand store subscribed to the socket; `agent.hired` event → a placeholder avatar (capsule + nameplate) appears at an assigned desk; `agent.fired` → it disappears
  - Manual test: trigger a job from Phase 4's API, watch avatars appear/disappear in the 3D scene as the run progresses
- **Done when:** A live run visibly populates and depopulates the office in real time with zero manual intervention.

### Phase 6 — Org Chart / Task Tree Panel
- **Goal:** Make the *reasoning* visible, not just the org roster — this is what proves decomposition is really happening.
- **Input:** Phase 5 frontend + event store.
- **Output:**
  - A side panel rendering the task tree (nested, collapsible), updating live on `task.created` / `task.decomposed` / `task.result`
  - Color coding by status (pending/in-progress/completed/failed/retrying)
  - Click a task → highlights the owning agent in the 3D scene (and vice versa)
- **Done when:** Watching a live run, a viewer can read the task tree top-to-bottom and understand exactly how the brief was broken down, without needing the 3D view at all.

### Phase 7 — Animation & Interaction Polish
- **Goal:** Make state changes *read* clearly at a glance — this is what actually sells the demo.
- **Input:** Phase 5 + 6 (functionally complete, visually plain).
- **Output:**
  - Hire: avatar walks/fades in to its desk
  - Fire: avatar walks/fades out; desk shows "vacant" briefly then new hire animation
  - Working: glowing outline / progress ring on agent while `task.started` → `task.result` is pending
  - Message: transient chat bubble on `message` events
  - 1–2 scripted camera moves (e.g. establishing shot on `job.started`, zoom-in on `job.completed`)
- **Done when:** Someone unfamiliar with the project can watch a 90-second run with sound off and correctly narrate what's happening.

### Phase 8 — Replay Mode (demo safety net)
- **Goal:** Decouple the live demo from live API reliability.
- **Input:** Saved `run-*.jsonl` files from real Phase 3 executions; Phase 5–7 frontend (event-driven, so this should be nearly free).
- **Output:**
  - A "Live / Replay" toggle in the UI
  - Replay mode: reads a saved JSONL, re-emits events on the same timing (or sped up) through the *same* store the live socket uses
  - 2–3 curated saved runs, including at least one that clearly shows a fire→rehire moment
- **Done when:** Replay of a saved run is visually indistinguishable from a live run to someone who doesn't know which mode is active.

### Phase 9 — Integration Testing & Real Runs
- **Goal:** Stress-test the whole path end to end, in both modes, and produce the actual demo-day content.
- **Input:** Fully assembled system (Phases 1–8).
- **Output:**
  - 3+ full real runs on varied briefs (to confirm the org genuinely adapts subtask count/skills to problem complexity, not just replaying one fixed structure)
  - Bug list resolved (WS reconnects, race conditions on fast-arriving events, avatar desk-assignment collisions)
  - Final chosen "hero run" saved for replay-mode demo
- **Done when:** You can run the exact demo-day sequence twice in a row with identical, correct results.

### Phase 10 — Demo Packaging
- **Goal:** Convert the working system into a winnable submission.
- **Input:** Phase 9 hero run + working app.
- **Output:**
  - 2–3 min demo video (record replay mode; show the task tree + 3D view together; narrate the hire/fire moment explicitly, since that's your differentiator)
  - README with architecture diagram (reuse Part A), setup instructions, and "what makes this different" section (recursive org, not fixed pipeline)
  - Submission write-up mapping features → track judging criteria
- **Done when:** Someone who has never seen the project can watch the video and correctly explain, unprompted, what the "autonomous teammate" behavior is.

---

## Summary: what flows between phases

```
Phase 0  → brief + skill list
Phase 1  → mocked orchestrator + sample event log
Phase 2  → skill registry + real hire/fire logic
Phase 3  → real Claude-powered orchestrator + real event log
Phase 4  → live WebSocket event stream
Phase 5  → 3D scene reacting to live events
Phase 6  → task-tree panel reacting to live events
Phase 7  → polished, legible animations
Phase 8  → replay mode using Phase 3's saved logs
Phase 9  → validated hero run(s)
Phase 10 → video + README + submission
```

Notice each phase's **output is literally the next phase's input** — this is intentional so you can stop after any phase and still have something demoable (a CLI trace, a raw socket stream, a plain 3D scene, etc.), which matters if time runs short.
