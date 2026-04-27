'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Rocket, Info, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDockerStore } from '@/store/docker-store';
import { useToast } from '@/hooks/use-toast';
import { 
  calculateExpirationDate, 
  formatExpirationDate, 
  type DurationUnit 
} from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface CreateServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateServiceModal({ open, onOpenChange }: CreateServiceModalProps) {
  const [serviceName, setServiceName] = useState('');
  const [autoAssign, setAutoAssign] = useState(true);
  const [frontendPort, setFrontendPort] = useState('');
  const [backendPort, setBackendPort] = useState('');
  const [durationValue, setDurationValue] = useState('30');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [isDeploying, setIsDeploying] = useState(false);
  const { addContainer } = useDockerStore();
  const { toast } = useToast();

  // Calculate expiration date
  const expirationDate = useMemo(() => {
    const value = parseInt(durationValue) || 0;
    if (value <= 0) return null;
    return calculateExpirationDate({ value, unit: durationUnit });
  }, [durationValue, durationUnit]);

  const handleDeploy = async () => {
    if (!serviceName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter a service name.',
      });
      return;
    }

    if (!autoAssign) {
      const frontend = parseInt(frontendPort);
      const backend = parseInt(backendPort);
      
      if (!frontend || !backend || frontend < 1 || backend < 1 || frontend > 65535 || backend > 65535) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please enter valid port numbers (1-65535).',
        });
        return;
      }
    }

    const duration = parseInt(durationValue);
    if (!duration || duration <= 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter a valid duration.',
      });
      return;
    }

    if (!expirationDate) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Unable to calculate expiration date.',
      });
      return;
    }

    setIsDeploying(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    const frontend = autoAssign 
      ? Math.floor(Math.random() * 1000) + 3000 
      : parseInt(frontendPort);
    const backend = autoAssign 
      ? Math.floor(Math.random() * 1000) + 8000 
      : parseInt(backendPort);

    addContainer({
      serviceName: serviceName.trim(),
      status: 'running',
      frontendPort: frontend,
      backendPort: backend,
      cpu: Math.floor(Math.random() * 20) + 5,
      memory: Math.floor(Math.random() * 300) + 100,
      expiresAt: expirationDate,
    });

    setIsDeploying(false);
    setServiceName('');
    setFrontendPort('');
    setBackendPort('');
    setDurationValue('30');
    setDurationUnit('days');
    onOpenChange(false);

    toast({
      title: 'Service deployed',
      description: `${serviceName} has been deployed successfully. Expires ${formatExpirationDate(expirationDate)}.`,
    });
  };

  const handleClose = () => {
    if (!isDeploying) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Create New Service
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Deploy a new containerized service to your Docker environment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Service Name */}
          <div className="space-y-2">
            <Label htmlFor="serviceName" className="text-sm font-medium">
              Service Name
            </Label>
            <Input
              id="serviceName"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g., my-awesome-app"
              className="bg-input/50 border-border/50 focus:border-primary/50"
              disabled={isDeploying}
            />
          </div>

          {/* Port Strategy */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Port Strategy</Label>
                <p className="text-xs text-muted-foreground">
                  Auto-assign or manually specify ports
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs', !autoAssign ? 'text-foreground' : 'text-muted-foreground')}>
                  Manual
                </span>
                <Switch
                  checked={autoAssign}
                  onCheckedChange={setAutoAssign}
                  disabled={isDeploying}
                />
                <span className={cn('text-xs', autoAssign ? 'text-foreground' : 'text-muted-foreground')}>
                  Auto
                </span>
              </div>
            </div>

            {autoAssign ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-muted/50 rounded-lg p-4 flex items-start gap-3"
              >
                <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Ports will be assigned automatically from the available port pool. 
                  The system will find suitable ports for both frontend and backend services.
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="frontendPort" className="text-sm font-medium">
                    Frontend Port
                  </Label>
                  <Input
                    id="frontendPort"
                    type="number"
                    value={frontendPort}
                    onChange={(e) => setFrontendPort(e.target.value)}
                    placeholder="3000"
                    className="bg-input/50 border-border/50 focus:border-primary/50 font-mono"
                    disabled={isDeploying}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backendPort" className="text-sm font-medium">
                    Backend Port
                  </Label>
                  <Input
                    id="backendPort"
                    type="number"
                    value={backendPort}
                    onChange={(e) => setBackendPort(e.target.value)}
                    placeholder="8080"
                    className="bg-input/50 border-border/50 focus:border-primary/50 font-mono"
                    disabled={isDeploying}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Duration Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <Label className="text-sm font-medium">Duration</Label>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={durationValue}
                  onChange={(e) => setDurationValue(e.target.value)}
                  placeholder="30"
                  className="bg-input/50 border-border/50 focus:border-primary/50 font-mono"
                  disabled={isDeploying}
                />
              </div>
              <ToggleGroup
                type="single"
                value={durationUnit}
                onValueChange={(value) => value && setDurationUnit(value as DurationUnit)}
                disabled={isDeploying}
                className="bg-muted/50 border border-border/50 rounded-lg p-1"
              >
                <ToggleGroupItem
                  value="days"
                  className={cn(
                    'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
                    durationUnit === 'days' 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'hover:bg-muted'
                  )}
                >
                  Days
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="months"
                  className={cn(
                    'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
                    durationUnit === 'months' 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'hover:bg-muted'
                  )}
                >
                  Months
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Expiration date preview */}
            {expirationDate && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-muted/30 border border-border/30 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Expires on:</span>
                  <span className="font-medium text-foreground">
                    {formatExpirationDate(expirationDate)}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeploying}
            className="border-border/50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary-sm"
          >
            {isDeploying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4 mr-2" />
                Deploy Service
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
