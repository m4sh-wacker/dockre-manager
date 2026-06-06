import { NextRequest, NextResponse } from 'next/server';

// Simulated environment variables based on container template
function generateEnvVars(containerId: string): Array<{
  key: string;
  value: string;
  isModified: boolean;
  isSensitive: boolean;
}> {
  // Generate a deterministic hostname from containerId
  const hostname = containerId.substring(0, 12);

  // Common variables for all containers
  const commonVars = [
    { key: 'PATH', value: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', isModified: false, isSensitive: false },
    { key: 'HOSTNAME', value: hostname, isModified: false, isSensitive: false },
    { key: 'HOME', value: '/home/node', isModified: false, isSensitive: false },
    { key: 'TERM', value: 'xterm-256color', isModified: false, isSensitive: false },
    { key: 'LANG', value: 'C.UTF-8', isModified: false, isSensitive: false },
    { key: 'SHLVL', value: '1', isModified: false, isSensitive: false },
    { key: 'NODE_VERSION', value: '20.11.0', isModified: false, isSensitive: false },
    { key: 'YARN_VERSION', value: '1.22.19', isModified: false, isSensitive: false },
  ];

  // Template-specific variables
  // We don't know the exact template from the containerId, so we provide
  // a mix of common Docker/container environment variables
  const templateVars = [
    { key: 'NODE_ENV', value: 'production', isModified: false, isSensitive: false },
    { key: 'PORT', value: '3000', isModified: false, isSensitive: false },
    { key: 'NEXT_PUBLIC_API_URL', value: 'http://localhost:3030', isModified: false, isSensitive: false },
    { key: 'NEXTAUTH_URL', value: 'http://localhost:3000', isModified: false, isSensitive: false },
    { key: 'NEXTAUTH_SECRET', value: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', isModified: false, isSensitive: true },
    { key: 'DATABASE_URL', value: 'file:./dev.db', isModified: false, isSensitive: false },
    { key: 'API_PORT', value: '3030', isModified: false, isSensitive: false },
    { key: 'DOCKER_HOST', value: 'unix:///var/run/docker.sock', isModified: false, isSensitive: false },
    { key: 'JWT_SECRET', value: 'jwt_prod_secret_key_2024_docker_mgr', isModified: false, isSensitive: true },
    { key: 'REDIS_URL', value: 'redis://redis:6379', isModified: false, isSensitive: false },
    { key: 'LOG_LEVEL', value: 'info', isModified: false, isSensitive: false },
    { key: 'TZ', value: 'UTC', isModified: false, isSensitive: false },
  ];

  return [...commonVars, ...templateVars].sort((a, b) => a.key.localeCompare(b.key));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Container ID is required' },
      { status: 400 }
    );
  }

  const variables = generateEnvVars(id);

  return NextResponse.json({
    containerId: id,
    variables,
    total: variables.length,
    sensitive: variables.filter(v => v.isSensitive).length,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Container ID is required' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { variables } = body as { variables: Array<{ key: string; value: string }> };

    // In simulation mode, just acknowledge the update
    return NextResponse.json({
      success: true,
      containerId: id,
      updated: variables?.length || 0,
      message: 'Environment variables updated. Restart the container to apply changes.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
