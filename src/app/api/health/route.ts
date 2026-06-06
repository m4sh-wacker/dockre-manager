import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/health
export async function GET() {
  try {
    const projectCount = await db.project.count();
    const runningCount = await db.project.count({ where: { status: 'running' } });
    const expiredCount = await db.project.count({ where: { status: 'expired' } });
    const logCount = await db.log.count();
    const userCount = await db.user.count();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.3.0',
      stats: {
        totalProjects: projectCount,
        runningProjects: runningCount,
        expiredProjects: expiredCount,
        totalLogs: logCount,
        totalUsers: userCount,
      },
    });
  } catch (error) {
    return NextResponse.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      version: '2.3.0',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
