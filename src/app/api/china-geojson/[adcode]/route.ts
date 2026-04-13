import { NextResponse } from 'next/server';
import { writeFile, readFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';

const DATAV_BASE = 'https://geo.datav.aliyun.com/areas_v3/bound';
const CACHE_DIR = join(process.cwd(), '.cache', 'geojson');

async function getCached(adcode: string): Promise<any | null> {
  try {
    const file = join(CACHE_DIR, `${adcode}.json`);
    const s = await stat(file);
    // Cache for 7 days
    if (Date.now() - s.mtimeMs < 7 * 24 * 60 * 60 * 1000) {
      const raw = await readFile(file, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // No cache
  }
  return null;
}

async function saveCache(adcode: string, data: any): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `${adcode}.json`), JSON.stringify(data), 'utf-8');
  } catch (err) {
    console.error('Failed to cache GeoJSON:', err);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ adcode: string }> }
) {
  const { adcode } = await params;

  if (!adcode || !/^\d+$/.test(adcode)) {
    return NextResponse.json({ error: 'Invalid adcode' }, { status: 400 });
  }

  try {
    // Try cache first
    const cached = await getCached(adcode);
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } });
    }

    // Fetch from DataV
    const url = `${DATAV_BASE}/${adcode}_full.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TravelTracker/1.0' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch GeoJSON: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    saveCache(adcode, data);

    return NextResponse.json(data, { headers: { 'X-Cache': 'MISS' } });
  } catch (err) {
    // Try stale cache on network error
    try {
      const raw = await readFile(join(CACHE_DIR, `${adcode}.json`), 'utf-8');
      return NextResponse.json(JSON.parse(raw), { headers: { 'X-Cache': 'STALE' } });
    } catch {
      console.error('GeoJSON proxy error:', err);
      return NextResponse.json(
        { error: 'Failed to fetch map data' },
        { status: 500 }
      );
    }
  }
}
