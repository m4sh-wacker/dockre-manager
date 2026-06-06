'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, RefreshCw, Image as ImageIcon, Download,
  HardDrive, Layers, Cpu, Monitor, Clock, Tag, Calendar,
  ArrowUpDown, ChevronDown, ChevronUp, Activity, User,
  Globe, Box, Info, Loader2, Database, Hash,
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
import { apiRequest } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImageDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageId: string;
  imageName: string;
  imageTag: string;
}

interface ImageLayer {
  instruction: string;
  command: string;
  sizeBytes: number;
  createdAgo: string;
}

interface ImageHistory {
  action: string;
  tag: string;
  timestamp: string;
  user: string;
  registry: string;
}

interface ImageDetailData {
  id: string;
  name: string;
  tag: string;
  fullName: string;
  sizeBytes: number;
  virtualSizeBytes: number;
  created: string;
  createdAgo: string;
  status: string;
  pullCount: number;
  architecture: string;
  os: string;
  dockerVersion: string;
  author: string;
  description: string;
  digest: string;
  layers: ImageLayer[];
  totalLayerSize: number;
  allTags: string[];
  history: ImageHistory[];
}

// ─── Instruction color mapping ───────────────────────────────────────────────

const INSTRUCTION_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  FROM: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  RUN: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', dot: 'bg-sky-400' },
  COPY: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', dot: 'bg-violet-400' },
  ADD: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', dot: 'bg-violet-400' },
  EXPOSE: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  CMD: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', dot: 'bg-rose-400' },
  ENTRYPOINT: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', dot: 'bg-rose-400' },
  ENV: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30', dot: 'bg-teal-400' },
  LABEL: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', dot: 'bg-slate-400' },
  WORKDIR: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', dot: 'bg-indigo-400' },
  HEALTHCHECK: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30', dot: 'bg-pink-400' },
  STOPSIGNAL: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-400' },
};

function getInstructionStyle(instruction: string) {
  return INSTRUCTION_COLORS[instruction.toUpperCase()] || {
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
    dot: 'bg-gray-400',
  };
}

// ─── Size color coding ───────────────────────────────────────────────────────

function getSizeCategory(sizeBytes: number): { label: string; color: string; bgColor: string; borderColor: string } {
  const mb = sizeBytes / (1024 * 1024);
  if (mb < 50) {
    return { label: 'Small', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' };
  } else if (mb < 300) {
    return { label: 'Medium', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' };
  } else {
    return { label: 'Large', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30' };
  }
}

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string; pulseClass: string }> = {
  available: { color: 'text-emerald-400', bgColor: 'bg-emerald-400', label: 'Available', pulseClass: 'animate-pulse' },
  pulling: { color: 'text-sky-400', bgColor: 'bg-sky-400', label: 'Pulling', pulseClass: 'animate-pulse' },
  unused: { color: 'text-amber-400', bgColor: 'bg-amber-400', label: 'Unused', pulseClass: '' },
  error: { color: 'text-red-400', bgColor: 'bg-red-400', label: 'Error', pulseClass: 'animate-pulse' },
};

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
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
      className={cn(
        'inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted/80 transition-colors shrink-0',
        className
      )}
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
  index = 0,
  icon: Icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  index?: number;
  icon?: React.ElementType;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[140px_1fr_auto] gap-3 px-4 py-2.5 items-center',
        index % 2 === 0 ? 'bg-transparent' : 'bg-muted/[0.03]',
      )}
    >
      <span className="text-xs font-medium text-muted-foreground truncate flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 shrink-0" />}
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            'text-sm truncate',
            mono && 'font-mono text-[13px]',
          )}
        >
          {value || '—'}
        </span>
      </div>
      {copyable ? <CopyButton text={value} /> : <span className="w-6" />}
    </div>
  );
}

// ─── Layer Row ───────────────────────────────────────────────────────────────

