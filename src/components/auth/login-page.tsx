'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Container,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Boxes,
  Activity,
  Box,
  Gauge,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/hooks/use-toast';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { login } = useAuthStore();
  const { toast } = useToast();

  // Animated gradient border angle
  const [gradientAngle, setGradientAngle] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setGradientAngle((prev) => (prev + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const success = await login(username, password);
    setIsLoading(false);

    if (success) {
      toast({
        title: 'Welcome back!',
        description: 'Login successful. Redirecting to dashboard...',
      });
      setIsTransitioning(true);
      setTimeout(() => {
        onLoginSuccess();
      }, 600);
    } else {
      toast({
        variant: 'destructive',
        title: 'Authentication failed',
        description: 'Invalid username or password. Please try again.',
      });
    }
  };

  return (
    <AnimatePresence>
      {!isTransitioning ? (
        <motion.div
          key="login"
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="min-h-screen flex items-center justify-center p-4 bg-background"
        >

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative w-full max-w-md"
          >
            {/* Logo Section */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="flex flex-col items-center mb-8"
            >
              <div className="relative mb-4">
                {/* Animated glow ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute -inset-2 rounded-2xl opacity-30"
                  style={{
                    background:
                      'conic-gradient(from 0deg, transparent, oklch(0.7 0.18 160 / 0.15), transparent, oklch(0.7 0.18 160 / 0.08), transparent)',
                  }}
                />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/15">
                  <Container className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute -inset-1 bg-primary/5 rounded-2xl blur-sm -z-10" />
              </div>

              <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                Docker Manager
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Container orchestration platform
              </p>
            </motion.div>

            {/* Login Card with animated gradient border */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="relative"
            >
              {/* Animated gradient border wrapper */}
              <div
                className="absolute -inset-[1px] rounded-2xl"
                style={{
                  background: `conic-gradient(from ${gradientAngle}deg, transparent 0%, oklch(0.7 0.15 160 / 0.25) 25%, transparent 50%, oklch(0.7 0.15 160 / 0.12) 75%, transparent 100%)`,
                  opacity: 0.3,
                }}
              />

              <div className="relative bg-card rounded-2xl p-8 shadow-lg border border-border/40">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/2 via-transparent to-transparent pointer-events-none" />

                <div className="relative">
                  <div className="mb-6">
                    <h2 className="text-xl font-medium text-foreground">Sign in</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                      Enter your credentials to access the dashboard
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-sm font-medium">
                        Username
                      </Label>
                      <div className="relative group">
                        <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center rounded-l-lg border-r border-border/40 bg-muted/15 group-focus-within:bg-primary/5 group-focus-within:border-primary/20 transition-colors">
                          <User className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        </div>
                        <Input
                          id="username"
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter your username"
                          className="pl-10 h-11 bg-input/60 border-border/60 focus:border-primary/50 transition-all"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">
                        Password
                      </Label>
                      <div className="relative group">
                        <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center rounded-l-lg border-r border-border/40 bg-muted/15 group-focus-within:bg-primary/5 group-focus-within:border-primary/20 transition-colors">
                          <Lock className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        </div>
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="pl-10 pr-10 h-11 bg-input/60 border-border/60 focus:border-primary/50 transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked === true)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <Label
                          htmlFor="remember"
                          className="text-xs text-muted-foreground cursor-pointer select-none"
                        >
                          Remember me
                        </Label>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-primary/70 hover:text-primary transition-colors hover:underline underline-offset-2"
                        onClick={() => {
                          toast({
                            title: 'Password reset',
                            description: 'Password reset is not available.',
                          });
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all relative overflow-hidden"
                    >
                      {isLoading ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center justify-center gap-2"
                        >
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Signing in...
                        </motion.div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center justify-center gap-2"
                        >
                          <Shield className="w-4 h-4" />
                          Login
                        </motion.div>
                      )}

                      {/* Loading shimmer effect (همان، ولی خیلی ملایم) */}
                      {isLoading && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                          animate={{ x: ['-100%', '100%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        />
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            </motion.div>

            {/* Feature badges section: چون اینجا فقط خطوط SVG بود، نگه می‌داریم (بدون پس‌زمینه‌های blur) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-6 relative"
            >
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-0"
                viewBox="0 0 400 200"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <motion.path
                  d="M 100 40 Q 200 20 300 40"
                  stroke="oklch(0.7 0.15 160 / 0.12)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 1, duration: 1.5, ease: 'easeInOut' }}
                />
                <motion.path
                  d="M 100 40 Q 150 80 100 120"
                  stroke="oklch(0.7 0.15 160 / 0.08)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 1.3, duration: 1.5, ease: 'easeInOut' }}
                />
                <motion.path
                  d="M 300 40 Q 250 80 300 120"
                  stroke="oklch(0.7 0.15 160 / 0.08)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 1.6, duration: 1.5, ease: 'easeInOut' }}
                />
                <motion.path
                  d="M 100 120 Q 200 140 300 120"
                  stroke="oklch(0.7 0.15 160 / 0.12)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 1.9, duration: 1.5, ease: 'easeInOut' }}
                />
              </svg>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center mt-6"
            >
              <p className="text-xs text-muted-foreground">Powered by m4sh wacker</p>
              <motion.p
                className="text-[10px] text-muted-foreground/50 mt-1"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="transition"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          className="min-h-screen flex items-center justify-center bg-background"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center gap-4"
          >
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-14 h-14 rounded-xl border-2 border-primary/30 border-t-primary flex items-center justify-center"
              />
              <Container className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center">
              <p className="text-foreground text-sm font-medium">Welcome back!</p>
              <p className="text-muted-foreground text-xs mt-1">Loading dashboard...</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
