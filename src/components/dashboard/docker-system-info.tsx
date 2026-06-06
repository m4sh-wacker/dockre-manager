'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Cpu, Layers, Monitor, GitBranch, HardDrive,
  Clock, Boxes, Image as ImageIcon, Wifi, Network,
  Puzzle, ChevronDown, ChevronUp, Activity, Shield,
  CheckCircle2, XCircle, Pause
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

// --- Types ---

interface DockerEngineInfo {
  version: string;
  apiVersion: string;
  os: string;
  arch: string;
  kernel: string;
  storageDriver: string;
}

interface ContainerInfo {
  total: number;
  running: number;
  paused: number;
  stopped: number;
}

interface ImageInfo {
  total: number;
  size: string;
}

interface NetworkInfo {
  bridge: boolean;
  host: boolean;
  overlay: boolean;
}

interface PluginInfo {
  volume: string[];
  network: string[];
  authorization: string[] | null;
}

interface DockerSystemInfoData {
  engine: DockerEngineInfo;
  containers: ContainerInfo;
  images: ImageInfo;
  networks: NetworkInfo;
  plugins: PluginInfo;
  systemTime: string;
  dockerRootDir: string;
}

// --- Health Ring Component ---

function HealthRing({ percentage, size = 100, strokeWidth = 10 }: { percentage: number; size?: number; strokeWidth?: number }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (percentage >= 80) return '#34d399';
    if (percentage >= 50) return '#fbbf24';
    return '#f87171';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-foreground">{Math.round(percentage)}%</span>
        <span className="text-[9px] text-muted-foreground">Health</span>
      </div>
    </div>
  );
}

// --- Info Item Component ---

