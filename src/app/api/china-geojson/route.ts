import { NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';

const DATAV_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';
const CACHE_DIR = join(process.cwd(), 'public');
const CACHE_FILE = join(CACHE_DIR, 'china.geojson.json');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getCachedData(): Promise<{ data: any; cached: boolean } | null> {
  try {
    const stat = await import('fs/promises').then(fs => fs.stat(CACHE_FILE));
    const age = Date.now() - stat.mtimeMs;
    if (age < CACHE_TTL) {
      const raw = await readFile(CACHE_FILE, 'utf-8');
      return { data: JSON.parse(raw), cached: true };
    }
  } catch {
    // No cache file
  }
  return null;
}

async function saveCache(data: any): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(data), 'utf-8');
  } catch (err) {
    console.error('Failed to cache China GeoJSON:', err);
  }
}

export async function GET() {
  try {
    // Try cache first
    const cached = await getCachedData();
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    // Fetch from DataV
    const res = await fetch(DATAV_URL, {
      headers: { 'User-Agent': 'TravelTracker/1.0' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch GeoJSON: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Save to cache
    saveCache(data);

    return NextResponse.json(data, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (err) {
    // If network fails, try stale cache
    try {
      const raw = await readFile(CACHE_FILE, 'utf-8');
      return NextResponse.json(JSON.parse(raw), {
        headers: { 'X-Cache': 'STALE' },
      });
    } catch {
      console.error('China GeoJSON proxy error:', err);
      return NextResponse.json(
        { error: 'Failed to fetch China map data' },
        { status: 500 }
      );
    }
  }
}
