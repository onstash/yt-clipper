import fs from "fs";
import path from "path";
import { Job, CreateJobInput } from "./types";

const JOBS_DIR = path.join(process.cwd(), "data", "jobs");

// Ensure jobs directory exists
if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
    id: generateJobId(),
    status: "pending",
    url: input.url,
    startTime: input.start,
    endTime: input.end,
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
  updates?: Partial<Job>
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
 * Delete old jobs (older than 24 hours)
 */
export function cleanupOldJobs(): void {
  try {
    const files = fs.readdirSync(JOBS_DIR);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(JOBS_DIR, file);
      const data = fs.readFileSync(filePath, "utf-8");
      const job = JSON.parse(data) as Job;

      if (now - job.createdAt > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old job: ${job.id}`);
      }
    }
  } catch (error) {
    console.error("Error cleaning up old jobs:", error);
  }
}
