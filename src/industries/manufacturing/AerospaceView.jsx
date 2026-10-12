// src/industries/manufacturing/AerospaceView.jsx
// Aerospace vertical of the Manufacturing dashboard.
// Data path: Aerospace simulator → Aerospace KPI processor → Enrich Utility →
//            manufacturing.processed.events → existing Insights API (WebSocket).
// So every asset arrives with machine KPIs (kpis.*) AND business metadata added by
// the Enrich Utility (plant, programme, customer, part number, criticality …).

import { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { THEME, ThemedKPICard, StatusBadge, HealthGauge, chartTheme, InfoTooltip } from '../../components/shared.jsx';

export const AEROSPACE_TYPES = ['aero_cnc', 'aero_cmm', 'aero_autoclave'];

const MAX_PTS = 60;
const AC = '#38bdf8'; // aerospace accent

// Enrichment metadata can land flat on the payload or under a nested object depending
// on how the Enrich Utility is configured — read both so the view works either way.
const META_KEYS = [
  'plant_code', 'plant_name', 'work_center', 'cell', 'machine_class', 'manufacturer', 'controller',
  'as9100_scope', 'nadcap_accreditation', 'calibration_due_date', 'maintenance_owner',
  'part_number', 'part_name', 'aircraft_programme', 'customer', 'criticality_class', 'material_spec',
  'drawing_revision', 'fai_standard', 'cure_spec', 'part_family',
];
export function getMeta(a) {
  const nested = a.enrichment || a.enriched || a.metadata || a.meta || {};
  const out = {};
  META_KEYS.forEach(k => { const v = a[k] ?? nested[k]; if (v != null) out[k] = v; });
  return out;
}

const cpkColor = v => v == null ? '#64748b' : v >= 1.33 ? '#16a34a' : v >= 1.0 ? '#d97706' : '#dc2626';
const CURE_COLOR = { conforming: '#16a34a', at_risk: '#d97706', nonconforming: '#dc2626', idle: '#64748b' };
const CRIT_COLOR = { 'critical-safety-item': '#dc2626', 'flight-critical': '#d97706' };
const fmt = (v, d = 1) => v == null ? '—' : Number(v).toFixed(d);
const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

// ── Small building blocks ─────────────────────────────────────────────────────
function Panel({ t, title, right, children, style }) {
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: '16px 20px', ...style }}>
      {(title || right) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.textDim }}>{title}</div>{right}
        </div>
      )}
      {children}
    </div>
  );
}

