import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

type EventType = 'create' | 'start' | 'stop' | 'restart' | 'renew' | 'delete' | 'expire';

interface ContainerEvent {
  id: string;
  type: EventType;
  timestamp: string;
  description: string;
  metadata?: Record<string, string>;
}

function generateEvents(projectId: string): ContainerEvent[] {
  const now = Date.now();
  const events: ContainerEvent[] = [];

  // Seed-like deterministic generation based on project ID
  let seed = 0;
  for (let i = 0; i < projectId.length; i++) {
    seed += projectId.charCodeAt(i);
  }
  const pseudoRandom = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  // Generate 18 realistic events in reverse chronological order
  const eventTemplates: Array<{ type: EventType; desc: string; meta?: Record<string, string> }>[] = [
    // Most recent events first
    [
      { type: 'restart', desc: 'Container restarted due to health check failure', meta: { reason: 'unhealthy', exitCode: '137' } },
    ],
    [
      { type: 'start', desc: 'Container started successfully', meta: { port: '3000' } },
    ],
    [
      { type: 'stop', desc: 'Container stopped by user request', meta: { triggeredBy: 'user' } },
    ],
    [
      { type: 'restart', desc: 'Automatic restart after OOM kill', meta: { reason: 'oom_kill', memoryUsage: '487MB' } },
    ],
    [
      { type: 'renew', desc: 'Service lease renewed for 30 days', meta: { duration: '30 days', newExpiry: '2026-08-15' } },
    ],
    [
      { type: 'start', desc: 'Container started after manual stop', meta: { port: '3000' } },
    ],
    [
      { type: 'stop', desc: 'Container stopped for maintenance window', meta: { triggeredBy: 'admin', maintenance: 'true' } },
    ],
    [
      { type: 'start', desc: 'Container deployed and started', meta: { port: '3000', image: 'node:20-alpine' } },
    ],
    [
      { type: 'restart', desc: 'Configuration updated, rolling restart', meta: { reason: 'config_change', config: 'env_vars' } },
    ],
    [
      { type: 'renew', desc: 'Service lease renewed for 7 days', meta: { duration: '7 days', newExpiry: '2026-07-22' } },
    ],
    [
      { type: 'stop', desc: 'Container stopped: image update pending', meta: { triggeredBy: 'system', image: 'node:20-alpine' } },
    ],
    [
      { type: 'start', desc: 'Container started after image pull', meta: { port: '3000', image: 'node:20-alpine' } },
    ],
    [
      { type: 'expire', desc: 'Service lease expired', meta: { expiredAt: '2026-07-10' } },
    ],
    [
      { type: 'renew', desc: 'Service lease renewed after expiration', meta: { duration: '14 days', newExpiry: '2026-07-24' } },
    ],
    [
      { type: 'start', desc: 'Container resumed after lease renewal', meta: { port: '3000' } },
    ],
    [
      { type: 'restart', desc: 'Container restarted: dependency update', meta: { reason: 'dependency', dependency: 'redis:7' } },
    ],
    [
      { type: 'stop', desc: 'Graceful shutdown initiated', meta: { triggeredBy: 'user', signal: 'SIGTERM' } },
    ],
    [
      { type: 'create', desc: 'Project created from template', meta: { template: 'web-app', image: 'node:20-alpine' } },
    ],
  ];

  // Assign timestamps going backwards
  let currentTime = now;
  for (let i = 0; i < eventTemplates.length; i++) {
    const templateGroup = eventTemplates[i];
    // Space events between 5 minutes and 48 hours apart
    const intervalMs = (pseudoRandom(i) * 172800000) + 300000; // 5 min to 48 hours
    currentTime -= intervalMs;

    for (const template of templateGroup) {
      events.push({
        id: `evt-${projectId}-${i}`,
        type: template.type,
        timestamp: new Date(currentTime).toISOString(),
        description: template.desc,
        metadata: template.meta,
      });
    }
  }

  return events;
}

// GET /api/projects/[id]/events - Get container event timeline
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Support pagination via query params
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const typeFilter = url.searchParams.get('type') || undefined;

    let events = generateEvents(id);

    // Apply type filter if specified
    if (typeFilter) {
      const types = typeFilter.split(',').map(t => t.trim()).filter(Boolean);
      events = events.filter(e => types.includes(e.type));
    }

    const total = events.length;
    const paginatedEvents = events.slice(offset, offset + limit);

    return NextResponse.json({
      events: paginatedEvents,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Get project events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
