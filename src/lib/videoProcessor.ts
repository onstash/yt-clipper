import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { getJob, saveJob, updateJobStatus, deleteJob } from "./jobQueue";
import { extractVideoId } from "./utils";
import { mockSpawn } from "./mockSpawn";
import {
  generateMockMetadata,
  generateMockDownloadPath,
  generateMockClipPath,
  delay,
} from "./mockData";

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
export async function checkDependencies(dryRun = false): Promise<{
  ytDlp: boolean;
  ffmpeg: boolean;
}> {
  if (dryRun) {
    console.log(
      "[DRY RUN] Skipping dependency check - assuming all dependencies available"
    );
    return { ytDlp: true, ffmpeg: true };
  }

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

  const dryRun = job.dryRun || false;

  try {
    // Check dependencies
    const deps = await checkDependencies(dryRun);
    if (!deps.ytDlp) {
      throw new Error("yt-dlp is not installed. Please install it first.");
    }
    if (!deps.ffmpeg) {
      throw new Error("ffmpeg is not installed. Please install it first.");
    }

    // Download video
    const downloadedFile = await downloadVideo(
      jobId,
      job.url,
      job.formatId,
      dryRun
    );

    // Calculate duration to check if full video
    const startParts = job.startTime.split(":").map(Number);
    const endParts = job.endTime.split(":").map(Number);
    const startSeconds =
      startParts[0] * 3600 + startParts[1] * 60 + startParts[2];
    const endSeconds = endParts[0] * 3600 + endParts[1] * 60 + endParts[2];

    // Fetch metadata to get actual duration
    const metadata = await fetchVideoMetadata(job.url, dryRun);
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
        job.endTime,
        dryRun
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

import { VideoMetadata, VideoFormat } from "./types";

const videoIdMetadataCache = new Map<string, VideoMetadata>();

/**
 * Fetch video metadata using yt-dlp (with caching)
 */
export async function fetchVideoMetadata(
  url: string,
  dryRun = false
): Promise<VideoMetadata | null> {
  // Extract video ID for caching
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  // In dry run mode, return mock metadata immediately
  if (dryRun) {
    console.log(`[DRY RUN] Returning mock metadata for ${videoId}`);
    const mockMetadata = generateMockMetadata(videoId);
    // Add mock formats
    return {
      ...mockMetadata,
      formats: [
        {
          formatId: "18",
          label: "360p (MP4)",
          filesize: 15 * 1024 * 1024,
          isAudioOnly: false,
          ext: "mp4",
        },
        {
          formatId: "22",
          label: "720p (MP4)",
          filesize: 45 * 1024 * 1024,
          isAudioOnly: false,
          ext: "mp4",
        },
        {
          formatId: "bestaudio",
          label: "Audio Only",
          filesize: 5 * 1024 * 1024,
          isAudioOnly: true,
          ext: "m4a",
        },
      ],
      isDownloaded: false,
    };
  }

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
          const rawMetadata = JSON.parse(jsonData);

          // Parse formats
          const formats: VideoFormat[] = [];
          const rawFormats = rawMetadata.formats || [];

          // Find best audio size
          const audioFormats = rawFormats.filter(
            (f: any) => f.vcodec === "none" && f.acodec !== "none"
          );
          const bestAudio = audioFormats.reduce((prev: any, current: any) => {
            return (prev.filesize || 0) > (current.filesize || 0)
              ? prev
              : current;
          }, {});
          const bestAudioSize = bestAudio.filesize || 0;

          // 1. Audio Only Option
          if (bestAudioSize > 0) {
            formats.push({
              formatId: bestAudio.format_id || "bestaudio",
              label: "Audio Only",
              filesize: bestAudioSize,
              isAudioOnly: true,
              ext: bestAudio.ext || "m4a",
            });
          }

          // 2. Video Formats
          // Group by resolution
          const resolutionMap = new Map<string, any>();

          rawFormats.forEach((f: any) => {
            if (f.vcodec !== "none" && f.height) {
              const height = f.height;
              const resKey = `${height}p`;

              // Keep the format with the highest bitrate/filesize for this resolution
              if (
                !resolutionMap.has(resKey) ||
                (f.filesize || 0) > (resolutionMap.get(resKey).filesize || 0)
              ) {
                resolutionMap.set(resKey, f);
              }
            }
          });

          // Sort resolutions descending
          const sortedResolutions = Array.from(resolutionMap.keys()).sort(
            (a, b) => {
              return parseInt(b) - parseInt(a);
            }
          );

          sortedResolutions.forEach((res) => {
            const f = resolutionMap.get(res);
            // Estimate size: video size + audio size (unless it's a pre-merged format like 18 or 22)
            const videoSize = f.filesize || f.filesize_approx || 0;
            const isMerged = f.acodec !== "none";
            const totalSize = isMerged ? videoSize : videoSize + bestAudioSize;

            // Construct format ID for yt-dlp
            // If it's video-only stream, we request "video_id+bestaudio"
            const formatId = isMerged
              ? f.format_id
              : `${f.format_id}+bestaudio`;

            formats.push({
              formatId: formatId,
              label: `${res} (${f.ext})`,
              filesize: totalSize,
              isAudioOnly: false,
              ext: f.ext,
            });
          });

          const isDownloaded = !!findExistingVideo(videoId);

          const metadata: VideoMetadata = {
            title: rawMetadata.title || "Unknown",
            duration: rawMetadata.duration || 0,
            thumbnail: rawMetadata.thumbnail || "",
            uploader: rawMetadata.uploader || rawMetadata.channel || "Unknown",
            isDownloaded,
            formats: formats,
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
async function downloadVideo(
  jobId: string,
  url: string,
  formatId?: string,
  dryRun = false
): Promise<string> {
  updateJobStatus(jobId, "downloading", { progress: 0 });

  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("Could not extract video ID from URL");
  }

  // In dry run mode, simulate download
  if (dryRun) {
    console.log(`[DRY RUN] Simulating download for ${videoId}`);
    const mockPath = generateMockDownloadPath(videoId);

    // Simulate progress updates
    for (let progress = 0; progress <= 50; progress += 10) {
      await delay(200);
      updateJobStatus(jobId, "downloading", { progress });
    }

    return mockPath;
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
    const spawnFn = dryRun ? mockSpawn : spawn;
    const formatArgs = formatId
      ? ["-f", formatId]
      : ["-f", "bestvideo+bestaudio"];
    const ytDlp = spawnFn(
      "yt-dlp",
      [...formatArgs, "-o", outputTemplate, "--progress", url],
      {
        env: {
          ...process.env,
          PATH: process.env.PATH || "",
        },
      }
    );

    let downloadedFile = "";

    ytDlp.stdout?.on("data", (data: Buffer) => {
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

    ytDlp.stderr?.on("data", (data: Buffer) => {
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
  endTime: string,
  dryRun = false
): Promise<string> {
  updateJobStatus(jobId, "clipping", { progress: 50 });

  // The filename (without extension) is the video ID
  const videoId = path.basename(inputFile, path.extname(inputFile));

  // Sanitize times for filename (replace : with -)
  const startSafe = startTime.replace(/:/g, "-");
  const endSafe = endTime.replace(/:/g, "-");

  // Output format should match input format for valid containers with copy codec
  // Or fallback to MP4 if compatible, but safest is same extension or specific container
  // For simplicity with copy codec, we try to preserve extension or default to .mp4
  const inputExt = path.extname(inputFile);

  const outputFile = path.join(
    CLIPS_DIR,
    `${videoId}_clip_${startSafe}_to_${endSafe}${inputExt}`
  );

  // In dry run mode, simulate clipping
  if (dryRun) {
    console.log(`[DRY RUN] Simulating clip for ${videoId}`);
    const videoIdOnly = videoId.replace("_download", "");
    const mockPath = generateMockClipPath(videoIdOnly, startTime, endTime);

    // Simulate progress updates
    for (let progress = 50; progress <= 100; progress += 10) {
      await delay(300);
      updateJobStatus(jobId, "clipping", { progress });
    }

    return mockPath;
  }

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

    const spawnFn = dryRun ? mockSpawn : spawn;
    const ffmpeg = spawnFn("ffmpeg", [
      "-ss",
      startTime, // Seek to start time (fast seek before input)
      "-i",
      inputFile,
      "-t",
      duration, // Duration of clip
      "-c",
      "copy", // Stream copy (no re-encoding)
      "-avoid_negative_ts",
      "make_zero", // Ensure timestamps start at 0
      "-movflags",
      "+faststart", // Enable streaming (if mp4/mov)
      "-y", // Overwrite output file
      outputFile,
    ]);

    ffmpeg.stdout?.on("data", (data: Buffer) => {
      console.log(`ffmpeg: ${data}`);
    });

    ffmpeg.stderr?.on("data", (data: Buffer) => {
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
