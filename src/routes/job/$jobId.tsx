import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getJobStatusFn, cancelJobFn } from "@/server/video.fn";
import type { Job } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowLeft,
  Video,
} from "lucide-react";

export const Route = createFileRoute("/job/$jobId")({
  loader: async ({ params }) => {
    const job = await getJobStatusFn({ data: { jobId: params.jobId } });
    if (!job) throw notFound();
    return { job };
  },
  component: JobStatusPage,
});

function JobStatusPage() {
  const navigate = useNavigate();
  const initialData = Route.useLoaderData();
  const { jobId } = Route.useParams();

  const [job, setJob] = useState<Job>(initialData.job);
  const [isCancelling, setIsCancelling] = useState(false);

  const isActive =
    job.status === "pending" ||
    job.status === "downloading" ||
    job.status === "clipping";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";

  // Poll for job updates
  const fetchJobStatus = useCallback(async () => {
    try {
      const updatedJob = await getJobStatusFn({ data: { jobId } });
      if (updatedJob) {
        setJob(updatedJob);
      }
    } catch (err) {
      console.error("Error fetching job status:", err);
    }
  }, [jobId]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(fetchJobStatus, 2000);
    return () => clearInterval(interval);
  }, [isActive, fetchJobStatus]);

  const handleCancel = async () => {
    if (!isActive) return;

    setIsCancelling(true);
    try {
      await cancelJobFn({ data: { jobId } });
      navigate({ to: "/" });
    } catch (err) {
      console.error("Failed to cancel job:", err);
      setIsCancelling(false);
    }
  };

  const getStatusIcon = () => {
    if (isCompleted) return <CheckCircle2 className="h-6 w-6 text-secondary" />;
    if (isFailed) return <AlertCircle className="h-6 w-6 text-destructive" />;
    return <Loader2 className="h-6 w-6 text-accent animate-spin" />;
  };

  const getStatusText = () => {
    switch (job.status) {
      case "pending":
        return "Waiting to start...";
      case "downloading":
        return "Downloading video from YouTube...";
      case "clipping":
        return "Clipping video...";
      case "completed":
        return "Your clip is ready!";
      case "failed":
        return "Processing failed";
      default:
        return job.status;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/" })}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>

        <div className="space-y-6">
          {/* Video Metadata Card */}
          {job.metadata && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {job.metadata.thumbnail && (
                    <div className="flex-shrink-0">
                      <img
                        src={job.metadata.thumbnail}
                        alt={job.metadata.title}
                        className="w-48 h-[108px] object-cover rounded-lg shadow-md"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold mb-2 line-clamp-2">
                      {job.metadata.title}
                    </h2>
                    <p className="text-muted-foreground text-sm mb-2">
                      {job.metadata.uploader}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Video className="h-4 w-4" />
                        Duration: {Math.floor(job.metadata.duration / 60)}:
                        {String(job.metadata.duration % 60).padStart(2, "0")}
                      </div>
                      <div>
                        Clip: {job.startTime} → {job.endTime}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Job Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Job Status</CardTitle>
                  <CardDescription className="mt-1">
                    Job ID: <code className="text-xs">{jobId}</code>
                  </CardDescription>
                </div>
                <Badge
                  variant={
                    isCompleted
                      ? "default"
                      : isFailed
                      ? "destructive"
                      : "secondary"
                  }
                  className="capitalize"
                >
                  {job.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon()}
                    <div>
                      <p className="font-semibold capitalize">{job.status}</p>
                      <p className="text-sm text-muted-foreground">
                        {getStatusText()}
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold">{job.progress}%</span>
                </div>

                {isActive && <Progress value={job.progress} className="h-2" />}
              </div>

              {/* Error Message */}
              {isFailed && job.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{job.error}</AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {isCompleted && job.clippedFile && (
                  <Button asChild className="flex-1 font-semibold py-6 text-lg">
                    <a href={job.clippedFile} download>
                      <Download className="mr-2 h-5 w-5" />
                      Download Clip
                    </a>
                  </Button>
                )}

                {isActive && (
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="px-6"
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      "Cancel Job"
                    )}
                  </Button>
                )}

                {isFailed && (
                  <Button
                    variant="outline"
                    onClick={() => navigate({ to: "/" })}
                  >
                    Try Again
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Time Range Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Clip Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground mb-1">Start Time</dt>
                  <dd className="font-mono font-semibold">{job.startTime}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-1">End Time</dt>
                  <dd className="font-mono font-semibold">{job.endTime}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-1">Created</dt>
                  <dd>{new Date(job.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground mb-1">Expires</dt>
                  <dd>{new Date(job.expiresAt).toLocaleString()}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
