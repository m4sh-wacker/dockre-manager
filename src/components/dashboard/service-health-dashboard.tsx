'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Clock, AlertTriangle, Heart, Zap,
  ArrowUpRight, RefreshCw, CheckCircle2, AlertCircle, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { apiRequest } from '@/lib/api';

// --- Types ---

interface ServiceHealth {
  id: string;
  name: string;
  template: string;
  status: string;
  healthScore: number;
  responseTime: number;
  uptime: number;
  errorCount: number;
  lastChecked: string;
  sparkline: number[];
  containerCount: number;
  cpu: number;
  memory: number;
}

interface HealthData {
  services: ServiceHealth[];
  overallHealth: number;
  totalServices: number;
  healthyServices: number;
  degradedServices: number;
  criticalServices: number;
  lastRefreshed: string;
}

// --- Health Color Helpers ---

function getHealthColor(score: number, isDark: boolean): string {
  if (score > 95) return isDark ? '#34d399' : '#10b981';
  if (score >= 80) return isDark ? '#fbbf24' : '#d97706';
  return isDark ? '#f87171' : '#dc2626';
}

function getHealthColorClass(score: number): string {
  if (score > 95) return 'text-emerald-400';
  if (score >= 80) return 'text-amber-400';
  return 'text-red-400';
}

function getHealthBgClass(score: number): string {
  if (score > 95) return 'bg-emerald-500/10';
  if (score >= 80) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

function getHealthBorderClass(score: number): string {
  if (score > 95) return 'border-emerald-500/30';
  if (score >= 80) return 'border-amber-500/30';
  return 'border-red-500/30';
}

function getHealthGlowClass(score: number): string {
  if (score > 95) return 'shadow-emerald-500/10';
  if (score >= 80) return 'shadow-amber-500/10';
  return 'shadow-red-500/10';
}

function getStatusLabel(score: number): string {
  if (score > 95) return 'Healthy';
  if (score >= 80) return 'Degraded';
  return 'Critical';
}

function getStatusIcon(score: number): React.ElementType {
  if (score > 95) return CheckCircle2;
  if (score >= 80) return AlertCircle;
  return XCircle;
}

// --- Circular Health Score Ring ---

interface HealthRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  isDark: boolean;
}

function HealthRing({ score, size = 72, strokeWidth = 6, color, isDark }: HealthRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-md opacity-30"
        style={{ backgroundColor: color }}
      />
      <svg width={size} height={size} className="-rotate-90 relative z-10">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={isDark ? 'text-white/10' : 'text-black/10'}
        />
        {/* Animated fill ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      {/* Center score */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <span className="text-base font-bold text-foreground leading-none">{score}</span>
        <span className="text-[8px] text-muted-foreground mt-0.5">%</span>
      </div>
    </div>
  );
}

// --- Mini Sparkline ---

interface MiniSparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

