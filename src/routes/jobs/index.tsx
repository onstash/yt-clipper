import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getAllJobsFn, cancelJobFn } from "@/server/video.fn";
import type { Job } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Loader2,
  LayoutList,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

export const Route = createFileRoute("/jobs/")({
  loader: async () => {
    const jobs = await getAllJobsFn();
    return { jobs };
  },
  component: JobsPage,
});

function JobsPage() {
  const initialData = Route.useLoaderData();
  const [jobs, setJobs] = useState<Job[]>(initialData.jobs);
  const [filter, setFilter] = useState<
    "all" | "running" | "completed" | "failed"
  >("all");

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJobFn({ data: { jobId } });
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      console.error("Failed to cancel job:", err);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === "all") return true;
    if (filter === "running")
      return (
        job.status === "pending" ||
        job.status === "downloading" ||
        job.status === "clipping"
      );
    if (filter === "completed") return job.status === "completed";
    if (filter === "failed") return job.status === "failed";
    return true;
  });

  const getStatusBadge = (status: Job["status"]) => {
    const variants: Record<
      Job["status"],
      "default" | "secondary" | "destructive"
    > = {
      pending: "secondary",
      downloading: "secondary",
      clipping: "secondary",
      completed: "default",
      failed: "destructive",
    };
    return (
      <Badge variant={variants[status]} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getStatusIcon = (status: Job["status"]) => {
    if (status === "completed")
      return <CheckCircle2 className="h-5 w-5 text-secondary" />;
    if (status === "failed")
      return <AlertCircle className="h-5 w-5 text-destructive" />;
    return <Loader2 className="h-5 w-5 animate-spin text-accent" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <LayoutList className="h-8 w-8" />
                All Jobs
              </h1>
              <p className="text-muted-foreground mt-1">
                Track all your video processing jobs
              </p>
            </div>
            <Link to="/create">
              <Button variant="outline">Create New Job</Button>
            </Link>
          </div>

          {/* Filters */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All ({jobs.length})</TabsTrigger>
              <TabsTrigger value="running">
                Running (
                {
                  jobs.filter((j) =>
                    ["pending", "downloading", "clipping"].includes(j.status)
                  ).length
                }
                )
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({jobs.filter((j) => j.status === "completed").length}
                )
              </TabsTrigger>
              <TabsTrigger value="failed">
                Failed ({jobs.filter((j) => j.status === "failed").length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-6 space-y-4">
              {filteredJobs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No jobs found</p>
                  </CardContent>
                </Card>
              ) : (
                filteredJobs.map((job) => (
                  <Card key={job.id}>
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        {job.metadata?.thumbnail && (
                          <img
                            src={job.metadata.thumbnail}
                            alt={job.metadata.title}
                            className="w-32 h-[72px] object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <Link
                                to="/job/$jobId"
                                params={{ jobId: job.id }}
                                className="hover:underline"
                              >
                                <h3 className="font-semibold line-clamp-2">
                                  {job.metadata?.title || job.id}
                                </h3>
                              </Link>
                              {job.metadata && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {job.metadata.uploader}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground mt-1">
                                <Clock className="inline h-3 w-3 mr-1" />
                                {job.startTime} → {job.endTime}
                              </p>
                            </div>
                            {getStatusBadge(job.status)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Progress Bar for Active Jobs */}
                        {["pending", "downloading", "clipping"].includes(
                          job.status
                        ) && (
                          <div className="flex items-center gap-3">
                            {getStatusIcon(job.status)}
                            <Progress value={job.progress} className="flex-1" />
                            <span className="text-sm font-medium">
                              {job.progress}%
                            </span>
                          </div>
                        )}

                        {/* Error Message */}
                        {job.status === "failed" && job.error && (
                          <p className="text-sm text-destructive">
                            {job.error}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Link to="/job/$jobId" params={{ jobId: job.id }}>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </Link>

                          {job.status === "completed" && job.clippedFile && (
                            <Button asChild size="sm">
                              <a href={job.clippedFile} download>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </a>
                            </Button>
                          )}

                          {["pending", "downloading", "clipping"].includes(
                            job.status
                          ) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleCancelJob(job.id)}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                          )}
                        </div>

                        {/* Timestamps */}
                        <div className="text-xs text-muted-foreground">
                          Created {new Date(job.createdAt).toLocaleString()} •
                          Expires {new Date(job.expiresAt).toLocaleString()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
