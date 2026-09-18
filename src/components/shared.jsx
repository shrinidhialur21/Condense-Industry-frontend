// src/components/shared.jsx
// Reusable UI primitives shared across all industry dashboards.

import { useState } from 'react';
import {
  Lightning, Car, Wrench, AirplaneTilt, Factory,
  Truck, Bank, ShoppingCart, Hospital, ChartLineUp, Buildings,
  ArrowClockwise, Sun, Moon,
} from '@phosphor-icons/react';
import { useWindowSize } from '../hooks/useWindowSize.js';

export const CONDENSE_BLUE = '#257df0';
export const CONDENSE_GREY = '#767678';

// Phosphor icon map (used by DashboardHeader + sidebar + landing catalog)
export const INDUSTRY_ICONS = {
  energy:        Lightning,
  ev:            Car,
  automotive:    Wrench,
  aviation:      AirplaneTilt,
  manufacturing: Factory,
  logistics:     Truck,
  bfsi:          Bank,
  retail:        ShoppingCart,
  healthcare:    Hospital,
  stockexchange: ChartLineUp,
  travel:        Buildings,
};

// ── Connection status pill ────────────────────────────────────
export function ConnectionStatus({ status }) {
  const map = {
    connected:    { dot: '#16a34a', label: 'Live',          bg: '#dcfce7', color: '#15803d' },
    connecting:   { dot: '#d97706', label: 'Connecting…',   bg: '#fef3c7', color: '#b45309' },
    disconnected: { dot: '#94a3b8', label: 'Disconnected',  bg: '#f1f5f9', color: '#64748b' },
    error:        { dot: '#dc2626', label: 'Error',         bg: '#fee2e2', color: '#b91c1c' },
  };
  const s = map[status] || map.disconnected;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6, fontSize:11,
      color: s.color, fontFamily:'monospace', fontWeight:600,
      background: s.bg, padding:'4px 10px', borderRadius:20,
      border:`1px solid ${s.dot}40`,
    }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:s.dot,
        boxShadow: status === 'connected' ? `0 0 5px ${s.dot}` : 'none',
        display:'inline-block', flexShrink:0 }}/>
      {s.label}
    </span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
export function KPICard({ label, value, unit, trend, color = '#0284c7', sub }) {
  // Auto-shrink font for long values so they never overflow the card
  const strLen   = String(value ?? '—').length;
  const fontSize = strLen > 8 ? 20 : strLen > 6 ? 24 : 28;

  return (
    <div style={{
      background:'#ffffff', border:'1px solid #e2e8f0',
      borderRadius:12, padding:'16px 20px', minWidth:140, flex:'1 1 140px',
      boxShadow:'0 1px 4px rgba(15,32,68,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase',
        letterSpacing:'0.08em', marginBottom:6, whiteSpace:'nowrap',
        overflow:'hidden', textOverflow:'ellipsis' }}>{label}</div>
      <div style={{ fontSize, fontWeight:700, color, lineHeight:1,
        fontVariantNumeric:'tabular-nums', fontFamily:'monospace',
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
        {value ?? '—'}
        {unit && <span style={{ fontSize: Math.round(fontSize * 0.46), fontWeight:400, color:'#94a3b8', marginLeft:4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize:11, color:'#64748b', marginTop:4,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize:11, marginTop:4, color: trend >= 0 ? '#16a34a' : '#dc2626' }}>
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
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size / 2 + 10} style={{ overflow:'visible' }}>
      <path d={`M 8 ${size/2} A ${r} ${r} 0 0 1 ${size-8} ${size/2}`}
        fill="none" stroke="#e2e8f0" strokeWidth={6} strokeLinecap="round"/>
      <path d={`M 8 ${size/2} A ${r} ${r} 0 0 1 ${size-8} ${size/2}`}
        fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}/>
      <text x={size/2} y={size/2 + 6} textAnchor="middle"
        fontSize={13} fontWeight={700} fill={color} fontFamily="monospace">{score}</text>
    </svg>
  );
}

// ── Info tooltip (hover "i" icon with explanatory text) ────────
// Usage: <span style={{ display:'flex', alignItems:'center', gap:4 }}>Label <InfoTooltip text="..." /></span>
export function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position:'relative', display:'inline-flex', alignItems:'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        width:13, height:13, borderRadius:'50%', cursor:'help',
        background:'#cbd5e1', color:'#ffffff',
        fontSize:9, fontWeight:700, fontStyle:'normal', fontFamily:'system-ui,sans-serif',
        lineHeight:1, flexShrink:0,
      }}>i</span>
      {show && (
        <span style={{
          position:'absolute', bottom:'140%', left:'50%', transform:'translateX(-50%)',
          background:'#1e293b', color:'#f1f5f9', fontSize:11, fontWeight:400,
          lineHeight:1.4, padding:'8px 10px', borderRadius:6, width:220,
          textTransform:'none', letterSpacing:'normal', zIndex:50,
          boxShadow:'0 4px 12px rgba(0,0,0,0.25)', textAlign:'left',
        }}>
          {text}
          <span style={{
            position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)',
            width:0, height:0, borderLeft:'5px solid transparent',
            borderRight:'5px solid transparent', borderTop:'5px solid #1e293b',
          }} />
        </span>
      )}
    </span>
  );
}

