// src/industries/ev/EVDashboard.jsx
// Live EV & Connected Mobility dashboard — consumes WebSocket from Condense pipeline.
// Assets: electric vehicles (soc, range, temp) + charging stations (connectors, power).

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useCondenseWS } from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }    from '../../config/industries.js';
import { useWindowSize } from '../../hooks/useWindowSize.js';
import {
  AlertFeed, StatusBadge, HealthGauge,
  THEME, ThemedDashboardHeader, ThemedKPICard, NotConfiguredGuard, chartTheme,
} from '../../components/shared.jsx';
import evHero from '../../assets/industries/ev.jpg';

// Charging bay tile — fill height is the real soc_pct; the pulse animates
// along the cable only while charging_status is actually a charging state.
function ChargeBay({ vehicle }) {
  const soc = vehicle.soc_pct ?? 0;
  const isCharging = vehicle.charging_status === 'fast_charging' || vehicle.charging_status === 'slow_charging';
  const fillColor = soc >= 60 ? '#4ade80' : soc >= 30 ? '#fbbf24' : '#f87171';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 46 }}>
      <div style={{ position: 'relative', width: 22, height: 34, border: '2px solid rgba(255,255,255,0.5)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 10, height: 3, background: 'rgba(255,255,255,0.5)', borderRadius: 1 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${Math.max(4, soc)}%`, background: fillColor, transition: 'height 0.6s ease' }} />
        {isCharging && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.35)', animation: 'condense-charge-pulse 1.2s ease-in-out infinite' }} />
        )}
      </div>
      <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#e6eaf2' }}>{Math.round(soc)}%</span>
      <style>{`@keyframes condense-charge-pulse { 0%,100% { opacity:0; } 50% { opacity:0.5; } }`}</style>
    </div>
  );
}

// Hero — real charging bays, one per real EV, battery fill = real soc_pct.
function ChargingHero({ photo, vehicles, stats }) {
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 20, minHeight: 240 }}>
      <img src={photo} alt="EV charging" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(9,14,26,0.2) 0%, rgba(9,14,26,0.4) 45%, rgba(9,14,26,0.85) 100%)' }} />
      <div style={{ position: 'relative', padding: '20px 24px', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', minHeight: 240, boxSizing: 'border-box' }}>
        <div style={{ pointerEvents: 'none' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(11,18,32,0.55)',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, padding: '4px 10px', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#e6eaf2', letterSpacing: '0.05em' }}>LIVE CHARGING NETWORK</span>
          </div>
          <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: '#ffffff' }}>EV Fleet & Charging Bays</div>
        </div>

        {vehicles.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'rgba(11,18,32,0.5)', backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
            {vehicles.slice(0, 12).map(v => <ChargeBay key={v.asset_id} vehicle={v} />)}
          </div>
        )}

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

const MAX_HISTORY = 40;

const ASSET_META = {
  ev_vehicle:       { icon: '🚗', label: 'Electric Vehicle',   primaryKey: 'soc_pct',             primaryUnit: '%',  primaryLabel: 'SOC' },
  charging_station: { icon: '⚡', label: 'Charging Station',   primaryKey: 'power_delivery_kw',   primaryUnit: 'kW', primaryLabel: 'Power' },
};

