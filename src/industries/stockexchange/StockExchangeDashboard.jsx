// src/industries/stockexchange/StockExchangeDashboard.jsx
// Stock Exchange Operations Dashboard — BVRD
// Target: Exchange operations team monitoring trading activity, market integrity, fraud detection.
// NOT a trader terminal — shows exchange-wide health, throughput, settlement risk, surveillance.

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { useCondenseWS } from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }    from '../../config/industries.js';
import { useWindowSize } from '../../hooks/useWindowSize.js';
import {
  AlertFeed, StatusBadge, HealthGauge,
  THEME, ThemedDashboardHeader, ThemedKPICard, NotConfiguredGuard, chartTheme,
} from '../../components/shared.jsx';
import stockexchangeHero from '../../assets/industries/stockexchange.jpg';

// Ticker tape — one entry per real trading segment, flashing green/red on the
// real value_dop delta since the last tick. This dataset tracks exchange
// operations, not per-symbol OHLC, so this replaces literal candlesticks with
// a ticker built from what's actually real here.
function TickerTape({ segments, flash, compact }) {
  const row = segments.length ? [...segments, ...segments] : []; // doubled for seamless scroll
  return (
    <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', borderTop: '1px solid rgba(255,255,255,0.12)', borderBottom: '1px solid rgba(255,255,255,0.12)', padding: '8px 0' }}>
      <div style={{ display: 'inline-flex', gap: 28, animation: segments.length ? 'condense-ticker-scroll 22s linear infinite' : 'none' }}>
        {row.length === 0 && <span style={{ fontSize: 12, color: 'rgba(230,234,242,0.6)' }}>Waiting for segment data…</span>}
        {row.map((s, i) => {
          const dir = flash[s.asset_id];
          const color = dir === 'up' ? '#4ade80' : dir === 'down' ? '#f87171' : '#e6eaf2';
          const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•';
          return (
            <span key={`${s.asset_id}-${i}`} style={{ fontSize: 12.5, fontFamily: 'monospace', color, whiteSpace: 'nowrap' }}>
              <b>{s.segment_name}</b> {compact(s.trades_count)} trades <span style={{ marginLeft: 4 }}>{arrow} {compact(s.value_dop)} DOP</span>
            </span>
          );
        })}
      </div>
      <style>{`@keyframes condense-ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

// Hero — real trading-floor photo + a live ticker tape (see TickerTape above).
function TradingFloorHero({ photo, badge, title, segments, flash, compact, stats }) {
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 20, minHeight: 240 }}>
      <img src={photo} alt="Trading floor" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(9,14,26,0.2) 0%, rgba(9,14,26,0.4) 45%, rgba(9,14,26,0.85) 100%)' }} />
      <div style={{ position: 'relative', padding: '20px 24px', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', minHeight: 240, boxSizing: 'border-box' }}>
        <div style={{ pointerEvents: 'none' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(11,18,32,0.55)',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, padding: '4px 10px', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#e6eaf2', letterSpacing: '0.05em' }}>{badge}</span>
          </div>
          <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: '#ffffff' }}>{title}</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <TickerTape segments={segments} flash={flash} compact={compact} />
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

const MAX_HISTORY = 60;
const CONDENSE_BLUE = '#257df0';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v, dec = 1) { return v != null && !isNaN(v) ? Number(v).toFixed(dec) : '—'; }

// Smart compact number formatter — keeps KPI card values short
// 134,764,300 → "134.8M"  |  1,300,000,000 → "1.3B"  |  85,400 → "85.4K"  |  999 → "999"
function compact(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (n >= 1e9)  return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4)  return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function RiskBadge({ level }) {
  const map = {
    critical    : { bg: '#fee2e2', color: '#dc2626', label: 'CRITICAL' },
    high        : { bg: '#fee2e2', color: '#dc2626', label: 'HIGH' },
    elevated    : { bg: '#fef3c7', color: '#d97706', label: 'ELEVATED' },
    stressed    : { bg: '#fef3c7', color: '#d97706', label: 'STRESSED' },
    crisis      : { bg: '#fee2e2', color: '#dc2626', label: 'CRISIS' },
    investigate : { bg: '#fef3c7', color: '#d97706', label: 'INVESTIGATE' },
    flagged     : { bg: '#fef3c7', color: '#d97706', label: 'FLAGGED' },
    normal      : { bg: '#dcfce7', color: '#16a34a', label: 'NORMAL' },
    clear       : { bg: '#dcfce7', color: '#16a34a', label: 'CLEAR' },
    low         : { bg: '#dbeafe', color: '#2563eb', label: 'LOW' },
  };
  const s = map[level] || { bg: '#f1f5f9', color: '#64748b', label: level?.toUpperCase() || '—' };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.color, letterSpacing: '0.06em' }}>
      {s.label}
    </span>
  );
}

function MetricGauge({ value, max = 100, color, size = 64, theme = 'light' }) {
  if (value == null) return null;
  const t     = THEME[theme];
  const pct   = Math.min(100, Math.max(0, value / max * 100));
  const r     = size / 2 - 6;
  const circ  = Math.PI * r;
  const fill  = (pct / 100) * circ;
  const c     = color || (pct >= 70 ? '#dc2626' : pct >= 40 ? '#d97706' : '#16a34a');
  return (
    <svg width={size} height={size / 2 + 8} style={{ overflow: 'visible' }}>
      <path d={`M 6 ${size/2} A ${r} ${r} 0 0 1 ${size-6} ${size/2}`}
        fill="none" stroke={t.cardBorder} strokeWidth={5} strokeLinecap="round" />
      <path d={`M 6 ${size/2} A ${r} ${r} 0 0 1 ${size-6} ${size/2}`}
        fill="none" stroke={c} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`} />
      <text x={size/2} y={size/2 + 5} textAnchor="middle"
        fontSize={11} fontWeight={700} fill={c} fontFamily="monospace">
        {Math.round(value)}
      </text>
    </svg>
  );
}