// ── Alert row ─────────────────────────────────────────────────
export function AlertRow({ alert }) {
  const sevColor = {
    critical: '#ef4444',
    warning:  '#f59e0b',
    info:     '#3b82f6',
  }[alert.severity] || '#64748b';

  const sevBg = {
    critical: '#fff7f7',
    warning:  '#fffbeb',
    info:     '#eff6ff',
  }[alert.severity] || '#ffffff';

  const assetId = alert.asset_id || alert.source_asset || alert.assetId;

  return (
    <div style={{
      display:'flex', gap:10, alignItems:'flex-start',
      padding:'10px 14px', borderBottom:'1px solid #f1f5f9',
      fontSize:12, background: sevBg,
    }}>
      {/* Severity indicator */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, paddingTop:2, gap:3 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:sevColor,
          boxShadow:`0 0 5px ${sevColor}`, display:'block' }}/>
        <span style={{
          fontSize:8, fontWeight:700, color:sevColor,
          textTransform:'uppercase', letterSpacing:'0.05em', lineHeight:1,
        }}>
          {alert.severity || 'info'}
        </span>
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        {/* Asset badge */}
        {assetId && (
          <span style={{
            display:'inline-block', fontSize:9, fontWeight:700, fontFamily:'monospace',
            padding:'1px 6px', borderRadius:4, marginBottom:4,
            background:`${sevColor}18`, color:sevColor,
            border:`1px solid ${sevColor}30`,
          }}>
            {assetId}
          </span>
        )}
        <div style={{ color:'#1e293b', lineHeight:1.4 }}>{alert.message}</div>
        <div style={{ color:'#64748b', marginTop:3, display:'flex', gap:8, flexWrap:'wrap' }}>
          {alert.rule_id && <span style={{ fontFamily:'monospace', fontSize:10 }}>{alert.rule_id}</span>}
          <span style={{ fontSize:10 }}>{new Date(alert.timestamp).toLocaleTimeString()}</span>
          {alert.recommended_action && (
            <span style={{ color:'#7c3aed', fontSize:10 }}>→ {alert.recommended_action}</span>
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

  const critCount = alerts.filter(a => a.severity === 'critical').length;
  const warnCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div style={{
      background:'#ffffff', border:'1px solid #e2e8f0',
      borderRadius:12, overflow:'hidden',
      boxShadow:'0 1px 4px rgba(15,32,68,0.06)',
    }}>
      <div style={{ padding:'12px 16px', borderBottom:'1px solid #f1f5f9',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background: critCount > 0 ? '#fff7f7' : '#ffffff',
      }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#1e293b', display:'flex', alignItems:'center', gap:8 }}>
          🔔 Alerts
          {critCount > 0 && (
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
              background:'#fee2e2', color:'#dc2626' }}>{critCount} critical</span>
          )}
          {warnCount > 0 && (
            <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
              background:'#fef3c7', color:'#d97706' }}>{warnCount} warning</span>
          )}
          <span style={{ fontSize:11, color:'#94a3b8',
            background:'#f1f5f9', padding:'2px 6px', borderRadius:4 }}>
            {filtered.length}
          </span>
        </span>
        <div style={{ display:'flex', gap:4 }}>
          {sevOptions.map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              fontSize:10, padding:'3px 9px', borderRadius:6,
              border: filter === s ? '1px solid #cbd5e1' : '1px solid transparent',
              cursor:'pointer',
              background: filter === s ? '#f8fafc' : 'transparent',
              color: filter === s ? '#1e293b' : '#94a3b8',
              fontWeight: filter === s ? 600 : 400,
              textTransform:'uppercase', letterSpacing:'0.06em'
            }}>{s}</button>
          ))}
        </div>
      </div>
      <div style={{ maxHeight, overflowY:'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding:24, textAlign:'center', color:'#94a3b8', fontSize:12 }}>
            ✅ No alerts
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
    running:  { bg:'#dcfce7', color:'#16a34a', label:'Running' },
    normal:   { bg:'#dcfce7', color:'#16a34a', label:'Normal' },
    ok:       { bg:'#dcfce7', color:'#16a34a', label:'OK' },
    healthy:  { bg:'#dcfce7', color:'#16a34a', label:'Healthy' },
    fault:    { bg:'#fee2e2', color:'#dc2626', label:'Fault' },
    alarm:    { bg:'#fee2e2', color:'#dc2626', label:'Alarm' },
    trip:     { bg:'#fee2e2', color:'#dc2626', label:'Trip' },
    tamper:   { bg:'#fee2e2', color:'#dc2626', label:'Tamper' },
    degraded: { bg:'#fef3c7', color:'#d97706', label:'Degraded' },
  };
  const s = map[status] || { bg:'#f1f5f9', color:'#64748b', label: status };
  return (
    <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20,
      background:s.bg, color:s.color, textTransform:'uppercase', letterSpacing:'0.06em' }}>
      {s.label}
    </span>
  );
}

