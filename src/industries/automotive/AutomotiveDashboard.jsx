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

// ── Live Fleet Map (SVG, no dependencies) ─────────────────────
// Plots all commercial vehicles on a lat/lon grid.
// Color = speed band. Selected = larger dot + white ring.
// Trail = last 6 positions fading.
function FleetMap({ vehicles, selectedId, onSelect, posHistory }) {
  const W = 600, H = 340;
  const PAD = 24;

  // Compute bounding box
  const positions = vehicles
    .filter(v => v.latitude && v.longitude)
    .map(v => ({ lat: v.latitude, lon: v.longitude }));

  if (positions.length === 0) return (
    <div style={{ height:H, display:'flex', alignItems:'center', justifyContent:'center',
      color:'#94a3b8', fontSize:12, background:'#f8fafc', borderRadius:8 }}>
      No vehicle positions yet…
    </div>
  );

  let minLat = positions[0].lat, maxLat = positions[0].lat;
  let minLon = positions[0].lon, maxLon = positions[0].lon;
  positions.forEach(p => {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon);
  });
  // Add padding to bounding box
  const latPad = Math.max((maxLat - minLat) * 0.25, 0.01);
  const lonPad = Math.max((maxLon - minLon) * 0.25, 0.01);
  minLat -= latPad; maxLat += latPad;
  minLon -= lonPad; maxLon += lonPad;

  const toX = lon => PAD + ((lon - minLon) / (maxLon - minLon)) * (W - 2 * PAD);
  const toY = lat => H - PAD - ((lat - minLat) / (maxLat - minLat)) * (H - 2 * PAD);

  const speedColor = spd => {
    if (spd < 1)  return '#94a3b8';   // idle
    if (spd <= 40) return '#22c55e';  // urban
    if (spd <= 60) return '#f59e0b';  // arterial
    if (spd <= 80) return '#3b82f6';  // highway
    return '#ef4444';                  // overspeed
  };

  // Grid lines (lat/lon)
  const gridLines = [];
  const latStep = (maxLat - minLat) / 4;
  const lonStep = (maxLon - minLon) / 4;
  for (let i = 0; i <= 4; i++) {
    const lat = minLat + i * latStep;
    const lon = minLon + i * lonStep;
    const y = toY(lat), x = toX(lon);
    gridLines.push(
      <line key={`lat${i}`} x1={PAD} x2={W-PAD} y1={y} y2={y} stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="4 4" />,
      <line key={`lon${i}`} x1={x} x2={x} y1={PAD} y2={H-PAD} stroke="#d1d5db" strokeWidth="0.5" strokeDasharray="4 4" />,
    );
  }

  return (
    <div style={{ position:'relative', userSelect:'none' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ background:'#eef4e8', borderRadius:8, border:'1px solid #d1d5db', cursor:'default' }}
      >
        {/* Map background pattern - subtle roads simulation */}
        <rect x={0} y={0} width={W} height={H} fill="#eef4e8" />
        {/* Grid */}
        {gridLines}

        {/* Trails for each vehicle */}
        {vehicles.map(v => {
          const trail = posHistory.current[v.asset_id] || [];
          if (trail.length < 2) return null;
          const pts = trail.map(p => `${toX(p.lon)},${toY(p.lat)}`).join(' ');
          return <polyline key={`trail-${v.asset_id}`} points={pts}
            fill="none" stroke={speedColor(v.veh_spd || 0)} strokeWidth="1.5" strokeOpacity="0.3" />;
        })}

        {/* Vehicle dots */}
        {vehicles.map(v => {
          if (!v.latitude || !v.longitude) return null;
          const x = toX(v.longitude);
          const y = toY(v.latitude);
          const spd = v.veh_spd || 0;
          const col = speedColor(spd);
          const isSel = v.asset_id === selectedId;
          const r = isSel ? 10 : 7;
          return (
            <g key={v.asset_id} onClick={() => onSelect(v.asset_id === selectedId ? null : v.asset_id)}
              style={{ cursor:'pointer' }}>
              {/* Pulse ring for overspeed */}
              {spd > 80 && (
                <circle cx={x} cy={y} r={r + 4} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeOpacity="0.5">
                  <animate attributeName="r" values={`${r+2};${r+8};${r+2}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Selection ring */}
              {isSel && <circle cx={x} cy={y} r={r+4} fill="none" stroke="#ffffff" strokeWidth="2.5" />}
              {/* Vehicle dot */}
              <circle cx={x} cy={y} r={r} fill={col} stroke="#ffffff" strokeWidth={isSel?2:1.5} />
              {/* Direction indicator (small arrow based on movement) */}
              {spd > 1 && <polygon points={`${x},${y-r-3} ${x-3},${y-r+2} ${x+3},${y-r+2}`}
                fill={col} opacity="0.8" />}
              {/* Vehicle ID label */}
              <text x={x + r + 3} y={y + 4} fontSize={isSel?10:8} fill="#374151" fontWeight={isSel?700:400}
                fontFamily="system-ui" style={{ pointerEvents:'none' }}>
                {v.asset_id}
              </text>
            </g>
          );
        })}

        {/* Speed legend */}
        {[
          { col:'#94a3b8', label:'Idle' },
          { col:'#22c55e', label:'Urban <40' },
          { col:'#f59e0b', label:'40-60' },
          { col:'#3b82f6', label:'60-80' },
          { col:'#ef4444', label:'>80 ⚠' },
        ].map((item, i) => (
          <g key={item.label}>
            <circle cx={PAD + 6} cy={H - PAD - 10 + i * (-14) - 4} r={4} fill={item.col} />
            <text x={PAD + 14} y={H - PAD - 6 + i * (-14)} fontSize={8} fill="#374151" fontFamily="system-ui">{item.label} km/h</text>
          </g>
        ))}

        {/* North indicator */}
        <text x={W - PAD - 10} y={PAD + 14} fontSize={10} fill="#6b7280" fontWeight={700} fontFamily="system-ui">N↑</text>

        {/* Coordinate labels */}
        <text x={PAD} y={H - 4} fontSize={7} fill="#9ca3af" fontFamily="monospace">
          {minLat.toFixed(3)}°N, {minLon.toFixed(3)}°E
        </text>
      </svg>

      {/* Map footer */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:10, color:'#94a3b8' }}>
        <span>{vehicles.length} vehicles · Live positions</span>
        <span>Hyderabad Metropolitan Area</span>
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
  const hasVLD    = k.vehicle_load_score != null || k.rsli != null;
  const hasDriver = k.driver_score != null || k.fuel_efficiency_rolling_kmpl != null;

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

      {/* ── VLD Algorithms ── */}
      {hasVLD && (
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
            letterSpacing:'0.08em', marginBottom:8 }}>⚖️ Vehicle Load Detection (VLD) Model</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
            <KpiTileCV label="Vehicle Load Score"
              value={k.vehicle_load_score} unit="/100"
              color={k.vehicle_load_score > 75 ? '#dc2626' : k.vehicle_load_score > 50 ? '#d97706' : '#16a34a'}
              status={k.load_classification} statusLevel={k.load_classification}
              algoFormula="VLS = RSLI×0.45 + FRLF×0.45 + TPI×0.10 − 100" />
            <KpiTileCV label="RSLI (RPM-Speed)"
              value={k.rsli} unit="%"
              color={k.rsli > 175 ? '#dc2626' : k.rsli > 145 ? '#d97706' : '#16a34a'}
              status={k.rsli_status} statusLevel={k.rsli_status === 'overloaded' ? 'critical' : k.rsli_status === 'heavy' ? 'average' : 'good'}
              algoFormula="RSLI = actual_RPM / (750 + speed×18) × 100" />
            <KpiTileCV label="FRLF (Fuel-Rate)"
              value={k.frlf} unit="%"
              color={k.frlf > 175 ? '#dc2626' : k.frlf > 145 ? '#d97706' : '#16a34a'}
              status={k.frlf_status} statusLevel={k.frlf_status === 'overloaded' ? 'critical' : k.frlf_status === 'heavy' ? 'average' : 'good'}
              algoFormula="FRLF = fuel_rate / (2.5 + speed×0.033) × 100" />
            <KpiTileCV label="GVW Estimate"
              value={k.gvw_estimate_kg} unit="kg"
              color="#8b5cf6"
              algoFormula="GVW = P_engine×η / (g × Crr × speed)" />
            <KpiTileCV label="Payload Est."
              value={k.payload_estimate_kg} unit="kg"
              color="#7c3aed"
              algoFormula="payload = GVW − 1400 (empty weight)" />
            <KpiTileCV label="Load %"
              value={k.load_pct_estimate} unit="%"
              color={k.load_pct_estimate > 90 ? '#dc2626' : '#475569'}
              algoFormula="load_pct = payload / 2100 × 100" />
            <KpiTileCV label="Engine Combustion"
              value={k.engine_combustion_load} unit="/100"
              color={k.ecls_status === 'optimal' ? '#16a34a' : k.ecls_status === 'acceptable' ? '#d97706' : '#dc2626'}
              status={k.ecls_status} statusLevel={k.ecls_status === 'optimal' ? 'optimal' : 'acceptable'}
              algoFormula="ECLS = 100 − RPM_deviation from optimal band" />
            <KpiTileCV label="Traction Power"
              value={k.traction_power_index} unit="%"
              color="#06b6d4"
              algoFormula="TPI = road_power / engine_shaft_power × 100" />
          </div>
          {k.persistent_overload && (
            <div style={{ marginTop:8, padding:'8px 12px', background:'#fee2e2', border:'1px solid #fca5a5',
              borderRadius:8, fontSize:11, color:'#dc2626', fontWeight:600 }}>
              🚨 Persistent Overload — {k.overload_streak} consecutive batches. Requires immediate inspection.
            </div>
          )}
        </div>
      )}

      {/* ── Driver Analytics ── */}
      {hasDriver && (
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
            letterSpacing:'0.08em', marginBottom:8 }}>👤 Driver Analytics Model</div>

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
              color={k.harsh_brakes_session > 3 ? '#dc2626' : k.harsh_brakes_session > 0 ? '#d97706' : '#16a34a'}
              algoFormula="HBD: speed drop > 10 km/h in one reading interval" />
            <KpiTileCV label="Harsh Accel (session)"
              value={k.harsh_acc_session} unit="events"
              color={k.harsh_acc_session > 3 ? '#dc2626' : k.harsh_acc_session > 0 ? '#d97706' : '#16a34a'}
              algoFormula="HAD: speed rise > 10 km/h in one reading interval" />
            <KpiTileCV label="Over-Rev Count"
              value={k.over_rev_session}
              color={k.over_rev_session > 5 ? '#dc2626' : '#475569'}
              algoFormula="ORD: ENG_SPD > 2800 RPM (LCV diesel optimal: 1200-2200)" />
            <KpiTileCV label="Idle Time"
              value={k.idle_time_session_min} unit="min"
              color={k.idle_time_session_min > 15 ? '#d97706' : '#475569'}
              algoFormula="IDLE: VEH_SPD<1 && ENG_SPD>700 RPM" />
            <KpiTileCV label="Idle Fuel Wasted"
              value={k.idle_fuel_wasted_L} unit="L"
              color={k.idle_fuel_wasted_L > 1 ? '#d97706' : '#16a34a'}
              algoFormula="wasted_L = fuel_rate × idle_time_h" />
            <KpiTileCV label="Idle Fuel Cost"
              value={k.idle_cost_inr} unit="₹"
              color="#ef4444"
              algoFormula="idle_L × ₹95/L (diesel price India)" />
            <KpiTileCV label="RPM Optimisation"
              value={k.rpm_optimisation_pct} unit="%"
              color={k.rpm_optimisation_pct >= 75 ? '#16a34a' : k.rpm_optimisation_pct >= 55 ? '#d97706' : '#dc2626'}
              algoFormula="% readings in optimal diesel band: 1200-2200 RPM" />
            <KpiTileCV label="Session FE"
              value={k.fuel_efficiency_session_kmpl} unit="km/L"
              color={k.fe_rating === 'excellent' ? '#16a34a' : k.fe_rating === 'good' ? '#059669' : k.fe_rating === 'average' ? '#d97706' : '#dc2626'}
              status={k.fe_rating} statusLevel={k.fe_rating === 'excellent' ? 'excellent' : k.fe_rating === 'good' ? 'good' : 'average'}
              algoFormula="FE = Σ(speed×dt) / Σ(fuel_rate×dt)" />
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
  const [activeTab, setActiveTab] = useState('telematics'); // 'telematics' | 'obd_fleet'
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
