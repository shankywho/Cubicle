import { useState } from "react";
import Office from "./Office";
import TaskTreePanel from "./TaskTreePanel";
import { useOrgStore } from "./store";

export function App() {
  const connected = useOrgStore((state) => state.connected);
  const agents = useOrgStore((state) => state.agents);
  const jobStatus = useOrgStore((state) => state.jobStatus);
  const jobId = useOrgStore((state) => state.jobId);
  const reset = useOrgStore((state) => state.reset);

  const [mode, setMode] = useState<"live" | "replay">("replay");
  const [selectedRun, setSelectedRun] = useState<string>("hero-run.jsonl");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartRun = async () => {
    reset();
    setLoading(true);
    setError(null);

    const dummyBrief =
      "Research the competitive landscape for modern AI code editors (analyzing Cursor, Windsurf, and GitHub Copilot Workspace), evaluate their core strengths, weaknesses, and pricing, and produce a formal decision memo with a strategic recommendation for our engineering team.";

    try {
      const url =
        mode === "live"
          ? "http://localhost:3000/jobs"
          : "http://localhost:3000/replay";

      const options: RequestInit =
        mode === "live"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ brief: dummyBrief }),
            }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ runFile: selectedRun }),
            };

      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`${mode === "live" ? "Live job" : "Replay"} launched successfully:`, data);
    } catch (err: any) {
      console.error(`Failed to start ${mode} run:`, err);
      setError(err.message || "Failed to connect to backend server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* 1. Full-screen 3D Office Scene */}
      <Office />

      {/* 2. Live Task Hierarchy Side Panel */}
      <TaskTreePanel />

      {/* Top Header Overlay */}
      <header
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 366,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(51, 65, 85, 0.6)",
            padding: "10px 18px",
            borderRadius: 12,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
            pointerEvents: "auto",
          }}
        >
          <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "#f8fafc", margin: 0 }}>
            🏢 Cubicle <span style={{ fontWeight: 400, color: "#94a3b8" }}>— Autonomous AI Org</span>
          </h1>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(51, 65, 85, 0.6)",
            padding: "8px 14px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
            pointerEvents: "auto",
            alignItems: "center",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: connected ? "#4ade80" : "#ef4444",
              background: connected ? "transparent" : "rgba(239, 68, 68, 0.15)",
              padding: connected ? "0" : "2px 8px",
              borderRadius: connected ? 0 : 6,
              border: connected ? "none" : "1px solid rgba(239, 68, 68, 0.4)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connected ? "#22c55e" : "#ef4444",
                boxShadow: connected ? "0 0 8px #22c55e" : "0 0 8px #ef4444",
              }}
            />
            {connected ? "Live Stream" : "Offline"}
          </span>

          <span style={{ color: "#475569" }}>•</span>

          <span style={{ color: "#94a3b8" }}>
            Active Agents: <strong style={{ color: "#38bdf8" }}>{agents.length}</strong>
          </span>

          {jobStatus === "running" && (
            <>
              <span style={{ color: "#475569" }}>•</span>
              <span style={{ color: "#facc15" }}>Running ({jobId?.slice(0, 12)}...)</span>
            </>
          )}

          {jobStatus === "completed" && (
            <>
              <span style={{ color: "#475569" }}>•</span>
              <span style={{ color: "#4ade80" }}>Job Complete ✅</span>
            </>
          )}
        </div>
      </header>

      {/* 2 & 3. Absolute-Positioned Overlay at the Bottom of the Screen */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          pointerEvents: "auto",
        }}
      >
        {error && (
          <div
            style={{
              background: "rgba(220, 38, 38, 0.9)",
              color: "#ffffff",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              backdropFilter: "blur(6px)",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Sleek Glassmorphism Mode Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(51, 65, 85, 0.6)",
              borderRadius: 9999,
              padding: 3,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
            }}
          >
            <button
              onClick={() => setMode("replay")}
              disabled={loading || jobStatus === "running"}
              style={{
                background:
                  mode === "replay" ? "rgba(56, 189, 248, 0.2)" : "transparent",
                color: mode === "replay" ? "#38bdf8" : "#94a3b8",
                border:
                  mode === "replay"
                    ? "1px solid rgba(56, 189, 248, 0.45)"
                    : "1px solid transparent",
                padding: "8px 14px",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 600,
                cursor:
                  loading || jobStatus === "running" ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>🎞️</span> Replay Mode
            </button>

            <button
              onClick={() => setMode("live")}
              disabled={loading || jobStatus === "running"}
              style={{
                background:
                  mode === "live" ? "rgba(168, 85, 247, 0.2)" : "transparent",
                color: mode === "live" ? "#c084fc" : "#94a3b8",
                border:
                  mode === "live"
                    ? "1px solid rgba(168, 85, 247, 0.45)"
                    : "1px solid transparent",
                padding: "8px 14px",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 600,
                cursor:
                  loading || jobStatus === "running" ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>⚡</span> Live Mode
            </button>
          </div>

          {/* Glassmorphism Run Selector Dropdown for Replay Mode */}
          {mode === "replay" && (
            <select
              value={selectedRun}
              onChange={(e) => setSelectedRun(e.target.value)}
              disabled={loading || jobStatus === "running"}
              style={{
                background: "rgba(15, 23, 42, 0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(56, 189, 248, 0.5)",
                color: "#38bdf8",
                padding: "9px 16px",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 600,
                outline: "none",
                cursor: loading || jobStatus === "running" ? "not-allowed" : "pointer",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
              }}
            >
              <option value="hero-run.jsonl" style={{ background: "#0f172a", color: "#f8fafc" }}>
                🌳 hero-run.jsonl
              </option>
              <option value="simple-task.jsonl" style={{ background: "#0f172a", color: "#f8fafc" }}>
                ⚡ simple-task.jsonl
              </option>
              <option value="rehire-test.jsonl" style={{ background: "#0f172a", color: "#f8fafc" }}>
                🔄 rehire-test.jsonl
              </option>
            </select>
          )}

          {/* Main Action Trigger Button */}
          <button
            onClick={handleStartRun}
            disabled={loading || jobStatus === "running"}
            style={{
              background:
                jobStatus === "running"
                  ? "linear-gradient(135deg, #475569, #334155)"
                  : mode === "live"
                  ? "linear-gradient(135deg, #7c3aed, #ec4899)"
                  : "linear-gradient(135deg, #2563eb, #0ea5e9)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              padding: "13px 28px",
              borderRadius: 9999,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.02em",
              cursor: loading || jobStatus === "running" ? "not-allowed" : "pointer",
              boxShadow:
                jobStatus === "running"
                  ? "0 4px 12px rgba(0, 0, 0, 0.3)"
                  : mode === "live"
                  ? "0 10px 25px -3px rgba(168, 85, 247, 0.5)"
                  : "0 10px 25px -3px rgba(14, 165, 233, 0.5)",
              transition: "all 0.2s ease-in-out",
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
            onMouseEnter={(e) => {
              if (jobStatus !== "running" && !loading) {
                e.currentTarget.style.transform = "scale(1.03)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {loading ? (
              "Initiating..."
            ) : jobStatus === "running" ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#facc15",
                    animation: "pulse 1.5s infinite",
                  }}
                />
                AI Org Working ({agents.length} Agents)
              </>
            ) : mode === "live" ? (
              <>
                <span>⚡</span> Start Live AI Run
              </>
            ) : (
              <>
                <span>▶️</span> Start Replay (2x)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
export default App;
