import type { NextApiRequest, NextApiResponse } from "next";
import { fetchVideoMetadata } from "@/lib/videoProcessor";

type ResponseData = {
  title?: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const metadata = await fetchVideoMetadata(url);

    if (!metadata) {
      return res.status(404).json({ error: "Could not fetch video metadata" });
    }

    return res.status(200).json(metadata);
  } catch (error) {
    console.error("Error in /api/metadata:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
