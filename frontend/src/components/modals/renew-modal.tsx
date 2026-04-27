'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CalendarPlus, Calendar, ArrowRight } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDockerStore, type DockerContainer } from '@/store/docker-store';
import { useToast } from '@/hooks/use-toast';
import { 
  extendExpirationDate, 
  formatExpirationDate, 
  type DurationUnit 
} from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface RenewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: DockerContainer | null;
}

export function RenewModal({ open, onOpenChange, container }: RenewModalProps) {
  const [durationValue, setDurationValue] = useState('30');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [isRenewing, setIsRenewing] = useState(false);
  const { renewContainer } = useDockerStore();
  const { toast } = useToast();

  // Calculate new expiration date
  const newExpirationDate = useMemo(() => {
    if (!container) return null;
    const value = parseInt(durationValue) || 0;
    if (value <= 0) return null;
    return extendExpirationDate(container.expiresAt, { value, unit: durationUnit });
  }, [container, durationValue, durationUnit]);

  const handleRenew = async () => {
    if (!container) return;

    const duration = parseInt(durationValue);
    if (!duration || duration <= 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please enter a valid duration.',
      });
      return;
    }

    if (!newExpirationDate) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Unable to calculate new expiration date.',
      });
      return;
    }

    setIsRenewing(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    renewContainer(container.id, newExpirationDate);

    setIsRenewing(false);
    setDurationValue('30');
    setDurationUnit('days');
    onOpenChange(false);

    toast({
      title: 'Service renewed',
      description: `${container.serviceName} has been renewed. New expiration: ${formatExpirationDate(newExpirationDate)}.`,
    });
  };

  const handleClose = () => {
    if (!isRenewing) {
      onOpenChange(false);
    }
  };

  if (!container) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-primary" />
            Renew Service
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Extend the duration for <span className="font-medium text-foreground">{container.serviceName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Current expiration */}
          <div className="bg-muted/30 border border-border/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Current expiration</p>
            <p className="font-medium text-foreground">
              {formatExpirationDate(container.expiresAt)}
            </p>
          </div>

          {/* Duration Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <Label className="text-sm font-medium">Extend duration by</Label>
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
                  disabled={isRenewing}
                />
              </div>
              <ToggleGroup
                type="single"
                value={durationUnit}
                onValueChange={(value) => value && setDurationUnit(value as DurationUnit)}
                disabled={isRenewing}
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
          </div>

          {/* New expiration date preview */}
          {newExpirationDate && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-primary/5 border border-primary/20 rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">New expiration</p>
                  <p className="font-semibold text-foreground">
                    {formatExpirationDate(newExpirationDate)}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-primary" />
              </div>
            </motion.div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isRenewing}
            className="border-border/50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRenew}
            disabled={isRenewing || !newExpirationDate}
            className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary-sm"
          >
            {isRenewing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Renewing...
              </>
            ) : (
              <>
                <CalendarPlus className="w-4 h-4 mr-2" />
                Renew Service
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
