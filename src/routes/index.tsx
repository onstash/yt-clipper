import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Scissors,
  Video,
  Download,
  Clock,
  Sparkles,
  LayoutList,
  FolderOpen,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative z-10 container mx-auto px-4 py-20">
          <div className="text-center space-y-8 max-w-4xl mx-auto">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="p-4 bg-gradient-to-br from-primary to-accent rounded-3xl shadow-2xl">
                <Scissors className="w-16 h-16 text-primary-foreground" />
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-6xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                YouTube Clipper
              </h1>
              <p className="text-2xl text-muted-foreground max-w-2xl mx-auto">
                Download and clip YouTube videos with precision. Supports
                regular videos, Shorts, and live streams.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex justify-center">
              <Link to="/create">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-accent cursor-pointer"
                >
                  <Sparkles className="h-5 w-5" />
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border/50 hover:border-primary/50 transition-all hover:scale-105">
            <CardHeader>
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>High Quality</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Best available video and audio quality from YouTube
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:border-primary/50 transition-all hover:scale-105">
            <CardHeader>
              <div className="p-3 bg-secondary/10 rounded-lg w-fit mb-4">
                <Scissors className="h-8 w-8 text-secondary" />
              </div>
              <CardTitle>Precise Clipping</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Frame-accurate cuts with custom start and end times
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:border-primary/50 transition-all hover:scale-105">
            <CardHeader>
              <div className="p-3 bg-accent/10 rounded-lg w-fit mb-4">
                <Download className="h-8 w-8 text-accent" />
              </div>
              <CardTitle>Fast Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Optimized video processing with real-time progress tracking
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/50 hover:border-primary/50 transition-all hover:scale-105">
            <CardHeader>
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Job Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Track all jobs with 48-hour automatic cleanup
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>

          <div className="max-w-4xl mx-auto space-y-8">
            {[
              {
                step: 1,
                title: "Paste YouTube URL",
                description:
                  "Works with regular videos, Shorts, and live streams",
                icon: Video,
              },
              {
                step: 2,
                title: "Set Time Range",
                description: "Specify start and end times for your clip",
                icon: Clock,
              },
              {
                step: 3,
                title: "Process & Track",
                description: "Monitor real-time progress of your clip creation",
                icon: LayoutList,
              },
              {
                step: 4,
                title: "Download",
                description: "Get your clip in high-quality MP4 format",
                icon: Download,
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                    {item.step}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <item.icon className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-semibold">{item.title}</h3>
                  </div>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Link to="/create">
            <Card className="hover:border-primary transition-all cursor-pointer h-full">
              <CardHeader>
                <Sparkles className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Create New Clip</CardTitle>
                <CardDescription>
                  Download and clip a YouTube video
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-primary font-semibold">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/jobs">
            <Card className="hover:border-primary transition-all cursor-pointer h-full">
              <CardHeader>
                <LayoutList className="h-12 w-12 text-primary mb-4" />
                <CardTitle>View All Jobs</CardTitle>
                <CardDescription>
                  Track running and completed jobs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-primary font-semibold">
                  View Jobs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/downloads">
            <Card className="hover:border-primary transition-all cursor-pointer h-full">
              <CardHeader>
                <FolderOpen className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Browse Downloads</CardTitle>
                <CardDescription>
                  Access all your videos and clips
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-primary font-semibold">
                  Browse Files
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Supported Formats */}
      <div className="bg-muted/30 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <h3 className="text-xl font-semibold">Supported URL Formats</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "youtube.com/watch?v=...",
                "youtu.be/...",
                "youtube.com/shorts/...",
                "youtube.com/live/...",
              ].map((format) => (
                <div
                  key={format}
                  className="flex items-center gap-2 px-4 py-2 bg-background rounded-full border"
                >
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                  <code className="text-sm">{format}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