// ── Refresh Button ────────────────────────────────────────────
export function RefreshButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Refresh data"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 12, padding: '6px 12px', borderRadius: 8,
        border: '1px solid #e2e8f0', background: '#ffffff',
        color: '#475569', cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        transition: 'all 0.15s', fontWeight: 500,
      }}
    >
      <ArrowClockwise size={13} weight="bold" />
      Refresh
    </button>
  );
}

// ── Dashboard Header ─────────────────────────────────────────
// Standardised top header for every industry dashboard.
// Usage: <DashboardHeader industryId="energy" subtitle="3 turbines · 2 solar farms" status={status} onRefresh={refresh} />
export function DashboardHeader({ industryId, title, subtitle, status, onRefresh }) {
  const IconComp = INDUSTRY_ICONS[industryId];
  const { isMobile, isTV } = useWindowSize();
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: isMobile ? 'flex-start' : 'center',
      flexWrap: 'wrap',
      gap: isMobile ? 10 : 16,
      marginBottom: isMobile ? 16 : 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: isMobile ? 34 : 40, height: isMobile ? 34 : 40,
          borderRadius: 10, flexShrink: 0,
          background: `${CONDENSE_BLUE}18`,
          border: `1px solid ${CONDENSE_BLUE}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {IconComp && <IconComp size={isMobile ? 18 : 22} weight="duotone" color={CONDENSE_BLUE} />}
        </div>
        <div>
          <h1 style={{
            fontSize: isMobile ? 15 : isTV ? 22 : 18,
            fontWeight: 700, color: '#1e293b',
            margin: 0, lineHeight: 1.2,
          }}>
            {title}
          </h1>
          {subtitle && (
            <div style={{ fontSize: isMobile ? 11 : 12, color: CONDENSE_GREY, marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ConnectionStatus status={status} />
        {onRefresh && <RefreshButton onClick={onRefresh} />}
      </div>
    </div>
  );
}

// ── HealthGauge — light theme variant ────────────────────────
// Re-exported here; the original arc gauge still works for dark dashboards.
// KPICard, AlertFeed, StatusBadge, ConnectionStatus are now light-theme.

// ── Dashboard theme tokens (page shell only) ──────────────────
// Dense data cards (asset lists, detail panels, charts, AlertFeed) stay their
// existing light cards in both themes — they're self-contained inline styles,
// so they read fine floating on either page background without modification.
export const THEME = {
  dark: {
    pageBg: '#0b1220', text: '#e6eaf2', textDim: '#8b96b3', textFaint: '#5b6788',
    cardBg: '#121a2e', cardBorder: '#23304d', accent: '#5b9cf5',
  },
  light: {
    pageBg: '#f1f5f9', text: '#1e293b', textDim: '#64748b', textFaint: '#94a3b8',
    cardBg: '#ffffff', cardBorder: '#e2e8f0', accent: CONDENSE_BLUE,
  },
};

export function ThemeToggle({ theme, onToggle }) {
  const t = THEME[theme];
  return (
    <button onClick={onToggle} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: t.cardBg, border: `1px solid ${t.cardBorder}`,
      borderRadius: 8, padding: '7px 11px', cursor: 'pointer', color: t.textDim,
    }}>
      {theme === 'dark' ? <Sun size={14} weight="bold" /> : <Moon size={14} weight="bold" />}
      <span style={{ fontSize: 11.5, fontWeight: 600 }}>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}

// Themed header — replaces DashboardHeader (always-light) inside dashboards
// that support the light/dark toggle.
export function ThemedDashboardHeader({ industryId, title, subtitle, status, onRefresh, theme, onToggleTheme }) {
  const t = THEME[theme];
  const IconComp = INDUSTRY_ICONS[industryId];
  const { isMobile, isTV } = useWindowSize();
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap',
      gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: isMobile ? 34 : 40, height: isMobile ? 34 : 40,
          borderRadius: 10, flexShrink: 0,
          background: `${t.accent}20`, border: `1px solid ${t.accent}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {IconComp && <IconComp size={isMobile ? 18 : 22} weight="duotone" color={t.accent} />}
        </div>
        <div>
          <h1 style={{ fontSize: isMobile ? 15 : isTV ? 22 : 18, fontWeight: 700, color: t.text, margin: 0, lineHeight: 1.2 }}>{title}</h1>
          {subtitle && <div style={{ fontSize: isMobile ? 11 : 12, color: t.textDim, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ConnectionStatus status={status} />
        {onRefresh && <RefreshButton onClick={onRefresh} />}
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </div>
  );
}

// KPI tile that respects the page theme — shared.jsx's original KPICard stays
// always-light for anything not yet migrated to the toggle.
export function ThemedKPICard({ label, value, unit, color, sub, theme }) {
  const t = THEME[theme];
  const strLen = String(value ?? '—').length;
  const fontSize = strLen > 8 ? 20 : strLen > 6 ? 24 : 28;
  return (
    <div style={{
      background: t.cardBg, border: `1px solid ${t.cardBorder}`,
      borderRadius: 12, padding: '16px 20px', minWidth: 140, flex: '1 1 140px', overflow: 'hidden',
    }}>
      <div style={{ fontSize: 11, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value ?? '—'}
        {unit && <span style={{ fontSize: Math.round(fontSize * 0.46), fontWeight: 400, color: t.textFaint, marginLeft: 4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: t.textDim, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

// "Pipeline not deployed" placeholder — theme-aware so it matches whichever
// theme a dashboard's toggle is currently set to instead of always being light.
export function NotConfiguredGuard({ theme = 'dark' }) {
  const t = THEME[theme];
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', gap: 16, background: t.pageBg,
        fontFamily: 'system-ui,sans-serif', padding: 40 }}>
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(37,125,240,0.08)',
            animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
          }} />
          <div style={{
            position: 'relative', width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(37,125,240,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 12h2M19 12h2M12 3v2M12 19v2" stroke="#257df0" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="3" fill="#257df0" opacity="0.7" />
              <path d="M5.6 5.6l1.4 1.4M16.9 16.9l1.4 1.4M5.6 18.4l1.4-1.4M16.9 7.1l1.4-1.4"
                stroke="#257df0" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            </svg>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: t.text, marginBottom: 6 }}>No Live Data Available</div>
          <div style={{ fontSize: 13, color: t.textDim, maxWidth: 280, lineHeight: 1.6 }}>
            This pipeline isn't connected yet. Deploy the simulator and processor on Condense to start seeing real-time data.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.textFaint, display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: t.textDim }}>Waiting for connection</span>
        </div>
      </div>
      <style>{`@keyframes ping { 75%,100% { transform:scale(2); opacity:0; } }`}</style>
    </>
  );
}

// Generic photo hero — real industry photo + dark gradient + live stat chips.
// stats: [{ label, value, unit, color }]. Pass `badge` for the small live pill
// text (e.g. "LIVE CHARGING NETWORK"). Children render inside the overlay,
// above the stat row (e.g. for an industry-specific animated overlay layer).
export function PhotoHero({ photo, badge = 'LIVE', title, stats = [], children, minHeight = 220 }) {
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 20, minHeight }}>
      <img src={photo} alt={title} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(9,14,26,0.15) 0%, rgba(9,14,26,0.25) 55%, rgba(9,14,26,0.72) 100%)',
      }} />
      {children}
      <div style={{ position: 'relative', padding: '20px 24px', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', minHeight, boxSizing: 'border-box', pointerEvents: 'none' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(11,18,32,0.55)',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, padding: '4px 10px', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#e6eaf2', letterSpacing: '0.05em' }}>{badge}</span>
          </div>
          <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: '#ffffff' }}>{title}</div>
        </div>
        {stats.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
        )}
      </div>
    </div>
  );
}