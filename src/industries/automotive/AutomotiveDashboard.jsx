// src/industries/automotive/AutomotiveDashboard.jsx
// Live Automotive & Telematics dashboard — vehicles with OBD2, GPS, CAN bus data.

import { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useCondenseWS } from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }    from '../../config/industries.js';
import {
  ConnectionStatus, KPICard, AlertFeed, StatusBadge, HealthGauge
} from '../../components/shared.jsx';

const MAX_HISTORY = 40;

const ASSET_META = {
  vehicle: { icon: '🚙', label: 'Vehicle', primaryKey: 'speed_kmh', primaryUnit: 'km/h' },
  truck:   { icon: '🚛', label: 'Truck',   primaryKey: 'speed_kmh', primaryUnit: 'km/h' },
};

function SpeedBar({ speed = 0, max = 200 }) {
  const pct   = Math.min(100, (speed / max) * 100);
  const color = speed > 120 ? '#ef4444' : speed > 80 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ width:'100%', marginTop:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#64748b', marginBottom:3 }}>
        <span>Speed</span><span style={{ color, fontFamily:'monospace', fontWeight:700 }}>{Math.round(speed)} km/h</span>
      </div>
      <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:2, transition:'width 0.3s' }}/>
      </div>
    </div>
  );
}

function AssetCard({ asset, selected, onClick }) {
  const meta   = ASSET_META[asset.asset_type] || { icon: '🚗', label: asset.asset_type };
  const health = asset.kpis?.health_score ?? 100;
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${selected ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all 0.15s'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div>
          <span style={{ fontSize:16, marginRight:6 }}>{meta.icon}</span>
          <span style={{ fontSize:12, fontWeight:600, color:'#cbd5e1' }}>{asset.asset_id}</span>
        </div>
        <StatusBadge status={asset.status} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ flex:1, marginRight:8 }}>
          <SpeedBar speed={asset.speed_kmh ?? 0} />
          <div style={{ fontSize:10, color:'#475569', marginTop:6 }}>
            {meta.label} · {asset.dtc_count ? `${asset.dtc_count} DTC` : 'No DTCs'}
          </div>
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

