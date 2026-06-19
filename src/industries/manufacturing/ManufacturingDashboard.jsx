// src/industries/manufacturing/ManufacturingDashboard.jsx
// Smart Manufacturing / IIoT — machines, OEE, vibration, predictive maintenance.

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
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
  const oee    = asset.kpis?.oee_pct ?? null;
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(139,92,246,0.08)' : '#ffffff',
      border: `1px solid ${selected ? 'rgba(139,92,246,0.4)' : '#e2e8f0'}`,
      borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all 0.15s'
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
      {asset.vibration_g > 4 && (
        <div style={{ marginTop:8, fontSize:10, color:'#ef4444',
          background:'rgba(239,68,68,0.08)', padding:'3px 8px', borderRadius:4, display:'inline-block' }}>
          ⚡ High vibration {asset.vibration_g?.toFixed(2)} g
        </div>
      )}
    </div>
  );
}

function FieldCell({ label, val, unit, highlight }) {
  const displayVal = val != null
    ? (typeof val === 'number' ? Number(val).toFixed(1) : String(val))
    : '—';
  const textColor = highlight === 'danger' && val != null ? '#dc2626'
    : highlight === 'good' && val != null ? '#16a34a'
    : '#1e293b';
  return (
    <div style={{ background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:8, padding:'10px 12px' }}>
      <div style={{ fontSize:10, color:'#64748b', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
      <div style={{ fontSize:17, fontWeight:700, color:textColor, fontFamily:'monospace' }}>
        {displayVal}
        {unit && <span style={{ fontSize:10, color:'#94a3b8', marginLeft:3 }}>{unit}</span>}
      </div>
    </div>
  );
}

function MachineDetail({ asset }) {
  const k = asset.kpis || {};
  const riskColor = k.failure_risk === 'critical' ? '#dc2626'
    : k.failure_risk === 'high' ? '#d97706'
    : k.failure_risk === 'medium' ? '#f59e0b' : '#16a34a';

  return (
    <div>
      {/* PdM & Reliability row */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        {[
          { label:'PdM Score', val:k.pdm_score, unit:'/ 100', color: k.pdm_score >= 70 ? '#dc2626' : k.pdm_score >= 40 ? '#d97706' : '#16a34a' },
          { label:'MTBF', val:k.mtbf_h, unit:'h', color:'#7c3aed' },
          { label:'MTTR', val:k.mttr_h, unit:'h', color:'#0284c7' },
        ].map(item => (
          <div key={item.label} style={{ flex:1, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
            <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>{item.label}</div>
            <div style={{ fontSize:20, fontWeight:800, color:item.color, fontFamily:'monospace', marginTop:2 }}>
              {item.val != null ? Number(item.val).toFixed(1) : '—'}
              {item.unit && <span style={{ fontSize:10, color:'#94a3b8', marginLeft:2 }}>{item.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Failure risk + predicted failure + RUL */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:80, background: k.failure_risk === 'critical' ? '#fee2e2' : '#f8fafc',
          border:`1px solid ${riskColor}30`, borderRadius:8, padding:'8px 12px' }}>
          <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>Failure Risk</div>
          <div style={{ fontSize:15, fontWeight:700, color:riskColor, marginTop:2 }}>
            {k.failure_risk ? k.failure_risk.toUpperCase() : '—'}
          </div>
        </div>
        <div style={{ flex:1, minWidth:80, background: k.predicted_failure_in_h != null && k.predicted_failure_in_h < 4 ? '#fff7ed' : '#f8fafc',
          border:`1px solid ${k.predicted_failure_in_h != null && k.predicted_failure_in_h < 4 ? '#f97316' : '#e2e8f0'}`, borderRadius:8, padding:'8px 12px' }}>
          <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>Potential failure by</div>
          <div style={{ fontSize:15, fontWeight:700, color: k.predicted_failure_in_h < 4 ? '#ea580c' : '#1e293b', fontFamily:'monospace', marginTop:2 }}>
            {k.predicted_failure_in_h != null ? `${k.predicted_failure_in_h.toFixed(1)} h` : '—'}
          </div>
        </div>
        <div style={{ flex:1, minWidth:80, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 12px' }}>
          <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em' }}>RUL (Tool)</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#0891b2', fontFamily:'monospace', marginTop:2 }}>
            {k.rul_h != null ? `${Number(k.rul_h).toFixed(1)} h` : '—'}
          </div>
        </div>
      </div>

      {/* Standard grid fields */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px,1fr))', gap:8 }}>
        <FieldCell label="OEE"              val={k.oee_pct}               unit="%" />
        <FieldCell label="Availability"     val={asset.availability_pct}  unit="%" />
        <FieldCell label="Performance"      val={asset.performance_pct}   unit="%" />
        <FieldCell label="Quality"          val={asset.quality_pct}       unit="%" />
        <FieldCell label="Tool Wear"        val={asset.tool_wear_pct}     unit="%" highlight={asset.tool_wear_pct > 80 ? 'danger' : null} />
        <FieldCell label="Vibration"        val={k.avg_vibration_g ?? asset.vibration_g}    unit="g" />
        <FieldCell label="Temperature"      val={asset.spindle_temp_c}    unit="°C" />
        <FieldCell label="Spindle RPM"      val={k.avg_spindle_rpm ?? asset.spindle_rpm}    unit="rpm" />
        <FieldCell label="Parts Today"      val={asset.parts_produced_today}  unit="" />
        <FieldCell label="Scrap Rate"       val={k.scrap_rate_pct}        unit="%" highlight={k.scrap_rate_pct > 5 ? 'danger' : 'good'} />
        <FieldCell label="First Pass Yield" val={k.first_pass_yield_pct}  unit="%" />
        <FieldCell label="Energy/Part"      val={k.energy_per_part_kwh}   unit="kWh" />
        <FieldCell label="Fault Count"      val={k.fault_count}           unit="" />
        <FieldCell label="Repair Count"     val={k.repair_count}          unit="" />
      </div>
    </div>
  );
}

export default function ManufacturingDashboard() {
  const industry = INDUSTRIES.manufacturing;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);
  const { isMobile, isTablet, isTV } = useWindowSize();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory]             = useState([]);
  const prevRef = useRef({});

  const assetList   = Object.values(assets);
  const machines    = assetList.filter(a => a.kpis?.oee_pct != null);
  const selectedObj = selectedAsset ? assets[selectedAsset] : null;

  useEffect(() => {
    if (assetList.length === 0) return;
    const hasChanged = assetList.some(a => prevRef.current[a.asset_id]?.processed_at !== a.processed_at);
    if (!hasChanged) return;
    prevRef.current = assets;

    const avgOEE  = machines.length ? (machines.reduce((s, a) => s + (a.kpis?.oee_pct ?? 0), 0) / machines.length).toFixed(1) : 0;
    const avgVib  = assetList.length ? (assetList.reduce((s, a) => s + (a.vibration_g ?? 0), 0) / assetList.length).toFixed(2) : 0;
    const time    = new Date().toLocaleTimeString('en', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setHistory(prev => [...prev, { time, avgOEE: Number(avgOEE), avgVibration: Number(avgVib) }].slice(-MAX_HISTORY));
  }, [assets]);

  const avgOEE      = machines.length ? (machines.reduce((s, a) => s + (a.kpis?.oee_pct ?? 0), 0) / machines.length).toFixed(1) : 0;
  const running     = assetList.filter(a => a.status === 'running').length;
  const faulted     = assetList.filter(a => a.status === 'fault').length;
  const critAlerts  = alerts.filter(a => a.severity === 'critical').length;

  // MTBF/MTTR fleet averages
  const mttfVals = machines.filter(m => m.kpis?.mtbf_h != null).map(m => m.kpis.mtbf_h);
  const mttrVals = machines.filter(m => m.kpis?.mttr_h != null).map(m => m.kpis.mttr_h);
  const avgMTBF  = mttfVals.length ? (mttfVals.reduce((s, v) => s + v, 0) / mttfVals.length).toFixed(1) : null;
  const avgMTTR  = mttrVals.length ? (mttrVals.reduce((s, v) => s + v, 0) / mttrVals.length).toFixed(1) : null;

  // PdM high-risk machines
  const highRisk = machines.filter(m => m.kpis?.failure_risk === 'high' || m.kpis?.failure_risk === 'critical').length;

  // Per-machine OEE bar chart data
  const oeeBarData = machines.slice(0, 8).map(m => ({
    id:  m.asset_id.replace(/machine_|mach_/i, 'M'),
    oee: Number((m.kpis?.oee_pct ?? 0).toFixed(1)),
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
        industryId="manufacturing"
        title="Smart Manufacturing / IIoT"
        subtitle={`Live shop-floor telemetry · ${assetList.length} assets · ${machines.length} machines tracked`}
        status={status}
        onRefresh={refresh}
      />

      <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
        <KPICard label="Fleet Avg OEE"    value={avgOEE}      unit="%"   color={Number(avgOEE) >= 85 ? '#16a34a' : '#d97706'} sub="Target: 85%" />
        <KPICard label="Running"          value={running}                color="#0284c7" sub={`of ${assetList.length} assets`} />
        <KPICard label="Faulted"          value={faulted}                color={faulted > 0 ? '#dc2626' : '#16a34a'} sub="Machines in fault" />
        <KPICard label="Avg MTBF"         value={avgMTBF ?? '—'}  unit="h"  color="#7c3aed" sub="Mean Time To Failure" />
        <KPICard label="Avg MTTR"         value={avgMTTR ?? '—'}  unit="h"  color="#0891b2" sub="Mean Time To Repair" />
        <KPICard label="PdM High Risk"    value={highRisk}               color={highRisk > 0 ? '#dc2626' : '#16a34a'} sub="Machines at risk" />
        <KPICard label="Critical Alerts"  value={critAlerts}             color={critAlerts > 0 ? '#dc2626' : '#64748b'} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile || isTablet ? '1fr' : '280px 1fr', gap:20, marginBottom:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:4 }}>Shop Floor ({assetList.length})</div>
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
            {/* OEE trend */}
            <div style={{ background:'#ffffff', border:'1px solid #e2e8f0',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#475569', marginBottom:14 }}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={35}/>
                    <Tooltip contentStyle={{ background:'#ffffff', border:'1px solid #e2e8f0',
                      borderRadius:8, fontSize:11, color:'#1e293b' }}/>
                    <Legend wrapperStyle={{ fontSize:10, color:'#64748b' }}/>
                    <Area type="monotone" dataKey="avgOEE" name="OEE %" stroke="#8b5cf6" fill="url(#gOEE)" strokeWidth={2} dot={false} isAnimationActive={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Per-machine OEE bar */}
            <div style={{ background:'#ffffff', border:'1px solid #e2e8f0',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#475569', marginBottom:14 }}>
                Machine OEE Comparison
              </div>
              {oeeBarData.length === 0 ? (
                <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#334155', fontSize:12 }}>No machines</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={oeeBarData} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="id" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false}/>
                    <YAxis domain={[0,100]} tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={30}/>
                    <Tooltip contentStyle={{ background:'#ffffff', border:'1px solid #e2e8f0',
                      borderRadius:8, fontSize:11, color:'#1e293b' }}/>
                    <Bar dataKey="oee" name="OEE %" fill="#8b5cf6" radius={[4,4,0,0]} isAnimationActive={false}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {selectedObj && (
            <div style={{ background:'#ffffff', border:'1px solid #e2e8f0',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#475569' }}>
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
