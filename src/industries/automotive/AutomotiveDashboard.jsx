// src/industries/automotive/AutomotiveDashboard.jsx
// Live Automotive & Telematics dashboard — vehicles with OBD2, GPS, CAN bus data.

import { useState, useEffect, useRef, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useCondenseWS } from "../../hooks/useCondenseWS.js";
import { INDUSTRIES } from "../../config/industries.js";
import { useWindowSize } from "../../hooks/useWindowSize.js";
import {
  ConnectionStatus,
  KPICard,
  AlertFeed,
  StatusBadge,
  HealthGauge,
  DashboardHeader,
  RefreshButton,
} from "../../components/shared.jsx";

const MAX_HISTORY = 40;

const ASSET_META = {
  vehicle: { icon: "🚙", label: "Vehicle",             primaryKey: "speed_kmh", primaryUnit: "km/h" },
  truck:   { icon: "🚛", label: "Truck",               primaryKey: "speed_kmh", primaryUnit: "km/h" },
  commercial_vehicle: { icon: "🚐", label: "OBD Fleet Vehicle", primaryKey: "veh_spd", primaryUnit: "km/h" },
};

function SpeedBar({ speed = 0, max = 200 }) {
  const pct = Math.min(100, (speed / max) * 100);
  const color = speed > 120 ? "#ef4444" : speed > 80 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ width: "100%", marginTop: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "#64748b",
          marginBottom: 3,
        }}
      >
        <span>Speed</span>
        <span style={{ color, fontFamily: "monospace", fontWeight: 700 }}>
          {Math.round(speed)} km/h
        </span>
      </div>
      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
}

