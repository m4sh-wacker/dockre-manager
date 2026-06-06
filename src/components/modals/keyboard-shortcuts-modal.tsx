'use client';

import { motion } from 'framer-motion';
import { Keyboard, Command, Search, Plus, RefreshCw, Moon, Sun, ArrowLeft, LogOut, Settings, Boxes, Box, Activity, LayoutDashboard, HardDrive, Wifi } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutGroup {
  title: string;
  icon: React.ElementType;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    icon: Command,
    shortcuts: [
      { keys: ['1'], description: 'Go to Overview' },
      { keys: ['2'], description: 'Go to Services' },
      { keys: ['3'], description: 'Go to Images' },
      { keys: ['4'], description: 'Go to Volumes' },
      { keys: ['5'], description: 'Go to Networks' },
      { keys: ['6'], description: 'Go to Activity Log' },
      { keys: ['7'], description: 'Go to Settings' },
    ],
  },
  {
    title: 'Actions',
    icon: Boxes,
    shortcuts: [
      { keys: ['N'], description: 'Create new service' },
      { keys: ['R'], description: 'Refresh current page' },
      { keys: ['⌘', 'K'], description: 'Open keyboard shortcuts' },
      { keys: ['/'], description: 'Focus search bar' },
    ],
  },
  {
    title: 'Interface',
    icon: Settings,
    shortcuts: [
      { keys: ['T'], description: 'Toggle dark/light theme' },
      { keys: ['Esc'], description: 'Close modal / Go back' },
    ],
  },
];

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Use these shortcuts to navigate and interact faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {shortcutGroups.map((group, groupIdx) => {
            const Icon = group.icon;
            return (
              <div key={group.title}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                </div>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, idx) => (
                          <span key={idx} className="flex items-center gap-1">
                            <kbd
                              className={cn(
                                'inline-flex items-center justify-center min-w-[28px] h-7 px-2',
                                'text-xs font-medium font-mono',
                                'bg-muted/50 border border-border/50 rounded-md',
                                'text-foreground shadow-sm'
                              )}
                            >
                              {key}
                            </kbd>
                            {idx < shortcut.keys.length - 1 && (
                              <span className="text-muted-foreground/50 text-xs">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {groupIdx < shortcutGroups.length - 1 && (
                  <Separator className="mt-4 bg-border/30" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
          <Badge variant="secondary" className="text-[10px]">
            <Command className="w-3 h-3 mr-1" />
            Pro Tip
          </Badge>
          <p className="text-xs text-muted-foreground">
            Most shortcuts work from anywhere in the app
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
