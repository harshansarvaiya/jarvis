'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Plane,
  Radio,
  CloudSun,
  RefreshCw,
  Crosshair,
  Compass,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Navigation,
  Shield,
  Activity,
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
  const [cameraAltitude, setCameraAltitude] = useState<number>(420);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const rotationAngle = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const lastMouseX = useRef<number>(0);

  // Auto-fetch real-time telemetry from J.A.R.V.I.S. Gods Eye API
  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gods-eye/radar?limit=15&lat=19.0760&lon=72.8777');
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

  // Mouse & Touch Dragging Handlers for interactive 360° globe manipulation
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    lastMouseX.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastMouseX.current;
    rotationAngle.current += deltaX * 0.008;
    lastMouseX.current = e.clientX;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastMouseX.current = e.touches[0].clientX;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - lastMouseX.current;
    rotationAngle.current += deltaX * 0.008;
    lastMouseX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const zoomIn = () => {
    setCameraAltitude((prev) => Math.max(200, prev - 80));
  };

  const zoomOut = () => {
    setCameraAltitude((prev) => Math.min(1000, prev + 80));
  };

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

      // Scale globe radius based on camera altitude
      const baseRadius = Math.min(width, height) * 0.38;
      const altitudeScale = 450 / Math.max(250, cameraAltitude);
      const radius = Math.min(width * 0.44, baseRadius * altitudeScale);

      ctx.clearRect(0, 0, width, height);

      if (autoRotate && !isDragging.current) {
        rotationAngle.current += 0.005;
      }
      const rot = rotationAngle.current;

      // 1. Holographic Outer Atmosphere Glow
      const atmoGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.85, centerX, centerY, radius * 1.3);
      atmoGrad.addColorStop(0, 'rgba(0, 229, 255, 0.03)');
      atmoGrad.addColorStop(0.7, 'rgba(0, 229, 255, 0.15)');
      atmoGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // 2. Globe Sphere Core Base
      const sphereGrad = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        radius * 0.1,
        centerX,
        centerY,
        radius
      );
      sphereGrad.addColorStop(0, 'rgba(10, 30, 60, 0.92)');
      sphereGrad.addColorStop(0.7, 'rgba(4, 10, 22, 0.96)');
      sphereGrad.addColorStop(1, 'rgba(0, 229, 255, 0.45)');
      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3. Holographic Latitude & Longitude Wireframe Grids
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.16)';
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
        ctx.strokeStyle = `rgba(0, 229, 255, ${Math.cos(angle) > 0 ? 0.28 : 0.07})`;
        ctx.stroke();
      }

      // 4. Tactical Orbital Trackers Overlay (ISS Satellite)
      if (telemetry?.satelliteOrbit?.satellite) {
        const sat = telemetry.satelliteOrbit.satellite;
        const satRadLon = ((sat.longitude + 180) * Math.PI) / 180 + rot;
        const satRadLat = (sat.latitude * Math.PI) / 180;

        const isVisible = Math.cos(satRadLon) > -0.25;
        if (isVisible) {
          const orbitOffset = radius * 0.16;
          const satX = centerX + (radius + orbitOffset) * Math.cos(satRadLat) * Math.sin(satRadLon);
          const satY = centerY - (radius + orbitOffset) * Math.sin(satRadLat);

          // Orbital Path Arc
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius + orbitOffset, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
          ctx.setLineDash([4, 6]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Satellite Beacon Pulse
          ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
          ctx.beginPath();
          ctx.arc(satX, satY, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
          ctx.beginPath();
          ctx.arc(satX, satY, 8 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2);
          ctx.stroke();

          // Label
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`🛰️ ISS (${Math.round(sat.altitudeKm)}km)`, satX + 10, satY + 3);
        }
      }

      // 5. Live Flights Overlay
      if (telemetry?.flights?.flights) {
        telemetry.flights.flights.slice(0, 10).forEach((flight) => {
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

            if (isFocused || selectedTarget === 'FLIGHTS') {
              ctx.strokeStyle = isFocused ? 'rgba(16, 185, 129, 0.7)' : 'rgba(0, 229, 255, 0.4)';
              ctx.beginPath();
              ctx.arc(fX, fY, isFocused ? 7 : 4, 0, Math.PI * 2);
              ctx.stroke();

              ctx.fillStyle = isFocused ? '#10b981' : '#00e5ff';
              ctx.font = '9px monospace';
              ctx.fillText(`✈️ ${flight.callsign}`, fX + 8, fY - 3);
            }
          }
        });
      }

      // 6. Corner Reticles & Scanning Brackets
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
      ctx.lineWidth = 1;
      const bSize = 12;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(14, 14 + bSize);
      ctx.lineTo(14, 14);
      ctx.lineTo(14 + bSize, 14);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(width - 14 - bSize, 14);
      ctx.lineTo(width - 14, 14);
      ctx.lineTo(width - 14, 14 + bSize);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(14, height - 14 - bSize);
      ctx.lineTo(14, height - 14);
      ctx.lineTo(14 + bSize, height - 14);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(width - 14 - bSize, height - 14);
      ctx.lineTo(width - 14, height - 14);
      ctx.lineTo(width - 14, height - 14 - bSize);
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(renderGlobe);
    };

    renderGlobe();

    return () => {
      isMounted = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [telemetry, focusedFlight, selectedTarget, cameraAltitude, autoRotate]);

  const iss = telemetry?.satelliteOrbit?.satellite;
  const weather = telemetry?.meteorologicalRadar;
  const flightList = telemetry?.flights?.flights || [];

  return (
    <div className="flex-1 flex flex-col bg-[#050811] border border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl relative font-sans">
      {/* 1. Master HUD Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-slate-950/95 border-b border-cyan-500/20 text-xs font-mono text-cyan-400 shrink-0">
        <div className="flex items-center space-x-2 truncate">
          <Globe className="w-4 h-4 text-cyan-400 shrink-0 animate-spin-slow" />
          <span className="font-bold tracking-wider truncate">GOD’S EYE VIEW // 3D ORBITAL RADAR</span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 shrink-0">
            CESIUM / OPENSKY
          </span>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 text-[11px] shrink-0">
          <span className="text-slate-400 flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">LIVE SENSORS:</span>
            <span className="font-bold text-emerald-400">{flightList.length + 1}</span>
          </span>
          <button
            onClick={fetchTelemetry}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-cyan-300 transition-colors rounded hover:bg-slate-900 border border-slate-800"
            title="Refresh Orbital Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Sub-HUD Tactical Toolbar (Zero collision, cleanly responsive) */}
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2 bg-slate-950/80 border-b border-cyan-500/15 gap-2 text-xs font-mono shrink-0">
        <div className="flex items-center space-x-2 text-[10px] text-cyan-400/80 truncate">
          <div className="flex items-center space-x-1 text-emerald-400 font-bold">
            <Crosshair className="w-3 h-3 shrink-0" />
            <span>GODS_EYE_V1</span>
          </div>
          <span className="text-slate-700">•</span>
          <span className="text-slate-400">15° GRID</span>
          <span className="text-slate-700">•</span>
          <span className="text-amber-300 font-bold">{cameraAltitude} KM</span>
          {lastRefreshed && (
            <>
              <span className="hidden md:inline text-slate-700">•</span>
              <span className="hidden md:inline text-slate-500">SYNC: {lastRefreshed}</span>
            </>
          )}
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedTarget('ISS')}
            className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-all whitespace-nowrap ${
              selectedTarget === 'ISS'
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            🛰️ ISS ORBIT
          </button>
          <button
            onClick={() => setSelectedTarget('FLIGHTS')}
            className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-all whitespace-nowrap ${
              selectedTarget === 'FLIGHTS'
                ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 shadow-[0_0_8px_rgba(0,229,255,0.25)]'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            ✈️ FLIGHTS ({flightList.length})
          </button>
          <button
            onClick={() => setSelectedTarget('WEATHER')}
            className={`px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-all whitespace-nowrap ${
              selectedTarget === 'WEATHER'
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            🌧️ RADAR
          </button>
        </div>
      </div>

      {/* 3. Main Grid Viewport: Responsive Scrollable Container */}
      <div className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Left 3D Holographic Globe Canvas (7 Cols on Desktop) */}
        <div className="lg:col-span-7 flex flex-col relative items-center justify-center p-3 sm:p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#071328] via-[#040813] to-[#020409] border-b lg:border-b-0 lg:border-r border-cyan-500/20">
          {/* Quick Tactical Controls in Globe Corner */}
          <div className="absolute top-3 right-3 flex items-center space-x-1.5 z-10">
            <button
              onClick={() => setAutoRotate((prev) => !prev)}
              className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-cyan-400 hover:border-cyan-400 transition-all text-xs"
              title={autoRotate ? 'Pause Rotation' : 'Resume Rotation'}
            >
              {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={zoomIn}
              className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-cyan-400 hover:border-cyan-400 transition-all text-xs"
              title="Zoom In (Lower Orbit)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={zoomOut}
              className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-700 text-cyan-400 hover:border-cyan-400 transition-all text-xs"
              title="Zoom Out (Higher Orbit)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Drag Instruction Banner */}
          <div className="absolute bottom-14 left-4 text-[9px] font-mono text-cyan-500/60 pointer-events-none flex items-center space-x-1">
            <Navigation className="w-2.5 h-2.5" />
            <span>DRAG TO ROTATE 360° • PINCH/BUTTONS TO ZOOM</span>
          </div>

          {/* 3D Canvas */}
          <canvas
            ref={canvasRef}
            width={480}
            height={400}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full max-w-[480px] h-[300px] sm:h-[380px] object-contain cursor-grab active:cursor-grabbing select-none"
          />

          {/* Bottom Telemetry Overlay Bar */}
          <div className="w-full bg-slate-950/90 border border-cyan-500/30 rounded-xl p-2 sm:p-2.5 flex items-center justify-between text-xs font-mono text-slate-300 mt-2 shadow-lg">
            <div className="flex items-center space-x-2 truncate">
              <Compass className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
              <span className="hidden sm:inline">ORBITAL SPEED:</span>
              <span className="text-amber-400 font-bold">{iss ? `${iss.velocityKmh.toLocaleString()} km/h` : 'TRACKING...'}</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-400 text-[11px] shrink-0">
              <span className="hidden sm:inline">VISIBILITY:</span>
              <span className="text-cyan-300 uppercase px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                {iss?.visibility || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Tactical Telemetry Feed (5 Cols on Desktop, Stacked & Scrollable on Mobile) */}
        <div className="lg:col-span-5 flex flex-col p-3 sm:p-4 space-y-3.5 overflow-y-auto lg:max-h-[calc(100vh-140px)]">
          {/* Section 1: Satellite Orbital Telemetry Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/30 shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-400">
              <div className="flex items-center space-x-1.5 truncate">
                <Radio className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <span className="truncate">PRIMARY ORBIT: ISS (NORAD 25544)</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 shrink-0">
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
          <div className="flex flex-col p-3.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 shadow-lg space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-cyan-400">
              <div className="flex items-center space-x-1.5 truncate">
                <Plane className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate">LIVE AIRSPACE VECTORS ({flightList.length})</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">ADS-B SENSORS</span>
            </div>

            <div className="overflow-y-auto space-y-1.5 pr-1 max-h-60">
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
            <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 text-xs font-mono text-slate-300 space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <div className="flex items-center space-x-1.5">
                  <CloudSun className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>REGIONAL METEOROLOGY RADAR</span>
                </div>
                <span className="text-[10px] text-slate-400">OPEN-METEO</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] pt-1">
                <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-slate-500">TEMP</div>
                  <div className="text-emerald-300 font-bold">{weather.temperatureCelsius}°C</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800 text-center">
                  <div className="text-slate-500">WIND</div>
                  <div className="text-cyan-300 font-bold">{weather.windSpeedKmh} km/h</div>
                </div>
                <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800 text-center">
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
