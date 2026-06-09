// src/industries/platform/PlatformDashboard.jsx
// Platform Uptime & Health Dashboard — DevOps monitoring view
//
// Shows: overall platform status, per-pipeline health, throughput trend,
// alert statistics, data freshness, app uptime, SLA compliance.
// Polls all configured industry output-connector APIs every 30 seconds.

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import { usePlatformHealth, SLA_TARGET_PCT } from '../../hooks/usePlatformHealth.js';
import { INDUSTRIES } from '../../config/industries.js';
import { useWindowSize } from '../../hooks/useWindowSize.js';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
function fmtUptime(s) {
  if (s == null) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}
function timeAgo(iso) {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 5)   return 'just now';
  if (s < 60)  return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s/60)}m ago`;
  return `${Math.round(s/3600)}h ago`;
}

// ── Status colour map ─────────────────────────────────────────────────────────
const STATUS_STYLE = {
  live        : { bg:'#dcfce7', color:'#16a34a', dot:'#22c55e', label:'Live'         },
  stale       : { bg:'#fef3c7', color:'#b45309', dot:'#f59e0b', label:'Stale'        },
  offline     : { bg:'#fee2e2', color:'#b91c1c', dot:'#ef4444', label:'Offline'      },
  unconfigured: { bg:'#f1f5f9', color:'#64748b', dot:'#94a3b8', label:'Not Deployed' },
  no_pipelines: { bg:'#f1f5f9', color:'#64748b', dot:'#94a3b8', label:'No Pipelines' },
  operational : { bg:'#dcfce7', color:'#166534', dot:'#22c55e', label:'All Systems Operational' },
  degraded    : { bg:'#fef3c7', color:'#92400e', dot:'#f59e0b', label:'Degraded'     },
  partial_outage:{ bg:'#fff7ed',color:'#c2410c', dot:'#f97316', label:'Partial Outage'},
  major_outage: { bg:'#fee2e2', color:'#991b1b', dot:'#ef4444', label:'Major Outage' },
};
function StatusPill({ status, size = 'sm' }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.unconfigured;
  const fs = size === 'lg' ? 13 : 10;
  const pd = size === 'lg' ? '5px 12px' : '2px 8px';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:fs,
      fontWeight:700, padding:pd, borderRadius:20,
      background:s.bg, color:s.color, textTransform:'uppercase', letterSpacing:'0.05em' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:s.dot,
        boxShadow: status === 'live' ? `0 0 5px ${s.dot}` : 'none', flexShrink:0 }}/>
      {s.label}
    </span>
  );
}

// ── Uptime % bar ──────────────────────────────────────────────────────────────
function UptimeBar({ pct }) {
  if (pct == null) return <span style={{ fontSize:10, color:'#94a3b8' }}>—</span>;
  const color = pct >= SLA_TARGET_PCT ? '#22c55e' : pct >= 99 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, height:4, background:'#e2e8f0', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${Math.min(100, pct)}%`, background:color,
          borderRadius:2, transition:'width 0.4s' }} />
      </div>
      <span style={{ fontSize:10, fontWeight:700, color, fontFamily:'monospace', flexShrink:0 }}>
        {pct.toFixed(2)}%
      </span>
    </div>
  );
}

