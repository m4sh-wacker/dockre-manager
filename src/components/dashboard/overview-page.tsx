'use client';

import { useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Boxes, Activity, Clock, Cpu, HardDrive, MemoryStick,
  Plus, Layers, TrendingUp, Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useDockerStore } from '@/store/docker-store';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

interface OverviewPageProps {
  onNavigate: (tab: string) => void;
  onCreateService: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatMemoryMB(mb: number): string {
  if (mb === 0) return '0 MB';
  if (mb < 1024) return mb.toFixed(1) + ' MB';
  return (mb / 1024).toFixed(1) + ' GB';
}

function formatDiskGB(gb: number): string {
  if (gb === 0) return '0 GB';
  if (gb < 1024) return gb.toFixed(1) + ' GB';
  return (gb / 1024).toFixed(1) + ' TB';
}

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

export function OverviewPage({ onNavigate, onCreateService }: OverviewPageProps) {
  const {
    projects,
    systemResources,
    isLoading,
    fetchContainers,
    fetchSystemResources,
  } = useDockerStore();
  const { user } = useAuthStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch data on mount and every 30 seconds
  const fetchData = useCallback(() => {
    fetchContainers();
    fetchSystemResources();
  }, [fetchContainers, fetchSystemResources]);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 30000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData]);

  // Compute stats from real data
  const allContainers = projects.flatMap(p => p.containers || []);
  const runningCount = allContainers.filter(c => c.state === 'running').length;
  const stoppedCount = allContainers.filter(c => c.state === 'exited' || c.state === 'dead').length;
  const totalCount = allContainers.length;
  const uptimePercentage = totalCount > 0 ? Math.round((runningCount / totalCount) * 100) : 0;

  const username = user?.username || 'Admin';

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Welcome Header */}
      <motion.div variants={itemVariants}>
        <div className="relative overflow-hidden rounded-xl border border-border/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-card to-emerald-500/10" />
          <div className="welcome-banner-mesh absolute inset-0" />
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl bg-primary/10" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-3xl bg-emerald-500/8" />

          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                  <span className="text-foreground">{getGreeting()}, </span>
                  <span className="hero-gradient-text">{username}</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-2 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDate()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {runningCount > 0 ? (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5 px-3 py-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    All systems operational
                  </Badge>
                ) : totalCount > 0 ? (
                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1.5 px-3 py-1.5 text-xs">
                    <Activity className="w-3 h-3" />
                    All services stopped
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Docker Stats Section */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Boxes className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-sm font-medium text-foreground">Docker Stats</h2>
        </div>
        {isLoading && projects.length === 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-card/50 border-border/50 backdrop-blur-sm">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <Skeleton className="h-5 w-10 rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Running Containers */}
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm group hover:shadow-lg hover:shadow-emerald-500/5 transition-shadow bg-gradient-to-br from-emerald-500/5 to-card/50">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                    <Activity className="w-5 h-5 text-emerald-400" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400">
                    Active
                  </Badge>
                </div>
                <p className="text-2xl sm:text-3xl font-semibold text-foreground">{runningCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Running Containers</p>
              </CardContent>
            </Card>

            {/* Stopped Containers */}
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm group hover:shadow-lg hover:shadow-red-500/5 transition-shadow bg-gradient-to-br from-red-500/5 to-card/50">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                    <Boxes className="w-5 h-5 text-red-400" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono bg-red-500/10 text-red-400">
                    Stopped
                  </Badge>
                </div>
                <p className="text-2xl sm:text-3xl font-semibold text-foreground">{stoppedCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Stopped Containers</p>
              </CardContent>
            </Card>

            {/* Total Containers */}
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm group hover:shadow-lg hover:shadow-primary/5 transition-shadow bg-gradient-to-br from-primary/5 to-card/50">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Layers className="w-5 h-5 text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {runningCount}/{totalCount}
                  </Badge>
                </div>
                <p className="text-2xl sm:text-3xl font-semibold text-foreground">{totalCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Containers</p>
                {totalCount > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden flex">
                      <div className="h-full bg-emerald-400" style={{ width: `${(runningCount / totalCount) * 100}%` }} />
                      <div className="h-full bg-red-400" style={{ width: `${(stoppedCount / totalCount) * 100}%` }} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Uptime */}
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm group hover:shadow-lg hover:shadow-amber-500/5 transition-shadow bg-gradient-to-br from-amber-500/5 to-card/50">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-semibold text-foreground">{uptimePercentage}%</p>
                <p className="text-xs text-muted-foreground mt-1">Service Uptime</p>
                <Progress value={uptimePercentage} className="mt-3 h-1.5 bg-amber-500/10 [&>div]:bg-amber-400" />
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>

      {/* System Resources Section */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <HardDrive className="w-4 h-4 text-primary" />
          </div>
         <h2 className="text-sm font-medium text-foreground">System Resources</h2>
       </div>
       {!systemResources || systemResources.memory_total === 0 ? (
         <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
           <CardHeader className="pb-2">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-7 h-7 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-6 mt-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-3 w-full rounded-full" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <HardDrive className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-medium">System Resources</CardTitle>
                    <CardDescription className="text-[10px]">Real-time system metrics</CardDescription>
                  </div>
                </div>
               <Badge className={cn(
                 'gap-1.5 text-[10px]',
                 (systemResources?.docker_running ?? 0) > 0
                   ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                   : 'bg-red-500/15 text-red-400 border-red-500/30'
               )}>
                 <span className={cn(
                   'w-1.5 h-1.5 rounded-full',
                   (systemResources?.docker_running ?? 0) > 0 ? 'bg-emerald-400' : 'bg-red-400'
                 )} />
                 Docker: {systemResources?.docker_running ?? 0}/{systemResources?.docker_total ?? 0}
               </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-4">
                {/* CPU */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Cpu className="w-4 h-4" /> CPU
                    </span>
                    <span className="font-semibold text-foreground">
                      {systemResources?.cpu_percent?.toFixed(1) ?? '0.0'}%
                    </span>
                  </div>
                 <div className="h-3 rounded-full bg-muted overflow-hidden">
                   <motion.div
                     initial={{ width: 0 }}
                     animate={{ width: `${Math.min(systemResources?.cpu_percent ?? 0, 100)}%` }}
                     transition={{ duration: 1, ease: 'easeOut' }}
                     className={cn(
                       'h-full rounded-full',
                       (systemResources?.cpu_percent ?? 0) > 80 ? 'bg-red-400' :
                       (systemResources?.cpu_percent ?? 0) > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                     )}
                   />
                  </div>
                </div>

                {/* Memory */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <MemoryStick className="w-4 h-4" /> Memory
                    </span>
                    <span className="font-semibold text-foreground">
                      {systemResources?.memory_percent?.toFixed(1) ?? '0.0'}%
                    </span>
                  </div>
                 <div className="h-3 rounded-full bg-muted overflow-hidden">
                   <motion.div
                     initial={{ width: 0 }}
                     animate={{ width: `${Math.min(systemResources?.memory_percent ?? 0, 100)}%` }}
                     transition={{ duration: 1, ease: 'easeOut' }}
                     className={cn(
                       'h-full rounded-full',
                       (systemResources?.memory_percent ?? 0) > 80 ? 'bg-red-400' :
                       (systemResources?.memory_percent ?? 0) > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                     )}
                   />
                 </div>
                 <p className="text-[10px] text-muted-foreground">
                   {formatMemoryMB(systemResources?.memory_used ?? 0)} / {formatMemoryMB(systemResources?.memory_total ?? 0)}
                 </p>
                </div>

                {/* Disk */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4" /> Disk
                    </span>
                    <span className="font-semibold text-foreground">
                      {systemResources?.disk_percent?.toFixed(1) ?? '0.0'}%
                    </span>
                  </div>
                 <div className="h-3 rounded-full bg-muted overflow-hidden">
                   <motion.div
                     initial={{ width: 0 }}
                     animate={{ width: `${Math.min(systemResources?.disk_percent ?? 0, 100)}%` }}
                     transition={{ duration: 1, ease: 'easeOut' }}
                     className={cn(
                       'h-full rounded-full',
                       (systemResources?.disk_percent ?? 0) > 80 ? 'bg-red-400' :
                       (systemResources?.disk_percent ?? 0) > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                     )}
                   />
                 </div>
                 <p className="text-[10px] text-muted-foreground">
                   {formatDiskGB(systemResources?.disk_used ?? 0)} / {formatDiskGB(systemResources?.disk_total ?? 0)}
                 </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Quick Actions Section */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <Button
                variant="outline"
                className="h-auto py-3 flex-col gap-2 border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                onClick={onCreateService}
              >
                <Plus className="w-5 h-5 text-primary" />
                <span className="text-xs">Create New Service</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-3 flex-col gap-2 border-border/50 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors"
                onClick={() => onNavigate('containers')}
              >
                <Boxes className="w-5 h-5 text-emerald-400" />
                <span className="text-xs">View Services</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
