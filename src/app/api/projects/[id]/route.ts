import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

interface ContainerRow {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  cpu: number;
  memory: number;
  createdAt: Date;
  updatedAt: Date;
}

function formatProject(project: Record<string, unknown>) {
  const status = (project.status as string) || 'stopped';
  const isRunning = status.toLowerCase() === 'running';
  // Simulate CPU/memory for running containers
  const cpu = isRunning ? parseFloat((Math.random() * 20 + 5).toFixed(1)) : 0;
  const memory = isRunning ? Math.round(Math.random() * 412 + 100) : 0;

  // Format containers properly if they exist
  let formattedContainers: Array<{
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
    cpu: number;
    memory: number;
  }> = [];
  
  if (project.containers && Array.isArray(project.containers)) {
    formattedContainers = (project.containers as ContainerRow[]).map((c) => {
      const cRunning = c.status.toLowerCase() === 'running';
      return {
        id: c.id,
        name: c.name,
        image: c.image,
        status: c.status,
        ports: c.ports,
        cpu: cRunning ? parseFloat((Math.random() * 20 + 3).toFixed(1)) : 0,
        memory: cRunning ? Math.round(Math.random() * 300 + 80) : 0,
      };
    });
  }

  return {
    id: project.id,
    name: project.name,
    template: project.template,
    status,
    frontend_port: project.frontendPort,
    backend_port: project.backendPort,
    cpu,
    memory,
    expires_at: (project.expiresAt as Date).toISOString(),
    always_on: project.alwaysOn,
    container_id: project.containerId,
    created_at: (project.createdAt as Date).toISOString(),
    updated_at: (project.updatedAt as Date).toISOString(),
    containers: formattedContainers,
  };
}

// GET /api/projects/[id] - Get project with containers
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
    const project = await db.project.findUnique({
      where: { id },
      include: { containers: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(formatProject(project));
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
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

    // Delete logs, containers, then project (cascade should handle this, but be explicit)
    await db.log.deleteMany({ where: { projectId: id } });
    await db.container.deleteMany({ where: { projectId: id } });
    await db.project.delete({ where: { id } });

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