function AssetCard({ asset, selected, onClick }) {
  const meta = ASSET_META[asset.asset_type] || {
    icon: "🚗",
    label: asset.asset_type,
  };
  const health = asset.kpis?.health_score ?? 100;
  return (
    <div
      onClick={onClick}
      style={{
        background: selected
          ? "rgba(245,158,11,0.08)"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${
          selected ? "rgba(245,158,11,0.4)" : "#e2e8f0"
        }`,
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <div>
          <span style={{ fontSize: 16, marginRight: 6 }}>{meta.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
            {asset.asset_id}
          </span>
        </div>
        <StatusBadge status={asset.status} />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1, marginRight: 8 }}>
          <SpeedBar speed={asset.speed_kmh ?? 0} />
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
            {meta.label} ·{" "}
            {asset.dtc_count ? `${asset.dtc_count} DTC` : "No DTCs"}
          </div>
        </div>
        <HealthGauge score={health} size={54} />
      </div>
      {asset.has_alerts && (
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            color: "#f59e0b",
            background: "rgba(245,158,11,0.08)",
            padding: "3px 8px",
            borderRadius: 4,
            display: "inline-block",
          }}
        >
          ⚠ {asset.alert_count} alert{asset.alert_count > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

function VehicleDetail({ asset }) {
  const fields = [
    { label: "Speed", val: asset.speed_kmh, unit: "km/h" },
    { label: "RPM", val: asset.rpm, unit: "RPM" },
    { label: "Engine Temp", val: asset.engine_temp_c, unit: "°C" },
    { label: "Fuel Level", val: asset.fuel_level_pct, unit: "%" },
    { label: "Throttle", val: asset.throttle_pct, unit: "%" },
    { label: "Battery Volt", val: asset.battery_voltage_v, unit: "V" },
    { label: "Odometer", val: asset.odometer_km, unit: "km" },
    { label: "DTC Codes", val: asset.dtc_count ?? 0, unit: "" },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px,1fr))",
        gap: 10,
      }}
    >
      {fields.map((f) => (
        <div
          key={f.label}
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
            {f.label}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#1e293b",
              fontFamily: "monospace",
            }}
          >
            {f.val != null
              ? typeof f.val === "number"
                ? Number(f.val).toFixed(1)
                : String(f.val)
              : "—"}
            {f.unit && (
              <span style={{ fontSize: 11, color: "#475569", marginLeft: 3 }}>
                {f.unit}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── OBD COMMERCIAL VEHICLE COMPONENTS ────────────────────────
// ══════════════════════════════════════════════════════════════

// ── Shared UI helpers ──────────────────────────────────────────
function AlgoTag({ formula }) {
  return (
    <div style={{ fontSize:9, color:'#7c3aed', background:'rgba(124,58,237,0.07)',
      border:'1px solid rgba(124,58,237,0.2)', borderRadius:4,
      padding:'2px 6px', marginTop:3, fontFamily:'monospace', lineHeight:1.4, wordBreak:'break-word' }}>
      {formula}
    </div>
  );
}
function StatusChipCV({ label, level }) {
  const c = { excellent:'#dcfce7:#16a34a', good:'#d1fae5:#059669', average:'#fef3c7:#d97706',
    poor:'#fee2e2:#dc2626', critical:'#fee2e2:#dc2626', overloaded:'#fee2e2:#dc2626',
    heavy:'#fef3c7:#d97706', partial:'#fef9c3:#ca8a04', light:'#dcfce7:#16a34a',
    empty:'#f1f5f9:#64748b', at_capacity:'#fef3c7:#d97706', green:'#dcfce7:#16a34a',
    optimal:'#dcfce7:#16a34a', acceptable:'#fef3c7:#d97706', inefficient:'#fee2e2:#dc2626',
    coaching_needed:'#fee2e2:#dc2626', normal:'#dcfce7:#16a34a',
  }[level] || '#f1f5f9:#64748b';
  const [bg, col] = c.split(':');
  return <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:10,
    background:bg, color:col, textTransform:'uppercase', letterSpacing:'0.05em' }}>
    {label || level}
  </span>;
}
function KpiTileCV({ label, value, unit, color='#1e293b', algoFormula, status, statusLevel, small }) {
  const display = value != null
    ? (typeof value === 'number' ? Number(value).toFixed(1) : String(value)) : '—';
  return (
    <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 12px' }}>
      <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize: small ? 14 : 18, fontWeight:700, color, fontFamily:'monospace', lineHeight:1 }}>
        {display}
        {unit && <span style={{ fontSize:10, color:'#94a3b8', marginLeft:3 }}>{unit}</span>}
      </div>
      {status && <div style={{ marginTop:4 }}><StatusChipCV label={status} level={statusLevel||status} /></div>}
      {algoFormula && <AlgoTag formula={algoFormula} />}
    </div>
  );
}

// ── Live Fleet Map — Fixed Hyderabad Metro viewport ───────────
// Fixed bounding box so the map always shows Greater Hyderabad in full context.
// Vehicles are plotted on top. India inset (bottom-right) shows state context.
function FleetMap({ vehicles, selectedId, onSelect, posHistory }) {
  const W = 700, H = 380;
  const PAD = 28;

  // ── FIXED viewport: Greater Hyderabad Metropolitan Area ──────
  // This never auto-zooms — user always sees the full city context.
  const MIN_LAT = 16.82, MAX_LAT = 17.68;
  const MIN_LON = 78.12, MAX_LON = 78.82;

  const toX = lon => PAD + ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * (W - 2 * PAD);
  const toY = lat => H - PAD - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * (H - 2 * PAD);

  const speedColor = spd => {
    if (spd < 1)   return '#94a3b8';
    if (spd <= 40) return '#22c55e';
    if (spd <= 60) return '#f59e0b';
    if (spd <= 80) return '#3b82f6';
    return '#ef4444';
  };

  // ── Key Hyderabad area landmarks ──────────────────────────────
  // Each: [lat, lon, label, labelOffset, type]
  const LANDMARKS = [
    [17.385, 78.486, 'Hyderabad',       [4,  12], 'city'],
    [17.445, 78.500, 'Secunderabad',    [4,  12], 'district'],
    [17.240, 78.430, '✈ Airport',       [4,  12], 'airport'],
    [17.470, 78.410, 'Balanagar Ind.',  [4, -5],  'industrial'],
    [17.395, 78.563, 'Uppal / ECIL',    [4,  12], 'district'],
    [17.450, 78.368, 'Patancheru',      [-55, 8], 'industrial'],
    [17.340, 78.548, 'LB Nagar',        [4,  12], 'district'],
    [17.375, 78.375, 'HITEC City',      [-58, 8], 'district'],
    [17.580, 78.475, 'Medchal',         [4,  12], 'district'],
    [17.495, 78.495, 'Kompally',        [4, -5],  'district'],
    [17.505, 78.568, 'Ghatkesar',       [4,  12], 'district'],
    [17.298, 78.505, 'Hayathnagar',     [4,  12], 'district'],
  ];

  const LANDMARK_COLORS = {
    city      : { dot:'#dc2626', text:'#991b1b', r:5, fw:700 },
    district  : { dot:'#6b7280', text:'#374151', r:3, fw:500 },
    airport   : { dot:'#1d4ed8', text:'#1e40af', r:4, fw:600 },
    industrial: { dot:'#92400e', text:'#78350f', r:3, fw:500 },
  };

  // ── Delivery route corridors ──────────────────────────────────
  // Approximate polylines matching the simulator's 5 route corridors.
  // Drawn as faint dashed lines so users can see where deliveries run.
  const ROUTE_CORRIDORS = [
    { color:'#6366f1', name:'Balanagar–Mehdipatnam', pts:[[17.467,78.425],[17.400,78.432],[17.330,78.435],[17.250,78.445],[17.120,78.460],[17.040,78.480]] },
    { color:'#0891b2', name:'Uppal–Yousufguda',      pts:[[17.400,78.560],[17.395,78.510],[17.390,78.470],[17.385,78.430],[17.380,78.400]] },
    { color:'#059669', name:'Shamshabad–Secunderabad',pts:[[17.240,78.430],[17.300,78.455],[17.360,78.490],[17.420,78.500],[17.480,78.500]] },
    { color:'#d97706', name:'ORR North-West Arc',     pts:[[17.540,78.380],[17.520,78.340],[17.490,78.310],[17.450,78.290],[17.410,78.295],[17.370,78.320]] },
    { color:'#7c3aed', name:'Jeedimetla–LB Nagar',   pts:[[17.500,78.490],[17.430,78.500],[17.360,78.510],[17.290,78.520],[17.210,78.540]] },
  ];

  // ── India context inset (bottom-right, 90×108px) ──────────────
  // Shows simplified India outline with Telangana highlighted and
  // a star marker for Hyderabad — so the viewer immediately knows
  // which state and part of India this fleet is operating in.
  const IX = W - 104, IY = H - 122;  // inset top-left position in main SVG
  const IW = 92, IH = 110;           // inset dimensions

  // Lat/lon → inset SVG coords
  // India spans roughly lat 8–37, lon 68–97
  const toIX = lon => 2 + ((lon - 68) / 29) * (IW - 4);
  const toIY = lat => (IH - 4) - ((lat - 8) / 29) * (IH - 4);

  // Simplified India outline polygon (approximate coastal/border points)
  const INDIA_PTS = [
    [68.7,37.1],[74.0,37.0],[78.3,36.7],[80.5,35.5],[97.4,28.3],
    [97.3,27.3],[92.6,22.1],[91.4,24.0],[88.4,21.5],[86.0,20.0],
    [80.3,13.1],[79.9,10.8],[77.5,8.1],[76.3,8.6],[73.0,8.2],
    [72.6,20.4],[72.4,23.5],[68.7,37.1],
  ].map(([lon,lat]) => `${toIX(lon)},${toIY(lat)}`).join(' ');

  // Simplified Telangana state boundary (approximate)
  const TELANGANA_PTS = [
    [77.2,19.9],[78.6,19.9],[80.4,19.4],[80.7,17.2],
    [79.5,16.0],[78.3,16.0],[77.0,16.5],[77.0,18.5],[77.2,19.9],
  ].map(([lon,lat]) => `${toIX(lon)},${toIY(lat)}`).join(' ');

  // Hyderabad star position on inset
  const hydIX = toIX(78.47);
  const hydIY = toIY(17.38);

  // ── Scale bar (approximate) ───────────────────────────────────
  // At this viewport width (0.70° lon ≈ 68km), 0.1° lon ≈ 9.7km
  const scaleKm = 10;
  const scalePxPerKm = ((W - 2*PAD) / (MAX_LON - MIN_LON)) * (0.01023);  // 0.01023° per km at 17°N
  const scalePx = Math.round(scaleKm * scalePxPerKm);

  return (
    <div style={{ position:'relative', userSelect:'none' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ borderRadius:10, border:'1px solid #d1d5db', cursor:'default', display:'block' }}>

        {/* ── Map background ── */}
        {/* Land fill (pale green-beige like OSM) */}
        <rect x={0} y={0} width={W} height={H} fill="#F0EDE5" rx={8} />

        {/* Subtle lat/lon grid */}
        {[0,1,2,3,4].map(i => {
          const lat = MIN_LAT + i * (MAX_LAT - MIN_LAT) / 4;
          const lon = MIN_LON + i * (MAX_LON - MIN_LON) / 4;
          return (
            <g key={i}>
              <line x1={PAD} x2={W-PAD} y1={toY(lat)} y2={toY(lat)} stroke="#D4CFC5" strokeWidth="0.6" strokeDasharray="3 6" />
              <line x1={toX(lon)} x2={toX(lon)} y1={PAD} y2={H-PAD} stroke="#D4CFC5" strokeWidth="0.6" strokeDasharray="3 6" />
              <text x={4} y={toY(lat)+3} fontSize={7} fill="#9ca3af" fontFamily="monospace">{lat.toFixed(2)}°</text>
              <text x={toX(lon)-10} y={H-4} fontSize={7} fill="#9ca3af" fontFamily="monospace">{lon.toFixed(2)}°</text>
            </g>
          );
        })}

        {/* ── Delivery route corridors ── */}
        {ROUTE_CORRIDORS.map(route => {
          const pts = route.pts.map(([lat, lon]) => `${toX(lon)},${toY(lat)}`).join(' ');
          return (
            <g key={route.name}>
              {/* Road shadow */}
              <polyline points={pts} fill="none" stroke="#ffffff" strokeWidth="4" strokeOpacity="0.5"
                strokeLinecap="round" strokeLinejoin="round" />
              {/* Road itself */}
              <polyline points={pts} fill="none" stroke={route.color} strokeWidth="2"
                strokeOpacity="0.45" strokeDasharray="6 4"
                strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}

        {/* ── Landmark dots and labels ── */}
        {LANDMARKS.map(([lat, lon, label, [dx, dy], type]) => {
          const lx = toX(lon), ly = toY(lat);
          const s = LANDMARK_COLORS[type] || LANDMARK_COLORS.district;
          return (
            <g key={label}>
              <circle cx={lx} cy={ly} r={s.r} fill={s.dot} opacity="0.7" />
              <text x={lx + dx} y={ly + dy} fontSize={type === 'city' ? 10 : 8}
                fontWeight={s.fw} fill={s.text} fontFamily="system-ui"
                style={{ pointerEvents:'none' }}>
                {label}
              </text>
            </g>
          );
        })}

        {/* ── Vehicle trails ── */}
        {vehicles.map(v => {
          const trail = posHistory.current[v.asset_id] || [];
          if (trail.length < 2) return null;
          const pts = trail.map(p => `${toX(p.lon)},${toY(p.lat)}`).join(' ');
          return <polyline key={`trail-${v.asset_id}`} points={pts}
            fill="none" stroke={speedColor(v.veh_spd || 0)} strokeWidth="2" strokeOpacity="0.35"
            strokeLinecap="round" strokeLinejoin="round" />;
        })}

        {/* ── Vehicle dots ── */}
        {vehicles.map(v => {
          if (!v.latitude || !v.longitude) return null;
          const vx = toX(v.longitude), vy = toY(v.latitude);
          const spd = v.veh_spd || 0;
          const col = speedColor(spd);
          const isSel = v.asset_id === selectedId;
          const r = isSel ? 10 : 7;
          const isOff = spd < 1;
          return (
            <g key={v.asset_id}
              onClick={() => onSelect(v.asset_id === selectedId ? null : v.asset_id)}
              style={{ cursor:'pointer' }}>
              {/* Overspeed pulse */}
              {spd > 80 && (
                <circle cx={vx} cy={vy} r={r+4} fill="none" stroke="#ef4444" strokeWidth="1.5">
                  <animate attributeName="r" values={`${r+3};${r+10};${r+3}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Idle dimming */}
              {isOff && <circle cx={vx} cy={vy} r={r+2} fill="#94a3b8" opacity="0.15" />}
              {/* Selection ring */}
              {isSel && <circle cx={vx} cy={vy} r={r+5} fill="none" stroke="#1d4ed8" strokeWidth="2.5" />}
              {/* White halo for readability */}
              <circle cx={vx} cy={vy} r={r+1.5} fill="white" opacity="0.7" />
              {/* Vehicle body */}
              <circle cx={vx} cy={vy} r={r} fill={col} stroke="#ffffff" strokeWidth={isSel?2:1.5} />
              {/* Direction arrow (only when moving) */}
              {spd > 2 && <polygon points={`${vx},${vy-r-4} ${vx-3},${vy-r+1} ${vx+3},${vy-r+1}`} fill={col} />}
              {/* ID label */}
              <text x={vx + r + 4} y={vy + 4}
                fontSize={isSel ? 10 : 8} fontWeight={isSel ? 700 : 500}
                fill={isSel ? '#1d4ed8' : '#374151'} fontFamily="system-ui"
                style={{ pointerEvents:'none' }}>
                {v.asset_id}
              </text>
              {/* Speed tooltip on selected */}
              {isSel && spd > 0 && (
                <text x={vx + r + 4} y={vy + 16} fontSize={8} fill="#64748b" fontFamily="monospace">
                  {spd.toFixed(0)} km/h
                </text>
              )}
            </g>
          );
        })}

        {/* ── Speed legend (bottom-left) ── */}
        <rect x={PAD} y={H-PAD-90} width={86} height={86} rx={6}
          fill="white" fillOpacity="0.88" stroke="#e2e8f0" strokeWidth="1" />
        <text x={PAD+6} y={H-PAD-78} fontSize={8} fontWeight={700} fill="#374151" fontFamily="system-ui">
          SPEED
        </text>
        {[
          { col:'#94a3b8', label:'Idle (engine on)' },
          { col:'#22c55e', label:'Urban  0–40 km/h' },
          { col:'#f59e0b', label:'Arterial  40–60' },
          { col:'#3b82f6', label:'Highway  60–80' },
          { col:'#ef4444', label:'Overspeed  >80 ⚠' },
        ].map((item, i) => (
          <g key={item.col}>
            <circle cx={PAD+10} cy={H-PAD-63 + i*14} r={4} fill={item.col} />
            <text x={PAD+18} y={H-PAD-59 + i*14} fontSize={8} fill="#374151" fontFamily="system-ui">
              {item.label}
            </text>
          </g>
        ))}

        {/* ── Route corridor legend (top-left) ── */}
        <rect x={PAD} y={PAD} width={130} height={78} rx={6}
          fill="white" fillOpacity="0.88" stroke="#e2e8f0" strokeWidth="1" />
        <text x={PAD+6} y={PAD+13} fontSize={8} fontWeight={700} fill="#374151" fontFamily="system-ui">
          DELIVERY CORRIDORS
        </text>
        {ROUTE_CORRIDORS.map((r, i) => (
          <g key={r.name}>
            <line x1={PAD+6} y1={PAD+22+i*11} x2={PAD+18} y2={PAD+22+i*11}
              stroke={r.color} strokeWidth="2" strokeDasharray="4 2" />
            <text x={PAD+22} y={PAD+26+i*11} fontSize={7.5} fill="#374151" fontFamily="system-ui">
              {r.name}
            </text>
          </g>
        ))}

        {/* ── Scale bar ── */}
        <g transform={`translate(${W/2 - 40}, ${H - 16})`}>
          <line x1={0} y1={0} x2={scalePx} y2={0} stroke="#6b7280" strokeWidth="2" />
          <line x1={0} y1={-4} x2={0} y2={4} stroke="#6b7280" strokeWidth="1.5" />
          <line x1={scalePx} y1={-4} x2={scalePx} y2={4} stroke="#6b7280" strokeWidth="1.5" />
          <text x={scalePx/2} y={-5} textAnchor="middle" fontSize={8} fill="#6b7280" fontFamily="system-ui">
            ~{scaleKm} km
          </text>
        </g>

        {/* ── North arrow ── */}
        <g transform={`translate(${W - PAD - 16}, ${PAD + 12})`}>
          <polygon points="0,-10 -5,4 0,1 5,4" fill="#374151" />
          <text x={0} y={17} textAnchor="middle" fontSize={9} fontWeight={700} fill="#374151" fontFamily="system-ui">N</text>
        </g>

        {/* ══ INDIA CONTEXT INSET (bottom-right) ══════════════════ */}
        {/* Shows which state + which part of India */}
        <rect x={IX-4} y={IY-4} width={IW+8} height={IH+8} rx={8}
          fill="white" fillOpacity="0.93" stroke="#cbd5e1" strokeWidth="1.5" />
        <text x={IX + IW/2} y={IY-8} textAnchor="middle" fontSize={8} fontWeight={700}
          fill="#374151" fontFamily="system-ui">INDIA</text>

        {/* India outline */}
        <polygon points={INDIA_PTS} fill="#e8f5e9" stroke="#9ca3af" strokeWidth="0.8" />

        {/* Telangana state highlighted */}
        <polygon points={TELANGANA_PTS} fill="#fbbf24" fillOpacity="0.6" stroke="#d97706" strokeWidth="0.8" />

        {/* Hyderabad star marker */}
        <text x={IX + hydIX} y={IY + hydIY + 1} textAnchor="middle" fontSize={9} fill="#dc2626">★</text>
        <text x={IX + hydIX + 6} y={IY + hydIY - 3} fontSize={6.5} fill="#991b1b" fontWeight={700} fontFamily="system-ui">
          Hyd
        </text>

        {/* TS state label */}
        <text x={IX + toIX(79.1)} y={IY + toIY(18.0)} textAnchor="middle"
          fontSize={7} fontWeight={600} fill="#92400e" fontFamily="system-ui">TS</text>

        {/* Inset label */}
        <text x={IX + IW/2} y={IY + IH + 10} textAnchor="middle"
          fontSize={7} fill="#64748b" fontFamily="system-ui">Telangana State</text>
      </svg>

      {/* Map footer bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        marginTop:6, fontSize:10, color:'#64748b' }}>
        <span>
          🚐 <strong>{vehicles.filter(v => v.latitude).length}</strong> vehicles with GPS ·{' '}
          <strong style={{ color:'#22c55e' }}>{vehicles.filter(v => (v.veh_spd||0) > 1).length}</strong> moving ·{' '}
          <strong style={{ color:'#94a3b8' }}>{vehicles.filter(v => (v.veh_spd||0) < 1).length}</strong> idle
        </span>
        <span style={{ color:'#94a3b8' }}>Greater Hyderabad Metropolitan Area · Telangana, India</span>
      </div>
    </div>
  );
}

// ── Commercial Vehicle Card ───────────────────────────────────
function CommercialVehicleCard({ asset, selected, onClick }) {
  const k = asset.kpis || {};
  const spd = asset.veh_spd || 0;
  const spdColor = spd > 80 ? '#ef4444' : spd > 60 ? '#3b82f6' : spd > 0 ? '#22c55e' : '#94a3b8';
  const loadColor = k.load_classification === 'overloaded' ? '#dc2626'
    : k.load_classification === 'heavy' ? '#d97706'
    : k.load_classification === 'partial' ? '#f59e0b' : '#16a34a';
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(59,130,246,0.06)' : '#ffffff',
      border: `1px solid ${selected ? 'rgba(59,130,246,0.4)' : '#e2e8f0'}`,
      borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all 0.15s',
    }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div>
          <span style={{ fontSize:15, marginRight:5 }}>🚐</span>
          <span style={{ fontSize:12, fontWeight:700, color:'#1e293b' }}>{asset.asset_id}</span>
          {asset.registration_no && (
            <span style={{ fontSize:9, color:'#64748b', marginLeft:6, fontFamily:'monospace' }}>{asset.registration_no}</span>
          )}
        </div>
        <StatusBadge status={asset.status} />
      </div>

      {/* Speed + RPM row */}
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <div style={{ flex:1, background:'#f8fafc', borderRadius:6, padding:'5px 8px', textAlign:'center' }}>
          <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase' }}>Speed</div>
          <div style={{ fontSize:16, fontWeight:800, color:spdColor, fontFamily:'monospace' }}>
            {spd.toFixed(0)}<span style={{ fontSize:9, color:'#94a3b8' }}> km/h</span>
          </div>
        </div>
        <div style={{ flex:1, background:'#f8fafc', borderRadius:6, padding:'5px 8px', textAlign:'center' }}>
          <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase' }}>RPM</div>
          <div style={{ fontSize:16, fontWeight:800, color:'#475569', fontFamily:'monospace' }}>
            {asset.eng_spd ? Math.round(asset.eng_spd) : '—'}<span style={{ fontSize:9, color:'#94a3b8' }}> rpm</span>
          </div>
        </div>
        <div style={{ flex:1, background:'#f8fafc', borderRadius:6, padding:'5px 8px', textAlign:'center' }}>
          <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase' }}>Fuel</div>
          <div style={{ fontSize:16, fontWeight:800, color:'#7c3aed', fontFamily:'monospace' }}>
            {asset.eng_fuel_rate ? asset.eng_fuel_rate.toFixed(2) : '—'}<span style={{ fontSize:9, color:'#94a3b8' }}> L/h</span>
          </div>
        </div>
      </div>

      {/* Load + Driver score mini row */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {k.load_classification && (
          <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:10,
            background:loadColor+'18', color:loadColor, textTransform:'uppercase' }}>
            ⚖ {k.load_classification}
          </span>
        )}
        {k.driver_score != null && (
          <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:10,
            background: k.driver_score >= 80 ? '#dcfce7' : k.driver_score >= 60 ? '#fef3c7' : '#fee2e2',
            color: k.driver_score >= 80 ? '#16a34a' : k.driver_score >= 60 ? '#d97706' : '#dc2626',
          }}>
            👤 {k.driver_score}/100
          </span>
        )}
        {(k.harsh_brakes_session > 0 || k.harsh_brakes_this_batch > 0) && (
          <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:10,
            background:'#fee2e2', color:'#dc2626' }}>
            ⚠ {k.harsh_brakes_session || k.harsh_brakes_this_batch} brakes
          </span>
        )}
      </div>

      {/* Route */}
      {asset.route_name && (
        <div style={{ fontSize:9, color:'#94a3b8', marginTop:6 }}>📍 {asset.route_name}</div>
      )}
    </div>
  );
}

