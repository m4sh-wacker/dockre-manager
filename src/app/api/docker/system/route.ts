import { NextResponse } from 'next/server';

export async function GET() {
  const systemInfo = {
    engine: {
      version: '24.0.7',
      apiVersion: '1.43',
      os: 'Linux',
      arch: 'x86_64',
      kernel: '5.15.0',
      storageDriver: 'overlay2',
    },
    containers: {
      total: 10,
      running: 5,
      paused: 0,
      stopped: 5,
    },
    images: {
      total: 8,
      size: '2.4 GB',
    },
    networks: {
      bridge: true,
      host: true,
      overlay: true,
    },
    plugins: {
      volume: ['local'],
      network: ['bridge', 'host', 'overlay'],
      authorization: null,
    },
    systemTime: new Date().toISOString(),
    dockerRootDir: '/var/lib/docker',
  };

  return NextResponse.json(systemInfo);
}
