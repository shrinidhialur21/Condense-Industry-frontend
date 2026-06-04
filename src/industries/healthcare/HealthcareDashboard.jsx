// src/industries/healthcare/HealthcareDashboard.jsx
// Healthcare / Medical IoT — patient monitors, ventilators, infusion pumps, vitals streaming.

import { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useCondenseWS } from "../../hooks/useCondenseWS.js";
import { INDUSTRIES } from "../../config/industries.js";
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
  patient_monitor: { icon: "🫀", label: "Patient Monitor" },
  ventilator: { icon: "🫁", label: "Ventilator" },
  infusion_pump: { icon: "💉", label: "Infusion Pump" },
  bed_sensor: { icon: "🛏️", label: "Bed Sensor" },
};

// Vital sign indicator with normal range
function VitalSign({ label, value, unit, low, high }) {
  const inRange = value != null && value >= low && value <= high;
  const color = value == null ? "#64748b" : inRange ? "#22c55e" : "#ef4444";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 12px",
        background: "#f8fafc",
        borderRadius: 8,
        border: `1px solid ${color}30`,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: "#64748b",
          marginBottom: 3,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color,
          fontFamily: "monospace",
          lineHeight: 1,
        }}
      >
        {value != null
          ? typeof value === "number"
            ? Number(value).toFixed(0)
            : value
          : "—"}
      </div>
      <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{unit}</div>
    </div>
  );
}

