import { create } from "zustand";
import { GPUJob, JobStatus } from "../lib/types";
import { fetchJobs } from "../lib/api";

interface QueueStore {
  jobs: GPUJob[];
  isOpen: boolean;

  toggleQueue: () => void;
  addJob: (job: GPUJob) => void;
  updateJobProgress: (id: string, currentFrame: number, progress: number) => void;
  updateJobStatus: (id: string, status: JobStatus) => void;
  removeJob: (id: string) => void;
  setJobs: (jobs: GPUJob[]) => void;
  refreshJobs: () => Promise<void>;
}

export const useQueueStore = create<QueueStore>((set) => ({
  jobs: [],
  isOpen: true,

  toggleQueue: () => set((s) => ({ isOpen: !s.isOpen })),

  addJob: (job) => set((s) => ({ jobs: [...s.jobs, job] })),

  updateJobProgress: (id, currentFrame, progress) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id ? { ...j, currentFrame, progress } : j
      ),
    })),

  updateJobStatus: (id, status) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, status } : j)),
    })),

  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),

  setJobs: (jobs) => set({ jobs }),

  refreshJobs: async () => {
    try {
      const jobs = await fetchJobs();
      set({ jobs });
    } catch {
      // Server not available
    }
  },
}));
