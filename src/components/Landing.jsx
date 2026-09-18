// src/components/Landing.jsx
// Catalog / entry screen — shown after login, before an industry is picked.
// Pure navigation UI: renders real per-industry photos + metadata already in
// src/config/industries.js. No dashboard data, no WebSocket, nothing live here.

import { useState } from 'react';
import { SignOut, ArrowRight, FlowArrow } from '@phosphor-icons/react';
import { useWindowSize } from '../hooks/useWindowSize.js';
import { INDUSTRY_ICONS } from './shared.jsx';

const CONDENSE_BLUE = '#257df0';

function IndustryCard({ industry, onSelect }) {
  const [hover, setHover] = useState(false);
  const isLive = Boolean(industry.apiUrl);
  const IconComp = INDUSTRY_ICONS[industry.id];

  return (
    <button
      onClick={() => onSelect(industry.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden',
        background: '#121a2e',
        border: `1px solid ${hover ? 'rgba(37,125,240,0.45)' : '#23304d'}`,
        borderRadius: 14,
        transition: 'border-color 0.15s, transform 0.15s',
        transform: hover ? 'translateY(-2px)' : 'none',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', height: 132, flexShrink: 0, overflow: 'hidden' }}>
        <img
          src={industry.image}
          alt={industry.name}
          loading="lazy"
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            transform: hover ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform 0.35s ease',
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(11,18,32,0.05) 0%, rgba(11,18,32,0.35) 60%, #121a2e 100%)',
        }} />
        <div style={{
          position: 'absolute', top: 10, left: 10,
          width: 30, height: 30, borderRadius: 8,
          background: 'rgba(11,18,32,0.55)', backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {IconComp && <IconComp size={16} weight="duotone" color={CONDENSE_BLUE} />}
        </div>
        {isLive && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(11,18,32,0.6)', backdropFilter: 'blur(4px)',
            border: '1px solid rgba(74,222,128,0.4)',
            borderRadius: 20, padding: '3px 8px',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#4ade80', letterSpacing: '0.06em' }}>LIVE</span>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 14.5, fontWeight: 700, color: '#e6eaf2', lineHeight: 1.3 }}>
          {industry.name}
        </div>
        <div style={{ fontSize: 11.5, color: '#8b96b3', lineHeight: 1.5, flex: 1 }}>
          {industry.description}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11.5, fontWeight: 600,
          color: hover ? '#5b9cf5' : '#6b7796',
          marginTop: 2,
        }}>
          Open dashboard
          <ArrowRight size={12} weight="bold" />
        </div>
      </div>
    </button>
  );
}

export default function Landing({ industries, onSelect, onOpenArchitecture, onLogout }) {
  const { isMobile } = useWindowSize();

  return (
    <div style={{
      minHeight: '100vh', width: '100%', boxSizing: 'border-box',
      background: '#0b1220', color: '#e6eaf2',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      overflowY: 'auto',
    }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '16px 18px' : '20px 40px',
        borderBottom: '1px solid #1c2740',
      }}>
        <img
          src="/Condense.png" alt="Condense"
          style={{ height: isMobile ? 20 : 24, width: 'auto', filter: 'invert(1)', mixBlendMode: 'screen' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {!isMobile && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7796', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Industry Solutions Library
            </span>
          )}
          <button onClick={onLogout} title="Sign out" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
            color: 'rgba(255,120,120,0.85)', fontSize: 11.5, fontWeight: 500,
          }}>
            <SignOut size={13} weight="bold" />
            {!isMobile && 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 780, margin: '0 auto', textAlign: 'center', padding: isMobile ? '44px 20px 32px' : '68px 24px 44px' }}>
        <span style={{
          display: 'inline-block', padding: '5px 13px', borderRadius: 20,
          background: 'rgba(37,125,240,0.12)', border: '1px solid rgba(37,125,240,0.3)',
          color: '#5b9cf5', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 20,
        }}>
          LIVE TELEMETRY &middot; REAL-TIME ANALYTICS
        </span>
        <h1 style={{
          fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          fontSize: isMobile ? 26 : 38, fontWeight: 700, lineHeight: 1.2, margin: '0 0 14px',
        }}>
          Pick an industry. See it live.
        </h1>
        <p style={{ fontSize: 14.5, color: '#8b96b3', lineHeight: 1.65, margin: 0 }}>
          Every dashboard below streams real sensor data end-to-end through Condense&rsquo;s own pipeline &mdash;
          live KPIs, health scoring and alerting. This library grows as new client use cases ship.
        </p>
      </div>

      {/* Grid */}
      <div style={{
        maxWidth: 1240, margin: '0 auto', padding: `0 ${isMobile ? 16 : 24}px 56px`,
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(270px, 1fr))',
        gap: 18,
      }}>
        {industries.map(ind => (
          <IndustryCard key={ind.id} industry={ind} onSelect={onSelect} />
        ))}
      </div>

      {/* Architecture banner */}
      <div style={{ maxWidth: 1240, margin: '0 auto 48px', padding: `0 ${isMobile ? 16 : 24}px` }}>
        <button
          onClick={onOpenArchitecture}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
            padding: isMobile ? '22px' : '28px 32px', borderRadius: 16,
            background: '#121a2e', border: '1px solid #23304d',
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#5b9cf5', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
              For technical &amp; procurement teams
            </div>
            <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 19, fontWeight: 700, marginBottom: 6, color: '#e6eaf2' }}>
              See how Condense fits your infrastructure
            </div>
            <div style={{ fontSize: 12.5, color: '#8b96b3' }}>
              Pipeline, integration points, and exactly where your existing systems plug in.
            </div>
          </div>
          <div style={{
            flexShrink: 0, width: 48, height: 48, borderRadius: 12,
            background: 'rgba(37,125,240,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FlowArrow size={22} color={CONDENSE_BLUE} weight="bold" />
          </div>
        </button>
      </div>

      <div style={{ textAlign: 'center', padding: '22px 24px', borderTop: '1px solid #1c2740', color: '#5b6788', fontSize: 11.5 }}>
        Condense &mdash; Real-time Data &middot; Smarter Operations &middot; Tangible Impact
      </div>
    </div>
  );
}
