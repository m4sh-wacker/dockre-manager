import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'docker-manager-secret-key-2024';

export function generateToken(userId: string, username: string): string {
  const payload = { userId, username, exp: Date.now() + 86400000 }; // 24h
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): { userId: string; username: string } | null {
  try {
    const [header, body, sig] = token.split('.');
    const expectedSig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

export function getAuthUser(req: NextRequest): { userId: string; username: string } | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}
