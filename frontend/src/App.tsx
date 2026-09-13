import { useState } from "react";
import Office from "./Office";
import { useOrgStore } from "./store";

export function App() {
  const connected = useOrgStore((state) => state.connected);
  const agents = useOrgStore((state) => state.agents);
  const jobStatus = useOrgStore((state) => state.jobStatus);
  const jobId = useOrgStore((state) => state.jobId);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartRun = async () => {
    setLoading(true);
    setError(null);

    const dummyBrief =
      "Research the competitive landscape for modern AI code editors (analyzing Cursor, Windsurf, and GitHub Copilot Workspace), evaluate their core strengths, weaknesses, and pricing, and produce a formal decision memo with a strategic recommendation for our engineering team.";

    try {
      const response = await fetch("http://localhost:3000/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: dummyBrief }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Job successfully launched:", data);
    } catch (err: any) {
      console.error("Failed to start AI run:", err);
      setError(err.message || "Failed to connect to backend server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* 1. Full-screen 3D Office Scene */}
      <Office />

      {/* Top Header Overlay */}
      <header
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
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
              color: connected ? "#4ade80" : "#f87171",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connected ? "#22c55e" : "#ef4444",
                boxShadow: connected ? "0 0 8px #22c55e" : "none",
              }}
            />
            {connected ? "Live Stream" : "Disconnected"}
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

        <button
          onClick={handleStartRun}
          disabled={loading || jobStatus === "running"}
          style={{
            background:
              jobStatus === "running"
                ? "linear-gradient(135deg, #475569, #334155)"
                : "linear-gradient(135deg, #2563eb, #7c3aed)",
            color: "#ffffff",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            padding: "14px 32px",
            borderRadius: 9999,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: loading || jobStatus === "running" ? "not-allowed" : "pointer",
            boxShadow:
              jobStatus === "running"
                ? "0 4px 12px rgba(0, 0, 0, 0.3)"
                : "0 10px 25px -3px rgba(59, 130, 246, 0.5), 0 4px 6px -2px rgba(124, 58, 237, 0.3)",
            transition: "all 0.2s ease-in-out",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
          onMouseEnter={(e) => {
            if (jobStatus !== "running" && !loading) {
              e.currentTarget.style.transform = "scale(1.04)";
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
          ) : (
            <>
              <span>⚡</span> Start AI Run
            </>
          )}
        </button>
      </div>
    </div>
  );
}
export default App;
