'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Key, Eye, EyeOff, Loader2, Shield, Cpu, Server, LayoutTemplate, Clock, Zap, Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useDockerStore } from '@/store/docker-store';

export function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const { projects, templates, isLoading, fetchContainers, fetchTemplates } = useDockerStore();

  // System stats derived from real data
  const allContainers = projects.flatMap(p => p.containers || []);
  const runningCount = allContainers.filter(c => c.state === 'running').length;
  const projectCount = projects.length;
  const templateCount = templates.length;
  const uptimeRate = allContainers.length > 0 ? Math.round((runningCount / allContainers.length) * 100) : 0;

  // Fetch data on mount
  useEffect(() => {
    fetchContainers();
    fetchTemplates();
  }, [fetchContainers, fetchTemplates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all fields.',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'New password must be at least 6 characters long.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'New password and confirmation do not match.',
      });
      return;
    }

    setIsUpdating(true);

    try {
      const response = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as Record<string, string>).error || 'Failed to change password');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      toast({
        title: 'Password Updated',
        description: 'Your password has been changed successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to change password.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const passwordStrength = () => {
    if (!newPassword) return { strength: 0, label: '', color: '' };
    if (newPassword.length < 6) return { strength: 25, label: 'Weak', color: 'bg-red-400' };
    if (newPassword.length < 8) return { strength: 50, label: 'Fair', color: 'bg-amber-400' };
    if (newPassword.length < 12) return { strength: 75, label: 'Good', color: 'bg-sky-400' };
    return { strength: 100, label: 'Strong', color: 'bg-emerald-400' };
  };

  const { strength, label, color } = passwordStrength();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-xl border border-border/50">
          <div className={cn(
            'absolute inset-0',
            isDark
              ? 'bg-gradient-to-br from-primary/15 via-card to-amber-500/10'
              : 'bg-gradient-to-br from-primary/10 via-card to-amber-500/5'
          )} />
          <div className="welcome-banner-mesh absolute inset-0" />
          <div className={cn(
            'absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl',
            isDark ? 'bg-primary/10' : 'bg-primary/5'
          )} />

          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                  <span className="hero-gradient-text">Settings</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-2 flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5" />
                  Manage your account and system preferences
                </p>
              </div>
              <Badge className={cn(
                'gap-1.5 px-3 py-1.5 text-xs',
                isDark ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-primary/15 text-primary border-primary/30'
              )}>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                v3.0.0
              </Badge>
            </div>
          </div>
        </div>
      </motion.div>

      {/* System Overview */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">System Overview</CardTitle>
                <CardDescription>Current system status and statistics</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/20">
                    <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-5 w-10" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/20">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{runningCount}</p>
                    <p className="text-xs text-muted-foreground">Running Services</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/20">
                  <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center">
                    <Server className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{projectCount}</p>
                    <p className="text-xs text-muted-foreground">Total Projects</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/20">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <LayoutTemplate className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{templateCount}</p>
                    <p className="text-xs text-muted-foreground">Templates</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/20">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{uptimeRate}%</p>
                    <p className="text-xs text-muted-foreground">Uptime Rate</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold">Security</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-sm font-medium">
                  Current Password
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="pl-10 pr-10 h-11 bg-input/50 border-border/50 focus:border-primary/50"
                    disabled={isUpdating}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-medium">
                  New Password
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pl-10 pr-10 h-11 bg-input/50 border-border/50 focus:border-primary/50"
                    disabled={isUpdating}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password strength indicator */}
                {newPassword && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${strength}%` }}
                        className={cn('h-full rounded-full', color)}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className={cn(
                      'text-xs',
                      label === 'Strong' ? 'text-emerald-400' :
                      label === 'Good' ? 'text-sky-400' :
                      label === 'Fair' ? 'text-amber-400' :
                      'text-red-400'
                    )}>
                      Password strength: {label}
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pl-10 pr-10 h-11 bg-input/50 border-border/50 focus:border-primary/50"
                    disabled={isUpdating}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-400">Passwords do not match</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isUpdating || !currentPassword || !newPassword || !confirmPassword}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Update Password
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
