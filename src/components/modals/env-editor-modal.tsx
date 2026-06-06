'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, Download, Upload, RotateCw, Search,
  Eye, EyeOff, Trash2, AlertTriangle, Variable, FileCode2,
  Check, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface EnvVar {
  key: string;
  value: string;
  isModified: boolean;
  isSensitive: boolean;
  isNew?: boolean;
  originalKey?: string;
  originalValue?: string;
}

interface EnvEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  containerName: string;
}

const SENSITIVE_PATTERNS = /PASSWORD|SECRET|KEY|TOKEN|API_KEY|PRIVATE|CREDENTIAL|AUTH/i;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.test(key);
}

export function EnvEditorModal({ open, onOpenChange, containerId, containerName }: EnvEditorModalProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [originalVars, setOriginalVars] = useState<EnvVar[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [maskedKeys, setMaskedKeys] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch environment variables
  const fetchEnvVars = useCallback(async () => {
    if (!containerId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/containers/${containerId}/env`);
      if (response.ok) {
        const data = await response.json();
        const vars: EnvVar[] = (data.variables || []).map((v: EnvVar) => ({
          ...v,
          originalKey: v.key,
          originalValue: v.value,
          isModified: false,
          isNew: false,
        }));
        // Sort by key
        vars.sort((a, b) => a.key.localeCompare(b.key));
        setEnvVars(vars);
        setOriginalVars(vars.map(v => ({ ...v })));

        // Auto-mask sensitive keys
        const sensitive = new Set<string>();
        vars.forEach(v => {
          if (v.isSensitive) sensitive.add(v.key);
        });
        setMaskedKeys(sensitive);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Failed to load',
        description: 'Could not fetch environment variables.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [containerId, toast]);

  useEffect(() => {
    if (open && containerId) {
      fetchEnvVars();
    }
  }, [open, containerId, fetchEnvVars]);

  // Filter variables based on search
  const filteredVars = envVars.filter(v =>
    !searchQuery ||
    v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const modifiedCount = envVars.filter(v => v.isModified).length;
  const newCount = envVars.filter(v => v.isNew).length;
  const sensitiveCount = envVars.filter(v => v.isSensitive).length;

  // Toggle mask for a key
  const toggleMask = (key: string) => {
    setMaskedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Update a variable value
  const updateVar = (key: string, field: 'key' | 'value', newValue: string) => {
    setEnvVars(prev => prev.map(v => {
      if (v.key === key || v.originalKey === key) {
        const isKeyModified = field === 'key' ? newValue !== v.originalKey : v.key !== v.originalKey;
        const isValueModified = field === 'value' ? newValue !== v.originalValue : v.value !== v.originalValue;
        return {
          ...v,
          [field]: newValue,
          isModified: isKeyModified || isValueModified,
        };
      }
      return v;
    }));
  };

  // Add a new variable
  const addVariable = () => {
    const newKey = `NEW_VAR_${envVars.filter(v => v.isNew).length + 1}`;
    const newVar: EnvVar = {
      key: newKey,
      value: '',
      isModified: false,
      isSensitive: isSensitiveKey(newKey),
      isNew: true,
      originalKey: newKey,
      originalValue: '',
    };
    setEnvVars(prev => [...prev, newVar].sort((a, b) => a.key.localeCompare(b.key)));
    setEditingKey(newKey);
    setEditingValue('');
  };

  // Delete a variable
  const deleteVar = (key: string) => {
    setEnvVars(prev => prev.filter(v => v.key !== key && v.originalKey !== key));
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setEnvVars(originalVars.map(v => ({ ...v })));
    toast({
      title: 'Reset',
      description: 'Environment variables have been reset to their default values.',
    });
  };

  // Export to .env file
  const exportEnv = () => {
    const content = envVars
      .map(v => `${v.key}=${v.value}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerName}.env`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Exported',
      description: `Environment variables exported to ${containerName}.env`,
    });
  };

  // Import from .env file
  const importEnv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'));

      const importedVars: EnvVar[] = lines.map(line => {
        const equalIdx = line.indexOf('=');
        const key = line.substring(0, equalIdx).trim();
        const value = line.substring(equalIdx + 1).trim().replace(/^["']|["']$/g, '');
        return {
          key,
          value,
          isModified: true,
          isSensitive: isSensitiveKey(key),
          isNew: true,
          originalKey: key,
          originalValue: '',
        };
      });

      setEnvVars(prev => {
        // Merge: update existing keys, add new ones
        const merged = [...prev];
        for (const iv of importedVars) {
          const existingIdx = merged.findIndex(v => v.key === iv.key);
          if (existingIdx >= 0) {
            merged[existingIdx] = { ...merged[existingIdx], value: iv.value, isModified: true };
          } else {
            merged.push(iv);
          }
        }
        return merged.sort((a, b) => a.key.localeCompare(b.key));
      });

      toast({
        title: 'Imported',
        description: `${importedVars.length} variable(s) imported from ${file.name}`,
      });
    };
    reader.readAsText(file);
    // Reset input so the same file can be imported again
    event.target.value = '';
  };

  // Start editing a value
  const startEditing = (key: string, value: string) => {
    setEditingKey(key);
    setEditingValue(value);
  };

  // Save editing
  const saveEditing = () => {
    if (editingKey) {
      updateVar(editingKey, 'value', editingValue);
      setEditingKey(null);
      setEditingValue('');
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingKey(null);
    setEditingValue('');
  };

  // Color coding for rows
  const getRowStyle = (v: EnvVar) => {
    if (v.isNew) return 'border-l-2 border-l-amber-400 bg-amber-500/[0.03]';
    if (v.isModified) return 'border-l-2 border-l-emerald-400 bg-emerald-500/[0.03]';
    return 'border-l-2 border-l-transparent';
  };

  const getBadgeVariant = (v: EnvVar) => {
    if (v.isNew) return 'default';
    if (v.isModified) return 'default';
    return 'secondary';
  };

  const getBadgeClass = (v: EnvVar) => {
    if (v.isNew) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (v.isModified) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    return 'bg-muted/50 text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Variable className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span>Environment Variables</span>
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                {containerName}
              </p>
            </div>
          </DialogTitle>

          {/* Stats */}
          <div className="flex items-center gap-3 mt-3">
            <Badge variant="secondary" className="bg-muted/50">
              {envVars.length} variables
            </Badge>
            {modifiedCount > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <Check className="w-3 h-3 mr-1" />
                {modifiedCount} modified
              </Badge>
            )}
            {newCount > 0 && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Plus className="w-3 h-3 mr-1" />
                {newCount} new
              </Badge>
            )}
            {sensitiveCount > 0 && (
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                <EyeOff className="w-3 h-3 mr-1" />
                {sensitiveCount} sensitive
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border/30 bg-muted/20">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm bg-input/50 border-border/50"
            />
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={addVariable}
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={exportEnv}
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".env,.txt"
              onChange={importEnv}
              className="hidden"
            />
            <div className="w-px h-5 bg-border/50 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-amber-400 hover:text-amber-300"
              onClick={resetToDefaults}
            >
              <RotateCw className="w-3.5 h-3.5" />
              Reset
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Loading environment variables...</p>
              </div>
            </div>
          ) : filteredVars.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <FileCode2 className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No variables match your search' : 'No environment variables found'}
                </p>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={addVariable}
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Variable
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <ScrollArea className="max-h-[50vh]">
              <div className="divide-y divide-border/20">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-6 py-2 bg-muted/30 sticky top-0 z-10">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Key</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Value</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider w-24 text-center">Actions</span>
                </div>

                {/* Variable Rows */}
                <AnimatePresence>
                  {filteredVars.map((v, index) => (
                    <motion.div
                      key={v.key + v.originalKey}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        'grid grid-cols-[1fr_1fr_auto] gap-3 px-6 py-2.5 items-center',
                        'hover:bg-muted/10 transition-colors',
                        getRowStyle(v)
                      )}
                    >
                      {/* Key */}
                      <div className="flex items-center gap-2 min-w-0">
                        {v.isSensitive && (
                          <EyeOff className="w-3.5 h-3.5 text-red-400/60 shrink-0" />
                        )}
                        {v.isNew ? (
                          <input
                            type="text"
                            value={v.key}
                            onChange={(e) => {
                              const newKey = e.target.value;
                              setEnvVars(prev => prev.map(pv => {
                                if (pv.key === v.key || pv.originalKey === v.originalKey) {
                                  return { ...pv, key: newKey, isSensitive: isSensitiveKey(newKey) };
                                }
                                return pv;
                              }));
                            }}
                            className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-amber-400 min-w-0"
                            autoFocus
                          />
                        ) : (
                          <span className="font-mono text-sm text-foreground truncate">
                            {v.key}
                          </span>
                        )}
                        <Badge variant="secondary" className={cn('text-[9px] px-1.5 py-0 h-4 shrink-0', getBadgeClass(v))}>
                          {v.isNew ? 'NEW' : v.isModified ? 'MODIFIED' : 'DEFAULT'}
                        </Badge>
                      </div>

                      {/* Value */}
                      <div className="min-w-0">
                        {editingKey === v.key ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditing();
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              className="flex-1 bg-input/50 border border-primary/30 rounded px-2 py-0.5 font-mono text-sm text-foreground outline-none focus:border-primary"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={saveEditing}
                            >
                              <Check className="w-3 h-3 text-emerald-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={cancelEditing}
                            >
                              <X className="w-3 h-3 text-muted-foreground" />
                            </Button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1 cursor-pointer group/value"
                            onClick={() => startEditing(v.key, v.value)}
                          >
                            <span className={cn(
                              'font-mono text-sm truncate min-w-0',
                              v.isModified ? 'text-emerald-400' : 'text-foreground/70',
                              v.isNew && !v.value && 'text-muted-foreground italic'
                            )}>
                              {maskedKeys.has(v.key) && v.value
                                ? '•'.repeat(Math.min(v.value.length, 20))
                                : v.value || '(empty)'}
                            </span>
                            {v.isSensitive && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover/value:opacity-100 transition-opacity shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMask(v.key);
                                }}
                              >
                                {maskedKeys.has(v.key) ? (
                                  <Eye className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <EyeOff className="w-3 h-3 text-muted-foreground" />
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-center gap-0.5">
                        {v.isSensitive && !editingKey && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleMask(v.key)}
                            title={maskedKeys.has(v.key) ? 'Show value' : 'Hide value'}
                          >
                            {maskedKeys.has(v.key) ? (
                              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                        {!editingKey && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-400"
                            onClick={() => deleteVar(v.key)}
                            title="Delete variable"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-muted/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400/60" />
            <span>Changes are applied on container restart</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => {
                toast({
                  title: 'Saved',
                  description: `${modifiedCount + newCount} environment variable(s) saved. Restart the container to apply changes.`,
                });
                onOpenChange(false);
              }}
            >
              <Check className="w-4 h-4 mr-1.5" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
