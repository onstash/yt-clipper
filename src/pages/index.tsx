import { useState, useEffect, useCallback } from "react";
import { useForm } from "@tanstack/react-form";
import { useQueryParams } from "@/hooks/useQueryParams";
import {
  inputSchema,
  extractVideoIdFromUrl,
  extractTimestampFromUrl,
  secondsToTime,
} from "@/lib/validation";
import { Job } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Scissors,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Video,
  Bug,
} from "lucide-react";

const STORAGE_KEY = "yt-clipper-jobId";

export default function Home() {
  const { params, updateParams } = useQueryParams();

  // Job state
  const [job, setJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Metadata state
  const [metadata, setMetadata] = useState<{
    title: string;
    duration: number;
    thumbnail: string;
    uploader: string;
  } | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  // TanStack Form
  const form = useForm({
    defaultValues: {
      url: params.videoId
        ? `https://www.youtube.com/watch?v=${params.videoId}`
        : "",
      videoName: "",
      start: params.start || "",
      end: params.end || "",
    },
    validators: {
      onChange: inputSchema,
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      setIsSubmitting(true);
      setError(null);
      setJob(null);

      try {
        const res = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: value.url,
            videoName: value.videoName,
            start: value.start,
            end: value.end,
          }),
        });

        const data = await res.json();
        console.log(data);

        if (res.ok) {
          setJob(data.job);
          updateParams({ jobId: data.jobId });
          localStorage.setItem(STORAGE_KEY, data.jobId);
        } else {
          setError(data.error || "Failed to process video");
        }
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // Sync form with query params on mount (with validation)
  useEffect(() => {
    if (params.videoId || params.start || params.end) {
      const reconstructedUrl = params.videoId
        ? `https://www.youtube.com/watch?v=${params.videoId}`
        : "";
      const result = inputSchema.safeParse({
        url: reconstructedUrl,
        videoName: "placeholder", // Just validating URL format, not videoName
        start: params.start || "",
        end: params.end || "",
      });

      if (!result.success) {
        // Invalid params, clear them
        updateParams({ videoId: undefined, start: undefined, end: undefined });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load jobId from localStorage or URL params on mount
  useEffect(() => {
    const urlJobId = params.jobId;
    const storedJobId =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

    // Priority: URL params > localStorage
    const jobId = urlJobId || storedJobId;

    if (jobId) {
      // Sync to both URL and localStorage
      if (!urlJobId) {
        updateParams({ jobId });
      }
      if (jobId !== storedJobId) {
        localStorage.setItem(STORAGE_KEY, jobId);
      }
      fetchJobStatus(jobId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchJobStatus = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`/api/status/${jobId}`);
        if (res.ok) {
          const jobData = await res.json();
          setJob(jobData);

          // Clear localStorage when job is completed or failed
          if (jobData.status === "completed" || jobData.status === "failed") {
            localStorage.removeItem(STORAGE_KEY);
          }

          if (jobData.status === "failed") {
            setError(jobData.error || "Processing failed");
          }
        } else if (res.status === 404) {
          setError("Job not found or expired");
          updateParams({ jobId: undefined });
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (err) {
        console.error("Error fetching job status:", err);
      }
    },
    [updateParams]
  );

  // Poll job status
  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") {
      return;
    }

    const interval = setInterval(() => {
      fetchJobStatus(job.id);
    }, 2000);

    return () => clearInterval(interval);
  }, [job, fetchJobStatus]);

  const handleCancelJob = async () => {
    if (!job) return;

    try {
      const res = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });

      if (res.ok) {
        setJob(null);
        setError(null);
        updateParams({ jobId: undefined });
        localStorage.removeItem(STORAGE_KEY);
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Failed to cancel job");
      }
    } catch {
      setError("Network error. Please try again.");
    }
  };

  const isProcessing = job
    ? job.status !== "completed" && job.status !== "failed"
    : false;
  const isCompleted = job?.status === "completed";

  // Helper to get error message string from error object
  const getErrorMessage = (
    err: string | { message?: string } | undefined
  ): string => {
    if (!err) return "";
    if (typeof err === "string") return err;
    return err.message || "";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-primary to-accent rounded-2xl shadow-lg">
              <Scissors className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            YouTube Clipper
          </h1>
          <p className="text-muted-foreground text-lg">
            Download and clip YouTube videos with precision
          </p>
        </div>

        {/* Main Card */}
        <Card className="bg-card/80 backdrop-blur-xl border-border shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Create Your Clip</CardTitle>
            <CardDescription>
              Enter a YouTube URL and specify the time range to clip
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              className="space-y-6"
            >
              {/* URL Input */}
              <form.Field name="url">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="url">YouTube URL</Label>
                    <Input
                      id="url"
                      type="text"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={isProcessing}
                      className={cn(
                        field.state.meta.errors.length > 0 &&
                          "border-destructive"
                      )}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-destructive">
                        {getErrorMessage(field.state.meta.errors[0])}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              {/* Video Name Input */}
              <form.Field name="videoName">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="videoName">Video Name</Label>
                    <Input
                      id="videoName"
                      type="text"
                      placeholder="Enter a name for your clip..."
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={isProcessing}
                      className={cn(
                        field.state.meta.errors.length > 0 &&
                          "border-destructive"
                      )}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-destructive">
                        {getErrorMessage(field.state.meta.errors[0])}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Auto-filled from video title. You can edit it.
                    </p>
                  </div>
                )}
              </form.Field>

              {/* Time Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form.Field name="start">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="start">
                        Start Time (mm:ss or hh:mm:ss)
                      </Label>
                      <Input
                        id="start"
                        type="text"
                        placeholder="00:30 or 00:00:30"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        disabled={isProcessing}
                        className={cn(
                          field.state.meta.errors.length > 0 &&
                            "border-destructive"
                        )}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {getErrorMessage(field.state.meta.errors[0])}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="end">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="end">End Time (mm:ss or hh:mm:ss)</Label>
                      <Input
                        id="end"
                        type="text"
                        placeholder="01:30 or 00:01:30"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        disabled={isProcessing}
                        className={cn(
                          field.state.meta.errors.length > 0 &&
                            "border-destructive"
                        )}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {getErrorMessage(field.state.meta.errors[0])}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>
              </div>

              {/* Form-level errors */}
              <form.Subscribe selector={(state) => state.errors}>
                {(errors) =>
                  errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {errors.map((err, i) => (
                          <span key={i}>{getErrorMessage(err)}</span>
                        ))}
                      </AlertDescription>
                    </Alert>
                  )
                }
              </form.Subscribe>

              {/* Submit/Cancel Buttons */}
              <div className="flex gap-3">
                <form.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                >
                  {([canSubmit, isFormSubmitting]) => (
                    <Button
                      type="submit"
                      disabled={
                        !canSubmit ||
                        isSubmitting ||
                        isProcessing ||
                        isFormSubmitting
                      }
                      className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90 font-semibold py-6 text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg"
                    >
                      {isSubmitting || isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Scissors className="mr-2 h-5 w-5" />
                          Clip Video
                        </>
                      )}
                    </Button>
                  )}
                </form.Subscribe>

                {isProcessing && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleCancelJob}
                    className="px-6 py-6"
                  >
                    Cancel
                  </Button>
                )}

                {/* Debug/Dry-Run Dialog */}
                <form.Subscribe selector={(state) => state.values}>
                  {(values) => {
                    const videoId = values.url
                      ? extractVideoIdFromUrl(values.url)
                      : null;
                    const startSafe = values.start.replace(/:/g, "-");
                    const endSafe = values.end.replace(/:/g, "-");
                    const expectedClipName = videoId
                      ? `${videoId}_${startSafe}_${endSafe}.mp4`
                      : "(invalid video ID)";

                    return (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="px-4 py-6"
                            title="Debug/Dry-Run"
                          >
                            <Bug className="h-5 w-5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              🐛 Debug / Dry-Run
                            </AlertDialogTitle>
                            <AlertDialogDescription asChild>
                              <div className="space-y-4 text-left">
                                <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-sm">
                                  <div>
                                    <strong>URL:</strong>{" "}
                                    {values.url || "(empty)"}
                                  </div>
                                  <div>
                                    <strong>Video ID:</strong>{" "}
                                    {videoId || "(invalid)"}
                                  </div>
                                  <div>
                                    <strong>Video Name:</strong>{" "}
                                    {values.videoName || "(empty)"}
                                  </div>
                                  <div>
                                    <strong>Start Time:</strong>{" "}
                                    {values.start || "(empty)"}
                                  </div>
                                  <div>
                                    <strong>End Time:</strong>{" "}
                                    {values.end || "(empty)"}
                                  </div>
                                </div>

                                <div className="border-t pt-4">
                                  <h4 className="font-semibold mb-2">
                                    Computed Values
                                  </h4>
                                  <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-sm">
                                    <div>
                                      <strong>Job ID:</strong>{" "}
                                      {videoId || "(fallback to timestamp)"}
                                    </div>
                                    <div>
                                      <strong>Expected Clip:</strong>{" "}
                                      {expectedClipName}
                                    </div>
                                    <div>
                                      <strong>Download Path:</strong>{" "}
                                      /public/downloads/{videoId || "?"}.mp4
                                    </div>
                                    <div>
                                      <strong>Clip Path:</strong> /public/clips/
                                      {expectedClipName}
                                    </div>
                                  </div>
                                </div>

                                <div className="border-t pt-4">
                                  <h4 className="font-semibold mb-2">
                                    State Machine
                                  </h4>
                                  <div className="text-sm text-muted-foreground">
                                    pending → downloading (0-50%) → clipping
                                    (50-100%) → completed
                                  </div>
                                </div>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Close</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                console.log("[DEBUG] Form state:", values);
                                console.log("[DEBUG] Video ID:", videoId);
                                console.log(
                                  "[DEBUG] Expected clip:",
                                  expectedClipName
                                );
                              }}
                            >
                              Log to Console
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    );
                  }}
                </form.Subscribe>
              </div>
            </form>

            {/* Video Metadata */}
            <form.Subscribe selector={(state) => state.values.url}>
              {(urlValue) => {
                // Fetch metadata effect
                useEffect(() => {
                  const fetchMetadata = async () => {
                    if (!urlValue) {
                      setMetadata(null);
                      return;
                    }

                    setIsFetchingMetadata(true);
                    try {
                      const res = await fetch(
                        `/api/metadata?url=${encodeURIComponent(urlValue)}`
                      );
                      if (res.ok) {
                        const data = await res.json();
                        setMetadata(data);
                        // Auto-populate video name from metadata title
                        if (data.title && !form.state.values.videoName) {
                          form.setFieldValue("videoName", data.title);
                        }
                        // Auto-set start time to 00:00:00 if not already set
                        if (!form.state.values.start) {
                          form.setFieldValue("start", "00:00:00");
                        }
                        // Auto-set end time to video duration if not already set
                        if (!form.state.values.end && data.duration) {
                          form.setFieldValue(
                            "end",
                            secondsToTime(data.duration)
                          );
                        }
                      } else {
                        setMetadata(null);
                      }
                    } catch (err) {
                      console.error("Error fetching metadata:", err);
                      setMetadata(null);
                    } finally {
                      setIsFetchingMetadata(false);
                    }
                  };

                  const timeoutId = setTimeout(fetchMetadata, 1000);
                  return () => clearTimeout(timeoutId);
                }, [urlValue]);

                // Update query params effect
                useEffect(() => {
                  const timeoutId = setTimeout(() => {
                    const videoId = urlValue
                      ? extractVideoIdFromUrl(urlValue)
                      : undefined;
                    const state = form.state;
                    updateParams({
                      videoId: videoId || undefined,
                      start: state.values.start,
                      end: state.values.end,
                    });
                  }, 500);

                  return () => clearTimeout(timeoutId);
                }, [urlValue]);

                // Extract timestamp from URL effect
                useEffect(() => {
                  if (!urlValue) return;

                  const timestamp = extractTimestampFromUrl(urlValue);
                  if (timestamp !== null && !form.state.values.start) {
                    const timeString = secondsToTime(timestamp);
                    form.setFieldValue("start", timeString);
                  }
                }, [urlValue]);

                if (!metadata || isProcessing) return null;

                return (
                  <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        {metadata.thumbnail && (
                          <div className="flex-shrink-0">
                            <img
                              src={metadata.thumbnail}
                              alt={metadata.title}
                              className="w-40 h-[90px] object-cover rounded-lg shadow-md"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground line-clamp-2 mb-1">
                            {metadata.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {metadata.uploader}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Duration: {Math.floor(metadata.duration / 60)}:
                            {String(metadata.duration % 60).padStart(2, "0")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }}
            </form.Subscribe>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Processing Status */}
            {job && (
              <div className="space-y-4 p-6 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 text-secondary" />
                    ) : job.status === "failed" ? (
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    ) : (
                      <Loader2 className="h-6 w-6 text-accent animate-spin" />
                    )}
                    <div>
                      <p className="font-semibold capitalize">{job.status}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.status === "downloading" &&
                          "Downloading video from YouTube..."}
                        {job.status === "clipping" && "Clipping video..."}
                        {job.status === "completed" && "Your clip is ready!"}
                        {job.status === "failed" && "Processing failed"}
                        {job.status === "pending" && "Waiting to start..."}
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold">{job.progress}%</span>
                </div>

                {!isCompleted && job.status !== "failed" && (
                  <Progress value={job.progress} className="h-2" />
                )}

                {/* Download Button */}
                {isCompleted && job.clippedFile && (
                  <Button
                    asChild
                    variant="secondary"
                    className="w-full font-semibold py-6 text-lg transition-all duration-300 hover:scale-[1.02] shadow-lg"
                  >
                    <a href={job.clippedFile} download>
                      <Download className="mr-2 h-5 w-5" />
                      Download Clipped Video
                    </a>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          {[
            {
              icon: Video,
              title: "High Quality",
              desc: "Best video + audio quality",
            },
            {
              icon: Scissors,
              title: "Precise Clipping",
              desc: "Frame-accurate cuts",
            },
            {
              icon: Download,
              title: "Fast Downloads",
              desc: "Optimized processing",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border hover:border-primary/50 transition-all duration-300 hover:scale-105 shadow-md"
            >
              <feature.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
