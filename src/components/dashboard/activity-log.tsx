'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Filter, RefreshCw, Clock,
  AlertTriangle, Info, AlertCircle, Bug, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, TrendingUp, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';
import { useTheme } from 'next-themes';

interface LogItem {
  id: string;
  projectId: string;
  containerId?: string;
  level: string;
  message: string;
  timestamp: string;
  project?: {
    name: string;
  };
}

const levelConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; borderColor: string; dotColor: string }> = {
  info: { icon: Info, color: 'text-sky-400', bgColor: 'bg-sky-400/10', borderColor: 'border-l-sky-400', dotColor: 'bg-sky-400' },
  warn: { icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-400/10', borderColor: 'border-l-amber-400', dotColor: 'bg-amber-400' },
  error: { icon: AlertCircle, color: 'text-red-400', bgColor: 'bg-red-400/10', borderColor: 'border-l-red-400', dotColor: 'bg-red-400' },
  debug: { icon: Bug, color: 'text-purple-400', bgColor: 'bg-purple-400/10', borderColor: 'border-l-purple-400', dotColor: 'bg-purple-400' },
};

// Animated counter component
function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    startTime.current = null;
    const startVal = prevValue.current;
    const endVal = value;
    prevValue.current = value;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startVal + (endVal - startVal) * eased));

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate);
      }
    };

    animationFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, [value, duration]);

  return <>{displayValue}</>;
}

