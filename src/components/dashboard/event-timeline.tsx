'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Play, Square, RefreshCw, CalendarPlus, Trash2, Clock,
  ChevronDown, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

type EventType = 'create' | 'start' | 'stop' | 'restart' | 'renew' | 'delete' | 'expire';

interface ContainerEvent {
  id: string;
  type: EventType;
  timestamp: string;
  description: string;
  metadata?: Record<string, string>;
}

interface EventsResponse {
  events: ContainerEvent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const eventConfig: Record<EventType, {
  icon: typeof Plus;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  label: string;
}> = {
  create: {
    icon: Plus,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    dotColor: 'bg-emerald-400',
    label: 'Created',
  },
  start: {
    icon: Play,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    dotColor: 'bg-emerald-400',
    label: 'Started',
  },
  stop: {
    icon: Square,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    dotColor: 'bg-red-400',
    label: 'Stopped',
  },
  restart: {
    icon: RefreshCw,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
    dotColor: 'bg-teal-400',
    label: 'Restarted',
  },
  renew: {
    icon: CalendarPlus,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    dotColor: 'bg-amber-400',
    label: 'Renewed',
  },
  delete: {
    icon: Trash2,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    dotColor: 'bg-red-400',
    label: 'Deleted',
  },
  expire: {
    icon: Clock,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    dotColor: 'bg-amber-400',
    label: 'Expired',
  },
};

const allEventTypes: EventType[] = ['create', 'start', 'stop', 'restart', 'renew', 'delete', 'expire'];

interface EventTimelineProps {
  projectId: string;
}

export function EventTimeline({ projectId }: EventTimelineProps) {
  const [events, setEvents] = useState<ContainerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<EventType>>(new Set());
  const [offset, setOffset] = useState(0);

  const fetchEvents = useCallback(async (currentOffset: number, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const typeParam = activeFilters.size > 0 && activeFilters.size < allEventTypes.length
        ? `&type=${Array.from(activeFilters).join(',')}`
        : '';

      const response = await apiRequest(
        `/api/projects/${projectId}/events?limit=10&offset=${currentOffset}${typeParam}`
      );

      if (response.ok) {
        const data: EventsResponse = await response.json();
        if (append) {
          setEvents(prev => [...prev, ...data.events]);
        } else {
          setEvents(data.events);
        }
        setHasMore(data.hasMore);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [projectId, activeFilters]);

  useEffect(() => {
    setOffset(0);
    fetchEvents(0, false);
  }, [fetchEvents]);

  const handleLoadMore = () => {
    const newOffset = offset + 10;
    setOffset(newOffset);
    fetchEvents(newOffset, true);
  };

  const toggleFilter = (type: EventType) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setActiveFilters(new Set());
  };

  const isFilterActive = (type: EventType) => {
    return activeFilters.size === 0 || activeFilters.has(type);
  };

  const filteredEvents = useMemo(() => {
    if (activeFilters.size === 0) return events;
    return events.filter(e => activeFilters.has(e.type));
  }, [events, activeFilters]);

  const activeFilterCount = activeFilters.size;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-medium">Filter:</span>
          </div>
          {allEventTypes.map((type) => {
            const config = eventConfig[type];
            const Icon = config.icon;
            const active = isFilterActive(type);
            return (
              <Button
                key={type}
                variant="outline"
                size="sm"
                onClick={() => toggleFilter(type)}
                className={cn(
                  'h-7 px-2.5 text-xs gap-1.5 border-border/50 transition-all',
                  active
                    ? cn(config.bgColor, config.borderColor, config.color, 'hover:opacity-90')
                    : 'opacity-40 hover:opacity-70'
                )}
              >
                <Icon className="w-3 h-3" />
                {config.label}
              </Button>
            );
          })}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Timeline */}
        <div className="relative">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full bg-muted/50 animate-pulse" />
                    {i < 4 && <div className="w-px h-12 bg-border/30" />}
                  </div>
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
                    <div className="h-3 w-48 bg-muted/30 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No events found</p>
              {activeFilterCount > 0 && (
                <p className="text-muted-foreground/60 text-xs mt-1">
                  Try adjusting your filters
                </p>
              )}
            </div>
          ) : (
            <div className="relative pl-1">
              {/* Gradient connecting line */}
              <div
                className="absolute left-[18px] top-0 bottom-0 w-px"
                style={{
                  background: 'linear-gradient(to bottom, rgba(128,128,128,0.3), rgba(128,128,128,0.05))',
                }}
              />

              <AnimatePresence mode="popLayout">
                {filteredEvents.map((event, index) => {
                  const config = eventConfig[event.type];
                  const Icon = config.icon;
                  const timestamp = new Date(event.timestamp);
                  const relativeTime = formatDistanceToNow(timestamp, { addSuffix: true });
                  const absoluteTime = format(timestamp, 'MMM d, yyyy \'at\' h:mm:ss a');

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{
                        duration: 0.3,
                        delay: index * 0.05,
                        ease: 'easeOut',
                      }}
                      className="relative flex gap-4 items-start pb-6 last:pb-0"
                    >
                      {/* Timeline dot and icon */}
                      <div className="relative flex flex-col items-center shrink-0">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 20,
                            delay: index * 0.05,
                          }}
                          className={cn(
                            'w-9 h-9 rounded-full flex items-center justify-center border-2 relative z-10',
                            config.bgColor,
                            config.borderColor
                          )}
                        >
                          <Icon className={cn('w-4 h-4', config.color)} />
                        </motion.div>
                        {/* Animated dot pulse */}
                        <motion.div
                          initial={{ scale: 1, opacity: 0.5 }}
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 0, 0.5],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: index * 0.1,
                          }}
                          className={cn(
                            'absolute w-9 h-9 rounded-full',
                            config.dotColor,
                            'opacity-20'
                          )}
                        />
                      </div>

                      {/* Event content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[11px] font-medium border-current px-2',
                              config.color
                            )}
                          >
                            {config.label}
                          </Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground cursor-default">
                                {relativeTime}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {absoluteTime}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed">
                          {event.description}
                        </p>
                        {/* Metadata */}
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {Object.entries(event.metadata).map(([key, value]) => (
                              <span
                                key={key}
                                className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground font-mono"
                              >
                                {key}={value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Load More */}
        {hasMore && !loading && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="border-border/50 hover:border-primary/50 gap-1.5"
            >
              {loadingMore ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              {loadingMore ? 'Loading...' : 'Load More Events'}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
