import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const countries = await db.visitedCountry.findMany({
    orderBy: { visitedAt: 'desc' },
  });
  return NextResponse.json(countries);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { code, name, nameZh } = body;

  if (!code || !name) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  const existing = await db.visitedCountry.findUnique({
    where: { code },
  });

  if (existing) {
    return NextResponse.json({ error: '该国家已标记' }, { status: 409 });
  }

  const country = await db.visitedCountry.create({
    data: { code, name, nameZh: nameZh || '' },
  });
  return NextResponse.json(country, { status: 201 });
}
