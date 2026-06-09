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



// ── Algo tag + chip helpers ────────────────────────────────────
function AlgoTag({ formula }) {
  return (
    <div style={{ fontSize: 9, color: '#7c3aed', background: 'rgba(124,58,237,0.07)',
      border: '1px solid rgba(124,58,237,0.2)', borderRadius: 4,
      padding: '2px 6px', marginTop: 3, fontFamily: 'monospace', lineHeight: 1.4, wordBreak: 'break-word' }}>
      {formula}
    </div>
  );
}
function StatusChip({ label, level }) {
  const colors = {
    excellent: { bg:'#dcfce7', color:'#16a34a' }, good: { bg:'#d1fae5', color:'#059669' },
    average:   { bg:'#fef3c7', color:'#d97706' }, poor: { bg:'#fee2e2', color:'#dc2626' },
    critical:  { bg:'#fee2e2', color:'#dc2626' }, high: { bg:'#fef3c7', color:'#d97706' },
    elevated:  { bg:'#fef9c3', color:'#ca8a04' }, normal: { bg:'#dcfce7', color:'#16a34a' },
    green: { bg:'#dcfce7', color:'#16a34a' }, moderate: { bg:'#fef3c7', color:'#d97706' },
    sla_breach: { bg:'#fee2e2', color:'#dc2626' }, at_risk: { bg:'#fef3c7', color:'#d97706' },
    world_class: { bg:'#dcfce7', color:'#16a34a' }, compliant: { bg:'#dcfce7', color:'#16a34a' },
    non_compliant: { bg:'#fee2e2', color:'#dc2626' }, marginal: { bg:'#fef3c7', color:'#d97706' },
    high_performing: { bg:'#dcfce7', color:'#16a34a' }, fast_mover: { bg:'#dcfce7', color:'#16a34a' },
    pull_from_route: { bg:'#fee2e2', color:'#dc2626' }, inspect_48h: { bg:'#fef3c7', color:'#d97706' },
    schedule_inspection: { bg:'#fef9c3', color:'#ca8a04' }, none: { bg:'#f1f5f9', color:'#64748b' },
  };
  const s = colors[level] || { bg:'#f1f5f9', color:'#64748b' };
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
    background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
    {label || level}
  </span>;
}
function KpiTile({ label, value, unit, color = '#1e293b', algoFormula, status, statusLevel }) {
  const display = value != null
    ? (typeof value === 'number' ? Number(value).toFixed(typeof value === 'number' && !Number.isInteger(value) ? 1 : 0) : String(value))
    : '—';
  return (
    <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 12px' }}>
      <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:700, color, fontFamily:'monospace', lineHeight:1 }}>
        {display}
        {unit && <span style={{ fontSize:10, color:'#94a3b8', marginLeft:3 }}>{unit}</span>}
      </div>
      {status && <div style={{ marginTop:4 }}><StatusChip label={status} level={statusLevel || status} /></div>}
      {algoFormula && <AlgoTag formula={algoFormula} />}
    </div>
  );
}

