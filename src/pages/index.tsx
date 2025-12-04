import { useState, useEffect, useCallback } from "react";
import { useQueryParams } from "@/hooks/useQueryParams";
import { inputSchema, extractVideoIdFromUrl, extractTimestampFromUrl, secondsToTime } from "@/lib/validation";
import { Job } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Scissors, Download, Loader2, AlertCircle, CheckCircle2, Video } from "lucide-react";

const STORAGE_KEY = "yt-clipper-jobId";

export default function Home() {
  const { params, updateParams } = useQueryParams();
  
  // Form state
  const [url, setUrl] = useState(() => {
    // Reconstruct URL from videoId if present
    if (params.v) {
      return `https://www.youtube.com/watch?v=${params.v}`;
    }
    return "";
  });
  const [startTime, setStartTime] = useState(params.start || "");
  const [endTime, setEndTime] = useState(params.end || "");
  
  // Job state
  const [job, setJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Metadata state
  const [metadata, setMetadata] = useState<{
    title: string;
    duration: number;
    thumbnail: string;
    uploader: string;
  } | null>(null);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);

  // Sync form with query params on mount (with validation)
  useEffect(() => {
    if (params.v || params.start || params.end) {
      const reconstructedUrl = params.v ? `https://www.youtube.com/watch?v=${params.v}` : "";
      const result = inputSchema.safeParse({
        url: reconstructedUrl,
        start: params.start || "",
        end: params.end || ""
      });
      
      if (result.success) {
        if (params.v && !url) setUrl(reconstructedUrl);
        if (params.start) setStartTime(params.start);
        if (params.end) setEndTime(params.end);
      } else {
        // Invalid params, clear them
        updateParams({ v: undefined, start: undefined, end: undefined });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load jobId from localStorage or URL params on mount
  useEffect(() => {
    const urlJobId = params.jobId;
    const storedJobId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    
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

  const fetchJobStatus = useCallback(async (jobId: string) => {
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
  }, [updateParams]);

  // Fetch metadata when URL changes
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!url || validationErrors.url) {
        setMetadata(null);
        return;
      }

      setIsFetchingMetadata(true);
      try {
        const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = await res.json();
          setMetadata(data);
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

    const timeoutId = setTimeout(fetchMetadata, 1000); // Debounce
    return () => clearTimeout(timeoutId);
  }, [url, validationErrors.url]);

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

  // Update query params when form changes (use videoId instead of full URL)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const videoId = url ? extractVideoIdFromUrl(url) : undefined;
      updateParams({ v: videoId || undefined, start: startTime, end: endTime });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [url, startTime, endTime, updateParams]);

  const validateForm = (): boolean => {
    const result = inputSchema.safeParse({ url, start: startTime, end: endTime });
    
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path[0] as string;
        errors[path] = err.message;
      });
      setValidationErrors(errors);
      return false;
    }
    
    setValidationErrors({});
    return true;
  };

  // Extract timestamp from URL and update start time
  useEffect(() => {
    if (!url) return;
    
    const timestamp = extractTimestampFromUrl(url);
    if (timestamp !== null && !startTime) {
      const timeString = secondsToTime(timestamp);
      setStartTime(timeString);
    }
  }, [url, startTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setError(null);
    setJob(null);

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, start: startTime, end: endTime }),
      });

      const data = await res.json();

      if (res.ok) {
        setJob(data.job);
        updateParams({ jobId: data.jobId });
        // Store jobId in localStorage
        localStorage.setItem(STORAGE_KEY, data.jobId);
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Failed to process video");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
    } catch (err) {
      setError("Network error. Please try again.");
    }
  };

  const isProcessing = job ? (job.status !== "completed" && job.status !== "failed") : false;
  const isCompleted = job?.status === "completed";

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
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* URL Input */}
              <div className="space-y-2">
                <Label htmlFor="url">YouTube URL</Label>
                <Input
                  id="url"
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isProcessing}
                  className={cn(
                    validationErrors.url && "border-destructive"
                  )}
                />
                {validationErrors.url && (
                  <p className="text-sm text-destructive">{validationErrors.url}</p>
                )}
              </div>

              {/* Time Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Start Time (mm:ss or hh:mm:ss)</Label>
                  <Input
                    id="start"
                    type="text"
                    placeholder="00:30 or 00:00:30"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isProcessing}
                    className={cn(
                      validationErrors.start && "border-destructive"
                    )}
                  />
                  {validationErrors.start && (
                    <p className="text-sm text-destructive">{validationErrors.start}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end">End Time (mm:ss or hh:mm:ss)</Label>
                  <Input
                    id="end"
                    type="text"
                    placeholder="01:30 or 00:01:30"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={isProcessing}
                    className={cn(
                      validationErrors.end && "border-destructive"
                    )}
                  />
                  {validationErrors.end && (
                    <p className="text-sm text-destructive">{validationErrors.end}</p>
                  )}
                </div>
              </div>

              {/* Submit/Cancel Buttons */}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting || isProcessing}
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
              </div>
            </form>

            {/* Video Metadata */}
            {metadata && !isProcessing && (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    {metadata.thumbnail && (
                      <img 
                        src={metadata.thumbnail} 
                        alt={metadata.title}
                        className="w-32 h-24 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {metadata.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {metadata.uploader}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Duration: {Math.floor(metadata.duration / 60)}:{String(metadata.duration % 60).padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                        {job.status === "downloading" && "Downloading video from YouTube..."}
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
            { icon: Video, title: "High Quality", desc: "Best video + audio quality" },
            { icon: Scissors, title: "Precise Clipping", desc: "Frame-accurate cuts" },
            { icon: Download, title: "Fast Downloads", desc: "Optimized processing" },
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
