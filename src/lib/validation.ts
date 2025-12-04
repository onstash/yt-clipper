import { z } from "zod";

// Validates format AND logical time values
export const timeRegex = /^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

// Matches all common YouTube URL formats:
// - https://www.youtube.com/watch?v=VIDEO_ID
// - https://youtube.com/watch?v=VIDEO_ID
// - https://youtu.be/VIDEO_ID
// - https://www.youtube.com/embed/VIDEO_ID
// - https://www.youtube.com/v/VIDEO_ID
// - http variants and with additional query parameters
export const youtubeUrlRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]{11}(\?.*)?$/;

/**
 * Converts time string in HH:MM:SS format to seconds
 */
export function timeToSeconds(time: string): number {
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

export const inputSchema = z.object({
  url: z.string().regex(youtubeUrlRegex, "Must be a valid YouTube URL"),
  start: z.string().regex(timeRegex, "Start time must be hh:mm:ss"),
  end: z.string().regex(timeRegex, "End time must be hh:mm:ss")
}).refine(
  (data) => timeToSeconds(data.end) > timeToSeconds(data.start),
  {
    message: "End time must be after start time",
    path: ["end"]
  }
);

export type InputSchema = z.infer<typeof inputSchema>;