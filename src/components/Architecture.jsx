// src/components/Architecture.jsx
// Interactive, clickable system-design diagram for client/procurement conversations.
// Every label here is display-only content (NODES array) — swap names per client
// before a call without touching layout or logic.

import { useState } from 'react';
import {
  Cpu, HardDrives, Broadcast, Database, Globe,
  ArrowsLeftRight, Waveform, Plug, WifiHigh, GitBranch, Queue, ArrowsClockwise,
  Funnel, ChartLineUp, Bell, Warning, Sparkle, Stack,
  Monitor, DeviceMobile, CloudArrowUp, ArrowsOut, PlugsConnected,
} from '@phosphor-icons/react';
import { useWindowSize } from '../hooks/useWindowSize.js';

const STAGE_META = {
  source:  { label: 'Your Data Sources',          color: '#8b96b3', bg: 'rgba(139,150,179,0.08)', border: '#3a4568',            dashed: true  },
  ingest:  { label: 'Ingestion',                   color: '#5b9cf5', bg: 'rgba(37,125,240,0.1)',   border: 'rgba(37,125,240,0.35)',  dashed: false },
  process: { label: 'Processing & Transformation', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.35)', dashed: false },
  output:  { label: 'Output & Destinations',       color: '#4ade80', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.35)',   dashed: false },
};

const NODES = [
  { id: 'src-1', stage: 'source', Icon: Cpu,        label: 'PLC / SCADA',       desc: 'The machines, sensors and control systems already running on your floor.', how: 'We read from OPC-UA, Modbus, or your vendor’s SCADA historian — no changes to your control layer.' },
  { id: 'src-2', stage: 'source', Icon: HardDrives, label: 'ERP / MES',         desc: 'Production orders, inventory and asset master data.', how: 'Pulled via your ERP’s standard API or a scheduled export, matched to live telemetry by asset ID.' },
  { id: 'src-3', stage: 'source', Icon: Broadcast,  label: 'IoT Sensors',       desc: 'Vibration, temperature, pressure, GPS — any third-party sensor already deployed.', how: 'Vendor SDK or gateway forwards readings to our ingestion layer over your existing network.' },
  { id: 'src-4', stage: 'source', Icon: Database,   label: 'Legacy Databases',  desc: 'Historical data sitting in on-prem SQL/Oracle systems.', how: 'A one-time or scheduled sync backfills history so new KPIs have context from day one.' },
  { id: 'src-5', stage: 'source', Icon: Globe,      label: 'Third-Party APIs',  desc: 'Weather, market data, logistics partners — any external feed relevant to your KPIs.', how: 'Polled or subscribed to on a schedule and merged into the same processing pipeline.' },

  { id: 'ing-1', stage: 'ingest', Icon: ArrowsLeftRight, label: 'REST API',        desc: 'Simple request/response for systems that push data periodically.', how: 'Your system POSTs a JSON payload; we validate, authenticate and queue it instantly.' },
  { id: 'ing-2', stage: 'ingest', Icon: Waveform,         label: 'WebSocket',       desc: 'Persistent two-way connection for sub-second telemetry.', how: 'Keeps a live socket open so readings stream in as they happen — no polling delay.' },
  { id: 'ing-3', stage: 'ingest', Icon: Plug,             label: 'Webhook',         desc: 'Event-driven push from a system that already knows when something changed.', how: 'You call our endpoint the moment an event fires; we handle retries and ordering.' },
  { id: 'ing-4', stage: 'ingest', Icon: WifiHigh,         label: 'MQTT',            desc: 'The standard for lightweight IoT messaging at scale.', how: 'Devices publish to topics; our broker subscribes and forwards into the pipeline.' },
  { id: 'ing-5', stage: 'ingest', Icon: GitBranch,        label: 'Kafka Connector', desc: 'A direct tap into a Kafka cluster you already run.', how: 'We consume your existing topics — no re-architecture of your streaming layer.' },
  { id: 'ing-6', stage: 'ingest', Icon: Queue,            label: 'Message Queue',   desc: 'SQS, RabbitMQ or similar, when you need guaranteed delivery.', how: 'We consume from your queue at whatever rate you produce, with built-in backpressure handling.' },
  { id: 'ing-7', stage: 'ingest', Icon: ArrowsClockwise,  label: 'HTTPS Polling',   desc: 'For systems that can only be read, not subscribed to.', how: 'We poll on an interval you define and only process what has actually changed.' },

  { id: 'proc-1', stage: 'process', Icon: Funnel,      label: 'Parsing & Validation',   desc: 'Turns raw, inconsistent payloads into clean structured records.', how: 'Schema checks, unit conversion and de-duplication happen before anything else touches the data.' },
  { id: 'proc-2', stage: 'process', Icon: ChartLineUp, label: 'KPI Computation',        desc: 'Your business logic — OEE, health score, fraud score, whatever matters to you.', how: 'Runs as a stream-processing job per asset type, computed the instant new data arrives.' },
  { id: 'proc-3', stage: 'process', Icon: Bell,         label: 'Alert Engine',          desc: 'Threshold and condition rules that fire the moment something is wrong.', how: 'Rules are configured per KPI — no redeploy needed to add or change a threshold.' },
  { id: 'proc-4', stage: 'process', Icon: Warning,      label: 'Anomaly Detection',     desc: 'Catches issues plain thresholds miss.', how: 'Statistical or model-based scoring flags deviations from normal behavior in real time.' },
  { id: 'proc-5', stage: 'process', Icon: Sparkle,      label: 'Data Enrichment',       desc: 'Adds context raw sensor data does not have.', how: 'Joins live readings with asset metadata, location, or external reference data.' },
  { id: 'proc-6', stage: 'process', Icon: Stack,        label: 'Aggregation & Windowing', desc: 'Rolls up high-frequency data into the time windows your reports need.', how: '1-minute, hourly or daily rollups computed continuously, not batched overnight.' },

  { id: 'out-1', stage: 'output', Icon: Monitor,         label: 'Web Dashboard',      desc: 'What your team looks at all day.', how: 'REST snapshot + WebSocket push straight into this app — no polling delay.' },
  { id: 'out-2', stage: 'output', Icon: DeviceMobile,    label: 'Mobile App',         desc: 'Same data, on the floor or on the road.', how: 'Same Insights API — a native or PWA client subscribes just like the web dashboard.' },
  { id: 'out-3', stage: 'output', Icon: CloudArrowUp,    label: 'Data Lake / Warehouse', desc: 'For BI tools and long-term analysis.', how: 'Processed events land in S3, BigQuery or Snowflake on a schedule you control.' },
  { id: 'out-4', stage: 'output', Icon: Database,        label: 'Relational Database', desc: 'For systems that expect a plain SQL table.', how: 'We write processed records into Postgres/MySQL on your own infrastructure.' },
  { id: 'out-5', stage: 'output', Icon: ArrowsOut,       label: 'Downstream System',  desc: 'Feed insights back into the system of record.', how: 'An outbound webhook or API call triggers your ERP/MES workflow automatically.' },
  { id: 'out-6', stage: 'output', Icon: PlugsConnected,  label: 'Custom Connector',   desc: 'Anything not listed above.', how: 'We build a purpose-built output adapter for your specific destination.' },
];