function AssetCard({ asset, selected, onClick }) {
  const meta = ASSET_META[asset.asset_type] || {
    icon: "🏥",
    label: asset.asset_type,
  };
  const health = asset.kpis?.health_score ?? 100;
  const isCritical = asset.kpis?.is_critical;
  return (
    <div
      onClick={onClick}
      style={{
        background: selected
          ? "rgba(239,68,68,0.08)"
          : isCritical
          ? "rgba(239,68,68,0.04)"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${
          selected
            ? "rgba(239,68,68,0.5)"
            : isCritical
            ? "rgba(239,68,68,0.25)"
            : "rgba(255,255,255,0.07)"
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
          marginBottom: 6,
        }}
      >
        <div>
          <span style={{ fontSize: 16, marginRight: 6 }}>{meta.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
            {asset.patient_id || asset.asset_id}
          </span>
          {asset.ward && (
            <span style={{ fontSize: 10, color: "#64748b", marginLeft: 6 }}>
              {asset.ward}
            </span>
          )}
        </div>
        {isCritical ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#ef4444",
              background: "rgba(239,68,68,0.12)",
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            CRITICAL
          </span>
        ) : (
          <StatusBadge status={asset.status} />
        )}
      </div>
      {/* Inline vitals for patient monitors */}
      {asset.asset_type === "patient_monitor" && (
        <div
          style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}
        >
          {asset.heart_rate_bpm != null && (
            <VitalSign
              label="HR"
              value={asset.heart_rate_bpm}
              unit="bpm"
              low={60}
              high={100}
            />
          )}
          {asset.spo2_pct != null && (
            <VitalSign
              label="SpO2"
              value={asset.spo2_pct}
              unit="%"
              low={95}
              high={100}
            />
          )}
          {asset.bp_systolic_mmhg != null && (
            <VitalSign
              label="SBP"
              value={asset.bp_systolic_mmhg}
              unit="mmHg"
              low={90}
              high={140}
            />
          )}
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 10, color: "#475569" }}>{meta.label}</div>
        <HealthGauge score={health} size={48} />
      </div>
      {asset.has_alerts && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: "#ef4444",
            background: "rgba(239,68,68,0.08)",
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

function PatientDetail({ asset }) {
  const fields = [
    {
      label: "Heart Rate",
      val: asset.heart_rate_bpm,
      unit: "bpm",
      low: 60,
      high: 100,
    },
    { label: "SpO2", val: asset.spo2_pct, unit: "%", low: 95, high: 100 },
    {
      label: "Systolic BP",
      val: asset.bp_systolic_mmhg,
      unit: "mmHg",
      low: 90,
      high: 140,
    },
    {
      label: "Diastolic BP",
      val: asset.bp_diastolic_mmhg,
      unit: "mmHg",
      low: 60,
      high: 90,
    },
    {
      label: "Temperature",
      val: asset.temperature_c,
      unit: "°C",
      low: 36.1,
      high: 37.2,
    },
    {
      label: "Resp. Rate",
      val: asset.respiratory_rate_bpm,
      unit: "brpm",
      low: 12,
      high: 20,
    },
    { label: "MAP", val: asset.map_mmhg, unit: "mmHg", low: 70, high: 100 },
    { label: "EtCO2", val: asset.etco2_mmhg, unit: "mmHg", low: 35, high: 45 },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px,1fr))",
        gap: 10,
      }}
    >
      {fields.map((f) => {
        const inRange =
          f.val != null &&
          typeof f.val === "number" &&
          f.val >= f.low &&
          f.val <= f.high;
        const color =
          f.val == null ? "#64748b" : inRange ? "#22c55e" : "#ef4444";
        return (
          <div
            key={f.label}
            style={{
              background: "#ffffff",
              border: `1px solid ${color}30`,
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
                color,
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
        );
      })}
    </div>
  );
}

function VentilatorDetail({ asset }) {
  const fields = [
    { label: "Tidal Volume", val: asset.tidal_volume_ml, unit: "ml" },
    { label: "Resp. Rate Set", val: asset.respiratory_rate_set, unit: "brpm" },
    {
      label: "Resp. Rate Act.",
      val: asset.respiratory_rate_actual,
      unit: "brpm",
    },
    { label: "FiO2", val: asset.fio2_pct, unit: "%" },
    { label: "PEEP", val: asset.peep_cmh2o, unit: "cmH₂O" },
    { label: "Peak Pressure", val: asset.peak_pressure_cmh2o, unit: "cmH₂O" },
    { label: "Alarm Active", val: asset.alarm_active ? "YES" : "NO", unit: "" },
    { label: "Mode", val: asset.ventilation_mode, unit: "" },
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
              color:
                f.label === "Alarm Active" && f.val === "YES"
                  ? "#ef4444"
                  : "#e2e8f0",
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

const DETAIL_COMPONENTS = {
  patient_monitor: PatientDetail,
  ventilator: VentilatorDetail,
};

export default function HealthcareDashboard() {
  const industry = INDUSTRIES.healthcare;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const prevRef = useRef({});

  const assetList = Object.values(assets);
  const monitors = assetList.filter((a) => a.asset_type === "patient_monitor");
  const vents = assetList.filter((a) => a.asset_type === "ventilator");
  const selectedObj = selectedAsset ? assets[selectedAsset] : null;
  const DetailComp = selectedObj
    ? DETAIL_COMPONENTS[selectedObj.asset_type] || null
    : null;

  useEffect(() => {
    if (assetList.length === 0) return;
    const hasChanged = assetList.some(
      (a) => prevRef.current[a.asset_id]?.processed_at !== a.processed_at
    );
    if (!hasChanged) return;
    prevRef.current = assets;

    const avgHR = monitors.length
      ? (
          monitors.reduce((s, a) => s + (a.heart_rate_bpm ?? 0), 0) /
          monitors.length
        ).toFixed(0)
      : 0;
    const avgSpO2 = monitors.length
      ? (
          monitors.reduce((s, a) => s + (a.spo2_pct ?? 0), 0) / monitors.length
        ).toFixed(1)
      : 0;
    const time = new Date().toLocaleTimeString("en", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setHistory((prev) =>
      [...prev, { time, avgHR: Number(avgHR), avgSpO2: Number(avgSpO2) }].slice(
        -MAX_HISTORY
      )
    );
  }, [assets]);

  const critical = monitors.filter((a) => a.kpis?.is_critical).length;
  const avgSpO2 = monitors.length
    ? (
        monitors.reduce((s, a) => s + (a.spo2_pct ?? 0), 0) / monitors.length
      ).toFixed(1)
    : "—";
  const avgHR = monitors.length
    ? Math.round(
        monitors.reduce((s, a) => s + (a.heart_rate_bpm ?? 0), 0) /
          monitors.length
      )
    : "—";
  const critAlerts = alerts.filter((a) => a.severity === "critical").length;


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
        padding: "24px 28px",
        minHeight: "100vh",
        background: "#f1f5f9",
        color: "#1e293b",
        fontFamily: "system-ui,sans-serif",
      }}
    >
      <DashboardHeader
        industryId="healthcare"
        title="Healthcare / Medical IoT"
        subtitle={`Monitor ${monitors.length} patients · ${vents.length} ventilators`}
        status={status}
        onRefresh={refresh}
      />

      {critical > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            fontSize: 13,
            color: "#fca5a5",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          🚨{" "}
          <strong>
            {critical} patient{critical > 1 ? "s" : ""} in critical condition
          </strong>{" "}
          — Immediate attention required
        </div>
      )}

      <div
        style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}
      >
        <KPICard
          label="Active Patients"
          value={monitors.length}
          color="#22c55e"
        />
        <KPICard
          label="Critical Status"
          value={critical}
          color={critical > 0 ? "#ef4444" : "#22c55e"}
        />
        <KPICard
          label="Avg SpO2"
          value={avgSpO2}
          unit="%"
          color={Number(avgSpO2) >= 95 ? "#22c55e" : "#ef4444"}
        />
        <KPICard
          label="Avg Heart Rate"
          value={avgHR}
          unit=" bpm"
          color="#3b82f6"
        />
        <KPICard label="Ventilators" value={vents.length} color="#8b5cf6" />
        <KPICard label="Critical Alerts" value={critAlerts} color="#ef4444" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 4,
            }}
          >
            Patients & Devices ({assetList.length})
          </div>
          {assetList.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "#334155",
                fontSize: 13,
                border: "1px dashed rgba(255,255,255,0.06)",
                borderRadius: 10,
              }}
            >
              {status === "connecting"
                ? "Connecting…"
                : "No devices. Start the simulator."}
            </div>
          ) : (
            assetList.map((a) => (
              <AssetCard
                key={a.asset_id}
                asset={a}
                selected={selectedAsset === a.asset_id}
                onClick={() =>
                  setSelectedAsset(
                    selectedAsset === a.asset_id ? null : a.asset_id
                  )
                }
              />
            ))
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Vitals trend */}
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
              Ward Vitals — Avg Heart Rate & SpO2
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
                Waiting for vitals stream…
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
                    dataKey="avgHR"
                    name="Avg HR (bpm)"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgSpO2"
                    name="Avg SpO2 (%)"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Patient detail panel */}
          {selectedObj && DetailComp && (
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
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}
                >
                  {ASSET_META[selectedObj.asset_type]?.icon ?? "🏥"}&nbsp;
                  {selectedObj.patient_id || selectedObj.asset_id}
                  {selectedObj.ward && (
                    <span
                      style={{ fontSize: 11, color: "#64748b", marginLeft: 6 }}
                    >
                      {selectedObj.ward}
                    </span>
                  )}
                  <span style={{ marginLeft: 8 }}>
                    {selectedObj.kpis?.is_critical ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#ef4444",
                          background: "rgba(239,68,68,0.12)",
                          padding: "2px 8px",
                          borderRadius: 20,
                        }}
                      >
                        CRITICAL
                      </span>
                    ) : (
                      <StatusBadge status={selectedObj.status} />
                    )}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: "#475569" }}>
                  {selectedObj.processed_at &&
                    new Date(selectedObj.processed_at).toLocaleTimeString()}
                </span>
              </div>
              <DetailComp asset={selectedObj} />
            </div>
          )}
        </div>
      </div>

      <AlertFeed alerts={alerts} maxHeight={260} />
    </div>
  );
}