// ── Commercial Vehicle Detail Panel ──────────────────────────
// Shows VLD + Driver Analytics KPIs with algorithm explanations
function CommercialVehicleDetail({ asset }) {
  const k = asset.kpis || {};

  // Which transforms have contributed to this vehicle's record so far?
  const sources         = asset.sources || [];
  const vldArrived      = sources.includes('vld_transform')             || k.rsli != null;
  const driverArrived   = sources.includes('driver_analytics_transform')|| k.driver_score != null;
  const bothArrived     = vldArrived && driverArrived;

  // Always render BOTH sections. If a transform hasn't published yet,
  // its tiles show "—" (waiting state) instead of being hidden entirely.
  // This prevents the UI from jumping/flickering as transforms arrive at
  // slightly different times from the same OBD batch.

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Live OBD Telemetry ── */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
          letterSpacing:'0.08em', marginBottom:8 }}>📡 Live OBD Telemetry</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px,1fr))', gap:8 }}>
          <KpiTileCV label="Vehicle Speed"     value={asset.veh_spd}       unit="km/h"
            color={asset.veh_spd > 80 ? '#dc2626' : asset.veh_spd > 0 ? '#22c55e' : '#94a3b8'} />
          <KpiTileCV label="Engine Speed"      value={asset.eng_spd}       unit="RPM"
            color={asset.eng_spd > 2800 ? '#dc2626' : '#475569'} />
          <KpiTileCV label="Fuel Rate"         value={asset.eng_fuel_rate} unit="L/h"  color="#7c3aed" />
          <KpiTileCV label="Latitude"          value={asset.latitude}      unit="°N"   color="#475569" />
          <KpiTileCV label="Longitude"         value={asset.longitude}     unit="°E"   color="#475569" />
          <KpiTileCV label="Route"             value={asset.route_name}                color="#475569" />
          <KpiTileCV label="Reg. No."          value={asset.registration_no}           color="#475569" />
          <KpiTileCV label="Trip Distance"     value={asset.trip_odometer_km} unit="km" color="#06b6d4" />
        </div>
      </div>

      {/* ── VLD Algorithms ── always rendered, shows "—" while waiting for first VLD batch */}
      <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              ⚖️ Vehicle Load Detection (VLD) Model
            </div>
            {!vldArrived && (
              <span style={{ fontSize:9, color:'#94a3b8', background:'#f1f5f9', padding:'2px 8px',
                borderRadius:10, fontFamily:'monospace' }}>⏳ waiting for VLD transform…</span>
            )}
            {vldArrived && (
              <span style={{ fontSize:9, color:'#16a34a', background:'#dcfce7', padding:'2px 8px', borderRadius:10 }}>✓ live</span>
            )}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
            <KpiTileCV label="Vehicle Load Score"
              value={k.vehicle_load_score} unit="/100"
              color={k.vehicle_load_score > 75 ? '#dc2626' : k.vehicle_load_score > 50 ? '#d97706' : '#16a34a'}
              status={k.load_classification} statusLevel={k.load_classification} />
            <KpiTileCV label="RSLI (RPM-Speed)"
              value={k.rsli} unit="%"
              color={k.rsli > 175 ? '#dc2626' : k.rsli > 145 ? '#d97706' : '#16a34a'}
              status={k.rsli_status} statusLevel={k.rsli_status === 'overloaded' ? 'critical' : k.rsli_status === 'heavy' ? 'average' : 'good'} />
            <KpiTileCV label="FRLF (Fuel-Rate)"
              value={k.frlf} unit="%"
              color={k.frlf > 175 ? '#dc2626' : k.frlf > 145 ? '#d97706' : '#16a34a'}
              status={k.frlf_status} statusLevel={k.frlf_status === 'overloaded' ? 'critical' : k.frlf_status === 'heavy' ? 'average' : 'good'} />
            <KpiTileCV label="GVW Estimate"
              value={k.gvw_estimate_kg} unit="kg"
              color="#8b5cf6" />
            <KpiTileCV label="Payload Est."
              value={k.payload_estimate_kg} unit="kg"
              color="#7c3aed" />
            <KpiTileCV label="Load %"
              value={k.load_pct_estimate} unit="%"
              color={k.load_pct_estimate > 90 ? '#dc2626' : '#475569'} />
            <KpiTileCV label="Engine Combustion"
              value={k.engine_combustion_load} unit="/100"
              color={k.ecls_status === 'optimal' ? '#16a34a' : k.ecls_status === 'acceptable' ? '#d97706' : '#dc2626'}
              status={k.ecls_status} statusLevel={k.ecls_status === 'optimal' ? 'optimal' : 'acceptable'} />
            <KpiTileCV label="Traction Power"
              value={k.traction_power_index} unit="%"
              color="#06b6d4" />
          </div>
          {k.persistent_overload && (
            <div style={{ marginTop:8, padding:'8px 12px', background:'#fee2e2', border:'1px solid #fca5a5',
              borderRadius:8, fontSize:11, color:'#dc2626', fontWeight:600 }}>
              🚨 Persistent Overload — {k.overload_streak} consecutive batches. Requires immediate inspection.
            </div>
          )}
      </div>

      {/* ── Driver Analytics ── always rendered, shows "—" while waiting for first Driver batch */}
      <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              👤 Driver Analytics Model
            </div>
            {!driverArrived && (
              <span style={{ fontSize:9, color:'#94a3b8', background:'#f1f5f9', padding:'2px 8px',
                borderRadius:10, fontFamily:'monospace' }}>⏳ waiting for Driver Analytics transform…</span>
            )}
            {driverArrived && (
              <span style={{ fontSize:9, color:'#16a34a', background:'#dcfce7', padding:'2px 8px', borderRadius:10 }}>✓ live</span>
            )}
          </div>

          {/* Driver score hero */}
          <div style={{ display:'flex', gap:10, marginBottom:10 }}>
            {[
              { label:'Driver Score', val:k.driver_score, unit:'/100',
                color: k.driver_score >= 85 ? '#16a34a' : k.driver_score >= 65 ? '#d97706' : '#dc2626' },
              { label:'Green Driving (GDI)', val:k.green_driving_index, unit:'/100',
                color: k.gdi_rating === 'green' ? '#16a34a' : k.gdi_rating === 'average' ? '#d97706' : '#dc2626' },
              { label:'Fuel Efficiency', val:k.fuel_efficiency_rolling_kmpl, unit:'km/L',
                color: (k.fuel_efficiency_rolling_kmpl||0) >= 8 ? '#16a34a' : (k.fuel_efficiency_rolling_kmpl||0) >= 5 ? '#d97706' : '#dc2626' },
            ].map(item => (
              <div key={item.label} style={{ flex:1, background:'#f8fafc', border:'1px solid #e2e8f0',
                borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{item.label}</div>
                <div style={{ fontSize:22, fontWeight:800, color:item.color, fontFamily:'monospace', lineHeight:1 }}>
                  {item.val != null ? Number(item.val).toFixed(1) : '—'}
                  {item.unit && <span style={{ fontSize:10, color:'#94a3b8', marginLeft:2 }}>{item.unit}</span>}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
            <KpiTileCV label="Harsh Brakes (session)"
              value={k.harsh_brakes_session} unit="events"
              color={k.harsh_brakes_session > 3 ? '#dc2626' : k.harsh_brakes_session > 0 ? '#d97706' : '#16a34a'} />
            <KpiTileCV label="Harsh Accel (session)"
              value={k.harsh_acc_session} unit="events"
              color={k.harsh_acc_session > 3 ? '#dc2626' : k.harsh_acc_session > 0 ? '#d97706' : '#16a34a'} />
            <KpiTileCV label="Over-Rev Count"
              value={k.over_rev_session}
              color={k.over_rev_session > 5 ? '#dc2626' : '#475569'} />
            <KpiTileCV label="Idle Time"
              value={k.idle_time_session_min} unit="min"
              color={k.idle_time_session_min > 15 ? '#d97706' : '#475569'} />
            <KpiTileCV label="Idle Fuel Wasted"
              value={k.idle_fuel_wasted_L} unit="L"
              color={k.idle_fuel_wasted_L > 1 ? '#d97706' : '#16a34a'} />
            <KpiTileCV label="Idle Fuel Cost"
              value={k.idle_cost_inr} unit="₹"
              color="#ef4444" />
            <KpiTileCV label="RPM Optimisation"
              value={k.rpm_optimisation_pct} unit="%"
              color={k.rpm_optimisation_pct >= 75 ? '#16a34a' : k.rpm_optimisation_pct >= 55 ? '#d97706' : '#dc2626'} />
            <KpiTileCV label="Session FE"
              value={k.fuel_efficiency_session_kmpl} unit="km/L"
              color={k.fe_rating === 'excellent' ? '#16a34a' : k.fe_rating === 'good' ? '#059669' : k.fe_rating === 'average' ? '#d97706' : '#dc2626'}
              status={k.fe_rating} statusLevel={k.fe_rating === 'excellent' ? 'excellent' : k.fe_rating === 'good' ? 'good' : 'average'} />
          </div>

          {/* Speed profile mini breakdown */}
          {k.speed_profile && (
            <div style={{ marginTop:10, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px' }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                Speed Band Distribution (session)
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[
                  { label:'Idle',      val:k.speed_profile.idle_pct,       color:'#94a3b8' },
                  { label:'Urban',     val:k.speed_profile.urban_pct,      color:'#22c55e' },
                  { label:'Arterial',  val:k.speed_profile.arterial_pct,   color:'#f59e0b' },
                  { label:'Highway',   val:k.speed_profile.highway_pct,    color:'#3b82f6' },
                  { label:'Overspeed', val:k.speed_profile.overspeed_pct,  color:'#ef4444' },
                ].map(band => (
                  <div key={band.label} style={{ textAlign:'center', minWidth:56 }}>
                    <div style={{ height:4, background:'#e2e8f0', borderRadius:2, marginBottom:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.min(100, band.val||0)}%`,
                        background:band.color, borderRadius:2, transition:'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, color:band.color, fontFamily:'monospace' }}>
                      {(band.val||0).toFixed(0)}%
                    </div>
                    <div style={{ fontSize:8, color:'#94a3b8' }}>{band.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:9, color:'#94a3b8', marginTop:6, fontFamily:'monospace' }}>
                GDI formula: FE×0.35 + RPM_opt×0.25 + smooth×0.25 + idle_ctrl×0.15
              </div>
            </div>
          )}
      </div>

      {/* Both-arrived confirmation banner — sibling to VLD + Driver sections */}
      {bothArrived && (
        <div style={{ padding:'6px 12px', background:'#f0fdf4', border:'1px solid #bbf7d0',
          borderRadius:8, fontSize:10, color:'#16a34a', display:'flex', alignItems:'center', gap:6 }}>
          <span>✅</span>
          <span>Both <strong>VLD</strong> + <strong>Driver Analytics</strong> data merged and live. All KPIs active.</span>
        </div>
      )}
    </div>
  );
}

export default function AutomotiveDashboard() {
  const industry = INDUSTRIES.automotive;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);
  const { isMobile, isTablet, isTV } = useWindowSize();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('obd_fleet'); // 'telematics' | 'obd_fleet'
  const prevRef = useRef({});
  // Position history for map trails: {vehicle_id: [{lat, lon}, ...]}
  const posHistory = useRef({});

  const assetList = Object.values(assets);
  const selectedObj = selectedAsset ? assets[selectedAsset] : null;

  useEffect(() => {
    if (assetList.length === 0) return;
    const hasChanged = assetList.some(
      (a) => prevRef.current[a.asset_id]?.processed_at !== a.processed_at
    );
    if (!hasChanged) return;
    prevRef.current = assets;

    const active = assetList.filter((a) => a.ignition_on || a.speed_kmh > 0);
    const avgSpeed = active.length
      ? (
          active.reduce((s, a) => s + (a.speed_kmh ?? 0), 0) / active.length
        ).toFixed(1)
      : 0;
    const avgTemp = assetList.length
      ? (
          assetList.reduce((s, a) => s + (a.engine_temp_c ?? 0), 0) /
          assetList.length
        ).toFixed(1)
      : 0;
    const time = new Date().toLocaleTimeString("en", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setHistory((prev) =>
      [
        ...prev,
        { time, avgSpeed: Number(avgSpeed), avgTemp: Number(avgTemp) },
      ].slice(-MAX_HISTORY)
    );
  }, [assets]);

  // ── Commercial vehicle position tracking ─────────────────────
  useEffect(() => {
    const cvs = assetList.filter(a => a.asset_type === 'commercial_vehicle');
    cvs.forEach(v => {
      if (v.latitude && v.longitude) {
        const trail = posHistory.current[v.asset_id] || [];
        const last = trail[trail.length - 1];
        if (!last || last.lat !== v.latitude || last.lon !== v.longitude) {
          trail.push({ lat: v.latitude, lon: v.longitude });
          if (trail.length > 8) trail.shift();
          posHistory.current[v.asset_id] = trail;
        }
      }
    });
  }, [assets]);

  // ── Existing telematics fleet ─────────────────────────────────
  const telematics = assetList.filter(a => a.asset_type !== 'commercial_vehicle');
  const cvFleet    = assetList.filter(a => a.asset_type === 'commercial_vehicle');

  const active = telematics.filter(
    (a) => a.ignition_on || a.speed_kmh > 0
  ).length;
  const avgSpeed = telematics.length
    ? Math.round(telematics.reduce((s, a) => s + (a.speed_kmh ?? 0), 0) / telematics.length)
    : 0;
  const totalDTCs = telematics.reduce((s, a) => s + (a.dtc_count ?? 0), 0);
  const critAlerts = alerts.filter((a) => a.severity === "critical").length;

  // ── OBD Fleet KPIs ────────────────────────────────────────────
  const cvMoving = cvFleet.filter(v => (v.veh_spd || 0) > 1).length;
  const cvAvgSpeed = cvFleet.length ? Math.round(cvFleet.reduce((s, v) => s + (v.veh_spd || 0), 0) / cvFleet.length) : 0;
  const cvOverloaded = cvFleet.filter(v => v.kpis?.load_classification === 'overloaded' || v.kpis?.persistent_overload).length;
  const cvAvgDriverScore = (() => {
    const scores = cvFleet.filter(v => v.kpis?.driver_score != null).map(v => v.kpis.driver_score);
    return scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
  })();
  const cvTotalHarshEvents = cvFleet.reduce((s, v) => s + (v.kpis?.harsh_brakes_this_batch || 0) + (v.kpis?.harsh_acc_this_batch || 0), 0);
  const cvAvgFE = (() => {
    const vals = cvFleet.filter(v => v.kpis?.fuel_efficiency_rolling_kmpl != null).map(v => v.kpis.fuel_efficiency_rolling_kmpl);
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null;
  })();
  const cvOverspeed = cvFleet.filter(v => (v.veh_spd || 0) > 80).length;
  const cvIdleFuelWaste = cvFleet.reduce((s, v) => s + (v.kpis?.idle_fuel_wasted_L || 0), 0).toFixed(2);
  const cvTotalIdleCost = cvFleet.reduce((s, v) => s + (v.kpis?.idle_cost_inr || 0), 0).toFixed(0);


  // ── Not configured guard ─────────────────────────────────────────────────────
  if (!industry.apiUrl) {
    return (
      <>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', minHeight:'70vh', gap:16, background:'#f8fafc',
        fontFamily:'system-ui,sans-serif', padding:40 }}>
        {/* Pulsing signal icon */}
        <div style={{ position:'relative', width:72, height:72 }}>
          <div style={{
            position:'absolute', inset:0, borderRadius:'50%',
            background:'rgba(37,125,240,0.08)',
            animation:'ping 2s cubic-bezier(0,0,0.2,1) infinite',
          }}/>
          <div style={{
            position:'relative', width:72, height:72, borderRadius:'50%',
            background:'rgba(37,125,240,0.12)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 12h2M19 12h2M12 3v2M12 19v2" stroke="#257df0" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="3" fill="#257df0" opacity="0.7"/>
              <path d="M5.6 5.6l1.4 1.4M16.9 16.9l1.4 1.4M5.6 18.4l1.4-1.4M16.9 7.1l1.4-1.4"
                stroke="#257df0" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
            </svg>
          </div>
        </div>

        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:17, fontWeight:700, color:'#1e293b', marginBottom:6 }}>
            No Live Data Available
          </div>
          <div style={{ fontSize:13, color:'#94a3b8', maxWidth:280, lineHeight:1.6 }}>
            This pipeline isn't connected yet. Deploy the simulator and processor on Condense to start seeing real-time data.
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#cbd5e1', display:'inline-block' }}/>
          <span style={{ fontSize:12, color:'#94a3b8' }}>Waiting for connection</span>
        </div>
      </div>
      <style>{`@keyframes ping { 75%,100% { transform:scale(2); opacity:0; } }`}</style>
      </>
    );
  }
  return (
    <div
      style={{
        padding: isMobile ? "12px 14px" : isTV ? "32px 40px" : "24px 28px",
        minHeight: "100vh",
        background: "#f1f5f9",
        color: "#1e293b",
        fontFamily: "system-ui,sans-serif",
      }}
    >
      <DashboardHeader
        industryId="automotive"
        title="Automotive & Telematics"
        subtitle={`${telematics.length} telematics · ${cvFleet.length} OBD fleet vehicles`}
        status={status}
        onRefresh={refresh}
      />

      {/* ── Pipeline tabs ── */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'#e2e8f0', borderRadius:10, padding:4 }}>
        {[
          { id:'telematics', label:`🚙 Telematics Fleet (${telematics.length})` },
          { id:'obd_fleet',  label:`🚐 OBD Commercial Fleet (${cvFleet.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex:1, padding:'8px 16px', border:'none', borderRadius:8, cursor:'pointer',
            fontSize:12, fontWeight:600, transition:'all 0.15s',
            background: activeTab === tab.id ? '#ffffff' : 'transparent',
            color: activeTab === tab.id ? '#1e293b' : '#64748b',
            boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ══ TELEMATICS FLEET TAB ══ */}
      {activeTab === 'telematics' && <>
      <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
        <KPICard label="Vehicles Online"  value={telematics.length}  color="#22c55e" />
        <KPICard label="Active (Moving)"  value={active}             color="#f59e0b" />
        <KPICard label="Fleet Avg Speed"  value={avgSpeed} unit="km/h" color="#3b82f6" />
        <KPICard label="Total DTC Codes"  value={totalDTCs}          color={totalDTCs > 0 ? "#ef4444" : "#22c55e"} />
        <KPICard label="Critical Alerts"  value={critAlerts}         color="#ef4444" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "280px 1fr", gap:20, marginBottom:20 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>
            Vehicles ({telematics.length})
          </div>
          {telematics.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, color:"#334155", fontSize:13, border:"1px dashed rgba(255,255,255,0.06)", borderRadius:10 }}>
              {status === "connecting" ? "Connecting…" : "No vehicles. Start the simulator."}
            </div>
          ) : (
            telematics.map((a) => (
              <AssetCard key={a.asset_id} asset={a}
                selected={selectedAsset === a.asset_id}
                onClick={() => setSelectedAsset(selectedAsset === a.asset_id ? null : a.asset_id)} />
            ))
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#475569",
                marginBottom: 14,
              }}
            >
              Fleet Avg Speed & Engine Temp
            </div>
            {history.length < 2 ? (
              <div
                style={{
                  height: 180,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#334155",
                  fontSize: 12,
                }}
              >
                Waiting for data stream…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={history}
                  margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "#475569" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#475569" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 11,
                      color: "#1e293b",
                    }}
                    labelStyle={{ color: "#64748b" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                  <Line
                    type="monotone"
                    dataKey="avgSpeed"
                    name="Avg Speed km/h"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgTemp"
                    name="Avg Engine °C"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {selectedObj && selectedObj.asset_type !== 'commercial_vehicle' && (
            <div style={{ background:"#ffffff", border:"1px solid #e2e8f0", borderRadius:12, padding:"16px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#475569" }}>
                  {ASSET_META[selectedObj.asset_type]?.icon ?? "🚗"} {selectedObj.asset_id}
                  <span style={{ marginLeft:8 }}><StatusBadge status={selectedObj.status} /></span>
                </div>
                <span style={{ fontSize:10, color:"#475569" }}>
                  {selectedObj.processed_at && new Date(selectedObj.processed_at).toLocaleTimeString()}
                </span>
              </div>
              <VehicleDetail asset={selectedObj} />
            </div>
          )}
        </div>
      </div>
      </>}

      {/* ══ OBD COMMERCIAL FLEET TAB ══ */}
      {activeTab === 'obd_fleet' && <>

        {/* Fleet KPI bar */}
        <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
          <KPICard label="CV Fleet Online"   value={cvFleet.length}               color="#22c55e"  sub="Commercial vehicles" />
          <KPICard label="In Transit"        value={cvMoving}                     color="#3b82f6"  sub={`of ${cvFleet.length} vehicles`} />
          <KPICard label="Fleet Avg Speed"   value={cvAvgSpeed} unit="km/h"       color="#f59e0b" />
          <KPICard label="Overloaded"        value={cvOverloaded}                 color={cvOverloaded > 0 ? '#ef4444' : '#22c55e'}
            sub="VLS > 75 or persistent_overload" />
          <KPICard label="Avg Driver Score"  value={cvAvgDriverScore ?? '—'} unit="/100"
            color={cvAvgDriverScore >= 80 ? '#16a34a' : cvAvgDriverScore >= 60 ? '#d97706' : '#dc2626'}
            sub="DS = 100 − harsh − idle − FE penalty" />
          <KPICard label="Avg Fuel Eff."     value={cvAvgFE ?? '—'} unit="km/L"
            color={(parseFloat(cvAvgFE) || 0) >= 8 ? '#16a34a' : '#d97706'}
            sub="FE = Σdist / Σfuel (rolling 10)" />
          <KPICard label="Harsh Events"      value={cvTotalHarshEvents}           color={cvTotalHarshEvents > 0 ? '#f59e0b' : '#22c55e'}
            sub="HBD + HAD this tick" />
          <KPICard label="Overspeed Now"     value={cvOverspeed}                  color={cvOverspeed > 0 ? '#ef4444' : '#22c55e'}
            sub="VEH_SPD > 80 km/h" />
          <KPICard label="Fleet Idle Waste"  value={cvIdleFuelWaste} unit="L"    color="#7c3aed"
            sub={`₹${cvTotalIdleCost} idle cost (session)`} />
          <KPICard label="Critical Alerts"   value={critAlerts}                   color="#ef4444" />
        </div>

        {/* Live Map */}
        <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>🗺 Live Fleet Map — Real-time GPS Positions</div>
            <div style={{ fontSize:11, color:'#64748b' }}>
              {cvFleet.filter(v => v.latitude).length} vehicles with GPS · Hyderabad Metropolitan
            </div>
          </div>
          {cvFleet.length === 0 ? (
            <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:12, background:'#f8fafc', borderRadius:8 }}>
              {status === 'connecting' ? 'Connecting to OBD pipeline…' : 'Start the OBD simulator to see vehicles on map'}
            </div>
          ) : (
            <FleetMap
              vehicles={cvFleet}
              selectedId={selectedAsset}
              onSelect={setSelectedAsset}
              posHistory={posHistory}
            />
          )}
        </div>

        {/* Vehicle list + detail */}
        <div style={{ display:'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '300px 1fr', gap:20 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase',
              letterSpacing:'0.06em', marginBottom:4 }}>OBD Fleet ({cvFleet.length})</div>
            {cvFleet.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'#334155', fontSize:13,
                border:'1px dashed #cbd5e1', borderRadius:10 }}>
                {status === 'connecting' ? 'Connecting…' : 'No OBD vehicles. Start the OBD simulator.'}
              </div>
            ) : (
              cvFleet.map(v => (
                <CommercialVehicleCard key={v.asset_id} asset={v}
                  selected={selectedAsset === v.asset_id}
                  onClick={() => setSelectedAsset(selectedAsset === v.asset_id ? null : v.asset_id)} />
              ))
            )}
          </div>

          <div>
            {selectedAsset && assets[selectedAsset]?.asset_type === 'commercial_vehicle' ? (
              <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>
                    🚐 {selectedAsset}
                    <span style={{ marginLeft:8 }}><StatusBadge status={assets[selectedAsset]?.status} /></span>
                    {assets[selectedAsset]?.sources && (
                      <span style={{ marginLeft:8, fontSize:9, color:'#7c3aed', background:'rgba(124,58,237,0.1)',
                        padding:'2px 6px', borderRadius:4 }}>
                        {assets[selectedAsset].sources.join(' + ')}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize:10, color:'#64748b' }}>
                    {assets[selectedAsset]?.processed_at && new Date(assets[selectedAsset].processed_at).toLocaleTimeString()}
                  </span>
                </div>
                <CommercialVehicleDetail asset={assets[selectedAsset]} />
              </div>
            ) : (
              <div style={{ background:'#f8fafc', border:'1px dashed #cbd5e1', borderRadius:12, padding:40,
                textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                👆 Select a vehicle from the list or click on the map to view VLD + Driver Analytics
              </div>
            )}
          </div>
        </div>
      </>}

      <AlertFeed alerts={alerts} maxHeight={220} />
    </div>
  );
}
