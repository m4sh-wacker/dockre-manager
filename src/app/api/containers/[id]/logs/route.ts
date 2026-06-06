import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const DOCKER_MANAGER_URL = process.env.DOCKER_MANAGER_URL || 'http://localhost:3030';

// GET /api/containers/[id]/logs?tail=200
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
    const searchParams = req.nextUrl.searchParams;
    const tail = searchParams.get('tail') || '100';

    // Get token from request
    const token = req.cookies.get('token')?.value || req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    // Forward request to Docker manager
    const response = await fetch(`${DOCKER_MANAGER_URL}/api/containers/${id}/logs?tail=${tail}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Docker manager error:', error);
      return NextResponse.json(
        { error: 'Failed to get container logs' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Container logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
