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
  const meta      = ASSET_META[asset.asset_type] || { icon: '📦', label: asset.asset_type };
  const health    = asset.kpis?.health_score ?? 100;
  const isCold    = asset.asset_type === 'cold_chain';
  const assetTemp = asset.current_temp_c ?? asset.cargo_temp_c ?? asset.temp_c ?? null;
  const slaFail   = asset.on_time === false;
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
          {isCold && assetTemp != null && (
            <TempIndicator temp={assetTemp} />
          )}
          {asset.carrier && (
            <div style={{ fontSize:11, color:'#94a3b8' }}>{asset.carrier}</div>
          )}
          <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>
            {asset.origin_city && asset.destination_city
              ? `${asset.origin_city} → ${asset.destination_city}`
              : meta.label}
            {slaFail && (
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

function DetailGrid({ fields }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
      {fields.map(f => (
        <div key={f.label} style={{ background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'10px 12px' }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:16, fontWeight:700,
            color: (f.label === 'On Time' && f.val === 'NO') ? '#ef4444' :
                   (f.label === 'On Time' && f.val === 'YES') ? '#22c55e' : '#e2e8f0',
            fontFamily:'monospace' }}>
            {f.val != null ? (typeof f.val === 'number' ? Number(f.val).toFixed(1) : String(f.val)) : '—'}
            {f.unit && <span style={{ fontSize:11, color:'#475569', marginLeft:3 }}>{f.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// delivery_vehicle detail — uses delivery_vehicle field names from simulator
function TruckDetail({ asset }) {
  const fields = [
    { label: 'Speed',          val: asset.speed_kmh,               unit: 'km/h' },
    { label: 'Cargo Temp',     val: asset.cargo_temp_c,            unit: '°C' },
    { label: 'Fuel Level',     val: asset.fuel_level_pct,          unit: '%' },
    { label: 'Deliveries Done',val: asset.deliveries_completed,    unit: '' },
    { label: 'Pending',        val: asset.deliveries_pending,      unit: '' },
    { label: 'Next Stop ETA',  val: asset.next_stop_eta_min,       unit: 'min' },
    { label: 'Harsh Brakes',   val: asset.harsh_brake_count,       unit: '' },
    { label: 'On Time',        val: asset.on_time != null ? (asset.on_time ? 'YES' : 'NO') : null, unit: '' },
  ];
  return <DetailGrid fields={fields} />;
}

// shipment detail — uses shipment field names from simulator
function ShipmentDetail({ asset }) {
  const fields = [
    { label: 'Tracking ID',    val: asset.tracking_id,            unit: '' },
    { label: 'Carrier',        val: asset.carrier,                unit: '' },
    { label: 'Service',        val: asset.service_type,           unit: '' },
    { label: 'Origin',         val: asset.origin_city,            unit: '' },
    { label: 'Destination',    val: asset.destination_city,       unit: '' },
    { label: 'Weight',         val: asset.weight_kg,              unit: 'kg' },
    { label: 'Delay',          val: asset.delay_h,                unit: 'h' },
    { label: 'On Time',        val: asset.on_time != null ? (asset.on_time ? 'YES' : 'NO') : null, unit: '' },
  ];
  return <DetailGrid fields={fields} />;
}

// cold_chain detail — uses cold_chain field names from simulator
function ColdChainDetail({ asset }) {
  const fields = [
    { label: 'Current Temp',   val: asset.current_temp_c,         unit: '°C' },
    { label: 'Set Point',      val: asset.set_point_c,            unit: '°C' },
    { label: 'Deviation',      val: asset.temp_deviation_c,       unit: '°C' },
    { label: 'Humidity',       val: asset.humidity_pct,           unit: '%' },
    { label: 'Compressor',     val: asset.compressor_status,      unit: '' },
    { label: 'Door Open',      val: asset.door_open ? 'YES' : 'NO', unit: '' },
    { label: 'Excursions',     val: asset.excursion_count,        unit: '' },
    { label: 'Battery Backup', val: asset.battery_backup_h,       unit: 'h' },
  ];
  return <DetailGrid fields={fields} />;
}

const DETAIL_COMPONENTS = {
  delivery_vehicle: TruckDetail,
  truck:            TruckDetail,
  van:              TruckDetail,
  shipment:         ShipmentDetail,
  cold_chain:       ColdChainDetail,
};

export default function LogisticsDashboard() {
  const industry = INDUSTRIES.logistics;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory]             = useState([]);
  const prevRef = useRef({});

  const assetList   = Object.values(assets);
  // include all moving asset types: delivery_vehicle, shipment, truck, van
  const movingAssets = assetList.filter(a => ['truck','van','delivery_vehicle','shipment'].includes(a.asset_type));
  const selectedObj  = selectedAsset ? assets[selectedAsset] : null;
  const DetailComp   = selectedObj ? (DETAIL_COMPONENTS[selectedObj.asset_type] || null) : null;

  // helper: get temperature from any asset type
  const getTemp = (a) => a.current_temp_c ?? a.cargo_temp_c ?? a.temp_c ?? null;

  useEffect(() => {
    if (assetList.length === 0) return;
    const hasChanged = assetList.some(a => prevRef.current[a.asset_id]?.processed_at !== a.processed_at);
    if (!hasChanged) return;
    prevRef.current = assets;

    const coldChain = assetList.filter(a => getTemp(a) != null);
    const avgTemp   = coldChain.length ? (coldChain.reduce((s, a) => s + getTemp(a), 0) / coldChain.length).toFixed(1) : null;
    const onTime    = movingAssets.length ? Math.round((movingAssets.filter(a => a.on_time).length / movingAssets.length) * 100) : 0;
    const time      = new Date().toLocaleTimeString('en', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setHistory(prev => [...prev, {
      time,
      avgTemp: avgTemp != null ? Number(avgTemp) : undefined,
      onTimePct: onTime,
    }].slice(-MAX_HISTORY));
  }, [assets]);

  // SLA breach: on_time === false (works for both shipment and delivery_vehicle)
  const slaBreaches   = assetList.filter(a => a.on_time === false).length;
  const onTimePct     = movingAssets.length ? Math.round((movingAssets.filter(a => a.on_time).length / movingAssets.length) * 100) : 100;
  const coldChainOOR  = assetList.filter(a => { const t = getTemp(a); return t != null && (t < 2 || t > 8); }).length;
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
            Live fleet tracking · {assetList.length} assets · {movingAssets.length} vehicles in motion
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
        <KPICard label="Active Vehicles"   value={movingAssets.length}        color="#22c55e" />
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

          {selectedObj && DetailComp && (
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
              <DetailComp asset={selectedObj} />
            </div>
          )}
        </div>
      </div>

      <AlertFeed alerts={alerts} maxHeight={240} />
    </div>
  );
}
