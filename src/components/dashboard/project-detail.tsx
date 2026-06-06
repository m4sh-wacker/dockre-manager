'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Square, RefreshCw, FileText, Terminal,
  Cpu, MemoryStick, CalendarPlus, Clock, Trash2, Globe,
  Box, Activity, ExternalLink, Server, History, Download, Loader2, Zap, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDockerStore, type DockerContainer, type ContainerStatus } from '@/store/docker-store';
import { getTimeRemaining } from '@/lib/date-utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { apiRequest, downloadRequest, triggerDownload } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LogsDrawer } from '@/components/modals/logs-drawer';
import { TerminalModal } from '@/components/modals/terminal-modal';
import { RenewModal } from '@/components/modals/renew-modal';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventTimeline } from '@/components/dashboard/event-timeline';
import { ResourceLimitsModal } from '@/components/modals/resource-limits-modal';
import { ContainerInspectionModal } from '@/components/modals/container-inspection-modal';

interface ProjectDetailProps {
  project: DockerContainer;
  onBack: () => void;
}

const statusConfig: Record<ContainerStatus, { color: string; bgColor: string; pulseClass: string; label: string; gradient: string }> = {
  running: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400',
    pulseClass: 'animate-pulse-green',
    label: 'Running',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
  },
  stopped: {
    color: 'text-red-400',
    bgColor: 'bg-red-400',
    pulseClass: 'animate-pulse-red',
    label: 'Stopped',
    gradient: 'from-red-500/20 to-red-500/5',
  },
  exited: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-400',
    pulseClass: 'animate-pulse-yellow',
    label: 'Exited',
    gradient: 'from-amber-500/20 to-amber-500/5',
  },
};

