'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Rocket, FileCode2, CheckCircle2, XCircle, Sparkles, AlertTriangle } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useDockerStore, type TemplateInfo } from '@/store/docker-store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CreateServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  serviceCount: number;
  services: string[];
}

function validateComposeYaml(yaml: string): ValidationResult {
  const errors: string[] = [];
  const services: string[] = [];

  if (!yaml.trim()) {
    return { valid: false, errors: ['YAML configuration is empty'], serviceCount: 0, services: [] };
  }

  const lines = yaml.split('\n');
  const trimmedLines = lines.map(l => l.trim());

  const servicesLineIndex = trimmedLines.findIndex(l => l === 'services:');
  if (servicesLineIndex === -1) {
    errors.push('Missing top-level "services:" key.');
    return { valid: false, errors, serviceCount: 0, services: [] };
  }

  const servicesIndent = lines[servicesLineIndex].search(/\S/);
  let currentService: string | null = null;
  let currentServiceHasImageOrBuild = false;
  let i = servicesLineIndex + 1;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { i++; continue; }
    const lineIndent = line.search(/\S/);
    if (lineIndent <= servicesIndent) break;
    if (lineIndent === servicesIndent + 2) {
      if (currentService && !currentServiceHasImageOrBuild) {
        errors.push(`Service "${currentService}" must have "image" or "build".`);
      }
      const serviceMatch = trimmed.match(/^(\w[\w-]*):\s*$/);
      if (serviceMatch) {
        currentService = serviceMatch[1];
        currentServiceHasImageOrBuild = false;
        services.push(currentService);
      }
    } else if (lineIndent > servicesIndent + 2 && currentService) {
      const propMatch = trimmed.match(/^(\w+):/);
      if (propMatch && (propMatch[1] === 'image' || propMatch[1] === 'build')) {
        currentServiceHasImageOrBuild = true;
      }
    }
    i++;
  }

  if (currentService && !currentServiceHasImageOrBuild) {
    errors.push(`Service "${currentService}" must have "image" or "build".`);
  }
  if (services.length === 0) {
    errors.push('No services found.');
  }

  return { valid: errors.length === 0, errors, serviceCount: services.length, services };
}

