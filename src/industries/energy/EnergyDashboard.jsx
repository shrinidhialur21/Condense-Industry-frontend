// src/industries/energy/EnergyDashboard.jsx
// Live energy sector dashboard — consumes WebSocket from App 3 (Insights API).
// Shows: fleet KPIs, per-asset cards, power trend chart, alert feed.

import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useCondenseWS }  from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }     from '../../config/industries.js';
import { useWindowSize }  from '../../hooks/useWindowSize.js';
import {
  AlertFeed, StatusBadge, HealthGauge,
  THEME, ThemedDashboardHeader, ThemedKPICard, NotConfiguredGuard,
} from '../../components/shared.jsx';
import energyHero from '../../assets/industries/energy.jpg';

// Code-split — three.js/react-three-fiber only downloads when this dashboard mounts.
const EnergyScene3D = lazy(() => import('./EnergyScene3D.jsx'));

const MAX_HISTORY = 40; // data points kept in trend chart

// Hero — real low-poly 3D wind & solar farm. Blade speed is driven by each
// turbine's real rotor_rpm; solar glow by real irradiance_wm2. Falls back to
// the real photo while the 3D bundle loads.
function EnergyHero({ assets, stats }) {
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 20, minHeight: 240 }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <Suspense fallback={
          <img src={energyHero} alt="Wind farm" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        }>
          <EnergyScene3D assets={assets} />
        </Suspense>
      </div>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(9,14,26,0.05) 0%, rgba(9,14,26,0.1) 55%, rgba(9,14,26,0.65) 100%)',
      }} />
      <div style={{ position: 'relative', padding: '20px 24px', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', minHeight: 240, boxSizing: 'border-box', pointerEvents: 'none' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(11,18,32,0.55)',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, padding: '4px 10px', marginBottom: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#e6eaf2', letterSpacing: '0.05em' }}>LIVE GENERATION</span>
          </div>
          <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: '#ffffff' }}>Wind & Solar Fleet</div>
        </div>
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
      </div>
    </div>
  );
}

// ── Asset type icons / labels ─────────────────────────────────
const ASSET_META = {
  wind_turbine:  { icon: '🌀', label: 'Wind Turbine',  powerKey: 'power_output_kw',     powerUnit: 'kW' },
  solar_farm:    { icon: '☀️', label: 'Solar Panel',   powerKey: 'ac_power_output_kw',  powerUnit: 'kW' },
  scada_sensor:  { icon: '⚙️', label: 'SCADA Station', powerKey: 'active_power_mw',     powerUnit: 'MW' },
  smart_meter:   { icon: '📟', label: 'Smart Meter',   powerKey: 'demand_kw',           powerUnit: 'kW' },
};