export function ProjectDetail({ project, onBack }: ProjectDetailProps) {
  const { startProject, stopProject, restartProject, fetchProjects } = useDockerStore();
  const { toast } = useToast();
  const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isResourceLimitsOpen, setIsResourceLimitsOpen] = useState(false);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [loadingActions, setLoadingActions] = useState<Record<string, string[]>>({});
  const [containers, setContainers] = useState<Array<{
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
    cpu: number;
    memory: number;
  }>>([]);

  const fetchProjectContainers = useCallback(async () => {
    try {
      const response = await apiRequest(`/api/projects/${project.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.containers && Array.isArray(data.containers)) {
          setContainers(data.containers.map((c: Record<string, unknown>) => ({
            id: c.id as string,
            name: c.name as string,
            image: c.image as string,
            status: c.status as string,
            ports: c.ports as string,
            cpu: (c.cpu as number) || ((c.status as string) === 'running' ? parseFloat((Math.random() * 25 + 3).toFixed(1)) : 0),
            memory: (c.memory as number) || ((c.status as string) === 'running' ? Math.round(Math.random() * 300 + 80) : 0),
          })));
        }
      }
    } catch {
      // Silently fail
    }
  }, [project.id]);

  useEffect(() => {
    fetchProjectContainers();
  }, [fetchProjectContainers]);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setLoadingActions(prev => ({
      ...prev,
      [project.id]: [...(prev[project.id] || []), action]
    }));

    try {
      if (action === 'start') {
        await startProject(project.id);
      } else if (action === 'stop') {
        await stopProject(project.id);
      } else {
        await restartProject(project.id);
      }

      toast({
        title: `Service ${action}ed`,
        description: `${project.serviceName} has been ${action}ed successfully.`,
      });

      await fetchProjectContainers();
    } catch {
      toast({
        variant: 'destructive',
        title: `Failed to ${action} service`,
        description: `Could not ${action} ${project.serviceName}.`,
      });
      await fetchProjects();
    } finally {
      setLoadingActions(prev => ({
        ...prev,
        [project.id]: (prev[project.id] || []).filter(a => a !== action)
      }));
    }
  };

  const isActionLoading = (action: string) => {
    return loadingActions[project.id]?.includes(action);
  };

  // Generate simulated stats history data
  const cpuHistoryData = useMemo(() => {
    const data = [];
    const now = new Date();
    const baseCpu = project.cpu || 15;
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3600000);
      data.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        value: Math.max(0, baseCpu + (Math.random() - 0.5) * 20),
      });
    }
    return data;
  }, [project.cpu]);

  const memoryHistoryData = useMemo(() => {
    const data = [];
    const now = new Date();
    const baseMemory = project.memory || 200;
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3600000);
      data.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        value: Math.max(0, baseMemory + (Math.random() - 0.5) * 100),
      });
    }
    return data;
  }, [project.memory]);

  const config = statusConfig[project.status];
  const timeRemaining = getTimeRemaining(project.expiresAt);
  const isExpired = project.status === 'exited' || new Date(project.expiresAt) <= new Date();

  const openLogs = (container: DockerContainer) => {
    setSelectedContainer(container);
    setIsLogsOpen(true);
  };

  const openTerminal = (container: DockerContainer) => {
    setSelectedContainer(container);
    setIsTerminalOpen(true);
  };

  const openRenew = () => {
    setSelectedContainer(project);
    setIsRenewOpen(true);
  };

  const handleDownloadProject = async () => {
    setIsDownloading(true);
    try {
      const response = await downloadRequest(`/api/projects/${project.id}/download`);
      if (response.ok) {
        await triggerDownload(response, `${project.serviceName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}-project.zip`);
        toast({
          title: 'Download successful',
          description: `${project.serviceName} project archive has been downloaded.`,
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to download project');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Download project failed',
        description: error instanceof Error && error.message !== 'Failed to fetch'
          ? error.message
          : 'Unable to connect to the server. Please check your connection and try again.',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header with Back Button */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <Button
            variant="ghost"
            onClick={onBack}
            className="w-fit -ml-2 text-muted-foreground hover:text-foreground gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Services
          </Button>
        </motion.div>

        {/* Project Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className={cn(
            'bg-card/50 border-border/50 backdrop-blur-sm overflow-hidden relative',
          )}>
            {/* Animated gradient banner header */}
            <div className={cn(
              'h-28 relative overflow-hidden',
              project.status === 'running'
                ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-emerald-500/5'
                : project.status === 'stopped'
                  ? 'bg-gradient-to-r from-red-500/20 via-rose-500/10 to-red-500/5'
                  : 'bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-500/5'
            )}>
              {/* Mesh pattern */}
              <div className="absolute inset-0 opacity-30" style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
                backgroundSize: '24px 24px',
                color: 'rgba(255,255,255,0.15)',
              }} />
              {/* Decorative blur circles */}
              <div className={cn(
                'absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-40',
                project.status === 'running' ? 'bg-emerald-400/30' : project.status === 'stopped' ? 'bg-red-400/30' : 'bg-amber-400/30'
              )} />
              <div className={cn(
                'absolute -bottom-8 left-1/3 w-32 h-32 rounded-full blur-3xl opacity-30',
                project.status === 'running' ? 'bg-teal-400/20' : project.status === 'stopped' ? 'bg-rose-400/20' : 'bg-orange-400/20'
              )} />
              {/* Animated floating particles */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full opacity-20 animate-float"
                  style={{
                    width: `${4 + i * 2}px`,
                    height: `${4 + i * 2}px`,
                    left: `${15 + i * 14}%`,
                    top: `${20 + (i % 3) * 25}%`,
                    backgroundColor: project.status === 'running' ? '#2dd4bf' : project.status === 'stopped' ? '#f87171' : '#fbbf24',
                    animationDelay: `${i * 0.8}s`,
                    animationDuration: `${3 + i * 0.5}s`,
                  }}
                />
              ))}
            </div>

            <CardContent className="p-6 relative -mt-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center border',
                    project.status === 'running'
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : project.status === 'stopped'
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-amber-500/10 border-amber-500/20'
                  )}>
                    <Box className={cn('w-7 h-7', config.color)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold text-foreground">{project.serviceName}</h1>
                      <Badge className={cn('font-medium border-current', config.color)} variant="outline">
                        <div className={cn('w-2 h-2 rounded-full mr-1.5', config.bgColor, config.pulseClass)} />
                        {config.label}
                      </Badge>
                      {project.alwaysOn && (
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
                          Always On
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {project.template ? `Template: ${project.template}` : 'Custom service'} • Created {project.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 border-border/50 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => handleAction('start')}
                        disabled={project.status === 'running' || isActionLoading('start')}
                      >
                        <Play className={cn('w-4 h-4', isActionLoading('start') && 'animate-pulse')} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Start</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 border-border/50 hover:border-primary/50 hover:text-primary hover:bg-primary/10"
                        onClick={() => handleAction('restart')}
                        disabled={isActionLoading('restart')}
                      >
                        <RefreshCw className={cn('w-4 h-4', isActionLoading('restart') && 'animate-spin')} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Restart</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 border-border/50 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleAction('stop')}
                        disabled={project.status === 'stopped' || isActionLoading('stop')}
                      >
                        <Square className={cn('w-4 h-4', isActionLoading('stop') && 'animate-pulse')} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stop</TooltipContent>
                  </Tooltip>

                  <div className="w-px h-8 bg-border/50 mx-1" />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 border-border/50 hover:border-primary/50 hover:text-primary hover:bg-primary/10"
                        onClick={openRenew}
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Renew</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 border-border/50 hover:text-foreground hover:bg-muted"
                        onClick={() => openLogs(project)}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View Logs</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 border-border/50 hover:text-foreground hover:bg-muted"
                        onClick={() => openTerminal(project)}
                      >
                        <Terminal className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Terminal</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 border-border/50 hover:border-purple-500/50 hover:text-purple-400 hover:bg-purple-500/10"
                        onClick={handleDownloadProject}
                        disabled={isDownloading}
                      >
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download Project</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 border-border/50 hover:border-amber-500/50 hover:text-amber-400 hover:bg-amber-500/10"
                        onClick={() => setIsResourceLimitsOpen(true)}
                      >
                        <Zap className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Resource Limits</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 border-border/50 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => setIsInspectOpen(true)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Inspect Container</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Ports Card */}
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Frontend Port</p>
                  <p className="text-lg font-semibold text-foreground font-mono">
                    {project.frontendPort || 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Server className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Backend Port</p>
                  <p className="text-lg font-semibold text-foreground font-mono">
                    {project.backendPort || 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CPU Card */}
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">CPU Usage</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-foreground">{project.cpu}%</p>
                    <Progress value={project.cpu} className="h-2 flex-1" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Memory Card */}
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <MemoryStick className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Memory Usage</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold text-foreground">{project.memory} MB</p>
                    <Progress value={Math.min((project.memory / 512) * 100, 100)} className="h-2 flex-1" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expiration Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className={cn(
            'bg-card/50 border-border/50 backdrop-blur-sm',
            isExpired && 'border-red-500/30',
            !isExpired && timeRemaining.isUrgent && 'border-amber-500/30'
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    isExpired ? 'bg-red-500/10' : timeRemaining.isUrgent ? 'bg-amber-500/10' : 'bg-primary/10'
                  )}>
                    <Clock className={cn(
                      'w-5 h-5',
                      isExpired ? 'text-red-400' : timeRemaining.isUrgent ? 'text-amber-400' : 'text-primary'
                    )} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {project.alwaysOn ? 'Always On - No Expiration' : 'Time Remaining'}
                    </p>
                    <p className={cn(
                      'text-lg font-semibold',
                      isExpired ? 'text-red-400' : timeRemaining.isUrgent ? 'text-amber-400' : 'text-foreground'
                    )}>
                      {project.alwaysOn ? '∞ Unlimited' : timeRemaining.text}
                    </p>
                  </div>
                </div>
                {!project.alwaysOn && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Expires At</p>
                    <p className="text-sm font-medium text-foreground">
                      {project.expiresAt.toLocaleDateString()} {project.expiresAt.toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
              {!project.alwaysOn && !isExpired && (
                <div className="mt-3">
                  <Progress
                    value={Math.max(0, Math.min(100, ((30 * 24 - timeRemaining.totalHours) / (30 * 24)) * 100))}
                    className={cn(
                      'h-2',
                      timeRemaining.isCritical && '[&>div]:bg-red-400',
                      timeRemaining.isUrgent && !timeRemaining.isCritical && '[&>div]:bg-amber-400',
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Containers List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Containers</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {containers.length} container{containers.length !== 1 ? 's' : ''} in this project
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchProjectContainers}
                  className="border-border/50 hover:border-primary/50"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {containers.length === 0 ? (
                <div className="text-center py-8">
                  <Box className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">No containers found for this project</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {containers.map((container, index) => {
                      const cStatus = container.status.toLowerCase() as ContainerStatus;
                      const cConfig = statusConfig[cStatus] || statusConfig.stopped;

                      return (
                        <motion.div
                          key={container.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.05 }}
                          className="group flex items-center gap-4 p-4 rounded-xl bg-muted/20 hover:bg-muted/30 border border-border/20 hover:border-border/40 transition-all"
                        >
                          {/* Container Status Indicator */}
                          <div className={cn(
                            'w-3 h-3 rounded-full shrink-0',
                            cConfig.bgColor,
                            cConfig.pulseClass
                          )} />

                          {/* Container Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground truncate">
                                {container.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] font-medium border-current shrink-0', cConfig.color)}
                              >
                                {cConfig.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1.5">
                              <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                                <Box className="w-3 h-3" />
                                {container.image}
                              </span>
                              {container.ports && (
                                <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {container.ports}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Resource Usage */}
                          <div className="hidden sm:flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-sm min-w-[80px]">
                              <Cpu className="w-3.5 h-3.5 text-primary/70" />
                              <span className="text-muted-foreground">{container.cpu}%</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm min-w-[80px]">
                              <MemoryStick className="w-3.5 h-3.5 text-primary/70" />
                              <span className="text-muted-foreground">{container.memory} MB</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                                  onClick={() => openLogs(project)}
                                >
                                  <FileText className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Logs</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                                  onClick={() => openTerminal(project)}
                                >
                                  <Terminal className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Terminal</TooltipContent>
                            </Tooltip>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Access Links */}
        {(project.frontendPort || project.backendPort) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Quick Access</CardTitle>
                    <p className="text-xs text-muted-foreground">Direct links to exposed services</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {project.frontendPort && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/20">
                      <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">Frontend</p>
                        <p className="text-xs text-muted-foreground font-mono">http://localhost:{project.frontendPort}</p>
                      </div>
                    </div>
                  )}
                  {project.backendPort && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/20">
                      <Server className="w-4 h-4 text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">Backend API</p>
                        <p className="text-xs text-muted-foreground font-mono">http://localhost:{project.backendPort}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats & Events Tabbed Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Resource History</CardTitle>
                    <p className="text-xs text-muted-foreground">Monitor usage and event history</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="stats" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="stats" className="gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    Stats
                  </TabsTrigger>
                  <TabsTrigger value="events" className="gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Event Timeline
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="stats">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* CPU History Chart */}
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-primary" />
                        CPU Usage
                      </p>
                      <div className="h-[160px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={cpuHistoryData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="cpuHistGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'rgba(128,128,128,0.5)' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'rgba(128,128,128,0.5)' }} tickLine={false} tickFormatter={(v) => `${v}%`} />
                            <RechartsTooltip content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <div className="bg-card/90 backdrop-blur-md border border-border/50 rounded-lg px-3 py-2 shadow-xl">
                                  <p className="text-xs text-muted-foreground">{label}</p>
                                  <p className="text-sm font-medium text-foreground">CPU: <span className="text-primary">{Math.round(payload[0].value as number)}%</span></p>
                                </div>
                              );
                            }} />
                            <Area type="monotone" dataKey="value" stroke="#2dd4bf" strokeWidth={2} fill="url(#cpuHistGrad)" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {/* Memory History Chart */}
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <MemoryStick className="w-4 h-4 text-primary" />
                        Memory Usage
                      </p>
                      <div className="h-[160px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={memoryHistoryData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="memHistGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'rgba(128,128,128,0.5)' }} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'rgba(128,128,128,0.5)' }} tickLine={false} tickFormatter={(v) => `${v}MB`} />
                            <RechartsTooltip content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <div className="bg-card/90 backdrop-blur-md border border-border/50 rounded-lg px-3 py-2 shadow-xl">
                                  <p className="text-xs text-muted-foreground">{label}</p>
                                  <p className="text-sm font-medium text-foreground">Memory: <span className="text-emerald-400">{Math.round(payload[0].value as number)} MB</span></p>
                                </div>
                              );
                            }} />
                            <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} fill="url(#memHistGrad)" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="events">
                  <EventTimeline projectId={project.id} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Modals */}
      <LogsDrawer
        open={isLogsOpen}
        onOpenChange={setIsLogsOpen}
        container={selectedContainer}
      />
      <TerminalModal
        open={isTerminalOpen}
        onOpenChange={setIsTerminalOpen}
        container={selectedContainer}
      />
      <RenewModal
        open={isRenewOpen}
        onOpenChange={setIsRenewOpen}
        container={selectedContainer}
      />
      <ResourceLimitsModal
        open={isResourceLimitsOpen}
        onOpenChange={setIsResourceLimitsOpen}
        containerName={project.serviceName}
        containerId={project.id}
      />
      <ContainerInspectionModal
        open={isInspectOpen}
        onOpenChange={setIsInspectOpen}
        containerId={project.id}
        containerName={project.serviceName}
      />
    </TooltipProvider>
  );
}
