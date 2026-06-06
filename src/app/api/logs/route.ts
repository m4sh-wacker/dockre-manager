import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// GET /api/logs - Get all logs across projects
export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Generate mock activity logs based on Docker operations
    const mockLogs = [
      {
        id: '1',
        projectId: 'docker-system',
        containerId: null,
        level: 'info',
        message: 'Docker system initialized successfully',
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        project: { name: 'System' },
      },
      {
        id: '2',
        projectId: 'docker-system',
        containerId: null,
        level: 'info',
        message: 'Container monitoring service started',
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        project: { name: 'System' },
      },
      {
        id: '3',
        projectId: 'docker-system',
        containerId: null,
        level: 'debug',
        message: 'Resource metrics collection active',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        project: { name: 'System' },
      },
    ];

    // Filter by level if specified
    let filtered = mockLogs;
    if (level && level !== 'all') {
      filtered = mockLogs.filter(log => log.level === level);
    }

    // Apply limit
    const limited = filtered.slice(0, limit);

    return NextResponse.json(limited);
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
