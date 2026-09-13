import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { useOrgStore, type Agent } from "./store";

// Defined 3D positions for the 8 workstations + CEO desk
const DESK_CONFIG: Record<string, [number, number, number]> = {
  "desk-ceo": [0, 0.4, 3.8],
  "desk-1": [-3.6, 0.4, 1.8],
  "desk-2": [-1.2, 0.4, 1.8],
  "desk-3": [1.2, 0.4, 1.8],
  "desk-4": [3.6, 0.4, 1.8],
  "desk-5": [-3.6, 0.4, -1.2],
  "desk-6": [-1.2, 0.4, -1.2],
  "desk-7": [1.2, 0.4, -1.2],
  "desk-8": [3.6, 0.4, -1.2],
};

// Distinct signature colors for skill roles
const SKILL_COLORS: Record<string, string> = {
  "ceo": "#f59e0b",              // Amber/Gold
  "manager-research": "#3b82f6", // Blue
  "manager-synthesis": "#8b5cf6",// Purple
  "web-research": "#06b6d4",     // Cyan
  "data-analysis": "#10b981",    // Emerald
  "writing": "#f97316",          // Orange
  "critique": "#ef4444",         // Red
};

function getDeskPos(deskId: string, idx: number): [number, number, number] {
  if (DESK_CONFIG[deskId]) {
    return DESK_CONFIG[deskId];
  }
  // Fallback layout if more than 8 desks appear
  const row = Math.floor(idx / 4);
  const col = (idx % 4) - 1.5;
  return [col * 2.4, 0.4, -3.2 - row * 2.2];
}

/**
 * 3D Desk component
 */
function Desk({ id, position }: { id: string; position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Desk Top */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.8, 0.9]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Desk ID Label */}
      <Text
        position={[0, 0.42, 0.35]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.12}
        color="#94a3b8"
      >
        {id.toUpperCase()}
      </Text>
    </group>
  );
}

/**
 * 3D Agent Avatar component rendered as a colored capsule with floating nameplate
 */
function AgentAvatar({ agent, position }: { agent: Agent; position: [number, number, number] }) {
  const color = SKILL_COLORS[agent.skill] || "#64748b";

  return (
    <group position={[position[0], position[1] + 0.65, position[2] + 0.65]}>
      {/* Avatar Capsule */}
      <mesh castShadow>
        <capsuleGeometry args={[0.22, 0.6, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.3} />
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
    </group>
  );
}

export function Office() {
  const agents = useOrgStore((state) => state.agents);

  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, 9.5], fov: 48 }}
      style={{ width: "100%", height: "100%", background: "#090d16" }}
    >
      <OrbitControls
        maxPolarAngle={Math.PI / 2.1}
        minDistance={4}
        maxDistance={24}
        enableDamping
        dampingFactor={0.05}
      />

      {/* 1. Ambient & Directional Lighting */}
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[8, 14, 8]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-6, 6, -6]} intensity={0.4} color="#38bdf8" />

      {/* 2. Floor Plane & Grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[26, 26]} />
        <meshStandardMaterial color="#0b1120" roughness={0.8} />
      </mesh>
      <gridHelper args={[24, 24, "#334155", "#1e293b"]} position={[0, 0, 0]} />

      {/* 3. Static 8 Desk Workstations */}
      {Object.entries(DESK_CONFIG).map(([deskId, pos]) => (
        <Desk key={deskId} id={deskId} position={pos} />
      ))}

      {/* 4. Active Agents Mapped to Desks */}
      {agents.map((agent, idx) => {
        const deskPos = getDeskPos(agent.deskId, idx);
        return <AgentAvatar key={agent.id} agent={agent} position={deskPos} />;
      })}
    </Canvas>
  );
}
export default Office;
