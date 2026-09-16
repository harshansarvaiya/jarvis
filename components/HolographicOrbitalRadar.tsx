'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Plane,
  Radio,
  CloudSun,
  RefreshCw,
  Eye,
  Crosshair,
  Compass,
  Layers,
  MapPin,
  Activity,
  Maximize2,
  Minimize2,
  Volume2,
  ExternalLink,
  Shield,
  Zap,
} from 'lucide-react';

interface Flight {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number;
  latitude: number;
  altitudeMeters: number;
  velocityKmh: number;
  headingDegrees: number;
  verticalRateMs: number;
  onGround: boolean;
}

interface Satellite {
  name: string;
  id: number;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKmh: number;
  visibility: string;
  timestamp: string;
}

interface Weather {
  coordinates: { latitude: number; longitude: number };
  temperatureCelsius: number;
  feelsLikeCelsius: number;
  relativeHumidity: number;
  precipitationMm: number;
  cloudCoverPercent: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  weatherCode: number;
  time: string;
}

interface GodsEyeTelemetry {
  flights?: {
    flights: Flight[];
    totalActiveTransponders: number;
    filteredCount: number;
  };
  satelliteOrbit?: {
    satellite: Satellite;
    target: string;
    footprintKm: number;
    orbitalPeriodMinutes: number;
  };
  meteorologicalRadar?: Weather;
}