function MiniSparkline({ data, color, width = 80, height = 28 }: MiniSparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  const gradientId = `sparkline-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (() => {
        const lastX = padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2);
        const lastY = padding + (1 - (data[data.length - 1] - min) / range) * (height - padding * 2);
        return (
          <circle cx={lastX} cy={lastY} r={2.5} fill={color} className="animate-pulse" />
        );
      })()}
    </svg>
  );
}

// --- Component Props ---

interface ServiceHealthDashboardProps {
  onNavigate?: (tab: 'containers' | 'images' | 'activity') => void;
}

// --- Main Component ---

export function ServiceHealthDashboard({ onNavigate }: ServiceHealthDashboardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealthData = async (showRefreshAnimation = false) => {
    if (showRefreshAnimation) setIsRefreshing(true);
    try {
      const response = await apiRequest('/api/health/services');
      if (response.ok) {
        const data = await response.json();
        setHealthData(data);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchHealthData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchHealthData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.4, ease: 'easeOut' },
    },
  };

  const overallColor = useMemo(() => {
    if (!healthData) return isDark ? '#34d399' : '#10b981';
    return getHealthColor(healthData.overallHealth, isDark);
  }, [healthData, isDark]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Service Health Monitor</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card/50 border-border/50 backdrop-blur-sm animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-[72px] h-[72px] rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-24" />
                    <div className="h-3 bg-muted rounded w-16" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!healthData || healthData.services.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* === Section Header === */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Service Health Monitor</h3>
          <Badge variant="secondary" className="text-[10px] font-mono">
            {healthData.totalServices} service{healthData.totalServices !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {autoRefresh && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
            )}
            <span>Live</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] text-muted-foreground hover:text-primary h-6 px-2 gap-1"
            onClick={() => fetchHealthData(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('w-3 h-3', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] text-muted-foreground hover:text-primary h-6 px-2 gap-1"
            onClick={() => onNavigate?.('containers')}
          >
            View Details
            <ArrowUpRight className="w-2.5 h-2.5" />
          </Button>
        </div>
      </div>

      {/* === Overall Health Summary Bar === */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className={cn(
          "bg-card/50 border-border/50 backdrop-blur-md overflow-hidden relative",
        )}>
          {/* Gradient background glow */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              background: `radial-gradient(ellipse at 30% 50%, ${overallColor}, transparent 70%)`,
            }}
          />
          <CardContent className="p-4 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Overall health ring */}
              <div className="flex items-center gap-3">
                <HealthRing
                  score={healthData.overallHealth}
                  size={56}
                  strokeWidth={5}
                  color={overallColor}
                  isDark={isDark}
                />
                <div>
                  <p className="text-xs text-muted-foreground">Overall Health</p>
                  <p className={cn('text-lg font-bold', getHealthColorClass(healthData.overallHealth))}>
                    {healthData.overallHealth}%
                  </p>
                </div>
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-3 sm:ml-auto">
                {healthData.healthyServices > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">
                      {healthData.healthyServices} Healthy
                    </span>
                  </div>
                )}
                {healthData.degradedServices > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">
                      {healthData.degradedServices} Degraded
                    </span>
                  </div>
                )}
                {healthData.criticalServices > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs font-medium text-red-400">
                      {healthData.criticalServices} Critical
                    </span>
                  </div>
                )}
              </div>

              {/* Last refreshed */}
              <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" />
                <span>Updated {healthData.lastRefreshed ? new Date(healthData.lastRefreshed).toLocaleTimeString() : '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* === Service Health Cards Grid === */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {healthData.services.map((service) => {
          const color = getHealthColor(service.healthScore, isDark);
          const StatusIcon = getStatusIcon(service.healthScore);
          const statusLabel = getStatusLabel(service.healthScore);

          return (
            <motion.div key={service.id} variants={itemVariants}>
              <Card className={cn(
                "bg-card/50 backdrop-blur-md relative overflow-hidden group",
                "transition-all duration-300 hover:shadow-lg",
                getHealthBorderClass(service.healthScore),
                getHealthGlowClass(service.healthScore),
              )}>
                {/* Subtle gradient overlay */}
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${color}, transparent 70%)`,
                  }}
                />

                <CardContent className="p-4 relative z-10">
                  {/* Top: Service name + status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        service.healthScore > 95
                          ? 'bg-emerald-400 animate-pulse'
                          : service.healthScore >= 80
                            ? 'bg-amber-400'
                            : 'bg-red-400 animate-pulse'
                      )} />
                      <span className="text-sm font-medium text-foreground truncate">
                        {service.name}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] font-medium px-1.5 py-0 shrink-0',
                        getHealthColorClass(service.healthScore),
                        getHealthBorderClass(service.healthScore),
                        getHealthBgClass(service.healthScore),
                      )}
                    >
                      <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                      {statusLabel}
                    </Badge>
                  </div>

                  {/* Middle: Health ring + metrics */}
                  <div className="flex items-start gap-4 mb-3">
                    {/* Health score ring */}
                    <HealthRing
                      score={service.healthScore}
                      size={72}
                      strokeWidth={6}
                      color={color}
                      isDark={isDark}
                    />

                    {/* Key metrics */}
                    <div className="flex-1 space-y-2 min-w-0">
                      {/* Response time with sparkline */}
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-muted-foreground">Response</span>
                          <span className="text-xs font-semibold text-foreground">
                            {service.responseTime}ms
                          </span>
                        </div>
                        <MiniSparkline
                          data={service.sparkline}
                          color={color}
                          width={80}
                          height={24}
                        />
                      </div>

                      {/* Uptime */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Uptime</span>
                        <span className={cn('text-xs font-semibold', getHealthColorClass(service.uptime))}>
                          {service.uptime}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Footer info */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{service.lastChecked}</span>
                    </div>
                    {service.errorCount > 0 ? (
                      <div className="flex items-center gap-1 text-[10px] text-red-400">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>{service.errorCount} err/24h</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>No errors</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
