// src/config/industries.js
// Central registry of all 9 industry verticals.
//
// apiUrl  — set VITE_*_API_URL in .env.local (or Vercel env vars) to your
//           Condense ingress URL once that pipeline is deployed.
//           Format: https://<app>.condense.zeliot.in
//
// ready   — true means the dashboard component exists in /src/industries/
//           The dashboard shows "Connecting…" if apiUrl is not set.

export const INDUSTRIES = {

  energy: {
    id:          'energy',
    name:        'Renewable Energy & Utilities',
    shortName:   'Energy',
    description: 'Wind turbines, solar farms, SCADA sensors, smart meters',
    icon:        '⚡',
    color:       '#22c55e',
    colorMuted:  '#bbf7d0',
    apiUrl:      import.meta.env.VITE_ENERGY_API_URL || '',
    ready:       true,
    assetTypes:  ['wind_turbine', 'solar_farm', 'scada_sensor', 'smart_meter'],
  },

  ev: {
    id:          'ev',
    name:        'Electric Vehicles & Connected Mobility',
    shortName:   'EV & Mobility',
    description: 'Battery SOC, charging queues, telematics, fleet health',
    icon:        '🚗',
    color:       '#3b82f6',
    colorMuted:  '#bfdbfe',
    apiUrl:      import.meta.env.VITE_EV_API_URL || '',
    ready:       true,
    assetTypes:  ['ev', 'charging_station'],
  },

  automotive: {
    id:          'automotive',
    name:        'Automotive & Telematics',
    shortName:   'Automotive',
    description: 'OBD2, GPS tracking, CAN bus, fleet diagnostics',
    icon:        '🔧',
    color:       '#f59e0b',
    colorMuted:  '#fde68a',
    apiUrl:      import.meta.env.VITE_AUTO_API_URL || '',
    ready:       true,
    assetTypes:  ['vehicle', 'truck'],
  },

  aviation: {
    id:          'aviation',
    name:        'Airports & Aviation',
    shortName:   'Aviation',
    description: 'Gate status, flight ops, baggage, turnaround analytics',
    icon:        '✈️',
    color:       '#06b6d4',
    colorMuted:  '#a5f3fc',
    apiUrl:      import.meta.env.VITE_AVIATION_API_URL || '',
    ready:       true,
    assetTypes:  ['flight', 'gate', 'runway', 'baggage'],
  },

  manufacturing: {
    id:          'manufacturing',
    name:        'Smart Manufacturing / IIoT',
    shortName:   'Manufacturing',
    description: 'Machine sensors, OEE, cement kilns, vibration & predictive maintenance',
    icon:        '🏭',
    color:       '#8b5cf6',
    colorMuted:  '#ddd6fe',
    apiUrl:      import.meta.env.VITE_MFG_API_URL || '',
    ready:       true,
    assetTypes:  ['cnc_machine', 'conveyor', 'robot_arm', 'env_sensor', 'quality_station', 'cement_kiln', 'cement_mill', 'rotary_equipment'],
  },

  logistics: {
    id:          'logistics',
    name:        'Logistics & Supply Chain',
    shortName:   'Logistics',
    description: 'GPS tracking, cold chain, SLA monitoring, fleet',
    icon:        '📦',
    color:       '#f97316',
    colorMuted:  '#fed7aa',
    apiUrl:      import.meta.env.VITE_LOGISTICS_API_URL || '',
    ready:       true,
    assetTypes:  ['truck', 'van', 'warehouse', 'cold_chain', 'shipment'],
  },

  bfsi: {
    id:          'bfsi',
    name:        'BFSI / Fintech',
    shortName:   'BFSI',
    description: 'Transaction streams, fraud scoring, latency analytics, ATM',
    icon:        '🏦',
    color:       '#10b981',
    colorMuted:  '#a7f3d0',
    apiUrl:      import.meta.env.VITE_BFSI_API_URL || '',
    ready:       true,
    assetTypes:  ['transaction_stream', 'atm', 'branch'],
  },

  retail: {
    id:          'retail',
    name:        'Retail & E-commerce',
    shortName:   'Retail',
    description: 'Footfall, checkout queues, inventory, conversion analytics',
    icon:        '🛒',
    color:       '#ec4899',
    colorMuted:  '#fbcfe8',
    apiUrl:      import.meta.env.VITE_RETAIL_API_URL || '',
    ready:       true,
    assetTypes:  ['store_zone', 'checkout', 'inventory_sensor', 'digital_platform'],
  },

  healthcare: {
    id:          'healthcare',
    name:        'Healthcare / Medical IoT',
    shortName:   'Healthcare',
    description: 'Vitals monitoring, ventilators, infusion pumps, patient alerts',
    icon:        '🏥',
    color:       '#ef4444',
    colorMuted:  '#fecaca',
    apiUrl:      import.meta.env.VITE_HEALTH_API_URL || '',
    ready:       true,
    assetTypes:  ['patient_monitor', 'ventilator', 'infusion_pump', 'bed_sensor'],
  },

  stockexchange: {
    id:          'stockexchange',
    name:        'Stock Exchange & Capital Markets',
    shortName:   'Stock Exchange',
    description: 'Equities, indices, RSI, VWAP, volatility — BVRD Dominican Republic',
    icon:        '📈',
    color:       '#6366f1',
    colorMuted:  '#c7d2fe',
    apiUrl:      import.meta.env.VITE_STOCKEXCHANGE_API_URL || '',
    ready:       true,
    assetTypes:  ['stock', 'market_index', 'sector_basket'],
  },

  travel: {
    id:          'travel',
    name:        'Travel & Hospitality',
    shortName:   'Travel & Hotels',
    description: 'Hotel rooms, F&B outlets, spa, guest feedback — Viva Resorts',
    icon:        '🏨',
    color:       '#10b981',
    colorMuted:  '#a7f3d0',
    apiUrl:      import.meta.env.VITE_TRAVEL_API_URL || '',
    ready:       true,
    assetTypes:  ['hotel_room', 'fnb_outlet', 'spa_service', 'guest_feedback', 'facility'],
  },

};

export const INDUSTRY_LIST = Object.values(INDUSTRIES);