// delivery_vehicle detail — expanded with new KPIs
function TruckDetail({ asset }) {
  const k = asset.kpis || {};
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Performance Algorithms ── */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
          letterSpacing:'0.08em', marginBottom:8 }}>🚛 Fleet Performance Algorithms</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="On-Time Delivery (OTDPI)"
            value={k.otdpi_pct} unit="%"
            color={k.otdpi_status === 'excellent' ? '#16a34a' : k.otdpi_status === 'good' ? '#059669' : k.otdpi_status === 'at_risk' ? '#d97706' : '#dc2626'}
            status={k.otdpi_status} statusLevel={k.otdpi_status === 'excellent' ? 'excellent' : k.otdpi_status === 'good' ? 'good' : k.otdpi_status === 'at_risk' ? 'average' : 'sla_breach'}
            algoFormula="OTDPI = on_time_count / total_readings × 100 (rolling 20)" />
          <KpiTile label="OTDPI Trend"            value={k.otdpi_trend}       color="#475569" />
          <KpiTile label="Avg Delay"              value={k.avg_delay_min}     unit="min"
            color={k.avg_delay_min > 30 ? '#dc2626' : '#475569'} />
          <KpiTile label="Driver Safety (DSS)"
            value={k.driver_safety_score} unit="/100"
            color={k.driver_safety_score >= 80 ? '#16a34a' : k.driver_safety_score >= 60 ? '#d97706' : '#dc2626'}
            status={k.safety_rating} statusLevel={k.safety_rating === 'excellent' ? 'excellent' : k.safety_rating === 'good' ? 'good' : k.safety_rating === 'fair' ? 'average' : 'poor'}
            algoFormula="DSS = 100 − braking×6 − overspeeding×15 − idle_penalty − delay_penalty" />
        </div>
      </div>

      {/* ── Predictive Maintenance ── */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
          letterSpacing:'0.08em', marginBottom:8 }}>🔧 Predictive Breakdown Risk (PBRS)</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="Breakdown Risk Score"
            value={k.pbrs} unit="/100"
            color={k.pbrs_level === 'critical' ? '#dc2626' : k.pbrs_level === 'high' ? '#d97706' : '#16a34a'}
            status={k.pbrs_action !== 'none' ? k.pbrs_action : k.pbrs_level}
            statusLevel={k.pbrs_level === 'critical' ? 'pull_from_route' : k.pbrs_level === 'high' ? 'inspect_48h' : k.pbrs_level === 'elevated' ? 'schedule_inspection' : 'none'}
            algoFormula="PBRS = brake×0.30 + mileage×0.25 + fuel×0.25 + strain×0.20" />
          <KpiTile label="Mileage Risk"           value={k.pbrs_mileage_component}  unit="/100" color="#475569" />
          <KpiTile label="Brake Stress Risk"      value={k.pbrs_brake_component}    unit="/100" color="#475569" />
          <KpiTile label="Fuel System Risk"       value={k.pbrs_fuel_component}     unit="/100" color="#475569" />
          <KpiTile label="MTBF"
            value={k.mtbf_h} unit="h"
            color="#7c3aed"
            algoFormula="Total runtime / number of breakdowns" />
          <KpiTile label="Next Service"           value={k.next_service_recommended ? 'RECOMMENDED' : 'OK'}
            color={k.next_service_recommended ? '#d97706' : '#16a34a'} />
        </div>
      </div>

      {/* ── Carbon + Utilisation ── */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
          letterSpacing:'0.08em', marginBottom:8 }}>🌿 Carbon Emissions + Vehicle Utilisation</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="Carbon Rate (CER)"
            value={k.carbon_emission_kg_per_km} unit="kg CO₂/km"
            color={k.cer_rating === 'green' ? '#16a34a' : k.cer_rating === 'moderate' ? '#d97706' : '#dc2626'}
            status={k.cer_rating} statusLevel={k.cer_rating === 'green' ? 'green' : k.cer_rating === 'moderate' ? 'moderate' : 'critical'}
            algoFormula="CER = (1/kmpl) × emission_factor_kg/L" />
          <KpiTile label="Daily CO₂"              value={k.est_daily_co2_kg}          unit="kg"    color="#475569" />
          <KpiTile label="Carbon Cost/Day"        value={k.carbon_cost_per_day_inr}   unit="₹"     color="#ef4444"
            algoFormula="daily_CO₂_kg / 1000 × ₹900/tonne (India carbon market)" />
          <KpiTile label="Vehicle Utilisation (VUE)"
            value={k.vehicle_utilisation_score} unit="/100"
            color={k.vue_status === 'excellent' ? '#16a34a' : k.vue_status === 'good' ? '#059669' : k.vue_status === 'fair' ? '#d97706' : '#dc2626'}
            status={k.vue_status} statusLevel={k.vue_status === 'excellent' ? 'excellent' : k.vue_status === 'good' ? 'good' : 'average'}
            algoFormula="VUE = load×0.35 + productive_time×0.30 + deliveries×0.35" />
          <KpiTile label="Load Factor"            value={k.load_factor_pct}           unit="%"     color="#475569" />
          <KpiTile label="Productive Time"        value={k.productive_time_pct}       unit="%"     color="#475569" />
        </div>
      </div>

      {/* ── Base telemetry ── */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
          letterSpacing:'0.08em', marginBottom:8 }}>📡 Vehicle Telemetry</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px,1fr))', gap:8 }}>
          <KpiTile label="Speed"            value={asset.speed_kmh}          unit="km/h" color="#475569" />
          <KpiTile label="Fuel Level"       value={asset.fuel_level_pct}     unit="%"    color={asset.fuel_level_pct < 15 ? '#dc2626' : '#475569'} />
          <KpiTile label="Fuel Efficiency"  value={k.fuel_efficiency_kmpl}   unit="km/L" color="#22c55e" />
          <KpiTile label="Deliveries Done"  value={asset.deliveries_completed}            color="#475569" />
          <KpiTile label="Pending"          value={asset.deliveries_pending}              color="#475569" />
          <KpiTile label="Harsh Brakes"     value={asset.harsh_brake_count}               color={asset.harsh_brake_count > 0 ? '#d97706' : '#475569'} />
          <KpiTile label="On Time"          value={asset.on_time != null ? (asset.on_time ? 'YES' : 'NO') : null}
            color={asset.on_time === false ? '#dc2626' : '#16a34a'} />
          <KpiTile label="Idle Ratio"       value={k.idle_ratio_pct}        unit="%"     color="#475569" />
        </div>
      </div>
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
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px,1fr))', gap:8 }}>
      {fields.map(f => (
        <KpiTile key={f.label} label={f.label} value={f.val} unit={f.unit} />
      ))}
    </div>
  );
}

