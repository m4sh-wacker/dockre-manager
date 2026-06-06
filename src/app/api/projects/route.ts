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

function formatProject(project: Record<string, unknown>) {
  const status = (project.status as string) || 'stopped';
  return {
    id: project.id,
    name: project.name,
    template: project.template,
    status,
    frontend_port: project.frontendPort,
    backend_port: project.backendPort,
    cpu: project.cpu || 0,
    memory: project.memory || 0,
    expires_at: (project.expiresAt as Date).toISOString(),
    always_on: project.alwaysOn,
    container_id: project.containerId,
    created_at: (project.createdAt as Date).toISOString(),
    updated_at: (project.updatedAt as Date).toISOString(),
  };
}

// GET /api/projects - List all projects
export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { containers: true },
    });

    const formatted = projects.map(formatProject);

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('List projects error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create new project
export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      template = '',
      duration_value = 30,
      duration_unit = 'days',
      always_on = false,
      auto_assign = true,
      frontend_port,
      backend_port,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Calculate expiration
    const expiresAt = addDuration(new Date(), duration_value, duration_unit);

    // Auto-assign ports if requested
    let finalFrontendPort: number | null = frontend_port || null;
    let finalBackendPort: number | null = backend_port || null;

    if (auto_assign && (!finalFrontendPort || !finalBackendPort)) {
      const existingProjects = await db.project.findMany({
        select: { frontendPort: true, backendPort: true },
      });

      const usedPorts = new Set<number>();
      existingProjects.forEach((p) => {
        if (p.frontendPort) usedPorts.add(p.frontendPort);
        if (p.backendPort) usedPorts.add(p.backendPort);
      });

      if (!finalFrontendPort) {
        for (let port = 3000; port <= 4000; port++) {
          if (!usedPorts.has(port)) {
            finalFrontendPort = port;
            usedPorts.add(port);
            break;
          }
        }
      }

      if (!finalBackendPort) {
        for (let port = 8000; port <= 9000; port++) {
          if (!usedPorts.has(port)) {
            finalBackendPort = port;
            usedPorts.add(port);
            break;
          }
        }
      }
    }

    // Create project
    const project = await db.project.create({
      data: {
        name,
        template,
        status: 'running',
        frontendPort: finalFrontendPort,
        backendPort: finalBackendPort,
        expiresAt,
        alwaysOn: always_on,
      },
    });

    // Create a container record for the project
    const imageName = template ? `${template}:latest` : 'ubuntu:latest';
    await db.container.create({
      data: {
        projectId: project.id,
        name: `${name}-main`,
        image: imageName,
        status: 'running',
        ports: [
          finalFrontendPort ? `${finalFrontendPort}:3000` : '',
          finalBackendPort ? `${finalBackendPort}:8080` : '',
        ].filter(Boolean).join(','),
      },
    });

    // Create a log entry
    await db.log.create({
      data: {
        projectId: project.id,
        level: 'info',
        message: `Project "${name}" created with template "${template}"`,
      },
    });

    const created = await db.project.findUnique({
      where: { id: project.id },
      include: { containers: true },
    });

    return NextResponse.json(formatProject(created!), { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
