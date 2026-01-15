import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getJob, saveJob, updateJobStatus, deleteJob } from "./jobQueue";
import { extractVideoId } from "./utils";

const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");
const CLIPS_DIR = path.join(process.cwd(), "public", "clips");

// Video formats to check for existing downloads
const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mkv",
  ".flv",
  ".avi",
  ".mov",
  ".3gp",
  ".m4v",
]);

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
      process.on("close", (code: number | null) => resolve(code === 0));
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

    // Check if user wants full video (start=0, end=duration) - skip clipping
    const startParts = job.startTime.split(":").map(Number);
    const endParts = job.endTime.split(":").map(Number);
    const startSeconds =
      startParts[0] * 3600 + startParts[1] * 60 + startParts[2];
    const endSeconds = endParts[0] * 3600 + endParts[1] * 60 + endParts[2];

    // Fetch metadata to get actual duration
    const metadata = await fetchVideoMetadata(job.url);
    const isFullVideo =
      startSeconds === 0 &&
      metadata &&
      Math.abs(endSeconds - metadata.duration) < 2;

    let outputFile: string;

    if (isFullVideo) {
      // Skip clipping - use downloaded file directly
      console.log("Full video requested, skipping clipping");
      updateJobStatus(jobId, "clipping", { progress: 100 });
      outputFile = downloadedFile;
    } else {
      // Clip video
      outputFile = await clipVideo(
        jobId,
        downloadedFile,
        job.startTime,
        job.endTime
      );
    }

    // Mark as completed
    updateJobStatus(jobId, "completed", {
      downloadedFile: `/downloads/${path.basename(downloadedFile)}`,
      clippedFile: isFullVideo
        ? `/downloads/${path.basename(downloadedFile)}`
        : `/clips/${path.basename(outputFile)}`,
      progress: 100,
    });

    // Cleanup job file after successful completion
    setTimeout(() => deleteJob(jobId), 5000); // 5 second delay for client to fetch final status
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    updateJobStatus(jobId, "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Cleanup job file after failure
    setTimeout(() => deleteJob(jobId), 30000); // 30 second delay for error review
  }
}

/**
 * Find existing video file by video ID (checks all common formats)
 */
function findExistingVideo(videoId: string): string | null {
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);

    for (const ext of VIDEO_EXTENSIONS) {
      const filename = `${videoId}_download${ext}`;
      if (files.includes(filename)) {
        return path.join(DOWNLOADS_DIR, filename);
      }
    }
  } catch (err) {
    console.error("Error reading downloads directory:", err);
  }

  return null;
}

/**
 * Get cached metadata file path for a video ID
 */
function getMetadataCachePath(videoId: string): string {
  return path.join(DOWNLOADS_DIR, `${videoId}.metadata.json`);
}

type VideoMetadata = {
  title: string;
  duration: number;
  thumbnail: string;
  uploader?: string;
  channel?: string;
};

const videoIdMetadataCache = new Map<string, VideoMetadata>();

/**
 * Fetch video metadata using yt-dlp (with caching)
 */
