// src/industries/retail/RetailDashboard.jsx
// Retail, E-commerce & Digital Platforms — footfall, checkout, inventory, conversion.

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useCondenseWS } from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }    from '../../config/industries.js';
import {
  ConnectionStatus, KPICard, AlertFeed, StatusBadge, HealthGauge
} from '../../components/shared.jsx';

const MAX_HISTORY = 40;

const ASSET_META = {
  store_zone:       { icon: '🏪', label: 'Store Zone' },
  checkout:         { icon: '🛒', label: 'Checkout Lane' },
  inventory_sensor: { icon: '📊', label: 'Inventory Sensor' },
  digital_platform: { icon: '💻', label: 'Digital Platform' },
};

// Conversion funnel bar (simple horizontal bar)
function ConversionBar({ rate = 0 }) {
  const color = rate >= 5 ? '#22c55e' : rate >= 2 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ marginTop:4 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#64748b', marginBottom:2 }}>
        <span>Conv. Rate</span>
        <span style={{ color, fontFamily:'monospace', fontWeight:700 }}>{rate?.toFixed(1)}%</span>
      </div>
      <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:2 }}>
        <div style={{ width:`${Math.min(100, rate * 10)}%`, height:'100%', background:color, borderRadius:2, transition:'width 0.3s' }}/>
      </div>
    </div>
  );
}

