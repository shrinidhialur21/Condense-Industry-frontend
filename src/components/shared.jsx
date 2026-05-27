// src/components/shared.jsx
// Reusable UI primitives shared across all industry dashboards.

import { useState } from 'react';

// ── Connection status pill ────────────────────────────────────
export function ConnectionStatus({ status }) {
  const map = {
    connected:    { dot: '#22c55e', label: 'Live' },
    connecting:   { dot: '#f59e0b', label: 'Connecting…' },
    disconnected: { dot: '#94a3b8', label: 'Disconnected' },
    error:        { dot: '#ef4444', label: 'Error' },
  };
  const { dot, label } = map[status] || map.disconnected;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12,
      color:'#94a3b8', fontFamily:'monospace' }}>
      <span style={{ width:8, height:8, borderRadius:'50%', background:dot,
        boxShadow: status === 'connected' ? `0 0 6px ${dot}` : 'none',
        display:'inline-block' }}/>
      {label}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
export function KPICard({ label, value, unit, trend, color = '#22c55e', sub }) {
  return (
    <div style={{
      background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:12, padding:'16px 20px', minWidth:140, flex:'1 1 140px'
    }}>
      <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase',
        letterSpacing:'0.08em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:700, color, lineHeight:1,
        fontVariantNumeric:'tabular-nums', fontFamily:'monospace' }}>
        {value ?? '—'}
        {unit && <span style={{ fontSize:13, fontWeight:400, color:'#64748b', marginLeft:4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize:11, color:'#475569', marginTop:4 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize:11, marginTop:4, color: trend >= 0 ? '#22c55e' : '#ef4444' }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}

// ── Health score gauge (simple arc) ──────────────────────────
export function HealthGauge({ score = 0, size = 80 }) {
  const r = (size / 2) - 8;
  const circ = Math.PI * r; // half circle
  const fill = (score / 100) * circ;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size / 2 + 10} style={{ overflow:'visible' }}>
      <path d={`M 8 ${size/2} A ${r} ${r} 0 0 1 ${size-8} ${size/2}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} strokeLinecap="round"/>
      <path d={`M 8 ${size/2} A ${r} ${r} 0 0 1 ${size-8} ${size/2}`}
        fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}/>
      <text x={size/2} y={size/2 + 6} textAnchor="middle"
        fontSize={14} fontWeight={700} fill={color} fontFamily="monospace">{score}</text>
    </svg>
  );
}

// ── Alert row ─────────────────────────────────────────────────
export function AlertRow({ alert }) {
  const sevColor = {
    critical: '#ef4444',
    warning:  '#f59e0b',
    info:     '#3b82f6',
  }[alert.severity] || '#64748b';

  return (
    <div style={{
      display:'flex', gap:10, alignItems:'flex-start',
      padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)',
      fontSize:12
    }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:sevColor,
        flexShrink:0, marginTop:4 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:'#e2e8f0', lineHeight:1.4 }}>{alert.message}</div>
        <div style={{ color:'#475569', marginTop:2, display:'flex', gap:10 }}>
          <span>{alert.rule_id}</span>
          <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
          {alert.recommended_action && (
            <span style={{ color:'#7c3aed' }}>→ {alert.recommended_action}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Alert feed panel ──────────────────────────────────────────
export function AlertFeed({ alerts, maxHeight = 300 }) {
  const [filter, setFilter] = useState('all');
  const sevOptions = ['all', 'critical', 'warning', 'info'];

  const filtered = filter === 'all'
    ? alerts
    : alerts.filter(a => a.severity === filter);

  return (
    <div style={{
      background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:12, overflow:'hidden'
    }}>
      <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>
          Alerts
          <span style={{ marginLeft:8, fontSize:11, color:'#64748b',
            background:'rgba(255,255,255,0.06)', padding:'2px 6px', borderRadius:4 }}>
            {filtered.length}
          </span>
        </span>
        <div style={{ display:'flex', gap:4 }}>
          {sevOptions.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              fontSize:10, padding:'2px 8px', borderRadius:4, border:'none', cursor:'pointer',
              background: filter === s ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: filter === s ? '#e2e8f0' : '#64748b',
              textTransform:'uppercase', letterSpacing:'0.06em'
            }}>{s}</button>
          ))}
        </div>
      </div>
      <div style={{ maxHeight, overflowY:'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding:24, textAlign:'center', color:'#475569', fontSize:12 }}>
            No alerts
          </div>
        ) : (
          [...filtered].reverse().map((a, i) => <AlertRow key={i} alert={a} />)
        )}
      </div>
    </div>
  );
}

// ── Asset status badge ────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    running:  { bg:'rgba(34,197,94,0.12)', color:'#22c55e', label:'Running' },
    normal:   { bg:'rgba(34,197,94,0.12)', color:'#22c55e', label:'Normal' },
    ok:       { bg:'rgba(34,197,94,0.12)', color:'#22c55e', label:'OK' },
    healthy:  { bg:'rgba(34,197,94,0.12)', color:'#22c55e', label:'Healthy' },
    fault:    { bg:'rgba(239,68,68,0.12)',  color:'#ef4444', label:'Fault' },
    alarm:    { bg:'rgba(239,68,68,0.12)',  color:'#ef4444', label:'Alarm' },
    trip:     { bg:'rgba(239,68,68,0.12)',  color:'#ef4444', label:'Trip' },
    tamper:   { bg:'rgba(239,68,68,0.12)',  color:'#ef4444', label:'Tamper' },
    degraded: { bg:'rgba(245,158,11,0.12)', color:'#f59e0b', label:'Degraded' },
  };
  const s = map[status] || { bg:'rgba(100,116,139,0.12)', color:'#64748b', label: status };
  return (
    <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
      background:s.bg, color:s.color, textTransform:'uppercase', letterSpacing:'0.06em' }}>
      {s.label}
    </span>
  );
}