// cold_chain detail — MKT + ECIS + CCCS
function ColdChainDetail({ asset }) {
  const k = asset.kpis || {};
  const cccsColor = k.cold_chain_compliance_pct >= 90 ? '#16a34a' : k.cold_chain_compliance_pct >= 70 ? '#d97706' : '#dc2626';
  const mktColor  = k.mkt_regulatory_status === 'compliant' ? '#16a34a'
    : k.mkt_regulatory_status === 'marginal' ? '#d97706' : '#dc2626';
  const ecisColor = k.ecis_severity === 'acceptable' ? '#16a34a'
    : k.ecis_severity === 'review' ? '#d97706'
    : k.ecis_severity === 'quarantine' ? '#f59e0b' : '#dc2626';
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Cold Chain Compliance ── */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
          letterSpacing:'0.08em', marginBottom:8 }}>❄️ Cold Chain Compliance</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="Compliance Score (CCCS)"
            value={k.cold_chain_compliance_pct} unit="%"
            color={cccsColor}
            algoFormula="% ticks within ±2°C of setpoint (last 20)" />
          <KpiTile label="Current Temp"   value={asset.current_temp_c}   unit="°C"
            color={asset.temp_violation ? '#dc2626' : '#16a34a'} />
          <KpiTile label="Set Point"      value={asset.set_point_c}      unit="°C"  color="#475569" />
          <KpiTile label="Deviation"      value={asset.temp_deviation_c} unit="°C"
            color={Math.abs(asset.temp_deviation_c || 0) > 2 ? '#dc2626' : '#16a34a'} />
          <KpiTile label="Temp Trend"     value={k.temp_trend}           color="#475569" />
          <KpiTile label="Battery Reserve" value={`${asset.battery_backup_h?.toFixed(0) ?? '—'}h`}
            color={k.battery_reserve_status === 'critical' ? '#dc2626' : '#16a34a'}
            status={k.battery_reserve_status} statusLevel={k.battery_reserve_status === 'critical' ? 'critical' : k.battery_reserve_status === 'low' ? 'elevated' : 'good'} />
        </div>
      </div>

      {/* ── Mean Kinetic Temperature ── */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
          letterSpacing:'0.08em', marginBottom:8 }}>🧪 Mean Kinetic Temperature (WHO/ICH Q1A)</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="MKT (°C)"
            value={k.mkt_c} unit="°C"
            color={mktColor}
            status={k.mkt_regulatory_status} statusLevel={k.mkt_regulatory_status === 'compliant' ? 'compliant' : k.mkt_regulatory_status === 'marginal' ? 'marginal' : 'non_compliant'}
            algoFormula="MKT = ΔH/R / −ln(Σ e^(−ΔH/R·Ti) / n) − 273.15" />
          <KpiTile label="MKT vs Setpoint"
            value={k.mkt_deviation_from_set_c} unit="°C ΔT"
            color={Math.abs(k.mkt_deviation_from_set_c || 0) > 2 ? '#dc2626' : '#16a34a'}
            algoFormula="ΔH=83,144 J/mol  R=8.314 J/(mol·K)" />
          <KpiTile label="MKT vs Simple Mean"
            value={k.mkt_vs_simple_mean_diff_c} unit="°C"
            color="#7c3aed"
            algoFormula="MKT > mean = Arrhenius weight on high-temp excursions" />
          <KpiTile label="Within Tolerance"
            value={k.mkt_within_tolerance ? 'YES' : 'NO'}
            color={k.mkt_within_tolerance ? '#16a34a' : '#dc2626'} />
          <KpiTile label="Readings Used"   value={k.mkt_readings_used}  color="#475569" />
          <KpiTile label="Regulatory Status"
            value={k.mkt_regulatory_status}
            color={mktColor} />
        </div>
      </div>

      {/* ── Excursion Cumulative Impact ── */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
          letterSpacing:'0.08em', marginBottom:8 }}>⚠ Excursion Cumulative Impact Score (ECIS)</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="ECIS (°C·s)"
            value={k.ecis_degC_seconds} unit="°C·s"
            color={ecisColor}
            status={k.ecis_severity} statusLevel={k.ecis_severity === 'acceptable' ? 'good' : k.ecis_severity === 'review' ? 'average' : 'critical'}
            algoFormula="ECIS += |T−setpoint| × tick_s  (for each out-of-range tick)" />
          <KpiTile label="Product Action"
            value={k.ecis_product_action}
            color={ecisColor}
            algoFormula=">500°C·s = quarantine; >2000°C·s = write-off risk" />
          <KpiTile label="Excursion Count"   value={asset.excursion_count}     color="#475569" />
          <KpiTile label="Door Open"
            value={asset.door_open ? 'OPEN' : 'CLOSED'}
            color={asset.door_open ? '#dc2626' : '#16a34a'} />
          <KpiTile label="Compressor"        value={asset.compressor_status}   color="#475569" />
          <KpiTile label="Humidity"          value={asset.humidity_pct}  unit="%" color="#475569" />
        </div>
      </div>
    </div>
  );
}

