// src/hooks/usePlatformHealth.js
// Polls all configured industry output-connector APIs for health, stats, and uptime data.
// Used exclusively by the Platform Health dashboard.
//
// Poll interval : 30 seconds
// Timeout       : 5 seconds per endpoint
// Tracked per pipeline:
//   - HTTP status (live / stale / offline / unconfigured)
//   - Response time (ms)
//   - uptime_s from /health
//   - ws_clients from /health
//   - total_messages, total_alerts, assets_online, last_updated from /api/stats
//   - freshness_s  = seconds since last_updated
//   - uptime_pct   = successful_polls / total_polls × 100 (session-level)
//   - sla_ok       = uptime_pct >= 99.9

import { useState, useEffect, useRef, useCallback } from 'react';
import { INDUSTRIES } from '../config/industries.js';

const POLL_INTERVAL_MS = 30_000;  // 30 s
const FETCH_TIMEOUT_MS  = 5_000;  // 5 s
const MAX_HISTORY       = 40;     // chart data points

// Threshold (seconds since last_updated) for "stale" vs "live"
const STALE_THRESHOLD_S = 60;

// SLA target for industry-grade streaming platform
export const SLA_TARGET_PCT = 99.9;

// ── Helper: safe fetch with timeout ──────────────────────────────────────────
async function safeFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── Poll a single pipeline ────────────────────────────────────────────────────
async function pollPipeline(industry) {
  if (!industry.apiUrl) {
    return {
      id          : industry.id,
      status      : 'unconfigured',
      error       : 'No API URL configured',
      responseTime: null,
    };
  }

  const t0 = Date.now();
  try {
    const [health, stats] = await Promise.all([
      safeFetch(`${industry.apiUrl}/health`,     FETCH_TIMEOUT_MS),
      safeFetch(`${industry.apiUrl}/api/stats`,  FETCH_TIMEOUT_MS),
    ]);

    const responseTime  = Date.now() - t0;
    const lastUpdated   = stats.last_updated ? new Date(stats.last_updated) : null;
    const freshnessS    = lastUpdated ? (Date.now() - lastUpdated.getTime()) / 1000 : null;
    const isLive        = freshnessS != null && freshnessS < STALE_THRESHOLD_S;

    return {
      id            : industry.id,
      status        : isLive ? 'live' : 'stale',
      responseTime,
      // From /health
      ws_clients    : health.ws_clients    ?? 0,
      uptime_s      : health.uptime_s      ?? null,
      app_status    : health.status        ?? 'unknown',
      // From /api/stats
      total_messages: stats.total_messages ?? 0,
      total_alerts  : stats.total_alerts   ?? 0,
      assets_online : typeof stats.assets_online === 'number'
                        ? stats.assets_online
                        : (stats.assets_online?.size ?? Object.keys(stats.assets_online ?? {}).length ?? 0),
      last_updated  : stats.last_updated   ?? null,
      freshness_s   : freshnessS,
      error         : null,
    };
  } catch (err) {
    return {
      id          : industry.id,
      status      : 'offline',
      responseTime: Date.now() - t0,
      error       : err.message || 'Request failed',
    };
  }
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function usePlatformHealth() {
  const [pipelines,   setPipelines]   = useState([]);
  const [history,     setHistory]     = useState([]);   // throughput history for chart
  const [loading,     setLoading]     = useState(true);
  const [lastChecked, setLastChecked] = useState(null);

  // Session-level uptime tracking (resets on page reload)
  // { [id]: { checks: number, successes: number, first_seen: number } }
  const trackingRef  = useRef({});
  const mountedRef   = useRef(true);
  const prevMsgRef   = useRef({});  // previous total_messages per pipeline for delta

  const poll = useCallback(async () => {
    const industries = Object.values(INDUSTRIES);
    const results    = await Promise.all(industries.map(pollPipeline));

    if (!mountedRef.current) return;

    const now     = Date.now();
    const nowISO  = new Date(now).toISOString();

    // Update per-pipeline uptime tracking
    results.forEach(r => {
      if (!trackingRef.current[r.id]) {
        trackingRef.current[r.id] = { checks: 0, successes: 0, first_seen: now };
      }
      const t = trackingRef.current[r.id];
      t.checks++;
      if (r.status === 'live' || r.status === 'stale') t.successes++;
    });

    // Enrich results with session-level uptime_pct + SLA status
    const enriched = results.map(r => {
      const t          = trackingRef.current[r.id];
      const uptime_pct = t.checks > 0
        ? parseFloat((t.successes / t.checks * 100).toFixed(3)) : null;
      const session_uptime_min = t.first_seen
        ? parseFloat(((now - t.first_seen) / 60000).toFixed(1)) : 0;

      // Messages-per-30s delta
      const prevMsg = prevMsgRef.current[r.id] ?? 0;
      const msgDelta = (r.total_messages ?? 0) - prevMsg;
      prevMsgRef.current[r.id] = r.total_messages ?? 0;

      return {
        ...r,
        uptime_pct,
        sla_ok         : uptime_pct != null ? uptime_pct >= SLA_TARGET_PCT : null,
        session_checks : t.checks,
        session_uptime_min,
        msg_delta_30s  : msgDelta > 0 ? msgDelta : 0,
        // msg/s approximate from 30s window
        msg_per_sec    : msgDelta > 0 ? parseFloat((msgDelta / 30).toFixed(1)) : 0,
      };
    });

    setPipelines(enriched);
    setLastChecked(nowISO);
    setLoading(false);

    // Build history point for throughput chart
    const totalMsgs  = enriched.reduce((s, p) => s + (p.total_messages ?? 0), 0);
    const livePipes  = enriched.filter(p => p.status === 'live').length;
    const totalDelta = enriched.reduce((s, p) => s + (p.msg_delta_30s ?? 0), 0);
    setHistory(prev => {
      const next = [...prev, {
        time       : new Date(now).toLocaleTimeString('en', { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' }),
        total_msgs : totalMsgs,
        live_pipes : livePipes,
        msg_delta  : totalDelta,
      }];
      return next.slice(-MAX_HISTORY);
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [poll]);

  // ── Derived summary ───────────────────────────────────────────────────────
  const summary = {
    total_pipelines     : pipelines.length,
    live                : pipelines.filter(p => p.status === 'live').length,
    stale               : pipelines.filter(p => p.status === 'stale').length,
    offline             : pipelines.filter(p => p.status === 'offline').length,
    unconfigured        : pipelines.filter(p => p.status === 'unconfigured').length,
    deployed            : pipelines.filter(p => p.status !== 'unconfigured').length,
    total_messages      : pipelines.reduce((s, p) => s + (p.total_messages ?? 0), 0),
    total_alerts        : pipelines.reduce((s, p) => s + (p.total_alerts ?? 0), 0),
    total_assets        : pipelines.reduce((s, p) => s + (p.assets_online ?? 0), 0),
    total_ws_clients    : pipelines.reduce((s, p) => s + (p.ws_clients ?? 0), 0),
    total_msg_per_sec   : parseFloat(pipelines.reduce((s, p) => s + (p.msg_per_sec ?? 0), 0).toFixed(1)),
    avg_freshness_s     : (() => {
      const fresh = pipelines.filter(p => p.freshness_s != null && p.freshness_s < 300);
      return fresh.length ? parseFloat((fresh.reduce((s, p) => s + p.freshness_s, 0) / fresh.length).toFixed(1)) : null;
    })(),
    avg_response_ms     : (() => {
      const resp = pipelines.filter(p => p.responseTime != null);
      return resp.length ? Math.round(resp.reduce((s, p) => s + p.responseTime, 0) / resp.length) : null;
    })(),
    // Overall status classification
    overall_status      : (() => {
      const dep = pipelines.filter(p => p.status !== 'unconfigured');
      if (dep.length === 0) return 'no_pipelines';
      const liveRatio = dep.filter(p => p.status === 'live').length / dep.length;
      if (liveRatio === 1) return 'operational';
      if (liveRatio >= 0.8) return 'degraded';
      if (liveRatio >= 0.5) return 'partial_outage';
      return 'major_outage';
    })(),
    // Platform-wide uptime_pct (avg of deployed pipelines)
    platform_uptime_pct : (() => {
      const valid = pipelines.filter(p => p.uptime_pct != null);
      return valid.length ? parseFloat((valid.reduce((s, p) => s + p.uptime_pct, 0) / valid.length).toFixed(3)) : null;
    })(),
  };

  return { pipelines, summary, history, loading, lastChecked, refresh: poll };
}
