'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, FileText, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useDockerStore, type DockerContainer, type LogEntry } from '@/store/docker-store';
import { cn } from '@/lib/utils';

interface LogsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: DockerContainer | null;
}

const levelStyles: Record<LogEntry['level'], { color: string; bgColor: string }> = {
  info: { color: 'text-sky-400', bgColor: 'bg-sky-400/10' },
  warn: { color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
  error: { color: 'text-red-400', bgColor: 'bg-red-400/10' },
  debug: { color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
};

export function LogsDrawer({ open, onOpenChange, container }: LogsDrawerProps) {
  const { logs } = useDockerStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerLogs = container ? logs[container.id] || [] : [];

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, containerLogs]);

  const handleDownload = () => {
    if (!container) return;
    
    const logText = containerLogs
      .map(log => `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${container.serviceName}-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!container) return null;

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
        className="fixed top-0 right-0 h-full w-full sm:w-[600px] bg-card border-l border-border z-50 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                {container.serviceName}
              </h2>
              <p className="text-xs text-muted-foreground">
                {containerLogs.length} log entries
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Logs Content */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-1 font-mono text-sm">
            {containerLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No logs available
              </div>
            ) : (
              containerLogs.map((log, index) => {
                const styles = levelStyles[log.level];
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors group"
                  >
                    <span className="text-muted-foreground text-xs whitespace-nowrap pt-0.5">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] font-medium px-1.5 py-0 border-current shrink-0 mt-0.5',
                        styles.color
                      )}
                    >
                      {log.level.toUpperCase()}
                    </Badge>
                    <span className="text-foreground/90 break-all">
                      {log.message}
                    </span>
                  </motion.div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Last updated: {containerLogs.length > 0 
                ? containerLogs[containerLogs.length - 1].timestamp.toLocaleString()
                : 'Never'}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live streaming
            </span>
          </div>
        </div>
      </motion.div>
    </>
  );
}
