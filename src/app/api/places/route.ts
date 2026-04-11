import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const places = await db.visitedPlace.findMany({
    orderBy: { visitedAt: 'desc' },
  });
  return NextResponse.json(places);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const { name, province, adcode, lat, lng, level } = body;

  console.log('[POST /api/places] body:', JSON.stringify(body));

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    console.log('[POST /api/places] rejected: invalid name', { name });
    return NextResponse.json({ error: '缺少必要参数: name' }, { status: 400 });
  }

  const trimmedName = name.trim();
  const trimmedProvince = (typeof province === 'string' ? province : '').trim();

  // Check for duplicates by name + province (also enforced by DB unique constraint)
  const existing = await db.visitedPlace.findFirst({
    where: { name: trimmedName, province: trimmedProvince },
  });

  if (existing) {
    return NextResponse.json({ error: '该地点已标记' }, { status: 409 });
  }

  try {
    const place = await db.visitedPlace.create({
      data: {
        name: trimmedName,
        province: trimmedProvince,
        adcode: String(adcode || ''),
        lat: typeof lat === 'number' ? lat : 0,
        lng: typeof lng === 'number' ? lng : 0,
        level: (typeof level === 'string' ? level : 'city').trim(),
      },
    });
    return NextResponse.json(place, { status: 201 });
  } catch (err) {
    console.error('[POST /api/places] DB error:', err);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