const STAGES = ['source', 'ingest', 'process', 'output'];

function NodeChip({ node, isSelected, onClick }) {
  const meta = STAGE_META[node.stage];
  const Icon = node.Icon;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        textAlign: 'left', width: '100%', cursor: 'pointer',
        padding: '9px 11px', borderRadius: 9,
        background: isSelected ? meta.bg : '#121a2e',
        border: `1px solid ${isSelected ? meta.border : '#23304d'}`,
        color: isSelected ? '#e6eaf2' : '#a9b3cc',
        fontSize: 12, fontWeight: isSelected ? 700 : 500,
        transition: 'all 0.12s',
      }}
    >
      <Icon size={15} weight={isSelected ? 'fill' : 'regular'} color={isSelected ? meta.color : '#6b7796'} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
    </button>
  );
}

export default function Architecture({ onBack }) {
  const [selectedId, setSelectedId] = useState('src-1');
  const { isMobile } = useWindowSize();
  const selected = NODES.find(n => n.id === selectedId) ?? NODES[0];
  const selectedMeta = STAGE_META[selected.stage];

  return (
    <div style={{
      minHeight: '100%', width: '100%', boxSizing: 'border-box',
      background: '#0b1220', color: '#e6eaf2',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      padding: isMobile ? '20px 16px 48px' : '28px 40px 56px',
    }}>

      <div style={{ maxWidth: 900, marginBottom: 8 }}>
        <span style={{
          display: 'inline-block', padding: '5px 12px', borderRadius: 20,
          background: 'rgba(37,125,240,0.12)', border: '1px solid rgba(37,125,240,0.3)',
          color: '#5b9cf5', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 16,
        }}>
          FOR TECHNICAL &amp; PROCUREMENT TEAMS
        </span>
        <h1 style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}>
          Where Condense sits in your landscape
        </h1>
        <p style={{ fontSize: 13.5, color: '#8b96b3', lineHeight: 1.65, margin: 0 }}>
          Four stages, start to finish. Click any block below to see exactly what it does and how it works &mdash;
          every label here is a placeholder we tailor to your actual systems in the conversation.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '20px 0' }}>
        <ArrowsLeftRight size={13} color="#5b9cf5" />
        <span style={{ fontSize: 11.5, color: '#5b9cf5' }}>Click a block to see what it does</span>
      </div>

      {/* Stage headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, minmax(0,1fr))',
        gap: 12, marginBottom: 8,
      }}>
        {STAGES.map((s, i) => {
          const meta = STAGE_META[s];
          return (
            <div key={s} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 12px', borderRadius: 10,
              background: meta.bg,
              border: meta.dashed ? `1.5px dashed ${meta.border}` : `1px solid ${meta.border}`,
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                background: `${meta.color}30`, color: meta.color,
                fontSize: 10.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e6eaf2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.label}</span>
            </div>
          );
        })}
      </div>

      {/* Flow line with animated dot */}
      <div style={{ position: 'relative', height: 8, margin: '0 4px 18px' }}>
        <div style={{ position: 'absolute', top: 3, left: 0, right: 0, height: 2, background: '#1c2740' }} />
        <div style={{
          position: 'absolute', top: 0, width: 8, height: 8, borderRadius: '50%',
          background: '#5b9cf5', boxShadow: '0 0 10px rgba(91,156,245,0.85)',
          animation: 'condense-flow-dot 4s linear infinite',
        }} />
      </div>

      {/* Node columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, minmax(0,1fr))',
        gap: 14, marginBottom: 26,
      }}>
        {STAGES.map(s => (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {NODES.filter(n => n.stage === s).map(n => (
              <NodeChip key={n.id} node={n} isSelected={n.id === selectedId} onClick={() => setSelectedId(n.id)} />
            ))}
          </div>
        ))}
      </div>

      {/* Detail panel */}
      <div style={{
        background: '#121a2e', border: `1px solid ${selectedMeta.border}`,
        borderRadius: 16, padding: isMobile ? '20px' : '24px 28px',
        maxWidth: 1100, marginBottom: 30,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <selected.Icon size={16} color={selectedMeta.color} weight="fill" />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: '#5b6788', textTransform: 'uppercase' }}>
            {selectedMeta.label}
          </span>
        </div>
        <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: '#e6eaf2', marginBottom: 14 }}>
          {selected.label}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 22 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#5b9cf5', textTransform: 'uppercase', marginBottom: 6 }}>What it does</div>
            <div style={{ fontSize: 13, color: '#c3ccdf', lineHeight: 1.6 }}>{selected.desc}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#5b9cf5', textTransform: 'uppercase', marginBottom: 6 }}>How it works</div>
            <div style={{ fontSize: 13, color: '#c3ccdf', lineHeight: 1.6 }}>{selected.how}</div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0,1fr))',
        gap: 16, maxWidth: 1100,
      }}>
        <div style={{ background: '#121a2e', border: '1px solid #23304d', borderRadius: 14, padding: 20 }}>
          <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 14.5, fontWeight: 700, marginBottom: 8 }}>Deploys in your cloud or ours</div>
          <div style={{ fontSize: 12, color: '#8b96b3', lineHeight: 1.6 }}>Containerized services &mdash; your VPC, on-prem, or our managed cloud.</div>
        </div>
        <div style={{ background: '#121a2e', border: '1px solid #23304d', borderRadius: 14, padding: 20 }}>
          <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 14.5, fontWeight: 700, marginBottom: 8 }}>Zero changes to your sensors</div>
          <div style={{ fontSize: 12, color: '#8b96b3', lineHeight: 1.6 }}>We integrate at the ingestion layer &mdash; your PLCs, SCADA and ERP keep running exactly as they do today.</div>
        </div>
        <div style={{ background: '#121a2e', border: '1px solid #23304d', borderRadius: 14, padding: 20 }}>
          <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 14.5, fontWeight: 700, marginBottom: 8 }}>Every block is relabelable</div>
          <div style={{ fontSize: 12, color: '#8b96b3', lineHeight: 1.6 }}>Before a client meeting we swap these names for their actual stack &mdash; same diagram, their language.</div>
        </div>
      </div>

      <style>{`
        @keyframes condense-flow-dot {
          0%   { left: 0%; }
          100% { left: calc(100% - 8px); }
        }
      `}</style>
    </div>
  );
}