// ── Section panel ─────────────────────────────────────────────────────────────
function Panel({ title, children, accent, theme = 'light' }) {
  const t = THEME[theme];
  return (
    <div style={{
      background: t.cardBg, border: `1px solid ${accent || t.cardBorder}`,
      borderTop: `3px solid ${accent || CONDENSE_BLUE}`,
      borderRadius: 12, padding: 16,
      boxShadow: theme === 'dark' ? 'none' : '0 1px 4px rgba(15,32,68,0.06)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: t.textDim,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, sub, valueColor, theme = 'light' }) {
  const t = THEME[theme];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0', borderBottom: `1px solid ${t.cardBorder}` }}>
      <span style={{ fontSize: 12, color: t.textDim }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: valueColor || t.text, fontFamily: 'monospace' }}>
          {value ?? '—'}
        </span>
        {sub && <div style={{ fontSize: 10, color: t.textFaint }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function StockExchangeDashboard() {
  const industry = INDUSTRIES.stockexchange;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);
  const { isMobile, isTablet, isTV } = useWindowSize();

  const [tpsHistory,    setTpsHistory]    = useState([]);
  const [msiHistory,    setMsiHistory]    = useState([]);
  const [fraudHistory,  setFraudHistory]  = useState([]);
  const [tickerFlash,   setTickerFlash]   = useState({}); // { [asset_id]: 'up' | 'down' }
  const [theme, setTheme] = useState(() => localStorage.getItem('stockexchange_theme') || 'dark');
  const prevRef = useRef({});
  const prevSegValueRef = useRef({});

  useEffect(() => { localStorage.setItem('stockexchange_theme', theme); }, [theme]);
  const tick    = useRef(0);

  const allAssets  = Object.values(assets);
  const session    = allAssets.find(a => a.asset_type === 'market_session');
  const segments   = allAssets.filter(a => a.asset_type === 'trading_segment');
  const brokers    = allAssets.filter(a => a.asset_type === 'broker_activity');
  const surv       = allAssets.find(a => a.asset_type === 'surveillance');

  // ── Rolling trend charts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    tick.current += 1;
    const t = tick.current;
    if (session.tps != null)
      setTpsHistory(h => [...h.slice(-MAX_HISTORY + 1), { t, tps: session.tps, avg: session.kpis?.avg_tps_10 }]);
    if (session.kpis?.market_stress_index != null)
      setMsiHistory(h => [...h.slice(-MAX_HISTORY + 1), { t, msi: session.kpis.market_stress_index }]);
    if (surv?.kpis?.fraud_risk_score != null)
      setFraudHistory(h => [...h.slice(-MAX_HISTORY + 1), { t, score: surv.kpis.fraud_risk_score }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  // Ticker flash — up/down flag per segment, from the REAL value_dop delta
  // since the last tick (not a random or timed decorative flash).
  useEffect(() => {
    const segs = allAssets.filter(a => a.asset_type === 'trading_segment');
    if (segs.length === 0) return;
    const flash = {};
    let changed = false;
    segs.forEach(s => {
      const prev = prevSegValueRef.current[s.asset_id];
      const cur = s.value_dop ?? 0;
      if (prev != null && cur !== prev) {
        flash[s.asset_id] = cur > prev ? 'up' : 'down';
        changed = true;
      }
      prevSegValueRef.current[s.asset_id] = cur;
    });
    if (changed) setTickerFlash(flash);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  const sk  = session?.kpis || {};
  const fk  = surv?.kpis    || {};

  // Top broker by value
  const topBroker = [...brokers].sort((a, b) => (b.value_today_dop || 0) - (a.value_today_dop || 0))[0];
  const flaggedBrokers = brokers.filter(b => b.kpis?.broker_anomaly_score >= 60 || b.is_flagged).length;

  // Segment bar data
  const segBarData = segments.map(s => ({
    name  : s.segment_name?.replace('Fixed Income', 'Fixed Inc'),
    trades: s.trades_count || 0,
    value : Math.round((s.value_dop || 0) / 1e6),
  }));

  // Broker bar data (top 8)
  const brokerBarData = [...brokers]
    .sort((a, b) => (b.trades_today || 0) - (a.trades_today || 0))
    .slice(0, 8)
    .map(b => ({
      name    : b.broker_name?.split(' ')[0],
      trades  : b.trades_today || 0,
      flagged : b.is_flagged,
      anomaly : b.kpis?.broker_anomaly_score || 0,
    }));

  const critAlerts = alerts.filter(a => a.severity === 'critical').length;


  // ── Not configured guard ────────────────────────────────────────────────────
  if (!industry.apiUrl) {
    return <NotConfiguredGuard theme={theme} />;
  }
  const t = THEME[theme];
  const ct = chartTheme(theme);
  return (
    <div style={{ padding: isMobile ? '12px 14px' : isTV ? '28px 40px' : '20px 24px', minHeight: '100vh', background: t.pageBg,
      fontFamily: 'system-ui, -apple-system, sans-serif', color: t.text }}>

      <ThemedDashboardHeader
        industryId="stockexchange"
        title="Stock Exchange Operations — BVRD"
        subtitle={`Exchange operations · ${session?.session_status === 'open' ? '🟢 Market Open' : '🔴 Market Closed'} · ${allAssets.length} monitors active`}
        status={status}
        onRefresh={refresh}
        theme={theme}
        onToggleTheme={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}
      />

      <TradingFloorHero
        photo={stockexchangeHero}
        badge={session?.session_status === 'open' ? 'MARKET OPEN' : 'MARKET CLOSED'}
        title="Trading Floor Operations"
        segments={segments}
        flash={tickerFlash}
        compact={compact}
        stats={[
          { label: 'Trades / Sec', value: fmt(session?.tps, 1), color: '#93c5fd' },
          { label: 'Participants', value: session?.session_participants ?? '—', color: '#fbbf24' },
          { label: 'Circuit Breakers', value: session?.session_circuit_breakers ?? '—', color: (session?.session_circuit_breakers ?? 0) > 0 ? '#f87171' : '#4ade80' },
          { label: 'Critical Alerts', value: critAlerts, color: critAlerts > 0 ? '#f87171' : '#4ade80' },
        ]}
      />

      {/* ── Top KPI strip ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <ThemedKPICard theme={theme}
          label="Trades / Second"
          value={fmt(session?.tps, 1)}
          color={CONDENSE_BLUE}
          sub={`Avg: ${fmt(sk.avg_tps_10)} · ${sk.throughput_status || '—'}`}
        />
        <ThemedKPICard theme={theme}
          label="Session Trades"
          value={compact(session?.session_total_trades)}
          color="#7c3aed"
          sub={session?.session_total_trades?.toLocaleString() ?? '—'}
        />
        <ThemedKPICard theme={theme}
          label="Session Value (DOP)"
          value={compact(session?.session_total_value_dop)}
          color="#0891b2"
          sub="Total traded value"
        />
        <ThemedKPICard theme={theme}
          label="Order Rejection Rate"
          value={fmt(session?.rejection_rate_pct, 2)}
          unit="%"
          color={session?.rejection_rate_pct > 5 ? '#dc2626' : '#16a34a'}
          sub={`System latency: ${fmt(session?.system_latency_ms, 0)}ms`}
        />
        <ThemedKPICard theme={theme}
          label="Active Participants"
          value={session?.session_participants ?? '—'}
          color="#f59e0b"
          sub="Unique brokers / traders"
        />
        <ThemedKPICard theme={theme}
          label="Circuit Breakers"
          value={session?.session_circuit_breakers ?? '—'}
          color={session?.session_circuit_breakers > 0 ? '#dc2626' : '#16a34a'}
          sub="Trading halts today"
        />
        <ThemedKPICard theme={theme}
          label="Critical Alerts"
          value={critAlerts}
          color={critAlerts > 0 ? '#dc2626' : '#64748b'}
          sub="Ops + surveillance"
        />
      </div>

      {/* ── 3-column main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Market Stress Index */}
        <Panel title="Market Stress Index" accent="#dc2626" theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <MetricGauge value={sk.market_stress_index} theme={theme} color={
              sk.market_stress_index >= 80 ? '#dc2626' :
              sk.market_stress_index >= 60 ? '#d97706' : '#16a34a'
            } size={72} />
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'monospace',
                color: sk.market_stress_index >= 60 ? '#dc2626' : t.text }}>
                {fmt(sk.market_stress_index, 0)}
              </div>
              <RiskBadge level={sk.msi_status} />
            </div>
          </div>
          <StatRow label="Rejection contrib"   value={`${fmt(sk.msi_rejection_contrib)}pts`} theme={theme} />
          <StatRow label="Latency contrib"     value={`${fmt(sk.msi_latency_contrib)}pts`} theme={theme} />
          <StatRow label="Circuit contrib"     value={`${fmt(sk.msi_circuit_contrib)}pts`} theme={theme} />
          <StatRow label="Settlement contrib"  value={`${fmt(sk.msi_settlement_contrib)}pts`} theme={theme} />
          <ResponsiveContainer width="100%" height={70} style={{ marginTop: 10 }}>
            <AreaChart data={msiHistory}>
              <defs>
                <linearGradient id="msiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide /> <YAxis hide domain={[0, 100]} />
              <ReferenceLine y={60} stroke="#dc2626" strokeDasharray="3 2" strokeOpacity={0.4} />
              <Area dataKey="msi" stroke="#dc2626" fill="url(#msiGrad)" dot={false} strokeWidth={1.5} />
              <Tooltip contentStyle={ct.tooltipStyle} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Order Flow Imbalance */}
        <Panel title="Order Flow & Trading Activity" accent={CONDENSE_BLUE} theme={theme}>
          {/* OFI bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: t.textDim }}>Order Flow Imbalance</span>
              <RiskBadge level={sk.ofi_signal === 'buy_pressure' ? 'low' : sk.ofi_signal === 'sell_pressure' ? 'elevated' : 'normal'} />
            </div>
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: t.cardBorder }}>
              <div style={{ width: `${sk.buy_pct || 50}%`, background: '#16a34a' }} />
              <div style={{ flex: 1, background: '#dc2626' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: t.textDim }}>
              <span>🟢 Buy {fmt(sk.buy_pct, 0)}%</span>
              <span style={{ fontWeight: 700, fontSize: 12, color: t.text, fontFamily: 'monospace' }}>
                OFI {sk.ofi != null ? (sk.ofi > 0 ? '+' : '') + fmt(sk.ofi, 1) : '—'}
              </span>
              <span>🔴 Sell {fmt(sk.sell_pct, 0)}%</span>
            </div>
          </div>

          <StatRow label="Trades this tick"     value={session?.trades_this_tick?.toLocaleString()} theme={theme} />
          <StatRow label="Avg TPS (10 ticks)"   value={fmt(sk.avg_tps_10)}      sub="trades/sec" theme={theme} />
          <StatRow label="TPS trend"             value={sk.tps_trend}           valueColor={sk.tps_trend === 'rising' ? '#0891b2' : sk.tps_trend === 'falling' ? '#d97706' : t.textDim} theme={theme} />
          <StatRow label="Throughput health"     value={`${fmt(sk.throughput_health_pct, 0)}%`} valueColor={sk.throughput_health_pct >= 80 ? '#dc2626' : '#16a34a'} theme={theme} />

          <ResponsiveContainer width="100%" height={70} style={{ marginTop: 10 }}>
            <AreaChart data={tpsHistory}>
              <defs>
                <linearGradient id="tpsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CONDENSE_BLUE} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={CONDENSE_BLUE} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide /> <YAxis hide />
              <Area dataKey="tps" stroke={CONDENSE_BLUE} fill="url(#tpsGrad)" dot={false} strokeWidth={1.5} />
              <Tooltip contentStyle={ct.tooltipStyle} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Settlement Risk */}
        <Panel title="Settlement & Clearing" accent="#7c3aed" theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <MetricGauge value={sk.settlement_risk_score} theme={theme}
              color={sk.settlement_risk_score >= 70 ? '#dc2626' : sk.settlement_risk_score >= 40 ? '#d97706' : '#16a34a'}
              size={72} />
            <div>
              <div style={{ fontSize: 13, color: t.textDim }}>Settlement Risk</div>
              <RiskBadge level={sk.settlement_risk_level} />
            </div>
          </div>
          <StatRow label="T+2 Compliance"       value={`${fmt(sk.t2_compliance_pct, 2)}%`}
            valueColor={sk.t2_compliance_pct < 99 ? '#dc2626' : '#16a34a'} theme={theme} />
          <StatRow label="Failed (session)"     value={session?.session_failed_settlement ?? '—'}
            valueColor={session?.session_failed_settlement > 0 ? '#dc2626' : '#16a34a'} theme={theme} />
          <StatRow label="Pending queue"        value={session?.pending_settlement} sub="T+2 queue" theme={theme} />
          <StatRow label="Queue pressure"       value={`${fmt(sk.settlement_queue_pressure, 0)}%`} theme={theme} />
          <StatRow label="System latency"       value={`${fmt(session?.system_latency_ms, 0)}ms`}
            valueColor={session?.system_latency_ms > 100 ? '#dc2626' : '#16a34a'} theme={theme} />
          <StatRow label="Latency status"       value={sk.latency_status} theme={theme} />
        </Panel>
      </div>

      {/* ── 2-column: Fraud + Segments ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Surveillance & Fraud Detection */}
        <Panel title="Market Surveillance & Fraud Detection" accent="#ef4444" theme={theme}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <MetricGauge value={fk.fraud_risk_score} theme={theme}
              color={fk.fraud_risk_score >= 70 ? '#dc2626' : fk.fraud_risk_score >= 40 ? '#d97706' : '#16a34a'}
              size={72} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace',
                color: fk.fraud_risk_score >= 40 ? '#dc2626' : t.text }}>
                {fmt(fk.fraud_risk_score, 0)}<span style={{ fontSize: 12, color: t.textFaint, marginLeft: 4 }}>/100</span>
              </div>
              <RiskBadge level={fk.fraud_risk_level} />
              {fk.dominant_alert_type && (
                <div style={{ fontSize: 10, color: t.textFaint, marginTop: 4 }}>
                  Top: {fk.dominant_alert_type.replace('_', ' ')}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Wash Trade',      value: fk.wash_trade_alerts,     weight: '×2.5', color: '#dc2626' },
              { label: 'Spoofing',        value: fk.spoofing_alerts,       weight: '×2.0', color: '#dc2626' },
              { label: 'Layering',        value: fk.layering_alerts,       weight: '×1.5', color: '#d97706' },
              { label: 'Unusual Volume',  value: fk.unusual_volume_flags,  weight: '×1.0', color: '#d97706' },
              { label: 'Insider Trading', value: fk.insider_trading_flags, weight: '×4.0', color: '#7c3aed' },
              { label: 'Escalated',       value: fk.alerts_escalated,      weight: '',     color: '#64748b' },
            ].map(item => (
              <div key={item.label} style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 8, padding: '8px 10px',
                borderLeft: `3px solid ${item.value > 0 ? item.color : t.cardBorder}` }}>
                <div style={{ fontSize: 9, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.label} <span style={{ color: t.textFaint }}>{item.weight}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace',
                  color: item.value > 0 ? item.color : t.textFaint }}>
                  {item.value ?? '—'}
                </div>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={65}>
            <AreaChart data={fraudHistory}>
              <defs>
                <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide /> <YAxis hide domain={[0, 100]} />
              <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="3 2" strokeOpacity={0.4} />
              <Area dataKey="score" stroke="#ef4444" fill="url(#fraudGrad)" dot={false} strokeWidth={1.5} />
              <Tooltip contentStyle={ct.tooltipStyle} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Trading Segments */}
        <Panel title="Trading Segments" accent="#0891b2" theme={theme}>
          {segments.length > 0 ? (
            <>
              <div style={{ marginBottom: 12 }}>
                {segments.map(s => {
                  const k = s.kpis || {};
                  return (
                    <div key={s.asset_id} style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${t.cardBorder}` }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{s.segment_name}</div>
                        <div style={{ fontSize: 10, color: t.textFaint }}>
                          Top: {s.top_security} ({fmt(s.top_security_pct, 0)}%)
                          {' · '}<RiskBadge level={k.concentration_risk === 'high' ? 'elevated' : 'normal'} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: CONDENSE_BLUE, fontFamily: 'monospace' }}>
                          {s.trades_count?.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 10, color: t.textFaint }}>
                          {compact(s.value_dop)} DOP
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={segBarData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: ct.axis, fontSize: 9 }} />
                  <YAxis hide />
                  <Tooltip contentStyle={ct.tooltipStyle} />
                  <Bar dataKey="trades" fill={CONDENSE_BLUE} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div style={{ color: t.textFaint, fontSize: 12, textAlign: 'center', padding: 24 }}>
              No segment data yet
            </div>
          )}
        </Panel>
      </div>

      {/* ── Broker Activity ── */}
      {brokers.length > 0 && (
        <div style={{ marginBottom: 16, background: t.cardBg, border: `1px solid ${t.cardBorder}`,
          borderTop: `3px solid ${flaggedBrokers > 0 ? '#dc2626' : '#f59e0b'}`,
          borderRadius: 12, padding: 16, boxShadow: theme === 'dark' ? 'none' : '0 1px 4px rgba(15,32,68,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.textDim,
              textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Broker / Dealer Activity
            </div>
            {flaggedBrokers > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: '#fee2e2', color: '#dc2626' }}>
                {flaggedBrokers} broker{flaggedBrokers > 1 ? 's' : ''} flagged
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc' }}>
                  {['Broker', 'Trades Today', 'Value (DOP)', 'Rejection %', 'Anomaly Score', 'Status'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10,
                      fontWeight: 600, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em',
                      borderBottom: `1px solid ${t.cardBorder}`, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...brokers]
                  .sort((a, b) => (b.trades_today || 0) - (a.trades_today || 0))
                  .map(b => {
                    const bk = b.kpis || {};
                    const isRisk = bk.broker_anomaly_score >= 60 || b.is_flagged;
                    return (
                      <tr key={b.asset_id} style={{ background: isRisk ? 'rgba(220,38,38,0.08)' : 'transparent',
                        borderBottom: `1px solid ${t.cardBorder}` }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: t.text }}>
                          {b.broker_name}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: t.text }}>
                          {b.trades_today?.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: t.textDim }}>
                          {compact(b.value_today_dop)}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace',
                          color: b.rejection_rate_pct > 5 ? '#dc2626' : t.textDim }}>
                          {fmt(b.rejection_rate_pct, 2)}%
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 60, height: 6, borderRadius: 3, background: t.cardBorder, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 3,
                                width: `${Math.min(100, bk.broker_anomaly_score || 0)}%`,
                                background: bk.broker_anomaly_score >= 60 ? '#dc2626' : bk.broker_anomaly_score >= 30 ? '#d97706' : '#16a34a',
                              }} />
                            </div>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: t.text }}>
                              {fmt(bk.broker_anomaly_score, 0)}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <RiskBadge level={bk.broker_status || 'normal'} />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Alert Feed ── */}
      <AlertFeed alerts={alerts} maxHeight={260} theme={theme} />
    </div>
  );
}
