import { useState } from "react";
import { useOrgStore, type TaskTreeNode } from "./store";

interface TaskNodeProps {
  node: TaskTreeNode;
}

const STATUS_THEMES: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  completed: {
    bg: "rgba(34, 197, 94, 0.15)",
    text: "#86efac",
    dot: "#22c55e",
    label: "Completed",
  },
  failed: {
    bg: "rgba(239, 68, 68, 0.15)",
    text: "#fca5a5",
    dot: "#ef4444",
    label: "Failed",
  },
  retrying: {
    bg: "rgba(249, 115, 22, 0.15)",
    text: "#fdba74",
    dot: "#f97316",
    label: "Retrying",
  },
  in_progress: {
    bg: "rgba(234, 179, 8, 0.15)",
    text: "#fde047",
    dot: "#eab308",
    label: "In Progress",
  },
  assigned: {
    bg: "rgba(59, 130, 246, 0.15)",
    text: "#93c5fd",
    dot: "#3b82f6",
    label: "Assigned",
  },
  decomposed: {
    bg: "rgba(139, 92, 246, 0.15)",
    text: "#c4b5fd",
    dot: "#8b5cf6",
    label: "Decomposed",
  },
  pending: {
    bg: "rgba(100, 116, 139, 0.15)",
    text: "#cbd5e1",
    dot: "#94a3b8",
    label: "Pending",
  },
};

export function TaskNode({ node }: TaskNodeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const agents = useOrgStore((state) => state.agents);
  const assignedAgent = node.ownerAgentId
    ? agents.find((a) => a.id === node.ownerAgentId)
    : null;

  const theme = STATUS_THEMES[node.status] || STATUS_THEMES.pending;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ marginBottom: 8, fontSize: 12 }}>
      {/* Task Card Header */}
      <div
        style={{
          background: "rgba(15, 23, 42, 0.65)",
          border: `1px solid rgba(51, 65, 85, 0.5)`,
          borderLeft: `3px solid ${theme.dot}`,
          borderRadius: 6,
          padding: "8px 10px",
          transition: "background 0.15s",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          {/* Status badge */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: theme.bg,
              color: theme.text,
              padding: "2px 6px",
              borderRadius: 4,
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: theme.dot,
              }}
            />
            {node.status === "retrying" ? `Retry #${node.attempt}` : theme.label}
          </span>

          {/* Subtask expander */}
          {hasChildren && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "0 4px",
                fontSize: 10,
              }}
            >
              {collapsed ? `▶ (${node.children.length})` : "▼"}
            </button>
          )}
        </div>

        {/* Description */}
        <p
          style={{
            color: "#f1f5f9",
            margin: "6px 0 4px 0",
            lineHeight: 1.4,
            fontWeight: 500,
          }}
        >
          {node.description}
        </p>

        {/* Assigned Agent info */}
        {node.ownerAgentId && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#94a3b8",
              fontSize: 11,
              marginTop: 4,
            }}
          >
            <span>👤</span>
            <span style={{ color: "#38bdf8", fontWeight: 600 }}>
              {assignedAgent ? assignedAgent.name : node.ownerAgentId}
            </span>
            {assignedAgent && (
              <span style={{ color: "#64748b", fontSize: 10 }}>
                ({assignedAgent.skill})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Recursive Children Container */}
      {hasChildren && !collapsed && (
        <div
          style={{
            paddingLeft: 12,
            borderLeft: "1.5px solid rgba(148, 163, 184, 0.25)",
            marginLeft: 8,
            marginTop: 6,
          }}
        >
          {node.children.map((child) => (
            <TaskNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export default TaskNode;
