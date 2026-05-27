// src/industries/energy/EnergyDashboard.jsx
// Live energy sector dashboard — consumes WebSocket from App 3 (Insights API).
// Shows: fleet KPIs, per-asset cards, power trend chart, alert feed.

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useCondenseWS }  from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }     from '../../config/industries.js';
import {
  ConnectionStatus, KPICard, HealthGauge, AlertFeed, StatusBadge
} from '../../components/shared.jsx';

const MAX_HISTORY = 40; // data points kept in trend chart

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
      background: selected ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${selected ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius:10, padding:'12px 14px', cursor:'pointer',
      transition:'all 0.15s', userSelect:'none'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div>
          <span style={{ fontSize:18, marginRight:6 }}>{meta.icon}</span>
          <span style={{ fontSize:12, fontWeight:600, color:'#cbd5e1' }}>{asset.asset_id}</span>
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
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
          borderRadius:8, padding:'10px 12px'
        }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#e2e8f0',
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
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
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
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
          borderRadius:8, padding:'10px 12px'
        }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#e2e8f0', fontFamily:'monospace' }}>
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
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
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

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [powerHistory,  setPowerHistory]  = useState([]); // [{time, ...asset powers}]
  const prevAssetsRef = useRef({});

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

  return (
    <div style={{ padding:'24px 28px', minHeight:'100vh',
      background:'#0a0f1a', color:'#e2e8f0', fontFamily:'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:24 }}>⚡</span>
            <h1 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', margin:0 }}>
              Renewable Energy & Utilities
            </h1>
          </div>
          <div style={{ fontSize:12, color:'#475569' }}>
            Live streaming from Condense pipeline · {assetList.length} assets online
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <ConnectionStatus status={status} />
          <button onClick={refresh} style={{
            fontSize:11, padding:'6px 12px', borderRadius:6,
            border:'1px solid rgba(255,255,255,0.1)',
            background:'rgba(255,255,255,0.05)', color:'#94a3b8',
            cursor:'pointer'
          }}>↻ Refresh</button>
        </div>
      </div>

      {/* Fleet KPIs */}
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <KPICard label="Total Power" value={totalPower} unit="kW" color="#22c55e" />
        <KPICard label="Assets Online" value={assetList.length} color="#3b82f6" />
        <KPICard label="Avg Health Score" value={avgHealth} unit="/100"
          color={avgHealth >= 70 ? '#22c55e' : avgHealth >= 40 ? '#f59e0b' : '#ef4444'} />
        <KPICard label="Critical Alerts" value={criticalAlerts.length} color="#ef4444" />
        <KPICard label="Assets w/ Alerts" value={assetsWithAlerts} color="#f59e0b" />
        <KPICard label="Total Events" value={stats?.total_messages ?? '—'} color="#64748b"
          sub={stats?.last_updated ? `Last: ${new Date(stats.last_updated).toLocaleTimeString()}` : null} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, marginBottom:20 }}>
        {/* Asset list */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#64748b',
            textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
            Assets ({assetList.length})
          </div>
          {assetList.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#334155', fontSize:13,
              border:'1px dashed rgba(255,255,255,0.06)', borderRadius:10 }}>
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
            background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
            borderRadius:12, padding:'16px 20px'
          }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fontSize:10, fill:'#475569' }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{ fontSize:10, fill:'#475569' }}
                    tickLine={false} axisLine={false} width={40}/>
                  <Tooltip
                    contentStyle={{
                      background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:8, fontSize:11, color:'#e2e8f0'
                    }}
                    labelStyle={{ color:'#94a3b8' }}
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
              background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px'
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1' }}>
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