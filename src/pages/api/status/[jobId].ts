import type { NextApiRequest, NextApiResponse } from "next";
import { getJob } from "@/lib/jobQueue";
import { Job } from "@/lib/types";

type ResponseData = Job | { error: string };

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { jobId } = req.query;

  if (typeof jobId !== "string") {
    return res.status(400).json({ error: "Invalid job ID" });
  }

  try {
    const job = getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    return res.status(200).json(job);
  } catch (error) {
    console.error(`Error fetching job ${jobId}:`, error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
