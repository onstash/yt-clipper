import type { NextApiRequest, NextApiResponse } from "next";
import { getJob, updateJobStatus, deleteJob } from "@/lib/jobQueue";

type ResponseData = {
  success?: boolean;
  message?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { jobId } = req.body;

  if (!jobId || typeof jobId !== "string") {
    return res.status(400).json({ error: "Job ID is required" });
  }

  try {
    const job = getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Only allow cancellation of pending/processing jobs
    if (job.status === "completed" || job.status === "failed") {
      return res.status(400).json({ 
        error: `Cannot cancel job with status: ${job.status}` 
      });
    }

    // Mark job as failed (cancelled)
    updateJobStatus(jobId, "failed", {
      error: "Job cancelled by user",
    });

    // Delete job file immediately
    deleteJob(jobId);

    return res.status(200).json({ 
      success: true,
      message: "Job cancelled successfully" 
    });
  } catch (error) {
    console.error("Error cancelling job:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