function VehicleDetail({ asset }) {
  const fields = [
    { label: 'Speed',          val: asset.speed_kmh,        unit: 'km/h' },
    { label: 'RPM',            val: asset.rpm,              unit: 'RPM' },
    { label: 'Engine Temp',    val: asset.engine_temp_c,    unit: '°C' },
    { label: 'Fuel Level',     val: asset.fuel_level_pct,   unit: '%' },
    { label: 'Throttle',       val: asset.throttle_pct,     unit: '%' },
    { label: 'Battery Volt',   val: asset.battery_voltage_v, unit: 'V' },
    { label: 'Odometer',       val: asset.odometer_km,      unit: 'km' },
    { label: 'DTC Codes',      val: asset.dtc_count ?? 0,   unit: '' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
      {fields.map(f => (
        <div key={f.label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)',
          borderRadius:8, padding:'10px 12px' }}>
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

export default function AutomotiveDashboard() {
  const industry = INDUSTRIES.automotive;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory]             = useState([]);
  const prevRef = useRef({});

  const assetList   = Object.values(assets);
  const selectedObj = selectedAsset ? assets[selectedAsset] : null;

  useEffect(() => {
    if (assetList.length === 0) return;
    const hasChanged = assetList.some(a => prevRef.current[a.asset_id]?.processed_at !== a.processed_at);
    if (!hasChanged) return;
    prevRef.current = assets;

    const active  = assetList.filter(a => a.ignition_on || a.speed_kmh > 0);
    const avgSpeed = active.length ? (active.reduce((s, a) => s + (a.speed_kmh ?? 0), 0) / active.length).toFixed(1) : 0;
    const avgTemp  = assetList.length ? (assetList.reduce((s, a) => s + (a.engine_temp_c ?? 0), 0) / assetList.length).toFixed(1) : 0;
    const time     = new Date().toLocaleTimeString('en', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setHistory(prev => [...prev, { time, avgSpeed: Number(avgSpeed), avgTemp: Number(avgTemp) }].slice(-MAX_HISTORY));
  }, [assets]);

  const active       = assetList.filter(a => a.ignition_on || a.speed_kmh > 0).length;
  const avgSpeed     = assetList.length ? Math.round(assetList.reduce((s, a) => s + (a.speed_kmh ?? 0), 0) / assetList.length) : 0;
  const totalDTCs    = assetList.reduce((s, a) => s + (a.dtc_count ?? 0), 0);
  const critAlerts   = alerts.filter(a => a.severity === 'critical').length;

  return (
    <div style={{ padding:'24px 28px', minHeight:'100vh', background:'#0a0f1a', color:'#e2e8f0', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:24 }}>🔧</span>
            <h1 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', margin:0 }}>Automotive & Telematics</h1>
          </div>
          <div style={{ fontSize:12, color:'#475569' }}>
            Live vehicle telemetry · {assetList.length} vehicles tracked
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <ConnectionStatus status={status} />
          <button onClick={refresh} style={{ fontSize:11, padding:'6px 12px', borderRadius:6,
            border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)',
            color:'#94a3b8', cursor:'pointer' }}>↻ Refresh</button>
        </div>
      </div>

      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <KPICard label="Vehicles Online"   value={assetList.length}           color="#22c55e" />
        <KPICard label="Active (Moving)"   value={active}                     color="#f59e0b" />
        <KPICard label="Fleet Avg Speed"   value={avgSpeed}    unit="km/h"    color="#3b82f6" />
        <KPICard label="Total DTC Codes"   value={totalDTCs}                  color={totalDTCs > 0 ? '#ef4444' : '#22c55e'} />
        <KPICard label="Critical Alerts"   value={critAlerts}                 color="#ef4444" />
        <KPICard label="Total Events"      value={assetList.length > 0 ? '●' : '—'} color="#64748b" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, marginBottom:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:4 }}>Vehicles ({assetList.length})</div>
          {assetList.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#334155', fontSize:13,
              border:'1px dashed rgba(255,255,255,0.06)', borderRadius:10 }}>
              {status === 'connecting' ? 'Connecting…' : 'No vehicles. Start the simulator.'}
            </div>
          ) : (
            assetList.map(a => (
              <AssetCard key={a.asset_id} asset={a}
                selected={selectedAsset === a.asset_id}
                onClick={() => setSelectedAsset(selectedAsset === a.asset_id ? null : a.asset_id)} />
            ))
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
            borderRadius:12, padding:'16px 20px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
              Fleet Avg Speed & Engine Temp
            </div>
            {history.length < 2 ? (
              <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center',
                color:'#334155', fontSize:12 }}>Waiting for data stream…</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={history} margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fontSize:10, fill:'#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{ fontSize:10, fill:'#475569' }} tickLine={false} axisLine={false} width={40}/>
                  <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                    borderRadius:8, fontSize:11, color:'#e2e8f0' }} labelStyle={{ color:'#94a3b8' }}/>
                  <Legend wrapperStyle={{ fontSize:11, color:'#64748b' }}/>
                  <Line type="monotone" dataKey="avgSpeed" name="Avg Speed km/h" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false}/>
                  <Line type="monotone" dataKey="avgTemp"  name="Avg Engine °C"  stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {selectedObj && (
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1' }}>
                  {ASSET_META[selectedObj.asset_type]?.icon ?? '🚗'} {selectedObj.asset_id}
                  <span style={{ marginLeft:8 }}><StatusBadge status={selectedObj.status} /></span>
                </div>
                <span style={{ fontSize:10, color:'#475569' }}>
                  {selectedObj.processed_at && new Date(selectedObj.processed_at).toLocaleTimeString()}
                </span>
              </div>
              <VehicleDetail asset={selectedObj} />
            </div>
          )}
        </div>
      </div>

      <AlertFeed alerts={alerts} maxHeight={240} />
    </div>
  );
}
