import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { AgentNode } from "./agent.js";
import { EventBus } from "./eventBus.js";
import type { Agent, OrgEvent, Task } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = Number(process.env.PORT) || 3000;

io.on("connection", (socket) => {
  console.log(`🔌 [Socket.IO] Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`❌ [Socket.IO] Client disconnected: ${socket.id}`);
  });
});

/**
 * Health check endpoint
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    port: PORT,
    connectedClients: io.engine.clientsCount,
  });
});

/**
 * POST /jobs
 * Starts a new autonomous org execution in the background and broadcasts live events over Socket.IO.
 */
app.post("/jobs", (req, res) => {
  const brief =
    req.body?.brief ||
    "Research the competitive landscape for modern AI code editors (analyzing Cursor, Windsurf, and GitHub Copilot Workspace), evaluate their core strengths, weaknesses, and pricing, and produce a formal decision memo with a strategic recommendation for our engineering team.";

  const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  // 1. Initialize EventBus for this job
  const eventBus = new EventBus();

  // 2. Broadcast every emitted event via Socket.IO
  eventBus.subscribe((event: OrgEvent) => {
    io.emit("orgEvent", event);
  });

  // 3. Initialize root CEO agent and task
  const ceoAgent: Agent = {
    id: "agent-ceo-001",
    parentAgentId: null,
    name: "Alex (CEO)",
    skill: "ceo",
    systemPrompt: "Lead and orchestrate recursive AI organization to fulfill strategic business objectives.",
    tools: ["delegate", "hire"],
    status: "idle",
    deskId: "desk-ceo",
    perf: { attempted: 0, failed: 0, avgConfidence: 1.0 },
  };

  const rootTask: Task = {
    id: `task-root-${jobId}`,
    parentTaskId: null,
    ownerAgentId: ceoAgent.id,
    description: brief,
    status: "pending",
    depth: 0,
    subtaskIds: [],
    attempt: 1,
  };

  // 4. Emit initial job.started event
  eventBus.emit({
    type: "job.started",
    jobId,
    brief,
    ts: Date.now(),
  });

  // 5. Kick off recursive handling in background (do not await in request handler)
  (async () => {
    console.log(`\n🚀 [Job ${jobId}] Execution started in background.`);
    try {
      const ceoNode = new AgentNode(ceoAgent, eventBus, 2);
      const finalResult = await ceoNode.handle(rootTask);

      eventBus.emit({
        type: "job.completed",
        jobId,
        finalResult,
        ts: Date.now(),
      });

      // Save run log
      const runsDir = path.resolve(process.cwd(), "runs");
      if (!fs.existsSync(runsDir)) {
        fs.mkdirSync(runsDir, { recursive: true });
      }
      const runLogPath = path.join(runsDir, "run-001.jsonl");
      fs.copyFileSync(eventBus.getLogPath(), runLogPath);

      console.log(`✅ [Job ${jobId}] Completed successfully. Run saved to ${runLogPath}`);
    } catch (err) {
      console.error(`❌ [Job ${jobId}] Error during execution:`, err);
    }
  })();

  // 6. Return immediate response
  return res.status(202).json({
    status: "started",
    jobId,
  });
});

server.listen(PORT, () => {
  console.log(`===============================================================`);
  console.log(`📡 Autonomous AI Org Event Server running on http://localhost:${PORT}`);
  console.log(`⚡ WebSocket (Socket.IO) ready for live event streaming`);
  console.log(`===============================================================\n`);
});

export { app, server, io };
