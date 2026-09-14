export type TaskStatus =
  | "pending"
  | "decomposed"
  | "assigned"
  | "in_progress"
  | "completed"
  | "failed"
  | "retrying";

export interface TaskArtifact {
  type: string;
  ref: string;
}

export interface TaskResult {
  summary: string;
  artifacts?: TaskArtifact[];
  confidence: number; // 0–1, self-reported by the agent
  verdict?: "pass" | "fail"; // set by a critic/verifier step
  verdictReason?: string;
  toolSummary?: string;
  tokens?: { prompt: number; completion: number; total: number };
}

export interface Task {
  id: string;
  parentTaskId: string | null;
  ownerAgentId: string | null; // who currently owns it
  description: string;
  status: TaskStatus;
  depth: number; // 0 = root/CEO level
  subtaskIds: string[];
  attempt: number;
  result?: TaskResult;
}

export type AgentStatus = "hiring" | "idle" | "working" | "fired";

export interface AgentPerf {
  attempted: number;
  failed: number;
  avgConfidence: number;
}

export interface Agent {
  id: string;
  parentAgentId: string | null;
  name: string; // display name for the UI
  skill: string; // key into SkillRegistry
  systemPrompt: string; // may be synthesized, not just templated
  tools: string[]; // subset available to this agent
  status: AgentStatus;
  deskId: string; // for 3D placement
  perf: AgentPerf;
}

export interface SkillTemplate {
  key: string;
  promptFragment: string;
  defaultTools: string[];
  isManager: boolean;
}

export type OrgEvent =
  | { type: "job.started"; jobId: string; brief: string; ts: number }
  | { type: "agent.hired"; agent: Agent; ts: number }
  | { type: "agent.fired"; agentId: string; reason: string; ts: number }
  | { type: "task.created"; task: Task; ts: number }
  | { type: "task.decomposed"; taskId: string; subtaskIds: string[]; rationale?: string; ts: number }
  | { type: "task.assigned"; taskId: string; agentId: string; ts: number }
  | { type: "task.started"; taskId: string; ts: number }
  | { type: "task.result"; taskId: string; result: TaskResult; ts: number }
  | { type: "task.retry"; taskId: string; attempt: number; feedback: string; ts: number }
  | { type: "message"; fromAgentId: string; toAgentId: string; content: string; ts: number }
  | { type: "tool.invoked"; agentId: string; toolName: string; args: Record<string, any>; ts: number }
  | { type: "tool.result"; agentId: string; toolName: string; summary: string; ts: number }
  | { type: "job.completed"; jobId: string; finalResult: TaskResult; ts: number };
