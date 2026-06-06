'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Copy, Check, Eye, EyeOff, ArrowRight, Globe,
  Cpu, MemoryStick, HardDrive, Network, Server, Box,
  Shield, Clock, Layers, Activity, Loader2, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContainerInspectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  containerName: string;
}

interface InspectData {
  id: string;
  created: string;
  path: string;
  args: string[];
  state: {
    status: string;
    running: boolean;
    paused: boolean;
    restarting: boolean;
    OOMKilled: boolean;
    dead: boolean;
    pid: number;
    exitCode: number;
    error: string;
    startedAt: string;
    finishedAt: string;
  };
  image: string;
  name: string;
  restartCount: number;
  driver: string;
  platform: string;
  hostConfig: {
    binds: string[];
    logConfig: { type: string; config: Record<string, string> };
    networkMode: string;
    portBindings: Record<string, Array<{ hostIp: string; hostPort: string }>>;
    restartPolicy: { name: string; maximumRetryCount: number };
    autoRemove: boolean;
    resources: {
      cpuShares: number;
      memory: number;
      memorySwap: number;
      memoryReservation: number;
      cpuPeriod: number;
      cpuQuota: number;
      cpus: number;
      pidsLimit: number;
      nanoCpus: number;
      oomKillDisable: boolean;
      blkioWeight: number;
    };
  };
  mounts: Array<{
    type: string;
    name: string;
    source: string;
    destination: string;
    driver: string;
    mode: string;
    rw: boolean;
    propagation: string;
  }>;
  config: {
    hostname: string;
    domainname: string;
    user: string;
    attachStdin: boolean;
    attachStdout: boolean;
    attachStderr: boolean;
    exposedPorts: Record<string, object>;
    tty: boolean;
    openStdin: boolean;
    stdinOnce: boolean;
    env: string[];
    cmd: string[];
    healthcheck: {
      test: string[];
      interval: number;
      timeout: number;
      retries: number;
      startPeriod: number;
    };
    image: string;
    volumes: Record<string, object>;
    workingDir: string;
    entrypoint: string[];
    stopSignal: string;
    labels: Record<string, string>;
  };
  networkSettings: {
    bridge: string;
    ports: Record<string, Array<{ hostIp: string; hostPort: string }>>;
    gateway: string;
    ipAddress: string;
    ipPrefixLen: number;
    macAddress: string;
    networks: Record<string, {
      ipamConfig: string[] | null;
      networkID: string;
      endpointID: string;
      gateway: string;
      ipAddress: string;
      ipPrefixLen: number;
      ipv6Gateway: string;
      globalIPv6Address: string;
      globalIPv6PrefixLen: number;
      macAddress: string;
    }>;
  };
}

// ─── Sensitive key detection ─────────────────────────────────────────────────

const SENSITIVE_PATTERNS = /PASSWORD|SECRET|KEY|TOKEN|API_KEY|PRIVATE|CREDENTIAL|AUTH/i;

function isSensitiveEnvKey(key: string): boolean {
  return SENSITIVE_PATTERNS.test(key);
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Could not copy to clipboard.',
      });
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted/80 transition-colors shrink-0"
      title="Copy"
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400" />
      ) : (
        <Copy className="w-3 h-3 text-muted-foreground" />
      )}
    </button>
  );
}

// ─── Key-value row ───────────────────────────────────────────────────────────

