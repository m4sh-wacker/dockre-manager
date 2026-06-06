import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Auth check
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dbPath = path.join(process.cwd(), 'db', 'custom.db');

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { error: 'Database file not found' },
        { status: 404 }
      );
    }

    const stats = fs.statSync(dbPath);
    const buffer = fs.readFileSync(dbPath);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `docker-manager-backup-${timestamp}.db`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': stats.size.toString(),
        'X-Backup-Size': stats.size.toString(),
        'X-Backup-Timestamp': new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Database backup error:', error);
    return NextResponse.json(
      { error: 'Failed to create database backup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
