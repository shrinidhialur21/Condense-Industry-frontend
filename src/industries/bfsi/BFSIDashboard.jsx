// src/industries/bfsi/BFSIDashboard.jsx
// BFSI / Fintech — transaction streams, fraud detection, ATM monitoring, latency analytics.

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useCondenseWS } from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }    from '../../config/industries.js';
import {
  ConnectionStatus, KPICard, AlertFeed, StatusBadge, HealthGauge
} from '../../components/shared.jsx';

const MAX_HISTORY = 40;

const ASSET_META = {
  transaction_stream: { icon: '💳', label: 'Transaction Stream' },
  atm:                { icon: '🏧', label: 'ATM' },
  branch:             { icon: '🏦', label: 'Branch' },
};

// Risk score badge
function RiskBadge({ score = 0 }) {
  const color = score >= 0.7 ? '#ef4444' : score >= 0.4 ? '#f59e0b' : '#22c55e';
  const label = score >= 0.7 ? 'HIGH RISK' : score >= 0.4 ? 'MEDIUM' : 'LOW';
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
      background:`${color}20`, color, letterSpacing:'0.05em' }}>
      {label}
    </span>
  );
}

function AssetCard({ asset, selected, onClick }) {
  const meta   = ASSET_META[asset.asset_type] || { icon: '💰', label: asset.asset_type };
  const health = asset.kpis?.health_score ?? 100;
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${selected ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all 0.15s'
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <div>
          <span style={{ fontSize:16, marginRight:6 }}>{meta.icon}</span>
          <span style={{ fontSize:12, fontWeight:600, color:'#cbd5e1' }}>{asset.asset_id}</span>
        </div>
        {asset.fraud_score != null
          ? <RiskBadge score={asset.fraud_score} />
          : <StatusBadge status={asset.status} />
        }
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          {asset.transactions_per_second != null && (
            <div style={{ fontSize:20, fontWeight:700, color:'#10b981', fontFamily:'monospace', lineHeight:1 }}>
              {Number(asset.transactions_per_second).toFixed(0)}
              <span style={{ fontSize:10, color:'#64748b', marginLeft:3 }}>TPS</span>
            </div>
          )}
          {asset.cash_level_pct != null && (
            <div style={{ fontSize:16, fontWeight:700, color:'#10b981', fontFamily:'monospace' }}>
              {Number(asset.cash_level_pct).toFixed(0)}%
              <span style={{ fontSize:10, color:'#64748b', marginLeft:3 }}>cash</span>
            </div>
          )}
          <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>{meta.label}</div>
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

function StreamDetail({ asset }) {
  const fields = [
    { label: 'TPS',             val: asset.transactions_per_second,     unit: '' },
    { label: 'Avg Latency',     val: asset.avg_latency_ms,              unit: 'ms' },
    { label: 'P99 Latency',     val: asset.p99_latency_ms,              unit: 'ms' },
    { label: 'Fraud Score',     val: asset.fraud_score,                 unit: '' },
    { label: 'Decline Rate',    val: asset.declined_transactions_pct,   unit: '%' },
    { label: 'Fraud Alerts',    val: asset.fraud_alerts_last_min,       unit: '' },
    { label: 'Total Value',     val: asset.total_value_last_min_inr,    unit: 'INR' },
    { label: 'Error Rate',      val: asset.error_rate_pct,              unit: '%' },
  ];
  return <DetailGrid fields={fields} />;
}

function ATMDetail({ asset }) {
  const fields = [
    { label: 'Cash Level',      val: asset.cash_level_pct,      unit: '%' },
    { label: 'Txns Today',      val: asset.transactions_today,  unit: '' },
    { label: 'Uptime',          val: asset.uptime_pct,          unit: '%' },
    { label: 'Avg Wait',        val: asset.avg_wait_sec,        unit: 's' },
    { label: 'Network Latency', val: asset.network_latency_ms,  unit: 'ms' },
    { label: 'Errors',          val: asset.error_count,         unit: '' },
    { label: 'Last Refill',     val: asset.last_refill_hr,      unit: 'h ago' },
    { label: 'Dispense Fails',  val: asset.dispense_failures,   unit: '' },
  ];
  return <DetailGrid fields={fields} />;
}

function DetailGrid({ fields }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:10 }}>
      {fields.map(f => (
        <div key={f.label} style={{ background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'10px 12px' }}>
          <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{f.label}</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#e2e8f0', fontFamily:'monospace' }}>
            {f.val != null ? (typeof f.val === 'number' ? Number(f.val).toFixed(f.label.includes('Fraud') ? 3 : 1) : String(f.val)) : '—'}
            {f.unit && <span style={{ fontSize:11, color:'#475569', marginLeft:3 }}>{f.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

const DETAIL_COMPONENTS = {
  transaction_stream: StreamDetail,
  atm:                ATMDetail,
};

export default function BFSIDashboard() {
  const industry = INDUSTRIES.bfsi;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory]             = useState([]);
  const prevRef = useRef({});

  const assetList = Object.values(assets);
  const streams   = assetList.filter(a => a.asset_type === 'transaction_stream');
  const atms      = assetList.filter(a => a.asset_type === 'atm');
  const selectedObj = selectedAsset ? assets[selectedAsset] : null;
  const DetailComp  = selectedObj ? (DETAIL_COMPONENTS[selectedObj.asset_type] || null) : null;

  useEffect(() => {
    if (assetList.length === 0) return;
    const hasChanged = assetList.some(a => prevRef.current[a.asset_id]?.processed_at !== a.processed_at);
    if (!hasChanged) return;
    prevRef.current = assets;

    const totalTPS    = streams.reduce((s, a) => s + (a.transactions_per_second ?? 0), 0);
    const avgFraud    = streams.length ? (streams.reduce((s, a) => s + (a.fraud_score ?? 0), 0) / streams.length) : 0;
    const avgLatency  = streams.length ? (streams.reduce((s, a) => s + (a.avg_latency_ms ?? 0), 0) / streams.length).toFixed(1) : 0;
    const time        = new Date().toLocaleTimeString('en', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setHistory(prev => [...prev, {
      time,
      totalTPS: Number(totalTPS.toFixed(0)),
      avgFraud: Number((avgFraud * 100).toFixed(1)),
      avgLatency: Number(avgLatency),
    }].slice(-MAX_HISTORY));
  }, [assets]);

  const totalTPS     = streams.reduce((s, a) => s + (a.transactions_per_second ?? 0), 0);
  const totalBlocked = streams.reduce((s, a) => s + (a.fraud_alerts_last_min ?? 0), 0);
  const avgLatency   = streams.length ? Math.round(streams.reduce((s, a) => s + (a.avg_latency_ms ?? 0), 0) / streams.length) : 0;
  const critAlerts   = alerts.filter(a => a.severity === 'critical').length;
  const highRisk     = streams.filter(a => (a.fraud_score ?? 0) >= 0.7).length;

  return (
    <div style={{ padding:'24px 28px', minHeight:'100vh', background:'#0a0f1a', color:'#e2e8f0', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:24 }}>🏦</span>
            <h1 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', margin:0 }}>BFSI / Fintech</h1>
          </div>
          <div style={{ fontSize:12, color:'#475569' }}>
            Live transaction streams · {streams.length} streams · {atms.length} ATMs monitored
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
        <KPICard label="Total TPS"          value={totalTPS.toFixed(0)}              color="#10b981" />
        <KPICard label="Fraud Alerts"        value={totalBlocked}                      color={totalBlocked > 0 ? '#ef4444' : '#22c55e'} />
        <KPICard label="High-Risk Streams"  value={highRisk}                          color={highRisk > 0 ? '#ef4444' : '#22c55e'} />
        <KPICard label="Avg Latency"        value={avgLatency}       unit=" ms"       color={avgLatency > 200 ? '#ef4444' : '#22c55e'} />
        <KPICard label="ATMs Online"        value={atms.length}                       color="#3b82f6" />
        <KPICard label="Critical Alerts"    value={critAlerts}                        color="#ef4444" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, marginBottom:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:4 }}>Assets ({assetList.length})</div>
          {assetList.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#334155', fontSize:13,
              border:'1px dashed rgba(255,255,255,0.06)', borderRadius:10 }}>
              {status === 'connecting' ? 'Connecting…' : 'No data. Start the simulator.'}
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
            {/* TPS trend */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
                TPS & Fraud Score Trend
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
                    <Line type="monotone" dataKey="totalTPS"   name="Total TPS"      stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false}/>
                    <Line type="monotone" dataKey="avgFraud"   name="Fraud Score %"  stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} strokeDasharray="4 2"/>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Latency trend */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
                Avg Latency (ms)
              </div>
              {history.length < 2 ? (
                <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#334155', fontSize:12 }}>Waiting…</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={history} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <defs>
                      <linearGradient id="gLat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={35}/>
                    <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:8, fontSize:11, color:'#e2e8f0' }}/>
                    <Area type="monotone" dataKey="avgLatency" name="Latency ms" stroke="#3b82f6" fill="url(#gLat)" strokeWidth={2} dot={false} isAnimationActive={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {selectedObj && DetailComp && (
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1' }}>
                  {ASSET_META[selectedObj.asset_type]?.icon} {selectedObj.asset_id}
                  {selectedObj.fraud_score != null
                    ? <span style={{ marginLeft:8 }}><RiskBadge score={selectedObj.fraud_score} /></span>
                    : <span style={{ marginLeft:8 }}><StatusBadge status={selectedObj.status} /></span>
                  }
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
