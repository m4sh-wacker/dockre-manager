'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Container, Boxes, Settings, LogOut, ChevronRight, Activity, X, Sun, Moon, LayoutDashboard, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from 'next-themes';

export type TabType = 'overview' | 'containers' | 'activity' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navItems = [
  { id: 'overview' as TabType, label: 'Overview', icon: LayoutDashboard, description: 'Dashboard & metrics', accent: 'bg-emerald-400', accentRing: 'ring-emerald-400/30' },
  { id: 'containers' as TabType, label: 'Services', icon: Boxes, description: 'Docker containers', accent: 'bg-sky-400', accentRing: 'ring-sky-400/30' },
  { id: 'activity' as TabType, label: 'Activity Log', icon: Activity, description: 'System events', accent: 'bg-teal-400', accentRing: 'ring-teal-400/30' },
  { id: 'settings' as TabType, label: 'Settings', icon: Settings, description: 'Account & config', accent: 'bg-slate-400', accentRing: 'ring-slate-400/30' },
];

export function Sidebar({ activeTab, onTabChange, onLogout, mobileOpen = false, onMobileClose }: SidebarProps) {
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const username = user?.username || 'Admin';

  // Lock body scroll on mobile when sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleTabChange = (tab: TabType) => {
    onTabChange(tab);
    onMobileClose?.();
  };

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="relative p-5 border-b border-sidebar-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-2 bg-primary/15 rounded-2xl blur-lg animate-pulse" />
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/10">
              <Container className="w-5 h-5 text-primary" />
            </div>
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-md bg-gradient-to-br from-emerald-400/40 to-emerald-500/20 flex items-center justify-center border border-emerald-400/30 shadow-sm"
            >
              <Zap className="w-2.5 h-2.5 text-emerald-400" />
            </motion.div>
          </div>
          <div className="flex-1">
            <h1 className="font-semibold text-sidebar-foreground tracking-tight">
              Docker Manager
            </h1>
            <p className="text-xs text-muted-foreground">v3.0.0</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Navigation
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <motion.button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
            >
              {!isActive && (
                <motion.div
                  className="absolute inset-0 bg-sidebar-accent/20 rounded-lg"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.2 }}
                />
              )}
              
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              {isActive && (
                <motion.div
                  layoutId="activeUnderline"
                  className="absolute bottom-1 left-3 right-3 h-0.5 bg-primary/30 rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              <div className="relative">
                <Icon className={cn(
                  'w-5 h-5 transition-colors relative z-10',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                <div className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-sidebar transition-colors',
                  item.accent,
                  isActive ? item.accentRing : 'ring-transparent',
                )} />
              </div>

              <div className="flex-1 text-left relative z-10">
                <span>{item.label}</span>
                {isActive && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>

              {isActive && (
                <ChevronRight className="w-4 h-4 text-primary relative z-10" />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="relative border-t border-sidebar-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent" />
        
        <div className="relative p-3">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="relative">
              <Avatar className="w-9 h-9 ring-2 ring-primary/20 ring-offset-1 ring-offset-sidebar">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                  {username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-sidebar"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{username}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
          </div>

          <div className="space-y-0.5">
            <Button
              variant="ghost"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </Button>
            
            <div className="mx-3 h-px bg-sidebar-border/50" />
            
            <Button
              variant="ghost"
              onClick={onLogout}
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        initial={{ x: -280, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="hidden md:flex w-64 h-screen bg-sidebar border-r border-sidebar-border flex-col fixed left-0 top-0 z-40"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={onMobileClose}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="fixed left-0 top-0 z-50 w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col md:hidden"
            >
              <button
                onClick={onMobileClose}
                className="absolute right-3 top-5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors z-10"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
