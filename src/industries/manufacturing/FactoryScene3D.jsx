// src/industries/manufacturing/FactoryScene3D.jsx
// Lightweight low-poly 3D shop floor — code-split, only loaded when the
// Manufacturing dashboard mounts (see the lazy import in ManufacturingDashboard.jsx).
// Shape per asset is driven by the REAL asset_type field; color/animation by the
// REAL status field. No fabricated positions or values — just a stylized layout.

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

const STATUS_COLOR = {
  running: '#22c55e', normal: '#22c55e', ok: '#22c55e', healthy: '#22c55e',
  fault: '#ef4444', alarm: '#ef4444', trip: '#ef4444', tamper: '#ef4444',
  degraded: '#f59e0b',
};
const IDLE_COLOR = '#475569';

const SLOT_POSITIONS = [
  [-4, 0, -2], [0, 0, -2.4], [4, 0, -2],
  [-4, 0, 2], [0, 0, 2.4], [4, 0, 2],
];

function CncMachine({ color, pulse }) {
  const topRef = useRef();
  useFrame((state) => {
    if (!pulse || !topRef.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.08;
    topRef.current.scale.set(s, s, s);
  });
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.1, 1, 1.1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={pulse ? 0.7 : 0.25} />
      </mesh>
      <mesh ref={topRef} position={[0, 1.15, 0]}>
        <boxGeometry args={[0.55, 0.3, 0.55]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}

function RobotArm({ color, active }) {
  const upperRef = useRef();
  const foreRef = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (upperRef.current) upperRef.current.rotation.y = active ? Math.sin(t * 0.8) * 0.6 : 0;
    if (foreRef.current) foreRef.current.rotation.z = active ? Math.sin(t * 1.3) * 0.4 - 0.3 : -0.2;
  });
  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.32, 0.38, 0.3, 16]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <group ref={upperRef} position={[0, 0.3, 0]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.26, 1, 0.26]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
        </mesh>
        <group ref={foreRef} position={[0, 1, 0]}>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.18, 0.8, 0.18]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Conveyor({ color, active }) {
  const rollerRefs = useRef([]);
  useFrame((_, delta) => {
    if (!active) return;
    rollerRefs.current.forEach(r => { if (r) r.rotation.x += delta * 4; });
  });
  const rollerX = [-0.9, -0.3, 0.3, 0.9];
  return (
    <group>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[2.4, 0.12, 0.6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {rollerX.map((x, i) => (
        <mesh key={i} ref={el => (rollerRefs.current[i] = el)} position={[x, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.7, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function EnvSensor({ color }) {
  const dotRef = useRef();
  useFrame((state) => {
    if (dotRef.current) dotRef.current.material.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
  });
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.8, 8]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh ref={dotRef} position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

function QualityStation({ color }) {
  return (
    <mesh position={[0, 0.4, 0]}>
      <boxGeometry args={[0.9, 0.8, 0.9]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
    </mesh>
  );
}

function MachineShape({ machine }) {
  const active = machine.status === 'running';
  const pulse = ['fault', 'alarm', 'trip', 'tamper'].includes(machine.status);
  switch (machine.type) {
    case 'robot_arm':        return <RobotArm color={machine.color} active={active} />;
    case 'conveyor':         return <Conveyor color={machine.color} active={active} />;
    case 'env_sensor':       return <EnvSensor color={machine.color} />;
    case 'quality_station':  return <QualityStation color={machine.color} />;
    default:                 return <CncMachine color={machine.color} pulse={pulse} />;
  }
}

function SceneGroup({ machines, reducedMotion }) {
  const groupRef = useRef();
  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.05;
  });
  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[15, 10]} />
        <meshStandardMaterial color="#0e1729" />
      </mesh>
      <gridHelper args={[15, 15, '#22345a', '#16233f']} />
      {machines.map(m => (
        <group key={m.id} position={m.pos}>
          <MachineShape machine={m} />
        </group>
      ))}
    </group>
  );
}

export default function FactoryScene3D({ assets = [] }) {
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const sample = assets.slice(0, 6);
  const machines = sample.length
    ? sample.map((a, i) => ({
        id: a.asset_id,
        type: a.asset_type,
        status: a.status,
        color: STATUS_COLOR[a.status] || IDLE_COLOR,
        pos: SLOT_POSITIONS[i],
      }))
    : ['cnc_machine', 'robot_arm', 'conveyor', 'env_sensor', 'quality_station', 'cnc_machine'].map((type, i) => ({
        id: `placeholder-${i}`, type, status: 'idle', color: IDLE_COLOR, pos: SLOT_POSITIONS[i],
      }));

  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [7, 6, 7], fov: 38 }} gl={{ antialias: true }}>
      <color attach="background" args={['#0b1220']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 5]} intensity={0.9} />
      <directionalLight position={[-5, 4, -5]} intensity={0.25} color="#5b9cf5" />
      <SceneGroup machines={machines} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
