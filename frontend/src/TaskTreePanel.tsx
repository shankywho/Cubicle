import { useTaskTree, useOrgStore } from "./store";
import { TaskNode } from "./TaskNode";

export function TaskTreePanel() {
  const rootTasks = useTaskTree();
  const tasksCount = useOrgStore((state) => state.tasks.length);

  return (
    <aside
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 350,
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(16px)",
        borderLeft: "1px solid rgba(51, 65, 85, 0.6)",
        padding: "20px 16px",
        overflowY: "auto",
        zIndex: 10,
        boxShadow: "-8px 0 25px rgba(0, 0, 0, 0.4)",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(51, 65, 85, 0.6)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#f8fafc",
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            🌳 Task Hierarchy
          </h2>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(56, 189, 248, 0.15)",
              color: "#38bdf8",
              padding: "2px 8px",
              borderRadius: 9999,
              border: "1px solid rgba(56, 189, 248, 0.3)",
            }}
          >
            {tasksCount} Tasks
          </span>
        </div>
        <p
          style={{
            fontSize: 11,
            color: "#94a3b8",
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          Recursive breakdown updated in real time from the orchestrator.
        </p>
      </div>

      {/* Task Tree Content */}
      <div style={{ flex: 1 }}>
        {rootTasks.length === 0 ? (
          <div
            style={{
              color: "#64748b",
              fontSize: 12,
              textAlign: "center",
              marginTop: 48,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
            No tasks in progress.
            <br />
            Click <strong>"Start AI Run"</strong> to decompose the job brief.
          </div>
        ) : (
          rootTasks.map((root) => <TaskNode key={root.id} node={root} />)
        )}
      </div>
    </aside>
  );
}

export default TaskTreePanel;
