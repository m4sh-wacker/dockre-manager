import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/cron/expiry - Check and expire projects
export async function GET() {
  try {
    const now = new Date();

    // Find projects that have expired but are still running
    const expiredProjects = await db.project.findMany({
      where: {
        status: 'running',
        expiresAt: { lt: now },
        alwaysOn: false,
      },
    });

    let expiredCount = 0;

    for (const project of expiredProjects) {
      await db.project.update({
        where: { id: project.id },
        data: { status: 'expired' },
      });

      await db.container.updateMany({
        where: { projectId: project.id },
        data: { status: 'exited' },
      });

      await db.log.create({
        data: {
          projectId: project.id,
          level: 'warn',
          message: `Project "${project.name}" has expired and was automatically stopped`,
        },
      });

      expiredCount++;
    }

    return NextResponse.json({
      checked_at: now.toISOString(),
      expired_count: expiredCount,
    });
  } catch (error) {
    console.error('Expiry check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
