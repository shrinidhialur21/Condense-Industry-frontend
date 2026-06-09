// src/hooks/useCondenseWS.js
// Reusable WebSocket hook that connects to App 3 (Insights API) on Condense.
// Handles: auto-connect, reconnect on drop, snapshot on connect,
//          incoming asset_update and alert events.

import { useState, useEffect, useRef, useCallback } from 'react';

const RECONNECT_DELAY_MS = 3000;
const MAX_ALERTS         = 100;

/**
 * @param {string} apiUrl  - Base URL of Insights API, e.g. http://localhost:3002
 *                           or https://your-ingress.condense.zeliot.in
 */
export function useCondenseWS(apiUrl) {
  const [status,     setStatus]     = useState('disconnected'); // connecting | connected | disconnected | error
  const [assets,     setAssets]     = useState({});
  const [alerts,     setAlerts]     = useState([]);
  const [stats,      setStats]      = useState(null);
  const [aggregates, setAggregates] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  const wsRef      = useRef(null);
  const reconnRef  = useRef(null);
  const mountedRef = useRef(true);

  // Convert http(s):// → ws(s)://
  const wsUrl = apiUrl
    ? apiUrl.replace(/^http/, 'ws') + '/ws'
    : null;

  const connect = useCallback(() => {
    if (!wsUrl || !mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('connected');
      clearTimeout(reconnRef.current);
      console.log('[WS] Connected to', wsUrl);
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      setLastUpdate(Date.now());

      if (msg.type === 'snapshot') {
        const { assets: a, alerts: al, stats: s, aggregates: ag } = msg.data;
        setAssets(a || {});
        setAlerts((al || []).slice(-MAX_ALERTS));
        setStats(s || null);
        setAggregates(ag || {});
      }

      if (msg.type === 'asset_update') {
        setAssets(prev => {
          const incoming = msg.data;
          const existing = prev[incoming.asset_id] || {};

          // ── Commercial vehicles come from TWO transforms (VLD + Driver Analytics).
          // Each broadcast carries only ONE transform's KPIs, but we need BOTH visible
          // simultaneously. Merge KPIs instead of replacing, so neither source overwrites
          // the other. Once both transforms have published for a given batch, the merged
          // record will have the full set (rsli + driver_score + everything).
          if (incoming.asset_type === 'commercial_vehicle') {
            return {
              ...prev,
              [incoming.asset_id]: {
                ...existing,
                ...incoming,
                // Deep-merge KPIs — accumulate from both VLD and Driver Analytics
                kpis: { ...(existing.kpis || {}), ...(incoming.kpis || {}) },
                // Track which transforms have contributed to this record
                sources: [...new Set([
                  ...(existing.sources || []),
                  ...(incoming.sources || []),
                  incoming.source || '',
                ].filter(Boolean))],
              },
            };
          }

          // All other asset types: normal replace (single transform, no merge needed)
          return { ...prev, [incoming.asset_id]: incoming };
        });
        if (msg.data.has_alerts) {
          setStats(prev => prev ? { ...prev, last_updated: msg.data.processed_at } : prev);
        }
      }

      if (msg.type === 'alert') {
        setAlerts(prev => {
          const next = [...prev, msg.data];
          return next.slice(-MAX_ALERTS);
        });
        setStats(prev => prev ? { ...prev, total_alerts: (prev.total_alerts || 0) + 1 } : prev);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      console.log('[WS] Disconnected, reconnecting in', RECONNECT_DELAY_MS, 'ms...');
      reconnRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setStatus('error');
    };
  }, [wsUrl]);

  useEffect(() => {
    mountedRef.current = true;
    if (!apiUrl) return;

    // Try REST snapshot first (works even if WS isn't supported)
    fetch(`${apiUrl}/api/snapshot`)
      .then(r => r.json())
      .then(data => {
        if (!mountedRef.current) return;
        setAssets(data.assets || {});
        setAlerts((data.alerts || []).slice(-MAX_ALERTS));
        setStats(data.stats || null);
        setAggregates(data.aggregates || {});
      })
      .catch(() => {}); // silent — WS will cover it

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [apiUrl, connect]);

  // Manual refresh via REST
  const refresh = useCallback(async () => {
    if (!apiUrl) return;
    try {
      const data = await fetch(`${apiUrl}/api/snapshot`).then(r => r.json());
      setAssets(data.assets || {});
      setAlerts((data.alerts || []).slice(-MAX_ALERTS));
      setStats(data.stats || null);
      setAggregates(data.aggregates || {});
    } catch (err) {
      console.error('[REST] refresh failed:', err);
    }
  }, [apiUrl]);

  return { status, assets, alerts, stats, aggregates, lastUpdate, refresh };
}