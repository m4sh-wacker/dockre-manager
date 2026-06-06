import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Auth check
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Please upload a .db file.' },
        { status: 400 }
      );
    }

    // Validate file extension
    if (!file.name.endsWith('.db')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .db files are accepted.' },
        { status: 400 }
      );
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB.' },
        { status: 400 }
      );
    }

    const dbPath = path.join(process.cwd(), 'db', 'custom.db');
    const backupPath = path.join(process.cwd(), 'db', 'custom.db.pre-restore-backup');

    // Create a backup of the current database before overwriting
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }

    try {
      // Write the uploaded file
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(dbPath, buffer);

      // Clean up the pre-restore backup after successful write
      // Keep it for one more step in case we need to rollback
      // In production, this would be cleaned up by a cron job

      return NextResponse.json({
        success: true,
        message: 'Database restored successfully',
        details: {
          fileName: file.name,
          size: file.size,
          restoredAt: new Date().toISOString(),
          backupCreated: fs.existsSync(backupPath),
        },
      });
    } catch (writeError) {
      // Attempt to rollback
      if (fs.existsSync(backupPath)) {
        try {
          fs.copyFileSync(backupPath, dbPath);
        } catch {
          // Rollback failed - critical error
        }
      }
      throw writeError;
    }
  } catch (error) {
    console.error('Database restore error:', error);
    return NextResponse.json(
      { error: 'Failed to restore database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
