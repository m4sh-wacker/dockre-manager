'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Play, Square, RefreshCw, FileText, Terminal, Cpu, MemoryStick, CalendarPlus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDockerStore, type DockerContainer, type ContainerStatus } from '@/store/docker-store';
import { getTimeRemaining } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { CreateServiceModal } from '@/components/modals/create-service-modal';
import { LogsDrawer } from '@/components/modals/logs-drawer';
import { TerminalModal } from '@/components/modals/terminal-modal';
import { RenewModal } from '@/components/modals/renew-modal';
import { useToast } from '@/hooks/use-toast';

const statusConfig: Record<ContainerStatus, { color: string; bgColor: string; pulseClass: string; label: string }> = {
  running: { 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-400', 
    pulseClass: 'animate-pulse-green',
    label: 'Running' 
  },
  stopped: { 
    color: 'text-red-400', 
    bgColor: 'bg-red-400', 
    pulseClass: 'animate-pulse-red',
    label: 'Stopped' 
  },
  exited: { 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-400', 
    pulseClass: 'animate-pulse-yellow',
    label: 'Exited' 
  },
};

export function ContainerManagement() {
  const { containers, updateContainerStatus } = useDockerStore();
  const { toast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [loadingActions, setLoadingActions] = useState<Record<string, string[]>>({});

  const handleAction = async (container: DockerContainer, action: 'start' | 'stop' | 'restart') => {
    setLoadingActions(prev => ({
      ...prev,
      [container.id]: [...(prev[container.id] || []), action]
    }));

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    let newStatus: ContainerStatus;
    if (action === 'start') {
      newStatus = 'running';
    } else if (action === 'stop') {
      newStatus = 'stopped';
    } else {
      newStatus = 'running';
    }

    updateContainerStatus(container.id, newStatus);
    
    setLoadingActions(prev => ({
      ...prev,
      [container.id]: (prev[container.id] || []).filter(a => a !== action)
    }));

    toast({
      title: `Service ${action}ed`,
      description: `${container.serviceName} has been ${action}ed successfully.`,
    });
  };

  const openLogs = (container: DockerContainer) => {
    setSelectedContainer(container);
    setIsLogsOpen(true);
  };

  const openTerminal = (container: DockerContainer) => {
    setSelectedContainer(container);
    setIsTerminalOpen(true);
  };

  const openRenew = (container: DockerContainer) => {
    setSelectedContainer(container);
    setIsRenewOpen(true);
  };

  const isActionLoading = (containerId: string, action: string) => {
    return loadingActions[containerId]?.includes(action);
  };

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
            <h1 className="text-2xl font-semibold text-foreground">Active Services</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage and monitor your Docker containers
            </p>
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary-sm hover:glow-primary transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Service
          </Button>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Play className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {containers.filter(c => c.status === 'running').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Running</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Square className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {containers.filter(c => c.status === 'stopped').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Stopped</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {containers.filter(c => c.status === 'exited').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Exited</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-card/50 border-border/50 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Service Name
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Ports
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Time Remaining
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Resources
                    </th>
                    <th className="text-right px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  <AnimatePresence mode="popLayout">
                    {containers.map((container, index) => {
                      const config = statusConfig[container.status];
                      const timeRemaining = getTimeRemaining(container.expiresAt);
                      
                      return (
                        <motion.tr
                          key={container.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: index * 0.05 }}
                          className="group hover:bg-muted/20 transition-colors"
                        >
                          {/* Service Name */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-primary/50" />
                              <span className="font-medium text-foreground">
                                {container.serviceName}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                'w-2 h-2 rounded-full',
                                config.bgColor,
                                config.pulseClass
                              )} />
                              <Badge 
                                variant="outline"
                                className={cn(
                                  'font-medium border-current',
                                  config.color
                                )}
                              >
                                {config.label}
                              </Badge>
                            </div>
                          </td>

                          {/* Ports */}
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {container.frontendPort && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  Frontend: {container.frontendPort}
                                </Badge>
                              )}
                              {container.backendPort && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  Backend: {container.backendPort}
                                </Badge>
                              )}
                              {!container.frontendPort && !container.backendPort && (
                                <span className="text-muted-foreground text-sm">No ports exposed</span>
                              )}
                            </div>
                          </td>

                          {/* Time Remaining */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Clock className={cn(
                                'w-4 h-4',
                                timeRemaining.isCritical 
                                  ? 'text-red-400' 
                                  : timeRemaining.isUrgent 
                                    ? 'text-amber-400' 
                                    : 'text-muted-foreground'
                              )} />
                              <span className={cn(
                                'text-sm font-medium',
                                timeRemaining.isCritical 
                                  ? 'text-red-400' 
                                  : timeRemaining.isUrgent 
                                    ? 'text-amber-400' 
                                    : 'text-muted-foreground'
                              )}>
                                {timeRemaining.text}
                              </span>
                              {timeRemaining.isUrgent && (
                                <motion.div
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{ duration: 1, repeat: Infinity }}
                                  className="w-1.5 h-1.5 rounded-full bg-red-400"
                                />
                              )}
                            </div>
                          </td>

                          {/* Resources */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5 text-sm">
                                <Cpu className="w-4 h-4 text-primary/70" />
                                <span className="text-muted-foreground">{container.cpu}%</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-sm">
                                <MemoryStick className="w-4 h-4 text-primary/70" />
                                <span className="text-muted-foreground">{container.memory} MB</span>
                              </div>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-400/10"
                                    onClick={() => handleAction(container, 'start')}
                                    disabled={container.status === 'running' || isActionLoading(container.id, 'start')}
                                  >
                                    <Play className={cn('w-4 h-4', isActionLoading(container.id, 'start') && 'animate-pulse')} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Start</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={() => handleAction(container, 'restart')}
                                    disabled={isActionLoading(container.id, 'restart')}
                                  >
                                    <RefreshCw className={cn('w-4 h-4', isActionLoading(container.id, 'restart') && 'animate-spin')} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restart</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                                    onClick={() => handleAction(container, 'stop')}
                                    disabled={container.status === 'stopped' || isActionLoading(container.id, 'stop')}
                                  >
                                    <Square className={cn('w-4 h-4', isActionLoading(container.id, 'stop') && 'animate-pulse')} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Stop</TooltipContent>
                              </Tooltip>

                              <div className="w-px h-6 bg-border/50 mx-1" />

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={cn(
                                      'h-8 w-8 text-muted-foreground hover:bg-muted',
                                      timeRemaining.isUrgent && 'hover:text-amber-400'
                                    )}
                                    onClick={() => openRenew(container)}
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
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                                    onClick={() => openLogs(container)}
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
                                    onClick={() => openTerminal(container)}
                                  >
                                    <Terminal className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Terminal</TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {containers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No containers found</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  Create your first service
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Modals */}
      <CreateServiceModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
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
    </TooltipProvider>
  );
}
