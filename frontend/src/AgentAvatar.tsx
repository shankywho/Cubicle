import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Html } from "@react-three/drei";
import { useSpring, animated } from "@react-spring/three";
import * as THREE from "three";
import { useOrgStore, type Agent } from "./store";

export const SKILL_COLORS: Record<string, string> = {
  ceo: "#f59e0b", // Amber/Gold
  "manager-research": "#3b82f6", // Blue
  "manager-synthesis": "#8b5cf6", // Purple
  "web-research": "#06b6d4", // Cyan
  "data-analysis": "#10b981", // Emerald
  writing: "#f97316", // Orange
  critique: "#ef4444", // Red
};

interface AgentAvatarProps {
  agent: Agent;
  position: [number, number, number];
}

export function AgentAvatar({ agent, position }: AgentAvatarProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const color = SKILL_COLORS[agent.skill] || "#64748b";

  // Check if agent is currently working on an active task
  const isWorking = useOrgStore((state) =>
    state.tasks.some(
      (t) => t.ownerAgentId === agent.id && t.status === "in_progress"
    )
  );

  const isFired = agent.status === "fired";

  // Check messages for this agent
  const messages = useOrgStore((state) => state.messages);
  const latestMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].fromAgentId === agent.id) {
        return messages[i];
      }
    }
    return null;
  }, [messages, agent.id]);

  const [activeBubble, setActiveBubble] = useState<string | null>(null);

  // Automatically unmount/hide chat bubble after 4 seconds
  useEffect(() => {
    if (!latestMessage) {
      setActiveBubble(null);
      return;
    }

    const elapsed = Date.now() - latestMessage.ts;
    const remaining = 4000 - elapsed;

    if (remaining <= 0) {
      setActiveBubble(null);
      return;
    }

    setActiveBubble(latestMessage.content);

    const timer = setTimeout(() => {
      setActiveBubble(null);
    }, remaining);

    return () => clearTimeout(timer);
  }, [latestMessage]);

  // Animate scale from 0 to 1 upon spawn/hire, and back to 0 if fired
  const { springScale } = useSpring({
    springScale: isFired ? 0 : 1,
    from: { springScale: 0 },
    config: { tension: 220, friction: 18 },
  });

  // Rotate working glow ring
  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 1.5;
    }
  });

  return (
    <animated.group
      position={[position[0], position[1] + 0.65, position[2] + 0.65]}
      scale={springScale.to((s) => [s, s, s]) as any}
    >
      {/* Working state glowing ring around the base */}
      {isWorking && (
        <group position={[0, -0.42, 0]}>
          <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.44, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Subtle outer halo */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.44, 0.52, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* Avatar Capsule */}
      <mesh castShadow>
        <capsuleGeometry args={[0.22, 0.6, 8, 16]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.3}
          emissive={isWorking ? color : "#000000"}
          emissiveIntensity={isWorking ? 0.35 : 0}
        />
      </mesh>

      {/* Floating Nameplate */}
      <Text
        position={[0, 0.75, 0]}
        fontSize={0.14}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.015}
        outlineColor="#0f172a"
      >
        {agent.name}
      </Text>

      {/* Skill Role Badge */}
      <Text
        position={[0, 0.58, 0]}
        fontSize={0.09}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#0f172a"
      >
        {agent.skill}
      </Text>

      {/* Transient 3D Chat Bubble positioned above the agent's head */}
      {activeBubble && (
        <Html
          position={[0, 1.25, 0]}
          center
          distanceFactor={10}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              position: "relative",
              background: "rgba(15, 23, 42, 0.94)",
              backdropFilter: "blur(12px)",
              border: `1.5px solid ${color}`,
              boxShadow: `0 8px 24px rgba(0, 0, 0, 0.6), 0 0 14px ${color}40`,
              color: "#f8fafc",
              padding: "7px 12px",
              borderRadius: "10px",
              fontSize: "11px",
              fontWeight: 600,
              width: "max-content",
              maxWidth: "200px",
              textAlign: "center",
              lineHeight: 1.35,
              wordBreak: "break-word",
              whiteSpace: "normal",
              transform: "translateY(-4px)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            {activeBubble}
            {/* Triangular pointer */}
            <div
              style={{
                position: "absolute",
                bottom: -6,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: `6px solid ${color}`,
              }}
            />
          </div>
        </Html>
      )}
    </animated.group>
  );
}

export default AgentAvatar;
