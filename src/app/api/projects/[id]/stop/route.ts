import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// POST /api/projects/[id]/stop
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
      data: { status: 'stopped' },
    });

    // Update container statuses
    await db.container.updateMany({
      where: { projectId: id },
      data: { status: 'stopped' },
    });

    await db.log.create({
      data: {
        projectId: id,
        level: 'info',
        message: `Project "${project.name}" stopped`,
      },
    });

    return NextResponse.json({ message: 'Project stopped', status: 'stopped' });
  } catch (error) {
    console.error('Stop project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
