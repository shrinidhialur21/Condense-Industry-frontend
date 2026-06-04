// src/industries/travel/TravelDashboard.jsx
// Travel & Hospitality — Hotel rooms, F&B, Spa, Guest Feedback, Facilities
// Algorithms: RevPAR, GSS (Guest Satisfaction Score), NPS, EEI (Energy Efficiency Index)

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { useCondenseWS } from '../../hooks/useCondenseWS.js';
import { INDUSTRIES }    from '../../config/industries.js';
import {
  ConnectionStatus, KPICard, AlertFeed, StatusBadge, HealthGauge,
  DashboardHeader, RefreshButton,
} from '../../components/shared.jsx';

const MAX_HISTORY = 60;
const CFG = INDUSTRIES.travel;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v, dec = 1) { return v != null && !isNaN(v) ? Number(v).toFixed(dec) : '—'; }
function pct(v) { return v != null ? `${fmt(v, 0)}%` : '—'; }

function SentimentBadge({ val }) {
  const s = typeof val === 'string' ? val : null;
  const map = {
    positive: { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', label: 'Positive' },
    neutral:  { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Neutral'  },
    negative: { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', label: 'Negative' },
    improving:{ bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', label: '↑ Improving' },
    declining:{ bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', label: '↓ Declining' },
    stable:   { bg: 'rgba(100,116,139,0.15)',color: '#64748b', label: '→ Stable' },
  };
  const st = map[s] || { bg: 'rgba(100,116,139,0.12)', color: '#64748b', label: s || '—' };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {st.label}
    </span>
  );
}

function NPSBadge({ cat }) {
  const map = {
    promoter:  { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
    passive:   { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    detractor: { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
  };
  const s = map[cat] || { bg: 'rgba(100,116,139,0.12)', color: '#64748b' };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {cat || '—'}
    </span>
  );
}

function EEIBadge({ status }) {
  const map = {
    efficient: { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e',  label: 'Efficient' },
    normal:    { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b',  label: 'Normal'    },
    high:      { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444',  label: 'High Usage' },
  };
  const s = map[status] || { bg: 'rgba(100,116,139,0.12)', color: '#64748b', label: status || '—' };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {s.label}
    </span>
  );
}

// ── Asset Cards ───────────────────────────────────────────────────────────────
function HotelRoomCard({ asset, selected, onClick }) {
  const occ    = asset.occupied;
  const gss    = asset.kpis?.guest_satisfaction_score;
  const revpar = asset.kpis?.revpar_usd;
  const health = asset.kpis?.health_score ?? 80;
  const hk     = asset.housekeeping_status;

  const borderColor = asset.kpis?.maintenance_risk === 'at_risk'
    ? 'rgba(239,68,68,0.35)'
    : selected
      ? 'rgba(16,185,129,0.4)'
      : '#e2e8f0';

  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(16,185,129,0.07)' : '#ffffff',
      border: `1px solid ${borderColor}`,
      borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
      transition: 'all 0.15s', minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
            Room {asset.room_number}
          </div>
          <div style={{ fontSize: 9, color: '#475569', marginTop: 1 }}>{asset.room_type}</div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
          background: occ ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.12)',
          color: occ ? '#3b82f6' : '#64748b',
          textTransform: 'uppercase',
        }}>
          {occ ? 'Occupied' : hk || 'Vacant'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
            ${revpar != null ? revpar.toFixed(0) : '—'}
          </div>
          <div style={{ fontSize: 9, color: '#475569' }}>RevPAR</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: gss >= 70 ? '#22c55e' : gss >= 50 ? '#f59e0b' : '#ef4444' }}>
            {gss != null ? gss.toFixed(0) : '—'}
          </div>
          <div style={{ fontSize: 9, color: '#475569' }}>GSS</div>
        </div>
      </div>
    </div>
  );
}

function FnBCard({ asset, selected, onClick }) {
  const occ      = asset.kpis?.occupancy_pct ?? asset.occupancy_pct;
  const waitSLA  = asset.kpis?.wait_time_sla;
  const revCover = asset.kpis?.revenue_per_cover_usd;
  const slaColor = waitSLA === 'ok' ? '#22c55e' : waitSLA === 'warning' ? '#f59e0b' : '#ef4444';

  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(245,158,11,0.07)' : '#ffffff',
      border: `1px solid ${selected ? 'rgba(245,158,11,0.4)' : '#e2e8f0'}`,
      borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>
          {asset.outlet_name || asset.asset_id}
        </div>
        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 10,
          background: `${slaColor}20`, color: slaColor, textTransform: 'uppercase' }}>
          {waitSLA || '—'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
            {occ != null ? `${occ.toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: 9, color: '#475569' }}>Occupancy</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', fontFamily: 'monospace' }}>
            ${revCover != null ? revCover.toFixed(2) : '—'}
          </div>
          <div style={{ fontSize: 9, color: '#475569' }}>Rev/Cover</div>
        </div>
      </div>
    </div>
  );
}

function SpaCard({ asset, selected, onClick }) {
  const util = asset.kpis?.utilization_pct;
  const gss  = asset.kpis?.guest_satisfaction_score;

  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(139,92,246,0.07)' : '#ffffff',
      border: `1px solid ${selected ? 'rgba(139,92,246,0.4)' : '#e2e8f0'}`,
      borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
          {asset.service_name || asset.asset_id}
        </div>
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 10,
          background: asset.booked ? 'rgba(139,92,246,0.15)' : 'rgba(100,116,139,0.12)',
          color: asset.booked ? '#8b5cf6' : '#64748b', textTransform: 'uppercase',
        }}>
          {asset.booked ? 'In Session' : 'Available'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>
            {util != null ? `${util.toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: 9, color: '#475569' }}>Utilization</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: gss >= 70 ? '#22c55e' : '#f59e0b' }}>
            {gss != null ? gss.toFixed(0) : '—'}
          </div>
          <div style={{ fontSize: 9, color: '#475569' }}>GSS</div>
        </div>
      </div>
    </div>
  );
}

