import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const places = await db.visitedPlace.findMany({
    orderBy: { visitedAt: 'desc' },
  });
  return NextResponse.json(places);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, province, adcode, lat, lng, level } = body;

  if (!name) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  // Check for duplicates by name + province
  const existing = await db.visitedPlace.findFirst({
    where: { name, province: province || '' },
  });

  if (existing) {
    return NextResponse.json({ error: '该地点已标记' }, { status: 409 });
  }

  const place = await db.visitedPlace.create({
    data: {
      name,
      province: province || '',
      adcode: adcode || '',
      lat: lat || 0,
      lng: lng || 0,
      level: level || 'city',
    },
  });
  return NextResponse.json(place, { status: 201 });
}