// ── SOC ring (simple arc gauge) ────────────────────────────────
function SocRing({ soc = 0, size = 54 }) {
  const r    = (size / 2) - 5;
  const circ = Math.PI * r;
  const fill = (Math.min(100, Math.max(0, soc)) / 100) * circ;
  const color = soc > 60 ? '#22c55e' : soc > 25 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size / 2 + 8} style={{ overflow: 'visible' }}>
      <path d={`M 5 ${size/2} A ${r} ${r} 0 0 1 ${size-5} ${size/2}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} strokeLinecap="round"/>
      <path d={`M 5 ${size/2} A ${r} ${r} 0 0 1 ${size-5} ${size/2}`}
        fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}/>
      <text x={size/2} y={size/2 + 5} textAnchor="middle"
        fontSize={12} fontWeight={700} fill={color} fontFamily="monospace">{Math.round(soc)}%</text>
    </svg>
  );
}

// ── Asset card ─────────────────────────────────────────────────
function AssetCard({ asset, selected, onClick, theme = 'light' }) {
  const t = THEME[theme];
  const meta    = ASSET_META[asset.asset_type] || { icon: '📡', label: asset.asset_type };
  const primary = asset[meta.primaryKey];
  const health  = asset.kpis?.health_score ?? 100;
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(59,130,246,0.08)' : t.cardBg,
      border: `1px solid ${selected ? 'rgba(59,130,246,0.4)' : t.cardBorder}`,
      borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div>
          <span style={{ fontSize:16, marginRight:6 }}>{meta.icon}</span>
          <span style={{ fontSize:12, fontWeight:600, color: t.text }}>{asset.asset_id}</span>
        </div>
        <StatusBadge status={asset.status} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          {asset.asset_type === 'ev_vehicle' ? (
            <SocRing soc={asset.soc_pct ?? 0} size={54} />
          ) : (
            <div style={{ fontSize:18, fontWeight:700, color:'#3b82f6',
              fontFamily:'monospace', lineHeight:1 }}>
              {primary != null ? Number(primary).toFixed(1) : '—'}
              <span style={{ fontSize:10, color: t.textDim, marginLeft:3 }}>{meta.primaryUnit}</span>
            </div>
          )}
          <div style={{ fontSize:10, color: t.textDim, marginTop:4 }}>{meta.label}</div>
        </div>
        <HealthGauge score={health} size={54} theme={theme} />
      </div>
      {asset.has_alerts && (
        <div style={{ marginTop:8, fontSize:10, color:'#f59e0b',
          background:'rgba(245,158,11,0.08)', padding:'3px 8px', borderRadius:4, display:'inline-block' }}>
          ⚠ {asset.alert_count} alert{asset.alert_count > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ── Colour-coded status chip ───────────────────────────────────
function StatusChip({ label, level }) {
  const colors = {
    critical: { bg:'#fee2e2', color:'#dc2626' },
    high_stress: { bg:'#fef3c7', color:'#d97706' },
    elevated: { bg:'#fef9c3', color:'#ca8a04' },
    normal: { bg:'#dcfce7', color:'#16a34a' },
    idle: { bg:'#f1f5f9', color:'#64748b' },
    excellent: { bg:'#dcfce7', color:'#16a34a' },
    good: { bg:'#d1fae5', color:'#059669' },
    average: { bg:'#fef3c7', color:'#d97706' },
    poor: { bg:'#fee2e2', color:'#dc2626' },
    replace_soon: { bg:'#fee2e2', color:'#dc2626' },
    watch: { bg:'#fef3c7', color:'#d97706' },
    healthy: { bg:'#dcfce7', color:'#16a34a' },
    high_availability: { bg:'#dcfce7', color:'#16a34a' },
    moderate: { bg:'#fef3c7', color:'#d97706' },
    low: { bg:'#fff7ed', color:'#c2410c' },
    unavailable: { bg:'#f1f5f9', color:'#64748b' },
    above_benchmark: { bg:'#fee2e2', color:'#dc2626' },
  };
  const s = colors[level] || { bg:'#f1f5f9', color:'#64748b' };
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
      background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label || level}
    </span>
  );
}

// ── KPI metric tile ────────────────────────────────────────────
function KpiTile({ label, value, unit, color = '#1e293b', status, statusLevel }) {
  const display = value != null
    ? (typeof value === 'number' ? Number(value).toFixed(typeof value === 'number' && String(value).includes('.') ? 1 : 0) : String(value))
    : '—';
  return (
    <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 12px' }}>
      <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:700, color, fontFamily:'monospace', lineHeight:1 }}>
        {display}
        {unit && <span style={{ fontSize:10, color:'#94a3b8', marginLeft:3 }}>{unit}</span>}
      </div>
      {status && <div style={{ marginTop:4 }}><StatusChip label={status} level={statusLevel || status} /></div>}
    </div>
  );
}

// ── Detail panels ──────────────────────────────────────────────
function EVDetail({ asset }) {
  const k = asset.kpis || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Telemetry row ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 8 }}>Live Telemetry</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px,1fr))', gap:8 }}>
          <KpiTile label="SOC"          value={asset.soc_pct}           unit="%" color="#3b82f6" />
          <KpiTile label="Est. Range"   value={k.predicted_range_km ?? asset.estimated_range_km} unit="km" color="#22c55e" />
          <KpiTile label="Battery Temp" value={asset.battery_temp_c}    unit="°C" color={asset.battery_temp_c > 40 ? '#ef4444' : '#475569'} />
          <KpiTile label="Speed"        value={asset.speed_kmh}         unit="km/h" color="#475569" />
          <KpiTile label="Pack Voltage" value={asset.battery_voltage_v} unit="V" color="#475569" />
          <KpiTile label="Odometer"     value={asset.odometer_km}       unit="km" color="#475569" />
          <KpiTile label="Charge State" value={asset.charging_status}   color="#8b5cf6" />
          <KpiTile label="Regen Power"  value={asset.regeneration_kw}   unit="kW" color="#06b6d4" />
        </div>
      </div>

      {/* ── Battery Health ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 8 }}>🔋 Battery Health</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="State of Health (SoH)"
            value={k.soh_pct} unit="%"
            color={k.soh_pct >= 90 ? '#16a34a' : k.soh_pct >= 80 ? '#d97706' : '#dc2626'}
            status={k.soh_status}
            statusLevel={k.soh_status === 'excellent' ? 'excellent' : k.soh_status === 'good' ? 'good' : k.soh_status === 'fair' ? 'average' : 'poor'} />
          <KpiTile label="Thermal Score (TMS)"
            value={k.thermal_score} unit="/100"
            color={k.thermal_score >= 85 ? '#16a34a' : k.thermal_score >= 65 ? '#d97706' : '#dc2626'}
            status={k.thermal_status}
            statusLevel={k.thermal_status === 'optimal' ? 'excellent' : k.thermal_status === 'acceptable' ? 'good' : 'critical'} />
          <KpiTile label="C-Rate Stress (CRSI)"
            value={k.crsi} unit="/100"
            color={k.crsi_level === 'critical' ? '#dc2626' : k.crsi_level === 'high' ? '#d97706' : '#16a34a'}
            status={k.crsi_level}
            statusLevel={k.crsi_level} />
          <KpiTile label="C-Rate"
            value={k.c_rate} unit="C"
            color={k.c_rate > 1.5 ? '#ef4444' : '#475569'}
            status={k.c_rate_status}
            statusLevel={k.c_rate_status === 'normal' ? 'good' : k.c_rate_status === 'elevated' ? 'average' : 'critical'} />
        </div>
      </div>

      {/* ── Battery Lifecycle ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 8 }}>📊 Battery Lifecycle</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="Cycle Life Consumed"
            value={k.battery_life_consumed_pct} unit="%"
            color={k.cycle_life_status === 'replace_soon' ? '#dc2626' : k.cycle_life_status === 'watch' ? '#d97706' : '#16a34a'}
            status={k.cycle_life_status}
            statusLevel={k.cycle_life_status} />
          <KpiTile label="Est. Cycles"        value={k.estimated_full_cycles}    color="#475569" />
          <KpiTile label="Cycles Remaining"   value={k.cycles_remaining}         color="#22c55e" />
          <KpiTile label="km Until Replacement"
            value={k.km_until_battery_replacement != null ? Math.round(k.km_until_battery_replacement / 1000) : null}
            unit="k km" color="#8b5cf6" />
          <KpiTile label="Degradation Rate"   value={k.degradation_status}
            color={k.degradation_status === 'rapid' ? '#dc2626' : '#475569'} />
          <KpiTile label="Est. Days to Replace"
            value={k.estimated_days_to_replacement} unit="days"
            color={k.estimated_days_to_replacement != null && k.estimated_days_to_replacement < 180 ? '#ef4444' : '#475569'} />
        </div>
      </div>

      {/* ── V2G + TCO ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 8 }}>⚡ V2G + Operating Cost</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="V2G Readiness"
            value={k.v2g_readiness_score} unit="/100"
            color={k.v2g_readiness_score >= 70 ? '#16a34a' : k.v2g_readiness_score >= 40 ? '#d97706' : '#94a3b8'}
            status={k.v2g_status}
            statusLevel={k.v2g_status === 'high_availability' ? 'excellent' : k.v2g_status === 'moderate' ? 'average' : 'idle'} />
          <KpiTile label="V2G Available"  value={k.v2g_available_kwh}   unit="kWh" color="#22c55e" />
          <KpiTile label="V2G Eligible"   value={k.v2g_eligible ? 'YES' : 'NO'}
            color={k.v2g_eligible ? '#16a34a' : '#94a3b8'} />
          <KpiTile label="TCO per km"
            value={k.tco_per_km_inr} unit="₹/km"
            color={k.tco_rating === 'excellent' ? '#16a34a' : k.tco_rating === 'good' ? '#d97706' : '#ef4444'}
            status={k.tco_rating}
            statusLevel={k.tco_rating === 'excellent' ? 'excellent' : k.tco_rating === 'good' ? 'good' : 'critical'} />
          <KpiTile label="Energy Efficiency"
            value={k.energy_efficiency_wh_km} unit="Wh/km"
            color={k.efficiency_rating === 'excellent' ? '#16a34a' : k.efficiency_rating === 'good' ? '#d97706' : '#ef4444'}
            status={k.efficiency_rating}
            statusLevel={k.efficiency_rating === 'excellent' ? 'excellent' : k.efficiency_rating === 'good' ? 'good' : 'poor'} />
          <KpiTile label="vs ICE Savings" value={k.tco_vs_ice_savings_pct} unit="%" color="#22c55e" />
        </div>
      </div>

      {/* ── Charging ── */}
      {asset.charging_status !== 'discharging' && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 8 }}>🔌 Charging Analysis</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
            <KpiTile label="Charge Speed (CSI)"
              value={k.charge_speed_index_pct} unit="%"
              color="#3b82f6"
              status={k.csi_status}
              statusLevel={k.csi_status === 'optimal' ? 'excellent' : k.csi_status === 'normal' ? 'good' : 'critical'} />
            <KpiTile label="Est. Charging Eff." value={k.estimated_charging_efficiency} unit="%" color="#22c55e" />
            <KpiTile label="Instant Power"      value={k.instantaneous_power_kw}        unit="kW" color="#8b5cf6" />
            <KpiTile label="Taper Zone"
              value={k.is_in_taper_zone ? 'YES (SOC>80%)' : 'NO'}
              color="#475569" />
          </div>
        </div>
      )}
    </div>
  );
}

function ChargingStationDetail({ asset }) {
  const k = asset.kpis || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Utilisation ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 8 }}>📊 Station Utilisation</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:8 }}>
          <KpiTile label="Port Utilisation"
            value={k.utilization_pct ?? asset.utilization_pct} unit="%"
            color="#3b82f6"
            status={k.utilization_status}
            statusLevel={k.utilization_status === 'near_capacity' ? 'critical' : k.utilization_status === 'busy' ? 'average' : 'good'} />
          <KpiTile label="Active Sessions"  value={asset.active_sessions}        color="#22c55e" />
          <KpiTile label="Total Ports"      value={asset.total_ports}            color="#475569" />
          <KpiTile label="Port Avail."      value={k.port_availability_pct} unit="%" color="#22c55e" />
          <KpiTile label="Grid Load"
            value={k.grid_load_pct} unit="%"
            color={k.grid_status === 'critical' ? '#dc2626' : k.grid_status === 'high' ? '#d97706' : '#16a34a'}
            status={k.grid_status}
            statusLevel={k.grid_status === 'critical' ? 'critical' : k.grid_status === 'high' ? 'elevated' : 'good'} />
          <KpiTile label="Util. Trend"      value={k.utilization_trend}          color="#8b5cf6" />
        </div>
      </div>

      {/* ── Queue & Wait ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 8 }}>⏱ Queue & Wait</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="Est. Wait Time"
            value={k.queue_wait_time_min} unit="min"
            color={k.queue_wait_time_min > 30 ? '#dc2626' : k.queue_wait_time_min > 15 ? '#d97706' : '#16a34a'}
            status={k.queue_pressure}
            statusLevel={k.queue_pressure === 'critical' ? 'critical' : k.queue_pressure === 'high' ? 'elevated' : k.queue_pressure === 'moderate' ? 'average' : 'good'} />
          <KpiTile label="Queue Length"    value={k.queue_length}                    color="#ef4444" />
          <KpiTile label="Free Ports"      value={k.effective_available_ports}       color="#22c55e" />
          <KpiTile label="MTBF"            value={k.mtbf_h}              unit="h"    color="#06b6d4" />
          <KpiTile label="Predicted Fault" value={k.predicted_failure_in_h} unit="h" color="#f59e0b" />
          <KpiTile label="Fault Count"     value={k.fault_count}                     color="#ef4444" />
        </div>
      </div>

      {/* ── Revenue ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
          letterSpacing: '0.08em', marginBottom: 8 }}>💰 Revenue Efficiency</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="Revenue Efficiency (RES)"
            value={k.revenue_efficiency_score_pct} unit="%"
            color={k.res_status === 'high_performing' ? '#16a34a' : k.res_status === 'normal' ? '#d97706' : '#dc2626'}
            status={k.res_status}
            statusLevel={k.res_status === 'high_performing' ? 'excellent' : k.res_status === 'normal' ? 'good' : 'poor'} />
          <KpiTile label="Revenue/kWh"     value={k.revenue_per_kwh_inr}            unit="₹" color="#22c55e" />
          <KpiTile label="Revenue/Port"    value={k.revenue_per_port_inr}           unit="₹" color="#8b5cf6" />
          <KpiTile label="Avg Session Rev" value={k.avg_session_revenue_inr}        unit="₹" color="#f59e0b" />
          <KpiTile label="Revenue Gap"
            value={k.revenue_gap_inr != null ? Math.round(k.revenue_gap_inr) : null}
            unit="₹" color="#ef4444" />
          <KpiTile label="Rev/Port/Day"    value={k.revenue_per_port_per_day_inr}   unit="₹" color="#06b6d4" />
        </div>
      </div>
    </div>
  );
}


const DETAIL_COMPONENTS = {
  ev_vehicle:       EVDetail,
  charging_station: ChargingStationDetail,
};

// ── Main dashboard ─────────────────────────────────────────────
export default function EVDashboard() {
  const industry = INDUSTRIES.ev;
  const { status, assets, alerts, stats, refresh } = useCondenseWS(industry.apiUrl);
  const { isMobile, isTablet, isTV } = useWindowSize();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory]             = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('ev_theme') || 'dark');
  const prevRef = useRef({});

  useEffect(() => { localStorage.setItem('ev_theme', theme); }, [theme]);

  const assetList   = Object.values(assets);
  const evs         = assetList.filter(a => a.asset_type === 'ev_vehicle');
  const stations    = assetList.filter(a => a.asset_type === 'charging_station');
  const selectedObj = selectedAsset ? assets[selectedAsset] : null;
  const DetailComp  = selectedObj ? DETAIL_COMPONENTS[selectedObj.asset_type] : null;

  useEffect(() => {
    if (assetList.length === 0) return;
    const hasChanged = assetList.some(a => prevRef.current[a.asset_id]?.processed_at !== a.processed_at);
    if (!hasChanged) return;
    prevRef.current = assets;

    const avgSoc     = evs.length ? (evs.reduce((s, a) => s + (a.soc_pct ?? 0), 0) / evs.length).toFixed(1) : 0;
    const totalPower = stations.reduce((s, a) => s + (a.power_delivery_kw ?? 0), 0).toFixed(1);
    const time       = new Date().toLocaleTimeString('en', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setHistory(prev => [...prev, { time, avgSoc: Number(avgSoc), totalPower: Number(totalPower) }].slice(-MAX_HISTORY));
  }, [assets]);

  const avgSoc         = evs.length ? Math.round(evs.reduce((s, a) => s + (a.soc_pct ?? 0), 0) / evs.length) : 0;
  const chargingNow    = evs.filter(a => a.charging_status === 'fast_charging' || a.charging_status === 'slow_charging').length;
  const totalPowerKW   = stations.reduce((s, a) => s + (a.power_delivery_kw ?? 0), 0).toFixed(1);
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;

  // New fleet-level KPIs from processor algorithms
  const avgSoH = evs.length && evs.some(a => a.kpis?.soh_pct != null)
    ? Math.round(evs.filter(a => a.kpis?.soh_pct != null).reduce((s, a) => s + a.kpis.soh_pct, 0)
        / evs.filter(a => a.kpis?.soh_pct != null).length)
    : null;
  const fleetV2GkWh = evs.reduce((s, a) => s + (a.kpis?.v2g_available_kwh ?? 0), 0).toFixed(1);
  const avgCRSI = evs.length && evs.some(a => a.kpis?.crsi != null)
    ? Math.round(evs.filter(a => a.kpis?.crsi != null).reduce((s, a) => s + a.kpis.crsi, 0)
        / evs.filter(a => a.kpis?.crsi != null).length)
    : null;
  const avgTCO = evs.length && evs.some(a => a.kpis?.tco_per_km_inr != null)
    ? (evs.filter(a => a.kpis?.tco_per_km_inr != null).reduce((s, a) => s + a.kpis.tco_per_km_inr, 0)
        / evs.filter(a => a.kpis?.tco_per_km_inr != null).length).toFixed(2)
    : null;
  const stationsNearCapacity = stations.filter(a => (a.kpis?.utilization_pct ?? a.utilization_pct) >= 90).length;
  const totalQueueWait = stations.reduce((s, a) => s + (a.kpis?.queue_wait_time_min ?? 0), 0);


  // ── Not configured guard ─────────────────────────────────────────────────────
  if (!industry.apiUrl) {
    return <NotConfiguredGuard theme={theme} />;
  }
  const t = THEME[theme];
  const ct = chartTheme(theme);
  return (
    <div style={{ padding: isMobile ? '12px 14px' : isTV ? '32px 40px' : '24px 28px', minHeight:'100vh', background:t.pageBg, color:t.text, fontFamily:'system-ui,sans-serif' }}>
      {/* Header */}
      <ThemedDashboardHeader
        industryId="ev"
        title="EV & Connected Mobility"
        subtitle={`EVs: ${evs.length} · Stations: ${stations.length}`}
        status={status}
        onRefresh={refresh}
        theme={theme}
        onToggleTheme={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}
      />

      <ChargingHero
        photo={evHero}
        vehicles={evs}
        stats={[
          { label: 'Fleet Avg SOC', value: avgSoc, unit: '%', color: '#93c5fd' },
          { label: 'Charging Now', value: chargingNow, color: '#c4b5fd' },
          { label: 'Total Charge Power', value: totalPowerKW, unit: 'kW', color: '#fbbf24' },
          { label: 'Critical Alerts', value: criticalAlerts, color: criticalAlerts > 0 ? '#f87171' : '#4ade80' },
        ]}
      />

      {/* KPIs */}
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <ThemedKPICard theme={theme} label="Fleet Avg SOC"        value={avgSoc}         unit="%"    color="#3b82f6" />
        <ThemedKPICard theme={theme} label="EVs Online"           value={evs.length}                 color="#22c55e" />
        <ThemedKPICard theme={theme} label="Charging Now"         value={chargingNow}                color="#8b5cf6" />
        <ThemedKPICard theme={theme} label="Fleet Avg SoH"        value={avgSoH}         unit="%"    color={avgSoH != null && avgSoH < 80 ? '#ef4444' : '#22c55e'}
          sub="Battery health (replace at <80%)" />
        <ThemedKPICard theme={theme} label="V2G Fleet Capacity"   value={fleetV2GkWh}    unit="kWh"  color="#06b6d4"
          sub="Grid-exportable energy available" />
        <ThemedKPICard theme={theme} label="Avg C-Rate Stress"    value={avgCRSI}                    color={avgCRSI != null && avgCRSI > 50 ? '#ef4444' : '#f59e0b'}
          sub="Battery abuse index (0–100)" />
        <ThemedKPICard theme={theme} label="Avg TCO/km"           value={avgTCO}         unit="₹"    color="#7c3aed"
          sub="energy + wear − maintenance" />
        <ThemedKPICard theme={theme} label="Stations Near Capacity" value={stationsNearCapacity}      color={stationsNearCapacity > 0 ? '#f59e0b' : '#22c55e'}
          sub={`of ${stations.length} stations`} />
        <ThemedKPICard theme={theme} label="Total Charge Power"   value={totalPowerKW}   unit="kW"   color="#f59e0b" />
        <ThemedKPICard theme={theme} label="Critical Alerts"      value={criticalAlerts}             color="#ef4444" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '280px 1fr', gap:20, marginBottom:20 }}>
        {/* Asset list */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:t.textDim, textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:4 }}>Fleet ({assetList.length})</div>
          {assetList.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:t.textDim, fontSize:13,
              border:`1px dashed ${t.cardBorder}`, borderRadius:10 }}>
              {status === 'connecting' ? 'Connecting to pipeline…' : 'No assets. Start the simulator.'}
            </div>
          ) : (
            assetList.map(asset => (
              <AssetCard key={asset.asset_id} asset={asset} theme={theme}
                selected={selectedAsset === asset.asset_id}
                onClick={() => setSelectedAsset(selectedAsset === asset.asset_id ? null : asset.asset_id)} />
            ))
          )}
        </div>

        {/* Charts + detail */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* SOC + Power trend */}
          <div style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`,
            borderRadius:12, padding:'16px 20px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:t.textDim, marginBottom:14 }}>
              Fleet Avg SOC & Charging Power
            </div>
            {history.length < 2 ? (
              <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center',
                color:t.textDim, fontSize:12 }}>Waiting for data stream…</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={history} margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <defs>
                    <linearGradient id="gSoc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gPow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="time" tick={{ fontSize:10, fill:ct.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{ fontSize:10, fill:ct.axis }} tickLine={false} axisLine={false} width={40}/>
                  <Tooltip contentStyle={ct.tooltipStyle} labelStyle={{ color:ct.axis }}/>
                  <Legend wrapperStyle={{ fontSize:11, color:ct.legend }}/>
                  <Area type="monotone" dataKey="avgSoc"     name="Avg SOC %"       stroke="#3b82f6" fill="url(#gSoc)" strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                  <Area type="monotone" dataKey="totalPower" name="Charge Power kW"  stroke="#f59e0b" fill="url(#gPow)" strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Asset detail */}
          {selectedObj && DetailComp && (
            <div style={{ background:t.cardBg, border:`1px solid ${t.cardBorder}`,
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:t.textDim }}>
                  {ASSET_META[selectedObj.asset_type]?.icon} {selectedObj.asset_id}
                  <span style={{ marginLeft:8 }}><StatusBadge status={selectedObj.status} /></span>
                </div>
                <span style={{ fontSize:10, color:t.textDim }}>
                  {selectedObj.processed_at && new Date(selectedObj.processed_at).toLocaleTimeString()}
                </span>
              </div>
              <DetailComp asset={selectedObj} />
            </div>
          )}
        </div>
      </div>

      <AlertFeed alerts={alerts} maxHeight={240} theme={theme} />
    </div>
  );
}
