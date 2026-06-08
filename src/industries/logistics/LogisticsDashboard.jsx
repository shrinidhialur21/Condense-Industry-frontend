// src/industries/logistics/LogisticsDashboard.jsx
// Logistics & Supply Chain — fleet tracking, cold chain, SLA monitoring.

import { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useCondenseWS } from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }    from '../../config/industries.js';
import { useWindowSize } from '../../hooks/useWindowSize.js';
import {
  ConnectionStatus, KPICard, AlertFeed, StatusBadge, HealthGauge,
  DashboardHeader, RefreshButton,
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
      background: selected ? 'rgba(249,115,22,0.08)' : '#ffffff',
      border: `1px solid ${selected ? 'rgba(249,115,22,0.4)' : '#e2e8f0'}`,
      borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all 0.15s'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div>
          <span style={{ fontSize:16, marginRight:6 }}>{meta.icon}</span>
          <span style={{ fontSize:12, fontWeight:600, color:'#475569' }}>{asset.asset_id}</span>
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
            <div style={{ fontSize:11, color:'#64748b' }}>{asset.carrier}</div>
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
        <div key={f.label} style={{ background:'#ffffff',
          border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 12px' }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:16, fontWeight:700,
            color: (f.label === 'On Time' && f.val === 'NO') ? '#dc2626' :
                   (f.label === 'On Time' && f.val === 'YES') ? '#16a34a' : '#1e293b',
            fontFamily:'monospace' }}>
            {f.val != null ? (typeof f.val === 'number' ? Number(f.val).toFixed(1) : String(f.val)) : '—'}
            {f.unit && <span style={{ fontSize:11, color:'#475569', marginLeft:3 }}>{f.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// delivery_vehicle detail — shows new KPIs + base fields
function TruckDetail({ asset }) {
  const k = asset.kpis || {};
  const safetyColor = k.driver_safety_score >= 80 ? '#16a34a' : k.driver_safety_score >= 60 ? '#d97706' : '#dc2626';
  return (
    <div>
      {/* Driver Safety + MTBF/MTTR hero row */}
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        {[
          { label:'Safety Score', val: k.driver_safety_score, unit:'/100', color: safetyColor },
          { label:'MTBF',         val: k.mtbf_h,              unit:'h',    color:'#7c3aed' },
          { label:'MTTR',         val: k.mttr_h,              unit:'h',    color:'#0284c7' },
        ].map(item => (
          <div key={item.label} style={{ flex:1, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>{item.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:item.color, fontFamily:'monospace', marginTop:2 }}>
              {item.val != null ? Number(item.val).toFixed(1) : '—'}
              {item.unit && <span style={{ fontSize:9, color:'#94a3b8', marginLeft:2 }}>{item.unit}</span>}
            </div>
          </div>
        ))}
      </div>
      <DetailGrid fields={[
        { label: 'Safety Rating',    val: k.safety_rating,                   unit: '' },
        { label: 'Fuel Efficiency',  val: k.fuel_efficiency_kmpl,            unit: 'km/L' },
        { label: 'Route Efficiency', val: k.route_efficiency_score,          unit: '' },
        { label: 'Load Efficiency',  val: k.vehicle_load_efficiency_pct,     unit: '%' },
        { label: 'Idle Ratio',       val: k.idle_ratio_pct,                  unit: '%' },
        { label: 'Avg Speed',        val: k.avg_speed_kmh,                   unit: 'km/h' },
        { label: 'Speed',            val: asset.speed_kmh,                   unit: 'km/h' },
        { label: 'Fuel Level',       val: asset.fuel_level_pct,              unit: '%' },
        { label: 'Deliveries Done',  val: asset.deliveries_completed,        unit: '' },
        { label: 'Pending',          val: asset.deliveries_pending,          unit: '' },
        { label: 'Harsh Brakes',     val: asset.harsh_brake_count,           unit: '' },
        { label: 'On Time',          val: asset.on_time != null ? (asset.on_time ? 'YES' : 'NO') : null, unit: '' },
      ]} />
    </div>
  );
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

// cold_chain detail — shows CCCS + base fields
function ColdChainDetail({ asset }) {
  const k = asset.kpis || {};
  const cccsColor = k.cold_chain_compliance_pct >= 90 ? '#16a34a' : k.cold_chain_compliance_pct >= 70 ? '#d97706' : '#dc2626';
  return (
    <div>
      {/* Cold Chain Compliance hero */}
      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <div style={{ flex:1, background: k.cold_chain_compliance_pct < 70 ? '#fee2e2' : '#f0fdf4',
          border:`1px solid ${cccsColor}30`, borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
          <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>Cold Chain Compliance</div>
          <div style={{ fontSize:28, fontWeight:800, color:cccsColor, fontFamily:'monospace', marginTop:2 }}>
            {k.cold_chain_compliance_pct != null ? `${k.cold_chain_compliance_pct.toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>
            {k.temp_trend ? `Trend: ${k.temp_trend}` : ''}
          </div>
        </div>
        <div style={{ flex:1, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
          <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>Battery Reserve</div>
          <div style={{ fontSize:16, fontWeight:700, color:'#0284c7', fontFamily:'monospace', marginTop:2 }}>
            {k.battery_reserve_status || asset.battery_backup_h ? `${asset.battery_backup_h}h` : '—'}
          </div>
        </div>
      </div>
      <DetailGrid fields={[
        { label: 'Current Temp',   val: asset.current_temp_c,         unit: '°C' },
        { label: 'Set Point',      val: asset.set_point_c,            unit: '°C' },
        { label: 'Deviation',      val: asset.temp_deviation_c,       unit: '°C' },
        { label: 'Humidity',       val: asset.humidity_pct,           unit: '%' },
        { label: 'Compressor',     val: asset.compressor_status,      unit: '' },
        { label: 'Door Open',      val: asset.door_open ? 'YES' : 'NO', unit: '' },
        { label: 'Excursions',     val: asset.excursion_count,        unit: '' },
        { label: 'Battery Backup', val: asset.battery_backup_h,       unit: 'h' },
      ]} />
    </div>
  );
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
  const { isMobile, isTablet, isTV } = useWindowSize();

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

  // Driver Safety + MTBF fleet averages
  const safetyVals = assetList.filter(a => a.kpis?.driver_safety_score != null).map(a => a.kpis.driver_safety_score);
  const avgSafety  = safetyVals.length ? Math.round(safetyVals.reduce((s, v) => s + v, 0) / safetyVals.length) : null;
  const mttfVals   = assetList.filter(a => a.kpis?.mtbf_h != null).map(a => a.kpis.mtbf_h);
  const avgMTBF    = mttfVals.length ? (mttfVals.reduce((s, v) => s + v, 0) / mttfVals.length).toFixed(1) : null;
  const cccsVals   = assetList.filter(a => a.kpis?.cold_chain_compliance_pct != null).map(a => a.kpis.cold_chain_compliance_pct);
  const avgCCCS    = cccsVals.length ? Math.round(cccsVals.reduce((s, v) => s + v, 0) / cccsVals.length) : null;

  // Shipment status breakdown
  const statusCounts = ['in_transit','delivered','delayed','failed'].map(s => ({
    status: s,
    count:  assetList.filter(a => a.status === s).length,
  }));


  // ── Not configured guard ─────────────────────────────────────────────────────
  if (!industry.apiUrl) {
    return (
      <>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', minHeight:'70vh', gap:16, background:'#f8fafc',
        fontFamily:'system-ui,sans-serif', padding:40 }}>
        {/* Pulsing signal icon */}
        <div style={{ position:'relative', width:72, height:72 }}>
          <div style={{
            position:'absolute', inset:0, borderRadius:'50%',
            background:'rgba(37,125,240,0.08)',
            animation:'ping 2s cubic-bezier(0,0,0.2,1) infinite',
          }}/>
          <div style={{
            position:'relative', width:72, height:72, borderRadius:'50%',
            background:'rgba(37,125,240,0.12)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M3 12h2M19 12h2M12 3v2M12 19v2" stroke="#257df0" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="3" fill="#257df0" opacity="0.7"/>
              <path d="M5.6 5.6l1.4 1.4M16.9 16.9l1.4 1.4M5.6 18.4l1.4-1.4M16.9 7.1l1.4-1.4"
                stroke="#257df0" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
            </svg>
          </div>
        </div>

        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:17, fontWeight:700, color:'#1e293b', marginBottom:6 }}>
            No Live Data Available
          </div>
          <div style={{ fontSize:13, color:'#94a3b8', maxWidth:280, lineHeight:1.6 }}>
            This pipeline isn't connected yet. Deploy the simulator and processor on Condense to start seeing real-time data.
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#cbd5e1', display:'inline-block' }}/>
          <span style={{ fontSize:12, color:'#94a3b8' }}>Waiting for connection</span>
        </div>
      </div>
      <style>{`@keyframes ping { 75%,100% { transform:scale(2); opacity:0; } }`}</style>
      </>
    );
  }
  return (
    <div style={{ padding: isMobile ? '12px 14px' : isTV ? '32px 40px' : '24px 28px', minHeight:'100vh', background:'#f1f5f9', color:'#1e293b', fontFamily:'system-ui,sans-serif' }}>
      <DashboardHeader
        industryId="logistics"
        title="Logistics & Supply Chain"
        subtitle={`Live fleet tracking · ${assetList.length} assets · ${movingAssets.length} vehicles in motion`}
        status={status}
        onRefresh={refresh}
      />

      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <KPICard label="Active Vehicles"   value={movingAssets.length}                      color="#0284c7" sub={`of ${assetList.length} assets`} />
        <KPICard label="On-Time Rate"      value={onTimePct}     unit="%"                   color={onTimePct >= 90 ? '#16a34a' : '#d97706'} />
        <KPICard label="Driver Safety"     value={avgSafety ?? '—'} unit="/100"             color={avgSafety >= 80 ? '#16a34a' : avgSafety >= 60 ? '#d97706' : '#dc2626'} sub="Avg fleet safety score" />
        <KPICard label="Fleet MTBF"        value={avgMTBF ?? '—'}   unit="h"               color="#7c3aed" sub="Mean Time To Failure" />
        <KPICard label="Cold Chain CC"     value={avgCCCS != null ? `${avgCCCS}%` : '—'}   color={avgCCCS >= 90 ? '#16a34a' : avgCCCS >= 70 ? '#d97706' : '#dc2626'} sub="Compliance rate" />
        <KPICard label="SLA Breaches"      value={slaBreaches}                              color={slaBreaches > 0 ? '#dc2626' : '#16a34a'} />
        <KPICard label="Critical Alerts"   value={critAlerts}                               color={critAlerts > 0 ? '#dc2626' : '#64748b'} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '280px 1fr', gap:20, marginBottom:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:4 }}>Fleet ({assetList.length})</div>
          {assetList.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#334155', fontSize:13,
              border:'1px dashed #cbd5e1', borderRadius:10 }}>
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
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16 }}>
            {/* Cold chain temp trend */}
            <div style={{ background:'#ffffff', border:'1px solid #e2e8f0',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#475569', marginBottom:14 }}>
                ❄️ Cold Chain Temp & On-Time %
              </div>
              {history.length < 2 ? (
                <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#334155', fontSize:12 }}>Waiting…</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={history} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={35}/>
                    <Tooltip contentStyle={{ background:'#ffffff', border:'1px solid #e2e8f0',
                      borderRadius:8, fontSize:11, color:'#1e293b' }}/>
                    <Legend wrapperStyle={{ fontSize:10, color:'#64748b' }}/>
                    <Line type="monotone" dataKey="avgTemp"   name="Avg Temp °C"   stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false}/>
                    <Line type="monotone" dataKey="onTimePct" name="On-Time %"      stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false}/>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Shipment status bar */}
            <div style={{ background:'#ffffff', border:'1px solid #e2e8f0',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#475569', marginBottom:14 }}>
                Shipment Status Breakdown
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={statusCounts} margin={{ top:5, right:10, bottom:5, left:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="status" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={30}/>
                  <Tooltip contentStyle={{ background:'#ffffff', border:'1px solid #e2e8f0',
                    borderRadius:8, fontSize:11, color:'#1e293b' }}/>
                  <Bar dataKey="count" name="Count" fill="#f97316" radius={[4,4,0,0]} isAnimationActive={false}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {selectedObj && DetailComp && (
            <div style={{ background:'#ffffff', border:'1px solid #e2e8f0',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#475569' }}>
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