function InfoItem({
  icon: Icon,
  label,
  value,
  iconColor = 'text-primary',
  iconBg = 'bg-primary/10',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor?: string;
  iconBg?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
      <div className={cn('w-7 h-7 rounded flex items-center justify-center shrink-0', iconBg)}>
        <Icon className={cn('w-3.5 h-3.5', iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

// --- Network Badge Component ---

function NetworkBadge({ name, active }: { name: string; active: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs',
      active
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        : 'bg-muted/30 text-muted-foreground border border-border/30'
    )}>
      {active ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      <span className="font-medium capitalize">{name}</span>
    </div>
  );
}

// --- Main Component ---

interface DockerSystemInfoProps {
  collapsed?: boolean;
}

export function DockerSystemInfo({ collapsed = true }: DockerSystemInfoProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [systemInfo, setSystemInfo] = useState<DockerSystemInfoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const response = await fetch('/api/docker/system');
        if (response.ok) {
          const data = await response.json();
          setSystemInfo(data);
        }
      } catch {
        // Use fallback data
      } finally {
        setLoading(false);
      }
    };
    fetchSystemInfo();
  }, []);

  // Fallback data if API fails
  const data: DockerSystemInfoData = systemInfo || {
    engine: { version: '24.0.7', apiVersion: '1.43', os: 'Linux', arch: 'x86_64', kernel: '5.15.0', storageDriver: 'overlay2' },
    containers: { total: 10, running: 5, paused: 0, stopped: 5 },
    images: { total: 8, size: '2.4 GB' },
    networks: { bridge: true, host: true, overlay: true },
    plugins: { volume: ['local'], network: ['bridge', 'host', 'overlay'], authorization: null },
    systemTime: new Date().toISOString(),
    dockerRootDir: '/var/lib/docker',
  };

  // Health calculation based on running ratio
  const healthPercentage = data.containers.total > 0
    ? (data.containers.running / data.containers.total) * 100
    : 100;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <Card className={cn(
        "bg-card/50 border-border/50 backdrop-blur-sm card-shimmer-border relative overflow-hidden",
        isDark ? "bg-gradient-to-br from-primary/3 to-card/50" : "bg-gradient-to-br from-primary/2 to-card/50"
      )}>
        {/* Decorative elements */}
        <div className={cn(
          "absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl pointer-events-none",
          isDark ? "bg-primary/8" : "bg-primary/5"
        )} />

        <CardHeader className="pb-2 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Server className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Docker System Info</CardTitle>
                <CardDescription className="text-[10px]">Comprehensive system details</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-status-blink" />
                Running
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 relative z-10">
          {loading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 animate-pulse">
                    <div className="w-7 h-7 rounded bg-muted" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-2 bg-muted rounded w-12" />
                      <div className="h-3 bg-muted rounded w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Collapsed View - Key Info */}
              <motion.div variants={itemVariants} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem icon={Cpu} label="Engine Version" value={data.engine.version} />
                  <InfoItem icon={Layers} label="API Version" value={`v${data.engine.apiVersion}`} />
                  <InfoItem
                    icon={Boxes}
                    label="Containers"
                    value={`${data.containers.running} / ${data.containers.total} running`}
                    iconColor="text-emerald-400"
                    iconBg="bg-emerald-500/10"
                  />
                  <InfoItem
                    icon={ImageIcon}
                    label="Images"
                    value={`${data.images.total} (${data.images.size})`}
                    iconColor="text-sky-400"
                    iconBg="bg-sky-500/10"
                  />
                </div>

                {/* Health bar in collapsed view */}
                <div className="flex items-center gap-3">
                  <HealthRing percentage={healthPercentage} size={60} strokeWidth={6} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">System Health</span>
                      <span className={cn(
                        'text-xs font-semibold',
                        healthPercentage >= 80 ? 'text-emerald-400' : healthPercentage >= 50 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {Math.round(healthPercentage)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={cn(
                          'h-full rounded-full',
                          healthPercentage >= 80
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                            : healthPercentage >= 50
                              ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                              : 'bg-gradient-to-r from-red-500 to-red-400'
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${healthPercentage}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle2 className="w-2.5 h-2.5" /> {data.containers.running} running
                      </span>
                      {data.containers.paused > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400">
                          <Pause className="w-2.5 h-2.5" /> {data.containers.paused} paused
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-red-400">
                        <XCircle className="w-2.5 h-2.5" /> {data.containers.stopped} stopped
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Expanded View - Full Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 space-y-4 border-t border-border/30 mt-4">
                      {/* Engine Details */}
                      <motion.div variants={itemVariants}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Activity className="w-3 h-3 text-primary" />
                          <span className="text-xs font-medium text-foreground">Engine Details</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <InfoItem icon={Monitor} label="Operating System" value={data.engine.os} iconColor="text-sky-400" iconBg="bg-sky-500/10" />
                          <InfoItem icon={GitBranch} label="Kernel Version" value={data.engine.kernel} iconColor="text-amber-400" iconBg="bg-amber-500/10" />
                          <InfoItem icon={Server} label="Architecture" value={data.engine.arch} iconColor="text-purple-400" iconBg="bg-purple-500/10" />
                          <InfoItem icon={HardDrive} label="Storage Driver" value={data.engine.storageDriver} iconColor="text-teal-400" iconBg="bg-teal-500/10" />
                          <InfoItem icon={Shield} label="Docker Root Dir" value={data.dockerRootDir} iconColor="text-rose-400" iconBg="bg-rose-500/10" />
                          <InfoItem icon={Clock} label="System Time" value={new Date(data.systemTime).toLocaleString()} iconColor="text-indigo-400" iconBg="bg-indigo-500/10" />
                        </div>
                      </motion.div>

                      {/* Network Info */}
                      <motion.div variants={itemVariants}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Network className="w-3 h-3 text-primary" />
                          <span className="text-xs font-medium text-foreground">Network Drivers</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <NetworkBadge name="bridge" active={data.networks.bridge} />
                          <NetworkBadge name="host" active={data.networks.host} />
                          <NetworkBadge name="overlay" active={data.networks.overlay} />
                        </div>
                      </motion.div>

                      {/* Plugins Info */}
                      <motion.div variants={itemVariants}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Puzzle className="w-3 h-3 text-primary" />
                          <span className="text-xs font-medium text-foreground">Plugins</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                            <Wifi className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Volume Plugins</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {data.plugins.volume.map((p) => (
                                  <Badge key={p} variant="secondary" className="text-[9px] px-1.5 py-0">{p}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                            <Network className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Network Plugins</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {data.plugins.network.map((p) => (
                                  <Badge key={p} variant="secondary" className="text-[9px] px-1.5 py-0">{p}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                            <Shield className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Authorization Plugins</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {data.plugins.authorization ? data.plugins.authorization.join(', ') : 'None configured'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
