import { NextRequest, NextResponse } from 'next/server';
import { executeGodsEyeMCP } from '@/lib/jarvis/mcp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get('country') || undefined;
    const limit = parseInt(searchParams.get('limit') || '15', 10);
    const lat = parseFloat(searchParams.get('lat') || '19.0760'); // Default Mumbai
    const lon = parseFloat(searchParams.get('lon') || '72.8777');

    const [flightsRes, satellitesRes, weatherRes] = await Promise.all([
      executeGodsEyeMCP('track_flights', { country, limit }),
      executeGodsEyeMCP('track_satellites', { target: 'ISS' }),
      executeGodsEyeMCP('weather_radar', { latitude: lat, longitude: lon }),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      godsEyeRadar: {
        flights: flightsRes.output || { flights: [], totalActiveTransponders: 0 },
        satelliteOrbit: satellitesRes.output || null,
        meteorologicalRadar: weatherRes.output || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gods Eye telemetry aggregation failure' },
      { status: 500 }
    );
  }
}
