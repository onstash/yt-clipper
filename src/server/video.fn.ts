import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { inputSchema } from "@/lib/validation";
import {
  createJob,
  getJob,
  updateJobStatus,
  deleteJob,
  getAllJobs,
} from "@/lib/jobQueue";
import { processVideo, fetchVideoMetadata } from "@/lib/videoProcessor";
import fs from "fs";
import path from "path";

// =============================================================================
// Process Video (replaces POST /api/process)
// =============================================================================

const processInputSchema = inputSchema.merge(
  z.object({
    dryRun: z.boolean().optional(),
  })
);

export const processVideoFn = createServerFn({ method: "POST" })
  .inputValidator(processInputSchema)
  .handler(async ({ data }) => {
    // Fetch video metadata first
    const metadata = await fetchVideoMetadata(data.url, data.dryRun);

    const job = createJob({
      url: data.url,
      formatId: data.formatId,
      start: data.start,
      end: data.end,
      metadata: metadata || undefined,
      dryRun: data.dryRun,
    });

    // Start processing asynchronously (don't await)
    processVideo(job.id).catch((error) => {
      console.error(`Background processing error for job ${job.id}:`, error);
    });

    return { jobId: job.id, job };
  });

// =============================================================================
// Get Job Status (replaces GET /api/status/[jobId])
// =============================================================================

const jobIdSchema = z.object({
  jobId: z.string().min(1, "Job ID is required"),
});

export const getJobStatusFn = createServerFn({ method: "GET" })
  .inputValidator(jobIdSchema)
  .handler(async ({ data }): Promise<Job | null> => {
    return getJob(data.jobId);
  });

// =============================================================================
// Cancel Job (replaces POST /api/cancel)
// =============================================================================

export const cancelJobFn = createServerFn({ method: "POST" })
  .inputValidator(jobIdSchema)
  .handler(async ({ data }) => {
    const job = getJob(data.jobId);

    if (!job) {
      throw new Error("Job not found");
    }

    // Only allow cancellation of pending/processing jobs
    if (job.status === "completed" || job.status === "failed") {
      throw new Error(`Cannot cancel job with status: ${job.status}`);
    }

    // Mark job as failed (cancelled)
    updateJobStatus(data.jobId, "failed", {
      error: "Job cancelled by user",
    });

    // Delete job file immediately
    deleteJob(data.jobId);

    return { success: true, message: "Job cancelled successfully" };
  });

// =============================================================================
// Get Video Metadata (replaces GET /api/metadata)
// =============================================================================

const metadataSchema = z.object({
  url: z.string().url("URL is required"),
  dryRun: z.boolean().optional(),
});

import type { Job, VideoMetadata } from "@/lib/types";

export const getMetadataFn = createServerFn({ method: "GET" })
  .inputValidator(metadataSchema)
  .handler(async ({ data }): Promise<VideoMetadata | null> => {
    return fetchVideoMetadata(data.url, data.dryRun);
  });

// =============================================================================
// Get All Jobs (for /jobs listing page)
// =============================================================================

export const getAllJobsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Job[]> => {
    const jobs = getAllJobs();

    // Sort: running first, then by recent
    return jobs.sort((a, b) => {
      const statusOrder: Record<string, number> = {
        pending: 0,
        downloading: 1,
        clipping: 2,
        completed: 3,
        failed: 4,
      };
      if (a.status !== b.status) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return b.createdAt - a.createdAt;
    });
  }
);

// =============================================================================
// Get All Downloads (for /downloads page)
// =============================================================================

interface FileInfo {
  name: string;
  path: string;
  size: number;
  createdAt: number;
  /** @deprecated */
  type: "download" | "clip" | "metadata";
  extension: string;
}

const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");
const CLIPS_DIR = path.join(process.cwd(), "public", "clips");
export const getDownloadsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<FileInfo[]> => {
    const downloads: FileInfo[] = [];
    const clips: FileInfo[] = [];

    // Read downloads
    if (fs.existsSync(DOWNLOADS_DIR)) {
      const downloadFiles = fs.readdirSync(DOWNLOADS_DIR);
      for (const file of downloadFiles) {
        const filePath = path.join(DOWNLOADS_DIR, file);
        const stats = fs.statSync(filePath);
        const fileExtension = path.extname(file);
        downloads.push({
          name: file,
          path: `/downloads/${file}`,
          size: stats.size,
          createdAt: stats.mtimeMs,
          type: "download",
          extension: fileExtension,
        });
      }
    }

    // Read clips
    if (fs.existsSync(CLIPS_DIR)) {
      const clipFiles = fs.readdirSync(CLIPS_DIR);
      for (const file of clipFiles) {
        const filePath = path.join(CLIPS_DIR, file);
        const stats = fs.statSync(filePath);
        const fileExtension = path.extname(file);
        clips.push({
          name: file,
          path: `/clips/${file}`,
          size: stats.size,
          createdAt: stats.mtimeMs,
          type: "clip",
          extension: fileExtension,
        });
      }
    }

    // Combine and sort by most recent
    return [...downloads, ...clips].sort((a, b) => b.createdAt - a.createdAt);
  }
);

// =============================================================================
// Delete File (for /downloads page)
// =============================================================================

const deleteFileSchema = z.object({
  filePath: z.string().min(1, "File path is required"),
});

export const deleteFileFn = createServerFn({ method: "POST" })
  .inputValidator(deleteFileSchema)
  .handler(async ({ data }) => {
    const fullPath = path.join(process.cwd(), "public", data.filePath);

    // Security check: ensure path is within public/downloads or public/clips
    const normalizedPath = path.normalize(fullPath);
    const downloadsPath = path.normalize(DOWNLOADS_DIR);
    const clipsPath = path.normalize(CLIPS_DIR);

    if (
      !normalizedPath.startsWith(downloadsPath) &&
      !normalizedPath.startsWith(clipsPath)
    ) {
      throw new Error("Invalid file path");
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error("File not found");
    }

    fs.unlinkSync(fullPath);
    return { success: true, message: "File deleted successfully" };
  });