function KVRow({
  label,
  value,
  mono = false,
  copyable = false,
  isSensitive = false,
  index = 0,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  isSensitive?: boolean;
  index?: number;
}) {
  const [masked, setMasked] = useState(isSensitive);

  return (
    <div
      className={cn(
        'grid grid-cols-[140px_1fr_auto] gap-3 px-4 py-2.5 items-center',
        index % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.03]',
      )}
    >
      <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        {isSensitive && (
          <button
            onClick={() => setMasked(!masked)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title={masked ? 'Show value' : 'Hide value'}
          >
            {masked ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
        )}
        <span
          className={cn(
            'text-sm truncate',
            mono && 'font-mono text-[13px]',
            isSensitive && masked && 'text-muted-foreground/60',
          )}
        >
          {isSensitive && masked ? '•'.repeat(Math.min(value.length, 24)) : value || '—'}
        </span>
      </div>
      {copyable && <CopyButton text={value} />}
    </div>
  );
}

// ─── Status badge with pulse ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bgColor: string; label: string }> = {
    running: { color: 'text-emerald-400', bgColor: 'bg-emerald-400', label: 'Running' },
    stopped: { color: 'text-red-400', bgColor: 'bg-red-400', label: 'Stopped' },
    exited: { color: 'text-amber-400', bgColor: 'bg-amber-400', label: 'Exited' },
    paused: { color: 'text-sky-400', bgColor: 'bg-sky-400', label: 'Paused' },
    restarting: { color: 'text-violet-400', bgColor: 'bg-violet-400', label: 'Restarting' },
  };

  const c = config[status.toLowerCase()] || config.stopped;

  return (
    <Badge variant="outline" className={cn('font-medium border-current gap-1.5', c.color)}>
      <span className={cn('w-2 h-2 rounded-full', c.bgColor, status === 'running' && 'animate-pulse')} />
      {c.label}
    </Badge>
  );
}

// ─── Port mapping diagram ────────────────────────────────────────────────────

