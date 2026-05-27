// src/industries/logistics/LogisticsDashboard.jsx
// Logistics & Supply Chain — fleet tracking, cold chain, SLA monitoring.

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
  truck:       { icon: '🚛', label: 'Truck' },
  van:         { icon: '🚐', label: 'Delivery Van' },
  warehouse:   { icon: '🏢', label: 'Warehouse' },
  cold_chain:  { icon: '❄️', label: 'Cold Chain Unit' },
  shipment:    { icon: '📦', label: 'Shipment' },
};

// Temperature indicator for cold chain
function TempIndicator({ temp, minTemp = 2, maxTemp = 8 }) {
  const inRange = temp >= minTemp && temp <= maxTemp;
  const color   = inRange ? '#22c55e' : '#ef4444';
  return (
    <span style={{ fontSize:14, fontWeight:700, fontFamily:'monospace', color }}>
      {temp != null ? `${Number(temp).toFixed(1)}°C` : '—'}
      {!inRange && temp != null && (
        <span style={{ fontSize:10, marginLeft:4, background:'rgba(239,68,68,0.12)',
          padding:'1px 5px', borderRadius:4 }}>OUT OF RANGE</span>
      )}
    </span>
  );
}

function AssetCard({ asset, selected, onClick }) {
  const meta     = ASSET_META[asset.asset_type] || { icon: '📦', label: asset.asset_type };
  const health   = asset.kpis?.health_score ?? 100;
  const coldChain = asset.asset_type === 'cold_chain' || asset.asset_type === 'truck';
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${selected ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all 0.15s'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div>
          <span style={{ fontSize:16, marginRight:6 }}>{meta.icon}</span>
          <span style={{ fontSize:12, fontWeight:600, color:'#cbd5e1' }}>{asset.asset_id}</span>
        </div>
        <StatusBadge status={asset.status} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          {asset.speed_kmh != null && (
            <div style={{ fontSize:14, fontWeight:700, color:'#f97316', fontFamily:'monospace' }}>
              {Math.round(asset.speed_kmh)} <span style={{ fontSize:10, color:'#64748b' }}>km/h</span>
            </div>
          )}
          {coldChain && asset.temp_c != null && (
            <TempIndicator temp={asset.temp_c} />
          )}
          <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>
            {meta.label}
            {asset.sla_breach && (
              <span style={{ marginLeft:6, color:'#ef4444', fontWeight:600 }}>SLA BREACH</span>
            )}
          </div>
        </div>
        <HealthGauge score={health} size={54} />
      </div>
      {asset.has_alerts && (
        <div style={{ marginTop:6, fontSize:10, color:'#f59e0b',
          background:'rgba(245,158,11,0.08)', padding:'3px 8px', borderRadius:4, display:'inline-block' }}>
          ⚠ {asset.alert_count} alert{asset.alert_count > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

function TruckDetail({ asset }) {
  const fields = [
    { label: 'Speed',          val: asset.speed_kmh,       unit: 'km/h' },
    { label: 'Temperature',    val: asset.temp_c,          unit: '°C' },
    { label: 'Humidity',       val: asset.humidity_pct,    unit: '%' },
    { label: 'Load',           val: asset.load_pct,        unit: '%' },
    { label: 'Fuel',           val: asset.fuel_pct,        unit: '%' },
    { label: 'ETA',            val: asset.eta_min,         unit: 'min' },
    { label: 'Shock Events',   val: asset.shock_events,    unit: '' },
    { label: 'On Time',        val: asset.on_time ? 'YES' : 'NO', unit: '' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
      {fields.map(f => (
        <div key={f.label} style={{ background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'10px 12px' }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:18, fontWeight:700,
            color: (f.label === 'On Time' && f.val === 'NO') ? '#ef4444' : '#e2e8f0',
            fontFamily:'monospace' }}>
            {f.val != null ? (typeof f.val === 'number' ? Number(f.val).toFixed(1) : String(f.val)) : '—'}
            {f.unit && <span style={{ fontSize:11, color:'#475569', marginLeft:3 }}>{f.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LogisticsDashboard() {
  const industry = INDUSTRIES.logistics;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory]             = useState([]);
  const prevRef = useRef({});

  const assetList  = Object.values(assets);
  const trucks     = assetList.filter(a => a.asset_type === 'truck' || a.asset_type === 'van');
  const selectedObj = selectedAsset ? assets[selectedAsset] : null;

  useEffect(() => {
    if (assetList.length === 0) return;
    const hasChanged = assetList.some(a => prevRef.current[a.asset_id]?.processed_at !== a.processed_at);
    if (!hasChanged) return;
    prevRef.current = assets;

    const coldChain = assetList.filter(a => a.temp_c != null);
    const avgTemp   = coldChain.length ? (coldChain.reduce((s, a) => s + a.temp_c, 0) / coldChain.length).toFixed(1) : null;
    const onTime    = trucks.length ? Math.round((trucks.filter(a => a.on_time).length / trucks.length) * 100) : 0;
    const time      = new Date().toLocaleTimeString('en', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setHistory(prev => [...prev, {
      time,
      avgTemp: avgTemp != null ? Number(avgTemp) : undefined,
      onTimePct: onTime,
    }].slice(-MAX_HISTORY));
  }, [assets]);

  const slaBreaches   = assetList.filter(a => a.sla_breach).length;
  const onTimePct     = trucks.length ? Math.round((trucks.filter(a => a.on_time).length / trucks.length) * 100) : 100;
  const coldChainOOR  = assetList.filter(a => a.temp_c != null && (a.temp_c < 2 || a.temp_c > 8)).length;
  const critAlerts    = alerts.filter(a => a.severity === 'critical').length;

  // Shipment status breakdown
  const statusCounts = ['in_transit','delivered','delayed','failed'].map(s => ({
    status: s,
    count:  assetList.filter(a => a.status === s).length,
  }));

  return (
    <div style={{ padding:'24px 28px', minHeight:'100vh', background:'#0a0f1a', color:'#e2e8f0', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:24 }}>📦</span>
            <h1 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', margin:0 }}>Logistics & Supply Chain</h1>
          </div>
          <div style={{ fontSize:12, color:'#475569' }}>
            Live fleet tracking · {assetList.length} assets · {trucks.length} vehicles in motion
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
        <KPICard label="Active Vehicles"   value={trucks.length}              color="#22c55e" />
        <KPICard label="On-Time Rate"      value={onTimePct}     unit="%"     color={onTimePct >= 90 ? '#22c55e' : '#f59e0b'} />
        <KPICard label="SLA Breaches"      value={slaBreaches}                color={slaBreaches > 0 ? '#ef4444' : '#22c55e'} />
        <KPICard label="Cold Chain OOR"    value={coldChainOOR}               color={coldChainOOR > 0 ? '#ef4444' : '#22c55e'} />
        <KPICard label="Total Assets"      value={assetList.length}           color="#f97316" />
        <KPICard label="Critical Alerts"   value={critAlerts}                 color="#ef4444" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, marginBottom:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:4 }}>Fleet ({assetList.length})</div>
          {assetList.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#334155', fontSize:13,
              border:'1px dashed rgba(255,255,255,0.06)', borderRadius:10 }}>
              {status === 'connecting' ? 'Connecting…' : 'No assets. Start the simulator.'}
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
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* Cold chain temp trend */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
                ❄️ Cold Chain Temp & On-Time %
              </div>
              {history.length < 2 ? (
                <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#334155', fontSize:12 }}>Waiting…</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={history} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={35}/>
                    <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:8, fontSize:11, color:'#e2e8f0' }}/>
                    <Legend wrapperStyle={{ fontSize:10, color:'#64748b' }}/>
                    <Line type="monotone" dataKey="avgTemp"   name="Avg Temp °C"   stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false}/>
                    <Line type="monotone" dataKey="onTimePct" name="On-Time %"      stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false}/>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Shipment status bar */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
                Shipment Status Breakdown
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={statusCounts} margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="status" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={30}/>
                  <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                    borderRadius:8, fontSize:11, color:'#e2e8f0' }}/>
                  <Bar dataKey="count" name="Count" fill="#f97316" radius={[4,4,0,0]} isAnimationActive={false}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {selectedObj && (
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1' }}>
                  {ASSET_META[selectedObj.asset_type]?.icon ?? '📦'} {selectedObj.asset_id}
                  <span style={{ marginLeft:8 }}><StatusBadge status={selectedObj.status} /></span>
                </div>
                <span style={{ fontSize:10, color:'#475569' }}>
                  {selectedObj.processed_at && new Date(selectedObj.processed_at).toLocaleTimeString()}
                </span>
              </div>
              <TruckDetail asset={selectedObj} />
            </div>
          )}
        </div>
      </div>

      <AlertFeed alerts={alerts} maxHeight={240} />
    </div>
  );
}
