import { EventEmitter } from "events";
import { ChildProcess } from "child_process";
import { delay, generateMockMetadata } from "./mockData";

/**
 * Mock ChildProcess that simulates spawn behavior without actually spawning processes
 */
class MockChildProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: EventEmitter;

  constructor() {
    super();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.stdin = new EventEmitter();
  }

  kill() {
    this.emit("close", 0);
  }
}

/**
 * Mock spawn function that simulates different commands
 */
export function mockSpawn(
  command: string,
  args: string[],
  options?: any
): ChildProcess {
  const mockProcess = new MockChildProcess();

  console.log(`[DRY RUN] Mock spawn: ${command} ${args.join(" ")}`);

  // Simulate async behavior
  setImmediate(() => {
    if (command === "which") {
      // Simulate dependency check - always succeed
      mockProcess.emit("close", 0);
    } else if (command === "yt-dlp" && args.includes("--dump-json")) {
      // Simulate metadata fetch
      simulateMetadataFetch(mockProcess, args);
    } else if (command === "yt-dlp") {
      // Simulate video download
      simulateDownload(mockProcess, args);
    } else if (command === "ffmpeg") {
      // Simulate video clipping
      simulateClipping(mockProcess, args);
    } else {
      // Unknown command - just succeed
      mockProcess.emit("close", 0);
    }
  });

  return mockProcess as unknown as ChildProcess;
}

/**
 * Simulate yt-dlp metadata fetch
 */
async function simulateMetadataFetch(
  process: MockChildProcess,
  args: string[]
) {
  await delay(500); // Simulate network delay

  // Extract URL from args
  const url = args[args.length - 1];
  const videoIdMatch = url.match(/[?&]v=([^&]+)/);
  const videoId = videoIdMatch ? videoIdMatch[1] : "dQw4w9WgXcQ";

  const metadata = generateMockMetadata(videoId);

  // Emit mock JSON data
  const jsonData = JSON.stringify({
    title: metadata.title,
    duration: metadata.duration,
    thumbnail: metadata.thumbnail,
    uploader: metadata.uploader,
    channel: metadata.uploader,
  });

  process.stdout.emit("data", Buffer.from(jsonData));
  process.emit("close", 0);
}

/**
 * Simulate yt-dlp video download with progress
 */
async function simulateDownload(process: MockChildProcess, args: string[]) {
  const url = args[args.length - 1];
  const videoIdMatch = url.match(/[?&]v=([^&]+)/);
  const videoId = videoIdMatch ? videoIdMatch[1] : "dQw4w9WgXcQ";

  // Find output template
  const outputIndex = args.indexOf("-o");
  const outputTemplate =
    outputIndex !== -1 ? args[outputIndex + 1] : `${videoId}_download.mp4`;

  console.log(`[DRY RUN] Simulating download to: ${outputTemplate}`);

  // Simulate progress updates
  const progressSteps = [5, 15, 30, 50, 75, 95, 100];

  for (const progress of progressSteps) {
    await delay(300);
    const progressLine = `[download] ${progress}.0% of 50.00MiB at 5.00MiB/s ETA 00:${String(
      10 - Math.floor(progress / 10)
    ).padStart(2, "0")}`;
    process.stdout.emit("data", Buffer.from(progressLine + "\n"));
  }

  // Emit destination message
  const destMessage = `[download] Destination: ${outputTemplate.replace(
    "%(ext)s",
    "mp4"
  )}`;
  process.stdout.emit("data", Buffer.from(destMessage + "\n"));

  await delay(200);
  process.emit("close", 0);
}

/**
 * Simulate ffmpeg video clipping with progress
 */
async function simulateClipping(process: MockChildProcess, args: string[]) {
  const outputFile = args[args.length - 1];
  console.log(`[DRY RUN] Simulating clip to: ${outputFile}`);

  // Simulate ffmpeg output
  const ffmpegHeader = `ffmpeg version 6.0 Copyright (c) 2000-2023 the FFmpeg developers
  built with Apple clang version 14.0.0
  configuration: --enable-gpl --enable-libx264`;

  process.stderr.emit("data", Buffer.from(ffmpegHeader + "\n"));

  await delay(500);

  // Simulate progress with time updates
  const timeSteps = [
    "00:00:01",
    "00:00:03",
    "00:00:05",
    "00:00:08",
    "00:00:10",
    "00:00:12",
  ];

  for (const time of timeSteps) {
    await delay(400);
    const progressLine = `frame= 150 fps= 30 q=28.0 size= 1024kB time=${time}.00 bitrate=1024.0kbits/s speed=2.0x`;
    process.stderr.emit("data", Buffer.from(progressLine + "\n"));
  }

  await delay(300);
  process.emit("close", 0);
}
