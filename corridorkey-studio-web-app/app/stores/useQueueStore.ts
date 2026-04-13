import { create } from "zustand";
import { GPUJob, JobStatus } from "../lib/types";
import { MOCK_JOBS } from "../lib/mock-data";

interface QueueStore {
  jobs: GPUJob[];
  isOpen: boolean;

  toggleQueue: () => void;
  addJob: (job: GPUJob) => void;
  updateJobProgress: (id: string, currentFrame: number, progress: number) => void;
  updateJobStatus: (id: string, status: JobStatus) => void;
  removeJob: (id: string) => void;
}

export const useQueueStore = create<QueueStore>((set) => ({
  jobs: MOCK_JOBS,
  isOpen: false,

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
}));
