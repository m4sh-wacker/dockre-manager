'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, LayoutDashboard, Boxes, Box, HardDrive, Wifi, Activity, Settings,
  Plus, Download, Upload, Keyboard, Sun, Moon, Command, ArrowRight, FileText, Eye, Image as ImageIcon,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDockerStore } from '@/store/docker-store';
import { useTheme } from 'next-themes';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GlobalSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (tab: string) => void;
  onCreateService?: () => void;
  onShowShortcuts?: () => void;
  onToggleTheme?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onDeployCompose?: () => void;
  onInspectContainer?: () => void;
  onViewImageDetails?: () => void;
}

interface SearchItem {
  id: string;
  category: 'navigation' | 'services' | 'actions';
  icon: React.ElementType;
  title: string;
  description: string;
  shortcut?: string;
  action: () => void;
}

// ─── Highlight matching text ─────────────────────────────────────────────────

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="text-primary font-semibold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function GlobalSearchModal({
  open,
  onOpenChange,
  onNavigate,
  onCreateService,
  onShowShortcuts,
  onToggleTheme,
  onExport,
  onImport,
  onDeployCompose,
  onInspectContainer,
  onViewImageDetails,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { projects } = useDockerStore();
  const { theme } = useTheme();

  // Flatten all containers from projects for search
  const allContainers = projects.flatMap(p => (p.containers || []).map(c => ({ ...c, project: p.name })));

  // ─── Build search items ──────────────────────────────────────────────

  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];

    // Navigation items
    const navigationItems: Omit<SearchItem, 'action'>[] = [
      { id: 'nav-overview', category: 'navigation', icon: LayoutDashboard, title: 'Overview', description: 'Dashboard & metrics', shortcut: '1' },
      { id: 'nav-services', category: 'navigation', icon: Boxes, title: 'Services', description: 'Manage containers', shortcut: '2' },
      { id: 'nav-activity', category: 'navigation', icon: Activity, title: 'Activity Log', description: 'System events', shortcut: '3' },
      { id: 'nav-settings', category: 'navigation', icon: Settings, title: 'Settings', description: 'Account & config', shortcut: '4' },
    ];

    navigationItems.forEach((item) => {
      items.push({ ...item, action: () => onNavigate?.(item.id.replace('nav-', '')) });
    });

    // Service items (dynamic from store)
    allContainers.forEach((container) => {
      const statusIcon = container.state === 'running' ? '\uD83D\uDFE2' : container.state === 'exited' ? '\uD83D\uDD34' : '\uD83D\uDFE1';
      items.push({
        id: `service-${container.id}`,
        category: 'services',
        icon: Boxes,
        title: container.name,
        description: `${statusIcon} ${container.state} · ${container.project}/${container.service}`,
        action: () => onNavigate?.('containers'),
      });
    });

    // Action items
    const actionItems: Omit<SearchItem, 'action'>[] = [
      { id: 'action-create', category: 'actions', icon: Plus, title: 'Create Service', description: 'Deploy a new containerized service', shortcut: 'N' },
      { id: 'action-compose', category: 'actions', icon: FileText, title: 'Deploy Compose', description: 'Deploy multi-container application' },

      { id: 'action-shortcuts', category: 'actions', icon: Keyboard, title: 'Keyboard Shortcuts', description: 'View all keyboard shortcuts', shortcut: '?' },
      { id: 'action-theme', category: 'actions', icon: theme === 'dark' ? Sun : Moon, title: 'Toggle Theme', description: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`, shortcut: 'T' },
    ];

    actionItems.forEach((item) => {
      let action: () => void;
      switch (item.id) {
        case 'action-create':
          action = () => onCreateService?.();
          break;
        case 'action-compose':
          action = () => onDeployCompose?.();
          break;
        case 'action-inspect':
          action = () => onInspectContainer?.();
          break;
        case 'action-image-details':
          action = () => onViewImageDetails?.();
          break;
        case 'action-export':
          action = () => onExport?.();
          break;
        case 'action-import':
          action = () => onImport?.();
          break;
        case 'action-shortcuts':
          action = () => onShowShortcuts?.();
          break;
        case 'action-theme':
          action = () => onToggleTheme?.();
          break;
        default:
          action = () => {};
      }
      items.push({ ...item, action });
    });

    return items;
  }, [allContainers, theme, onNavigate, onCreateService, onDeployCompose, onInspectContainer, onViewImageDetails, onShowShortcuts, onToggleTheme, onExport, onImport]);

  // ─── Filter items ────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!query.trim()) return searchItems;
    const lowerQuery = query.toLowerCase();
    return searchItems.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.description.toLowerCase().includes(lowerQuery)
    );
  }, [query, searchItems]);

  // ─── Group filtered items by category ────────────────────────────────

  const groupedItems = useMemo(() => {
    const groups: { category: SearchItem['category']; label: string; items: SearchItem[] }[] = [];
    const categoryOrder: SearchItem['category'][] = ['navigation', 'services', 'actions'];
    const categoryLabels: Record<SearchItem['category'], string> = {
      navigation: 'Navigation',
      services: 'Services',
      actions: 'Actions',
    };

    for (const cat of categoryOrder) {
      const catItems = filteredItems.filter((item) => item.category === cat);
      if (catItems.length > 0) {
        groups.push({ category: cat, label: categoryLabels[cat], items: catItems });
      }
    }
    return groups;
  }, [filteredItems]);

  // ─── Reset on open/close ─────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after a short delay for dialog animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // ─── Reset selected index when query changes ─────────────────────────

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // ─── Keyboard navigation ─────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          item.action();
          onOpenChange(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    },
    [filteredItems, selectedIndex, onOpenChange]
  );

  // ─── Scroll selected item into view ──────────────────────────────────

  useEffect(() => {
    if (resultsRef.current) {
      const selectedEl = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // ─── Global Cmd+K / Ctrl+K shortcut ──────────────────────────────────

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, onOpenChange]);

  // ─── Flat index mapping for grouped items ────────────────────────────

  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[580px] p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Gradient top border */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        {/* Search input area */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
            <Search className="w-4 h-4 text-primary" />
          </div>
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, services, actions..."
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 text-sm h-8 px-0"
          />
          <Badge
            variant="secondary"
            className="bg-muted/50 text-muted-foreground text-[10px] font-mono px-1.5 py-0 h-5 shrink-0 border-border/30"
          >
            ESC
          </Badge>
        </div>

        {/* Results area */}
        <div ref={resultsRef} className="max-h-[360px] overflow-y-auto py-2 px-2">
          <AnimatePresence mode="wait">
            {filteredItems.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
                  <Search className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No results found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Try a different search term or browse categories
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                {groupedItems.map((group) => {
                  const groupStartIndex = flatIndex;
                  return (
                    <div key={group.category} className="mb-1 last:mb-0">
                      {/* Section header */}
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {group.label}
                        </span>
                        <div className="flex-1 h-px bg-border/20" />
                        <span className="text-[10px] text-muted-foreground/50 font-mono">
                          {group.items.length}
                        </span>
                      </div>

                      {/* Section items */}
                      {group.items.map((item) => {
                        const currentIndex = flatIndex++;
                        const isSelected = currentIndex === selectedIndex;
                        const Icon = item.icon;

                        return (
                          <motion.button
                            key={item.id}
                            data-index={currentIndex}
                            onClick={() => {
                              item.action();
                              onOpenChange(false);
                            }}
                            onMouseEnter={() => setSelectedIndex(currentIndex)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-100 group',
                              isSelected
                                ? 'bg-primary/10 text-foreground'
                                : 'text-foreground/80 hover:bg-primary/5'
                            )}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.12, delay: currentIndex * 0.02 }}
                          >
                            {/* Icon */}
                            <div
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                                isSelected
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-muted/40 text-muted-foreground group-hover:text-foreground'
                              )}
                            >
                              <Icon className="w-4 h-4" />
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                <HighlightMatch text={item.title} query={query} />
                              </p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                <HighlightMatch text={item.description} query={query} />
                              </p>
                            </div>

                            {/* Keyboard shortcut or arrow */}
                            <div className="shrink-0 flex items-center gap-1.5">
                              {item.shortcut ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-muted/50 text-muted-foreground text-[10px] font-mono px-1.5 py-0 h-5 border-border/30"
                                >
                                  {item.shortcut}
                                </Badge>
                              ) : null}
                              {isSelected && (
                                <motion.div
                                  initial={{ opacity: 0, x: -4 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.1 }}
                                >
                                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                                </motion.div>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer with hints */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/20 bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-muted/50 border border-border/40 rounded text-[10px] font-mono text-muted-foreground">
                ↑
              </kbd>
              <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-muted/50 border border-border/40 rounded text-[10px] font-mono text-muted-foreground">
                ↓
              </kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-muted/50 border border-border/40 rounded text-[10px] font-mono text-muted-foreground">
                ↵
              </kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <kbd className="inline-flex items-center justify-center min-w-[28px] h-5 px-1.5 bg-muted/50 border border-border/40 rounded text-[10px] font-mono text-muted-foreground">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
              <span>Toggle</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <FileText className="w-3 h-3" />
            <span>{filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
