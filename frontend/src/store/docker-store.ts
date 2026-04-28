import { create } from 'zustand'

export type ContainerStatus = 'running' | 'stopped' | 'exited'

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: ContainerStatus
  expires_at?: string
  created_at: string
}

interface DockerState {
  containers: DockerContainer[]
  fetchContainers: () => Promise<void>
  startContainer: (id: string) => Promise<void>
  stopContainer: (id: string) => Promise<void>
  deleteContainer: (id: string) => Promise<void>
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
})

export const useDockerStore = create<DockerState>((set, get) => ({
  containers: [],

  fetchContainers: async () => {
    const res = await fetch(`${API_URL}/containers`, {
      headers: getHeaders(),
    })
    const data = await res.json()
    set({ containers: data })
  },

  startContainer: async (id: string) => {
    await fetch(`${API_URL}/containers/${id}/start`, {
      method: 'POST',
      headers: getHeaders(),
    })
    await get().fetchContainers()
  },

  stopContainer: async (id: string) => {
    await fetch(`${API_URL}/containers/${id}/stop`, {
      method: 'POST',
      headers: getHeaders(),
    })
    await get().fetchContainers()
  },

  deleteContainer: async (id: string) => {
    await fetch(`${API_URL}/containers/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    await get().fetchContainers()
  },
}))