function AssetCard({ asset, selected, onClick }) {
  const meta   = ASSET_META[asset.asset_type] || { icon: '🛍️', label: asset.asset_type };
  const health = asset.kpis?.health_score ?? 100;
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(236,72,153,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${selected ? 'rgba(236,72,153,0.4)' : 'rgba(255,255,255,0.07)'}`,
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
        <div style={{ flex:1, marginRight:8 }}>
          {(asset.footfall_last_hour ?? asset.footfall) != null && (
            <div style={{ fontSize:18, fontWeight:700, color:'#ec4899', fontFamily:'monospace', lineHeight:1 }}>
              {Math.round(asset.footfall_last_hour ?? asset.footfall)}
              <span style={{ fontSize:10, color:'#64748b', marginLeft:3 }}>visitors/hr</span>
            </div>
          )}
          {(asset.avg_basket_value_inr ?? asset.basket_value_usd) != null && (
            <div style={{ fontSize:16, fontWeight:700, color:'#22c55e', fontFamily:'monospace' }}>
              {Number(asset.avg_basket_value_inr ?? asset.basket_value_usd).toFixed(0)}
              <span style={{ fontSize:10, color:'#64748b', marginLeft:3 }}>avg basket</span>
            </div>
          )}
          {(asset.conversion_rate_pct ?? asset.conversion_rate) != null && (
            <ConversionBar rate={asset.conversion_rate_pct ?? asset.conversion_rate} />
          )}
          <div style={{ fontSize:10, color:'#475569', marginTop:4 }}>{meta.label}</div>
        </div>
        <HealthGauge score={health} size={50} />
      </div>
      {asset.stock_pct != null && asset.stock_pct < 20 && (
        <div style={{ marginTop:6, fontSize:10, color:'#ef4444',
          background:'rgba(239,68,68,0.08)', padding:'3px 8px', borderRadius:4, display:'inline-block' }}>
          ⚠ Low stock {asset.stock_pct?.toFixed(0)}%
        </div>
      )}
    </div>
  );
}

function ZoneDetail({ asset }) {
  const fields = [
    { label: 'Footfall/hr',     val: asset.footfall_last_hour,      unit: '' },
    { label: 'Dwell Time',      val: asset.dwell_time_min,          unit: 'min' },
    { label: 'Conversion',      val: asset.conversion_rate_pct,     unit: '%' },
    { label: 'Occupancy',       val: asset.current_occupancy,       unit: '' },
    { label: 'Sales Today',     val: asset.sales_today_inr,         unit: 'INR' },
    { label: 'Bounce Rate',     val: asset.bounce_rate_pct,         unit: '%' },
    { label: 'Avg Basket',      val: asset.avg_basket_value_inr,    unit: 'INR' },
    { label: 'Zone',            val: asset.zone_name,               unit: '' },
  ];
  return <DetailGrid fields={fields} />;
}

function InventorySensorDetail({ asset }) {
  const fields = [
    { label: 'Zone',            val: asset.zone_name,               unit: '' },
    { label: 'Occupancy',       val: asset.current_occupancy,       unit: '' },
    { label: 'Footfall/hr',     val: asset.footfall_last_hour,      unit: '' },
    { label: 'Conversion',      val: asset.conversion_rate_pct,     unit: '%' },
    { label: 'Sales Today',     val: asset.sales_today_inr,         unit: 'INR' },
    { label: 'Avg Basket',      val: asset.avg_basket_value_inr,    unit: 'INR' },
    { label: 'Dwell Time',      val: asset.dwell_time_min,          unit: 'min' },
    { label: 'Stock Level',     val: asset.stock_pct,               unit: '%' },
  ];
  return <DetailGrid fields={fields} />;
}

function CheckoutDetail({ asset }) {
  const fields = [
    { label: 'Queue Length',    val: asset.queue_length,        unit: '' },
    { label: 'Avg Wait',        val: asset.avg_wait_sec,        unit: 's' },
    { label: 'Basket Value',    val: asset.basket_value_usd,    unit: 'USD' },
    { label: 'Txns / hr',       val: asset.transactions_hr,     unit: '' },
    { label: 'Throughput',      val: asset.throughput_ppm,      unit: 'ppm' },
    { label: 'Declined',        val: asset.declined_count,      unit: '' },
    { label: 'Coupon Used',     val: asset.coupon_pct,          unit: '%' },
    { label: 'Uptime',          val: asset.uptime_pct,          unit: '%' },
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
            {f.val != null ? (typeof f.val === 'number' ? Number(f.val).toFixed(1) : String(f.val)) : '—'}
            {f.unit && <span style={{ fontSize:11, color:'#475569', marginLeft:3 }}>{f.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

const DETAIL_COMPONENTS = { store_zone: ZoneDetail, checkout: CheckoutDetail, inventory_sensor: InventorySensorDetail, digital_platform: ZoneDetail };

export default function RetailDashboard() {
  const industry = INDUSTRIES.retail;
  const { status, assets, alerts, refresh } = useCondenseWS(industry.apiUrl);

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [history, setHistory]             = useState([]);
  const prevRef = useRef({});

  const assetList = Object.values(assets);
  const zones     = assetList.filter(a => ['store_zone', 'digital_platform', 'inventory_sensor'].includes(a.asset_type));
  const checkouts = assetList.filter(a => a.asset_type === 'checkout');
  const selectedObj = selectedAsset ? assets[selectedAsset] : null;
  const DetailComp  = selectedObj ? (DETAIL_COMPONENTS[selectedObj.asset_type] || null) : null;

  useEffect(() => {
    if (assetList.length === 0) return;
    const hasChanged = assetList.some(a => prevRef.current[a.asset_id]?.processed_at !== a.processed_at);
    if (!hasChanged) return;
    prevRef.current = assets;

    const totalFootfall = zones.reduce((s, a) => s + (a.footfall_last_hour ?? a.footfall ?? 0), 0);
    const avgConversion = zones.length ? (zones.reduce((s, a) => s + (a.conversion_rate_pct ?? a.conversion_rate ?? 0), 0) / zones.length).toFixed(2) : 0;
    const avgQueue      = checkouts.length ? (checkouts.reduce((s, a) => s + (a.queue_length ?? 0), 0) / checkouts.length).toFixed(1) : 0;
    const time          = new Date().toLocaleTimeString('en', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setHistory(prev => [...prev, {
      time,
      footfall:      Number(totalFootfall),
      conversion:    Number(avgConversion),
      queueLength:   Number(avgQueue),
    }].slice(-MAX_HISTORY));
  }, [assets]);

  const totalFootfall  = zones.reduce((s, a) => s + (a.footfall_last_hour ?? a.footfall ?? 0), 0);
  const avgConversion  = zones.length ? (zones.reduce((s, a) => s + (a.conversion_rate_pct ?? a.conversion_rate ?? 0), 0) / zones.length).toFixed(1) : 0;
  const lowStockAlerts = assetList.filter(a => a.stock_pct != null && a.stock_pct < 20).length;
  const critAlerts     = alerts.filter(a => a.severity === 'critical').length;

  // Zone footfall bar data
  const footfallBarData = zones.slice(0, 8).map(z => ({
    zone:     z.asset_id.replace(/zone_|zone-/i, 'Z'),
    footfall: Math.round(z.footfall_last_hour ?? z.footfall ?? 0),
  }));

  return (
    <div style={{ padding:'24px 28px', minHeight:'100vh', background:'#0a0f1a', color:'#e2e8f0', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:24 }}>🛒</span>
            <h1 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', margin:0 }}>
              Retail & E-commerce
            </h1>
          </div>
          <div style={{ fontSize:12, color:'#475569' }}>
            Live store analytics · {zones.length} zones · {checkouts.length} checkout lanes
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
        <KPICard label="Total Footfall"    value={totalFootfall}                     color="#ec4899" />
        <KPICard label="Avg Conversion"    value={avgConversion}   unit="%"          color={Number(avgConversion) >= 3 ? '#22c55e' : '#f59e0b'} />
        <KPICard label="Zones Monitored"   value={zones.length}                      color="#3b82f6" />
        <KPICard label="Checkout Lanes"    value={checkouts.length}                  color="#8b5cf6" />
        <KPICard label="Low Stock Alerts"  value={lowStockAlerts}                    color={lowStockAlerts > 0 ? '#ef4444' : '#22c55e'} />
        <KPICard label="Critical Alerts"   value={critAlerts}                        color="#ef4444" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, marginBottom:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:4 }}>Zones & Lanes ({assetList.length})</div>
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
            {/* Footfall + conversion trend */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
                Footfall & Conversion Trend
              </div>
              {history.length < 2 ? (
                <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#334155', fontSize:12 }}>Waiting…</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={history} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <defs>
                      <linearGradient id="gFoot" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ec4899" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={35}/>
                    <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:8, fontSize:11, color:'#e2e8f0' }}/>
                    <Legend wrapperStyle={{ fontSize:10, color:'#64748b' }}/>
                    <Area type="monotone" dataKey="footfall"   name="Footfall"    stroke="#ec4899" fill="url(#gFoot)" strokeWidth={2} dot={false} isAnimationActive={false}/>
                    <Area type="monotone" dataKey="conversion" name="Conv %"      stroke="#22c55e" fill="none"        strokeWidth={2} dot={false} isAnimationActive={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Zone footfall bar */}
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', marginBottom:14 }}>
                Zone Footfall Breakdown
              </div>
              {footfallBarData.length === 0 ? (
                <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#334155', fontSize:12 }}>No zones</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={footfallBarData} margin={{ top:5, right:10, bottom:5, left:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="zone" tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false}/>
                    <YAxis tick={{ fontSize:9, fill:'#475569' }} tickLine={false} axisLine={false} width={35}/>
                    <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)',
                      borderRadius:8, fontSize:11, color:'#e2e8f0' }}/>
                    <Bar dataKey="footfall" name="Footfall" fill="#ec4899" radius={[4,4,0,0]} isAnimationActive={false}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {selectedObj && DetailComp && (
            <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#cbd5e1' }}>
                  {ASSET_META[selectedObj.asset_type]?.icon ?? '🛒'} {selectedObj.asset_id}
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
