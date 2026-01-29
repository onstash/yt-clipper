import type { VideoMetadata } from "@/lib/types";

/**
 * Generate mock video metadata based on video ID
 */
export function generateMockMetadata(videoId: string): VideoMetadata {
  const mockTitles = [
    "Amazing Tutorial - Learn Everything You Need to Know",
    "Epic Gaming Moments Compilation 2026",
    "How to Build Modern Web Applications",
    "Beautiful Nature Documentary - 4K",
    "Music Mix - Best Songs of the Year",
  ];

  const mockUploaders = [
    "Tech Channel",
    "Gaming Pro",
    "Code Academy",
    "Nature Films",
    "Music Station",
  ];

  // Use video ID to deterministically select mock data
  const hash = videoId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const titleIndex = hash % mockTitles.length;
  const uploaderIndex = hash % mockUploaders.length;

  // Generate a realistic duration (between 1 and 30 minutes)
  const duration = 60 + (hash % 1740); // 60s to 1800s (1-30 minutes)

  return {
    title: mockTitles[titleIndex],
    duration,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    uploader: mockUploaders[uploaderIndex],
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
    ],
  };
}

/**
 * Generate mock file path for downloads
 */
export function generateMockDownloadPath(videoId: string): string {
  return `/downloads/${videoId}_download.mp4`;
}

/**
 * Generate mock file path for clips
 */
export function generateMockClipPath(
  videoId: string,
  startTime: string,
  endTime: string
): string {
  const startSafe = startTime.replace(/:/g, "-");
  const endSafe = endTime.replace(/:/g, "-");
  return `/clips/${videoId}_download_clip_${startSafe}_to_${endSafe}.mp4`;
}

/**
 * Mock progress sequences for realistic simulation
 */
export const MOCK_PROGRESS_SEQUENCES = {
  download: [0, 10, 25, 40, 50],
  clip: [50, 60, 75, 90, 100],
};

/**
 * Delay helper for simulating async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
