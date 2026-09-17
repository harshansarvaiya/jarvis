'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Radio,
  ShieldAlert,
  Activity,
  Zap,
  Search,
  RefreshCw,
  ExternalLink,
  Anchor,
  Compass,
  Layers,
  AlertTriangle,
  Lock,
  Cpu,
} from 'lucide-react';
import { formatShortISTTime } from '@/lib/jarvis/time';

interface EarthquakeEvent {
  id: string;
  mag: number;
  place: string;
  time: number;
  tsunami: number;
  depthKm: number;
  lat: number;
  lon: number;
}

interface SpaceAlert {
  productId: string;
  issueTime: string;
  message: string;
}

interface Chokepoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  status: 'NORMAL' | 'ELEVATED_WATCH' | 'HIGH_ALERT';
  transitShare: string;
}

export function TacticalRadar() {
  const [activeLayer, setActiveLayer] = useState<'SEISMIC' | 'SPACE' | 'MARITIME' | 'OSINT_RECON'>('SEISMIC');
  const [earthquakes, setEarthquakes] = useState<EarthquakeEvent[]>([]);
  const [spaceAlerts, setSpaceAlerts] = useState<SpaceAlert[]>([]);
  const [chokepoints, setChokepoints] = useState<Chokepoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('CONNECTING');

  // OSINT Console State
  const [osintType, setOsintType] = useState<'CVE' | 'CRYPTO' | 'IP'>('CVE');
  const [osintQuery, setOsintQuery] = useState<string>('spring-boot');
  const [osintLoading, setOsintLoading] = useState<boolean>(false);
  const [osintResult, setOsintResult] = useState<any>(null);

  const fetchRadarData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/jarvis/radar');
      if (res.ok) {
        const data = await res.json();
        setEarthquakes(data.feeds?.earthquakes?.items || []);
        setSpaceAlerts(data.feeds?.spaceWeather?.items || []);
        setChokepoints(data.feeds?.maritimeChokepoints?.items || []);
        setLastRefreshed(formatShortISTTime(data.timestamp));
      }
    } catch (err) {
      console.warn('[Radar] Data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRadarData();
    const interval = setInterval(fetchRadarData, 60000); // 60s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const handleRunOsint = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!osintQuery.trim()) return;

    setOsintLoading(true);
    setOsintResult(null);

    const actionMap = {
      CVE: 'cve_scan',
      CRYPTO: 'crypto_sanctions',
      IP: 'ip_recon',
    };

    try {
      const res = await fetch('/api/jarvis/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionMap[osintType],
          query: osintQuery.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOsintResult(data.report || data);
      }
    } catch (err) {
      console.warn('[OSINT] Lookup error:', err);
    } finally {
      setOsintLoading(false);
    }
  };

  // Convert lat/lon to percentage coordinates on 2D map projection
  const projectCoordinates = (lat: number, lon: number) => {
    const x = ((lon + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x: Math.max(2, Math.min(98, x)), y: Math.max(5, Math.min(95, y)) };
  };

  const criticalCount = useMemo(() => {
    return earthquakes.filter((e) => e.mag >= 6.0).length;
  }, [earthquakes]);

  return (
    <div className="flex-1 flex flex-col space-y-3 min-h-0 font-mono text-xs pb-4">
      {/* 1. TOP HEADER & TELEMETRY STRIP */}
      <div className="border border-cyan-500/30 bg-hud-glass rounded-xl p-3 shadow-lg flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="relative flex items-center justify-center">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          </div>
          <div>
            <div className="font-bold text-cyan-300 tracking-wider flex items-center space-x-1.5">
              <span>TACTICAL SITUATIONAL RADAR</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
                OSIRIS V2
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Synced: <span className="text-cyan-400">{lastRefreshed}</span> • Auto-sweep: <span className="text-emerald-400">60s</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {criticalCount > 0 && (
            <div className="flex items-center space-x-1 px-2 py-1 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 animate-pulse text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{criticalCount} CRITICAL ANOMALIES</span>
            </div>
          )}
          <button
            onClick={fetchRadarData}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-white transition-all disabled:opacity-50"
            title="Force Sweep"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. LAYER CONTROLS */}
      <div className="flex border border-cyan-500/30 rounded-lg p-1 bg-slate-950/90 gap-1 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveLayer('SEISMIC')}
          className={`flex-1 min-w-[90px] py-1.5 px-2 rounded flex items-center justify-center space-x-1.5 transition-colors ${
            activeLayer === 'SEISMIC'
              ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>SEISMIC ({earthquakes.length})</span>
        </button>
        <button
          onClick={() => setActiveLayer('SPACE')}
          className={`flex-1 min-w-[90px] py-1.5 px-2 rounded flex items-center justify-center space-x-1.5 transition-colors ${
            activeLayer === 'SPACE'
              ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>SPACE WX ({spaceAlerts.length})</span>
        </button>
        <button
          onClick={() => setActiveLayer('MARITIME')}
          className={`flex-1 min-w-[90px] py-1.5 px-2 rounded flex items-center justify-center space-x-1.5 transition-colors ${
            activeLayer === 'MARITIME'
              ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Anchor className="w-3.5 h-3.5" />
          <span>NAVAL CHOKEPOINTS ({chokepoints.length})</span>
        </button>
        <button
          onClick={() => setActiveLayer('OSINT_RECON')}
          className={`flex-1 min-w-[90px] py-1.5 px-2 rounded flex items-center justify-center space-x-1.5 transition-colors ${
            activeLayer === 'OSINT_RECON'
              ? 'bg-amber-400 text-black font-bold shadow-[0_0_10px_rgba(251,191,36,0.4)]'
              : 'text-amber-400/80 hover:text-amber-300 hover:bg-slate-900'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>CYBER RECON</span>
        </button>
      </div>

      {/* 3. 2D VECTOR RADAR MAP PROJECTION */}
      <div className="relative w-full h-36 sm:h-44 bg-slate-950/95 border border-cyan-500/30 rounded-xl overflow-hidden shadow-inner flex flex-col justify-between p-2 shrink-0">
        {/* Radar Background Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00e5ff0a_1px,transparent_1px),linear-gradient(to_bottom,#00e5ff0a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        {/* Animated Radar Sweep */}
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,rgba(0,229,255,0.12)_0deg,transparent_60deg)] animate-[spin_6s_linear_infinite] pointer-events-none rounded-xl" />

        {/* Global Continental Outlines (Abstract Vector Mesh) */}
        <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none stroke-cyan-500/40 fill-none" viewBox="0 0 360 180">
          <path d="M 50,40 Q 70,25 90,45 T 130,50 L 110,90 Q 90,100 70,80 Z" />
          <path d="M 180,30 Q 230,20 280,40 T 320,80 Q 270,100 220,70 Z" />
          <path d="M 170,80 Q 200,90 200,130 Q 180,150 160,110 Z" />
          <path d="M 280,120 Q 320,110 330,140 Q 290,160 280,120 Z" />
          <circle cx="180" cy="90" r="85" strokeDasharray="3 3" />
        </svg>

        {/* Live Nodes Layer */}
        {activeLayer === 'SEISMIC' &&
          earthquakes.map((eq) => {
            const pos = projectCoordinates(eq.lat, eq.lon);
            const isSevere = eq.mag >= 6.0;
            return (
              <div
                key={eq.id}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isSevere
                      ? 'bg-rose-500 animate-ping'
                      : eq.mag >= 5.0
                      ? 'bg-amber-400'
                      : 'bg-cyan-400'
                  }`}
                />
                <div
                  className={`absolute -top-1 -left-1 w-4.5 h-4.5 rounded-full border border-dashed ${
                    isSevere ? 'border-rose-400 animate-spin' : 'border-cyan-400/60'
                  }`}
                />
                {/* Tooltip on Hover */}
                <div className="hidden group-hover:block absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-950 border border-cyan-500 p-1.5 rounded text-[10px] text-cyan-200 whitespace-nowrap shadow-xl">
                  M{eq.mag.toFixed(1)} — {eq.place} ({eq.depthKm.toFixed(0)}km depth)
                </div>
              </div>
            );
          })}

        {activeLayer === 'MARITIME' &&
          chokepoints.map((cp) => {
            const pos = projectCoordinates(cp.lat, cp.lon);
            const isHighAlert = cp.status === 'HIGH_ALERT';
            return (
              <div
                key={cp.id}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
              >
                <Anchor
                  className={`w-3.5 h-3.5 ${
                    isHighAlert ? 'text-rose-400 animate-bounce' : 'text-amber-400'
                  }`}
                />
                <div className="hidden group-hover:block absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-950 border border-amber-500 p-1.5 rounded text-[10px] text-amber-200 whitespace-nowrap shadow-xl">
                  {cp.name} ({cp.transitShare})
                </div>
              </div>
            );
          })}

        {/* Map Corner Telemetry Metadata */}
        <div className="z-10 text-[10px] text-cyan-400/70 uppercase tracking-widest flex items-center justify-between">
          <span className="flex items-center space-x-1">
            <Compass className="w-3 h-3 text-cyan-400" />
            <span>GLOBAL SITUATIONAL PROJECTION // WGS-84</span>
          </span>
          <span className="text-slate-400">LAT: 0°00&apos;N LON: 0°00&apos;E</span>
        </div>

        <div className="z-10 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Critical (M≥6.0)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Elevated (M≥5.0)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Moderate</span>
            </span>
          </div>
          <span className="text-cyan-300">GPU ACCELERATED</span>
        </div>
      </div>

      {/* 4. DYNAMIC FEED PANEL & OSINT CONSOLE */}
      <div className="border border-cyan-500/20 bg-hud-glass rounded-xl p-3 shadow-lg flex-1 min-h-[280px] flex flex-col space-y-2">
        {/* ======================= */}
        {/* VIEW A: SEISMIC FEED    */}
        {/* ======================= */}
        {activeLayer === 'SEISMIC' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-[11px] font-bold text-cyan-300 mb-2 flex items-center justify-between shrink-0">
              <span>LIVE USGS SEISMIC ACTIVITY (LAST 24 HOURS)</span>
              <span className="text-slate-400 text-[10px]">{earthquakes.length} Events Detected</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {earthquakes.length === 0 && !isLoading && (
                <div className="text-center py-6 text-slate-400 text-xs">No significant seismic events recorded in current window.</div>
              )}
              {earthquakes.map((eq) => (
                <div
                  key={eq.id}
                  className={`p-2 rounded-lg border transition-all flex items-center justify-between ${
                    eq.mag >= 6.0
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : eq.mag >= 5.0
                      ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                      : 'bg-slate-900/60 border-cyan-500/20 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs shrink-0 ${
                        eq.mag >= 6.0 ? 'bg-rose-600 text-white' : eq.mag >= 5.0 ? 'bg-amber-500 text-black' : 'bg-cyan-950 border border-cyan-500/50 text-cyan-300'
                      }`}
                    >
                      M{eq.mag.toFixed(1)}
                    </div>
                    <div>
                      <div className="font-semibold text-xs leading-snug">{eq.place}</div>
                      <div className="text-[10px] text-slate-400">
                        Depth: {eq.depthKm.toFixed(1)} km • Time: {formatShortISTTime(eq.time)} IST
                      </div>
                    </div>
                  </div>
                  {eq.tsunami === 1 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 border border-rose-500 text-rose-400 uppercase font-bold animate-pulse shrink-0">
                      Tsunami Watch
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================= */}
        {/* VIEW B: SPACE WEATHER   */}
        {/* ======================= */}
        {activeLayer === 'SPACE' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-[11px] font-bold text-cyan-300 mb-2 flex items-center justify-between shrink-0">
              <span>NOAA SPACE WEATHER PREDICTION CENTER (SWPC)</span>
              <span className="text-slate-400 text-[10px]">{spaceAlerts.length} Active Bulletins</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {spaceAlerts.map((sa, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-900/80 border border-cyan-500/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-400 text-xs">{sa.productId}</span>
                    <span className="text-[10px] text-slate-400">{sa.issueTime} UTC</span>
                  </div>
                  <div className="text-[11px] text-slate-300 leading-relaxed">{sa.message}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================== */}
        {/* VIEW C: NAVAL CHOKEPOINTS   */}
        {/* =========================== */}
        {activeLayer === 'MARITIME' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-[11px] font-bold text-cyan-300 mb-2 flex items-center justify-between shrink-0">
              <span>STRATEGIC NAVAL & MARITIME CHOKEPOINTS</span>
              <span className="text-slate-400 text-[10px]">Global Trade Gateways</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {chokepoints.map((cp) => (
                <div
                  key={cp.id}
                  className={`p-2.5 rounded-lg border flex items-center justify-between ${
                    cp.status === 'HIGH_ALERT'
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                      : cp.status === 'ELEVATED_WATCH'
                      ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                      : 'bg-slate-900/70 border-cyan-500/20 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Anchor className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">{cp.name}</div>
                      <div className="text-[10px] text-slate-400">{cp.transitShare}</div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      cp.status === 'HIGH_ALERT'
                        ? 'bg-rose-900/80 text-rose-300 border border-rose-500/50'
                        : cp.status === 'ELEVATED_WATCH'
                        ? 'bg-amber-900/80 text-amber-300 border border-amber-500/50'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {cp.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================ */}
        {/* VIEW D: CYBER RECON & OSINT HUB  */}
        {/* ================================ */}
        {activeLayer === 'OSINT_RECON' && (
          <div className="flex-1 min-h-0 flex flex-col space-y-2">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-[11px] font-bold text-amber-300">OSIRIS RECON INVESTIGATION CONSOLE</span>
              <div className="flex gap-1 shrink-0">
                {(['CVE', 'CRYPTO', 'IP'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setOsintType(t);
                      setOsintQuery(t === 'CVE' ? 'spring-boot' : t === 'CRYPTO' ? '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b' : '1.1.1.1');
                      setOsintResult(null);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      osintType === t ? 'bg-amber-400 text-black' : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input Bar */}
            <form onSubmit={handleRunOsint} className="flex gap-1.5 shrink-0">
              <input
                type="text"
                value={osintQuery}
                onChange={(e) => setOsintQuery(e.target.value)}
                placeholder={
                  osintType === 'CVE'
                    ? 'Scan dependency (e.g. spring-boot, next, redis)...'
                    : osintType === 'CRYPTO'
                    ? 'Enter BTC / ETH wallet address...'
                    : 'Enter IP address or domain (e.g. 1.1.1.1)...'
                }
                className="flex-1 bg-slate-900/90 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs text-amber-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={osintLoading}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center space-x-1 disabled:opacity-50 transition-all shrink-0"
              >
                {osintLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>AUDIT</span>
              </button>
            </form>

            {/* OSINT Results Stream */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
              {osintLoading && (
                <div className="py-8 text-center text-amber-300/70 text-xs flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Connecting to global OSINT firehose...</span>
                </div>
              )}

              {osintResult && osintType === 'CVE' && (
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-400 flex items-center justify-between border-b border-amber-500/20 pb-1">
                    <span>Target: <strong>{osintResult.query}</strong></span>
                    <span>Total Found: <strong className="text-amber-300">{osintResult.totalFound}</strong></span>
                  </div>
                  {(osintResult.threats || []).map((t: any, idx: number) => (
                    <div key={idx} className="p-2 rounded bg-slate-900/90 border border-amber-500/30 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300">{t.id}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 border border-rose-500/40 text-rose-300 font-bold">
                          {t.severity || 'CRITICAL'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 leading-snug">{t.summary}</div>
                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>Source: {t.database}</span>
                        <span>Published: {t.published}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {osintResult && osintType === 'CRYPTO' && (
                <div className="space-y-2 p-2.5 rounded bg-slate-900/90 border border-amber-500/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">OFAC SANCTIONS SCAN</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        osintResult.isSanctionedOrFlagged ? 'bg-rose-900 text-rose-200 border border-rose-500' : 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                      }`}
                    >
                      {osintResult.threatLevel}
                    </span>
                  </div>
                  {osintResult.flags?.length > 0 && (
                    <div className="p-2 rounded bg-rose-950/40 border border-rose-500/30 text-rose-200 text-[11px]">
                      {osintResult.flags.map((f: string, i: number) => (
                        <div key={i}>⚠️ {f}</div>
                      ))}
                    </div>
                  )}
                  {osintResult.walletDetails && (
                    <div className="text-[11px] text-slate-300 space-y-1 border-t border-amber-500/20 pt-1.5">
                      <div>Chain: <strong className="text-cyan-300">{osintResult.walletDetails.chain}</strong></div>
                      <div>Balance: <strong className="text-emerald-300">{osintResult.walletDetails.balance}</strong></div>
                      {osintResult.walletDetails.txCount !== undefined && (
                        <div>Tx Count: {osintResult.walletDetails.txCount}</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {osintResult && osintType === 'IP' && (
                <div className="space-y-2 p-2.5 rounded bg-slate-900/90 border border-amber-500/40 text-[11px] text-slate-300">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-1">
                    <span className="font-bold text-amber-300">{osintResult.target}</span>
                    <span className="text-[10px] text-cyan-300">{osintResult.ip}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>Location: <strong>{osintResult.city}, {osintResult.country}</strong></div>
                    <div>ASN: <strong>{osintResult.asn}</strong></div>
                    <div>ISP / Org: <strong>{osintResult.organization}</strong></div>
                    <div>Proxy/VPN/Tor: <strong className={osintResult.isProxyOrVpn ? 'text-rose-400' : 'text-emerald-400'}>{osintResult.isProxyOrVpn ? 'YES' : 'NO'}</strong></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
