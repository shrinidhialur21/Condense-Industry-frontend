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
  ConnectionStatus, KPICard, AlertFeed, StatusBadge, HealthGauge,
  DashboardHeader, RefreshButton,
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
      background: selected ? 'rgba(59,130,246,0.08)' : '#ffffff',
      border: `1px solid ${selected ? 'rgba(59,130,246,0.4)' : '#e2e8f0'}`,
      borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div>
          <span style={{ fontSize:16, marginRight:6 }}>{meta.icon}</span>
          <span style={{ fontSize:12, fontWeight:600, color:'#475569' }}>{asset.asset_id}</span>
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
          background:'#ffffff', border:'1px solid #e2e8f0',
          borderRadius:8, padding:'10px 12px'
        }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#1e293b', fontFamily:'monospace' }}>
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
    <div style={{ padding:'24px 28px', minHeight:'100vh', background:'#f1f5f9', color:'#1e293b', fontFamily:'system-ui,sans-serif' }}>
      {/* Header */}
      <DashboardHeader
        industryId="ev"
        title="EV & Connected Mobility"
        subtitle={`EVs: ${evs.length} · Stations: ${stations.length}`}
        status={status}
        onRefresh={refresh}
      />

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
              border:'1px dashed #cbd5e1', borderRadius:10 }}>
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
          <div style={{ background:'#ffffff', border:'1px solid #e2e8f0',
            borderRadius:12, padding:'16px 20px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#475569', marginBottom:14 }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize:10, fill:'#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{ fontSize:10, fill:'#475569' }} tickLine={false} axisLine={false} width={40}/>
                  <Tooltip contentStyle={{ background:'#ffffff', border:'1px solid #e2e8f0',
                    borderRadius:8, fontSize:11, color:'#1e293b' }} labelStyle={{ color:'#64748b' }}/>
                  <Legend wrapperStyle={{ fontSize:11, color:'#64748b' }}/>
                  <Area type="monotone" dataKey="avgSoc"     name="Avg SOC %"       stroke="#3b82f6" fill="url(#gSoc)" strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                  <Area type="monotone" dataKey="totalPower" name="Charge Power kW"  stroke="#f59e0b" fill="url(#gPow)" strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Asset detail */}
          {selectedObj && DetailComp && (
            <div style={{ background:'#ffffff', border:'1px solid #e2e8f0',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#475569' }}>
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
