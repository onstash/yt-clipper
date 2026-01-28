import { InputSchema } from "./validation";

export type JobStatus =
  | "pending"
  | "downloading"
  | "clipping"
  | "completed"
  | "failed";

export interface VideoFormat {
  formatId: string;
  label: string;
  filesize: number;
  isAudioOnly: boolean;
  ext: string;
}

export interface VideoMetadata {
  title: string;
  duration: number;
  thumbnail: string;
  uploader?: string;
  channel?: string;
  isDownloaded?: boolean;
  formats: VideoFormat[];
}

export interface Job {
  id: string;
  status: JobStatus;
  url: string;
  formatId?: string;
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
  dryRun?: boolean; // Indicates if this job was created in dry run mode
}

export interface CreateJobInput extends InputSchema {
  formatId?: string;
  metadata?: VideoMetadata;
  dryRun?: boolean;
}
