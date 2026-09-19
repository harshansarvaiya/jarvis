import { NextRequest, NextResponse } from 'next/server';
import { scanCveThreats, traceCryptoSanctions, inspectIpRecon, fetchGeopoliticalThreatRadar } from '@/lib/jarvis/osint';

// Strategic Maritime Naval Chokepoints (OSIRIS-aligned)
const MARITIME_CHOKEPOINTS = [
  { id: 'hormuz', name: 'Strait of Hormuz', lat: 26.56, lon: 56.25, status: 'ELEVATED_WATCH', transitShare: '21% Global Petroleum' },
  { id: 'malacca', name: 'Strait of Malacca', lat: 1.43, lon: 102.89, status: 'NORMAL', transitShare: '25% Global Maritime Trade' },
  { id: 'suez', name: 'Suez Canal / Red Sea', lat: 29.93, lon: 32.55, status: 'HIGH_ALERT', transitShare: '12% Global Trade' },
  { id: 'bab_mandeb', name: 'Bab-el-Mandeb', lat: 12.58, lon: 43.33, status: 'HIGH_ALERT', transitShare: 'Key Red Sea Gateway' },
  { id: 'panama', name: 'Panama Canal', lat: 9.08, lon: -79.68, status: 'NORMAL', transitShare: '5% Global Trade' },
  { id: 'gibraltar', name: 'Strait of Gibraltar', lat: 35.96, lon: -5.60, status: 'NORMAL', transitShare: 'Atlantic-Med Gateway' },
  { id: 'bosporus', name: 'Bosporus Strait', lat: 41.11, lon: 29.07, status: 'NORMAL', transitShare: 'Black Sea Access' },
];

export async function GET() {
  const startTime = Date.now();
  let earthquakes: any[] = [];
  let spaceWeather: any[] = [];
  let geopolitics: any = null;

  // 1. Fetch Real-Time USGS Earthquakes (4.5+ Day)
  try {
    const eqRes = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson', {
      headers: { 'User-Agent': 'JARVIS-Radar/2.0' },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
    if (eqRes.ok) {
      const eqData = await eqRes.json();
      earthquakes = (eqData.features || []).slice(0, 20).map((f: any) => {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0, 0];
        return {
          id: f.id,
          mag: props.mag,
          place: props.place,
          time: props.time,
          tsunami: props.tsunami,
          depthKm: coords[2],
          lat: coords[1],
          lon: coords[0],
        };
      });
    }
  } catch (err: any) {
    console.warn('[Radar API] USGS fetch warning:', err?.message);
  }

  // 2. Fetch NOAA Space Weather Alerts
  try {
    const noaaRes = await fetch('https://services.swpc.noaa.gov/products/alerts.json', {
      headers: { 'User-Agent': 'JARVIS-Radar/2.0' },
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(5000),
    });
    if (noaaRes.ok) {
      const noaaData = await noaaRes.json();
      if (Array.isArray(noaaData)) {
        spaceWeather = noaaData.slice(0, 8).map((a: any) => ({
          productId: a.product_id,
          issueTime: a.issue_datetime,
          message: a.message?.split('\n')[0] || a.message?.slice(0, 100),
        }));
      }
    }
  } catch (err: any) {
    console.warn('[Radar API] NOAA fetch warning:', err?.message);
  }

  // 3. Fetch Geopolitical & WW3 Escalation Sentry
  try {
    geopolitics = await fetchGeopoliticalThreatRadar();
  } catch (geoErr: any) {
    console.warn('[Radar API] Geopolitics radar warning:', geoErr?.message);
  }

  return NextResponse.json({
    status: 'ONLINE',
    latencyMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    feeds: {
      earthquakes: {
        total: earthquakes.length,
        items: earthquakes,
      },
      spaceWeather: {
        total: spaceWeather.length,
        items: spaceWeather,
      },
      maritimeChokepoints: {
        total: MARITIME_CHOKEPOINTS.length,
        items: MARITIME_CHOKEPOINTS,
      },
      geopolitics: geopolitics || { status: 'STANDBY' },
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, query, asset, ecosystem } = body;

    if (action === 'cve_scan') {
      const report = await scanCveThreats({ keyword: query, ecosystem, limit: 5 });
      return NextResponse.json({ success: true, report });
    }

    if (action === 'crypto_sanctions') {
      const report = await traceCryptoSanctions({ addressOrName: query, asset });
      return NextResponse.json({ success: true, report });
    }

    if (action === 'ip_recon') {
      const report = await inspectIpRecon({ target: query });
      return NextResponse.json({ success: true, report });
    }

    if (action === 'geopolitics' || action === 'ww3_radar') {
      const report = await fetchGeopoliticalThreatRadar();
      return NextResponse.json({ success: true, report });
    }

    return NextResponse.json({ success: false, error: 'Invalid OSINT action requested' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

