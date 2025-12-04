import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getJob, saveJob, updateJobStatus } from "./jobQueue";
import { extractVideoId } from "./utils";

const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");
const CLIPS_DIR = path.join(process.cwd(), "public", "clips");

// Ensure directories exist
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(CLIPS_DIR)) {
  fs.mkdirSync(CLIPS_DIR, { recursive: true });
}

/**
 * Check if required dependencies are installed
 */
export async function checkDependencies(): Promise<{
  ytDlp: boolean;
  ffmpeg: boolean;
}> {
  const checkCommand = (cmd: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const process = spawn("which", [cmd]);
      process.on("close", (code) => resolve(code === 0));
    });
  };

  const [ytDlp, ffmpeg] = await Promise.all([
    checkCommand("yt-dlp"),
    checkCommand("ffmpeg"),
  ]);

  return { ytDlp, ffmpeg };
}

/**
 * Process a video job (download and clip)
 */
export async function processVideo(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  try {
    // Check dependencies
    const deps = await checkDependencies();
    if (!deps.ytDlp) {
      throw new Error("yt-dlp is not installed. Please install it first.");
    }
    if (!deps.ffmpeg) {
      throw new Error("ffmpeg is not installed. Please install it first.");
    }

    // Download video
    const downloadedFile = await downloadVideo(jobId, job.url);
    
    // Clip video
    const clippedFile = await clipVideo(
      jobId,
      downloadedFile,
      job.startTime,
      job.endTime
    );

    // Mark as completed
    updateJobStatus(jobId, "completed", {
      downloadedFile: `/downloads/${path.basename(downloadedFile)}`,
      clippedFile: `/clips/${path.basename(clippedFile)}`,
      progress: 100,
    });
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    updateJobStatus(jobId, "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Download video using yt-dlp
 */
async function downloadVideo(jobId: string, url: string): Promise<string> {
  updateJobStatus(jobId, "downloading", { progress: 0 });

  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("Could not extract video ID from URL");
  }

  // Check if video already exists
  const existingFiles = fs.readdirSync(DOWNLOADS_DIR);
  const existingVideo = existingFiles.find((f) => f.startsWith(`${videoId}.`));
  
  if (existingVideo) {
    const existingPath = path.join(DOWNLOADS_DIR, existingVideo);
    console.log(`Video already downloaded: ${existingPath}`);
    updateJobStatus(jobId, "downloading", { progress: 50 });
    return existingPath;
  }

  const outputTemplate = path.join(
    DOWNLOADS_DIR,
    `${videoId}.%(ext)s`
  );

  return new Promise((resolve, reject) => {
    const ytDlp = spawn("yt-dlp", [
      "-f",
      "bestvideo+bestaudio",
      "-o",
      outputTemplate,
      "--merge-output-format",
      "mp4",
      "--progress",
      url,
    ], {
      env: {
        ...process.env,
        PATH: process.env.PATH || "",
      }
    });

    let downloadedFile = "";

    ytDlp.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`yt-dlp: ${output}`);

      // Parse progress
      const progressMatch = output.match(/(\d+\.\d+)%/);
      if (progressMatch) {
        const progress = Math.floor(parseFloat(progressMatch[1]) / 2); // 0-50% for download
        const job = getJob(jobId);
        if (job) {
          job.progress = progress;
          saveJob(job);
        }
      }

      // Capture destination file
      const destMatch = output.match(/\[download\] Destination: (.+)/);
      if (destMatch) {
        downloadedFile = destMatch[1].trim();
      }

      // Capture merged file
      const mergeMatch = output.match(/\[Merger\] Merging formats into "(.+)"/);
      if (mergeMatch) {
        downloadedFile = mergeMatch[1].trim();
      }
    });

    ytDlp.stderr.on("data", (data) => {
      console.error(`yt-dlp error: ${data}`);
    });

    ytDlp.on("close", (code) => {
      if (code === 0) {
        // If we didn't capture the filename, try to find it
        if (!downloadedFile) {
          const files = fs.readdirSync(DOWNLOADS_DIR);
          const videoFiles = files.filter((f) =>
            f.startsWith(`${videoId}.`)
          );
          if (videoFiles.length > 0) {
            downloadedFile = path.join(DOWNLOADS_DIR, videoFiles[0]);
          }
        }

        if (downloadedFile && fs.existsSync(downloadedFile)) {
          resolve(downloadedFile);
        } else {
          reject(new Error("Download completed but file not found"));
        }
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });

    ytDlp.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Clip video using ffmpeg
 */
async function clipVideo(
  jobId: string,
  inputFile: string,
  startTime: string,
  endTime: string
): Promise<string> {
  updateJobStatus(jobId, "clipping", { progress: 50 });

  const ext = path.extname(inputFile);
  const basename = path.basename(inputFile, ext);
  
  // Sanitize times for filename (replace : with -)
  const startSafe = startTime.replace(/:/g, "-");
  const endSafe = endTime.replace(/:/g, "-");
  const outputFile = path.join(CLIPS_DIR, `${basename}_${startSafe}_${endSafe}${ext}`);

  // Check if clip already exists
  if (fs.existsSync(outputFile)) {
    console.log(`Clip already exists: ${outputFile}`);
    updateJobStatus(jobId, "clipping", { progress: 100 });
    return outputFile;
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      inputFile,
      "-ss",
      startTime,
      "-to",
      endTime,
      "-c",
      "copy",
      "-y", // Overwrite output file
      outputFile,
    ]);

    ffmpeg.stdout.on("data", (data) => {
      console.log(`ffmpeg: ${data}`);
    });

    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();
      console.log(`ffmpeg: ${output}`);

      // Update progress (50-100% for clipping)
      const timeMatch = output.match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch) {
        const job = getJob(jobId);
        if (job) {
          // Simple progress estimation
          job.progress = Math.min(95, 50 + Math.floor(Math.random() * 45));
          saveJob(job);
        }
      }
    });

    ffmpeg.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputFile)) {
        resolve(outputFile);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (error) => {
      reject(error);
    });
  });
}
