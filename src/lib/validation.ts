import { z } from "zod";

// Validates format AND logical time values
// Accepts both mm:ss and hh:mm:ss formats
export const timeRegex = /^(?:([0-1]?\d|2[0-3]):)?([0-5]?\d):([0-5]\d)$/;

// Matches all common YouTube URL formats with optional query parameters
// Supports: watch?v=, embed/, v/, /live/, /shorts/, and youtu.be/ formats
export const youtubeUrlRegex =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|live\/|shorts\/)|youtu\.be\/)[\w-]{11}([?&].*)?$/;

/**
 * Normalize time string to HH:MM:SS format
 * Accepts: "26" (ss), "1:30" (mm:ss), "01:30" (mm:ss), "1:30:45" (hh:mm:ss)
 */
export function normalizeTime(time: string): string {
  const match = time.match(timeRegex);
  if (!match) return time;

  const hours = match[1] || "00";
  const minutes = match[2];
  const seconds = match[3];

  return `${hours.padStart(2, "0")}:${minutes.padStart(
    2,
    "0"
  )}:${seconds.padStart(2, "0")}`;
}

/**
 * Converts time string in HH:MM:SS format to seconds
 */
export function timeToSeconds(time: string): number {
  const normalized = normalizeTime(time);
  const [hours, minutes, seconds] = normalized.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Converts seconds to HH:MM:SS format
 */
export function secondsToTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((v) => v.toString().padStart(2, "0"))
    .join(":");
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoIdFromUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/live\/|youtube\.com\/shorts\/)([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract timestamp from YouTube URL (t=seconds query parameter)
 * Only supports seconds format: t=90
 */
export function extractTimestampFromUrl(url: string): number | null {
  try {
    const urlObj = new URL(url);
    const t = urlObj.searchParams.get("t");

    if (t && /^\d+$/.test(t)) {
      return parseInt(t, 10);
    }
  } catch (err) {
    // Invalid URL
  }

  return null;
}

export const inputSchema = z
  .object({
    url: z.string().regex(youtubeUrlRegex, "Must be a valid YouTube URL"),
    formatId: z.string().optional(),
    start: z
      .string()
      .regex(timeRegex, "Start time must be mm:ss or hh:mm:ss")
      .transform(normalizeTime),
    end: z
      .string()
      .regex(timeRegex, "End time must be mm:ss or hh:mm:ss")
      .transform(normalizeTime),
  })
  .refine((data) => timeToSeconds(data.end) > timeToSeconds(data.start), {
    message: "End time must be after start time",
    path: ["end"],
  });

export type InputSchema = z.infer<typeof inputSchema>;
