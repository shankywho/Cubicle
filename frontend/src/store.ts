import { create } from "zustand";
import { io } from "socket.io-client";

export interface AgentPerf {
  attempted: number;
  failed: number;
  avgConfidence: number;
}

export interface Agent {
  id: string;
  parentAgentId: string | null;
  name: string;
  skill: string;
  systemPrompt: string;
  tools: string[];
  status: "hiring" | "idle" | "working" | "fired";
  deskId: string;
  perf: AgentPerf;
}

export interface TaskResult {
  summary: string;
  artifacts?: { type: string; ref: string }[];
  confidence: number;
  verdict?: "pass" | "fail";
  verdictReason?: string;
}

export interface Task {
  id: string;
  parentTaskId: string | null;
  ownerAgentId: string | null;
  description: string;
  status: "pending" | "decomposed" | "assigned" | "in_progress" | "completed" | "failed" | "retrying";
  depth: number;
  subtaskIds: string[];
  attempt: number;
  result?: TaskResult;
}

export type OrgEvent =
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

interface OrgStore {
  agents: Agent[];
  tasks: Task[];
  events: OrgEvent[];
  connected: boolean;
  jobId: string | null;
  jobStatus: "idle" | "running" | "completed";
  addAgent: (agent: Agent) => void;
  removeAgent: (agentId: string) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
  clearState: () => void;
}

export const useOrgStore = create<OrgStore>((set) => ({
  agents: [],
  tasks: [],
  events: [],
  connected: false,
  jobId: null,
  jobStatus: "idle",

  addAgent: (agent) =>
    set((state) => ({
      // Avoid duplicate hires if already in store
      agents: [...state.agents.filter((a) => a.id !== agent.id), agent],
    })),

  removeAgent: (agentId) =>
    set((state) => ({
      agents: state.agents.filter((a) => a.id !== agentId),
    })),

  addTask: (task) =>
    set((state) => ({
      tasks: [...state.tasks.filter((t) => t.id !== task.id), task],
    })),

  updateTask: (taskId, patch) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    })),

  clearState: () =>
    set({
      agents: [],
      tasks: [],
      events: [],
      jobStatus: "idle",
      jobId: null,
    }),
}));

// Initialize Socket.IO connection to orchestrator server
export const socket = io("http://localhost:3000", {
  autoConnect: true,
});

socket.on("connect", () => {
  console.log("🟢 Connected to orchestrator event server:", socket.id);
  useOrgStore.setState({ connected: true });
});

socket.on("disconnect", () => {
  console.log("🔴 Disconnected from orchestrator server");
  useOrgStore.setState({ connected: false });
});

// Real-time listener for typed org events
socket.on("orgEvent", (event: OrgEvent) => {
  const store = useOrgStore.getState();

  // Keep event history
  useOrgStore.setState((prev) => ({ events: [...prev.events, event] }));

  switch (event.type) {
    case "job.started":
      useOrgStore.setState({
        jobId: event.jobId,
        jobStatus: "running",
        agents: [],
        tasks: [],
      });
      break;

    case "agent.hired":
      store.addAgent(event.agent);
      break;

    case "agent.fired":
      store.removeAgent(event.agentId);
      break;

    case "task.created":
      store.addTask(event.task);
      break;

    case "task.assigned":
      store.updateTask(event.taskId, { ownerAgentId: event.agentId });
      break;

    case "task.started":
      store.updateTask(event.taskId, { status: "in_progress" });
      break;

    case "task.result":
      store.updateTask(event.taskId, {
        result: event.result,
        status: event.result.verdict === "pass" ? "completed" : "failed",
      });
      break;

    case "task.retry":
      store.updateTask(event.taskId, {
        status: "retrying",
        attempt: event.attempt,
      });
      break;

    case "job.completed":
      useOrgStore.setState({ jobStatus: "completed" });
      break;
  }
});
