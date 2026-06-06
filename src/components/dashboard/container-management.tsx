'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Play, Square, RefreshCw, FileText, Terminal, Pause, Trash2,
  Cpu, HardDrive, Loader2, Filter, ChevronDown, ChevronRight,
  Container, Server, MemoryStick, FolderOpen, Box
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDockerStore, type ContainerInfo, type ProjectGroup } from '@/store/docker-store';
import { cn } from '@/lib/utils';
import { LogsDrawer } from '@/components/modals/logs-drawer';
import { TerminalModal } from '@/components/modals/terminal-modal';
import { useToast } from '@/hooks/use-toast';

const stateConfig: Record<string, { color: string; bgColor: string; label: string; dotClass: string }> = {
  running: { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', label: 'Running', dotClass: 'bg-emerald-400 animate-pulse' },
  exited: { color: 'text-red-400', bgColor: 'bg-red-500/10', label: 'Stopped', dotClass: 'bg-red-400' },
  paused: { color: 'text-amber-400', bgColor: 'bg-amber-500/10', label: 'Paused', dotClass: 'bg-amber-400' },
  restarting: { color: 'text-sky-400', bgColor: 'bg-sky-500/10', label: 'Restarting', dotClass: 'bg-sky-400 animate-pulse' },
  dead: { color: 'text-red-500', bgColor: 'bg-red-500/10', label: 'Dead', dotClass: 'bg-red-500' },
  created: { color: 'text-muted-foreground', bgColor: 'bg-muted/10', label: 'Created', dotClass: 'bg-muted-foreground' },
};

function getStateConfig(state: string) {
  return stateConfig[state] || stateConfig.exited;
}

function extractPortMappings(portsStr: string): string[] {
  if (!portsStr) return [];
  // Parse Docker port format: "0.0.0.0:8080->80/tcp, :::3000->3000/tcp"
  const mappings: string[] = [];
  const parts = portsStr.split(', ');
  for (const part of parts) {
    const match = part.match(/->(\d+\/tcp)/);
    if (match) {
      const hostMatch = part.match(/:(\d+)->/);
      if (hostMatch) {
        mappings.push(`${hostMatch[1]}→${match[1].replace('/tcp', '')}`);
      } else {
        mappings.push(match[1].replace('/tcp', ''));
      }
    }
  }
  return mappings;
}

interface ContainerManagementProps {
  onCreateService?: () => void;
}

export function ContainerManagement({ onCreateService }: ContainerManagementProps) {
  const { projects, systemResources, isLoading, fetchContainers, fetchSystemResources, startContainer, stopContainer, restartContainer, pauseContainer, unpauseContainer, removeContainer } = useDockerStore();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [loadingActions, setLoadingActions] = useState<Record<string, string[]>>({});
  const [loadingProjects, setLoadingProjects] = useState<Record<string, string>>({});

  // Container modals
  const [selectedContainer, setSelectedContainer] = useState<ContainerInfo | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchContainers();
    fetchSystemResources();
  }, [fetchContainers, fetchSystemResources]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchContainers();
      fetchSystemResources();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchContainers, fetchSystemResources]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchContainers(), fetchSystemResources()]);
      toast({ title: 'Refreshed', description: 'Container list updated.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAction = async (container: ContainerInfo, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'remove') => {
    setLoadingActions(prev => ({
      ...prev,
      [container.id]: [...(prev[container.id] || []), action]
    }));

    try {
      if (action === 'start') await startContainer(container.id);
      else if (action === 'stop') await stopContainer(container.id);
      else if (action === 'restart') await restartContainer(container.id);
      else if (action === 'pause') await pauseContainer(container.id);
      else if (action === 'unpause') await unpauseContainer(container.id);
      else if (action === 'remove') await removeContainer(container.id, true);

      toast({ title: `Container ${action}ed`, description: `${container.name} has been ${action}ed.` });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: `Failed to ${action}`,
        description: err instanceof Error ? err.message : `Could not ${action} ${container.name}.`,
      });
    } finally {
      setLoadingActions(prev => ({
        ...prev,
        [container.id]: (prev[container.id] || []).filter(a => a !== action)
      }));
    }
  };

  // Apply a lifecycle action to every container in a project (the whole service).
  const handleProjectAction = async (project: ProjectGroup, action: 'start' | 'stop' | 'restart' | 'remove') => {
    const containers = project.containers || [];
    if (containers.length === 0) return;

    setLoadingProjects(prev => ({ ...prev, [project.name]: action }));
    try {
      const results = await Promise.allSettled(
        containers.map(c => {
          if (action === 'start') return startContainer(c.id);
          if (action === 'stop') return stopContainer(c.id);
          if (action === 'restart') return restartContainer(c.id);
          return removeContainer(c.id, true);
        })
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        throw new Error(`${failed} of ${containers.length} container(s) failed`);
      }
      toast({
        title: `Service ${action}ed`,
        description: `${project.name} (${containers.length} container${containers.length > 1 ? 's' : ''}) ${action}ed.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: `Failed to ${action} service`,
        description: err instanceof Error ? err.message : `Could not ${action} ${project.name}.`,
      });
    } finally {
      setLoadingProjects(prev => {
        const next = { ...prev };
        delete next[project.name];
        return next;
      });
    }
  };

  const isProjectBusy = (projectName: string) => Boolean(loadingProjects[projectName]);
  const isProjectAction = (projectName: string, action: string) => loadingProjects[projectName] === action;

  const openLogs = (container: ContainerInfo) => {
    setSelectedContainer(container);
    setIsLogsOpen(true);
  };

  const openTerminal = (container: ContainerInfo) => {
    setSelectedContainer(container);
    setIsTerminalOpen(true);
  };

  const isActionLoading = (containerId: string, action: string) => {
    return loadingActions[containerId]?.includes(action);
  };

  const toggleProject = (projectName: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectName)) next.delete(projectName);
      else next.add(projectName);
      return next;
    });
  };

  // Flatten all containers for stats
  const allContainers = projects.flatMap(p => p.containers || []);
  const runningCount = allContainers.filter(c => c.state === 'running').length;
  const stoppedCount = allContainers.filter(c => c.state === 'exited' || c.state === 'dead').length;

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const containers = project.containers || [];
    const matchesState = stateFilter === 'all' ||
      containers.some(c => c.state === stateFilter);
    return matchesState;
  });

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Services</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage and monitor your Docker containers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="h-10 w-10 border-border/50 hover:bg-muted"
            >
              <RefreshCw className={cn('w-4 h-4', (isRefreshing || isLoading) && 'animate-spin')} />
            </Button>
            <Button
              onClick={onCreateService}
              className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Service
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <Card className="bg-gradient-to-br from-emerald-500/[0.06] to-card/50 border-border/50 overflow-hidden relative group">
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Play className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{runningCount}</p>
                  <p className="text-xs text-muted-foreground">Running</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/[0.06] to-card/50 border-border/50 overflow-hidden relative group">
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Square className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{stoppedCount}</p>
                  <p className="text-xs text-muted-foreground">Stopped</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/[0.06] to-card/50 border-border/50 overflow-hidden relative group">
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{projects.length}</p>
                  <p className="text-xs text-muted-foreground">Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/[0.06] to-card/50 border-border/50 overflow-hidden relative group">
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Container className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{allContainers.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* System Resources */}
        {systemResources && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">CPU</span>
                  <span className="ml-auto text-lg font-semibold text-primary">{systemResources?.cpu_percent?.toFixed(1) ?? '0.0'}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                 <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(systemResources?.cpu_percent ?? 0, 100)}%` }} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <MemoryStick className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Memory</span>
                  <span className="ml-auto text-lg font-semibold text-amber-400">{systemResources?.memory_percent?.toFixed(1) ?? '0.0'}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                 <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${Math.min(systemResources?.memory_percent ?? 0, 100)}%` }} />
                </div>
               <p className="text-[10px] text-muted-foreground mt-1">{(systemResources?.memory_used ?? 0).toFixed(0)} / {(systemResources?.memory_total ?? 0).toFixed(0)} MB</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Disk</span>
                  <span className="ml-auto text-lg font-semibold text-emerald-400">{systemResources?.disk_percent?.toFixed(1) ?? '0.0'}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${Math.min(systemResources?.disk_percent ?? 0, 100)}%` }} />
                </div>
               <p className="text-[10px] text-muted-foreground mt-1">{(systemResources?.disk_used ?? 0).toFixed(0)} / {(systemResources?.disk_total ?? 0).toFixed(0)} GB</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-input/50 border-border/50">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="exited">Stopped</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Loading State */}
        {isLoading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm">Loading containers...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && projects.length === 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                <Box className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">No containers found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No Docker containers are currently running. Deploy a service to get started.
              </p>
              <Button onClick={onCreateService} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Create New Service
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Container Groups */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredProjects.map((project, index) => {
              const isExpanded = expandedProjects.has(project.name);
              const projectRunning = project.containers?.filter(c => c.state === 'running').length || 0;
              const projectTotal = project.containers?.length || 0;

              return (
                <motion.div
                  key={project.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-card/50 border-border/50 overflow-hidden">
                    {/* Project Header */}
                    <div className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <button
                        onClick={() => toggleProject(project.name)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <motion.div
                          animate={{ rotate: isExpanded ? 0 : -90 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </motion.div>
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Server className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-foreground truncate">{project.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                            {projectRunning}/{projectTotal} running
                          </Badge>
                        </div>
                      </button>

                      {/* Status dots */}
                      <div className="hidden sm:flex items-center gap-1 shrink-0">
                        {project.containers?.slice(0, 4).map((c, i) => (
                          <div
                            key={i}
                            className={cn('w-2 h-2 rounded-full', getStateConfig(c.state).dotClass)}
                          />
                        ))}
                      </div>

                      {/* Service-level actions (apply to every container in the service) */}
                      <div className="flex items-center gap-1 shrink-0">
                        {projectRunning < projectTotal && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10"
                                onClick={() => handleProjectAction(project, 'start')}
                                disabled={isProjectBusy(project.name)}
                              >
                                {isProjectAction(project.name, 'start') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Start all</TooltipContent>
                          </Tooltip>
                        )}
                        {projectRunning > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                                onClick={() => handleProjectAction(project, 'stop')}
                                disabled={isProjectBusy(project.name)}
                              >
                                {isProjectAction(project.name, 'stop') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Stop all</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => handleProjectAction(project, 'restart')}
                              disabled={isProjectBusy(project.name)}
                            >
                              {isProjectAction(project.name, 'restart') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Restart all</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                              onClick={() => handleProjectAction(project, 'remove')}
                              disabled={isProjectBusy(project.name)}
                            >
                              {isProjectAction(project.name, 'remove') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove all</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Containers List */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border/30">
                            {(project.containers || []).map((container) => {
                              const config = getStateConfig(container.state);
                              const portMappings = extractPortMappings(container.ports);
                              const isRunning = container.state === 'running';

                              return (
                                <div
                                  key={container.id}
                                  className={cn(
                                    'flex items-center gap-3 p-4 pl-12 border-b border-border/20 last:border-b-0',
                                    'hover:bg-muted/20 transition-colors'
                                  )}
                                >
                                  {/* Container Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={cn('w-2 h-2 rounded-full shrink-0', config.dotClass)} />
                                      <span className="text-sm font-medium text-foreground truncate">{container.name}</span>
                                      <Badge className={cn('text-[10px] px-1.5 py-0 h-4', config.bgColor, config.color, 'border-0')}>
                                        {config.label}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground ml-4">
                                      <span className="font-mono">{container.image}</span>
                                      {container.service && (
                                        <>
                                          <span className="text-muted-foreground/30">•</span>
                                          <span>{container.service}</span>
                                        </>
                                      )}
                                      {portMappings.length > 0 && (
                                        <>
                                          <span className="text-muted-foreground/30">•</span>
                                          <span className="text-primary/80">{portMappings.join(', ')}</span>
                                        </>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/60 ml-4 mt-0.5">{container.status}</p>
                                  </div>

                                  {/* Actions - all on the right side */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Start/Stop */}
                                    {container.state === 'running' ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                                            onClick={() => handleAction(container, 'stop')}
                                            disabled={isActionLoading(container.id, 'stop')}
                                          >
                                            {isActionLoading(container.id, 'stop') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Stop</TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10"
                                            onClick={() => handleAction(container, 'start')}
                                            disabled={isActionLoading(container.id, 'start')}
                                          >
                                            {isActionLoading(container.id, 'start') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Start</TooltipContent>
                                      </Tooltip>
                                    )}

                                    {/* Restart */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                          onClick={() => handleAction(container, 'restart')}
                                          disabled={isActionLoading(container.id, 'restart')}
                                        >
                                          {isActionLoading(container.id, 'restart') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Restart</TooltipContent>
                                    </Tooltip>

                                    {/* Divider */}
                                    <div className="w-px h-4 bg-border/50 mx-0.5" />

                                    {/* Pause/Unpause - only for running/paused containers */}
                                    {container.state === 'running' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10"
                                            onClick={() => handleAction(container, 'pause')}
                                            disabled={isActionLoading(container.id, 'pause')}
                                          >
                                            {isActionLoading(container.id, 'pause') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Pause</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {container.state === 'paused' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10"
                                            onClick={() => handleAction(container, 'unpause')}
                                            disabled={isActionLoading(container.id, 'unpause')}
                                          >
                                            {isActionLoading(container.id, 'unpause') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Unpause</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {/* Logs */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                                          onClick={() => openLogs(container)}
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Logs</TooltipContent>
                                    </Tooltip>
                                    {/* Terminal - only for running containers */}
                                    {isRunning && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                                            onClick={() => openTerminal(container)}
                                          >
                                            <Terminal className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Terminal</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {/* Remove */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                                          onClick={() => handleAction(container, 'remove')}
                                          disabled={isActionLoading(container.id, 'remove')}
                                        >
                                          {isActionLoading(container.id, 'remove') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Remove</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Logs Drawer */}
      {selectedContainer && (
        <LogsDrawer
          open={isLogsOpen}
          onOpenChange={setIsLogsOpen}
          containerId={selectedContainer.id}
          containerName={selectedContainer.name}
        />
      )}

      {/* Terminal Modal */}
      {selectedContainer && (
        <TerminalModal
          open={isTerminalOpen}
          onOpenChange={setIsTerminalOpen}
          containerId={selectedContainer.id}
          containerName={selectedContainer.name}
        />
      )}
    </TooltipProvider>
  );
}
