import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  try {
    await db.visitedCountry.delete({
      where: { code },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '未找到该国家' }, { status: 404 });
  }
}
