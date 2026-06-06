import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Service templates with realistic health characteristics
interface ServiceHealthProfile {
  baseHealth: number;
  baseResponseTime: number;
  responseVariance: number;
  baseUptime: number;
  errorRate: number;
}

const templateProfiles: Record<string, ServiceHealthProfile> = {
  'nextjs-app': { baseHealth: 97, baseResponseTime: 45, responseVariance: 15, baseUptime: 99.8, errorRate: 0.2 },
  'react-app': { baseHealth: 95, baseResponseTime: 55, responseVariance: 20, baseUptime: 99.5, errorRate: 0.5 },
  'vue-app': { baseHealth: 96, baseResponseTime: 42, responseVariance: 12, baseUptime: 99.7, errorRate: 0.3 },
  'express-api': { baseHealth: 98, baseResponseTime: 18, responseVariance: 8, baseUptime: 99.9, errorRate: 0.1 },
  'python-api': { baseHealth: 94, baseResponseTime: 65, responseVariance: 25, baseUptime: 99.2, errorRate: 0.8 },
  'nginx': { baseHealth: 99, baseResponseTime: 5, responseVariance: 3, baseUptime: 99.99, errorRate: 0.01 },
  'postgres': { baseHealth: 99, baseResponseTime: 8, responseVariance: 4, baseUptime: 99.95, errorRate: 0.05 },
  'redis': { baseHealth: 99, baseResponseTime: 2, responseVariance: 1, baseUptime: 99.99, errorRate: 0.01 },
  'mysql': { baseHealth: 98, baseResponseTime: 10, responseVariance: 5, baseUptime: 99.9, errorRate: 0.1 },
  'mongo': { baseHealth: 97, baseResponseTime: 12, responseVariance: 6, baseUptime: 99.8, errorRate: 0.2 },
  'wordpress': { baseHealth: 91, baseResponseTime: 120, responseVariance: 40, baseUptime: 98.5, errorRate: 1.5 },
  'default': { baseHealth: 96, baseResponseTime: 35, responseVariance: 15, baseUptime: 99.5, errorRate: 0.5 },
};

function generateSparkline(base: number, variance: number, count: number = 20): number[] {
  const data: number[] = [];
  let current = base;
  for (let i = 0; i < count; i++) {
    const delta = (Math.random() - 0.5) * variance;
    current = Math.max(base * 0.5, Math.min(base * 2, current + delta));
    data.push(Math.round(current * 10) / 10);
  }
  return data;
}

function getTimeAgo(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

// GET /api/health/services
export async function GET() {
  try {
    const projects = await db.project.findMany({
      where: { status: 'running' },
      include: { containers: true },
    });

    if (projects.length === 0) {
      return NextResponse.json({
        services: [],
        overallHealth: 0,
        totalServices: 0,
        healthyServices: 0,
        degradedServices: 0,
        criticalServices: 0,
        lastRefreshed: new Date().toISOString(),
      });
    }

    const services = projects.map((project) => {
      const template = project.template || 'default';
      const profile = templateProfiles[template] || templateProfiles['default'];

      // Add some randomness but keep within realistic bounds
      const healthJitter = (Math.random() - 0.5) * 4;
      const healthScore = Math.min(100, Math.max(0, Math.round(profile.baseHealth + healthJitter)));

      const responseTime = Math.round(
        profile.baseResponseTime + (Math.random() - 0.3) * profile.responseVariance
      );

      const uptimeJitter = (Math.random() - 0.5) * 0.4;
      const uptime = Math.min(100, Math.max(0, Math.round((profile.baseUptime + uptimeJitter) * 100) / 100));

      const errorCount = Math.max(0, Math.round(profile.errorRate * 24 + (Math.random() - 0.5) * profile.errorRate * 10));

      const sparkline = generateSparkline(profile.baseResponseTime, profile.responseVariance);

      const minutesAgo = Math.floor(Math.random() * 5) + 1;
      const lastChecked = getTimeAgo(minutesAgo);

      return {
        id: project.id,
        name: project.name,
        template,
        status: project.status,
        healthScore,
        responseTime,
        uptime,
        errorCount,
        lastChecked,
        sparkline,
        containerCount: project.containers?.length || 0,
        cpu: project.cpu,
        memory: project.memory,
      };
    });

    const healthyServices = services.filter(s => s.healthScore > 95).length;
    const degradedServices = services.filter(s => s.healthScore >= 80 && s.healthScore <= 95).length;
    const criticalServices = services.filter(s => s.healthScore < 80).length;
    const overallHealth = services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.healthScore, 0) / services.length)
      : 0;

    return NextResponse.json({
      services,
      overallHealth,
      totalServices: services.length,
      healthyServices,
      degradedServices,
      criticalServices,
      lastRefreshed: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      services: [],
      overallHealth: 0,
      totalServices: 0,
      healthyServices: 0,
      degradedServices: 0,
      criticalServices: 0,
      lastRefreshed: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
