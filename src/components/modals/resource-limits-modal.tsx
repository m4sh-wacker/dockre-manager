'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, MemoryStick, RotateCcw, Shield, Zap, Save,
  AlertTriangle, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ResourceLimitsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerName: string;
  containerId: string;
}

export function ResourceLimitsModal({
  open,
  onOpenChange,
  containerName,
  containerId,
}: ResourceLimitsModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // CPU Limits
  const [cpuLimit, setCpuLimit] = useState('0.5');
  const [cpuReservation, setCpuReservation] = useState('0.25');

  // Memory Limits
  const [memoryLimit, setMemoryLimit] = useState('512');
  const [memoryLimitUnit, setMemoryLimitUnit] = useState('MB');
  const [memoryReservation, setMemoryReservation] = useState('256');
  const [memoryReservationUnit, setMemoryReservationUnit] = useState('MB');

  // Restart Policy
  const [restartPolicy, setRestartPolicy] = useState('unless-stopped');
  const [maximumRetryCount, setMaximumRetryCount] = useState('3');

  // OOM Settings
  const [disableOomKill, setDisableOomKill] = useState(false);
  const [oomScoreAdj, setOomScoreAdj] = useState('0');

  // Pids Limit
  const [pidsLimit, setPidsLimit] = useState('');
  const [pidsLimitEnabled, setPidsLimitEnabled] = useState(false);

  // Read-only root filesystem
  const [readOnlyRootFilesystem, setReadOnlyRootFilesystem] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast({
      title: 'Resource limits updated',
      description: `Resource limits for ${containerName} have been saved.`,
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    setCpuLimit('0.5');
    setCpuReservation('0.25');
    setMemoryLimit('512');
    setMemoryLimitUnit('MB');
    setMemoryReservation('256');
    setMemoryReservationUnit('MB');
    setRestartPolicy('unless-stopped');
    setMaximumRetryCount('3');
    setDisableOomKill(false);
    setOomScoreAdj('0');
    setPidsLimit('');
    setPidsLimitEnabled(false);
    setReadOnlyRootFilesystem(false);
    toast({
      title: 'Reset to defaults',
      description: 'All resource limits have been reset to default values.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            Resource Limits
          </DialogTitle>
          <DialogDescription>
            Configure CPU, memory, and restart policies for <span className="font-medium text-foreground">{containerName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* CPU Limits */}
          <Card className="bg-muted/20 border-border/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">CPU Limits</h3>
                <Badge variant="secondary" className="text-[9px] ml-auto">vCPU</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CPU Limit</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="16"
                    value={cpuLimit}
                    onChange={(e) => setCpuLimit(e.target.value)}
                    className="h-9 text-sm font-mono bg-input/50 border-border/50"
                  />
                  <p className="text-[10px] text-muted-foreground">Max CPUs allocated</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CPU Reservation</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="16"
                    value={cpuReservation}
                    onChange={(e) => setCpuReservation(e.target.value)}
                    className="h-9 text-sm font-mono bg-input/50 border-border/50"
                  />
                  <p className="text-[10px] text-muted-foreground">Min CPUs guaranteed</p>
                </div>
              </div>

              {/* CPU visual bar */}
              <div className="pt-1">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                  <span>0</span>
                  <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/40 rounded-full transition-all"
                      style={{ width: `${(parseFloat(cpuLimit) / 16) * 100}%` }}
                    />
                    <div
                      className="absolute top-0 h-full bg-emerald-500/70 rounded-full transition-all"
                      style={{ width: `${(parseFloat(cpuReservation) / 16) * 100}%` }}
                    />
                  </div>
                  <span>16</span>
                </div>
                <div className="flex items-center gap-4 text-[10px]">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/70" />
                    Reservation: {cpuReservation}
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-400/40" />
                    Limit: {cpuLimit}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Memory Limits */}
          <Card className="bg-muted/20 border-border/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                  <MemoryStick className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Memory Limits</h3>
                <Badge variant="secondary" className="text-[9px] ml-auto">RAM</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Memory Limit</Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      min="1"
                      value={memoryLimit}
                      onChange={(e) => setMemoryLimit(e.target.value)}
                      className="h-9 text-sm font-mono bg-input/50 border-border/50 flex-1"
                    />
                    <Select value={memoryLimitUnit} onValueChange={setMemoryLimitUnit}>
                      <SelectTrigger className="w-16 h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MB">MB</SelectItem>
                        <SelectItem value="GB">GB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Memory Reservation</Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      min="1"
                      value={memoryReservation}
                      onChange={(e) => setMemoryReservation(e.target.value)}
                      className="h-9 text-sm font-mono bg-input/50 border-border/50 flex-1"
                    />
                    <Select value={memoryReservationUnit} onValueChange={setMemoryReservationUnit}>
                      <SelectTrigger className="w-16 h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MB">MB</SelectItem>
                        <SelectItem value="GB">GB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Restart Policy */}
          <Card className="bg-muted/20 border-border/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-md bg-sky-500/10 flex items-center justify-center">
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Restart Policy</h3>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Policy</Label>
                <Select value={restartPolicy} onValueChange={setRestartPolicy}>
                  <SelectTrigger className="h-9 text-sm bg-input/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No (Don't restart)</SelectItem>
                    <SelectItem value="on-failure">On Failure</SelectItem>
                    <SelectItem value="always">Always</SelectItem>
                    <SelectItem value="unless-stopped">Unless Stopped</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {restartPolicy === 'no' && 'Container will not restart automatically'}
                  {restartPolicy === 'on-failure' && 'Restart only when the container exits with a non-zero code'}
                  {restartPolicy === 'always' && 'Always restart regardless of exit status'}
                  {restartPolicy === 'unless-stopped' && 'Always restart unless explicitly stopped'}
                </p>
              </div>

              {restartPolicy === 'on-failure' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Maximum Retry Count</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={maximumRetryCount}
                    onChange={(e) => setMaximumRetryCount(e.target.value)}
                    className="h-9 text-sm font-mono bg-input/50 border-border/50"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Card className="bg-muted/20 border-border/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Advanced</h3>
                <Badge variant="outline" className="text-[9px] ml-auto border-amber-500/30 text-amber-400">Advanced</Badge>
              </div>

              {/* OOM Kill */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs font-medium text-foreground">Disable OOM Kill</p>
                  <p className="text-[10px] text-muted-foreground">Prevent kernel from killing container on OOM</p>
                </div>
                <Switch checked={disableOomKill} onCheckedChange={setDisableOomKill} />
              </div>

              <Separator className="bg-border/20" />

              {/* OOM Score Adj */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">OOM Score Adjustment</Label>
                <Input
                  type="number"
                  min="-1000"
                  max="1000"
                  value={oomScoreAdj}
                  onChange={(e) => setOomScoreAdj(e.target.value)}
                  className="h-9 text-sm font-mono bg-input/50 border-border/50"
                />
                <p className="text-[10px] text-muted-foreground">-1000 (never kill) to 1000 (always kill)</p>
              </div>

              <Separator className="bg-border/20" />

              {/* PIDs Limit */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">PIDs Limit</p>
                    <p className="text-[10px] text-muted-foreground">Limit number of processes</p>
                  </div>
                  <Switch checked={pidsLimitEnabled} onCheckedChange={setPidsLimitEnabled} />
                </div>
                {pidsLimitEnabled && (
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g., 100"
                    value={pidsLimit}
                    onChange={(e) => setPidsLimit(e.target.value)}
                    className="h-9 text-sm font-mono bg-input/50 border-border/50"
                  />
                )}
              </div>

              <Separator className="bg-border/20" />

              {/* Read-only filesystem */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs font-medium text-foreground">Read-only Root Filesystem</p>
                  <p className="text-[10px] text-muted-foreground">Mount root filesystem as read-only</p>
                </div>
                <Switch checked={readOnlyRootFilesystem} onCheckedChange={setReadOnlyRootFilesystem} />
              </div>
            </CardContent>
          </Card>

          {/* Warning note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">
              Resource limits require container restart to take effect. Setting limits too low may cause service instability.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
              onClick={handleReset}
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Defaults
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    Save Limits
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
