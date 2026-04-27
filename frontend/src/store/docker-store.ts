import { create } from 'zustand';

export type ContainerStatus = 'running' | 'stopped' | 'exited';

export interface DockerContainer {
  id: string;
  serviceName: string;
  status: ContainerStatus;
  frontendPort: number | null;
  backendPort: number | null;
  cpu: number;
  memory: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

interface DockerState {
  containers: DockerContainer[];
  logs: Record<string, LogEntry[]>;
  addContainer: (container: Omit<DockerContainer, 'id' | 'createdAt'>) => void;
  updateContainerStatus: (id: string, status: ContainerStatus) => void;
  renewContainer: (id: string, newExpiresAt: Date) => void;
  removeContainer: (id: string) => void;
  getContainerLogs: (id: string) => LogEntry[];
  appendLog: (containerId: string, entry: Omit<LogEntry, 'timestamp'>) => void;
}

// Mock data with various expiration times for testing
const now = Date.now();
const mockContainers: DockerContainer[] = [
  {
    id: '1',
    serviceName: 'project-alpha',
    status: 'running',
    frontendPort: 3000,
    backendPort: 8080,
    cpu: 12,
    memory: 256,
    createdAt: new Date(now - 86400000 * 2),
    expiresAt: new Date(now + 86400000 * 29), // 29 days from now
  },
  {
    id: '2',
    serviceName: 'project-beta',
    status: 'running',
    frontendPort: 3001,
    backendPort: 8081,
    cpu: 8,
    memory: 192,
    createdAt: new Date(now - 86400000),
    expiresAt: new Date(now + 86400000 * 5), // 5 days from now
  },
  {
    id: '3',
    serviceName: 'project-gamma',
    status: 'stopped',
    frontendPort: 3002,
    backendPort: 8082,
    cpu: 0,
    memory: 0,
    createdAt: new Date(now - 86400000 * 5),
    expiresAt: new Date(now + 3600000 * 12), // 12 hours from now (warning state)
  },
  {
    id: '4',
    serviceName: 'project-delta',
    status: 'exited',
    frontendPort: 3003,
    backendPort: 8083,
    cpu: 0,
    memory: 0,
    createdAt: new Date(now - 86400000 * 3),
    expiresAt: new Date(now + 3600000 * 2), // 2 hours from now (critical)
  },
  {
    id: '5',
    serviceName: 'project-epsilon',
    status: 'running',
    frontendPort: 3004,
    backendPort: 8084,
    cpu: 24,
    memory: 384,
    createdAt: new Date(now - 3600000),
    expiresAt: new Date(now + 86400000 * 60), // 60 days from now
  },
];

const mockLogs: Record<string, LogEntry[]> = {
  '1': [
    { timestamp: new Date(now - 60000), level: 'info', message: 'Container started successfully' },
    { timestamp: new Date(now - 55000), level: 'info', message: 'Frontend server listening on port 3000' },
    { timestamp: new Date(now - 50000), level: 'info', message: 'Backend API server running on port 8080' },
    { timestamp: new Date(now - 45000), level: 'debug', message: 'Database connection established' },
    { timestamp: new Date(now - 40000), level: 'info', message: 'Health check passed' },
    { timestamp: new Date(now - 35000), level: 'warn', message: 'High memory usage detected: 85%' },
    { timestamp: new Date(now - 30000), level: 'info', message: 'Garbage collection completed' },
    { timestamp: new Date(now - 25000), level: 'debug', message: 'Cache invalidated for user sessions' },
    { timestamp: new Date(now - 20000), level: 'info', message: 'Request processed: GET /api/users' },
    { timestamp: new Date(now - 15000), level: 'info', message: 'Request processed: POST /api/data' },
    { timestamp: new Date(now - 10000), level: 'debug', message: 'WebSocket connection established' },
    { timestamp: new Date(now - 5000), level: 'info', message: 'Health check passed' },
  ],
  '2': [
    { timestamp: new Date(now - 120000), level: 'info', message: 'Container project-beta started' },
    { timestamp: new Date(now - 115000), level: 'info', message: 'Initializing application...' },
    { timestamp: new Date(now - 110000), level: 'debug', message: 'Loading configuration from environment' },
    { timestamp: new Date(now - 105000), level: 'info', message: 'Connected to Redis cache' },
    { timestamp: new Date(now - 100000), level: 'info', message: 'Services ready' },
  ],
};

export const useDockerStore = create<DockerState>((set, get) => ({
  containers: mockContainers,
  logs: mockLogs,
  addContainer: (container) => {
    const newContainer: DockerContainer = {
      ...container,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    set((state) => ({
      containers: [...state.containers, newContainer],
      logs: {
        ...state.logs,
        [newContainer.id]: [
          { timestamp: new Date(), level: 'info', message: `Container ${container.serviceName} created and deployed successfully` },
          { timestamp: new Date(), level: 'info', message: `Service will expire on ${container.expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` }
        ]
      }
    }));
  },
  updateContainerStatus: (id, status) => {
    set((state) => ({
      containers: state.containers.map((c) =>
        c.id === id ? { ...c, status, cpu: status === 'running' ? Math.floor(Math.random() * 30) + 5 : 0, memory: status === 'running' ? Math.floor(Math.random() * 400) + 100 : 0 } : c
      ),
    }));
    const container = get().containers.find(c => c.id === id);
    if (container) {
      get().appendLog(id, { level: 'info', message: `Container status changed to: ${status}` });
    }
  },
  renewContainer: (id, newExpiresAt) => {
    set((state) => ({
      containers: state.containers.map((c) =>
        c.id === id ? { ...c, expiresAt: newExpiresAt } : c
      ),
    }));
    get().appendLog(id, { 
      level: 'info', 
      message: `Service renewed. New expiration: ${newExpiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` 
    });
  },
  removeContainer: (id) => {
    set((state) => {
      const { [id]: _, ...remainingLogs } = state.logs;
      return {
        containers: state.containers.filter((c) => c.id !== id),
        logs: remainingLogs,
      };
    });
  },
  getContainerLogs: (id) => {
    return get().logs[id] || [];
  },
  appendLog: (containerId, entry) => {
    set((state) => ({
      logs: {
        ...state.logs,
        [containerId]: [
          ...(state.logs[containerId] || []),
          { ...entry, timestamp: new Date() }
        ]
      }
    }));
  },
}));
