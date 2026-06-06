'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Container } from 'lucide-react';
import { LoginPage } from '@/components/auth/login-page';
import { Sidebar, type TabType } from '@/components/dashboard/sidebar';
import { OverviewPage } from '@/components/dashboard/overview-page';
import { ContainerManagement } from '@/components/dashboard/container-management';
import { SettingsPage } from '@/components/dashboard/settings-page';
import { ActivityLog } from '@/components/dashboard/activity-log';
import { useAuthStore } from '@/store/auth-store';
import { CreateServiceModal } from '@/components/modals/create-service-modal';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { isAuthenticated, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Close mobile sidebar when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      if (isInput) {
        if (e.key === 'Escape') target.blur();
        return;
      }

      if (e.key === 'Escape') {
        if (isCreateModalOpen) setIsCreateModalOpen(false);
        return;
      }

      // Navigation shortcuts
      if (e.key === '1') { setActiveTab('overview'); return; }
      if (e.key === '2') { setActiveTab('containers'); return; }
      if (e.key === '3') { setActiveTab('activity'); return; }
      if (e.key === '4') { setActiveTab('settings'); return; }

      // Action shortcuts
      if (e.key === 'n' || e.key === 'N') { setIsCreateModalOpen(true); return; }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen]);

  const handleLoginSuccess = () => {
    setActiveTab('overview');
  };

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out.',
    });
  };

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-primary/20 animate-pulse" />
            <div className="absolute inset-0 w-14 h-14 rounded-xl bg-primary/10 animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-foreground text-sm font-medium">Loading Docker Manager</p>
            <p className="text-muted-foreground text-xs mt-1">Initializing system...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Authenticated - show dashboard
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1">
        {/* Mobile top bar */}
        <header className="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 h-14 bg-background/80 backdrop-blur-md border-b border-border md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-md text-foreground hover:bg-accent transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              <Container className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Docker Manager</span>
          </div>
          <div className="flex-1" />
        </header>

        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          onMobileClose={handleMobileClose}
        />

        {/* Main Content */}
        <main className="flex-1 ml-0 md:ml-64 min-h-screen pt-14 md:pt-0 flex flex-col">
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'overview' && (
                  <OverviewPage
                    onNavigate={(tab) => setActiveTab(tab as TabType)}
                    onCreateService={() => setIsCreateModalOpen(true)}
                  />
                )}
                {activeTab === 'containers' && (
                  <ContainerManagement onCreateService={() => setIsCreateModalOpen(true)} />
                )}
                {activeTab === 'activity' && <ActivityLog />}
                {activeTab === 'settings' && <SettingsPage />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center">
                    <Container className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Docker Manager</span>
                </div>
                <span className="text-[10px] text-muted-foreground/50">v3.0.0</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1.5 px-2"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <Container className="w-3 h-3" />
                  New Service
                  <kbd className="inline-flex items-center px-1 py-0.5 text-[8px] font-mono bg-muted/50 rounded border border-border/50">N</kbd>
                </Button>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Global Modals */}
      <CreateServiceModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
    </div>
  );
}
