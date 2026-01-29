import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { getJobStatusFn } from "@/server/video.fn";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/clip/$jobId")({
  loader: async ({ params }) => {
    const job = await getJobStatusFn({ data: { jobId: params.jobId } });

    if (!job) throw notFound();

    // If job is not completed, redirect to job status page
    if (job.status !== "completed") {
      throw redirect({
        to: "/job/$jobId",
        params: { jobId: params.jobId },
      });
    }

    if (!job.clippedFile) throw notFound();

    return { job };
  },
  component: ClipDownloadPage,
});

function ClipDownloadPage() {
  const { job } = Route.useLoaderData();

  // Auto-download on page load
  useEffect(() => {
    if (job.clippedFile) {
      window.location.href = job.clippedFile;
    }
  }, [job.clippedFile]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
        <div>
          <h2 className="text-2xl font-semibold mb-2">Starting Download...</h2>
          <p className="text-muted-foreground">
            Your clip will download automatically
          </p>
          {job.clippedFile && (
            <p className="text-sm text-muted-foreground mt-4">
              If the download doesn't start,{" "}
              <a
                href={job.clippedFile}
                className="text-primary underline"
                download
              >
                click here
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
