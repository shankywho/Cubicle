import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
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

/**
 * POST /replay
 * Streams pre-recorded runs/run-001.jsonl line-by-line over Socket.IO at 2x speed.
 */
app.post("/replay", (_req, res) => {
  const filePath = path.resolve(process.cwd(), "runs/run-001.jsonl");

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "No recorded run found at runs/run-001.jsonl" });
  }

  // 6. Return { status: "replaying" } immediately to the client before the loop starts
  res.status(202).json({ status: "replaying" });

  // Stream events line-by-line in background
  (async () => {
    console.log(`\n🎞️ [Replay] Streaming saved run from ${filePath} over Socket.IO...`);
    try {
      const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      let previousTs = 0;

      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event: OrgEvent = JSON.parse(trimmed);

          // Calculate time difference from previous event's ts (default to 0 for first event)
          let delay = 0;
          if (previousTs > 0 && event.ts && event.ts >= previousTs) {
            // Play back at 2x speed (multiply delay by 0.5)
            delay = (event.ts - previousTs) * 0.5;
            // Cap maximum delay at 3.5s to prevent long pauses during presentation
            delay = Math.min(delay, 3500);
          }
          previousTs = event.ts || previousTs;

          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          // Emit event to connected clients
          io.emit("orgEvent", event);
        } catch (parseErr) {
          console.error("Failed to parse replay event line:", parseErr);
        }
      }

      console.log(`🎬 [Replay] Completed streaming run-001.jsonl.`);
    } catch (err) {
      console.error(`❌ [Replay] Error reading run file:`, err);
    }
  })();
});

server.listen(PORT, () => {
  console.log(`===============================================================`);
  console.log(`📡 Autonomous AI Org Event Server running on http://localhost:${PORT}`);
  console.log(`⚡ WebSocket (Socket.IO) ready for live event streaming`);
  console.log(`===============================================================\n`);
});

export { app, server, io };
