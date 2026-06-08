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
  ConnectionStatus, KPICard, AlertFeed, StatusBadge, HealthGauge,
  DashboardHeader, RefreshButton,
} from '../../components/shared.jsx';

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

function MetricGauge({ value, max = 100, color, size = 64 }) {
  if (value == null) return null;
  const pct   = Math.min(100, Math.max(0, value / max * 100));
  const r     = size / 2 - 6;
  const circ  = Math.PI * r;
  const fill  = (pct / 100) * circ;
  const c     = color || (pct >= 70 ? '#dc2626' : pct >= 40 ? '#d97706' : '#16a34a');
  return (
    <svg width={size} height={size / 2 + 8} style={{ overflow: 'visible' }}>
      <path d={`M 6 ${size/2} A ${r} ${r} 0 0 1 ${size-6} ${size/2}`}
        fill="none" stroke="#e2e8f0" strokeWidth={5} strokeLinecap="round" />
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
function Panel({ title, children, accent }) {
  return (
    <div style={{
      background: '#ffffff', border: `1px solid ${accent || '#e2e8f0'}`,
      borderTop: `3px solid ${accent || CONDENSE_BLUE}`,
      borderRadius: 12, padding: 16,
      boxShadow: '0 1px 4px rgba(15,32,68,0.06)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, sub, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: valueColor || '#1e293b', fontFamily: 'monospace' }}>
          {value ?? '—'}
        </span>
        {sub && <div style={{ fontSize: 10, color: '#94a3b8' }}>{sub}</div>}
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
  const prevRef = useRef({});
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
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', minHeight:'70vh', gap:16, background:'#f8fafc',
        fontFamily:'system-ui,sans-serif', padding:40 }}>
        <div style={{ position:'relative', width:72, height:72 }}>
          <div style={{ position:'absolute', inset:0, borderRadius:'50%',
            background:'rgba(37,125,240,0.08)',
            animation:'ping 2s cubic-bezier(0,0,0.2,1) infinite' }}/>
          <div style={{ position:'relative', width:72, height:72, borderRadius:'50%',
            background:'rgba(37,125,240,0.12)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 12h2M19 12h2M12 3v2M12 19v2" stroke="#257df0" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="3" fill="#257df0" opacity="0.7"/>
            </svg>
          </div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:17, fontWeight:700, color:'#1e293b', marginBottom:6 }}>No Live Data Available</div>
          <div style={{ fontSize:13, color:'#94a3b8', maxWidth:280, lineHeight:1.6 }}>
            This pipeline isn't connected yet. Deploy the simulator and processor on Condense to start seeing real-time data.
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#cbd5e1', display:'inline-block' }}/>
          <span style={{ fontSize:12, color:'#94a3b8' }}>Waiting for connection</span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: isMobile ? '12px 14px' : isTV ? '28px 40px' : '20px 24px', minHeight: '100vh', background: '#f1f5f9',
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1e293b' }}>

      <DashboardHeader
        industryId="stockexchange"
        title="Stock Exchange Operations — BVRD"
        subtitle={`Exchange operations · ${session?.session_status === 'open' ? '🟢 Market Open' : '🔴 Market Closed'} · ${allAssets.length} monitors active`}
        status={status}
        onRefresh={refresh}
      />

      {/* ── Top KPI strip ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPICard
          label="Trades / Second"
          value={fmt(session?.tps, 1)}
          color={CONDENSE_BLUE}
          sub={`Avg: ${fmt(sk.avg_tps_10)} · ${sk.throughput_status || '—'}`}
        />
        <KPICard
          label="Session Trades"
          value={compact(session?.session_total_trades)}
          color="#7c3aed"
          sub={session?.session_total_trades?.toLocaleString() ?? '—'}
        />
        <KPICard
          label="Session Value (DOP)"
          value={compact(session?.session_total_value_dop)}
          color="#0891b2"
          sub="Total traded value"
        />
        <KPICard
          label="Order Rejection Rate"
          value={fmt(session?.rejection_rate_pct, 2)}
          unit="%"
          color={session?.rejection_rate_pct > 5 ? '#dc2626' : '#16a34a'}
          sub={`System latency: ${fmt(session?.system_latency_ms, 0)}ms`}
        />
        <KPICard
          label="Active Participants"
          value={session?.session_participants ?? '—'}
          color="#f59e0b"
          sub="Unique brokers / traders"
        />
        <KPICard
          label="Circuit Breakers"
          value={session?.session_circuit_breakers ?? '—'}
          color={session?.session_circuit_breakers > 0 ? '#dc2626' : '#16a34a'}
          sub="Trading halts today"
        />
        <KPICard
          label="Critical Alerts"
          value={critAlerts}
          color={critAlerts > 0 ? '#dc2626' : '#64748b'}
          sub="Ops + surveillance"
        />
      </div>

      {/* ── 3-column main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Market Stress Index */}
        <Panel title="Market Stress Index" accent="#dc2626">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <MetricGauge value={sk.market_stress_index} color={
              sk.market_stress_index >= 80 ? '#dc2626' :
              sk.market_stress_index >= 60 ? '#d97706' : '#16a34a'
            } size={72} />
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'monospace',
                color: sk.market_stress_index >= 60 ? '#dc2626' : '#1e293b' }}>
                {fmt(sk.market_stress_index, 0)}
              </div>
              <RiskBadge level={sk.msi_status} />
            </div>
          </div>
          <StatRow label="Rejection contrib"   value={`${fmt(sk.msi_rejection_contrib)}pts`} />
          <StatRow label="Latency contrib"     value={`${fmt(sk.msi_latency_contrib)}pts`} />
          <StatRow label="Circuit contrib"     value={`${fmt(sk.msi_circuit_contrib)}pts`} />
          <StatRow label="Settlement contrib"  value={`${fmt(sk.msi_settlement_contrib)}pts`} />
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
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Order Flow Imbalance */}
        <Panel title="Order Flow & Trading Activity" accent={CONDENSE_BLUE}>
          {/* OFI bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>Order Flow Imbalance</span>
              <RiskBadge level={sk.ofi_signal === 'buy_pressure' ? 'low' : sk.ofi_signal === 'sell_pressure' ? 'elevated' : 'normal'} />
            </div>
            <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: '#f1f5f9' }}>
              <div style={{ width: `${sk.buy_pct || 50}%`, background: '#16a34a' }} />
              <div style={{ flex: 1, background: '#dc2626' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10, color: '#64748b' }}>
              <span>🟢 Buy {fmt(sk.buy_pct, 0)}%</span>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', fontFamily: 'monospace' }}>
                OFI {sk.ofi != null ? (sk.ofi > 0 ? '+' : '') + fmt(sk.ofi, 1) : '—'}
              </span>
              <span>🔴 Sell {fmt(sk.sell_pct, 0)}%</span>
            </div>
          </div>

          <StatRow label="Trades this tick"     value={session?.trades_this_tick?.toLocaleString()} />
          <StatRow label="Avg TPS (10 ticks)"   value={fmt(sk.avg_tps_10)}      sub="trades/sec" />
          <StatRow label="TPS trend"             value={sk.tps_trend}           valueColor={sk.tps_trend === 'rising' ? '#0891b2' : sk.tps_trend === 'falling' ? '#d97706' : '#475569'} />
          <StatRow label="Throughput health"     value={`${fmt(sk.throughput_health_pct, 0)}%`} valueColor={sk.throughput_health_pct >= 80 ? '#dc2626' : '#16a34a'} />

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
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Settlement Risk */}
        <Panel title="Settlement & Clearing" accent="#7c3aed">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <MetricGauge value={sk.settlement_risk_score}
              color={sk.settlement_risk_score >= 70 ? '#dc2626' : sk.settlement_risk_score >= 40 ? '#d97706' : '#16a34a'}
              size={72} />
            <div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Settlement Risk</div>
              <RiskBadge level={sk.settlement_risk_level} />
            </div>
          </div>
          <StatRow label="T+2 Compliance"       value={`${fmt(sk.t2_compliance_pct, 2)}%`}
            valueColor={sk.t2_compliance_pct < 99 ? '#dc2626' : '#16a34a'} />
          <StatRow label="Failed (session)"     value={session?.session_failed_settlement ?? '—'}
            valueColor={session?.session_failed_settlement > 0 ? '#dc2626' : '#16a34a'} />
          <StatRow label="Pending queue"        value={session?.pending_settlement} sub="T+2 queue" />
          <StatRow label="Queue pressure"       value={`${fmt(sk.settlement_queue_pressure, 0)}%`} />
          <StatRow label="System latency"       value={`${fmt(session?.system_latency_ms, 0)}ms`}
            valueColor={session?.system_latency_ms > 100 ? '#dc2626' : '#16a34a'} />
          <StatRow label="Latency status"       value={sk.latency_status} />
        </Panel>
      </div>

      {/* ── 2-column: Fraud + Segments ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Surveillance & Fraud Detection */}
        <Panel title="Market Surveillance & Fraud Detection" accent="#ef4444">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <MetricGauge value={fk.fraud_risk_score}
              color={fk.fraud_risk_score >= 70 ? '#dc2626' : fk.fraud_risk_score >= 40 ? '#d97706' : '#16a34a'}
              size={72} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace',
                color: fk.fraud_risk_score >= 40 ? '#dc2626' : '#1e293b' }}>
                {fmt(fk.fraud_risk_score, 0)}<span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>/100</span>
              </div>
              <RiskBadge level={fk.fraud_risk_level} />
              {fk.dominant_alert_type && (
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
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
              <div key={item.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px',
                borderLeft: `3px solid ${item.value > 0 ? item.color : '#e2e8f0'}` }}>
                <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {item.label} <span style={{ color: '#94a3b8' }}>{item.weight}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace',
                  color: item.value > 0 ? item.color : '#cbd5e1' }}>
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
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* Trading Segments */}
        <Panel title="Trading Segments" accent="#0891b2">
          {segments.length > 0 ? (
            <>
              <div style={{ marginBottom: 12 }}>
                {segments.map(s => {
                  const k = s.kpis || {};
                  return (
                    <div key={s.asset_id} style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{s.segment_name}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>
                          Top: {s.top_security} ({fmt(s.top_security_pct, 0)}%)
                          {' · '}<RiskBadge level={k.concentration_risk === 'high' ? 'elevated' : 'normal'} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: CONDENSE_BLUE, fontFamily: 'monospace' }}>
                          {s.trades_count?.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>
                          {compact(s.value_dop)} DOP
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={segBarData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 }} />
                  <Bar dataKey="trades" fill={CONDENSE_BLUE} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', padding: 24 }}>
              No segment data yet
            </div>
          )}
        </Panel>
      </div>

      {/* ── Broker Activity ── */}
      {brokers.length > 0 && (
        <div style={{ marginBottom: 16, background: '#ffffff', border: '1px solid #e2e8f0',
          borderTop: `3px solid ${flaggedBrokers > 0 ? '#dc2626' : '#f59e0b'}`,
          borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(15,32,68,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#475569',
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
                <tr style={{ background: '#f8fafc' }}>
                  {['Broker', 'Trades Today', 'Value (DOP)', 'Rejection %', 'Anomaly Score', 'Status'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10,
                      fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em',
                      borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
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
                      <tr key={b.asset_id} style={{ background: isRisk ? '#fff7f7' : 'transparent',
                        borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b' }}>
                          {b.broker_name}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#1e293b' }}>
                          {b.trades_today?.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#475569' }}>
                          {compact(b.value_today_dop)}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace',
                          color: b.rejection_rate_pct > 5 ? '#dc2626' : '#475569' }}>
                          {fmt(b.rejection_rate_pct, 2)}%
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 60, height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 3,
                                width: `${Math.min(100, bk.broker_anomaly_score || 0)}%`,
                                background: bk.broker_anomaly_score >= 60 ? '#dc2626' : bk.broker_anomaly_score >= 30 ? '#d97706' : '#16a34a',
                              }} />
                            </div>
                            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
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
      <AlertFeed alerts={alerts} maxHeight={260} />
    </div>
  );
}
