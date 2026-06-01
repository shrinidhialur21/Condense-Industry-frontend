// src/industries/ev/EVDashboard.jsx
// Live EV & Connected Mobility dashboard — consumes WebSocket from Condense pipeline.
// Assets: electric vehicles (soc, range, temp) + charging stations (connectors, power).

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useCondenseWS } from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }    from '../../config/industries.js';
import {
  ConnectionStatus, KPICard, AlertFeed, StatusBadge, HealthGauge
} from '../../components/shared.jsx';

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
function AssetCard({ asset, selected, onClick }) {
  const meta    = ASSET_META[asset.asset_type] || { icon: '📡', label: asset.asset_type };
  const primary = asset[meta.primaryKey];
  const health  = asset.kpis?.health_score ?? 100;
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${selected ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div>
          <span style={{ fontSize:16, marginRight:6 }}>{meta.icon}</span>
          <span style={{ fontSize:12, fontWeight:600, color:'#cbd5e1' }}>{asset.asset_id}</span>
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
              <span style={{ fontSize:10, color:'#64748b', marginLeft:3 }}>{meta.primaryUnit}</span>
            </div>
          )}
          <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>{meta.label}</div>
        </div>
        <HealthGauge score={health} size={54} />
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

// ── Detail panels ──────────────────────────────────────────────
function EVDetail({ asset }) {
  const fields = [
    { label: 'SOC',            val: asset.soc_pct,               unit: '%' },
    { label: 'Range',          val: asset.estimated_range_km,     unit: 'km' },
    { label: 'Battery Temp',   val: asset.battery_temp_c,         unit: '°C' },
    { label: 'Speed',          val: asset.speed_kmh,              unit: 'km/h' },
    { label: 'Battery Health', val: asset.battery_health_pct,     unit: '%' },
    { label: 'Charge State',   val: asset.charging_status,        unit: '' },
    { label: 'Odometer',       val: asset.odometer_km,            unit: 'km' },
    { label: 'Pack Voltage',   val: asset.battery_voltage_v,      unit: 'V' },
  ];
  return <DetailGrid fields={fields} />;
}

function ChargingStationDetail({ asset }) {
  const fields = [
    { label: 'Power Delivery', val: asset.power_delivery_kw,    unit: 'kW' },
    { label: 'Connectors',     val: `${asset.connectors_occupied ?? 0}/${asset.connectors_total ?? 0}`, unit: '' },
    { label: 'Utilization',    val: asset.utilization_pct,       unit: '%' },
    { label: 'Active Sessions',val: asset.active_sessions,       unit: '' },
    { label: 'Avg Session kWh',val: asset.avg_session_kwh,       unit: 'kWh' },
    { label: 'Voltage',        val: asset.voltage_v,             unit: 'V' },
    { label: 'Uptime',         val: asset.uptime_pct,            unit: '%' },
    { label: 'Queue',          val: asset.queue_length,          unit: '' },
  ];
  return <DetailGrid fields={fields} />;
}

function DetailGrid({ fields }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
      {fields.map(f => (
        <div key={f.label} style={{
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
          borderRadius:8, padding:'10px 12px'
        }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#e2e8f0', fontFamily:'monospace' }}>
            {f.val != null ? (typeof f.val === 'number' ? Number(f.val).toFixed(1) : String(f.val)) : '—'}
            {f.unit && <span style={{ fontSize:11, color:'#475569', marginLeft:3 }}>{f.unit}</span>}
          </div>
        </div>
      ))}
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

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory]             = useState([]);
  const prevRef = useRef({});

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

  return (
    <div style={{ padding:'24px 28px', minHeight:'100vh', background:'#0a0f1a', color:'#e2e8f0', fontFamily:'system-ui,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:24 }}>🚗</span>
            <h1 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', margin:0 }}>
              EV & Connected Mobility
            </h1>
          </div>
          <div style={{ fontSize:12, color:'#475569' }}>
            Live fleet telemetry · {evs.length} EVs · {stations.length} charging stations
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <ConnectionStatus status={status} />
          <button onClick={refresh} style={{ fontSize:11, padding:'6px 12px', borderRadius:6,
            border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)',
            color:'#94a3b8', cursor:'pointer' }}>↻ Refresh</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <KPICard label="Fleet Avg SOC"       value={avgSoc}        unit="%"   color="#3b82f6" />
        <KPICard label="EVs Online"          value={evs.length}               color="#22c55e" />
        <KPICard label="Charging Now"        value={chargingNow}              color="#8b5cf6" />
        <KPICard label="Charging Stations"   value={stations.length}          color="#06b6d4" />
        <KPICard label="Total Charge Power"  value={totalPowerKW}  unit="kW"  color="#f59e0b" />
        <KPICard label="Critical Alerts"     value={criticalAlerts}           color="#ef4444" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, marginBottom:20 }}>
        {/* Asset list */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:4 }}>Fleet ({assetList.length})</div>
          {assetList.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#334155', fontSize:13,
              border:'1px dashed rgba(255,255,255,0.06)', borderRadius:10 }}>
              {status === 'connecting' ? 'Connecting to pipeline…' : 'No assets. Start the simulator.'}
            </div>
          ) : (
            assetList.map(asset => (
              <AssetCard key={asset.asset_id} asset={asset}
                selected={selectedAsset === asset.asset_id}
                onClick={() => setSelectedAsset(selectedAsset === asset.asset_id ? null : asset.asset_id)} />
            ))
          )}
        </div>

        {/* Charts + detail */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* SOC + Power trend */}
          <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
            borderRadius:12, padding:'16px 20px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
              Fleet Avg SOC & Charging Power
            </div>
            {history.length < 2 ? (
              <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center',
                color:'#334155', fontSize:12 }}>Waiting for data stream…</div>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fontSize:10, fill:'#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{ fontSize:10, fill:'#475569' }} tickLine={false} axisLine={false} width={40}/>
                  <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                    borderRadius:8, fontSize:11, color:'#e2e8f0' }} labelStyle={{ color:'#94a3b8' }}/>
                  <Legend wrapperStyle={{ fontSize:11, color:'#64748b' }}/>
                  <Area type="monotone" dataKey="avgSoc"     name="Avg SOC %"       stroke="#3b82f6" fill="url(#gSoc)" strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                  <Area type="monotone" dataKey="totalPower" name="Charge Power kW"  stroke="#f59e0b" fill="url(#gPow)" strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Asset detail */}
          {selectedObj && DetailComp && (
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1' }}>
                  {ASSET_META[selectedObj.asset_type]?.icon} {selectedObj.asset_id}
                  <span style={{ marginLeft:8 }}><StatusBadge status={selectedObj.status} /></span>
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

      <AlertFeed alerts={alerts} maxHeight={240} />
    </div>
  );
}