export const HolographicOrbitalRadar: React.FC = () => {
  const [telemetry, setTelemetry] = useState<GodsEyeTelemetry | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState<'ISS' | 'FLIGHTS' | 'WEATHER'>('ISS');
  const [focusedFlight, setFocusedFlight] = useState<Flight | null>(null);
  const [cesiumActive, setCesiumActive] = useState(false);
  const [googleMapKey, setGoogleMapKey] = useState<string>('');
  const [cameraAltitude, setCameraAltitude] = useState<number>(420);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const rotationAngle = useRef<number>(0);

  // Auto-fetch real-time telemetry from J.A.R.V.I.S. Gods Eye API
  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gods-eye/radar?country=India&limit=12&lat=19.0760&lon=72.8777');
      const data = await res.json();
      if (data.success && data.godsEyeRadar) {
        setTelemetry(data.godsEyeRadar);
        setLastRefreshed(new Date().toLocaleTimeString());
        if (data.godsEyeRadar.flights?.flights?.length > 0 && !focusedFlight) {
          setFocusedFlight(data.godsEyeRadar.flights.flights[0]);
        }
      }
    } catch (err) {
      console.error('Gods Eye telemetry poll failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 25000); // 25s live telemetry cycle
    return () => clearInterval(interval);
  }, []);

  // 3D Canvas Holographic Globe Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;

    const renderGlobe = () => {
      if (!isMounted || !canvas) return;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.38;

      ctx.clearRect(0, 0, width, height);

      rotationAngle.current += 0.005;
      const rot = rotationAngle.current;

      // 1. Holographic Outer Atmosphere Ring
      const atmoGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.8, centerX, centerY, radius * 1.3);
      atmoGrad.addColorStop(0, 'rgba(0, 229, 255, 0.02)');
      atmoGrad.addColorStop(0.7, 'rgba(0, 229, 255, 0.12)');
      atmoGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // 2. Globe Sphere Base
      const sphereGrad = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        radius * 0.1,
        centerX,
        centerY,
        radius
      );
      sphereGrad.addColorStop(0, 'rgba(10, 30, 60, 0.9)');
      sphereGrad.addColorStop(0.7, 'rgba(5, 12, 25, 0.95)');
      sphereGrad.addColorStop(1, 'rgba(0, 229, 255, 0.4)');
      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3. Holographic Latitude & Longitude Wireframe Grids (Equirectangular orthographic projection)
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1;

      // Latitude Parallels
      [-60, -30, 0, 30, 60].forEach((lat) => {
        const rad = (lat * Math.PI) / 180;
        const y = centerY - radius * Math.sin(rad);
        const ringRadius = radius * Math.cos(rad);
        ctx.beginPath();
        ctx.ellipse(centerX, y, ringRadius, ringRadius * 0.25, 0, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Rotating Longitude Meridians
      for (let i = 0; i < 8; i++) {
        const angle = rot + (i * Math.PI) / 4;
        const xOffset = Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, Math.abs(xOffset), radius, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 229, 255, ${Math.cos(angle) > 0 ? 0.25 : 0.08})`;
        ctx.stroke();
      }

      // 4. Tactical Orbital Trackers Overlay (ISS & Global ADS-B Aircraft)
      if (telemetry?.satelliteOrbit?.satellite) {
        const sat = telemetry.satelliteOrbit.satellite;
        const satRadLon = ((sat.longitude + 180) * Math.PI) / 180 + rot;
        const satRadLat = (sat.latitude * Math.PI) / 180;

        // Front-facing spherical projection check
        const isVisible = Math.cos(satRadLon) > -0.2;
        if (isVisible) {
          const satX = centerX + (radius + 24) * Math.cos(satRadLat) * Math.sin(satRadLon);
          const satY = centerY - (radius + 24) * Math.sin(satRadLat);

          // Orbital Track Line
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + 24, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
          ctx.setLineDash([4, 6]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Satellite Beacon Pulse
          ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
          ctx.beginPath();
          ctx.arc(satX, satY, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
          ctx.beginPath();
          ctx.arc(satX, satY, 8 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
          ctx.stroke();

          // Label
          ctx.fillStyle = '#f59e0b';
          ctx.font = '10px monospace';
          ctx.fillText(`🛰️ ISS (${Math.round(sat.altitudeKm)}km)`, satX + 12, satY + 4);
        }
      }

      // 5. Live Flights Overlay
      if (telemetry?.flights?.flights) {
        telemetry.flights.flights.slice(0, 8).forEach((flight, idx) => {
          const flightRadLon = ((flight.longitude + 180) * Math.PI) / 180 + rot;
          const flightRadLat = (flight.latitude * Math.PI) / 180;

          if (Math.cos(flightRadLon) > 0) {
            const fX = centerX + radius * Math.cos(flightRadLat) * Math.sin(flightRadLon);
            const fY = centerY - radius * Math.sin(flightRadLat);

            const isFocused = focusedFlight?.icao24 === flight.icao24;

            ctx.fillStyle = isFocused ? '#10b981' : '#00e5ff';
            ctx.beginPath();
            ctx.arc(fX, fY, isFocused ? 3.5 : 2, 0, Math.PI * 2);
            ctx.fill();

            if (isFocused) {
              ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
              ctx.beginPath();
              ctx.arc(fX, fY, 7, 0, Math.PI * 2);
              ctx.stroke();
              ctx.fillStyle = '#10b981';
              ctx.font = '9px monospace';
              ctx.fillText(`✈️ ${flight.callsign}`, fX + 9, fY - 4);
            }
          }
        });
      }

      // 6. Targeting Reticle / Scanning Crosshairs
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
      ctx.lineWidth = 1;
      const reticleSize = 14;
      // Top Left Corner
      ctx.beginPath();
      ctx.moveTo(centerX - radius - 15, centerY - radius);
      ctx.lineTo(centerX - radius - 15 + reticleSize, centerY - radius);
      ctx.moveTo(centerX - radius - 15, centerY - radius);
      ctx.lineTo(centerX - radius - 15, centerY - radius + reticleSize);
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(renderGlobe);
    };

    renderGlobe();

    return () => {
      isMounted = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [telemetry, focusedFlight]);

  const iss = telemetry?.satelliteOrbit?.satellite;
  const weather = telemetry?.meteorologicalRadar;
  const flightList = telemetry?.flights?.flights || [];

  return (
    <div className="flex-1 flex flex-col bg-[#050811] border border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl relative font-sans">
      {/* HUD Top Status Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/90 border-b border-cyan-500/20 text-xs font-mono text-cyan-400 shrink-0">
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-cyan-400 animate-spin-slow" />
          <span className="font-bold tracking-wider">GOD’S EYE VIEW // 3D ORBITAL RADAR</span>
          <span className="px-2 py-0.5 rounded-full text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-500/40">
            CESIUM / OPENSKY TELEMETRY
          </span>
        </div>

        <div className="flex items-center space-x-3 text-[11px]">
          <span className="text-slate-400 flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE SENSORS: {flightList.length + 1}</span>
          </span>
          <button
            onClick={fetchTelemetry}
            disabled={loading}
            className="p-1 text-slate-400 hover:text-cyan-300 transition-colors rounded hover:bg-slate-900"
            title="Refresh Orbital Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        {/* Left 3D Holographic Globe Canvas (7 Columns on Desktop) */}
        <div className="lg:col-span-7 flex flex-col relative items-center justify-center p-3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#071328] via-[#040813] to-[#020409] border-r border-cyan-500/20">
          {/* Holographic HUD Overlay Elements */}
          <div className="absolute top-4 left-4 text-[10px] font-mono text-cyan-400/80 space-y-1 pointer-events-none z-10">
            <div className="flex items-center space-x-1 text-emerald-400">
              <Crosshair className="w-3 h-3" />
              <span>SUBSYSTEM: GODS_EYE_V1</span>
            </div>
            <div>LAT/LON GRID: 15° INTERVALS</div>
            <div>ELEVATION: {cameraAltitude} KM</div>
            {lastRefreshed && <div>SYNCHRONIZED: {lastRefreshed}</div>}
          </div>

          <div className="absolute top-4 right-4 flex items-center space-x-1 z-10">
            <button
              onClick={() => setSelectedTarget('ISS')}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-all ${
                selectedTarget === 'ISS'
                  ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              🛰️ ISS ORBIT
            </button>
            <button
              onClick={() => setSelectedTarget('FLIGHTS')}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-all ${
                selectedTarget === 'FLIGHTS'
                  ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              ✈️ FLIGHTS ({flightList.length})
            </button>
            <button
              onClick={() => setSelectedTarget('WEATHER')}
              className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-all ${
                selectedTarget === 'WEATHER'
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              🌧️ RADAR
            </button>
          </div>

          {/* 3D Canvas */}
          <canvas
            ref={canvasRef}
            width={480}
            height={420}
            className="w-full max-w-[480px] h-[340px] sm:h-[400px] object-contain cursor-grab active:cursor-grabbing"
          />

          {/* Bottom Telemetry Overlay Bar */}
          <div className="w-full bg-slate-950/80 border border-cyan-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs font-mono text-slate-300 mt-2">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>ORBITAL SPEED:</span>
              <span className="text-amber-400 font-bold">{iss ? `${iss.velocityKmh.toLocaleString()} km/h` : 'TRACKING...'}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-400">
              <span>VISIBILITY:</span>
              <span className="text-cyan-300 uppercase">{iss?.visibility || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Right Tactical Telemetry Feed (5 Columns on Desktop) */}
        <div className="lg:col-span-5 flex flex-col p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
          {/* Section 1: Satellite Orbital Telemetry Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/30 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-400">
              <div className="flex items-center space-x-1.5">
                <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>PRIMARY ORBIT: ISS (NORAD 25544)</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                ACTIVE TRACK
              </span>
            </div>

            {iss ? (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 mt-1">
                <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                  <div className="text-[9px] text-slate-500 uppercase">Latitude</div>
                  <div className="text-cyan-300 font-bold">{iss.latitude}° N</div>
                </div>
                <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                  <div className="text-[9px] text-slate-500 uppercase">Longitude</div>
                  <div className="text-cyan-300 font-bold">{iss.longitude}° E</div>
                </div>
                <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                  <div className="text-[9px] text-slate-500 uppercase">Altitude</div>
                  <div className="text-amber-300 font-bold">{iss.altitudeKm} km</div>
                </div>
                <div className="p-2 rounded bg-slate-950/70 border border-slate-800">
                  <div className="text-[9px] text-slate-500 uppercase">Velocity</div>
                  <div className="text-emerald-300 font-bold">{iss.velocityKmh} km/h</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 font-mono py-2">Acquiring NORAD ephemeris uplink...</div>
            )}
          </div>

          {/* Section 2: Real-Time ADS-B Air Traffic */}
          <div className="flex-1 flex flex-col p-3.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 shadow-lg space-y-2.5 min-h-0">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-cyan-400">
              <div className="flex items-center space-x-1.5">
                <Plane className="w-4 h-4 text-cyan-400" />
                <span>LIVE AIRSPACE VECTORS ({flightList.length})</span>
              </div>
              <span className="text-[10px] text-slate-400">OPENSKY ADS-B</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-56">
              {flightList.map((flight) => {
                const isSelected = focusedFlight?.icao24 === flight.icao24;
                return (
                  <button
                    key={flight.icao24}
                    onClick={() => setFocusedFlight(flight)}
                    className={`w-full text-left p-2 rounded-lg font-mono text-xs transition-all border ${
                      isSelected
                        ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400">✈️ {flight.callsign}</span>
                      <span className="text-[10px] text-slate-400">{flight.originCountry}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>ALT: {flight.altitudeMeters}m</span>
                      <span>SPD: {flight.velocityKmh} km/h</span>
                      <span>HDG: {flight.headingDegrees}°</span>
                    </div>
                  </button>
                );
              })}

              {flightList.length === 0 && (
                <div className="text-xs text-slate-500 font-mono py-4 text-center">
                  Scanning regional transponder frequency...
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Weather Radar */}
          {weather && (
            <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 text-xs font-mono text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <div className="flex items-center space-x-1.5">
                  <CloudSun className="w-4 h-4 text-emerald-400" />
                  <span>REGIONAL METEOROLOGY RADAR</span>
                </div>
                <span className="text-[10px] text-slate-400">OPEN-METEO</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] pt-1">
                <div className="p-1.5 rounded bg-slate-950/60">
                  <div className="text-slate-500">TEMP</div>
                  <div className="text-emerald-300 font-bold">{weather.temperatureCelsius}°C</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950/60">
                  <div className="text-slate-500">WIND</div>
                  <div className="text-cyan-300 font-bold">{weather.windSpeedKmh} km/h</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950/60">
                  <div className="text-slate-500">CLOUDS</div>
                  <div className="text-amber-300 font-bold">{weather.cloudCoverPercent}%</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
