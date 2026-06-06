import { create } from 'zustand';
import { apiRequest } from '@/lib/api';

export type ContainerState = 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  project: string;
  service: string;
  state: ContainerState;
}

export interface ProjectGroup {
  name: string;
  containers: ContainerInfo[];
}

export interface TemplateInfo {
  name: string;
  description: string;
  has_compose: boolean;
  has_install_json: boolean;
  port_vars: string[];
  install_json?: {
    start_command: string;
    final_command: string | null;
  };
  compose_content?: string;
}

export interface SystemResources {
  cpu_percent: number;
  memory_total: number;
  memory_used: number;
  memory_percent: number;
  disk_total: number;
  disk_used: number;
  disk_percent: number;
  docker_running: number;
  docker_total: number;
  project_total: number;
  timestamp: string;
}

function mapState(raw: string): ContainerState {
  const lower = raw.toLowerCase();
  if (lower === 'running') return 'running';
  if (lower === 'exited') return 'exited';
  if (lower === 'paused') return 'paused';
  if (lower === 'restarting') return 'restarting';
  if (lower === 'dead') return 'dead';
  if (lower === 'created') return 'created';
  return 'exited';
}

interface DockerState {
  projects: ProjectGroup[];
  templates: TemplateInfo[];
  systemResources: SystemResources | null;
  isLoading: boolean;
  error: string | null;

  fetchContainers: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  fetchSystemResources: () => Promise<void>;
  startContainer: (id: string) => Promise<void>;
  stopContainer: (id: string) => Promise<void>;
  restartContainer: (id: string) => Promise<void>;
  pauseContainer: (id: string) => Promise<void>;
  unpauseContainer: (id: string) => Promise<void>;
  removeContainer: (id: string, force?: boolean) => Promise<void>;
  getContainerLogs: (id: string, tail?: number) => Promise<string[]>;
  execContainerCommand: (id: string, command: string) => Promise<string>;
  deployTemplate: (templateName: string, projectName: string) => Promise<Record<string, unknown>>;
  deployCompose: (name: string, yaml: string) => Promise<Record<string, unknown>>;
}

// Optimistically set a single container's state across all projects.
function setContainerState(projects: ProjectGroup[], id: string, state: ContainerState): ProjectGroup[] {
  return projects.map(project => ({
    ...project,
    containers: project.containers.map(c => (c.id === id ? { ...c, state } : c)),
  }));
}

export const useDockerStore = create<DockerState>((set, get) => ({
  projects: [],
  templates: [],
  systemResources: null,
  isLoading: false,
  error: null,

  fetchContainers: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiRequest('/api/containers');
      if (!response.ok) {
        set({ projects: [], isLoading: false, error: `Failed to fetch containers: ${response.status}` });
        return;
      }
      const data = await response.json();
      const projects: ProjectGroup[] = Array.isArray(data) ? data : [];
      const mapped = projects.map(pg => ({
        ...pg,
        containers: (pg.containers || []).map((c: ContainerInfo) => ({
          ...c,
          state: mapState(c.state || c.status || 'exited'),
        })),
      }));
      set({ projects: mapped, isLoading: false });
    } catch (err) {
      console.error('Error fetching containers:', err);
      set({ projects: [], isLoading: false, error: 'Network error' });
    }
  },

  fetchTemplates: async () => {
    try {
      const response = await apiRequest('/api/templates');
      if (response.ok) {
        const data = await response.json();
        set({ templates: Array.isArray(data) ? data : [] });
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  },

  fetchSystemResources: async () => {
    try {
      const response = await apiRequest('/api/system/resources');
      if (response.ok) {
        const data = await response.json();
        set({ systemResources: data as SystemResources });
      }
    } catch (err) {
      console.error('Error fetching system resources:', err);
    }
  },

  startContainer: async (id: string) => {
    set(state => ({ projects: setContainerState(state.projects, id, 'running') }));
    const response = await apiRequest(`/api/containers/${id}/start`, { method: 'POST' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to start container' }));
      await get().fetchContainers();
      throw new Error(err.error || 'Failed to start container');
    }
    setTimeout(() => get().fetchContainers(), 1000);
  },

  stopContainer: async (id: string) => {
    set(state => ({ projects: setContainerState(state.projects, id, 'exited') }));
    const response = await apiRequest(`/api/containers/${id}/stop`, { method: 'POST' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to stop container' }));
      await get().fetchContainers();
      throw new Error(err.error || 'Failed to stop container');
    }
    setTimeout(() => get().fetchContainers(), 1000);
  },

  restartContainer: async (id: string) => {
    set(state => ({ projects: setContainerState(state.projects, id, 'restarting') }));
    const response = await apiRequest(`/api/containers/${id}/restart`, { method: 'POST' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to restart container' }));
      await get().fetchContainers();
      throw new Error(err.error || 'Failed to restart container');
    }
    setTimeout(() => get().fetchContainers(), 1500);
  },

  pauseContainer: async (id: string) => {
    set(state => ({ projects: setContainerState(state.projects, id, 'paused') }));
    const response = await apiRequest(`/api/containers/${id}/pause`, { method: 'POST' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to pause container' }));
      await get().fetchContainers();
      throw new Error(err.error || 'Failed to pause container');
    }
    setTimeout(() => get().fetchContainers(), 500);
  },

  unpauseContainer: async (id: string) => {
    set(state => ({ projects: setContainerState(state.projects, id, 'running') }));
    const response = await apiRequest(`/api/containers/${id}/unpause`, { method: 'POST' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to unpause container' }));
      await get().fetchContainers();
      throw new Error(err.error || 'Failed to unpause container');
    }
    setTimeout(() => get().fetchContainers(), 500);
  },

  removeContainer: async (id: string, force = false) => {
    const originalProjects = get().projects;
    set(state => ({
      projects: state.projects
        .map(project => ({
          ...project,
          containers: project.containers.filter(c => c.id !== id),
        }))
        .filter(project => project.containers.length > 0),
    }));

    const url = force ? `/api/containers/${id}?force=true` : `/api/containers/${id}`;
    const response = await apiRequest(url, { method: 'DELETE' });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to remove container' }));
      set({ projects: originalProjects });
      throw new Error(err.error || 'Failed to remove container');
    }
    setTimeout(() => get().fetchContainers(), 500);
  },

  getContainerLogs: async (id: string, tail = 100): Promise<string[]> => {
    try {
      const response = await apiRequest(`/api/containers/${id}/logs?tail=${tail}`);
      if (response.ok) {
        const data = await response.json();
        return data.logs || [];
      }
      return [];
    } catch {
      return [];
    }
  },

  execContainerCommand: async (id: string, command: string): Promise<string> => {
    const response = await apiRequest(`/api/containers/${id}/exec`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
    if (!response.ok) {
      throw new Error('Failed to execute command');
    }
    const data = await response.json();
    return data.output || '';
  },

  deployTemplate: async (templateName: string, projectName: string): Promise<Record<string, unknown>> => {
    const response = await apiRequest(`/api/templates/${templateName}/deploy`, {
      method: 'POST',
      body: JSON.stringify({ name: projectName }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Deployment failed' }));
      throw new Error(err.error || 'Deployment failed');
    }
    const data = await response.json();
    await get().fetchContainers();
    return data;
  },

  deployCompose: async (name: string, yaml: string): Promise<Record<string, unknown>> => {
    const response = await apiRequest('/api/compose/deploy', {
      method: 'POST',
      body: JSON.stringify({ name, yaml }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Deployment failed' }));
      throw new Error(err.error || 'Deployment failed');
    }
    const data = await response.json();
    await get().fetchContainers();
    return data;
  },
}));
