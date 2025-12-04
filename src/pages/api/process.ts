import type { NextApiRequest, NextApiResponse } from "next";
import { inputSchema } from "@/lib/validation";
import { createJob } from "@/lib/jobQueue";
import { processVideo } from "@/lib/videoProcessor";
import { Job } from "@/lib/types";

type ResponseData =
  | { jobId: string; job: Job }
  | { error: string; details?: unknown };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Validate request body
    const result = inputSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.format(),
      });
    }

    // Create job
    const job = createJob(result.data);

    // Start processing asynchronously (don't await)
    processVideo(job.id).catch((error) => {
      console.error(`Background processing error for job ${job.id}:`, error);
    });

    // Return job ID immediately
    return res.status(200).json({ jobId: job.id, job });
  } catch (error) {
    console.error("Error in /api/process:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
