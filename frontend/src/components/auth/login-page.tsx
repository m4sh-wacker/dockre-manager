'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Container, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const { login } = useAuthStore();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    const success = await login(username, password);
    setIsLoading(false);

    if (success) {
      toast({
        title: 'Welcome back!',
        description: 'Login successful. Redirecting to dashboard...',
      });
      onLoginSuccess();
    } else {
      toast({
        variant: 'destructive',
        title: 'Authentication failed',
        description: 'Invalid username or password. Try admin / admin123',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-grid-pattern">
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
      </div>

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
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 glow-primary-sm">
              <Container className="w-8 h-8 text-primary" />
            </div>
            <div className="absolute -inset-1 bg-primary/20 rounded-2xl blur-xl -z-10" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Docker Manager
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Container orchestration platform
          </p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          
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
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="pl-10 h-11 bg-input/50 border-border/50 focus:border-primary/50 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 pr-10 h-11 bg-input/50 border-border/50 focus:border-primary/50 transition-colors"
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

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all glow-primary-sm hover:glow-primary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </form>

            {/* Demo credentials hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 pt-6 border-t border-border/50"
            >
              <p className="text-xs text-muted-foreground text-center">
                Demo credentials: <span className="font-mono text-foreground/80">admin</span> / <span className="font-mono text-foreground/80">admin123</span>
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-muted-foreground mt-6"
        >
          Powered by Docker Engine
        </motion.p>
      </motion.div>
    </div>
  );
}
