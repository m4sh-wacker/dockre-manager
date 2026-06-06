import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

function addDuration(date: Date, value: number, unit: string): Date {
  const result = new Date(date);
  if (unit === 'days') {
    result.setDate(result.getDate() + value);
  } else if (unit === 'months') {
    result.setMonth(result.getMonth() + value);
  } else if (unit === 'hours') {
    result.setHours(result.getHours() + value);
  }
  return result;
}

// POST /api/projects/[id]/renew
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const project = await db.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const { duration_value = 30, duration_unit = 'days' } = body;

    const newExpiresAt = addDuration(project.expiresAt, duration_value, duration_unit);

    await db.project.update({
      where: { id },
      data: { expiresAt: newExpiresAt },
    });

    await db.log.create({
      data: {
        projectId: id,
        level: 'info',
        message: `Project "${project.name}" renewed by ${duration_value} ${duration_unit}. New expiration: ${newExpiresAt.toISOString()}`,
      },
    });

    return NextResponse.json({
      message: 'Project renewed',
      expires_at: newExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Renew project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
