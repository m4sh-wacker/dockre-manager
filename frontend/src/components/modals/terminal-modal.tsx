'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal, Maximize2, Minimize2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DockerContainer } from '@/store/docker-store';
import { cn } from '@/lib/utils';

interface TerminalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: DockerContainer | null;
}

interface TerminalLine {
  id: number;
  type: 'input' | 'output';
  content: string;
  timestamp: Date;
}

const mockCommands: Record<string, string[]> = {
  help: [
    'Available commands:',
    '  help          - Show this help message',
    '  ls            - List files in current directory',
    '  pwd           - Print working directory',
    '  ps            - Show running processes',
    '  env           - Show environment variables',
    '  uptime        - Show system uptime',
    '  df            - Show disk usage',
    '  free          - Show memory usage',
    '  clear         - Clear the terminal',
    '  exit          - Close terminal session',
  ],
  ls: [
    'total 24',
    'drwxr-xr-x  5 root root 4096 Jan 15 10:30 .',
    'drwxr-xr-x  1 root root 4096 Jan 15 10:30 ..',
    '-rw-r--r--  1 root root  220 Jan 15 10:30 .bash_logout',
    '-rw-r--r--  1 root root 3344 Jan 15 10:30 .bashrc',
    'drwxr-xr-x  2 root root 4096 Jan 15 10:30 app',
    'drwxr-xr-x  2 root root 4096 Jan 15 10:30 config',
    '-rw-r--r--  1 root root  642 Jan 15 10:30 package.json',
    'drwxr-xr-x  3 root root 4096 Jan 15 10:30 node_modules',
  ],
  pwd: ['/app'],
  ps: [
    'PID   USER     TIME  COMMAND',
    '    1 root      0:00 node /app/server.js',
    '   15 root      0:00 npm run dev',
    '   28 root      0:00 /bin/sh',
    '   35 root      0:00 ps aux',
  ],
  env: [
    'NODE_ENV=production',
    'PORT=8080',
    'HOST=0.0.0.0',
    'DATABASE_URL=postgresql://db:5432/app',
    'REDIS_URL=redis://cache:6379',
    'LOG_LEVEL=info',
  ],
  uptime: ['10:30:45 up 2 days,  5:23,  1 user,  load average: 0.15, 0.12, 0.10'],
  df: [
    'Filesystem     1K-blocks    Used Available Use% Mounted on',
    '/dev/sda1       20642488 4582132  15011848  24% /',
    'tmpfs             512000       0    512000   0% /dev/shm',
  ],
  free: [
    '              total        used        free      shared  buff/cache   available',
    'Mem:        2048000      512000      768000       25600      768000     1280000',
    'Swap:       1048576           0     1048576',
  ],
};

export function TerminalModal({ open, onOpenChange, container }: TerminalModalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineIdRef = useRef(4);
  const prevOpenRef = useRef(false);

  const addLine = useCallback((type: TerminalLine['type'], content: string | string[]) => {
    const contents = Array.isArray(content) ? content : [content];
    const newLines = contents.map((c) => ({
      id: ++lineIdRef.current,
      type,
      content: c,
      timestamp: new Date(),
    }));
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  const processCommand = useCallback((cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    
    addLine('input', `${container?.serviceName || 'container'}:~$ ${cmd}`);

    if (trimmedCmd === 'clear') {
      setLines([]);
      return;
    }

    if (trimmedCmd === 'exit') {
      onOpenChange(false);
      return;
    }

    // Simulate command processing delay
    setTimeout(() => {
      if (mockCommands[trimmedCmd]) {
        addLine('output', mockCommands[trimmedCmd]);
      } else if (trimmedCmd) {
        addLine('output', `sh: ${trimmedCmd}: command not found`);
      }
    }, 100);
  }, [container?.serviceName, addLine, onOpenChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    processCommand(input);
    setCommandHistory((prev) => [...prev, input]);
    setHistoryIndex(-1);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const copyTerminalContent = () => {
    const content = lines
      .map((line) => line.content)
      .join('\n');
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-scroll when lines change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Handle open state changes using refs to detect transitions
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (open && !wasOpen && container) {
      // Modal just opened - initialize state
      lineIdRef.current = 4;
      // Using setTimeout to defer state update
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, container]);

  // Reset state when modal opens/closes - using memoized initial values
  const welcomeLines: TerminalLine[] = container ? [
    {
      id: 1,
      type: 'output',
      content: `Connected to ${container.serviceName}`,
      timestamp: new Date(),
    },
    {
      id: 2,
      type: 'output',
      content: 'Type "help" for available commands',
      timestamp: new Date(),
    },
    {
      id: 3,
      type: 'output',
      content: '',
      timestamp: new Date(),
    },
  ] : [];

  // Derive lines from open state
  const displayLines = open ? (lines.length > 0 ? lines : welcomeLines) : [];

  if (!container) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={() => onOpenChange(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col',
              isMaximized
                ? 'inset-4 rounded-xl'
                : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[600px]'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground text-sm">
                    Terminal: {container.serviceName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Interactive shell session
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyTerminalContent}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Terminal Content */}
            <ScrollArea className="flex-1 p-4 bg-[oklch(0.08_0.01_260)]" ref={scrollRef}>
              <div className="font-mono text-sm space-y-1">
                {displayLines.map((line) => (
                  <motion.div
                    key={line.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'whitespace-pre-wrap break-all',
                      line.type === 'input' ? 'text-emerald-400' : 'text-foreground/80'
                    )}
                  >
                    {line.content}
                  </motion.div>
                ))}
                
                {/* Input line */}
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <span className="text-emerald-400 font-mono">
                    {container.serviceName}:~$
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent border-none outline-none font-mono text-foreground caret-emerald-400"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                </form>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="px-4 py-2 bg-muted/30 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>Session active</span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
