// src/App.jsx
// Root shell — sidebar + industry dashboard area.
// Features:
//   • Phosphor icons for each industry
//   • Condense.png logo top-left
//   • Hash-based routing (#/energy) — browser refresh keeps current industry
//   • "Live" dot only shown when apiUrl is configured (pipeline deployed)
//   • localStorage fallback for active industry persistence

import { useState, useEffect, useCallback } from 'react';
import { useWindowSize } from './hooks/useWindowSize.js';
import {
  Lightning, Car, Wrench, AirplaneTilt, Factory,
  Truck, Bank, ShoppingCart, Hospital, ChartLineUp, Buildings,
  CaretLeft, CaretRight, Eye, EyeSlash, LockKey, User, SignOut, Heartbeat,
} from '@phosphor-icons/react';

// ── Hardcoded credentials ─────────────────────────────────────────────────────
const VALID_USER = 'condense';
const VALID_PASS = 'Condenseisthefuture';
const SESSION_KEY = 'condense_authed';

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [shake,    setShake]    = useState(false);
  const { isMobile, isTablet, isTV } = useWindowSize();

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTimeout(() => {
      if (username.trim().toLowerCase() === VALID_USER && password === VALID_PASS) {
        sessionStorage.setItem(SESSION_KEY, '1');
        onLogin();
      } else {
        setError('Invalid username or password.');
        setLoading(false);
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    }, 400);
  }

  // Industry nodes — Phosphor icon components, rendered via foreignObject inside SVG
  const nodes = [
    { Icon: Lightning,   label: 'Energy',    x: 50,  y: 14,  r: 34 },
    { Icon: Factory,     label: 'Mfg',       x: 82,  y: 32,  r: 30 },
    { Icon: Truck,       label: 'Logistics', x: 90,  y: 58,  r: 30 },
    { Icon: ChartLineUp, label: 'Markets',   x: 72,  y: 84,  r: 30 },
    { Icon: Buildings,   label: 'Hotels',    x: 28,  y: 84,  r: 30 },
    { Icon: Bank,        label: 'BFSI',      x: 10,  y: 58,  r: 30 },
    { Icon: ShoppingCart,label: 'Retail',    x: 10,  y: 32,  r: 30 },
    { Icon: AirplaneTilt,label: 'Aviation',  x: 28,  y: 14,  r: 30 },
    { Icon: Car,         label: 'EV',        x: 16,  y: 50,  r: 26 },
    { Icon: Hospital,    label: 'Health',    x: 84,  y: 50,  r: 26 },
    { Icon: Wrench,      label: 'Auto',      x: 50,  y: 90,  r: 26 },
  ];
  const cx = 50, cy = 50; // center hub

  return (
    <div style={{
      display: 'flex', height: '100vh',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      background: '#ffffff',
      flexDirection: isMobile ? 'column' : 'row',
    }}>

      {/* ── LEFT PANEL — illustration ─────────────────────────────────── */}
      {!isMobile && <div style={{
        flex: isTablet ? '0 0 45%' : '0 0 55%', background: '#f0f5ff',
        display: 'flex', flexDirection: 'column',
        padding: isTablet ? '28px 28px' : '36px 40px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Logo top-left */}
        {/* <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'auto' }}>
          <img src="/Condense.png" alt="Condense" style={{ height: 26, width: 'auto' }} />
        </div> */}

        {/* Network illustration */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <svg viewBox="0 0 100 100" style={{ width: '82%', maxWidth: 460, height: 'auto' }}>
            <defs>
              <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#257df0" stopOpacity="0.18"/>
                <stop offset="100%" stopColor="#257df0" stopOpacity="0.04"/>
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="0.6" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Background radial glow behind hub */}
            <circle cx={cx} cy={cy} r="20" fill="url(#hubGrad)" />

            {/* Connection lines from hub to each node */}
            {nodes.map((n, i) => (
              <line key={i}
                x1={cx} y1={cy} x2={n.x} y2={n.y}
                stroke="#257df0" strokeWidth="0.35" strokeOpacity="0.35"
                strokeDasharray="1.2 1"
              />
            ))}

            {/* Node circles — Phosphor icons via foreignObject */}
            {nodes.map((n, i) => {
              const r   = n.r / 10;   // circle radius in SVG units (~3)
              const box = r * 1.1;    // icon box half-size (slightly smaller than radius)
              return (
                <g key={i}>
                  {/* Circle background */}
                  <circle cx={n.x} cy={n.y} r={r}
                    fill="#ffffff" stroke="#257df0" strokeWidth="0.3" strokeOpacity="0.6"
                    filter="url(#glow)"
                  />
                  {/*
                    foreignObject lets us render a React/HTML Phosphor icon
                    inside the SVG coordinate space.
                    Position centred on the node (x - box, y - box).
                  */}
                  <foreignObject
                    x={n.x - box} y={n.y - box}
                    width={box * 2} height={box * 2}
                    style={{ overflow: 'visible' }}
                  >
                    <div
                      style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <n.Icon size="55%" color="#257df0" weight="duotone" />
                    </div>
                  </foreignObject>
                </g>
              );
            })}

            {/* Central hub — clipPath keeps the logo inside the circle */}
            <defs>
              <clipPath id="hubClip">
                <circle cx={cx} cy={cy} r="11" />
              </clipPath>
            </defs>
            {/* Outer soft glow rings */}
            <circle cx={cx} cy={cy} r="16" fill="#257df0" fillOpacity="0.06" />
            <circle cx={cx} cy={cy} r="13" fill="#257df0" fillOpacity="0.10"
              stroke="#257df0" strokeWidth="0.4" strokeOpacity="0.3" />
            {/* Solid blue hub */}
            <circle cx={cx} cy={cy} r="11" fill="#257df0" />

            {/*
              Condense logo mark inside hub.
              invert(1): black logo → white, white bg → black
              mix-blend-mode:screen: black bg disappears, white logo stays white ✓
            */}
            <image
              href="/Condense.png"
              x={cx - 9} y={cy - 9}
              width="18" height="18"
              clipPath="url(#hubClip)"
              preserveAspectRatio="xMidYMid meet"
              style={{ filter: 'invert(1)', mixBlendMode: 'screen' }}
            />

            {/* Heartbeat rings — expand outward from hub edge */}
            <circle cx={cx} cy={cy} r="12" fill="none"
              stroke="#257df0" strokeWidth="0.5" strokeOpacity="0.3">
              <animate attributeName="r" values="12;20;12" dur="3s" repeatCount="indefinite"/>
              <animate attributeName="stroke-opacity" values="0.35;0;0.35" dur="3s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>

        {/* Description */}
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f2044', marginBottom: 10, lineHeight: 1.3 }}>
            Real-time Industry Intelligence
          </div>
          <div style={{ fontSize: 13, color: '#4a6080', lineHeight: 1.7, maxWidth: 420 }}>
            Monitor live KPIs across 11 industry verticals — from energy and manufacturing to
            stock markets and hospitality. Detect anomalies, track reliability, and gain
            instant insights powered by the Condense streaming platform.
          </div>
        </div>

        {/* Bottom copyright */}
        <div style={{ marginTop: 28, fontSize: 11, color: '#94a3b8' }}>
          © Zeliot All Rights Reserved | 2026 &nbsp;·&nbsp; Powered by Condense
        </div>
      </div>}

      {/* ── RIGHT PANEL — login form ───────────────────────────────────── */}
      <div style={{
        flex: isMobile ? '1' : '0 0 45%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '32px 24px' : isTablet ? '40px 40px' : '48px 56px',
        background: '#ffffff',
      }}>
        <div style={{
          width: '100%', maxWidth: isTV ? 480 : 360,
          animation: shake ? 'shake 0.4s ease' : 'none',
        }}>
          {/* Logo */}
          <img src="/Condense.png" alt="Condense"
            style={{ height: 28, width: 'auto', marginBottom: 32, display: 'block' }} />

          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f2044', marginBottom: 6 }}>
              Sign in to Industry Demo
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Enter your credentials to access the dashboards
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151',
                display: 'block', marginBottom: 6 }}>Username</label>
              <div style={{ position: 'relative' }}>
                <User size={14} style={{ position: 'absolute', left: 12,
                  top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text" value={username} autoFocus autoComplete="username"
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  placeholder="Username"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 12px 11px 34px', fontSize: 14, borderRadius: 4,
                    border: error ? '1.5px solid #ef4444' : '1px solid #e5e7eb',
                    outline: 'none', color: '#1e293b', background: '#f9fafb',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => !error && (e.target.style.borderColor = '#257df0')}
                  onBlur={e  => !error && (e.target.style.borderColor = '#e5e7eb')}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151',
                display: 'block', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <LockKey size={14} style={{ position: 'absolute', left: 12,
                  top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  autoComplete="current-password"
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Password"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 38px 11px 34px', fontSize: 14, borderRadius: 4,
                    border: error ? '1.5px solid #ef4444' : '1px solid #e5e7eb',
                    outline: 'none', color: '#1e293b', background: '#f9fafb',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => !error && (e.target.style.borderColor = '#257df0')}
                  onBlur={e  => !error && (e.target.style.borderColor = '#e5e7eb')}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{
                  position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9ca3af', display: 'flex', padding: 2,
                }}>
                  {showPass ? <EyeSlash size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                fontSize: 12, color: '#dc2626', marginBottom: 16,
                background: '#fee2e2', border: '1px solid #fecaca',
                borderRadius: 8, padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>⚠</span> {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit"
              disabled={loading || !username || !password}
              style={{
                width: '100%', padding: '12px', fontSize: 14, fontWeight: 600,
                color: '#ffffff', border: 'none', borderRadius: 8, cursor:
                  loading || !username || !password ? 'not-allowed' : 'pointer',
                background: loading || !username || !password ? '#93c5fd' : '#257df0',
                boxShadow: loading || !username || !password
                  ? 'none' : '0 4px 14px rgba(37,125,240,0.35)',
                transition: 'background 0.15s',
                letterSpacing: '0.02em',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-5px); }
          80%      { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}

import { INDUSTRY_LIST } from './config/industries.js';

import EnergyDashboard        from './industries/energy/EnergyDashboard.jsx';
import EVDashboard             from './industries/ev/EVDashboard.jsx';
import AutomotiveDashboard     from './industries/automotive/AutomotiveDashboard.jsx';
import AviationDashboard       from './industries/aviation/AviationDashboard.jsx';
import ManufacturingDashboard  from './industries/manufacturing/ManufacturingDashboard.jsx';
import LogisticsDashboard      from './industries/logistics/LogisticsDashboard.jsx';
import BFSIDashboard           from './industries/bfsi/BFSIDashboard.jsx';
import RetailDashboard         from './industries/retail/RetailDashboard.jsx';
import HealthcareDashboard     from './industries/healthcare/HealthcareDashboard.jsx';
import StockExchangeDashboard  from './industries/stockexchange/StockExchangeDashboard.jsx';
import TravelDashboard         from './industries/travel/TravelDashboard.jsx';
import PlatformDashboard       from './industries/platform/PlatformDashboard.jsx';

// ── Phosphor icon map per industry id ────────────────────────────────────────
const INDUSTRY_ICONS = {
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

// ── Dashboard component map ───────────────────────────────────────────────────
const DASHBOARDS = {
  energy:        EnergyDashboard,
  ev:            EVDashboard,
  automotive:    AutomotiveDashboard,
  aviation:      AviationDashboard,
  manufacturing: ManufacturingDashboard,
  logistics:     LogisticsDashboard,
  bfsi:          BFSIDashboard,
  retail:        RetailDashboard,
  healthcare:    HealthcareDashboard,
  stockexchange: StockExchangeDashboard,
  travel:        TravelDashboard,
  platform:      PlatformDashboard,
};

const CONDENSE_BLUE = '#257df0';
const CONDENSE_GREY = '#767678';
const VALID_IDS = new Set([...INDUSTRY_LIST.map(i => i.id), 'platform']);

// ── Routing helpers ───────────────────────────────────────────────────────────
function getIdFromHash() {
  // hash format: #/energy  or  #energy  or  energy
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return VALID_IDS.has(raw) ? raw : null;
}

function setHash(id) {
  // Use replaceState so back button doesn't create history spam
  window.history.replaceState(null, '', `#/${id}`);
}

function getInitialId() {
  return (
    getIdFromHash() ||
    localStorage.getItem('condense_active_industry') ||
    'energy'
  );
}

// ── Coming Soon placeholder ───────────────────────────────────────────────────
function ComingSoon({ industry }) {
  const IconComp = INDUSTRY_ICONS[industry.id];
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: 14,
    }}>
      {IconComp && (
        <IconComp size={52} weight="duotone" color={CONDENSE_BLUE} />
      )}
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{industry.name}</div>
      <div style={{ fontSize: 13, color: CONDENSE_GREY }}>Pipeline not yet deployed</div>
      <div style={{
        fontSize: 11, padding: '6px 14px', borderRadius: 20,
        border: '1px solid #e2e8f0', color: CONDENSE_GREY,
        fontFamily: 'monospace', background: '#f8fafc',
      }}>
        Set <code style={{ color: CONDENSE_BLUE }}>
          VITE_{industry.id.toUpperCase()}_API_URL
        </code> once deployed
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [authed,      setAuthed]      = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [activeId,    setActiveId]    = useState(getInitialId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const { isMobile, isTablet, isTV } = useWindowSize();

  // ── ALL hooks must be called before any early return ──────────────────────

  // Sync hash + localStorage — only when logged in
  // (guarded with authed so sign-out never writes #/energy to the URL)
  useEffect(() => {
    if (!authed) return;
    setHash(activeId);
    localStorage.setItem('condense_active_industry', activeId);
  }, [activeId, authed]);

  // Browser back/forward — only active when logged in
  useEffect(() => {
    if (!authed) return;
    const onHashChange = () => {
      const id = getIdFromHash();
      if (id) setActiveId(id);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [authed]);

  const navigate = useCallback((id) => setActiveId(id), []);

  // ── Early return for login — after all hooks ──────────────────────────────
  if (!authed) return (
    <LoginScreen onLogin={() => {
      // Always land on Energy after login
      localStorage.removeItem('condense_active_industry');
      setActiveId('energy');
      setAuthed(true);
      // Hash will be set by the useEffect above once authed=true
    }} />
  );

  const ActiveDash    = DASHBOARDS[activeId];
  const activeIndustry = INDUSTRY_LIST.find(i => i.id === activeId);

  function signOut() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('condense_active_industry');
    window.history.replaceState(null, '', window.location.pathname);
    setAuthed(false);
  }

  // ── Platform Health button (shared between sidebar and drawer) ─────────
  function PlatformHealthButton({ showLabels, onSelect }) {
    const isActive = activeId === 'platform';
    return (
      <button
        onClick={() => { navigate('platform'); onSelect?.(); }}
        title={!showLabels ? 'Platform Health' : undefined}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: showLabels ? '10px 16px' : '10px 0',
          justifyContent: showLabels ? 'flex-start' : 'center',
          background: isActive ? 'rgba(37,125,240,0.15)' : 'transparent',
          borderLeft:  isActive ? `3px solid ${CONDENSE_BLUE}` : '3px solid transparent',
          borderRight: 'none', borderTop: 'none', borderBottom: 'none',
          cursor: 'pointer',
          transition: 'all 0.12s',
        }}
      >
        <Heartbeat
          size={showLabels ? 18 : 20}
          weight={isActive ? 'fill' : 'regular'}
          color={isActive ? CONDENSE_BLUE : 'rgba(255,255,255,0.45)'}
          style={{ flexShrink: 0 }}
        />
        {showLabels && (
          <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 13, fontWeight: isActive ? 600 : 400,
              color: isActive ? '#ffffff' : 'rgba(255,255,255,0.6)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              Platform Health
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              Uptime · SLA · DevOps
            </div>
          </div>
        )}
      </button>
    );
  }

  // ── Industry nav list (shared between sidebar and drawer) ──────────────
  function IndustryList({ showLabels, onSelect }) {
    return (
      <>
        {INDUSTRY_LIST.map(ind => {
          const isActive = activeId === ind.id;
          const IconComp = INDUSTRY_ICONS[ind.id];
          const isLive   = Boolean(ind.apiUrl);
          return (
            <button
              key={ind.id}
              onClick={() => { navigate(ind.id); onSelect?.(); }}
              title={!showLabels ? ind.name : undefined}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: showLabels ? '10px 16px' : '10px 0',
                justifyContent: showLabels ? 'flex-start' : 'center',
                background: isActive ? 'rgba(37,125,240,0.15)' : 'transparent',
                borderLeft:  isActive ? `3px solid ${CONDENSE_BLUE}` : '3px solid transparent',
                borderRight: 'none', borderTop: 'none', borderBottom: 'none',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {IconComp && (
                <IconComp
                  size={showLabels ? 18 : 20}
                  weight={isActive ? 'fill' : 'regular'}
                  color={isActive ? CONDENSE_BLUE : 'rgba(255,255,255,0.45)'}
                  style={{ flexShrink: 0 }}
                />
              )}
              {showLabels && (
                <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#ffffff' : 'rgba(255,255,255,0.6)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {ind.shortName}
                  </div>
                  {isLive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80', display: 'inline-block' }}/>
                      <span style={{ fontSize: 9, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.07em' }}>live</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </>
    );
  }

  // ── Mobile layout: top bar + drawer ────────────────────────────────────
  if (isMobile) {
    const activeInd = activeId === 'platform'
      ? { name: 'Platform Health' }
      : INDUSTRY_LIST.find(i => i.id === activeId);
    const ActiveIcon = activeId === 'platform' ? Heartbeat : INDUSTRY_ICONS[activeId];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f1f5f9', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>

        {/* Mobile top bar */}
        <div style={{
          height: 52, background: '#0c1a3a', flexShrink: 0,
          display: 'flex', alignItems: 'center', padding: '0 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          gap: 10,
        }}>
          {/* Hamburger */}
          <button onClick={() => setDrawerOpen(true)} style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor"/>
              <rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor"/>
              <rect x="1" y="11" width="14" height="2" rx="1" fill="currentColor"/>
            </svg>
          </button>

          {/* Current industry */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {ActiveIcon && <ActiveIcon size={18} weight="duotone" color={CONDENSE_BLUE} style={{ flexShrink: 0 }} />}
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeInd?.name || 'Dashboard'}
            </span>
          </div>

          {/* Logo */}
          <img src="/Condense.png" alt="Condense" style={{ height: 18, width: 'auto', filter: 'invert(1)', mixBlendMode: 'screen', flexShrink: 0 }} />
        </div>

        {/* Drawer overlay */}
        {drawerOpen && (
          <>
            <div onClick={() => setDrawerOpen(false)} style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100,
            }} />
            <div style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, width: 260,
              background: '#0c1a3a', zIndex: 101, display: 'flex', flexDirection: 'column',
              boxShadow: '4px 0 20px rgba(0,0,0,0.4)',
              animation: 'slideIn 0.2s ease',
            }}>
              {/* Drawer header */}
              <div style={{
                height: 56, padding: '0 14px', borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <img src="/Condense.png" alt="Condense" style={{ height: 20, width: 'auto', filter: 'invert(1)', mixBlendMode: 'screen' }} />
                  <span style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>Industry Demo</span>
                </div>
                <button onClick={() => setDrawerOpen(false)} style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)', cursor: 'pointer', width: 28, height: 28,
                  borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CaretLeft size={14} weight="bold" />
                </button>
              </div>

              {/* Industry list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                <IndustryList showLabels={true} onSelect={() => setDrawerOpen(false)} />
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '6px 0', paddingTop: 6 }}>
                  <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.22)',
                    textTransform: 'uppercase', letterSpacing: '0.15em', padding: '0 16px', marginBottom: 2 }}>
                    DevOps
                  </div>
                  <PlatformHealthButton showLabels={true} onSelect={() => setDrawerOpen(false)} />
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button onClick={signOut} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                  borderRadius: 8, cursor: 'pointer', color: 'rgba(255,120,120,0.8)',
                  fontSize: 12, fontWeight: 500, width: '100%',
                }}>
                  <SignOut size={14} weight="bold" />
                  Sign Out
                </button>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 8, letterSpacing: '0.04em' }}>
                  Powered by Condense · Zeliot
                </div>
              </div>
            </div>
          </>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {ActiveDash ? <ActiveDash /> : <ComingSoon industry={activeIndustry} />}
        </div>

        <style>{`
          @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        `}</style>
      </div>
    );
  }

  // ── Desktop / Tablet layout: sidebar ───────────────────────────────────
  const showLabels = isTablet ? sidebarOpen : sidebarOpen;
  const sidebarWidth = showLabels ? (isTV ? 260 : 230) : 58;

  return (
    <div style={{
      display: 'flex', height: '100vh',
      background: '#f1f5f9',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      overflow: 'hidden',
    }}>

      {/* ══ Sidebar ═══════════════════════════════════════════════════════════ */}
      <div style={{
        width: sidebarWidth,
        background: '#0c1a3a',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0, overflow: 'hidden',
        boxShadow: '3px 0 12px rgba(12,26,58,0.25)',
      }}>

        {/* Logo row */}
        <div style={{
          height: 56,
          padding: '0 12px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center',
          justifyContent: showLabels ? 'space-between' : 'center',
          flexShrink: 0, gap: 6,
        }}>
          {showLabels && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1, gap: 2 }}>
              <div style={{ background: '#0c1a3a', borderRadius: 3, overflow: 'hidden', display: 'inline-flex' }}>
                <img
                  src="/Condense.png"
                  alt="Condense"
                  style={{
                    height: 22, width: 'auto', maxWidth: 130,
                    objectFit: 'contain', display: 'block',
                    filter: 'invert(1)', mixBlendMode: 'screen',
                  }}
                />
              </div>
              <span style={{
                fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.28)',
                textTransform: 'uppercase', letterSpacing: '0.18em',
              }}>
                Industry Demo
              </span>
            </div>
          )}

          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={showLabels ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              width: 28, height: 28,
              borderRadius: 6, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {showLabels
              ? <CaretLeft size={14} weight="bold" />
              : <CaretRight size={14} weight="bold" />
            }
          </button>
        </div>

        {/* ── Industry list ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          <IndustryList showLabels={showLabels} />
        </div>

        {/* Footer */}
        <div style={{
          padding: showLabels ? '10px 14px' : '10px 0',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 8,
          alignItems: showLabels ? 'stretch' : 'center',
        }}>
          {/* Platform Health nav entry */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginTop: -2 }}>
            {showLabels && (
              <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.22)',
                textTransform: 'uppercase', letterSpacing: '0.15em', padding: '0 16px', marginBottom: 2 }}>
                DevOps
              </div>
            )}
            <PlatformHealthButton showLabels={showLabels} />
          </div>

          <button
            onClick={signOut}
            title="Sign out"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              justifyContent: showLabels ? 'flex-start' : 'center',
              padding: showLabels ? '7px 10px' : '7px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 8, cursor: 'pointer',
              color: 'rgba(255,120,120,0.8)', fontSize: 12, fontWeight: 500,
              transition: 'all 0.15s', width: showLabels ? '100%' : 'auto',
            }}
          >
            <SignOut size={14} weight="bold" />
            {showLabels && 'Sign Out'}
          </button>

          {showLabels && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>
              Powered by Condense · Zeliot
            </div>
          )}
        </div>
      </div>

      {/* ══ Main content ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#f1f5f9' }}>
        {ActiveDash
          ? <ActiveDash />
          : <ComingSoon industry={activeIndustry} />
        }
      </div>

    </div>
  );
}
