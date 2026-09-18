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
import { useWindowSize } from "../../hooks/useWindowSize.js";
import {
  AlertFeed,
  StatusBadge,
  HealthGauge,
  THEME,
  ThemedDashboardHeader,
  ThemedKPICard,
  NotConfiguredGuard,
} from "../../components/shared.jsx";
import aviationHero from "../../assets/industries/aviation.jpg";

const GATE_STATUS_COLOR = {
  boarding: "#4ade80", occupied: "#4ade80", active: "#4ade80",
  delayed: "#fbbf24", maintenance: "#fbbf24",
  fault: "#f87171", closed: "#f87171",
};

// Apron strip — one tile per real gate, colored by its real status field; the
// plane silhouette only animates taxi-to-runway while a real flight is
// actually in the "taxiing" state.
function ApronStrip({ gates, taxiingCount }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        {gates.slice(0, 24).map((g) => (
          <div key={g.asset_id} title={`${g.asset_id}: ${g.status || "unknown"}`} style={{
            width: 26, height: 20, borderRadius: 4,
            background: GATE_STATUS_COLOR[g.status] || "rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 700, color: "#0b1220",
          }}>
            {String(g.asset_id).replace(/\D/g, "").slice(-2) || ""}
          </div>
        ))}
      </div>
      {taxiingCount > 0 && (
        <div style={{ position: "relative", height: 16 }}>
          <div style={{ position: "absolute", top: 7, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.2)" }} />
          <div style={{
            position: "absolute", top: 0, fontSize: 14,
            animation: "condense-taxi 3s linear infinite",
          }}>✈️</div>
          <style>{`@keyframes condense-taxi { from { left: 0%; } to { left: calc(100% - 16px); } }`}</style>
        </div>
      )}
    </div>
  );
}

// Hero — a real airport photo + an apron strip of real gates + a taxiing
// plane animation gated on real flight status (see ApronStrip above).
function ApronHero({ photo, gates, taxiingCount, stats }) {
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", marginBottom: 20, minHeight: 240 }}>
      <img src={photo} alt="Airport apron" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(9,14,26,0.2) 0%, rgba(9,14,26,0.4) 45%, rgba(9,14,26,0.85) 100%)" }} />
      <div style={{ position: "relative", padding: "20px 24px", display: "flex", flexDirection: "column",
        justifyContent: "space-between", minHeight: 240, boxSizing: "border-box" }}>
        <div style={{ pointerEvents: "none" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(11,18,32,0.55)",
            border: "1px solid rgba(255,255,255,0.18)", borderRadius: 20, padding: "4px 10px", marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#e6eaf2", letterSpacing: "0.05em" }}>LIVE APRON VIEW</span>
          </div>
          <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: "#ffffff" }}>Terminal & Gate Operations</div>
        </div>

        {gates.length > 0 && (
          <div style={{ background: "rgba(11,18,32,0.55)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.16)",
            borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
            <ApronStrip gates={gates} taxiingCount={taxiingCount} />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", pointerEvents: "none" }}>
          {stats.map((s) => (
            <div key={s.label} style={{
              background: "rgba(11,18,32,0.6)", backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.16)", borderRadius: 10, padding: "8px 14px", minWidth: 92,
            }}>
              <div style={{ fontSize: 9.5, color: "rgba(230,234,242,0.7)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 700, color: s.color || "#ffffff" }}>
                {s.value}{s.unit && <span style={{ fontSize: 11, color: "rgba(230,234,242,0.6)", marginLeft: 2 }}>{s.unit}</span>}
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
  const { isMobile, isTablet, isTV } = useWindowSize();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('aviation_theme') || 'dark');
  const prevRef = useRef({});

  useEffect(() => { localStorage.setItem('aviation_theme', theme); }, [theme]);

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
  const taxiingCount = flights.filter((a) => a.status === "taxiing").length;
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
    return <NotConfiguredGuard theme={theme} />;
  }
  const t = THEME[theme];
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
        industryId="aviation"
        title="Airports & Aviation"
        subtitle={`Flights: ${flights.length} · Gates: ${gates.length}`}
        status={status}
        onRefresh={refresh}
        theme={theme}
        onToggleTheme={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}
      />

      <ApronHero
        photo={aviationHero}
        gates={gates}
        taxiingCount={taxiingCount}
        stats={[
          { label: 'Active Flights', value: activeFlights, color: '#4ade80' },
          { label: 'On-Time Rate', value: onTimePct, unit: '%', color: onTimePct >= 80 ? '#4ade80' : '#fbbf24' },
          { label: 'Delayed', value: delayedCount, color: delayedCount > 0 ? '#fbbf24' : '#4ade80' },
          { label: 'Critical Alerts', value: critAlerts, color: critAlerts > 0 ? '#f87171' : '#4ade80' },
        ]}
      />

      <div
        style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}
      >
        <ThemedKPICard theme={theme} label="Active Flights" value={activeFlights} color="#22c55e" />
        <ThemedKPICard theme={theme}
          label="Total Monitored"
          value={assetList.length}
          color="#06b6d4"
        />
        <ThemedKPICard theme={theme}
          label="On-Time Rate"
          value={onTimePct}
          unit="%"
          color={onTimePct >= 80 ? "#22c55e" : "#f59e0b"}
        />
        <ThemedKPICard theme={theme}
          label="Delayed Flights"
          value={delayedCount}
          color={delayedCount > 0 ? "#f59e0b" : "#22c55e"}
        />
        <ThemedKPICard theme={theme}
          label="Avg Delay"
          value={avgDelay}
          unit=" min"
          color="#f59e0b"
        />
        <ThemedKPICard theme={theme} label="Critical Alerts" value={critAlerts} color="#ef4444" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile || isTablet ? "1fr" : "280px 1fr",
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
            style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}
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
