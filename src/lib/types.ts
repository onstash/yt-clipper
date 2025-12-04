import { InputSchema } from "./validation";

export type JobStatus = "pending" | "downloading" | "clipping" | "completed" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  url: string;
  startTime: string;
  endTime: string;
  progress: number; // 0-100
  downloadedFile?: string;
  clippedFile?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateJobInput extends InputSchema {
  // Extends the validated input schema
}