function LayerRow({
  layer,
  index,
  total,
  isLast,
}: {
  layer: ImageLayer;
  index: number;
  total: number;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const style = getInstructionStyle(layer.instruction);
  const isLong = layer.command.length > 80;
  const sizeMB = (layer.sizeBytes / (1024 * 1024)).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
    >
      <div className="flex items-stretch group">
        {/* Connecting line with dot */}
        <div className="flex flex-col items-center w-8 shrink-0">
          <div className={cn('w-3 h-3 rounded-full border-2 z-10', style.dot)} />
          {!isLast && (
            <div className="w-px flex-1 bg-border/40" />
          )}
        </div>

        {/* Layer content */}
        <div className={cn(
          'flex-1 rounded-lg border mb-2 transition-colors',
          'bg-card/50 border-border/30 hover:border-border/60',
        )}>
          <div className="p-3">
            {/* Top row: instruction badge + size + time */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-mono font-semibold px-2 py-0 h-5',
                  style.bg, style.text, style.border,
                )}
              >
                {layer.instruction}
              </Badge>
              {layer.sizeBytes > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono">
                  <Database className="w-2.5 h-2.5 mr-1" />
                  {sizeMB} MB
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {layer.createdAgo}
              </span>
              <span className="text-[10px] text-muted-foreground/50 ml-auto">
                Layer {index + 1}/{total}
              </span>
            </div>

            {/* Command */}
            <div className="relative">
              <code
                className={cn(
                  'text-[12px] font-mono leading-relaxed block',
                  isLong && !expanded ? 'line-clamp-2' : '',
                )}
              >
                {layer.command}
              </code>
              {isLong && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 mt-1 transition-colors"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Show more
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Skeleton loading ────────────────────────────────────────────────────────

function SkeletonLoader() {
  return (
    <div className="space-y-3 p-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="grid grid-cols-[140px_1fr] gap-3 items-center">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full max-w-[280px]" />
        </div>
      ))}
    </div>
  );
}

