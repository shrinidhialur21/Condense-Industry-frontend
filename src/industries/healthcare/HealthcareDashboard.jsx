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
import { useWindowSize } from "../../hooks/useWindowSize.js";
import {
  AlertFeed,
  StatusBadge,
  HealthGauge,
  THEME,
  ThemedDashboardHeader,
  ThemedKPICard,
  NotConfiguredGuard,
  chartTheme,
} from "../../components/shared.jsx";
import healthcareHero from "../../assets/industries/healthcare.jpg";

// One ECG heartbeat template (P–QRS–T), 100 units wide. Two copies back to
// back + a CSS translateX loop create a seamless scroll; the loop's DURATION
// is set to 60/bpm seconds, so one waveform cycle = one real heartbeat.
const ECG_CYCLE = "M0,20 L8,20 L12,15 L16,20 L26,20 L30,4 L34,36 L38,20 L48,20 L54,10 L60,20 L100,20";

function ECGWaveform({ bpm, color }) {
  const safeBpm = bpm > 0 ? bpm : 72;
  const duration = 60 / safeBpm;
  return (
    <div style={{ width: '100%', height: 56, overflow: 'hidden', position: 'relative' }}>
      <svg width="200" height="56" viewBox="0 0 200 40" preserveAspectRatio="none" style={{
        position: 'absolute', left: 0, top: 0, height: '100%', width: '200%',
        animation: `condense-ecg-scroll ${duration}s linear infinite`,
      }}>
        <path d={ECG_CYCLE} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={ECG_CYCLE} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" transform="translate(100,0)" />
      </svg>
      <style>{`@keyframes condense-ecg-scroll { from { transform: translateX(0); } to { transform: translateX(-100px); } }`}</style>
    </div>
  );
}

