// src/industries/manufacturing/ManufacturingDashboard.jsx
// Smart Manufacturing / IIoT — machines, OEE, vibration, predictive maintenance.

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useCondenseWS } from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }    from '../../config/industries.js';
import {
  ConnectionStatus, KPICard, AlertFeed, StatusBadge, HealthGauge
} from '../../components/shared.jsx';

const MAX_HISTORY = 40;

const ASSET_META = {
  machine:   { icon: '⚙️',  label: 'CNC Machine' },
  conveyor:  { icon: '🏗️', label: 'Conveyor' },
  robot:     { icon: '🤖', label: 'Robot Arm' },
  sensor:    { icon: '📡', label: 'IIoT Sensor' },
};

// OEE gauge — colored arc for the three components
function OEEDisplay({ oee = 0, availability = 0, performance = 0, quality = 0 }) {
  const color = oee >= 85 ? '#22c55e' : oee >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:24, fontWeight:700, color, fontFamily:'monospace', lineHeight:1 }}>
        {oee.toFixed(1)}<span style={{ fontSize:13, color:'#64748b' }}>%</span>
      </div>
      <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>OEE</div>
      <div style={{ display:'flex', gap:6, marginTop:6, justifyContent:'center' }}>
        {[['A', availability, '#22c55e'], ['P', performance, '#3b82f6'], ['Q', quality, '#8b5cf6']].map(([k, v, c]) => (
          <div key={k} style={{ fontSize:9, color:c, textAlign:'center' }}>
            <div style={{ fontWeight:700, fontFamily:'monospace' }}>{v.toFixed(0)}%</div>
            <div style={{ color:'#475569' }}>{k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetCard({ asset, selected, onClick }) {
  const meta   = ASSET_META[asset.asset_type] || { icon: '🔩', label: asset.asset_type };
  const health = asset.kpis?.health_score ?? 100;
  const oee    = asset.oee_pct ?? null;
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${selected ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
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
        <div>
          {oee != null ? (
            <OEEDisplay oee={oee}
              availability={asset.availability_pct ?? 0}
              performance={asset.performance_pct ?? 0}
              quality={asset.quality_pct ?? 0} />
          ) : (
            <div style={{ fontSize:12, color:'#64748b' }}>{meta.label}</div>
          )}
        </div>
        <HealthGauge score={health} size={54} />
      </div>
      {asset.vibration_ms2 > 4 && (
        <div style={{ marginTop:8, fontSize:10, color:'#ef4444',
          background:'rgba(239,68,68,0.08)', padding:'3px 8px', borderRadius:4, display:'inline-block' }}>
          ⚡ High vibration {asset.vibration_ms2?.toFixed(2)} m/s²
        </div>
      )}
    </div>
  );
}

function MachineDetail({ asset }) {
  const fields = [
    { label: 'OEE',           val: asset.oee_pct,            unit: '%' },
    { label: 'Availability',  val: asset.availability_pct,   unit: '%' },
    { label: 'Performance',   val: asset.performance_pct,    unit: '%' },
    { label: 'Quality',       val: asset.quality_pct,        unit: '%' },
    { label: 'Vibration',     val: asset.vibration_ms2,      unit: 'm/s²' },
    { label: 'Temperature',   val: asset.temp_c,             unit: '°C' },
    { label: 'Cycles',        val: asset.cycles_count,       unit: '' },
    { label: 'Throughput',    val: asset.throughput_pph,     unit: 'pph' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
      {fields.map(f => (
        <div key={f.label} style={{ background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'10px 12px' }}>
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

export default function ManufacturingDashboard() {
  const industry = INDUSTRIES.manufacturing;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory]             = useState([]);
  const prevRef = useRef({});

  const assetList   = Object.values(assets);
  const machines    = assetList.filter(a => a.oee_pct != null);
  const selectedObj = selectedAsset ? assets[selectedAsset] : null;

  useEffect(() => {
    if (assetList.length === 0) return;
    const hasChanged = assetList.some(a => prevRef.current[a.asset_id]?.processed_at !== a.processed_at);
    if (!hasChanged) return;
    prevRef.current = assets;

    const avgOEE  = machines.length ? (machines.reduce((s, a) => s + (a.oee_pct ?? 0), 0) / machines.length).toFixed(1) : 0;
    const avgVib  = assetList.length ? (assetList.reduce((s, a) => s + (a.vibration_ms2 ?? 0), 0) / assetList.length).toFixed(2) : 0;
    const time    = new Date().toLocaleTimeString('en', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setHistory(prev => [...prev, { time, avgOEE: Number(avgOEE), avgVibration: Number(avgVib) }].slice(-MAX_HISTORY));
  }, [assets]);

  const avgOEE      = machines.length ? (machines.reduce((s, a) => s + (a.oee_pct ?? 0), 0) / machines.length).toFixed(1) : 0;
  const running     = assetList.filter(a => a.status === 'running').length;
  const faulted     = assetList.filter(a => a.status === 'fault').length;
  const critAlerts  = alerts.filter(a => a.severity === 'critical').length;

  // Per-machine OEE bar chart data
  const oeeBarData = machines.slice(0, 8).map(m => ({
    id:  m.asset_id.replace(/machine_|mach_/i, 'M'),
    oee: Number((m.oee_pct ?? 0).toFixed(1)),
  }));

  return (
    <div style={{ padding:'24px 28px', minHeight:'100vh', background:'#0a0f1a', color:'#e2e8f0', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:24 }}>🏭</span>
            <h1 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', margin:0 }}>
              Smart Manufacturing / IIoT
            </h1>
          </div>
          <div style={{ fontSize:12, color:'#475569' }}>
            Live shop-floor telemetry · {assetList.length} assets · {machines.length} machines tracked
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
        <KPICard label="Fleet Avg OEE"    value={avgOEE}      unit="%"   color={Number(avgOEE) >= 85 ? '#22c55e' : '#f59e0b'} />
        <KPICard label="Assets Online"    value={assetList.length}       color="#22c55e" />
        <KPICard label="Running"          value={running}                color="#3b82f6" />
        <KPICard label="Faulted"          value={faulted}                color={faulted > 0 ? '#ef4444' : '#22c55e'} />
        <KPICard label="Critical Alerts"  value={critAlerts}             color="#ef4444" />
        <KPICard label="OEE Target"       value={85}          unit="%"   color="#8b5cf6" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, marginBottom:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:4 }}>Shop Floor ({assetList.length})</div>
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
            {/* OEE trend */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
                OEE & Vibration Trend
              </div>
              {history.length < 2 ? (
                <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#334155', fontSize:12 }}>Waiting…</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={history} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <defs>
                      <linearGradient id="gOEE" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={35}/>
                    <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:8, fontSize:11, color:'#e2e8f0' }}/>
                    <Legend wrapperStyle={{ fontSize:10, color:'#64748b' }}/>
                    <Area type="monotone" dataKey="avgOEE" name="OEE %" stroke="#8b5cf6" fill="url(#gOEE)" strokeWidth={2} dot={false} isAnimationActive={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Per-machine OEE bar */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
                Machine OEE Comparison
              </div>
              {oeeBarData.length === 0 ? (
                <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#334155', fontSize:12 }}>No machines</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={oeeBarData} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="id" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false}/>
                    <YAxis domain={[0,100]} tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={30}/>
                    <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:8, fontSize:11, color:'#e2e8f0' }}/>
                    <Bar dataKey="oee" name="OEE %" fill="#8b5cf6" radius={[4,4,0,0]} isAnimationActive={false}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {selectedObj && (
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1' }}>
                  {ASSET_META[selectedObj.asset_type]?.icon ?? '⚙️'} {selectedObj.asset_id}
                  <span style={{ marginLeft:8 }}><StatusBadge status={selectedObj.status} /></span>
                </div>
                <span style={{ fontSize:10, color:'#475569' }}>
                  {selectedObj.processed_at && new Date(selectedObj.processed_at).toLocaleTimeString()}
                </span>
              </div>
              <MachineDetail asset={selectedObj} />
            </div>
          )}
        </div>
      </div>

      <AlertFeed alerts={alerts} maxHeight={240} />
    </div>
  );
}