function PortMappingDiagram({ ports }: { ports: Record<string, Array<{ hostIp: string; hostPort: string }>> }) {
  const entries = Object.entries(ports);
  if (entries.length === 0) {
    return <span className="text-sm text-muted-foreground italic">No port mappings</span>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([containerPort, bindings], i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          {/* External */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 min-w-[100px]">
            <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono text-emerald-400 font-medium">
              {bindings[0]?.hostPort || '?'}
            </span>
          </div>

          {/* Arrow */}
          <div className="flex items-center gap-1">
            <div className="w-6 h-px bg-border" />
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="w-6 h-px bg-border" />
          </div>

          {/* Internal */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 min-w-[100px]">
            <Server className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="font-mono text-sky-400 font-medium">{containerPort}</span>
          </div>

          {/* Host IP */}
          {bindings[0]?.hostIp && bindings[0].hostIp !== '0.0.0.0' && (
            <span className="text-xs text-muted-foreground font-mono">({bindings[0].hostIp})</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton loading ────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="grid grid-cols-[140px_1fr] gap-3 items-center">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full max-w-[280px]" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ContainerInspectionModal({
  open,
  onOpenChange,
  containerId,
  containerName,
}: ContainerInspectionModalProps) {
  const [data, setData] = useState<InspectData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!containerId || !open) return;
    setIsLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(`/api/containers/${containerId}/inspect`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const inspectData = await response.json();
        setData(inspectData as InspectData);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to inspect',
          description: 'Could not fetch container inspection data.',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Network error',
        description: 'Could not connect to the server.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [containerId, open, toast]);

  useEffect(() => {
    if (open && containerId) {
      fetchData();
      setActiveTab('overview');
    }
  }, [open, containerId, fetchData]);

  // Parse env vars from string array
  const parsedEnv = data?.config.env.map((e) => {
    const idx = e.indexOf('=');
    const key = idx >= 0 ? e.substring(0, idx) : e;
    const value = idx >= 0 ? e.substring(idx + 1) : '';
    return { key, value, isSensitive: isSensitiveEnvKey(key) };
  }) || [];

  const parsedLabels = data ? Object.entries(data.config.labels).map(([key, value]) => ({ key, value })) : [];

  const shortId = data?.id ? data.id.replace('sha256:', '').substring(0, 12) : containerId.substring(0, 12);
  const containerShortName = data?.name ? data.name.replace(/^\//, '') : containerName;

  // Format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format nanoseconds to seconds
  const formatNanoToSec = (ns: number) => (ns / 1e9).toFixed(0) + 's';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Search className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span>Container Inspection</span>
                {data && <StatusBadge status={data.state.status} />}
              </div>
              <p className="text-sm font-normal text-muted-foreground mt-0.5 truncate">
                {containerShortName}
                <span className="ml-2 font-mono text-xs text-muted-foreground/60">{shortId}</span>
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <div className="px-6 pt-2 border-b border-border/30">
            <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-0">
              <TabsTrigger
                value="overview"
                className={cn(
                  'gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-400',
                  'text-muted-foreground hover:text-foreground transition-colors',
                )}
              >
                <Info className="w-3.5 h-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="configuration"
                className={cn(
                  'gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-sky-400',
                  'text-muted-foreground hover:text-foreground transition-colors',
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                Configuration
              </TabsTrigger>
              <TabsTrigger
                value="mounts"
                className={cn(
                  'gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-violet-400',
                  'text-muted-foreground hover:text-foreground transition-colors',
                )}
              >
                <HardDrive className="w-3.5 h-3.5" />
                Mounts & Network
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                className={cn(
                  'gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-amber-400',
                  'text-muted-foreground hover:text-foreground transition-colors',
                )}
              >
                <Cpu className="w-3.5 h-3.5" />
                Resource Limits
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content */}
          <ScrollArea className="max-h-[60vh]">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SkeletonLoader />
                </motion.div>
              ) : data ? (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* ─── Overview Tab ─── */}
                  {activeTab === 'overview' && (
                    <div className="p-2">
                      {/* Accent bar */}
                      <div className="h-1 w-full bg-gradient-to-r from-emerald-500/40 via-emerald-400/20 to-transparent rounded-full mb-4" />

                      <div className="divide-y divide-border/20">
                        {/* Section: Identity */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Box className="w-3.5 h-3.5" />
                            Identity
                          </h3>
                          <KVRow label="Container ID" value={data.id.replace('sha256:', '')} mono copyable index={0} />
                          <KVRow label="Name" value={containerShortName} mono copyable index={1} />
                          <KVRow label="Image" value={data.config.image} mono copyable index={2} />
                          <KVRow label="Image SHA" value={data.image.replace('sha256:', '').substring(0, 24) + '...'} mono copyable index={3} />
                        </div>

                        {/* Section: Status */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5" />
                            Status
                          </h3>
                          <KVRow label="Status" value={data.state.status} index={0} />
                          <KVRow label="PID" value={String(data.state.pid)} mono index={1} />
                          <KVRow label="Exit Code" value={String(data.state.exitCode)} mono index={2} />
                          <KVRow label="Restart Count" value={String(data.restartCount)} mono index={3} />
                          <KVRow label="Started At" value={new Date(data.state.startedAt).toLocaleString()} index={4} />
                        </div>

                        {/* Section: Details */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Server className="w-3.5 h-3.5" />
                            Details
                          </h3>
                          <KVRow label="Platform" value={data.platform} index={0} />
                          <KVRow label="Driver" value={data.driver} index={1} />
                          <KVRow label="Created" value={new Date(data.created).toLocaleString()} index={2} />
                          <KVRow label="Hostname" value={data.config.hostname} mono index={3} />
                        </div>

                        {/* Section: Network Info */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Network className="w-3.5 h-3.5" />
                            Network Info
                          </h3>
                          <KVRow label="IP Address" value={data.networkSettings.ipAddress} mono copyable index={0} />
                          <KVRow label="MAC Address" value={data.networkSettings.macAddress} mono copyable index={1} />
                          <KVRow label="Gateway" value={data.networkSettings.gateway} mono index={2} />
                          <KVRow label="Network Mode" value={data.hostConfig.networkMode} index={3} />
                        </div>

                        {/* Section: Ports */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5" />
                            Port Mappings
                          </h3>
                          <div className="px-4 py-2">
                            <PortMappingDiagram ports={data.networkSettings.ports} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Configuration Tab ─── */}
                  {activeTab === 'configuration' && (
                    <div className="p-2">
                      {/* Accent bar */}
                      <div className="h-1 w-full bg-gradient-to-r from-sky-500/40 via-sky-400/20 to-transparent rounded-full mb-4" />

                      <div className="divide-y divide-border/20">
                        {/* Section: Environment Variables */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5" />
                            Environment Variables
                            <Badge variant="secondary" className="ml-auto bg-sky-500/10 text-sky-400 border-sky-500/20 text-[10px]">
                              {parsedEnv.length}
                            </Badge>
                          </h3>
                          <div className="rounded-lg border border-border/30 overflow-hidden">
                            {/* Header */}
                            <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-4 py-2 bg-muted/30">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Key</span>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Value</span>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-6" />
                            </div>
                            {parsedEnv.map((env, i) => (
                              <div
                                key={env.key}
                                className={cn(
                                  'grid grid-cols-[1fr_1fr_auto] gap-3 px-4 py-2 items-center',
                                  i % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.03]',
                                )}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {env.isSensitive && <EyeOff className="w-3 h-3 text-red-400/60 shrink-0" />}
                                  <span className="font-mono text-[13px] text-foreground truncate">{env.key}</span>
                                </div>
                                <EnvValueCell value={env.value} isSensitive={env.isSensitive} />
                                <CopyButton text={env.value} />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Section: Labels */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5" />
                            Labels
                            <Badge variant="secondary" className="ml-auto bg-sky-500/10 text-sky-400 border-sky-500/20 text-[10px]">
                              {parsedLabels.length}
                            </Badge>
                          </h3>
                          <div className="rounded-lg border border-border/30 overflow-hidden">
                            <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-4 py-2 bg-muted/30">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Key</span>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Value</span>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-6" />
                            </div>
                            {parsedLabels.map((label, i) => (
                              <div
                                key={label.key}
                                className={cn(
                                  'grid grid-cols-[1fr_1fr_auto] gap-3 px-4 py-2 items-center',
                                  i % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.03]',
                                )}
                              >
                                <span className="font-mono text-[13px] text-foreground truncate">{label.key}</span>
                                <span className="font-mono text-[13px] text-muted-foreground truncate">{label.value}</span>
                                <CopyButton text={label.value} />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Section: Process Config */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Server className="w-3.5 h-3.5" />
                            Process Configuration
                          </h3>
                          <KVRow label="Working Dir" value={data.config.workingDir} mono index={0} />
                          <KVRow label="Entrypoint" value={data.config.entrypoint.join(' ')} mono index={1} />
                          <KVRow label="Cmd" value={data.config.cmd.join(' ')} mono index={2} />
                          <KVRow label="User" value={data.config.user} index={3} />
                          <KVRow label="Stop Signal" value={data.config.stopSignal} mono index={4} />
                          <KVRow label="TTY" value={data.config.tty ? 'Yes' : 'No'} index={5} />
                          <KVRow label="Open Stdin" value={data.config.openStdin ? 'Yes' : 'No'} index={6} />
                          <KVRow label="Attach Stdin" value={data.config.attachStdin ? 'Yes' : 'No'} index={7} />
                          <KVRow label="Attach Stdout" value={data.config.attachStdout ? 'Yes' : 'No'} index={8} />
                          <KVRow label="Attach Stderr" value={data.config.attachStderr ? 'Yes' : 'No'} index={9} />
                        </div>

                        {/* Section: Health Check */}
                        {data.config.healthcheck && (
                          <div className="px-4 py-3">
                            <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <Activity className="w-3.5 h-3.5" />
                              Health Check
                            </h3>
                            <KVRow label="Test" value={data.config.healthcheck.test.join(' ')} mono index={0} />
                            <KVRow label="Interval" value={formatNanoToSec(data.config.healthcheck.interval)} index={1} />
                            <KVRow label="Timeout" value={formatNanoToSec(data.config.healthcheck.timeout)} index={2} />
                            <KVRow label="Retries" value={String(data.config.healthcheck.retries)} index={3} />
                            <KVRow label="Start Period" value={formatNanoToSec(data.config.healthcheck.startPeriod)} index={4} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ─── Mounts & Network Tab ─── */}
                  {activeTab === 'mounts' && (
                    <div className="p-2">
                      {/* Accent bar */}
                      <div className="h-1 w-full bg-gradient-to-r from-violet-500/40 via-violet-400/20 to-transparent rounded-full mb-4" />

                      <div className="divide-y divide-border/20">
                        {/* Section: Mount Points */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <HardDrive className="w-3.5 h-3.5" />
                            Mount Points
                            <Badge variant="secondary" className="ml-auto bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px]">
                              {data.mounts.length}
                            </Badge>
                          </h3>
                          <div className="rounded-lg border border-border/30 overflow-hidden">
                            <div className="grid grid-cols-[2fr_2fr_auto_auto_auto] gap-3 px-4 py-2 bg-muted/30">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Source</span>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Destination</span>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-16 text-center">Type</span>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-12 text-center">RW</span>
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-6" />
                            </div>
                            {data.mounts.map((mount, i) => (
                              <div
                                key={i}
                                className={cn(
                                  'grid grid-cols-[2fr_2fr_auto_auto_auto] gap-3 px-4 py-2.5 items-center',
                                  i % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.03]',
                                )}
                              >
                                <span className="font-mono text-[13px] text-foreground truncate" title={mount.source}>
                                  {mount.name || mount.source}
                                </span>
                                <span className="font-mono text-[13px] text-muted-foreground truncate" title={mount.destination}>
                                  {mount.destination}
                                </span>
                                <div className="flex justify-center">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] px-1.5 py-0 h-4',
                                      mount.type === 'volume'
                                        ? 'border-violet-500/30 text-violet-400'
                                        : mount.type === 'bind'
                                          ? 'border-amber-500/30 text-amber-400'
                                          : 'border-border/30 text-muted-foreground',
                                    )}
                                  >
                                    {mount.type}
                                  </Badge>
                                </div>
                                <div className="flex justify-center">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      'text-[10px] px-1.5 py-0 h-4',
                                      mount.rw
                                        ? 'border-emerald-500/30 text-emerald-400'
                                        : 'border-red-500/30 text-red-400',
                                    )}
                                  >
                                    {mount.rw ? 'RW' : 'RO'}
                                  </Badge>
                                </div>
                                <CopyButton text={`${mount.source}:${mount.destination}`} />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Section: Network Settings */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Network className="w-3.5 h-3.5" />
                            Network Settings
                          </h3>
                          <KVRow label="Gateway" value={data.networkSettings.gateway} mono index={0} />
                          <KVRow label="IP Address" value={data.networkSettings.ipAddress} mono copyable index={1} />
                          <KVRow label="IP Prefix Len" value={String(data.networkSettings.ipPrefixLen)} mono index={2} />
                          <KVRow label="MAC Address" value={data.networkSettings.macAddress} mono copyable index={3} />
                        </div>

                        {/* Section: Connected Networks */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5" />
                            Connected Networks
                            <Badge variant="secondary" className="ml-auto bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px]">
                              {Object.keys(data.networkSettings.networks).length}
                            </Badge>
                          </h3>
                          {Object.entries(data.networkSettings.networks).map(([networkName, net], ni) => (
                            <div key={networkName} className="mb-4 last:mb-0">
                              <div className="flex items-center gap-2 mb-2 px-4">
                                <div className="w-2 h-2 rounded-full bg-violet-400" />
                                <span className="text-sm font-semibold text-foreground">{networkName}</span>
                              </div>
                              <div className="ml-6 rounded-lg border border-border/20 overflow-hidden">
                                <KVRow label="Network ID" value={net.networkID.substring(0, 12)} mono copyable index={0} />
                                <KVRow label="Endpoint ID" value={net.endpointID.substring(0, 12)} mono index={1} />
                                <KVRow label="Gateway" value={net.gateway} mono index={2} />
                                <KVRow label="IP Address" value={net.ipAddress} mono index={3} />
                                <KVRow label="IP Prefix" value={String(net.ipPrefixLen)} mono index={4} />
                                <KVRow label="MAC Address" value={net.macAddress} mono index={5} />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Section: DNS / Ports from network */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5" />
                            Port Bindings
                          </h3>
                          <div className="px-4 py-2">
                            <PortMappingDiagram ports={data.hostConfig.portBindings} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Resource Limits Tab ─── */}
                  {activeTab === 'resources' && (
                    <div className="p-2">
                      {/* Accent bar */}
                      <div className="h-1 w-full bg-gradient-to-r from-amber-500/40 via-amber-400/20 to-transparent rounded-full mb-4" />

                      <div className="divide-y divide-border/20">
                        {/* Section: CPU */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Cpu className="w-3.5 h-3.5" />
                            CPU Limits
                          </h3>
                          <KVRow label="CPU Shares" value={String(data.hostConfig.resources.cpuShares)} mono index={0} />
                          <KVRow label="CPU Period" value={data.hostConfig.resources.cpuPeriod ? String(data.hostConfig.resources.cpuPeriod) + ' μs' : 'Unlimited'} mono index={1} />
                          <KVRow label="CPU Quota" value={data.hostConfig.resources.cpuQuota ? String(data.hostConfig.resources.cpuQuota) + ' μs' : 'Unlimited'} mono index={2} />
                          <KVRow label="NanoCPUs" value={String(data.hostConfig.resources.nanoCpus)} mono index={3} />
                          <KVRow label="CPUs" value={data.hostConfig.resources.cpus ? String(data.hostConfig.resources.cpus) : 'Unlimited'} mono index={4} />
                          <KVRow label="Cpuset Cpus" value={data.hostConfig.resources.cpusetCpus || 'All'} index={5} />
                          <KVRow label="Cpuset Mems" value={data.hostConfig.resources.cpusetMems || 'All'} index={6} />
                        </div>

                        {/* Section: Memory */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <MemoryStick className="w-3.5 h-3.5" />
                            Memory Limits
                          </h3>
                          <KVRow label="Memory Limit" value={formatBytes(data.hostConfig.resources.memory)} mono index={0} />
                          <KVRow label="Memory Swap" value={formatBytes(data.hostConfig.resources.memorySwap)} mono index={1} />
                          <KVRow label="Memory Reservation" value={formatBytes(data.hostConfig.resources.memoryReservation)} mono index={2} />
                          <KVRow label="Kernel Memory" value={String(0)} mono index={3} />
                          <KVRow label="Memory Swappiness" value="Default" index={4} />
                        </div>

                        {/* Section: Process & Advanced */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5" />
                            Process & Advanced
                          </h3>
                          <KVRow label="PIDs Limit" value={data.hostConfig.resources.pidsLimit > 0 ? String(data.hostConfig.resources.pidsLimit) : 'Unlimited'} mono index={0} />
                          <KVRow label="OOM Kill Disable" value={data.hostConfig.resources.oomKillDisable ? 'Yes' : 'No'} index={1} />
                          <KVRow label="Blkio Weight" value={String(data.hostConfig.resources.blkioWeight)} mono index={2} />
                          <KVRow label="Privileged" value={data.hostConfig.privileged ? 'Yes' : 'No'} index={3} />
                          <KVRow label="Read-Only Root" value={data.hostConfig.readonlyRootfs ? 'Yes' : 'No'} index={4} />
                          <KVRow label="Auto Remove" value={data.hostConfig.autoRemove ? 'Yes' : 'No'} index={5} />
                        </div>

                        {/* Section: Restart Policy */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            Restart Policy
                          </h3>
                          <KVRow label="Policy" value={data.hostConfig.restartPolicy.name} index={0} />
                          <KVRow label="Max Retry Count" value={String(data.hostConfig.restartPolicy.maximumRetryCount)} mono index={1} />
                        </div>

                        {/* Section: Logging */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Activity className="w-3.5 h-3.5" />
                            Logging
                          </h3>
                          <KVRow label="Log Driver" value={data.hostConfig.logConfig.type} index={0} />
                          {Object.entries(data.hostConfig.logConfig.config).map(([key, value], i) => (
                            <KVRow key={key} label={`  ${key}`} value={value} mono index={i + 1} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center py-16"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Search className="w-10 h-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No inspection data available</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-muted/20">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{data ? `Inspected at ${new Date().toLocaleTimeString()}` : 'No data'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={isLoading}
                className="gap-1.5"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Activity className="w-3.5 h-3.5" />
                )}
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Env value cell with mask toggle ─────────────────────────────────────────

function EnvValueCell({ value, isSensitive }: { value: string; isSensitive: boolean }) {
  const [masked, setMasked] = useState(isSensitive);

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {isSensitive && (
        <button
          onClick={() => setMasked(!masked)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title={masked ? 'Show value' : 'Hide value'}
        >
          {masked ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      )}
      <span
        className={cn(
          'font-mono text-[13px] truncate',
          isSensitive && masked && 'text-muted-foreground/60',
        )}
      >
        {isSensitive && masked ? '•'.repeat(Math.min(value.length, 24)) : value || '(empty)'}
      </span>
    </div>
  );
}
