import fs from "fs";
import path from "path";
import { Job, CreateJobInput } from "./types";
import { extractVideoIdFromUrl } from "./validation";

const JOBS_DIR = path.join(process.cwd(), "data", "jobs");
const EXPIRY_DURATION = 48 * 60 * 60 * 1000; // 48 hours

// Ensure jobs directory exists
if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

/**
 * Generate a job ID from video URL and time range
 * Format: {videoId}_clip_{startTime}_to_{endTime}
 */
function generateJobId(url: string, start: string, end: string): string {
  const videoId = extractVideoIdFromUrl(url);
  const startSafe = start.replace(/:/g, "-");
  const endSafe = end.replace(/:/g, "-");

  if (!videoId) {
    // Fallback to timestamp-based ID if video ID extraction fails
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  return `${videoId}_clip_${startSafe}_to_${endSafe}`;
}

/**
 * Get the file path for a job
 */
function getJobFilePath(jobId: string): string {
  return path.join(JOBS_DIR, `${jobId}.json`);
}

/**
 * Create a new job
 */
export function createJob(input: CreateJobInput): Job {
  const job: Job = {
    id: generateJobId(input.url, input.start, input.end),
    status: "pending",
    url: input.url,
    startTime: input.start,
    endTime: input.end,
    formatId: input.formatId,
    progress: 0,
    metadata: input.metadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + EXPIRY_DURATION,
    dryRun: input.dryRun,
  };

  saveJob(job);
  return job;
}

/**
 * Get a job by ID
 */
export function getJob(jobId: string): Job | null {
  try {
    const filePath = getJobFilePath(jobId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as Job;
  } catch (error) {
    console.error(`Error reading job ${jobId}:`, error);
    return null;
  }
}

/**
 * Save/update a job
 */
export function saveJob(job: Job): void {
  try {
    job.updatedAt = Date.now();
    const filePath = getJobFilePath(job.id);
    fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
  } catch (error) {
    console.error(`Error saving job ${job.id}:`, error);
    throw error;
  }
}

/**
 * Update job status
 */
export function updateJobStatus(
  jobId: string,
  status: Job["status"],
  updates?: Partial<Job>,
): Job | null {
  const job = getJob(jobId);
  if (!job) return null;

  job.status = status;
  if (updates) {
    Object.assign(job, updates);
  }

  saveJob(job);
  return job;
}

/**
 * Delete job file (cleanup after completion/failure)
 */
export function deleteJob(jobId: string): boolean {
  const jobPath = path.join(JOBS_DIR, `${jobId}.json`);

  try {
    if (fs.existsSync(jobPath)) {
      fs.unlinkSync(jobPath);
      console.log(`Deleted job file: ${jobId}`);
      return true;
    }
  } catch (error) {
    console.error(`Error deleting job ${jobId}:`, error);
  }

  return false;
}

/**
 * Check if a job is expired
 */
export function isJobExpired(job: Job): boolean {
  return Date.now() > job.expiresAt;
}

/**
 * Get all jobs (for listing page)
 */
export function getAllJobs(): Job[] {
  try {
    const files = fs.readdirSync(JOBS_DIR);
    const jobs: Job[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(JOBS_DIR, file);
      const data = fs.readFileSync(filePath, "utf-8");
      const job = JSON.parse(data) as Job;
      jobs.push(job);
    }

    return jobs;
  } catch (error) {
    console.error("Error getting all jobs:", error);
    return [];
  }
}

/**
 * Delete expired jobs and their associated files
 */
export function cleanupExpiredJobs(): void {
  try {
    const jobs = getAllJobs();

    for (const job of jobs) {
      if (isJobExpired(job)) {
        // Delete job file
        const jobPath = path.join(JOBS_DIR, `${job.id}.json`);
        if (fs.existsSync(jobPath)) {
          fs.unlinkSync(jobPath);
        }

        // Delete downloaded video file
        if (job.downloadedFile) {
          const downloadPath = path.join(
            process.cwd(),
            "public",
            job.downloadedFile,
          );
          if (fs.existsSync(downloadPath)) {
            fs.unlinkSync(downloadPath);
            console.log(`Deleted download: ${job.downloadedFile}`);
          }
        }

        // Delete clipped file
        if (job.clippedFile) {
          const clipPath = path.join(process.cwd(), "public", job.clippedFile);
          if (fs.existsSync(clipPath)) {
            fs.unlinkSync(clipPath);
            console.log(`Deleted clip: ${job.clippedFile}`);
          }
        }

        console.log(`Cleaned up expired job: ${job.id}`);
      }
    }
  } catch (error) {
    console.error("Error cleaning up expired jobs:", error);
  }
}
