'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginPage } from '@/components/auth/login-page';
import { Sidebar, type TabType } from '@/components/dashboard/sidebar';
import { ContainerManagement } from '@/components/dashboard/container-management';
import { SettingsPage } from '@/components/dashboard/settings-page';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const { isAuthenticated, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('containers');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate initial load
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleLoginSuccess = () => {
    setActiveTab('containers');
  };

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out.',
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/20 animate-pulse" />
          <p className="text-muted-foreground text-sm">Loading...</p>
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
    <div className="min-h-screen bg-background bg-grid-pattern">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onLogout={handleLogout}
        />

        {/* Main Content */}
        <main className="flex-1 ml-64 min-h-screen">
          <div className="p-6 lg:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'containers' && <ContainerManagement />}
                {activeTab === 'settings' && <SettingsPage />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
