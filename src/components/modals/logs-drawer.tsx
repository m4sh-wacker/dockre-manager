'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, FileText, Download, Trash2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useDockerStore } from '@/store/docker-store';
import { cn } from '@/lib/utils';

interface LogsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  containerName: string;
}

export function LogsDrawer({ open, onOpenChange, containerId, containerName }: LogsDrawerProps) {
  const { getContainerLogs } = useDockerStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch logs from API when drawer opens
  useEffect(() => {
    if (open && containerId) {
      fetchLogs();
    }
  }, [open, containerId]);

  const fetchLogs = async () => {
    if (!containerId) return;
    setIsRefreshing(true);
    try {
      const logLines = await getContainerLogs(containerId, 200);
      setLogs(logLines);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, logs]);

  const handleDownload = () => {
    if (logs.length === 0) return;

    const logText = logs.join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerName}-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log =>
    !search || log.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: open ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 h-full w-full sm:w-[640px] bg-card border-l border-border z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{containerName}</h2>
              <p className="text-xs text-muted-foreground">
                {filteredLogs.length} log entries
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchLogs}
              disabled={isRefreshing}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="text-muted-foreground hover:text-foreground"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setLogs([]); }}
              className="text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs bg-input/50 border-border/50 focus:border-primary/50 font-mono"
            />
          </div>
        </div>

        {/* Logs Content */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-0.5 font-mono text-sm">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No logs available</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Logs will appear here when the service generates output</p>
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(index * 0.01, 0.5) }}
                  className="p-2 rounded-lg hover:bg-muted/20 transition-colors"
                >
                  <span className="text-foreground/80 break-all text-xs leading-relaxed">
                    {log}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{logs.length} entries</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={fetchLogs} disabled={isRefreshing}>
              <RefreshCw className={cn('w-3 h-3 mr-1', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