// ── Individual asset card ─────────────────────────────────────
function AssetCard({ asset, selected, onClick }) {
  const meta   = ASSET_META[asset.asset_type] || { icon: '📡', label: asset.asset_type, powerKey: null };
  const power  = meta.powerKey ? asset[meta.powerKey] : null;
  const health = asset.kpis?.health_score ?? 100;

  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(34,197,94,0.08)' : '#ffffff',
      border: `1px solid ${selected ? 'rgba(34,197,94,0.4)' : '#e2e8f0'}`,
      borderRadius:10, padding:'12px 14px', cursor:'pointer',
      transition:'all 0.15s', userSelect:'none'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div>
          <span style={{ fontSize:18, marginRight:6 }}>{meta.icon}</span>
          <span style={{ fontSize:12, fontWeight:600, color:'#475569' }}>{asset.asset_id}</span>
        </div>
        <StatusBadge status={asset.status} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          {power != null && (
            <div style={{ fontSize:20, fontWeight:700, color:'#22c55e',
              fontVariantNumeric:'tabular-nums', fontFamily:'monospace', lineHeight:1 }}>
              {typeof power === 'number' ? power.toFixed(1) : '—'}
              <span style={{ fontSize:11, color:'#64748b', marginLeft:3 }}>{meta.powerUnit}</span>
            </div>
          )}
          <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>{meta.label}</div>
        </div>
        <HealthGauge score={health} size={60} />
      </div>
      {asset.has_alerts && (
        <div style={{ marginTop:8, fontSize:10, color:'#f59e0b',
          background:'rgba(245,158,11,0.08)', padding:'3px 8px',
          borderRadius:4, display:'inline-block' }}>
          ⚠ {asset.alert_count} active alert{asset.alert_count > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ── Turbine detail panel ──────────────────────────────────────
function WindTurbineDetail({ asset }) {
  if (!asset) return null;
  const fields = [
    { label: 'Wind Speed',     val: asset.wind_speed_mps,     unit: 'm/s' },
    { label: 'Rotor RPM',      val: asset.rotor_rpm,          unit: 'RPM' },
    { label: 'Power Output',   val: asset.power_output_kw,    unit: 'kW' },
    { label: 'Blade Pitch',    val: asset.blade_pitch_angle_deg, unit: '°' },
    { label: 'Vibration',      val: asset.vibration_ms2,      unit: 'm/s²' },
    { label: 'Gearbox Temp',   val: asset.gearbox_temp_c,     unit: '°C' },
    { label: 'Generator Temp', val: asset.generator_temp_c,   unit: '°C' },
    { label: 'Capacity Factor',val: asset.capacity_factor_pct,unit: '%' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
      {fields.map(f => (
        <div key={f.label} style={{
          background:'#ffffff', border:'1px solid #e2e8f0',
          borderRadius:8, padding:'10px 12px'
        }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#1e293b',
            fontFamily:'monospace', fontVariantNumeric:'tabular-nums' }}>
            {f.val != null ? Number(f.val).toFixed(1) : '—'}
            <span style={{ fontSize:11, color:'#475569', marginLeft:3 }}>{f.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SolarDetail({ asset }) {
  const fields = [
    { label: 'Irradiance',      val: asset.irradiance_wm2,             unit: 'W/m²' },
    { label: 'Panel Temp',      val: asset.panel_temp_c,               unit: '°C' },
    { label: 'DC Voltage',      val: asset.dc_voltage_v,               unit: 'V' },
    { label: 'AC Power',        val: asset.ac_power_output_kw,         unit: 'kW' },
    { label: 'Inverter Eff.',   val: asset.inverter_efficiency_pct,    unit: '%' },
    { label: 'Soiling Loss',    val: asset.soiling_loss_pct,           unit: '%' },
    { label: 'Today kWh',       val: asset.energy_today_kwh,           unit: 'kWh' },
    { label: 'String Fault',    val: asset.string_fault ? 'YES' : 'NO', unit: '' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
      {fields.map(f => (
        <div key={f.label} style={{
          background:'#ffffff', border:'1px solid #e2e8f0',
          borderRadius:8, padding:'10px 12px'
        }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:18, fontWeight:700,
            color: f.label === 'String Fault' && f.val === 'YES' ? '#ef4444' : '#e2e8f0',
            fontFamily:'monospace' }}>
            {String(f.val)}<span style={{ fontSize:11, color:'#475569', marginLeft:3 }}>{f.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScadaDetail({ asset }) {
  const fields = [
    { label: 'Voltage',         val: asset.voltage_kv,             unit: 'kV' },
    { label: 'Frequency',       val: asset.frequency_hz,           unit: 'Hz' },
    { label: 'Active Power',    val: asset.active_power_mw,        unit: 'MW' },
    { label: 'Power Factor',    val: asset.power_factor,           unit: '' },
    { label: 'Transformer °C',  val: asset.transformer_temp_c,     unit: '°C' },
    { label: 'Breaker',         val: asset.breaker_status,         unit: '' },
    { label: 'Relay',           val: asset.protection_relay,       unit: '' },
    { label: 'Freq Δ',          val: asset.kpis?.freq_deviation_hz, unit: 'Hz' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
      {fields.map(f => (
        <div key={f.label} style={{
          background:'#ffffff', border:'1px solid #e2e8f0',
          borderRadius:8, padding:'10px 12px'
        }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#1e293b', fontFamily:'monospace' }}>
            {f.val != null ? (typeof f.val === 'number' ? Number(f.val).toFixed(2) : String(f.val)) : '—'}
            <span style={{ fontSize:11, color:'#475569', marginLeft:3 }}>{f.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MeterDetail({ asset }) {
  const fields = [
    { label: 'Demand',          val: asset.demand_kw,          unit: 'kW' },
    { label: 'Voltage',         val: asset.voltage_v,          unit: 'V' },
    { label: 'Current',         val: asset.current_a,          unit: 'A' },
    { label: 'Power Factor',    val: asset.power_factor,       unit: '' },
    { label: 'THD',             val: asset.thd_pct,            unit: '%' },
    { label: 'Cumulative',      val: asset.cumulative_kwh,     unit: 'kWh' },
    { label: 'Tamper',          val: asset.tamper_detected ? 'YES' : 'NO', unit: '' },
    { label: 'Outage',          val: asset.outage_flag ? 'YES' : 'NO',     unit: '' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
      {fields.map(f => (
        <div key={f.label} style={{
          background:'#ffffff', border:'1px solid #e2e8f0',
          borderRadius:8, padding:'10px 12px'
        }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:18, fontWeight:700,
            color: (f.label === 'Tamper' || f.label === 'Outage') && f.val === 'YES' ? '#ef4444' : '#e2e8f0',
            fontFamily:'monospace' }}>
            {String(f.val) ?? '—'}
            <span style={{ fontSize:11, color:'#475569', marginLeft:3 }}>{f.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const DETAIL_COMPONENTS = {
  wind_turbine: WindTurbineDetail,
  solar_farm:   SolarDetail,
  scada_sensor: ScadaDetail,
  smart_meter:  MeterDetail,
};

// ── Main dashboard ────────────────────────────────────────────
export default function EnergyDashboard() {
  const industry              = INDUSTRIES.energy;
  const { status, assets, alerts, stats, aggregates, refresh }
    = useCondenseWS(industry.apiUrl);
  const { isMobile, isTablet, isTV } = useWindowSize();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [powerHistory,  setPowerHistory]  = useState([]); // [{time, ...asset powers}]
  const [theme, setTheme] = useState(() => localStorage.getItem('energy_theme') || 'dark');
  const prevAssetsRef = useRef({});

  useEffect(() => { localStorage.setItem('energy_theme', theme); }, [theme]);

  // Build rolling power history from incoming asset updates
  useEffect(() => {
    const assetList = Object.values(assets);
    if (assetList.length === 0) return;

    // Only push a new point if something changed
    const hasChanged = assetList.some(a =>
      prevAssetsRef.current[a.asset_id]?.processed_at !== a.processed_at
    );
    if (!hasChanged) return;
    prevAssetsRef.current = assets;

    const point = { time: new Date().toLocaleTimeString('en', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' }) };
    assetList.forEach(a => {
      const meta = ASSET_META[a.asset_type];
      if (meta?.powerKey) point[a.asset_id] = a[meta.powerKey];
    });

    setPowerHistory(prev => {
      const next = [...prev, point];
      return next.slice(-MAX_HISTORY);
    });
  }, [assets]);

  const assetList   = Object.values(assets);
  const selectedObj = selectedAsset ? assets[selectedAsset] : null;
  const DetailComp  = selectedObj ? DETAIL_COMPONENTS[selectedObj.asset_type] : null;

  // Fleet-level KPIs
  const totalPower = useMemo(() => {
    return assetList.reduce((sum, a) => {
      const meta = ASSET_META[a.asset_type];
      return sum + (meta?.powerKey && a[meta.powerKey] ? Number(a[meta.powerKey]) : 0);
    }, 0).toFixed(1);
  }, [assetList]);

  const avgHealth = useMemo(() => {
    if (assetList.length === 0) return 0;
    const sum = assetList.reduce((s, a) => s + (a.kpis?.health_score ?? 0), 0);
    return Math.round(sum / assetList.length);
  }, [assetList]);

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const assetsWithAlerts = assetList.filter(a => a.has_alerts).length;

  // Power chart lines (one per asset)
  const powerChartLines = useMemo(() => {
    const COLORS = ['#22c55e','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4'];
    return assetList.slice(0, 6).map((a, i) => ({
      key: a.asset_id, color: COLORS[i % COLORS.length]
    }));
  }, [assetList.length]);


  // ── Not configured guard ─────────────────────────────────────────────────────
  if (!industry.apiUrl) {
    return <NotConfiguredGuard theme={theme} />;
  }
  const t = THEME[theme];
  return (
    <div style={{ padding: isMobile ? '12px 14px' : isTV ? '32px 40px' : '24px 28px', minHeight:'100vh',
      background:t.pageBg, color:t.text, fontFamily:'system-ui, sans-serif' }}>

      {/* Header */}
      <ThemedDashboardHeader
        industryId="energy"
        title="Renewable Energy & Utilities"
        subtitle={`Assets: ${assetList.length} · Alerts: ${alerts.length}`}
        status={status}
        onRefresh={refresh}
        theme={theme}
        onToggleTheme={() => setTheme(v => v === 'dark' ? 'light' : 'dark')}
      />

      <EnergyHero
        assets={assetList}
        stats={[
          { label: 'Total Power', value: totalPower, unit: 'kW', color: '#4ade80' },
          { label: 'Assets Online', value: assetList.length, color: '#93c5fd' },
          { label: 'Avg Health', value: avgHealth, unit: '/100', color: avgHealth >= 70 ? '#4ade80' : avgHealth >= 40 ? '#fbbf24' : '#f87171' },
          { label: 'Critical Alerts', value: criticalAlerts.length, color: criticalAlerts.length > 0 ? '#f87171' : '#4ade80' },
        ]}
      />

      {/* Fleet KPIs */}
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <ThemedKPICard theme={theme} label="Total Power" value={totalPower} unit="kW" color="#22c55e" />
        <ThemedKPICard theme={theme} label="Assets Online" value={assetList.length} color="#3b82f6" />
        <ThemedKPICard theme={theme} label="Avg Health Score" value={avgHealth} unit="/100"
          color={avgHealth >= 70 ? '#22c55e' : avgHealth >= 40 ? '#f59e0b' : '#ef4444'} />
        <ThemedKPICard theme={theme} label="Critical Alerts" value={criticalAlerts.length} color="#ef4444" />
        <ThemedKPICard theme={theme} label="Assets w/ Alerts" value={assetsWithAlerts} color="#f59e0b" />
        <ThemedKPICard theme={theme} label="Total Events" value={stats?.total_messages ?? '—'} color="#64748b"
          sub={stats?.last_updated ? `Last: ${new Date(stats.last_updated).toLocaleTimeString()}` : null} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '280px 1fr', gap:20, marginBottom:20 }}>
        {/* Asset list */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#64748b',
            textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
            Assets ({assetList.length})
          </div>
          {assetList.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#334155', fontSize:13,
              border:'1px dashed #cbd5e1', borderRadius:10 }}>
              {status === 'connecting' ? 'Connecting to pipeline…' : 'No assets yet. Start the simulator.'}
            </div>
          ) : (
            assetList.map(asset => (
              <AssetCard
                key={asset.asset_id}
                asset={asset}
                selected={selectedAsset === asset.asset_id}
                onClick={() => setSelectedAsset(
                  selectedAsset === asset.asset_id ? null : asset.asset_id
                )}
              />
            ))
          )}
        </div>

        {/* Right panel — chart + detail */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Power trend chart */}
          <div style={{
            background:'#ffffff', border:'1px solid #e2e8f0',
            borderRadius:12, padding:'16px 20px'
          }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#475569', marginBottom:14 }}>
              Live Power Output
            </div>
            {powerHistory.length < 2 ? (
              <div style={{ height:180, display:'flex', alignItems:'center',
                justifyContent:'center', color:'#334155', fontSize:12 }}>
                Waiting for data stream…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={powerHistory} margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <defs>
                    {powerChartLines.map(l => (
                      <linearGradient key={l.key} id={`grad-${l.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={l.color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={l.color} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize:10, fill:'#475569' }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{ fontSize:10, fill:'#475569' }}
                    tickLine={false} axisLine={false} width={40}/>
                  <Tooltip
                    contentStyle={{
                      background:'#ffffff', border:'1px solid #e2e8f0',
                      borderRadius:8, fontSize:11, color:'#1e293b'
                    }}
                    labelStyle={{ color:'#64748b' }}
                  />
                  {powerChartLines.map(l => (
                    <Area key={l.key} type="monotone" dataKey={l.key}
                      stroke={l.color} strokeWidth={1.5}
                      fill={`url(#grad-${l.key})`} dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Selected asset detail */}
          {selectedObj && DetailComp && (
            <div style={{
              background:'#ffffff', border:'1px solid #e2e8f0',
              borderRadius:12, padding:'16px 20px'
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#475569' }}>
                  {ASSET_META[selectedObj.asset_type]?.icon} {selectedObj.asset_id}
                  <StatusBadge status={selectedObj.status} style={{ marginLeft:8 }} />
                </div>
                <span style={{ fontSize:10, color:'#475569' }}>
                  {selectedObj.processed_at && new Date(selectedObj.processed_at).toLocaleTimeString()}
                </span>
              </div>
              <DetailComp asset={selectedObj} />
            </div>
          )}
        </div>
      </div>

      {/* Alert feed */}
      <AlertFeed alerts={alerts} maxHeight={260} />
    </div>
  );
}