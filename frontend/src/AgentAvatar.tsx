import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
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
    </animated.group>
  );
}

export default AgentAvatar;
