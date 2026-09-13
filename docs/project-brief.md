# Autonomous AI Org: Project Brief

## 1. Demo Scenario & Job Brief

### Domain
**AI Research & Deliverable Team** — an autonomous recursive agent organization tasked with performing strategic market analysis and producing production-ready deliverables.

### CEO Job Brief
> "Research the competitive landscape for modern AI code editors (analyzing Cursor, Windsurf, and GitHub Copilot Workspace), evaluate their core strengths, weaknesses, and pricing, and produce a formal decision memo with a strategic recommendation for our engineering team."

### Org Workflow & Hierarchy
1. **CEO Agent**: Receives the top-level brief, evaluates complexity, and delegates to two functional leads:
   - **Research Manager**: Oversees external data acquisition and competitive analysis across the 3 target competitors.
   - **Synthesis Manager**: Oversees data extraction, drafting, critical review, and final memo compilation.
2. **Dynamic Decomposition & Execution**:
   - The Research Manager spins up dedicated research agents to conduct parallel web investigations for each competitor.
   - The Synthesis Manager coordinates data structuring, memo drafting, and rigorous quality critique.

## 2. Skill Registry Templates

The following predefined skill templates populate the initial Skill Registry:

| Skill Key | Role Type | Tools Available | Responsibilities & Behavior |
| :--- | :--- | :--- | :--- |
| `manager-research` | Manager | Subtask delegation, Agent hiring | Decomposes high-level research scopes into competitor investigations; hires and manages `web-research` agents; aggregates raw intelligence. |
| `manager-synthesis` | Manager | Subtask delegation, Agent hiring | Coordinates final deliverable production; assigns tasks to data, writing, and critique specialists; oversees revision cycles. |
| `web-research` | Leaf Worker | `web_search` | Conducts targeted web searches per competitor to discover product capabilities, pricing tiers, differentiators, and customer sentiment. |
| `data-analysis` | Leaf Worker | `code_execution` | Normalizes and scores competitor attributes; computes comparative metrics; generates structured feature and pricing matrices. |
| `writing` | Leaf Worker | Document generation | Drafts strategic, high-clarity decision memos, synthesizing research and data tables into cohesive prose. |
| `critique` | Leaf Worker | Rubric evaluation | Evaluates draft deliverables against strict criteria (factual rigor, structure, rubric score ≥ 8/10). Issues pass/fail verdicts with actionable feedback. |

## 3. Success Criteria

The job is considered successfully fulfilled when the following criteria are met:

1. **Final Decision Memo Artifact**:
   - Delivered as a formatted Markdown document (with downloadable PDF export support).
   - Contains:
     - **Executive Summary**: High-level synthesis with an actionable engineering recommendation.
     - **Comparative Feature Matrix**: Comprehensive tabular comparison covering AI models used, indexing speed, multi-file edit capabilities, context retention, and pricing tiers.
     - **Competitor Profiles**: In-depth analysis of Cursor, Windsurf, and GitHub Copilot Workspace.
2. **Critique Agent Sign-Off**:
   - The document receives a formal passing verdict (`verdict: "pass"`) from the `critique` agent based on rubric benchmarks (relevance, accuracy, clarity, and completeness).
3. **Execution Integrity**:
   - The complete event lifecycle (`job.started` through `job.completed`) is cleanly recorded to `event_log.jsonl`.
   - Any agent failure during draft generation triggers the designated retry/fire-and-rehire mechanism and recovers automatically to produce the final deliverable.