function Stat({ t, label, value, unit, color, hint }) {
  return (
    <div style={{ background: t.pageBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 9.5, color: t.textFaint, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', gap: 4, alignItems: 'center' }}>
        {label}{hint && <InfoTooltip text={hint} />}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || t.text, fontFamily: 'monospace', marginTop: 2 }}>
        {value ?? '—'}{unit && value != null && <span style={{ fontSize: 10, color: t.textFaint, marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

function Pill({ children, color }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}1f`, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{children}</span>;
}

function Bar100({ t, pct, color }) {
  return (
    <div style={{ height: 6, background: t.pageBg, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, height: '100%', background: color, transition: 'width .4s' }} />
    </div>
  );
}

// ── Asset cards ───────────────────────────────────────────────────────────────
function AssetCard({ a, t, selected, onClick, theme }) {
  const k = a.kpis || {}, m = getMeta(a);
  const icon = a.asset_type === 'aero_cnc' ? '⚙️' : a.asset_type === 'aero_cmm' ? '📐' : '🔥';
  return (
    <div onClick={onClick} style={{
      background: selected ? 'rgba(56,189,248,0.08)' : t.cardBg, border: `1px solid ${selected ? 'rgba(56,189,248,0.5)' : t.cardBorder}`,
      borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>{icon} {a.asset_id}</div>
          <div style={{ fontSize: 10.5, color: t.textFaint, marginTop: 2 }}>{m.machine_name || a.machine_name || m.machine_class || '—'}{m.plant_code ? ` · ${m.plant_code}` : ''}</div>
        </div>
        <StatusBadge status={a.asset_type === 'aero_autoclave' ? (a.cycle_phase === 'idle' ? 'idle' : a.cycle_phase) : a.status} />
      </div>

      {a.asset_type === 'aero_cnc' && (
        <>
          <div style={{ fontSize: 11, color: t.textDim, marginBottom: 8 }}>
            {a.program_name}{m.part_number ? ` · ${m.part_number}` : ''} · {a.material}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div><div style={{ fontSize: 9, color: t.textFaint }}>Cpk</div><div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: cpkColor(k.cpk) }}>{fmt(k.cpk, 2)}</div></div>
              <div><div style={{ fontSize: 9, color: t.textFaint }}>OEE</div><div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: t.text }}>{fmt(k.oee_pct, 0)}<span style={{ fontSize: 10 }}>%</span></div></div>
              <div><div style={{ fontSize: 9, color: t.textFaint }}>Tool</div><div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: k.tool_life_remaining_pct < 15 ? '#dc2626' : t.text }}>{fmt(k.tool_life_remaining_pct, 0)}<span style={{ fontSize: 10 }}>%</span></div></div>
            </div>
            <HealthGauge score={k.health_score ?? 100} size={48} theme={theme} />
          </div>
          {k.chatter_detected && <div style={{ marginTop: 8 }}><Pill color="#dc2626">〰 Chatter {fmt(a.vibration_g, 1)} g</Pill></div>}
        </>
      )}

      {a.asset_type === 'aero_cmm' && (
        <>
          <div style={{ fontSize: 11, color: t.textDim, marginBottom: 8 }}>{a.part_serial} · {a.program_name}{m.part_number ? ` · ${m.part_number}` : ''}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div><div style={{ fontSize: 9, color: t.textFaint }}>Cpk</div><div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: cpkColor(k.cpk) }}>{fmt(k.cpk, 2)}</div></div>
              <div><div style={{ fontSize: 9, color: t.textFaint }}>OOT</div><div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: k.oot_rate_pct > 1 ? '#dc2626' : t.text }}>{fmt(k.oot_rate_pct, 2)}<span style={{ fontSize: 10 }}>%</span></div></div>
              <div><div style={{ fontSize: 9, color: t.textFaint }}>Chamber</div><div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: k.chamber_temp_ok ? t.text : '#dc2626' }}>{fmt(a.chamber_temp_c, 1)}<span style={{ fontSize: 10 }}>°C</span></div></div>
            </div>
            <HealthGauge score={k.health_score ?? 100} size={48} theme={theme} />
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {k.ncr_required && <Pill color="#dc2626">NCR required</Pill>}
            {k.fai_result && <Pill color={k.fai_result === 'pass' ? '#16a34a' : '#dc2626'}>FAI {k.fai_result}</Pill>}
            {!k.chamber_temp_ok && <Pill color="#d97706">Temp excursion</Pill>}
          </div>
        </>
      )}

      {a.asset_type === 'aero_autoclave' && (
        <>
          <div style={{ fontSize: 11, color: t.textDim, marginBottom: 8 }}>{a.batch_id} · {a.cure_recipe}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: t.textFaint }}>Cycle {fmt(k.cycle_progress_pct, 0)}% · Cure {fmt(k.cure_progress_pct, 0)}%</span>
            <Pill color={CURE_COLOR[k.cure_status] || '#64748b'}>{(k.cure_status || '—').replace('_', ' ')}</Pill>
          </div>
          <Bar100 t={t} pct={k.cycle_progress_pct} color={AC} />
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
            <div><div style={{ fontSize: 9, color: t.textFaint }}>Part T</div><div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: t.text }}>{fmt(a.part_temp_c, 0)}<span style={{ fontSize: 10 }}>°C</span></div></div>
            <div><div style={{ fontSize: 9, color: t.textFaint }}>Pressure</div><div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: t.text }}>{fmt(a.pressure_bar, 1)}<span style={{ fontSize: 10 }}>bar</span></div></div>
            <div><div style={{ fontSize: 9, color: t.textFaint }}>Conform.</div><div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: CURE_COLOR[k.cure_status] }}>{fmt(k.cure_conformance_score, 0)}<span style={{ fontSize: 10 }}>%</span></div></div>
          </div>
          {k.vacuum_integrity_ok === false && <div style={{ marginTop: 8 }}><Pill color="#dc2626">Vacuum leak {fmt(a.vacuum_mbar, 0)} mbar</Pill></div>}
        </>
      )}
    </div>
  );
}

// ── Enrichment panel (shows what the Enrich Utility added) ────────────────────
function EnrichmentPanel({ a, t }) {
  const m = getMeta(a);
  const rows = [
    ['Plant', m.plant_name && `${m.plant_name} (${m.plant_code})`], ['Work centre / cell', m.work_center && `${m.work_center} · ${m.cell}`],
    ['Machine', m.machine_name || a.machine_name], ['Manufacturer / controller', m.manufacturer && `${m.manufacturer} · ${m.controller}`],
    ['Part', m.part_number && `${m.part_number} — ${m.part_name} (rev ${m.drawing_revision})`],
    ['Aircraft programme', m.aircraft_programme], ['Customer', m.customer],
    ['Criticality', m.criticality_class], ['Material spec', m.material_spec],
    ['Cure spec', m.cure_spec && `${m.cure_spec} · ${m.part_family}`],
    ['Certification', m.nadcap_accreditation || m.as9100_scope], ['Calibration due', m.calibration_due_date],
    ['Maintenance owner', m.maintenance_owner],
  ].filter(([, v]) => v);
  return (
    <Panel t={t} title="Enriched metadata" right={<Pill color={rows.length ? '#16a34a' : '#d97706'}>{rows.length ? 'via Enrich Utility' : 'not enriched'}</Pill>}>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: t.textDim }}>No business metadata on this record. Check that the Enrich Utility is deployed between the KPI processor and <code>manufacturing.processed.events</code>.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '8px 18px' }}>
          {rows.map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 9.5, color: t.textFaint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
              <div style={{ fontSize: 12, color: t.text, marginTop: 1 }}>{l === 'Criticality' ? <Pill color={CRIT_COLOR[v] || '#64748b'}>{v}</Pill> : v}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Detail panels ─────────────────────────────────────────────────────────────
function CncDetail({ a, hist, t, ct }) {
  const k = a.kpis || {};
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))', gap: 8, marginBottom: 14 }}>
        <Stat t={t} label="Cpk" value={fmt(k.cpk, 2)} color={cpkColor(k.cpk)} hint="Process capability of the in-process probed critical feature. Aerospace key characteristics (AS9103) typically require ≥ 1.33." />
        <Stat t={t} label="Cp" value={fmt(k.cp, 2)} hint="Process spread vs. tolerance, ignoring centring." />
        <Stat t={t} label="OEE" value={fmt(k.oee_pct)} unit="%" />
        <Stat t={t} label="Chatter index" value={fmt(k.chatter_index, 0)} unit="/100" color={k.chatter_detected ? '#dc2626' : t.text} hint="Spindle vibration vs. the regenerative-chatter threshold (4.5 g)." />
        <Stat t={t} label="Tool life left" value={fmt(k.tool_life_remaining_pct, 0)} unit="%" color={k.tool_life_remaining_pct < 15 ? '#dc2626' : t.text} />
        <Stat t={t} label="Tool RUL" value={fmt(k.tool_rul_min, 0)} unit="min" hint="Wear-rate extrapolation on the current tool." />
        <Stat t={t} label="Thermal growth" value={fmt(k.thermal_growth_um)} unit="µm" color={k.thermal_in_spec === false ? '#d97706' : t.text} hint="Spindle thermal growth; >15 µm needs offset compensation." />
        <Stat t={t} label="MRR" value={fmt(k.mrr_cm3_min, 0)} unit="cm³/min" hint="Material removal rate." />
        <Stat t={t} label="Spec. cutting energy" value={fmt(k.specific_cutting_energy_j_mm3, 2)} unit="J/mm³" hint="Energy per volume removed. Ti ≈ 4–5, Inconel ≈ 6–7, Al ≈ 0.8." />
        <Stat t={t} label="Buy-to-fly" value={fmt(k.buy_to_fly_ratio)} unit=": 1" hint="Raw stock weight ÷ finished part weight — the aerospace material-cost signature." />
        <Stat t={t} label="Material use" value={fmt(k.material_utilisation_pct)} unit="%" />
        <Stat t={t} label="PdM score" value={fmt(k.pdm_score, 0)} unit="/100" color={k.pdm_score >= 50 ? '#dc2626' : t.text} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 6 }}>Process capability (Cpk) — limits 1.33 / 1.0</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={hist} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 'auto']} tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={ct.tooltipStyle} />
              <ReferenceLine y={1.33} stroke="#16a34a" strokeDasharray="4 3" /><ReferenceLine y={1.0} stroke="#dc2626" strokeDasharray="4 3" />
              <Line type="monotone" dataKey="cpk" name="Cpk" stroke={AC} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 6 }}>Tool wear % and spindle vibration (g)</div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={hist} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="l" tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} width={28} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} width={24} />
              <Tooltip contentStyle={ct.tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10, color: ct.legend }} />
              <ReferenceLine yAxisId="r" y={4.5} stroke="#dc2626" strokeDasharray="4 3" />
              <Line yAxisId="l" type="monotone" dataKey="tool_wear" name="Tool wear %" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="r" type="monotone" dataKey="vibration" name="Vibration g" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

function CmmDetail({ a, hist, t, ct }) {
  const k = a.kpis || {};
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))', gap: 8, marginBottom: 14 }}>
        <Stat t={t} label="Cpk (critical)" value={fmt(k.cpk, 2)} color={cpkColor(k.cpk)} />
        <Stat t={t} label="OOT rate" value={fmt(k.oot_rate_pct, 2)} unit="%" color={k.oot_rate_pct > 1 ? '#dc2626' : t.text} />
        <Stat t={t} label="Part conformance" value={fmt(k.part_conformance_pct)} unit="%" />
        <Stat t={t} label="Chamber temp" value={fmt(a.chamber_temp_c, 2)} unit="°C" color={k.chamber_temp_ok ? t.text : '#dc2626'} hint="CMMs must hold 20 ± 1 °C or measurements are invalid." />
        <Stat t={t} label="Uncertainty / tol." value={fmt(k.uncertainty_ratio_pct)} unit="%" color={k.gauge_adequate ? t.text : '#d97706'} hint="Measurement uncertainty as % of the tolerance band. Must be ≤ 10 % (10:1 rule)." />
        <Stat t={t} label="Probe calibration" value={a.probe_calibration_age_h} unit="h" color={k.probe_cal_status === 'due_soon' ? '#d97706' : t.text} />
        <Stat t={t} label="Avg inspect time" value={fmt(k.avg_inspection_time_s, 0)} unit="s" />
        <Stat t={t} label="Source machine" value={a.source_machine_id} hint="Traceability link from this part back to the CNC that produced it." />
      </div>
      <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 6 }}>Critical feature deviation (µm) vs. tolerance band</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={hist} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} width={32} />
          <Tooltip contentStyle={ct.tooltipStyle} />
          {a.tolerance_um && <ReferenceLine y={a.tolerance_um} stroke="#dc2626" strokeDasharray="4 3" />}
          {a.tolerance_um && <ReferenceLine y={-a.tolerance_um} stroke="#dc2626" strokeDasharray="4 3" />}
          <ReferenceLine y={0} stroke={ct.axis} />
          <Line type="monotone" dataKey="dev" name="Deviation µm" stroke={AC} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}

function AutoclaveDetail({ a, hist, t, ct }) {
  const k = a.kpis || {};
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))', gap: 8, marginBottom: 14 }}>
        <Stat t={t} label="Cure conformance" value={fmt(k.cure_conformance_score, 0)} unit="%" color={CURE_COLOR[k.cure_status]} hint="Weighted: ramp rate 30 %, temperature uniformity 30 %, vacuum 25 %, pressure 15 %." />
        <Stat t={t} label="Cure progress" value={fmt(k.cure_progress_pct, 0)} unit="%" hint="Arrhenius-equivalent time at the dwell setpoint, driven by the COLDEST thermocouple." />
        <Stat t={t} label="Ramp rate" value={fmt(a.ramp_rate_cpm, 2)} unit="°C/min" color={k.ramp_in_spec ? t.text : '#dc2626'} hint="Spec 0.5–3 °C/min." />
        <Stat t={t} label="TC spread" value={fmt(k.temp_uniformity_c)} unit="°C" color={k.uniformity_in_spec ? t.text : '#dc2626'} hint="Max − min across 12 thermocouples. Must stay within ±5.5 °C (11 °C spread)." />
        <Stat t={t} label="Cold-spot Δ" value={fmt(k.cold_spot_delta_c)} unit="°C" />
        <Stat t={t} label="Vacuum" value={fmt(a.vacuum_mbar, 0)} unit="mbar" color={k.vacuum_integrity_ok ? t.text : '#dc2626'} hint="Bag vacuum; must stay ≤ 50 mbar abs. during ramp and dwell." />
        <Stat t={t} label="Pressure" value={fmt(a.pressure_bar, 2)} unit="bar" />
        <Stat t={t} label="Dwell" value={`${fmt(a.dwell_elapsed_min, 0)} / ${a.required_dwell_min}`} unit="min" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 6 }}>Cure curve — air / part / coldest & hottest thermocouple (°C)</div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={hist} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={ct.tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10, color: ct.legend }} />
              {a.setpoint_temp_c > 0 && <ReferenceLine y={a.setpoint_temp_c} stroke="#16a34a" strokeDasharray="4 3" />}
              <Line type="monotone" dataKey="air" name="Air" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="part" name="Part" stroke={AC} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="tcMin" name="TC min" stroke="#6366f1" strokeWidth={1} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="tcMax" name="TC max" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div style={{ fontSize: 11, color: t.textFaint, marginBottom: 6 }}>Pressure (bar) and vacuum (mbar)</div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={hist} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="l" tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} width={28} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 200]} tick={{ fontSize: 9, fill: ct.axis }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={ct.tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10, color: ct.legend }} />
              <ReferenceLine yAxisId="r" y={50} stroke="#dc2626" strokeDasharray="4 3" />
              <Line yAxisId="l" type="monotone" dataKey="pressure" name="Pressure bar" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="r" type="monotone" dataKey="vacuum" name="Vacuum mbar" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

// ── Programme roll-up — only possible because of enrichment ───────────────────
function ProgrammeRollup({ assets, alerts, t, ct }) {
  const enriched = assets.filter(a => getMeta(a).aircraft_programme);
  const withMeta = assets.filter(a => Object.keys(getMeta(a)).length > 0);
  const groups = {};
  enriched.forEach(a => {
    const m = getMeta(a);
    const g = (groups[m.aircraft_programme] ||= { programme: m.aircraft_programme, customer: m.customer, crit: m.criticality_class, parts: new Set(), n: 0, cpk: [], health: [] });
    g.n++; if (m.part_number) g.parts.add(m.part_number);
    if (a.kpis?.cpk != null) g.cpk.push(a.kpis.cpk);
    if (a.kpis?.health_score != null) g.health.push(a.kpis.health_score);
    if (m.criticality_class === 'critical-safety-item') g.crit = m.criticality_class;
  });
  const rows = Object.values(groups).map(g => ({ ...g, avgCpk: avg(g.cpk), minCpk: g.cpk.length ? Math.min(...g.cpk) : null, avgHealth: avg(g.health) }))
    .sort((a, b) => (a.minCpk ?? 9) - (b.minCpk ?? 9));

  if (!withMeta.length) {
    return (
      <Panel t={t} title="Quality by aircraft programme" right={<Pill color="#d97706">awaiting enrichment</Pill>}>
        <div style={{ fontSize: 12.5, color: t.textDim, lineHeight: 1.6 }}>
          Machine telemetry carries only a program name (e.g. <code>PROG_WR_4471</code>). Once the <b>Enrich Utility</b> is in the pipeline, this panel rolls capability and health up by aircraft programme, customer and criticality class.
        </div>
      </Panel>
    );
  }
  return (
    <Panel t={t} title="Quality by aircraft programme" right={<Pill color="#16a34a">{withMeta.length}/{assets.length} assets enriched</Pill>}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: t.textFaint, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {['Programme', 'Customer', 'Criticality', 'Parts', 'Assets', 'Avg Cpk', 'Worst Cpk', 'Avg health'].map(h => <th key={h} style={{ padding: '4px 8px', fontWeight: 600 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.programme} style={{ borderTop: `1px solid ${t.cardBorder}`, color: t.text }}>
                <td style={{ padding: '7px 8px', fontWeight: 600 }}>{r.programme}</td>
                <td style={{ padding: '7px 8px', color: t.textDim }}>{r.customer}</td>
                <td style={{ padding: '7px 8px' }}><Pill color={CRIT_COLOR[r.crit] || '#64748b'}>{r.crit}</Pill></td>
                <td style={{ padding: '7px 8px', color: t.textDim }}>{[...r.parts].join(', ')}</td>
                <td style={{ padding: '7px 8px', fontFamily: 'monospace' }}>{r.n}</td>
                <td style={{ padding: '7px 8px', fontFamily: 'monospace', color: cpkColor(r.avgCpk) }}>{fmt(r.avgCpk, 2)}</td>
                <td style={{ padding: '7px 8px', fontFamily: 'monospace', color: cpkColor(r.minCpk) }}>{fmt(r.minCpk, 2)}</td>
                <td style={{ padding: '7px 8px', fontFamily: 'monospace' }}>{fmt(r.avgHealth, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function AerospaceView({ assets, alertCount, theme, status }) {
  const t = THEME[theme], ct = chartTheme(theme);
  const [selected, setSelected] = useState(null);
  const [histories, setHistories] = useState({});
  const seen = useRef({});

  // Per-asset rolling history from the WebSocket feed
  useEffect(() => {
    const updates = {};
    assets.forEach(a => {
      if (!a.processed_at || seen.current[a.asset_id] === a.processed_at) return;
      seen.current[a.asset_id] = a.processed_at;
      const k = a.kpis || {};
      updates[a.asset_id] = {
        time: new Date().toLocaleTimeString('en', { hour12: false, minute: '2-digit', second: '2-digit' }),
        cpk: k.cpk, tool_wear: a.tool_wear_pct, vibration: a.vibration_g, dev: a.critical_dev_um,
        air: a.air_temp_c, part: a.part_temp_c, tcMin: a.tc_min_c, tcMax: a.tc_max_c, pressure: a.pressure_bar, vacuum: a.vacuum_mbar,
      };
    });
    if (!Object.keys(updates).length) return;
    setHistories(prev => {
      const next = { ...prev };
      Object.entries(updates).forEach(([id, pt]) => { next[id] = [...(next[id] || []), pt].slice(-MAX_PTS); });
      return next;
    });
  }, [assets]);

  const cnc = assets.filter(a => a.asset_type === 'aero_cnc');
  const cmm = assets.filter(a => a.asset_type === 'aero_cmm');
  const aut = assets.filter(a => a.asset_type === 'aero_autoclave');
  const sel = selected && assets.find(a => a.asset_id === selected);

  const cpks = [...cnc, ...cmm].map(a => a.kpis?.cpk).filter(v => v != null);
  const avgCpk = avg(cpks);
  const avgOEE = avg(cnc.map(a => a.kpis?.oee_pct).filter(v => v != null));
  const chatter = cnc.filter(a => a.kpis?.chatter_detected).length;
  const toolLow = cnc.filter(a => a.kpis?.tool_life_remaining_pct < 15).length;
  const ncrs = cmm.filter(a => a.kpis?.ncr_required).length;
  const activeAut = aut.filter(a => a.cycle_phase !== 'idle');
  const avgCure = avg(activeAut.map(a => a.kpis?.cure_conformance_score).filter(v => v != null));
  const badCure = activeAut.filter(a => a.kpis?.cure_status === 'nonconforming').length;

  const section = (title, sub, list) => list.length > 0 && (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 0 8px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title} ({list.length})</div>
        <div style={{ fontSize: 11, color: t.textFaint }}>{sub}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {list.map(a => <AssetCard key={a.asset_id} a={a} t={t} theme={theme} selected={selected === a.asset_id} onClick={() => setSelected(selected === a.asset_id ? null : a.asset_id)} />)}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ThemedKPICard theme={theme} label="Avg Cpk (key chars)" value={avgCpk != null ? avgCpk.toFixed(2) : '—'} color={cpkColor(avgCpk)} sub="Target ≥ 1.33 (AS9103)" />
        <ThemedKPICard theme={theme} label="CNC OEE" value={avgOEE != null ? avgOEE.toFixed(1) : '—'} unit="%" color="#7c3aed" sub={`${cnc.length} 5-axis machines`} />
        <ThemedKPICard theme={theme} label="Chatter Active" value={chatter} color={chatter ? '#dc2626' : '#16a34a'} sub="Regenerative vibration" />
        <ThemedKPICard theme={theme} label="Tools Near EOL" value={toolLow} color={toolLow ? '#d97706' : '#16a34a'} sub="< 15 % life left" />
        <ThemedKPICard theme={theme} label="NCRs Required" value={ncrs} color={ncrs ? '#dc2626' : '#16a34a'} sub={`${cmm.length} CMM cells`} />
        <ThemedKPICard theme={theme} label="Cure Conformance" value={avgCure != null ? avgCure.toFixed(0) : '—'} unit="%" color={badCure ? '#dc2626' : '#16a34a'} sub={`${activeAut.length} of ${aut.length} autoclaves curing`} />
        <ThemedKPICard theme={theme} label="Critical Alerts" value={alertCount} color={alertCount ? '#dc2626' : '#64748b'} />
      </div>

      <ProgrammeRollup assets={assets} t={t} ct={ct} />

      {assets.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: t.textDim, fontSize: 13, border: `1px dashed ${t.cardBorder}`, borderRadius: 10 }}>
          {status === 'connecting' ? 'Connecting…' : 'No aerospace assets yet. Start the Aerospace simulator and KPI processor.'}
        </div>
      )}

      {sel && (
        <Panel t={t} title={<span>{sel.asset_id} <span style={{ marginLeft: 8 }}><StatusBadge status={sel.asset_type === 'aero_autoclave' ? (sel.cycle_phase === 'idle' ? 'idle' : sel.cycle_phase) : sel.status} /></span></span>}
          right={<span style={{ fontSize: 10, color: t.textDim }}>{sel.processed_at && new Date(sel.processed_at).toLocaleTimeString()} · click card to close</span>}>
          {sel.asset_type === 'aero_cnc' && <CncDetail a={sel} hist={histories[sel.asset_id] || []} t={t} ct={ct} />}
          {sel.asset_type === 'aero_cmm' && <CmmDetail a={sel} hist={histories[sel.asset_id] || []} t={t} ct={ct} />}
          {sel.asset_type === 'aero_autoclave' && <AutoclaveDetail a={sel} hist={histories[sel.asset_id] || []} t={t} ct={ct} />}
        </Panel>
      )}
      {sel && <EnrichmentPanel a={sel} t={t} />}

      {section('5-Axis Machining', 'Ti / Inconel / Al structural & engine parts · in-process probing', cnc)}
      {section('Metrology (CMM)', 'AS9102 first-article & in-process inspection', cmm)}
      {section('Composite Cure (Autoclave)', 'Cure-cycle conformance · Nadcap-relevant', aut)}
    </div>
  );
}