// ── Freshness indicator ───────────────────────────────────────────────────────
function FreshnessDot({ seconds }) {
  if (seconds == null) return <span style={{ fontSize:10, color:'#94a3b8' }}>—</span>;
  const color = seconds < 5  ? '#22c55e'
              : seconds < 30 ? '#f59e0b'
              : seconds < 120? '#f97316'
              : '#ef4444';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10,
      fontWeight:600, color, fontFamily:'monospace' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:color,
        boxShadow: seconds < 5 ? `0 0 4px ${color}` : 'none', flexShrink:0 }}/>
      {seconds < 1 ? '<1s' : `${Math.round(seconds)}s`}
    </span>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, unit, sub, color = '#0f172a', accent = '#257df0', icon }) {
  return (
    <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:12,
      padding:'16px 18px', boxShadow:'0 1px 4px rgba(15,32,68,0.06)',
      borderTop: `3px solid ${accent}`, flex:'1 1 130px', minWidth:130 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div style={{ fontSize:11, color:'#64748b', fontWeight:600, textTransform:'uppercase',
          letterSpacing:'0.08em', lineHeight:1.3 }}>{label}</div>
        {icon && <span style={{ fontSize:18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize:26, fontWeight:800, color, fontFamily:'monospace',
        lineHeight:1, letterSpacing:'-0.02em' }}>
        {value ?? '—'}
        {unit && <span style={{ fontSize:13, color:'#94a3b8', marginLeft:4, fontWeight:400 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize:10, color:'#94a3b8', marginTop:5 }}>{sub}</div>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', letterSpacing:'0.01em' }}>{title}</div>
      {sub && <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function PlatformDashboard() {
  const { pipelines, summary, history, loading, lastChecked, refresh } = usePlatformHealth();
  const { isMobile, isTablet, isTV } = useWindowSize();

  // Countdown to next poll
  const [countdown, setCountdown] = useState(30);
  const lastCheckedRef = useRef(lastChecked);
  useEffect(() => {
    lastCheckedRef.current = lastChecked;
    setCountdown(30);
  }, [lastChecked]);
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const pad = isMobile ? '12px 14px' : isTV ? '32px 40px' : '24px 28px';
  const ovStyle = STATUS_STYLE[summary.overall_status] || STATUS_STYLE.unconfigured;

  // ── Sort pipelines: live first, then stale, offline, unconfigured
  const sortedPipelines = [...pipelines].sort((a, b) => {
    const order = { live:0, stale:1, offline:2, unconfigured:3 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  // ── Build per-pipeline alert breakdown for chart
  const alertChartData = pipelines
    .filter(p => p.total_alerts > 0 || p.status !== 'unconfigured')
    .map(p => ({
      name   : INDUSTRIES[p.id]?.shortName || p.id,
      alerts : p.total_alerts ?? 0,
      msgs   : p.total_messages ?? 0,
    }))
    .sort((a, b) => b.alerts - a.alerts)
    .slice(0, 8);

  return (
    <div style={{ padding:pad, minHeight:'100vh', background:'#f1f5f9', fontFamily:'system-ui,sans-serif' }}>

      {/* ── Page Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        flexWrap:'wrap', gap:12, marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:'rgba(37,125,240,0.12)',
            border:'1px solid rgba(37,125,240,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <path d="M2 12h2M20 12h2M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                stroke="#257df0" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="4" fill="#257df0" fillOpacity="0.8"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: isMobile ? 16 : 20, fontWeight:800, color:'#0f172a', margin:0 }}>
              Platform Health & Uptime
            </h1>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
              Condense Industry Demo · {summary.deployed} pipelines deployed · polling every 30s
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* Countdown ring */}
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#64748b' }}>
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="#e2e8f0" strokeWidth="2"/>
              <circle cx="8" cy="8" r="6" stroke="#257df0" strokeWidth="2"
                strokeDasharray={`${(countdown/30)*37.7} 37.7`}
                strokeLinecap="round" transform="rotate(-90 8 8)"
                style={{ transition:'stroke-dasharray 0.9s linear' }}/>
            </svg>
            Refresh in {countdown}s
          </div>
          <button onClick={refresh} style={{
            display:'flex', alignItems:'center', gap:5, fontSize:12, padding:'6px 12px',
            borderRadius:8, border:'1px solid #e2e8f0', background:'#ffffff',
            color:'#475569', cursor:'pointer', fontWeight:500,
          }}>
            ↻ Refresh Now
          </button>
          {lastChecked && (
            <div style={{ fontSize:11, color:'#94a3b8' }}>
              Checked {timeAgo(lastChecked)}
            </div>
          )}
        </div>
      </div>

      {/* ── Overall Status Banner ── */}
      <div style={{
        background: ovStyle.bg, border:`1.5px solid ${ovStyle.dot}40`,
        borderRadius:12, padding:'16px 20px', marginBottom:24,
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ width:14, height:14, borderRadius:'50%', background:ovStyle.dot,
            boxShadow: summary.overall_status === 'operational' ? `0 0 8px ${ovStyle.dot}` : 'none',
            flexShrink:0, display:'block' }} />
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:ovStyle.color }}>
              {ovStyle.label}
            </div>
            <div style={{ fontSize:11, color:ovStyle.color, opacity:0.75, marginTop:2 }}>
              {summary.live} live · {summary.stale} stale · {summary.offline} offline · {summary.unconfigured} not deployed
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:800, color:ovStyle.color, fontFamily:'monospace' }}>
              {summary.platform_uptime_pct != null ? `${summary.platform_uptime_pct.toFixed(2)}%` : '—'}
            </div>
            <div style={{ fontSize:10, color:ovStyle.color, opacity:0.7 }}>Platform Uptime</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:800,
              color: (summary.platform_uptime_pct ?? 0) >= SLA_TARGET_PCT ? '#16a34a' : '#dc2626',
              fontFamily:'monospace' }}>
              {(summary.platform_uptime_pct ?? 0) >= SLA_TARGET_PCT ? '✓' : '✗'} {SLA_TARGET_PCT}%
            </div>
            <div style={{ fontSize:10, color:'#64748b' }}>SLA Target</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:800, color:ovStyle.color, fontFamily:'monospace' }}>
              {fmtNum(summary.total_messages)}
            </div>
            <div style={{ fontSize:10, color:ovStyle.color, opacity:0.7 }}>Messages Processed</div>
          </div>
        </div>
      </div>

      {/* ── Quick Stats Row ── */}
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <MetricCard
          label="Live Pipelines" icon="🟢"
          value={`${summary.live}/${summary.total_pipelines}`}
          color={summary.live === summary.deployed ? '#16a34a' : '#d97706'}
          accent="#22c55e"
          sub={`${summary.deployed} deployed · ${summary.unconfigured} not configured`}
        />
        <MetricCard
          label="Total Messages" icon="📨"
          value={fmtNum(summary.total_messages)}
          accent="#257df0"
          sub={`${summary.total_msg_per_sec} msg/s current throughput`}
        />
        <MetricCard
          label="Assets Online" icon="📡"
          value={summary.total_assets}
          accent="#8b5cf6"
          sub="Tracked across all live pipelines"
        />
        <MetricCard
          label="Avg Freshness" icon="⏱"
          value={summary.avg_freshness_s != null ? `${summary.avg_freshness_s}s` : '—'}
          color={summary.avg_freshness_s != null && summary.avg_freshness_s < 10 ? '#16a34a' : '#d97706'}
          accent="#06b6d4"
          sub="Seconds since last data received"
        />
        <MetricCard
          label="WS Sessions" icon="🔌"
          value={summary.total_ws_clients}
          accent="#f59e0b"
          sub="Active WebSocket connections"
        />
        <MetricCard
          label="Total Alerts" icon="🔔"
          value={fmtNum(summary.total_alerts)}
          color={summary.total_alerts > 0 ? '#d97706' : '#16a34a'}
          accent="#ef4444"
          sub="All-time across all pipelines"
        />
        <MetricCard
          label="Avg API Response" icon="⚡"
          value={summary.avg_response_ms != null ? `${summary.avg_response_ms}ms` : '—'}
          color={summary.avg_response_ms != null && summary.avg_response_ms < 200 ? '#16a34a' : '#d97706'}
          accent="#10b981"
          sub="Health endpoint latency"
        />
      </div>

      {/* ── Pipeline Status Table ── */}
      <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:14,
        overflow:'hidden', marginBottom:24, boxShadow:'0 1px 4px rgba(15,32,68,0.06)' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <SectionHeader title="Pipeline Status" sub="Per-industry health, throughput, and SLA compliance" />
          {loading && <span style={{ fontSize:11, color:'#94a3b8', fontStyle:'italic' }}>Polling…</span>}
        </div>

        {/* Table header */}
        <div style={{ display:'grid',
          gridTemplateColumns: isMobile ? '1fr 80px' : '1.8fr 100px 70px 80px 90px 80px 85px 80px 75px',
          gap:0, background:'#f8fafc', borderBottom:'1px solid #f1f5f9',
          padding:'8px 20px', fontSize:10, fontWeight:700, color:'#94a3b8',
          textTransform:'uppercase', letterSpacing:'0.08em' }}>
          <div>Pipeline</div>
          <div>Status</div>
          {!isMobile && <><div>Assets</div><div>Messages</div><div>Msg/s</div>
          <div>Last Data</div><div>Uptime %</div><div>App Up</div><div>WS</div></>}
        </div>

        {/* Table rows */}
        {sortedPipelines.length === 0 && loading && (
          <div style={{ padding:40, textAlign:'center', color:'#94a3b8', fontSize:12 }}>
            Polling pipeline APIs…
          </div>
        )}
        {sortedPipelines.map((p, i) => {
          const ind = INDUSTRIES[p.id];
          const s   = STATUS_STYLE[p.status] || STATUS_STYLE.unconfigured;
          const isLive = p.status === 'live';
          const slaOk  = p.uptime_pct != null && p.uptime_pct >= SLA_TARGET_PCT;
          return (
            <div key={p.id} style={{
              display:'grid',
              gridTemplateColumns: isMobile ? '1fr 80px' : '1.8fr 100px 70px 80px 90px 80px 85px 80px 75px',
              gap:0,
              padding:'12px 20px',
              borderBottom: i < sortedPipelines.length - 1 ? '1px solid #f8fafc' : 'none',
              background: p.status === 'offline' ? '#fff9f9' : p.status === 'live' ? '#fafffe' : '#ffffff',
              alignItems:'center',
              transition:'background 0.2s',
            }}>
              {/* Pipeline name */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:16 }}>{ind?.icon ?? '📊'}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1e293b' }}>{ind?.shortName ?? p.id}</div>
                  {!isMobile && (
                    <div style={{ fontSize:10, color:'#94a3b8' }}>{ind?.description?.split(',')[0] ?? ''}</div>
                  )}
                </div>
                {/* SLA badge */}
                {!isMobile && p.uptime_pct != null && (
                  <span style={{ fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:8,
                    background: slaOk ? '#dcfce7' : '#fee2e2',
                    color: slaOk ? '#16a34a' : '#dc2626' }}>
                    {slaOk ? '✓ SLA' : '✗ SLA'}
                  </span>
                )}
              </div>

              {/* Status pill */}
              <div><StatusPill status={p.status} /></div>

              {!isMobile && <>
                {/* Assets */}
                <div style={{ fontSize:12, fontWeight:600, color:'#475569', fontFamily:'monospace' }}>
                  {p.status === 'unconfigured' ? '—' : (p.assets_online ?? 0)}
                </div>

                {/* Total Messages */}
                <div style={{ fontSize:12, fontWeight:600, color:'#475569', fontFamily:'monospace' }}>
                  {p.status === 'unconfigured' ? '—' : fmtNum(p.total_messages)}
                </div>

                {/* Msg/s */}
                <div style={{ fontSize:12, fontWeight:600,
                  color: (p.msg_per_sec ?? 0) > 0 ? '#22c55e' : '#94a3b8', fontFamily:'monospace' }}>
                  {p.status === 'unconfigured' ? '—' : `${p.msg_per_sec ?? 0}/s`}
                </div>

                {/* Last data / freshness */}
                <div>
                  {p.status === 'unconfigured' ? (
                    <span style={{ fontSize:10, color:'#94a3b8' }}>—</span>
                  ) : p.freshness_s != null ? (
                    <FreshnessDot seconds={p.freshness_s} />
                  ) : (
                    <span style={{ fontSize:10, color:'#94a3b8' }}>no data yet</span>
                  )}
                </div>

                {/* Uptime % bar */}
                <div style={{ minWidth:0 }}>
                  {p.status === 'unconfigured' ? (
                    <span style={{ fontSize:10, color:'#94a3b8' }}>—</span>
                  ) : (
                    <UptimeBar pct={p.uptime_pct} />
                  )}
                </div>

                {/* App uptime (from /health) */}
                <div style={{ fontSize:11, color:'#64748b', fontFamily:'monospace' }}>
                  {p.status === 'unconfigured' ? '—' : fmtUptime(p.uptime_s)}
                </div>

                {/* WS clients */}
                <div style={{ fontSize:12, fontWeight:600, color:'#475569', fontFamily:'monospace' }}>
                  {p.status === 'unconfigured' ? '—' : (p.ws_clients ?? 0)}
                  {p.status !== 'unconfigured' && p.responseTime != null && (
                    <div style={{ fontSize:9, color:'#94a3b8' }}>{p.responseTime}ms</div>
                  )}
                </div>
              </>}
            </div>
          );
        })}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, marginBottom:24 }}>

        {/* Throughput trend */}
        <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:14,
          padding:'16px 20px', boxShadow:'0 1px 4px rgba(15,32,68,0.06)' }}>
          <SectionHeader
            title="📈 Message Throughput Trend"
            sub="Messages processed per 30-second poll window"
          />
          {history.length < 2 ? (
            <div style={{ height:180, display:'flex', alignItems:'center',
              justifyContent:'center', color:'#94a3b8', fontSize:12 }}>
              Collecting data… (first data point in ~30s)
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={history} margin={{ top:5, right:10, bottom:5, left:0 }}>
                <defs>
                  <linearGradient id="gMsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#257df0" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#257df0" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gDelta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} width={45} tickFormatter={v => fmtNum(v)} />
                <Tooltip
                  contentStyle={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:8, fontSize:11 }}
                  formatter={(v, name) => [fmtNum(v), name]}
                />
                <Legend wrapperStyle={{ fontSize:10, color:'#64748b' }} />
                <Area type="monotone" dataKey="msg_delta" name="New msgs/30s"
                  stroke="#22c55e" fill="url(#gDelta)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="live_pipes" name="Live pipelines"
                  stroke="#257df0" fill="url(#gMsg)" strokeWidth={2} dot={false} isAnimationActive={false} yAxisId={0} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Alert distribution per pipeline */}
        <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:14,
          padding:'16px 20px', boxShadow:'0 1px 4px rgba(15,32,68,0.06)' }}>
          <SectionHeader
            title="🔔 Alert Distribution by Pipeline"
            sub="Total alerts generated since app start"
          />
          {alertChartData.filter(d => d.alerts > 0).length === 0 ? (
            <div style={{ height:200, display:'flex', alignItems:'center',
              justifyContent:'center', color:'#94a3b8', fontSize:12 }}>
              No alerts yet across any pipeline
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={alertChartData} margin={{ top:5, right:10, bottom:20, left:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize:9, fill:'#94a3b8' }} tickLine={false} axisLine={false} width={35} />
                <Tooltip
                  contentStyle={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:8, fontSize:11 }} />
                <Bar dataKey="alerts" name="Alerts" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Data Freshness + SLA Grid ── */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, marginBottom:24 }}>

        {/* Data Freshness heatmap */}
        <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:14,
          padding:'16px 20px', boxShadow:'0 1px 4px rgba(15,32,68,0.06)' }}>
          <SectionHeader
            title="⏱ Data Freshness"
            sub="How old is the latest message from each pipeline"
          />
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {sortedPipelines.filter(p => p.status !== 'unconfigured').map(p => {
              const ind = INDUSTRIES[p.id];
              const color = p.freshness_s == null ? '#94a3b8'
                : p.freshness_s < 5  ? '#22c55e'
                : p.freshness_s < 30 ? '#16a34a'
                : p.freshness_s < 120? '#f59e0b'
                : '#ef4444';
              const barWidth = p.freshness_s == null ? 0
                : Math.min(100, 100 - (p.freshness_s / 300 * 100));
              return (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:14, flexShrink:0 }}>{ind?.icon ?? '📊'}</span>
                  <div style={{ fontSize:11, fontWeight:600, color:'#475569', width:90, flexShrink:0,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {ind?.shortName ?? p.id}
                  </div>
                  <div style={{ flex:1, height:6, background:'#f1f5f9', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${barWidth}%`,
                      background:color, borderRadius:3, transition:'width 0.4s' }} />
                  </div>
                  <FreshnessDot seconds={p.freshness_s} />
                </div>
              );
            })}
            {sortedPipelines.filter(p => p.status !== 'unconfigured').length === 0 && (
              <div style={{ color:'#94a3b8', fontSize:12 }}>No deployed pipelines</div>
            )}
          </div>
          <div style={{ marginTop:12, display:'flex', gap:12, flexWrap:'wrap' }}>
            {[['#22c55e','< 5s (Excellent)'],['#f59e0b','30–120s (Stale)'],['#ef4444','> 2min (Critical)']].map(([c,l]) => (
              <span key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:'#64748b' }}>
                <span style={{ width:8, height:8, borderRadius:2, background:c, display:'inline-block' }}/>
                {l}
              </span>
            ))}
          </div>
        </div>

        {/* SLA Compliance grid */}
        <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:14,
          padding:'16px 20px', boxShadow:'0 1px 4px rgba(15,32,68,0.06)' }}>
          <SectionHeader
            title={`✅ SLA Compliance (Target: ${SLA_TARGET_PCT}%)`}
            sub="Session-level availability — resets on page reload"
          />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px,1fr))', gap:8 }}>
            {sortedPipelines.map(p => {
              const ind  = INDUSTRIES[p.id];
              const isConf = p.status !== 'unconfigured';
              const ok   = p.uptime_pct != null && p.uptime_pct >= SLA_TARGET_PCT;
              return (
                <div key={p.id} style={{
                  background: !isConf ? '#f8fafc' : ok ? '#f0fdf4' : '#fff9f9',
                  border:`1px solid ${!isConf ? '#e2e8f0' : ok ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius:8, padding:'8px 10px', textAlign:'center',
                }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{ind?.icon ?? '📊'}</div>
                  <div style={{ fontSize:9, fontWeight:600, color:'#475569', marginBottom:4,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {ind?.shortName ?? p.id}
                  </div>
                  {!isConf ? (
                    <div style={{ fontSize:8, color:'#94a3b8' }}>Not deployed</div>
                  ) : p.uptime_pct == null ? (
                    <div style={{ fontSize:8, color:'#94a3b8' }}>Polling…</div>
                  ) : (
                    <>
                      <div style={{ fontSize:11, fontWeight:800,
                        color: ok ? '#16a34a' : '#dc2626', fontFamily:'monospace' }}>
                        {p.uptime_pct.toFixed(1)}%
                      </div>
                      <div style={{ fontSize:8, color: ok ? '#16a34a' : '#dc2626', marginTop:2 }}>
                        {ok ? '✓ SLA met' : '✗ Below SLA'}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:10, fontSize:10, color:'#94a3b8', fontStyle:'italic' }}>
            Note: Uptime % is based on this browser session's polls. For production SLA tracking,
            use Prometheus + Grafana with persistent metrics.
          </div>
        </div>
      </div>

      {/* ── Detailed Pipeline Cards ── */}
      <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:14,
        overflow:'hidden', boxShadow:'0 1px 4px rgba(15,32,68,0.06)' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9' }}>
          <SectionHeader
            title="🔍 Pipeline Details"
            sub="Expanded view — app uptime, error rate, response times"
          />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:0 }}>
          {sortedPipelines.map((p, i) => {
            const ind  = INDUSTRIES[p.id];
            const s    = STATUS_STYLE[p.status] || STATUS_STYLE.unconfigured;
            const isConf = p.status !== 'unconfigured';
            const errorRate = p.total_messages > 0 && p.total_alerts != null
              ? parseFloat((p.total_alerts / p.total_messages * 100).toFixed(2)) : null;
            return (
              <div key={p.id} style={{
                padding:'14px 16px',
                borderRight: (i % 4 !== 3 && !isMobile) ? '1px solid #f1f5f9' : 'none',
                borderBottom:'1px solid #f1f5f9',
              }}>
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:20 }}>{ind?.icon ?? '📊'}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'#1e293b' }}>{ind?.shortName ?? p.id}</div>
                      <div style={{ fontSize:9, color:'#94a3b8' }}>{ind?.id ?? p.id}</div>
                    </div>
                  </div>
                  <StatusPill status={p.status} />
                </div>

                {/* Metrics */}
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {[
                    { label:'App Uptime',     val: isConf ? fmtUptime(p.uptime_s)   : '—' },
                    { label:'Total Messages', val: isConf ? fmtNum(p.total_messages) : '—' },
                    { label:'Total Alerts',   val: isConf ? fmtNum(p.total_alerts)   : '—' },
                    { label:'Error Rate',     val: isConf && errorRate != null ? `${errorRate}%` : '—',
                      warn: errorRate != null && errorRate > 5 },
                    { label:'Response Time',  val: isConf && p.responseTime != null ? `${p.responseTime}ms` : '—',
                      warn: p.responseTime != null && p.responseTime > 500 },
                    { label:'WS Clients',     val: isConf ? String(p.ws_clients ?? 0) : '—' },
                    { label:'Assets Tracked', val: isConf ? String(p.assets_online ?? 0) : '—' },
                    { label:'Session Uptime', val: isConf && p.uptime_pct != null ? `${p.uptime_pct.toFixed(2)}%` : '—',
                      good: p.uptime_pct >= SLA_TARGET_PCT },
                  ].map(item => (
                    <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:10, color:'#94a3b8' }}>{item.label}</span>
                      <span style={{ fontSize:11, fontWeight:600, fontFamily:'monospace',
                        color: item.warn ? '#d97706' : item.good ? '#16a34a' : '#475569' }}>
                        {item.val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Error indicator */}
                {p.error && (
                  <div style={{ marginTop:8, fontSize:9, color:'#dc2626',
                    background:'#fee2e2', padding:'4px 6px', borderRadius:4 }}>
                    ⚠ {p.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ marginTop:20, padding:'12px 0', borderTop:'1px solid #e2e8f0',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        fontSize:10, color:'#94a3b8', flexWrap:'wrap', gap:8 }}>
        <span>Condense Industry Demo · Platform Health Monitor · Zeliot 2026</span>
        <span>Polling all {summary.deployed} deployed pipelines every 30s · {summary.total_pipelines} industries total</span>
      </div>
    </div>
  );
}