function FeedbackCard({ asset, selected, onClick }) {
  const gss  = asset.kpis?.guest_satisfaction_score;
  const sent = asset.sentiment;

  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(236,72,153,0.07)' : '#ffffff',
      border: `1px solid ${selected ? 'rgba(236,72,153,0.4)' : '#e2e8f0'}`,
      borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
          {asset.category ? asset.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : asset.asset_id}
        </div>
        <SentimentBadge val={sent} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#ec4899', fontFamily: 'monospace' }}>
            {asset.rating != null ? asset.rating.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: 9, color: '#475569' }}>Rating</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <NPSBadge cat={asset.kpis?.nps_category} />
        </div>
      </div>
    </div>
  );
}

function FacilityCard({ asset, selected, onClick }) {
  const util    = asset.kpis?.utilization_pct ?? asset.utilization_pct;
  const risk    = asset.kpis?.maintenance_risk;
  const riskColor = risk === 'high' ? '#ef4444' : risk === 'medium' ? '#f59e0b' : '#22c55e';

  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(6,182,212,0.07)' : '#ffffff',
      border: `1px solid ${selected ? 'rgba(6,182,212,0.4)' : '#e2e8f0'}`,
      borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
          {asset.facility_name || asset.asset_id}
        </div>
        <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 10,
          background: asset.status === 'maintenance' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
          color: asset.status === 'maintenance' ? '#ef4444' : '#22c55e', textTransform: 'uppercase' }}>
          {asset.status || '—'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#06b6d4', fontFamily: 'monospace' }}>
            {util != null ? `${util.toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: 9, color: '#475569' }}>Utilization</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: riskColor }}>
            {risk ? risk.toUpperCase() : '—'}
          </span>
          <div style={{ fontSize: 9, color: '#475569' }}>Maint. Risk</div>
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#1e293b', fontFamily: 'monospace', fontWeight: 600 }}>{value ?? '—'}</span>
    </div>
  );
}

function HotelRoomDetail({ asset }) {
  const k = asset.kpis || {};
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
            ${k.revpar_usd != null ? k.revpar_usd.toFixed(0) : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>RevPAR</div>
        </div>
        <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace' }}>
            {k.guest_satisfaction_score != null ? k.guest_satisfaction_score.toFixed(0) : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>GSS Score</div>
        </div>
      </div>
      <DetailRow label="Room Type"         value={asset.room_type} />
      <DetailRow label="ADR (Rate/Night)"  value={`$${asset.rate_usd || '—'}`} />
      <DetailRow label="Occupancy"         value={k.occupancy_pct != null ? `${k.occupancy_pct}%` : '—'} />
      <DetailRow label="Length of Stay"    value={k.length_of_stay_days != null ? `${k.length_of_stay_days} days` : '—'} />
      <DetailRow label="Revenue Today"     value={asset.revenue_today_usd != null ? `$${asset.revenue_today_usd}` : '—'} />
      <DetailRow label="NPS Category"      value={<NPSBadge cat={k.nps_category} />} />
      <DetailRow label="Housekeeping"      value={asset.housekeeping_status} />
      <DetailRow label="Guest Count"       value={asset.guest_count} />
      <DetailRow label="Energy (kWh)"      value={asset.energy_kwh != null ? asset.energy_kwh.toFixed(1) : '—'} />
      <DetailRow label="EEI"               value={k.eei != null ? k.eei.toFixed(2) : '—'} />
      <DetailRow label="Energy Status"     value={<EEIBadge status={k.energy_status} />} />
      <DetailRow label="Savings (kWh)"     value={k.savings_kwh != null ? k.savings_kwh.toFixed(1) : '—'} />
      <DetailRow label="Maintenance"       value={asset.maintenance_pending ? '⚠️ Pending' : 'OK'} />
      <DetailRow label="Temperature"       value={asset.temperature_c != null ? `${asset.temperature_c.toFixed(1)}°C` : '—'} />
      <DetailRow label="Minibar Consumed"  value={asset.minibar_consumed_usd != null ? `$${asset.minibar_consumed_usd.toFixed(0)}` : '—'} />
      <DetailRow label="Service Requests"  value={asset.room_service_requests} />
    </div>
  );
}

function FnBDetail({ asset }) {
  const k = asset.kpis || {};
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
            {k.occupancy_pct != null ? `${k.occupancy_pct.toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>Occupancy</div>
        </div>
        <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>
            ${k.revenue_per_cover_usd != null ? k.revenue_per_cover_usd.toFixed(2) : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>Rev/Cover</div>
        </div>
      </div>
      <DetailRow label="Outlet Name"       value={asset.outlet_name} />
      <DetailRow label="Outlet Type"       value={asset.outlet_type} />
      <DetailRow label="Current Covers"    value={`${asset.current_covers || 0} / ${asset.max_capacity || 80}`} />
      <DetailRow label="Avg Wait Time"     value={asset.avg_wait_time_min != null ? `${asset.avg_wait_time_min.toFixed(0)} min` : '—'} />
      <DetailRow label="Wait SLA"          value={k.wait_time_sla} />
      <DetailRow label="Table Turnover"    value={k.table_turnover_rate != null ? `${k.table_turnover_rate.toFixed(2)}x` : '—'} />
      <DetailRow label="Staff/Covers Ratio" value={k.staff_covers_ratio} />
      <DetailRow label="Orders Pending"    value={asset.orders_pending} />
      <DetailRow label="Revenue (Last Hr)" value={asset.revenue_last_hour_usd != null ? `$${asset.revenue_last_hour_usd}` : '—'} />
      <DetailRow label="Revenue Today"     value={asset.revenue_today_usd != null ? `$${asset.revenue_today_usd}` : '—'} />
      <DetailRow label="GSS Score"         value={k.guest_satisfaction_score != null ? k.guest_satisfaction_score.toFixed(1) : '—'} />
    </div>
  );
}

function SpaDetail({ asset }) {
  const k = asset.kpis || {};
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>
            {k.utilization_pct != null ? `${k.utilization_pct.toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>Utilization</div>
        </div>
        <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>
            {k.guest_satisfaction_score != null ? k.guest_satisfaction_score.toFixed(0) : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>GSS Score</div>
        </div>
      </div>
      <DetailRow label="Service"           value={asset.service_name} />
      <DetailRow label="Therapist"         value={asset.therapist_id} />
      <DetailRow label="Status"            value={asset.status} />
      <DetailRow label="Session Duration"  value={asset.session_duration_min ? `${asset.session_duration_min} min` : '—'} />
      <DetailRow label="Price"             value={asset.price_usd != null ? `$${asset.price_usd.toFixed(0)}` : '—'} />
      <DetailRow label="Sessions Today"    value={k.daily_sessions ?? asset.sessions_today} />
      <DetailRow label="Rev/Session"       value={k.revenue_per_session_usd != null ? `$${k.revenue_per_session_usd.toFixed(0)}` : '—'} />
      <DetailRow label="Revenue Today"     value={asset.revenue_today_usd != null ? `$${asset.revenue_today_usd}` : '—'} />
      <DetailRow label="Repeat Guest"      value={k.repeat_guest_rate_pct != null ? `${k.repeat_guest_rate_pct}%` : '—'} />
      <DetailRow label="Wellness Score"    value={k.wellness_score ?? asset.wellness_score} />
    </div>
  );
}

function FeedbackDetail({ asset }) {
  const k = asset.kpis || {};
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: 'rgba(236,72,153,0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ec4899', fontFamily: 'monospace' }}>
            {asset.rating != null ? asset.rating.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>Rating</div>
        </div>
        <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>
            {k.guest_satisfaction_score != null ? k.guest_satisfaction_score.toFixed(0) : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>GSS Score</div>
        </div>
      </div>
      <DetailRow label="Category"          value={asset.category} />
      <DetailRow label="Channel"           value={asset.feedback_channel} />
      <DetailRow label="Sentiment"         value={<SentimentBadge val={asset.sentiment} />} />
      <DetailRow label="NPS Category"      value={<NPSBadge cat={k.nps_category} />} />
      <DetailRow label="NPS Score"         value={k.nps_score_scaled ?? asset.nps_score} />
      <DetailRow label="Response SLA"      value={k.response_sla} />
      <DetailRow label="Response Time"     value={asset.response_time_min != null ? `${asset.response_time_min} min` : '—'} />
      <DetailRow label="Responded"         value={asset.responded ? 'Yes' : 'No'} />
      <DetailRow label="Rolling Avg Rating" value={k.rolling_avg_rating != null ? k.rolling_avg_rating.toFixed(2) : '—'} />
      <DetailRow label="Sentiment Trend"   value={<SentimentBadge val={k.sentiment_trend} />} />
      <DetailRow label="Guest Type"        value={asset.guest_type} />
      <DetailRow label="Room Number"       value={asset.room_number} />
    </div>
  );
}

function FacilityDetail({ asset }) {
  const k = asset.kpis || {};
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: 'rgba(6,182,212,0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#06b6d4', fontFamily: 'monospace' }}>
            {(k.utilization_pct ?? asset.utilization_pct) != null
              ? `${(k.utilization_pct ?? asset.utilization_pct).toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>Utilization</div>
        </div>
        <div style={{ background: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>
            {k.safety_score != null ? k.safety_score : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569' }}>Safety Score</div>
        </div>
      </div>
      <DetailRow label="Facility"          value={asset.facility_name} />
      <DetailRow label="Status"            value={asset.status} />
      <DetailRow label="Current Usage"     value={`${asset.current_usage || 0} / ${asset.max_capacity || 50}`} />
      <DetailRow label="Maintenance Risk"  value={k.maintenance_risk} />
      <DetailRow label="Maintenance Due"   value={asset.maintenance_due_days != null ? `${asset.maintenance_due_days} days` : '—'} />
      <DetailRow label="Energy (kWh)"      value={asset.energy_kwh != null ? asset.energy_kwh.toFixed(1) : '—'} />
      <DetailRow label="Energy/Guest"      value={k.energy_per_guest != null ? `${k.energy_per_guest.toFixed(2)} kWh` : '—'} />
      <DetailRow label="Incidents Today"   value={asset.incidents_today ?? 0} />
      <DetailRow label="Staff Assigned"    value={asset.staff_assigned} />
      <DetailRow label="Guest Rating"      value={asset.guest_rating != null ? asset.guest_rating.toFixed(1) : '—'} />
    </div>
  );
}

const DETAIL_COMPONENTS = {
  hotel_room:     HotelRoomDetail,
  fnb_outlet:     FnBDetail,
  spa_service:    SpaDetail,
  guest_feedback: FeedbackDetail,
  facility:       FacilityDetail,
};

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, title, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>{title}</span>
      {count != null && (
        <span style={{ fontSize: 10, color: '#64748b', background: '#e2e8f0',
          padding: '2px 6px', borderRadius: 4 }}>{count}</span>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function TravelDashboard() {
  const apiUrl = CFG?.apiUrl || '';
  const { status, assets, alerts } = useCondenseWS(apiUrl);

  const [selectedId, setSelectedId] = useState(null);
  const [gssHistory,  setGssHistory]  = useState([]);
  const [occHistory,  setOccHistory]  = useState([]);
  const tick = useRef(0);

  const allAssets = Object.values(assets);

  const rooms    = allAssets.filter(a => a.asset_type === 'hotel_room');
  const fnbs     = allAssets.filter(a => a.asset_type === 'fnb_outlet');
  const spas     = allAssets.filter(a => a.asset_type === 'spa_service');
  const feedback = allAssets.filter(a => a.asset_type === 'guest_feedback');
  const facility = allAssets.filter(a => a.asset_type === 'facility');

  // ── Top-level KPIs ────────────────────────────────────────────
  const occupiedRooms = rooms.filter(r => r.occupied).length;
  const totalRooms    = rooms.length;
  const occupancyPct  = totalRooms > 0 ? Math.round(occupiedRooms / totalRooms * 100) : null;

  const avgRevPAR = rooms.length > 0
    ? rooms.reduce((s, r) => s + (r.kpis?.revpar_usd || 0), 0) / rooms.length
    : null;

  const avgGSS = allAssets.filter(a => a.kpis?.guest_satisfaction_score != null).length > 0
    ? allAssets.filter(a => a.kpis?.guest_satisfaction_score != null)
        .reduce((s, a) => s + (a.kpis.guest_satisfaction_score || 0), 0)
      / allAssets.filter(a => a.kpis?.guest_satisfaction_score != null).length
    : null;

  const npsPromoters  = feedback.filter(f => f.kpis?.nps_category === 'promoter').length;
  const npsDetractors = feedback.filter(f => f.kpis?.nps_category === 'detractor').length;
  const npsTotal      = feedback.length;
  const npsScore      = npsTotal > 0
    ? Math.round((npsPromoters - npsDetractors) / npsTotal * 100)
    : null;

  const totalRevenueToday = rooms.reduce((s, r) => s + (r.revenue_today_usd || 0), 0)
    + fnbs.reduce((s, f) => s + (f.revenue_today_usd || 0), 0)
    + spas.reduce((s, sp) => s + (sp.revenue_today_usd || 0), 0);

  // ── Rolling history for trend charts ─────────────────────────
  useEffect(() => {
    if (allAssets.length === 0) return;
    tick.current += 1;
    const label = tick.current;

    if (avgGSS != null) {
      setGssHistory(h => [...h.slice(-MAX_HISTORY + 1), { t: label, gss: parseFloat(avgGSS.toFixed(1)) }]);
    }
    if (occupancyPct != null) {
      setOccHistory(h => [...h.slice(-MAX_HISTORY + 1), { t: label, occ: occupancyPct }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  // ── Sentiment distribution for bar chart ─────────────────────
  const sentimentData = [
    { name: 'Positive', count: feedback.filter(f => f.sentiment === 'positive').length, fill: '#22c55e' },
    { name: 'Neutral',  count: feedback.filter(f => f.sentiment === 'neutral').length,  fill: '#f59e0b' },
    { name: 'Negative', count: feedback.filter(f => f.sentiment === 'negative').length, fill: '#ef4444' },
  ];

  // ── Outlet occupancy bar chart ────────────────────────────────
  const fnbBarData = fnbs.map(f => ({
    name: (f.outlet_name || f.asset_id).split(' ')[0],
    occ:  f.kpis?.occupancy_pct ?? f.occupancy_pct ?? 0,
    wait: f.avg_wait_time_min || 0,
  }));

  // ── Selected asset ────────────────────────────────────────────
  const selectedAsset = selectedId ? assets[selectedId] : null;
  const DetailComp = selectedAsset ? DETAIL_COMPONENTS[selectedAsset.asset_type] : null;

  const handleSelect = (id) => setSelectedId(prev => prev === id ? null : id);

  // ── Not configured ────────────────────────────────────────────
  if (!apiUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '70vh', gap: 12, color: '#64748b' }}>
        <div style={{ fontSize: 48 }}>🏨</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#64748b' }}>Travel & Hospitality</div>
        <div style={{ fontSize: 13 }}>Set VITE_TRAVEL_API_URL to connect your Condense pipeline</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', minHeight: '100vh', background: '#f1f5f9', color: '#1e293b' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>🏨</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Travel & Hospitality</div>
            <div style={{ fontSize: 11, color: '#475569' }}>
              Viva Resorts · RevPAR · GSS · NPS · Energy Efficiency
            </div>
          </div>
        </div>
        <ConnectionStatus status={status} />
      </div>

      {/* ── Top KPI Row ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <KPICard
          label="Occupancy Rate"
          value={occupancyPct != null ? occupancyPct : '—'}
          unit="%"
          color="#10b981"
          sub={`${occupiedRooms} of ${totalRooms} rooms`}
        />
        <KPICard
          label="Avg RevPAR"
          value={avgRevPAR != null ? `$${avgRevPAR.toFixed(0)}` : '—'}
          color="#3b82f6"
          sub="Revenue per Available Room"
        />
        <KPICard
          label="Avg GSS"
          value={avgGSS != null ? avgGSS.toFixed(1) : '—'}
          unit="/ 100"
          color={avgGSS >= 70 ? '#22c55e' : avgGSS >= 50 ? '#f59e0b' : '#ef4444'}
          sub="Guest Satisfaction Score"
        />
        <KPICard
          label="NPS Score"
          value={npsScore != null ? npsScore : '—'}
          color={npsScore >= 30 ? '#22c55e' : npsScore >= 0 ? '#f59e0b' : '#ef4444'}
          sub={`${npsPromoters}P · ${npsDetractors}D`}
        />
        <KPICard
          label="Total Revenue Today"
          value={totalRevenueToday > 0 ? `$${Math.round(totalRevenueToday).toLocaleString()}` : '—'}
          color="#f59e0b"
          sub="Rooms + F&B + Spa"
        />
      </div>

      {/* ── 2-col layout: left content + right detail panel ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── Left: asset grids + charts ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Hotel Rooms */}
          {rooms.length > 0 && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: 16 }}>
              <SectionHeader icon="🛏️" title="Hotel Rooms" count={rooms.length} color="#10b981" />
              <div style={{
                display: 'grid', gap: 8,
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              }}>
                {rooms.map(r => (
                  <HotelRoomCard
                    key={r.asset_id}
                    asset={r}
                    selected={selectedId === r.asset_id}
                    onClick={() => handleSelect(r.asset_id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Trend Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* GSS Trend */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>
                Guest Satisfaction Score Trend
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={gssHistory}>
                  <defs>
                    <linearGradient id="gssGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} width={28}/>
                  <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0',
                    borderRadius: 6, fontSize: 11 }} labelStyle={{ color: '#64748b' }} />
                  <Area dataKey="gss" stroke="#10b981" fill="url(#gssGrad)" dot={false} strokeWidth={1.5}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Occupancy Trend */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>
                Occupancy Rate Trend
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={occHistory}>
                  <defs>
                    <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="t" hide />
                  <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} width={28}/>
                  <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0',
                    borderRadius: 6, fontSize: 11 }} labelStyle={{ color: '#64748b' }} />
                  <Area dataKey="occ" stroke="#3b82f6" fill="url(#occGrad)" dot={false} strokeWidth={1.5}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* F&B Outlets */}
          {fnbs.length > 0 && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: 16 }}>
              <SectionHeader icon="🍽️" title="F&B Outlets" count={fnbs.length} color="#f59e0b" />
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: 14 }}>
                {fnbs.map(f => (
                  <FnBCard key={f.asset_id} asset={f} selected={selectedId === f.asset_id} onClick={() => handleSelect(f.asset_id)} />
                ))}
              </div>
              {fnbBarData.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Outlet Occupancy %</div>
                  <ResponsiveContainer width="100%" height={90}>
                    <BarChart data={fnbBarData} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} width={28}/>
                      <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0',
                        borderRadius: 6, fontSize: 11 }} />
                      <Bar dataKey="occ" fill="#f59e0b" radius={[3, 3, 0, 0]}>
                        {fnbBarData.map((entry, i) => (
                          <Cell key={i} fill={entry.occ > 80 ? '#ef4444' : entry.occ > 60 ? '#f59e0b' : '#22c55e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Spa Services + Facilities row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {spas.length > 0 && (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0',
                borderRadius: 12, padding: 16 }}>
                <SectionHeader icon="💆" title="Spa & Wellness" count={spas.length} color="#8b5cf6" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {spas.map(s => (
                    <SpaCard key={s.asset_id} asset={s} selected={selectedId === s.asset_id} onClick={() => handleSelect(s.asset_id)} />
                  ))}
                </div>
              </div>
            )}

            {facility.length > 0 && (
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0',
                borderRadius: 12, padding: 16 }}>
                <SectionHeader icon="🏊" title="Facilities" count={facility.length} color="#06b6d4" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {facility.map(f => (
                    <FacilityCard key={f.asset_id} asset={f} selected={selectedId === f.asset_id} onClick={() => handleSelect(f.asset_id)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Guest Feedback */}
          {feedback.length > 0 && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: 16 }}>
              <SectionHeader icon="⭐" title="Guest Feedback" count={feedback.length} color="#ec4899" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                  {feedback.slice(0, 8).map(f => (
                    <FeedbackCard key={f.asset_id} asset={f} selected={selectedId === f.asset_id} onClick={() => handleSelect(f.asset_id)} />
                  ))}
                </div>
                {/* Sentiment chart */}
                <div style={{ width: 160 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textAlign: 'center' }}>Sentiment Mix</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={sentimentData} barSize={28} layout="vertical">
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 9 }}/>
                      <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} width={48}/>
                      <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0',
                        borderRadius: 6, fontSize: 11 }} />
                      <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                        {sentimentData.map((entry, i) => <Cell key={i} fill={entry.fill}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Alert Feed */}
          <AlertFeed alerts={alerts} maxHeight={260} />
        </div>

        {/* ── Right: Detail panel ── */}
        {selectedAsset && DetailComp && (
          <div style={{
            width: 280, flexShrink: 0,
            background: '#ffffff', border: '1px solid #e2e8f0',
            borderRadius: 12, padding: 16, position: 'sticky', top: 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  {selectedAsset.asset_id}
                </div>
                <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                  {selectedAsset.asset_type?.replace('_', ' ').toUpperCase()}
                </div>
              </div>
              <HealthGauge score={selectedAsset.kpis?.health_score ?? 80} size={56} />
            </div>
            <DetailComp asset={selectedAsset} />
          </div>
        )}
      </div>
    </div>
  );
}