// Hero — a real scrolling ECG trace. The time between beats is set by the
// real fleet-average heart rate (avgHR), not a fixed decorative loop; color
// reflects the real avgSpO2 reading.
function VitalsHero({ photo, avgHR, avgSpO2, stats }) {
  const ecgColor = Number(avgSpO2) >= 95 ? '#4ade80' : Number(avgSpO2) > 0 ? '#f87171' : '#5b9cf5';
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 20, minHeight: 240 }}>
      <img src={photo} alt="ICU monitor" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(9,14,26,0.15) 0%, rgba(9,14,26,0.35) 45%, rgba(9,14,26,0.82) 100%)' }} />
      <div style={{ position: 'relative', padding: '20px 24px', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', minHeight: 240, boxSizing: 'border-box' }}>
        <div style={{ pointerEvents: 'none' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(11,18,32,0.55)',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, padding: '4px 10px', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#e6eaf2', letterSpacing: '0.05em' }}>LIVE PATIENT MONITORING</span>
          </div>
          <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: '#ffffff' }}>ICU & Ward Vitals</div>
        </div>

        <div style={{ background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: 10, padding: '8px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 9.5, color: 'rgba(230,234,242,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
            Fleet Avg ECG · {avgHR > 0 ? `${avgHR} bpm` : 'no signal'}
          </div>
          <ECGWaveform bpm={Number(avgHR)} color={ecgColor} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', pointerEvents: 'none' }}>
          {stats.map(s => (
            <div key={s.label} style={{
              background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10, padding: '8px 14px', minWidth: 92,
            }}>
              <div style={{ fontSize: 9.5, color: 'rgba(230,234,242,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 700, color: s.color || '#ffffff' }}>
                {s.value}{s.unit && <span style={{ fontSize: 11, color: 'rgba(230,234,242,0.6)', marginLeft: 2 }}>{s.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const MAX_HISTORY = 40;

const ASSET_META = {
  patient_monitor: { icon: "🫀", label: "Patient Monitor" },
  ventilator: { icon: "🫁", label: "Ventilator" },
  infusion_pump: { icon: "💉", label: "Infusion Pump" },
  bed_sensor: { icon: "🛏️", label: "Bed Sensor" },
};

// Vital sign indicator with normal range
function VitalSign({ label, value, unit, low, high, theme = 'light' }) {
  const t = THEME[theme];
  const inRange = value != null && value >= low && value <= high;
  const color = value == null ? t.textDim : inRange ? "#22c55e" : "#ef4444";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 12px",
        background: t.pageBg,
        borderRadius: 8,
        border: `1px solid ${color}30`,
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: t.textDim,
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
      <div style={{ fontSize: 9, color: t.textFaint, marginTop: 2 }}>{unit}</div>
    </div>
  );
}

function AssetCard({ asset, selected, onClick, theme = 'light' }) {
  const t = THEME[theme];
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
          : t.cardBg,
        border: `1px solid ${
          selected
            ? "rgba(239,68,68,0.5)"
            : isCritical
            ? "rgba(239,68,68,0.25)"
            : t.cardBorder
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
          <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
            {asset.patient_id || asset.asset_id}
          </span>
          {asset.ward && (
            <span style={{ fontSize: 10, color: t.textDim, marginLeft: 6 }}>
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
              theme={theme}
            />
          )}
          {asset.spo2_pct != null && (
            <VitalSign
              label="SpO2"
              value={asset.spo2_pct}
              unit="%"
              low={95}
              high={100}
              theme={theme}
            />
          )}
          {asset.bp_systolic_mmhg != null && (
            <VitalSign
              label="SBP"
              value={asset.bp_systolic_mmhg}
              unit="mmHg"
              low={90}
              high={140}
              theme={theme}
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
        <div style={{ fontSize: 10, color: t.textDim }}>{meta.label}</div>
        <HealthGauge score={health} size={48} theme={theme} />
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
  const { isMobile, isTablet, isTV } = useWindowSize();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('healthcare_theme') || 'dark');
  const prevRef = useRef({});

  useEffect(() => { localStorage.setItem('healthcare_theme', theme); }, [theme]);

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
    return <NotConfiguredGuard theme={theme} />;
  }
  const t = THEME[theme];
  const ct = chartTheme(theme);
  return (
    <div
      style={{
        padding: isMobile ? "12px 14px" : isTV ? "32px 40px" : "24px 28px",
        minHeight: "100vh",
        background: t.pageBg,
        color: t.text,
        fontFamily: "system-ui,sans-serif",
      }}
    >
      <ThemedDashboardHeader
        industryId="healthcare"
        title="Healthcare / Medical IoT"
        subtitle={`Monitor ${monitors.length} patients · ${vents.length} ventilators`}
        status={status}
        onRefresh={refresh}
        theme={theme}
        onToggleTheme={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}
      />

      <VitalsHero
        photo={healthcareHero}
        avgHR={Number(avgHR) || 0}
        avgSpO2={avgSpO2}
        stats={[
          { label: 'Active Patients', value: monitors.length, color: '#4ade80' },
          { label: 'Critical', value: critical, color: critical > 0 ? '#f87171' : '#4ade80' },
          { label: 'Avg SpO2', value: avgSpO2, unit: '%', color: Number(avgSpO2) >= 95 ? '#4ade80' : '#f87171' },
          { label: 'Avg Heart Rate', value: avgHR, unit: 'bpm', color: '#93c5fd' },
        ]}
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
        <ThemedKPICard theme={theme}
          label="Active Patients"
          value={monitors.length}
          color="#22c55e"
        />
        <ThemedKPICard theme={theme}
          label="Critical Status"
          value={critical}
          color={critical > 0 ? "#ef4444" : "#22c55e"}
        />
        <ThemedKPICard theme={theme}
          label="Avg SpO2"
          value={avgSpO2}
          unit="%"
          color={Number(avgSpO2) >= 95 ? "#22c55e" : "#ef4444"}
        />
        <ThemedKPICard theme={theme}
          label="Avg Heart Rate"
          value={avgHR}
          unit=" bpm"
          color="#3b82f6"
        />
        <ThemedKPICard theme={theme} label="Ventilators" value={vents.length} color="#8b5cf6" />
        <ThemedKPICard theme={theme} label="Critical Alerts" value={critAlerts} color="#ef4444" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile || isTablet ? "1fr" : "300px 1fr",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: t.textDim,
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
                color: t.textFaint,
                fontSize: 13,
                border: `1px dashed ${t.cardBorder}`,
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
                theme={theme}
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
              background: t.cardBg,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: t.textDim,
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
                  color: t.textFaint,
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
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: ct.axis }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: ct.axis }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={ct.tooltipStyle}
                    labelStyle={{ color: ct.legend }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: ct.legend }} />
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
                background: t.cardBg,
                border: `1px solid ${t.cardBorder}`,
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
                  style={{ fontSize: 13, fontWeight: 600, color: t.textDim }}
                >
                  {ASSET_META[selectedObj.asset_type]?.icon ?? "🏥"}&nbsp;
                  {selectedObj.patient_id || selectedObj.asset_id}
                  {selectedObj.ward && (
                    <span
                      style={{ fontSize: 11, color: t.textDim, marginLeft: 6 }}
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
                <span style={{ fontSize: 10, color: t.textFaint }}>
                  {selectedObj.processed_at &&
                    new Date(selectedObj.processed_at).toLocaleTimeString()}
                </span>
              </div>
              <DetailComp asset={selectedObj} />
            </div>
          )}
        </div>
      </div>

      <AlertFeed alerts={alerts} maxHeight={260} theme={theme} />
    </div>
  );
}
