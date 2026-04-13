import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const countries = await db.visitedCountry.findMany({
    orderBy: { visitedAt: 'desc' },
  });
  return NextResponse.json(countries);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const { code, name, nameZh, visitedDate, note } = body;

  if (!code || !name) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  // Check for duplicates
  const existing = await db.visitedCountry.findUnique({
    where: { code: String(code) },
  });

  if (existing) {
    return NextResponse.json({ error: '该国家已标记' }, { status: 409 });
  }

  try {
    const country = await db.visitedCountry.create({
      data: {
        code: String(code),
        name: String(name),
        nameZh: String(nameZh || ''),
        visitedDate: String(visitedDate || ''),
        note: String(note || ''),
      },
    });
    return NextResponse.json(country, { status: 201 });
  } catch (err) {
    console.error('[POST /api/countries] DB error:', err);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
