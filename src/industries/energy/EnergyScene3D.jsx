// src/industries/energy/EnergyScene3D.jsx
// Lightweight low-poly 3D wind & solar farm — code-split, only loaded when the
// Energy dashboard mounts. Blade rotation speed is driven by the REAL
// asset.rotor_rpm field; solar panel glow is driven by the REAL
// asset.irradiance_wm2 field. No fabricated positions or values.

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

const SLOT_POSITIONS = [
  [-4.5, 0, -1.5], [-1.5, 0, -2.2], [1.5, 0, -1.5],
  [4.5, 0, -2.2], [-3, 0, 1.8], [3, 0, 1.8],
];

function WindTurbine({ rpm = 0 }) {
  const rotorRef = useRef();
  // rpm -> radians/sec, capped so a bad reading can't spin the scene unreadably fast.
  const speed = Math.min(Math.abs(rpm), 40) * (Math.PI * 2 / 60);
  useFrame((_, delta) => {
    if (rotorRef.current) rotorRef.current.rotation.z += speed * delta;
  });
  const isSpinning = rpm > 0.5;
  return (
    <group>
      {/* Tower */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.09, 0.15, 2.2, 10]} />
        <meshStandardMaterial color="#e5e9f0" />
      </mesh>
      {/* Nacelle */}
      <mesh position={[0, 2.25, 0.12]}>
        <boxGeometry args={[0.22, 0.2, 0.5]} />
        <meshStandardMaterial color="#c7ced9" />
      </mesh>
      {/* Rotor hub + 3 blades, spun by real rotor_rpm */}
      <group ref={rotorRef} position={[0, 2.25, 0.4]}>
        <mesh>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color={isSpinning ? '#4ade80' : '#94a3b8'} emissive={isSpinning ? '#4ade80' : '#000000'} emissiveIntensity={0.5} />
        </mesh>
        {[0, 1, 2].map(i => (
          <mesh key={i} position={[0, 0, 0]} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
            <mesh position={[0, 0.65, 0]}>
              <boxGeometry args={[0.07, 1.3, 0.02]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SolarPanel({ irradiance = 0 }) {
  const glowRef = useRef();
  const intensity = Math.max(0.08, Math.min(1, irradiance / 1000));
  useFrame((state) => {
    if (glowRef.current) {
      // Subtle shimmer riding on top of the real irradiance-driven brightness.
      glowRef.current.material.emissiveIntensity = intensity * (0.85 + Math.sin(state.clock.elapsedTime * 2) * 0.15);
    }
  });
  return (
    <group rotation={[-0.5, 0, 0]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.06, 0.9, 0.06]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh ref={glowRef} position={[0, 1.05, 0]}>
        <boxGeometry args={[1.6, 0.9, 0.05]} />
        <meshStandardMaterial color="#1d4ed8" emissive="#3b82f6" emissiveIntensity={intensity} />
      </mesh>
    </group>
  );
}

function ScadaMarker({ color }) {
  const dotRef = useRef();
  useFrame((state) => {
    if (dotRef.current) dotRef.current.material.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
  });
  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.3, 0.9, 0.3]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh ref={dotRef} position={[0, 1, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function AssetShape({ asset }) {
  switch (asset.type) {
    case 'wind_turbine': return <WindTurbine rpm={asset.rotor_rpm ?? 0} />;
    case 'solar_farm':   return <SolarPanel irradiance={asset.irradiance_wm2 ?? 0} />;
    default:             return <ScadaMarker color={asset.color} />;
  }
}

function SceneGroup({ assets, reducedMotion }) {
  const groupRef = useRef();
  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.04;
  });
  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#0e1729" />
      </mesh>
      <gridHelper args={[16, 16, '#1e4620', '#16233f']} />
      {assets.map(a => (
        <group key={a.id} position={a.pos}>
          <AssetShape asset={a} />
        </group>
      ))}
    </group>
  );
}

const STATUS_COLOR = {
  running: '#22c55e', normal: '#22c55e', ok: '#22c55e', healthy: '#22c55e',
  fault: '#ef4444', alarm: '#ef4444', trip: '#ef4444',
  degraded: '#f59e0b',
};

export default function EnergyScene3D({ assets = [] }) {
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const sample = assets.slice(0, 6);
  const scene = sample.length
    ? sample.map((a, i) => ({
        id: a.asset_id,
        type: a.asset_type,
        rotor_rpm: a.rotor_rpm,
        irradiance_wm2: a.irradiance_wm2,
        color: STATUS_COLOR[a.status] || '#475569',
        pos: SLOT_POSITIONS[i],
      }))
    : ['wind_turbine', 'wind_turbine', 'solar_farm', 'solar_farm', 'scada_sensor', 'wind_turbine'].map((type, i) => ({
        id: `placeholder-${i}`, type, rotor_rpm: 0, irradiance_wm2: 0, color: '#475569', pos: SLOT_POSITIONS[i],
      }));

  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [7, 5, 8], fov: 40 }} gl={{ antialias: true }}>
      <color attach="background" args={['#0b1220']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={0.9} />
      <directionalLight position={[-5, 3, -5]} intensity={0.2} color="#4ade80" />
      <SceneGroup assets={scene} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