// warehouse detail — POR + WLPI
function WarehouseDetail({ asset }) {
  const k = asset.kpis || {};
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
          letterSpacing:'0.08em', marginBottom:8 }}>🏆 Perfect Order Rate (POR)</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="Perfect Order Rate"
            value={k.perfect_order_rate_pct} unit="%"
            color={k.por_status === 'world_class' ? '#16a34a' : k.por_status === 'good' ? '#059669' : k.por_status === 'average' ? '#d97706' : '#dc2626'}
            status={k.por_status} statusLevel={k.por_status === 'world_class' ? 'world_class' : k.por_status === 'good' ? 'good' : k.por_status === 'average' ? 'average' : 'poor'}
            algoFormula="POR = on_time × fill_rate × accuracy × damage_free × 100" />
          <KpiTile label="Fill Rate"         value={k.por_fill_rate_pct}    unit="%"  color="#475569"
            algoFormula="dispatched / received × 100" />
          <KpiTile label="On-Time Factor"    value={k.por_on_time_factor_pct} unit="%" color="#475569" />
          <KpiTile label="Pick Accuracy"     value={k.por_accuracy_pct}     unit="%"  color="#16a34a"
            algoFormula="1 − defect/wrong_item rate" />
          <KpiTile label="Gap to World-Class" value={k.por_gap_to_world_class_pct} unit="pts"
            color={k.por_gap_to_world_class_pct > 5 ? '#dc2626' : '#16a34a'}
            algoFormula="Amazon/Flipkart benchmark: 99%+" />
          <KpiTile label="Pending Backlog"   value={k.pending_order_backlog}  color={k.pending_order_backlog > 20 ? '#d97706' : '#475569'} />
        </div>
      </div>
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'#475569', textTransform:'uppercase',
          letterSpacing:'0.08em', marginBottom:8 }}>⚙️ Warehouse Labour Productivity (WLPI)</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:8 }}>
          <KpiTile label="Labour Productivity"
            value={k.warehouse_labour_productivity} unit="/100"
            color={k.wlpi_status === 'high' ? '#16a34a' : k.wlpi_status === 'normal' ? '#d97706' : '#dc2626'}
            status={k.wlpi_status} statusLevel={k.wlpi_status === 'high' ? 'excellent' : k.wlpi_status === 'normal' ? 'good' : 'poor'}
            algoFormula="WLPI = orders/dock_hour × utilisation × 10" />
          <KpiTile label="Orders/Dock Hour"  value={k.orders_per_dock_hour}  color="#475569" />
          <KpiTile label="Dock Truck Turns"  value={k.dock_truck_turns_per_bay_hour} unit="/bay/h" color="#475569" />
          <KpiTile label="Space Productivity"
            value={k.space_productivity_index} unit="ord/pal"
            color="#8b5cf6"
            status={k.spi_rating} statusLevel={k.spi_rating === 'fast_mover' ? 'fast_mover' : 'good'}
            algoFormula="SPI = orders_dispatched / used_pallet_positions" />
          <KpiTile label="Avg Fulfillment"   value={k.avg_fulfillment_h}      unit="h"  color="#475569" />
          <KpiTile label="Utilisation"       value={asset.utilization_pct}    unit="%"  color="#475569" />
        </div>
      </div>
    </div>
  );
}