export function CreateServiceModal({ open, onOpenChange }: CreateServiceModalProps) {
  const [activeTab, setActiveTab] = useState('quick');
  const [projectName, setProjectName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const { templates, fetchTemplates, deployTemplate, deployCompose } = useDockerStore();
  const { toast } = useToast();

  // Quick Deploy state
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState('');

  // Custom Compose state
  const [yamlContent, setYamlContent] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Fetch templates when modal opens
  useEffect(() => {
    if (open) {
      fetchTemplates();
      setProjectName('');
      setSelectedTemplate(null);
      setYamlContent('');
      setValidationResult(null);
      setTemplateSearch('');
    }
  }, [open, fetchTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return templates;
    const q = templateSearch.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }, [templates, templateSearch]);

  const selectedTemplateInfo = useMemo(() => {
    if (!selectedTemplate) return null;
    return templates.find(t => t.name === selectedTemplate) || null;
  }, [selectedTemplate, templates]);

  const handleValidate = () => {
    setIsValidating(true);
    setTimeout(() => {
      const result = validateComposeYaml(yamlContent);
      setValidationResult(result);
      setIsValidating(false);
    }, 300);
  };

  const handleQuickDeploy = async () => {
    if (!selectedTemplate || !projectName.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please enter a project name and select a template.' });
      return;
    }

    setIsDeploying(true);
    try {
      const result = await deployTemplate(selectedTemplate, projectName.trim());
      toast({
        title: 'Service Deployed',
        description: `${projectName} deployed from ${selectedTemplate} template.${result.ports ? ` Ports: ${Object.entries(result.ports as Record<string, number>).map(([k, v]) => `${k}=${v}`).join(', ')}` : ''}`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Deployment Failed',
        description: err instanceof Error ? err.message : 'Failed to deploy service.',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleComposeDeploy = async () => {
    if (!projectName.trim() || !yamlContent.trim()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please enter a project name and YAML content.' });
      return;
    }
    if (!validationResult?.valid) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please validate your YAML first.' });
      return;
    }

    setIsDeploying(true);
    try {
      const result = await deployCompose(projectName.trim(), yamlContent);
      toast({
        title: 'Compose Deployed',
        description: `${projectName} deployed successfully.${result.ports ? ` Ports: ${Object.entries(result.ports as Record<string, number>).map(([k, v]) => `${k}=${v}`).join(', ')}` : ''}`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Deployment Failed',
        description: err instanceof Error ? err.message : 'Failed to deploy compose.',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleClose = () => {
    if (!isDeploying) onOpenChange(false);
  };

  const lineCount = yamlContent ? yamlContent.split('\n').length : 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[680px] bg-card/95 backdrop-blur-xl border-border/50 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Create New Service
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Deploy a new service using a template or custom Docker Compose YAML.
          </DialogDescription>
        </DialogHeader>

        {/* Project Name */}
        <div className="space-y-2 px-1">
          <Label htmlFor="projectName" className="text-sm font-medium">Project Name</Label>
          <Input
            id="projectName"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="e.g., my-awesome-app"
            className="bg-input/50 border-border/50 focus:border-primary/50 font-mono"
            disabled={isDeploying}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-fit">
            <TabsTrigger value="quick" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Quick Deploy
            </TabsTrigger>
            <TabsTrigger value="compose" className="gap-1.5">
              <FileCode2 className="w-3.5 h-3.5" />
              Custom Compose
            </TabsTrigger>
          </TabsList>

          {/* Quick Deploy Tab */}
          <TabsContent value="quick" className="flex-1 flex flex-col gap-4 mt-3 min-h-0">
            {/* Template Search */}
            <div className="relative">
              <Input
                placeholder="Search templates..."
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                className="bg-input/50 border-border/50 pl-9"
                disabled={isDeploying}
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Template Grid */}
            <div className="grid gap-3 max-h-[300px] overflow-y-auto">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No templates found. Add templates to the /templates directory.
                </div>
              ) : (
                filteredTemplates.map(template => (
                  <motion.button
                    key={template.name}
                    onClick={() => setSelectedTemplate(template.name)}
                    disabled={isDeploying}
                    className={cn(
                      'w-full text-left p-4 rounded-xl border transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-primary/30',
                      selectedTemplate === template.name
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border/50 bg-muted/10 hover:bg-muted/30 hover:border-border'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        selectedTemplate === template.name ? 'bg-primary/20' : 'bg-muted/30'
                      )}>
                        <FileCode2 className={cn('w-5 h-5', selectedTemplate === template.name ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={cn('text-sm font-semibold', selectedTemplate === template.name ? 'text-primary' : 'text-foreground')}>
                            {template.name}
                          </h4>
                          <div className="flex items-center gap-1.5">
                            {template.port_vars.length > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                {template.port_vars.length} port{template.port_vars.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                            {template.has_install_json && (
                              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-400 border-0">
                                install.json
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {template.description || 'Docker Compose template'}
                        </p>
                        {template.port_vars.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {template.port_vars.map(v => (
                              <span key={v} className="text-[10px] font-mono text-primary/60 bg-primary/5 px-1.5 py-0.5 rounded">
                                ${`{${v}}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </div>

            {/* Selected Template Info */}
            {selectedTemplateInfo && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/20"
              >
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="text-foreground font-medium">
                    {selectedTemplateInfo.name} selected
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    Ports will be auto-allocated starting from the next available port.
                    {selectedTemplateInfo.port_vars.length > 0 && ` Required: ${selectedTemplateInfo.port_vars.join(', ')}`}
                  </p>
                </div>
              </motion.div>
            )}
          </TabsContent>

          {/* Custom Compose Tab */}
          <TabsContent value="compose" className="flex-1 flex flex-col gap-4 mt-3 min-h-0">
            {/* YAML Editor */}
            <div className="relative rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
              <div className="flex">
                <div
                  className="select-none py-3 px-2 text-right text-[11px] font-mono text-muted-foreground/40 border-r border-border/30 bg-muted/30 shrink-0 overflow-hidden"
                  style={{ minWidth: '2.5rem' }}
                >
                  {Array.from({ length: Math.max(lineCount, 8) }, (_, i) => (
                    <div key={i} className="leading-5">{i + 1}</div>
                  ))}
                </div>
                <textarea
                  value={yamlContent}
                  onChange={e => {
                    setYamlContent(e.target.value);
                    if (validationResult) setValidationResult(null);
                  }}
                  placeholder={`services:\n  web:\n    image: nginx:latest\n    ports:\n      - "80:80"\n  db:\n    image: mysql:8.0\n    environment:\n      MYSQL_ROOT_PASSWORD: secret`}
                  className="flex-1 py-3 px-4 bg-transparent text-sm font-mono leading-5 resize-none outline-none min-h-[180px] max-h-[280px] placeholder:text-muted-foreground/30 text-foreground"
                  spellCheck={false}
                  disabled={isDeploying}
                />
              </div>
            </div>

            {/* Validate */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={isValidating || !yamlContent.trim() || isDeploying}
                className="border-border/50 gap-1.5"
              >
                {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isValidating ? 'Validating...' : 'Validate'}
              </Button>
              {yamlContent.trim() && !validationResult && (
                <span className="text-xs text-muted-foreground">Click Validate to check YAML structure</span>
              )}
            </div>

            {/* Validation Results */}
            <AnimatePresence mode="wait">
              {validationResult && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  {validationResult.valid ? (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-emerald-400">Valid Configuration</p>
                        <p className="text-xs text-emerald-400/70">{validationResult.serviceCount} service(s): {validationResult.services.join(', ')}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Validation Failed</p>
                        <ul className="space-y-0.5">
                          {validationResult.errors.map((error, idx) => (
                            <li key={idx} className="text-xs text-destructive/80 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button variant="outline" onClick={handleClose} disabled={isDeploying} className="border-border/50">
            Cancel
          </Button>
          <Button
            onClick={activeTab === 'quick' ? handleQuickDeploy : handleComposeDeploy}
            disabled={
              isDeploying ||
              !projectName.trim() ||
              (activeTab === 'quick' ? !selectedTemplate : !validationResult?.valid)
            }
            className="bg-primary hover:bg-primary/90 text-primary-foreground glow-primary-sm"
          >
            {isDeploying ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deploying...</>
            ) : (
              <><Rocket className="w-4 h-4 mr-2" />Deploy</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