export async function fetchVideoMetadata(
  url: string
): Promise<VideoMetadata | null> {
  // Extract video ID for caching
  const videoId = extractVideoId(url);
  if (!videoId) return null;
  const cachedMetadata = videoIdMetadataCache.get(videoId);
  if (cachedMetadata) return cachedMetadata;

  // Check for cached metadata
  const cachePath = getMetadataCachePath(videoId);
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      videoIdMetadataCache.set(videoId, cached);
      console.log(`Using cached metadata for ${videoId}`);
      return cached;
    } catch (err) {
      console.error("Error reading cached metadata:", err);
      // Continue to fetch fresh metadata
    }
  }

  return new Promise((resolve, reject) => {
    const ytDlp = spawn("yt-dlp", ["--dump-json", "--skip-download", url]);

    let jsonData = "";

    ytDlp.stdout.on("data", (data: Buffer) => {
      jsonData += data.toString();
    });

    ytDlp.stderr.on("data", (data: Buffer) => {
      console.error(`yt-dlp metadata error: ${data}`);
    });

    ytDlp.on("close", (code: number | null) => {
      if (code === 0 && jsonData) {
        try {
          const rawMetadata = JSON.parse(jsonData) as VideoMetadata;
          const metadata = {
            title: rawMetadata.title || "Unknown",
            duration: rawMetadata.duration || 0,
            thumbnail: rawMetadata.thumbnail || "",
            uploader: rawMetadata.uploader || rawMetadata.channel || "Unknown",
          };
          videoIdMetadataCache.set(videoId, metadata);

          // Cache the metadata
          if (videoId) {
            try {
              const cachePath = getMetadataCachePath(videoId);
              fs.writeFileSync(cachePath, JSON.stringify(metadata, null, 2));
              console.log(`Cached metadata for ${videoId}`);
            } catch (err) {
              console.error("Error caching metadata:", err);
            }
          }

          resolve(metadata);
        } catch (err) {
          console.error("Error parsing metadata JSON:", err);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    ytDlp.on("error", (error: Error) => {
      console.error("yt-dlp spawn error:", error);
      reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
    });
  });
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

  // Check if video already exists in any format
  const existingVideo = findExistingVideo(videoId);

  if (existingVideo) {
    console.log(`Video already downloaded: ${existingVideo}`);
    updateJobStatus(jobId, "downloading", { progress: 50 });
    return existingVideo;
  }

  const outputTemplate = path.join(
    DOWNLOADS_DIR,
    `${videoId}_download.%(ext)s`
  );

  return new Promise((resolve, reject) => {
    const ytDlp = spawn(
      "yt-dlp",
      ["-f", "bestvideo+bestaudio", "-o", outputTemplate, "--progress", url],
      {
        env: {
          ...process.env,
          PATH: process.env.PATH || "",
        },
      }
    );

    let downloadedFile = "";

    ytDlp.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log(`yt-dlp: ${output}`);
      // Parse progress percentage from yt-dlp output
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

    ytDlp.stderr.on("data", (data: Buffer) => {
      console.error(`yt-dlp error: ${data}`);
    });

    ytDlp.on("close", async (code: number | null) => {
      if (code === 0) {
        // If we didn't capture the filename, try to find it
        if (!downloadedFile) {
          const files = fs.readdirSync(DOWNLOADS_DIR);
          const foundFile = files.find((f: string) =>
            f.startsWith(`${videoId}_download.`)
          );
          if (foundFile) {
            downloadedFile = path.join(DOWNLOADS_DIR, foundFile);
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

    ytDlp.on("error", (error: Error) => {
      reject(error);
    });
  });
}

/**
 * Clip video using ffmpeg - accepts any format, outputs MP4
 */
async function clipVideo(
  jobId: string,
  inputFile: string, // Can be .webm, .mkv, .mp4, etc.
  startTime: string,
  endTime: string
): Promise<string> {
  updateJobStatus(jobId, "clipping", { progress: 50 });

  // The filename (without extension) is the video ID
  const videoId = path.basename(inputFile, path.extname(inputFile));

  // Sanitize times for filename (replace : with -)
  const startSafe = startTime.replace(/:/g, "-");
  const endSafe = endTime.replace(/:/g, "-");

  // Always output to MP4, regardless of input format
  const outputFile = path.join(
    CLIPS_DIR,
    `${videoId}_clip_${startSafe}_to_${endSafe}.mp4`
  );

  // Check if clip already exists
  if (fs.existsSync(outputFile)) {
    console.log(`Clip already exists: ${outputFile}`);
    updateJobStatus(jobId, "clipping", { progress: 100 });
    return outputFile;
  }

  return new Promise((resolve, reject) => {
    // Calculate clip duration (endTime - startTime)
    const startParts = startTime.split(":").map(Number);
    const endParts = endTime.split(":").map(Number);
    const startSeconds =
      startParts[0] * 3600 + startParts[1] * 60 + startParts[2];
    const endSeconds = endParts[0] * 3600 + endParts[1] * 60 + endParts[2];
    const durationSeconds = endSeconds - startSeconds;

    // Convert duration to HH:MM:SS format
    const durationHours = Math.floor(durationSeconds / 3600);
    const durationMinutes = Math.floor((durationSeconds % 3600) / 60);
    const durationSecs = durationSeconds % 60;
    const duration = `${String(durationHours).padStart(2, "0")}:${String(
      durationMinutes
    ).padStart(2, "0")}:${String(durationSecs).padStart(2, "0")}`;

    const ffmpeg = spawn("ffmpeg", [
      "-ss",
      startTime, // Seek to start time (fast seek before input)
      "-i",
      inputFile,
      "-t",
      duration, // Duration of clip (not end time, since -ss is before -i)
      "-c:v",
      "libx264", // H.264 video codec
      "-preset",
      "veryslow", // Highest quality preset
      "-crf",
      "18", // Near-lossless quality
      "-c:a",
      "aac", // AAC audio codec
      "-b:a",
      "320k", // Maximum audio bitrate
      "-movflags",
      "+faststart", // Enable streaming
      "-y", // Overwrite output file
      outputFile,
    ]);

    ffmpeg.stdout.on("data", (data: Buffer) => {
      console.log(`ffmpeg: ${data}`);
    });

    ffmpeg.stderr.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log(`ffmpeg: ${output}`);

      // Update progress (50-100% for clipping)
      // Parse ffmpeg time output: time=00:00:05.23
      const timeMatch = output.match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch) {
        const currentSeconds =
          parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseInt(timeMatch[3]);

        // Use durationSeconds already calculated above
        if (durationSeconds > 0) {
          // Scale to 50-95% range (100% only on close event)
          const progressPercent = Math.min(currentSeconds / durationSeconds, 1);
          const clipProgress = Math.floor(progressPercent * 45) + 50; // 50-95%

          const job = getJob(jobId);
          if (job) {
            job.progress = clipProgress;
            saveJob(job);
          }
        }
      }
    });

    ffmpeg.on("close", (code: number | null) => {
      if (code === 0) {
        if (fs.existsSync(outputFile)) {
          console.log(`Clip created: ${outputFile}`);
          resolve(outputFile);
        } else {
          reject(new Error("ffmpeg completed but clip file not found"));
        }
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (error: Error) => {
      reject(new Error(`Failed to spawn ffmpeg: ${error.message}`));
    });
  });
}