const DETAIL_COMPONENTS = {
  delivery_vehicle: TruckDetail,
  truck:            TruckDetail,
  van:              TruckDetail,
  warehouse:        WarehouseDetail,
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

  // New fleet-level KPIs
  const avgOTDPI = (() => {
    const vals = assetList.filter(a => a.kpis?.otdpi_pct != null).map(a => a.kpis.otdpi_pct);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  })();
  const fleetCO2Rate = (() => {
    const vals = assetList.filter(a => a.kpis?.carbon_emission_kg_per_km != null).map(a => a.kpis.carbon_emission_kg_per_km);
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3) : null;
  })();
  const critPBRS = assetList.filter(a => a.kpis?.pbrs_level === 'critical' || a.kpis?.pbrs_level === 'high').length;
  const avgPOR   = (() => {
    const vals = assetList.filter(a => a.kpis?.perfect_order_rate_pct != null).map(a => a.kpis.perfect_order_rate_pct);
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null;
  })();
  const ecisAlerts = assetList.filter(a => a.kpis?.ecis_severity === 'quarantine' || a.kpis?.ecis_severity === 'write_off_risk').length;

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
        <KPICard label="Active Vehicles"     value={movingAssets.length}            color="#0284c7"  sub={`of ${assetList.length} assets`} />
        <KPICard label="OTDPI"             value={avgOTDPI != null ? `${avgOTDPI}%` : '—'} color={avgOTDPI >= 90 ? '#16a34a' : avgOTDPI >= 75 ? '#d97706' : '#dc2626'}
          sub="On-Time Delivery Index (rolling)" />
        <KPICard label="Driver Safety"     value={avgSafety ?? '—'} unit="/100"    color={avgSafety >= 80 ? '#16a34a' : avgSafety >= 60 ? '#d97706' : '#dc2626'}
          sub="DSS = 100 − braking − speed − idle" />
        <KPICard label="Fleet MTBF"        value={avgMTBF ?? '—'}   unit="h"       color="#7c3aed"  sub="Mean Time Between Failures" />
        <KPICard label="Fleet CO₂ Rate"    value={fleetCO2Rate ?? '—'} unit="kg/km" color={fleetCO2Rate < 0.3 ? '#16a34a' : '#d97706'}
          sub="Avg carbon emission per km" />
        <KPICard label="Breakdown Risk"    value={critPBRS}                         color={critPBRS > 0 ? '#ef4444' : '#16a34a'}
          sub="Vehicles needing inspection (PBRS)" />
        <KPICard label="Avg POR"           value={avgPOR != null ? `${avgPOR}%` : '—'} color={avgPOR >= 97 ? '#16a34a' : avgPOR >= 90 ? '#d97706' : '#dc2626'}
          sub="Perfect Order Rate (warehouse)" />
        <KPICard label="Cold Chain CC"     value={avgCCCS != null ? `${avgCCCS}%` : '—'} color={avgCCCS >= 90 ? '#16a34a' : avgCCCS >= 70 ? '#d97706' : '#dc2626'}
          sub="% ticks within ±2°C setpoint" />
        <KPICard label="ECIS Alerts"       value={ecisAlerts}                       color={ecisAlerts > 0 ? '#f59e0b' : '#16a34a'}
          sub="Cold chain quarantine triggers" />
        <KPICard label="SLA Breaches"      value={slaBreaches}                      color={slaBreaches > 0 ? '#dc2626' : '#16a34a'} />
        <KPICard label="Critical Alerts"   value={critAlerts}                       color={critAlerts > 0 ? '#dc2626' : '#64748b'} />
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
