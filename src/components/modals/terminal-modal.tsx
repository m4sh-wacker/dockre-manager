'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Terminal as TerminalIcon, X, Send, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDockerStore } from '@/store/docker-store';
import { cn } from '@/lib/utils';

interface TerminalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  containerName: string;
}

interface HistoryEntry {
  type: 'input' | 'output' | 'error';
  content: string;
}

export function TerminalModal({ open, onOpenChange, containerId, containerName }: TerminalModalProps) {
  const { execContainerCommand } = useDockerStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [command, setCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandHistory = useRef<string[]>([]);
  const historyIndex = useRef(-1);

  // Initialize with welcome message
  useEffect(() => {
    if (open) {
      setHistory([
        { type: 'output', content: `Connected to ${containerName}` },
        { type: 'output', content: `Container ID: ${containerId.slice(0, 12)}` },
        { type: 'output', content: 'Type commands and press Enter to execute.\n' },
      ]);
      setCommand('');
      commandHistory.current = [];
      historyIndex.current = -1;
    }
  }, [open, containerId, containerName]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input when modal opens or after command execution
  useEffect(() => {
    if (open && !isExecuting) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, isExecuting]);

  const executeCommand = useCallback(async () => {
    const cmd = command.trim();
    if (!cmd || isExecuting) return;

    // Add to history
    setHistory(prev => [...prev, { type: 'input', content: `$ ${cmd}` }]);
    setCommand('');
    setIsExecuting(true);

    // Save to command history
    commandHistory.current.unshift(cmd);
    if (commandHistory.current.length > 50) commandHistory.current.pop();
    historyIndex.current = -1;

    try {
      const output = await execContainerCommand(containerId, cmd);
      if (output) {
        setHistory(prev => [...prev, { type: 'output', content: output }]);
      }
    } catch (err) {
      setHistory(prev => [...prev, { type: 'error', content: err instanceof Error ? err.message : 'Command execution failed' }]);
    } finally {
      setIsExecuting(false);
    }
  }, [command, containerId, execContainerCommand, isExecuting]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex.current < commandHistory.current.length - 1) {
        historyIndex.current++;
        setCommand(commandHistory.current[historyIndex.current]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex.current > 0) {
        historyIndex.current--;
        setCommand(commandHistory.current[historyIndex.current]);
      } else {
        historyIndex.current = -1;
        setCommand('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-card/95 backdrop-blur-xl border-border/50 p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-sm font-medium flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-primary" />
            Terminal — {containerName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[450px]">
          {/* Terminal Output */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-5 bg-black/20 dark:bg-black/40 mx-4 mt-2 rounded-lg"
            onClick={() => inputRef.current?.focus()}
          >
            {history.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  'whitespace-pre-wrap break-all',
                  entry.type === 'input' && 'text-emerald-400',
                  entry.type === 'output' && 'text-foreground/80',
                  entry.type === 'error' && 'text-red-400',
                )}
              >
                {entry.content}
              </div>
            ))}
            {isExecuting && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Executing...</span>
              </div>
            )}
          </div>

          {/* Command Input */}
          <div className="flex items-center gap-2 p-4 pt-2">
            <span className="text-emerald-400 font-mono text-sm shrink-0">$</span>
            <Input
              ref={inputRef}
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command..."
              className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 px-0 h-7"
              disabled={isExecuting}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={executeCommand}
              disabled={isExecuting || !command.trim()}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