// ─── Format helpers ──────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ImageDetailsModal({
  open,
  onOpenChange,
  imageId,
  imageName,
  imageTag,
}: ImageDetailsModalProps) {
  const [data, setData] = useState<ImageDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!imageId || !open) return;
    setIsLoading(true);
    try {
      const response = await apiRequest(`/api/images/${imageId}`);
      if (response.ok) {
        const detailData = await response.json();
        setData(detailData as ImageDetailData);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to load image details',
          description: 'Could not fetch image information.',
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
  }, [imageId, open, toast]);

  useEffect(() => {
    if (open && imageId) {
      fetchData();
      setActiveTab('details');
    }
  }, [open, imageId, fetchData]);

  const sizeCategory = data ? getSizeCategory(data.sizeBytes) : null;
  const statusConfig = data ? (STATUS_CONFIG[data.status] || STATUS_CONFIG.available) : STATUS_CONFIG.available;
  const shortId = data?.id ? data.id.replace('sha256:', '').substring(0, 12) : imageId.substring(0, 12);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header Section */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 shrink-0">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-lg font-semibold truncate">{data ? data.fullName : `${imageName}:${imageTag}`}</span>
                {/* Size badge with color coding */}
                {sizeCategory && (
                  <Badge variant="outline" className={cn('font-medium text-[10px] border-current gap-1', sizeCategory.color, sizeCategory.bgColor)}>
                    <Database className="w-3 h-3" />
                    {formatBytes(data!.sizeBytes)} · {sizeCategory.label}
                  </Badge>
                )}
                {/* Status indicator */}
                {data && (
                  <Badge variant="outline" className={cn('font-medium border-current gap-1.5 text-[10px]', statusConfig.color)}>
                    <span className={cn('w-2 h-2 rounded-full', statusConfig.bgColor, statusConfig.pulseClass)} />
                    {statusConfig.label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                {data && (
                  <>
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {formatNumber(data.pullCount)} pulls
                    </span>
                    <span className="text-muted-foreground/30">•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {data.createdAgo}
                    </span>
                    <span className="text-muted-foreground/30">•</span>
                    <span className="font-mono text-xs text-muted-foreground/60">{shortId}</span>
                  </>
                )}
              </div>
            </div>
            {/* Refresh button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={fetchData}
              disabled={isLoading}
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <div className="px-6 pt-2 border-b border-border/30">
            <TabsList className="w-full justify-start bg-transparent p-0 h-auto gap-0">
              <TabsTrigger
                value="details"
                className={cn(
                  'gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-400',
                  'text-muted-foreground hover:text-foreground transition-colors',
                )}
              >
                <Info className="w-3.5 h-3.5" />
                Details
              </TabsTrigger>
              <TabsTrigger
                value="layers"
                className={cn(
                  'gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-sky-400',
                  'text-muted-foreground hover:text-foreground transition-colors',
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                Layers
              </TabsTrigger>
              <TabsTrigger
                value="tags"
                className={cn(
                  'gap-1.5 px-4 py-2.5 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-violet-400',
                  'text-muted-foreground hover:text-foreground transition-colors',
                )}
              >
                <Tag className="w-3.5 h-3.5" />
                Tags & History
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
                  {/* ─── Details Tab ─── */}
                  {activeTab === 'details' && (
                    <div className="p-2">
                      {/* Accent bar */}
                      <div className="h-1 w-full bg-gradient-to-r from-emerald-500/40 via-emerald-400/20 to-transparent rounded-full mb-4" />

                      {/* Size visualization */}
                      <div className="px-4 py-3 mb-2">
                        <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <HardDrive className="w-3.5 h-3.5" />
                          Size Visualization
                        </h3>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-24 shrink-0">Image Size</span>
                            <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden relative">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-emerald-400/40"
                              />
                            </div>
                            <span className="text-xs font-mono text-foreground shrink-0 w-16 text-right">{formatBytes(data.sizeBytes)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-24 shrink-0">Virtual Size</span>
                            <div className="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden relative">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(data.sizeBytes / data.virtualSizeBytes) * 100}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                className="h-full rounded-full bg-gradient-to-r from-sky-500/70 to-sky-400/40"
                              />
                            </div>
                            <span className="text-xs font-mono text-foreground shrink-0 w-16 text-right">{formatBytes(data.virtualSizeBytes)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="divide-y divide-border/20">
                        {/* Section: Identity */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Box className="w-3.5 h-3.5" />
                            Identity
                          </h3>
                          <KVRow label="Image ID" value={data.id.replace('sha256:', '')} mono copyable index={0} icon={Hash} />
                          <KVRow label="Digest" value={data.digest} mono copyable index={1} icon={Hash} />
                          <KVRow label="Full Name" value={data.fullName} mono copyable index={2} icon={Tag} />
                        </div>

                        {/* Section: Build Info */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Cpu className="w-3.5 h-3.5" />
                            Build Info
                          </h3>
                          <KVRow label="Architecture" value={data.architecture} index={0} icon={Cpu} />
                          <KVRow label="OS" value={data.os.charAt(0).toUpperCase() + data.os.slice(1)} index={1} icon={Monitor} />
                          <KVRow label="Docker Version" value={data.dockerVersion} mono index={2} icon={Box} />
                          <KVRow label="Created" value={new Date(data.created).toLocaleString()} index={3} icon={Calendar} />
                        </div>

                        {/* Section: Size Details */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <HardDrive className="w-3.5 h-3.5" />
                            Size Details
                          </h3>
                          <KVRow label="Size" value={formatBytes(data.sizeBytes)} mono index={0} icon={Database} />
                          <KVRow label="Virtual Size" value={formatBytes(data.virtualSizeBytes)} mono index={1} icon={Database} />
                          <KVRow label="Layer Count" value={String(data.layers.length)} mono index={2} icon={Layers} />
                          <KVRow label="Total Layer Size" value={formatBytes(data.totalLayerSize)} mono index={3} icon={HardDrive} />
                        </div>

                        {/* Section: Metadata */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Info className="w-3.5 h-3.5" />
                            Metadata
                          </h3>
                          <KVRow label="Author" value={data.author || 'Not specified'} index={0} icon={User} />
                          <KVRow label="Description" value={data.description} index={1} icon={Info} />
                          <KVRow label="Pull Count" value={formatNumber(data.pullCount)} index={2} icon={Download} />
                          <KVRow label="Status" value={statusConfig.label} index={3} icon={Activity} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Layers Tab ─── */}
                  {activeTab === 'layers' && (
                    <div className="p-2">
                      {/* Accent bar */}
                      <div className="h-1 w-full bg-gradient-to-r from-sky-500/40 via-sky-400/20 to-transparent rounded-full mb-4" />

                      {/* Layers summary */}
                      <div className="px-4 py-3 mb-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-sky-400" />
                            <span className="text-sm font-medium text-foreground">{data.layers.length} Layers</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4 text-sky-400" />
                            <span className="text-sm font-medium text-foreground">{formatBytes(data.totalLayerSize)} Total</span>
                          </div>
                        </div>

                        {/* Size distribution bar */}
                        <div className="mt-3">
                          <div className="h-3 rounded-full bg-muted/50 overflow-hidden flex">
                            {data.layers.filter(l => l.sizeBytes > 0).map((layer, i) => {
                              const pct = data.totalLayerSize > 0 ? (layer.sizeBytes / data.virtualSizeBytes) * 100 : 0;
                              if (pct < 0.5) return null;
                              const style = getInstructionStyle(layer.instruction);
                              return (
                                <motion.div
                                  key={i}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.5, delay: i * 0.05, ease: 'easeOut' }}
                                  className={cn('h-full', style.dot)}
                                  style={{ opacity: 0.7 }}
                                  title={`${layer.instruction}: ${formatBytes(layer.sizeBytes)}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Layer list with connecting lines */}
                      <div className="px-4 py-2">
                        <div className="space-y-0">
                          {data.layers.map((layer, i) => (
                            <LayerRow
                              key={i}
                              layer={layer}
                              index={i}
                              total={data.layers.length}
                              isLast={i === data.layers.length - 1}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Total size summary at bottom */}
                      <div className="px-4 py-4 border-t border-border/20">
                        <div className={cn(
                          'rounded-lg p-4 border',
                          'bg-gradient-to-r from-sky-500/5 to-transparent border-sky-500/20',
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                                <HardDrive className="w-4 h-4 text-sky-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">Total Size</p>
                                <p className="text-xs text-muted-foreground">{data.layers.length} layers · {formatBytes(data.totalLayerSize)}</p>
                              </div>
                            </div>
                            <span className="text-xl font-bold text-sky-400">{formatBytes(data.sizeBytes)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── Tags & History Tab ─── */}
                  {activeTab === 'tags' && (
                    <div className="p-2">
                      {/* Accent bar */}
                      <div className="h-1 w-full bg-gradient-to-r from-violet-500/40 via-violet-400/20 to-transparent rounded-full mb-4" />

                      <div className="divide-y divide-border/20">
                        {/* Section: All Tags */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5" />
                            All Tags
                            <Badge variant="secondary" className="ml-auto bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px]">
                              {data.allTags.length}
                            </Badge>
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {data.allTags.map((tag, i) => (
                              <motion.div
                                key={tag}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                              >
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'font-mono text-xs px-3 py-1.5 gap-1.5',
                                    tag === data.fullName
                                      ? 'bg-violet-500/15 text-violet-400 border-violet-500/40'
                                      : 'bg-muted/30 text-muted-foreground border-border/30 hover:border-violet-500/30 hover:text-violet-400 transition-colors',
                                  )}
                                >
                                  {tag === data.fullName && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
                                  {tag}
                                </Badge>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {/* Section: Push/Pull History Timeline */}
                        <div className="px-4 py-3">
                          <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            Push / Pull History
                            <Badge variant="secondary" className="ml-auto bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px]">
                              {data.history.length}
                            </Badge>
                          </h3>

                          <div className="space-y-0">
                            {data.history.map((entry, i) => {
                              const isPush = entry.action === 'push';
                              const date = new Date(entry.timestamp);
                              const timeAgo = getTimeAgo(date);

                              return (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.06 }}
                                  className="flex items-stretch"
                                >
                                  {/* Timeline line */}
                                  <div className="flex flex-col items-center w-8 shrink-0">
                                    <div className={cn(
                                      'w-3 h-3 rounded-full border-2 z-10',
                                      isPush ? 'bg-emerald-400 border-emerald-400/50' : 'bg-sky-400 border-sky-400/50',
                                    )} style={{ boxShadow: `0 0 6px ${isPush ? 'rgb(52 211 153 / 0.5)' : 'rgb(56 189 248 / 0.5)'}` }} />
                                    {i < data.history.length - 1 && (
                                      <div className="w-px flex-1 bg-border/40" />
                                    )}
                                  </div>

                                  {/* Entry content */}
                                  <div className={cn(
                                    'flex-1 rounded-lg border mb-3 p-3',
                                    'bg-card/50 border-border/30',
                                  )}>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <Badge variant="outline" className={cn(
                                        'text-[10px] font-semibold px-2 py-0 h-5',
                                        isPush
                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                          : 'bg-sky-500/10 text-sky-400 border-sky-500/30',
                                      )}>
                                        {isPush ? '↑ Push' : '↓ Pull'}
                                      </Badge>
                                      <span className="text-xs font-mono text-foreground">{entry.tag}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {entry.user}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Globe className="w-3 h-3" />
                                        {entry.registry}
                                      </span>
                                      <span className="flex items-center gap-1 ml-auto" title={date.toLocaleString()}>
                                        <Clock className="w-3 h-3" />
                                        {timeAgo}
                                      </span>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Time ago helper ─────────────────────────────────────────────────────────

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
