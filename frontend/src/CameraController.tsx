import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useOrgStore } from "./store";

// Camera shot coordinates for each phase of the workflow
const CAMERA_SHOTS = {
  idle: {
    position: new THREE.Vector3(0, 8, 9.5),
    target: new THREE.Vector3(0, 0, 0),
  },
  running: {
    // Dynamic establishing angle overlooking the active workstations
    position: new THREE.Vector3(-5.2, 6.2, 6.8),
    target: new THREE.Vector3(0, 0.4, 0.5),
  },
  completed: {
    // Cinematic close-up on the CEO's desk for final memo deliverable
    position: new THREE.Vector3(0, 2.3, 5.6),
    target: new THREE.Vector3(0, 0.8, 3.8),
  },
};

export function CameraController() {
  const { camera, controls } = useThree();
  const jobStatus = useOrgStore((state) => state.jobStatus);

  const targetPos = useRef(CAMERA_SHOTS.idle.position.clone());
  const targetLook = useRef(CAMERA_SHOTS.idle.target.clone());

  useEffect(() => {
    const shot = CAMERA_SHOTS[jobStatus] || CAMERA_SHOTS.idle;
    targetPos.current.copy(shot.position);
    targetLook.current.copy(shot.target);
  }, [jobStatus]);

  useFrame((_, delta) => {
    // Smooth frame-rate independent interpolation (lerp)
    const factor = 1 - Math.exp(-2.2 * delta);

    camera.position.lerp(targetPos.current, factor);

    const ctrl = controls as any;
    if (ctrl && ctrl.target) {
      ctrl.target.lerp(targetLook.current, factor);
      ctrl.update();
    } else {
      camera.lookAt(targetLook.current);
    }
  });

  return null;
}

export default CameraController;
