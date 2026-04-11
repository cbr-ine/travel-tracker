import { NextResponse } from 'next/server';

const DATAV_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';

export async function GET() {
  try {
    const res = await fetch(DATAV_URL, {
      headers: {
        'User-Agent': 'TravelTracker/1.0',
      },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch GeoJSON: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('China GeoJSON proxy error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch China map data' },
      { status: 500 }
    );
  }
}