// Mini sparkline component (simple SVG)
function MiniSparkline({ data, color, width = 60, height = 20 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// SVG Donut chart for log level distribution
function LogLevelDonut({ stats }: { stats: { info: number; warn: number; error: number; debug: number } }) {
  const total = stats.info + stats.warn + stats.error + stats.debug;
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (total === 0) return null;

  const segments = [
    { label: 'Info', value: stats.info, color: '#38bdf8' },      // sky-400
    { label: 'Warn', value: stats.warn, color: '#fbbf24' },      // amber-400
    { label: 'Error', value: stats.error, color: '#f87171' },    // red-400
    { label: 'Debug', value: stats.debug, color: '#c084fc' },    // purple-400
  ];

  const size = 120;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const arcs = segments.map((seg) => {
    const percentage = total > 0 ? (seg.value / total) * 100 : 0;
    const dashLength = (percentage / 100) * circumference;
    const offset = currentOffset;
    currentOffset += dashLength;
    return { ...seg, percentage, dashLength, offset };
  });

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {arcs.map((arc) => {
            if (arc.value === 0) return null;
            return (
              <circle
                key={arc.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc.dashLength} ${circumference - arc.dashLength}`}
                strokeDashoffset={-arc.offset}
                strokeLinecap="round"
                className="animate-ring-fill"
                style={{
                  '--ring-circumference': circumference,
                  '--ring-offset': 0,
                } as React.CSSProperties}
              />
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-foreground">{total}</span>
          <span className="text-[9px] text-muted-foreground">events</span>
        </div>
      </div>
      {/* Legend */}
      <div className="space-y-2">
        {arcs.map((arc) => (
          <div key={arc.label} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: arc.color }}
            />
            <span className="text-xs text-muted-foreground w-10">{arc.label}</span>
            <span className="text-xs font-medium text-foreground w-6 text-right">{arc.value}</span>
            <span className="text-[10px] text-muted-foreground w-10 text-right">
              {arc.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Relative time helper
function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return then.toLocaleDateString();
}

export function ActivityLog() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    return matchesLevel;
  });

  const stats = {
    total: logs.length,
    info: logs.filter(l => l.level === 'info').length,
    warn: logs.filter(l => l.level === 'warn').length,
    error: logs.filter(l => l.level === 'error').length,
    debug: logs.filter(l => l.level === 'debug').length,
  };

  // Quick stats - simulated last 24h counts
  const quickStats = useMemo(() => {
    const now = new Date();
    const last24h = logs.filter(l => {
      const diff = now.getTime() - new Date(l.timestamp).getTime();
      return diff < 24 * 60 * 60 * 1000;
    });
    return {
      events24h: last24h.length,
      errors24h: last24h.filter(l => l.level === 'error').length,
      warns24h: last24h.filter(l => l.level === 'warn').length,
    };
  }, [logs]);

  // Simulated sparkline data
  const sparklines = useMemo(() => ({
    total: [3, 5, 4, 7, 6, 8, 5, stats.total > 0 ? Math.min(stats.total, 10) : 3],
    info: [2, 3, 3, 5, 4, 6, 4, Math.min(stats.info, 8)],
    warn: [1, 0, 1, 1, 2, 1, 1, Math.min(stats.warn, 5)],
    error: [0, 1, 0, 0, 1, 0, 0, Math.min(stats.error, 3)],
  }), [stats]);

  // Trend indicators (simulated)
  const trends = useMemo(() => ({
    total: { value: 2.3, up: true },
    info: { value: 1.5, up: true },
    warn: { value: 0.8, up: false },
    error: { value: 1.2, up: false },
  }), []);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' },
    },
  };

  // Active filter count
  const activeFilterCount = (levelFilter !== 'all' ? 1 : 0);

  return (
    <TooltipProvider>
      <motion.div
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* === Header - Enhanced with Gradient Banner === */}
        <motion.div variants={itemVariants}>
          <div className="relative overflow-hidden rounded-xl border border-border/50">
            {/* Gradient background */}
            <div className={cn(
              "absolute inset-0",
              isDark
                ? "bg-gradient-to-br from-primary/15 via-card to-amber-500/10"
                : "bg-gradient-to-br from-primary/10 via-card to-amber-500/5"
            )} />
            {/* Animated mesh pattern */}
            <div className="welcome-banner-mesh absolute inset-0" />
            {/* Decorative radial glow */}
            <div className={cn(
              "absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl",
              isDark ? "bg-primary/10" : "bg-primary/5"
            )} />
            <div className={cn(
              "absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-3xl",
              isDark ? "bg-amber-500/8" : "bg-amber-500/5"
            )} />

            {/* Content */}
            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    <span className="text-foreground">Activity </span>
                    <span className="hero-gradient-text">Log</span>
                  </h1>
                  <p className="text-muted-foreground text-sm mt-2 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    Monitor system events and service activities
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "gap-1.5 px-3 py-1.5 text-xs",
                    quickStats.errors24h > 0
                      ? "bg-red-500/15 text-red-400 border-red-500/30"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  )}>
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      quickStats.errors24h > 0 ? "bg-red-400 animate-pulse-red" : "bg-emerald-400 animate-pulse-green"
                    )} />
                    {quickStats.errors24h > 0 ? `${quickStats.errors24h} errors` : 'Healthy'}
                  </Badge>
                  <Button
                    variant="outline"
                    onClick={fetchLogs}
                    disabled={isLoading}
                    className="w-fit border-border/50 hover:border-primary/50"
                  >
                    <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* === Stats Cards - Enhanced === */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {/* Total Events */}
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Card className={cn(
              "bg-card/50 border-border/50 backdrop-blur-sm group metric-glow-primary overflow-hidden relative",
              isDark ? "bg-gradient-to-br from-primary/5 to-card/50" : "bg-gradient-to-br from-primary/3 to-card/50"
            )}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/[0.04] rounded-full blur-2xl -translate-y-6 translate-x-6 group-hover:bg-primary/[0.08] transition-colors" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <MiniSparkline
                    data={sparklines.total}
                    color={isDark ? '#2dd4bf' : '#14b8a6'}
                  />
                </div>
                <p className="text-2xl font-semibold text-foreground animate-number-count" style={{ '--count-delay': '100ms' } as React.CSSProperties}>
                  <AnimatedCounter value={stats.total} />
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Total Events</p>
                  <span className={cn(
                    'text-[10px] font-medium flex items-center gap-0.5',
                    trends.total.up ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {trends.total.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trends.total.value}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Info */}
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Card className={cn(
              "bg-card/50 border-border/50 backdrop-blur-sm group metric-glow-sky overflow-hidden relative",
              isDark ? "bg-gradient-to-br from-sky-500/5 to-card/50" : "bg-gradient-to-br from-sky-500/3 to-card/50"
            )}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-sky-400/[0.04] rounded-full blur-2xl -translate-y-6 translate-x-6 group-hover:bg-sky-400/[0.08] transition-colors" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
                    <Info className="w-5 h-5 text-sky-400" />
                  </div>
                  <MiniSparkline
                    data={sparklines.info}
                    color="#38bdf8"
                  />
                </div>
                <p className="text-2xl font-semibold text-foreground animate-number-count" style={{ '--count-delay': '200ms' } as React.CSSProperties}>
                  <AnimatedCounter value={stats.info} />
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Info</p>
                  <span className={cn(
                    'text-[10px] font-medium flex items-center gap-0.5',
                    trends.info.up ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {trends.info.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trends.info.value}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Warnings */}
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Card className={cn(
              "bg-card/50 border-border/50 backdrop-blur-sm group metric-glow-amber overflow-hidden relative",
              isDark ? "bg-gradient-to-br from-amber-500/5 to-card/50" : "bg-gradient-to-br from-amber-500/3 to-card/50"
            )}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-amber-400/[0.04] rounded-full blur-2xl -translate-y-6 translate-x-6 group-hover:bg-amber-400/[0.08] transition-colors" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <MiniSparkline
                    data={sparklines.warn}
                    color="#fbbf24"
                  />
                </div>
                <p className="text-2xl font-semibold text-foreground animate-number-count" style={{ '--count-delay': '300ms' } as React.CSSProperties}>
                  <AnimatedCounter value={stats.warn} />
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Warnings</p>
                  <span className={cn(
                    'text-[10px] font-medium flex items-center gap-0.5',
                    trends.warn.up ? 'text-emerald-400' : 'text-amber-400'
                  )}>
                    {trends.warn.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trends.warn.value}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Errors */}
          <motion.div
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Card className={cn(
              "bg-card/50 border-border/50 backdrop-blur-sm group metric-glow-red overflow-hidden relative",
              isDark ? "bg-gradient-to-br from-red-500/5 to-card/50" : "bg-gradient-to-br from-red-500/3 to-card/50"
            )}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-red-400/[0.04] rounded-full blur-2xl -translate-y-6 translate-x-6 group-hover:bg-red-400/[0.08] transition-colors" />
              <CardContent className="p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <MiniSparkline
                    data={sparklines.error}
                    color="#f87171"
                  />
                </div>
                <p className="text-2xl font-semibold text-foreground animate-number-count" style={{ '--count-delay': '400ms' } as React.CSSProperties}>
                  <AnimatedCounter value={stats.error} />
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Errors</p>
                  <span className={cn(
                    'text-[10px] font-medium flex items-center gap-0.5',
                    trends.error.up ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {trends.error.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trends.error.value}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* === Log Level Distribution Chart === */}
        <motion.div variants={itemVariants}>
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm shimmer-border-sweep">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">Log Level Distribution</h3>
                  <p className="text-[10px] text-muted-foreground">Breakdown of event severity levels</p>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <LogLevelDonut stats={stats} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* === Quick Stats Bar === */}
        <motion.div variants={itemVariants}>
          <div className={cn(
            "flex items-center gap-4 px-4 py-2.5 rounded-lg border border-border/30",
            isDark
              ? "bg-gradient-to-r from-muted/30 to-muted/10"
              : "bg-gradient-to-r from-muted/20 to-muted/5"
          )}>
            <Zap className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">
              Last 24h:
            </span>
            <span className="text-xs font-medium text-foreground">
              {quickStats.events24h} events
            </span>
            <span className="text-border/50">|</span>
            <span className={cn(
              "text-xs font-medium",
              quickStats.errors24h > 0 ? "text-red-400" : "text-emerald-400"
            )}>
              {quickStats.errors24h} error{quickStats.errors24h !== 1 ? 's' : ''}
            </span>
            <span className="text-border/50">|</span>
            <span className="text-xs font-medium text-amber-400">
              {quickStats.warns24h} warning{quickStats.warns24h !== 1 ? 's' : ''}
            </span>
            <div className="flex-1" />
            <span className="text-[10px] text-muted-foreground">
              Auto-refreshes every 30s
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-green" />
          </div>
        </motion.div>

        {/* === Filters - Enhanced with count badge === */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative">
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[160px] bg-input/50 border-border/50">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            {activeFilterCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center bg-primary text-primary-foreground text-[10px] px-1.5 animate-badge-pop">
                {filteredLogs.length}
              </Badge>
            )}
          </div>
        </motion.div>

        {/* === Log List - Enhanced with Timeline, Zebra, Colored Borders === */}
        <motion.div variants={itemVariants}>
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-16 relative">
                  {/* Floating decorations */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <Activity className="w-8 h-8 text-primary/10 absolute top-8 left-[15%] animate-empty-float-1" />
                    <AlertTriangle className="w-6 h-6 text-amber-400/10 absolute top-16 right-[20%] animate-empty-float-2" />
                    <Info className="w-7 h-7 text-sky-400/10 absolute bottom-12 left-[25%] animate-empty-float-3" />
                  </div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center">
                      <Activity className="w-7 h-7 text-primary/30" />
                    </div>
                    <p className="text-lg font-medium text-foreground/70">No logs found</p>
                    <p className="text-sm text-muted-foreground mt-1">Events will appear here as services are managed</p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline vertical line */}
                  <div className="absolute left-[23px] top-0 bottom-0 w-px bg-border/30" />

                  <AnimatePresence mode="popLayout">
                    {filteredLogs.map((log, index) => {
                      const config = levelConfig[log.level] || levelConfig.info;
                      const Icon = config.icon;
                      const isExpanded = expandedLog === log.id;
                      const isEven = index % 2 === 0;

                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            "relative flex items-start gap-0 border-l-2 transition-colors group cursor-pointer",
                            config.borderColor,
                            isEven
                              ? (isDark ? "bg-transparent" : "bg-transparent")
                              : (isDark ? "bg-muted/[0.03]" : "bg-muted/[0.04]"),
                            "hover:bg-muted/10"
                          )}
                          onClick={() => setExpandedLog(prev => prev === log.id ? null : log.id)}
                        >
                          {/* Timeline dot */}
                          <div className="relative z-10 flex items-center justify-center w-12 shrink-0 pt-4">
                            <div className={cn(
                              "w-3 h-3 rounded-full border-2 border-card",
                              config.dotColor
                            )} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 p-4 pl-0">
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                                config.bgColor
                              )}>
                                <Icon className={cn('w-4 h-4', config.color)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    variant="outline"
                                    className={cn('text-[10px] font-medium px-1.5 py-0 border-current', config.color)}
                                  >
                                    {log.level.toUpperCase()}
                                  </Badge>
                                  {log.project?.name && (
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {log.project.name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-foreground/90 break-words">
                                  {log.message}
                                </p>

                                {/* Expanded details */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className={cn(
                                        "mt-2 p-3 rounded-lg space-y-1.5",
                                        isDark
                                          ? "bg-gradient-to-br from-muted/40 to-muted/20"
                                          : "bg-gradient-to-br from-muted/30 to-muted/10"
                                      )}>
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-muted-foreground">Log ID</span>
                                          <span className="font-mono text-foreground">{log.id}</span>
                                        </div>
                                        {log.projectId && (
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">Project ID</span>
                                            <span className="font-mono text-foreground">{log.projectId}</span>
                                          </div>
                                        )}
                                        {log.containerId && (
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">Container ID</span>
                                            <span className="font-mono text-foreground">{log.containerId}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-muted-foreground">Timestamp</span>
                                          <span className="font-mono text-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-muted-foreground">Level</span>
                                          <span className={cn('font-medium', config.color)}>{log.level.toUpperCase()}</span>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {/* Expand indicator */}
                                <div className="flex items-center gap-1 mt-1">
                                  {isExpanded ? (
                                    <ChevronUp className="w-3 h-3 text-muted-foreground/50" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
                                  )}
                                </div>
                              </div>

                              {/* Timestamp - relative with absolute on hover */}
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 ml-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 cursor-help">
                                      <Clock className="w-3 h-3" />
                                      <span>{getRelativeTime(log.timestamp)}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <span className="text-xs">{new Date(log.timestamp).toLocaleString()}</span>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </TooltipProvider>
  );
}
