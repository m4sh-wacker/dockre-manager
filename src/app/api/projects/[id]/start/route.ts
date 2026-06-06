import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// POST /api/projects/[id]/start
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

    await db.project.update({
      where: { id },
      data: { status: 'running' },
    });

    // Update container statuses
    await db.container.updateMany({
      where: { projectId: id },
      data: { status: 'running' },
    });

    await db.log.create({
      data: {
        projectId: id,
        level: 'info',
        message: `Project "${project.name}" started`,
      },
    });

    return NextResponse.json({ message: 'Project started', status: 'running' });
  } catch (error) {
    console.error('Start project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
