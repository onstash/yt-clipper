import { InputSchema } from "./validation";

export type JobStatus =
  | "pending"
  | "downloading"
  | "clipping"
  | "completed"
  | "failed";

export interface VideoMetadata {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
}

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
  metadata?: VideoMetadata;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface CreateJobInput extends InputSchema {
  metadata?: VideoMetadata;
}
