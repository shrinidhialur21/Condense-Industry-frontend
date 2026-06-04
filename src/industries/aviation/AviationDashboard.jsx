// src/industries/aviation/AviationDashboard.jsx
// Airports & Aviation — gate status, flight ops, baggage, turnaround analytics.

import { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
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
  gate: { icon: "🛫", label: "Gate" },
  flight: { icon: "✈️", label: "Flight" },
  runway: { icon: "🛬", label: "Runway" },
  baggage: { icon: "🧳", label: "Baggage Belt" },
};

const FLIGHT_STATUS_COLOR = {
  boarding: "#22c55e",
  departed: "#3b82f6",
  delayed: "#f59e0b",
  cancelled: "#ef4444",
  arrived: "#8b5cf6",
  taxiing: "#06b6d4",
};

function FlightStatusBadge({ status }) {
  const color = FLIGHT_STATUS_COLOR[status] || "#64748b";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 20,
        background: `${color}20`,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {status ?? "unknown"}
    </span>
  );
}

function AssetCard({ asset, selected, onClick }) {
  const meta = ASSET_META[asset.asset_type] || {
    icon: "🏢",
    label: asset.asset_type,
  };
  const health = asset.kpis?.health_score ?? 100;
  return (
    <div
      onClick={onClick}
      style={{
        background: selected
          ? "rgba(6,182,212,0.08)"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${
          selected ? "rgba(6,182,212,0.4)" : "#e2e8f0"
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
            {asset.flight_number || asset.asset_id}
          </span>
        </div>
        <FlightStatusBadge status={asset.status} />
      </div>
      {asset.delay_min > 0 && (
        <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 4 }}>
          ⏱ {asset.delay_min} min delay
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 10, color: "#475569" }}>
          {asset.origin && asset.destination
            ? `${asset.origin} → ${asset.destination}`
            : meta.label}
          {asset.total_passengers ? ` · ${asset.total_passengers} pax` : ""}
        </div>
        <HealthGauge score={health} size={48} />
      </div>
      {asset.has_alerts && (
        <div
          style={{
            marginTop: 6,
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

function GateDetail({ asset }) {
  const fields = [
    { label: "Flight", val: asset.flight_number, unit: "" },
    { label: "Aircraft Type", val: asset.aircraft_type, unit: "" },
    { label: "PAX Count", val: asset.total_passengers, unit: "" },
    { label: "Delay", val: asset.delay_min, unit: "min" },
    { label: "Turnaround", val: asset.turnaround_time_min, unit: "min" },
    { label: "Boarding %", val: asset.baggage_loaded_pct, unit: "%" },
    { label: "Gate", val: asset.gate, unit: "" },
    { label: "Runway", val: asset.runway, unit: "" },
  ];
  return <DetailGrid fields={fields} />;
}

function FlightDetail({ asset }) {
  const fields = [
    { label: "Flight No", val: asset.flight_number, unit: "" },
    { label: "Altitude", val: asset.altitude_ft, unit: "ft" },
    { label: "Speed", val: asset.ground_speed_kts, unit: "kts" },
    { label: "Delay", val: asset.delay_min, unit: "min" },
    { label: "Origin", val: asset.origin, unit: "" },
    { label: "Destination", val: asset.destination, unit: "" },
    { label: "Fuel", val: asset.fuel_kg, unit: "kg" },
    { label: "PAX", val: asset.total_passengers, unit: "" },
  ];
  return <DetailGrid fields={fields} />;
}

function DetailGrid({ fields }) {
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
              fontSize: 16,
              fontWeight: 700,
              color: "#1e293b",
              fontFamily: "monospace",
            }}
          >
            {f.val != null
              ? typeof f.val === "number"
                ? Number(f.val).toFixed(0)
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

const DETAIL_COMPONENTS = { gate: GateDetail, flight: FlightDetail };

export default function AviationDashboard() {
  const industry = INDUSTRIES.aviation;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const prevRef = useRef({});

  const assetList = Object.values(assets);
  const flights = assetList.filter((a) => a.asset_type === "flight");
  const gates = assetList.filter((a) => a.asset_type === "gate");
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

    const delayed = flights.filter((a) => a.delay_min > 0).length;
    const active = flights.filter((a) =>
      ["boarding", "taxiing", "departed"].includes(a.status)
    ).length;
    const time = new Date().toLocaleTimeString("en", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setHistory((prev) =>
      [...prev, { time, activeFlights: active, delayedFlights: delayed }].slice(
        -MAX_HISTORY
      )
    );
  }, [assets]);

  const activeFlights = flights.filter((a) =>
    ["boarding", "taxiing", "departed"].includes(a.status)
  ).length;
  const delayedCount = flights.filter((a) => a.delay_min > 0).length;
  const onTimePct = flights.length
    ? Math.round((1 - delayedCount / flights.length) * 100)
    : 100;
  const avgDelay = delayedCount
    ? Math.round(
        flights
          .filter((a) => a.delay_min > 0)
          .reduce((s, a) => s + a.delay_min, 0) / delayedCount
      )
    : 0;
  const critAlerts = alerts.filter((a) => a.severity === "critical").length;

  // Delay distribution for bar chart
  const delayBuckets = [
    {
      range: "0 min",
      count: flights.filter((a) => !a.delay_min || a.delay_min <= 0).length,
    },
    {
      range: "1–15 min",
      count: flights.filter((a) => a.delay_min > 0 && a.delay_min <= 15).length,
    },
    {
      range: "16–30 min",
      count: flights.filter((a) => a.delay_min > 15 && a.delay_min <= 30)
        .length,
    },
    { range: "30+ min", count: flights.filter((a) => a.delay_min > 30).length },
  ];


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
        industryId="aviation"
        title="Airports & Aviation"
        subtitle={`Flights: ${flights.length} · Gates: ${gates.length}`}
        status={status}
        onRefresh={refresh}
      />

      <div
        style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}
      >
        <KPICard label="Active Flights" value={activeFlights} color="#22c55e" />
        <KPICard
          label="Total Monitored"
          value={assetList.length}
          color="#06b6d4"
        />
        <KPICard
          label="On-Time Rate"
          value={onTimePct}
          unit="%"
          color={onTimePct >= 80 ? "#22c55e" : "#f59e0b"}
        />
        <KPICard
          label="Delayed Flights"
          value={delayedCount}
          color={delayedCount > 0 ? "#f59e0b" : "#22c55e"}
        />
        <KPICard
          label="Avg Delay"
          value={avgDelay}
          unit=" min"
          color="#f59e0b"
        />
        <KPICard label="Critical Alerts" value={critAlerts} color="#ef4444" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
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
            Operations ({assetList.length})
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
                : "No data. Start the simulator."}
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
          {/* Two charts side by side */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            {/* Active vs Delayed trend */}
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
                Flight Activity Trend
              </div>
              {history.length < 2 ? (
                <div
                  style={{
                    height: 160,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#334155",
                    fontSize: 12,
                  }}
                >
                  Waiting…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart
                    data={history}
                    margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 9, fill: "#475569" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "#475569" }}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        fontSize: 11,
                        color: "#1e293b",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#64748b" }} />
                    <Line
                      type="monotone"
                      dataKey="activeFlights"
                      name="Active"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="delayedFlights"
                      name="Delayed"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Delay distribution */}
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
                Delay Distribution
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={delayBuckets}
                  margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 9, fill: "#475569" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#475569" }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 11,
                      color: "#1e293b",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="Flights"
                    fill="#06b6d4"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

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
                  {ASSET_META[selectedObj.asset_type]?.icon}{" "}
                  {selectedObj.flight_number || selectedObj.asset_id}
                  <span style={{ marginLeft: 8 }}>
                    <FlightStatusBadge status={selectedObj.status} />
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

      <AlertFeed alerts={alerts} maxHeight={240} />
    </div>
  );
}
