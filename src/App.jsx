// src/App.jsx
// Root shell: collapsible sidebar listing all 9 industries + industry content area.

import { useState } from 'react';
import { INDUSTRY_LIST } from './config/industries.js';

// Industry dashboards — import each as it is built and deployed
import EnergyDashboard        from './industries/energy/EnergyDashboard.jsx';
import EVDashboard             from './industries/ev/EVDashboard.jsx';
import AutomotiveDashboard     from './industries/automotive/AutomotiveDashboard.jsx';
import AviationDashboard       from './industries/aviation/AviationDashboard.jsx';
import ManufacturingDashboard  from './industries/manufacturing/ManufacturingDashboard.jsx';
import LogisticsDashboard      from './industries/logistics/LogisticsDashboard.jsx';
import BFSIDashboard           from './industries/bfsi/BFSIDashboard.jsx';
import RetailDashboard         from './industries/retail/RetailDashboard.jsx';
import HealthcareDashboard     from './industries/healthcare/HealthcareDashboard.jsx';

// Map industry id → dashboard component
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
};

// Shown when an industry pipeline hasn't been deployed yet
function ComingSoon({ industry }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', color: '#334155', gap: 12
    }}>
      <div style={{ fontSize: 56 }}>{industry.icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#475569' }}>{industry.name}</div>
      <div style={{ fontSize: 13, color: '#334155' }}>Pipeline coming soon</div>
      <div style={{
        marginTop: 8, fontSize: 11, padding: '6px 14px', borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.08)', color: '#334155',
        fontFamily: 'monospace', background: 'rgba(255,255,255,0.02)'
      }}>
        Set <code style={{ color: '#64748b' }}>VITE_{industry.id.toUpperCase()}_API_URL</code> once deployed
      </div>
    </div>
  );
}

export default function App() {
  const [activeId,    setActiveId]    = useState('energy');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const ActiveDash    = DASHBOARDS[activeId];
  const activeIndustry = INDUSTRY_LIST.find(i => i.id === activeId);

  return (
    <div style={{
      display: 'flex', height: '100vh', background: '#0a0f1a',
      fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden'
    }}>

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <div style={{
        width: sidebarOpen ? 224 : 56,
        background: '#0d1424',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease', flexShrink: 0, overflow: 'hidden'
      }}>
        {/* Logo row */}
        <div style={{
          padding: '16px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 10,
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          flexShrink: 0,
        }}>
          {sidebarOpen && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0',
                letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                Condense
              </div>
              <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase',
                letterSpacing: '0.12em', marginTop: 1 }}>
                Industry Demo
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
              fontSize: 18, padding: 4, lineHeight: 1, flexShrink: 0,
              borderRadius: 4, transition: 'color 0.1s',
            }}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        {/* Industry list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {INDUSTRY_LIST.map(ind => {
            const isActive = activeId === ind.id;
            return (
              <button
                key={ind.id}
                onClick={() => setActiveId(ind.id)}
                title={!sidebarOpen ? ind.name : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: sidebarOpen ? '9px 14px' : '9px 0',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  background: isActive
                    ? `linear-gradient(90deg, ${ind.color}18 0%, transparent 100%)`
                    : 'transparent',
                  borderLeft:  isActive ? `2px solid ${ind.color}` : '2px solid transparent',
                  borderRight: 'none', borderTop: 'none', borderBottom: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>{ind.icon}</span>
                {sidebarOpen && (
                  <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#e2e8f0' : '#64748b',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {ind.shortName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: ind.ready ? '#22c55e' : '#1e293b',
                        boxShadow: ind.ready ? '0 0 4px #22c55e' : 'none',
                      }}/>
                      <span style={{ fontSize: 9, color: ind.ready ? '#22c55e80' : '#1e293b',
                        textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {ind.ready ? 'live' : 'soon'}
                      </span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        {sidebarOpen && (
          <div style={{
            padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)',
            fontSize: 10, color: '#1e293b', flexShrink: 0
          }}>
            Powered by Condense · Zeliot
          </div>
        )}
      </div>

      {/* ── Main content ────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {ActiveDash
          ? <ActiveDash />
          : <ComingSoon industry={activeIndustry} />
        }
      </div>

    </div>
  );
}
