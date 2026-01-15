import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getDownloadsFn, deleteFileFn } from "@/server/video.fn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
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
  Download,
  FolderOpen,
  Video,
  Scissors,
  ArrowLeft,
  Trash2,
} from "lucide-react";

interface FileInfo {
  name: string;
  path: string;
  size: number;
  createdAt: number;
  type: "download" | "clip";
}

export const Route = createFileRoute("/downloads/")({
  loader: async () => {
    const files = await getDownloadsFn();
    return { files };
  },
  component: DownloadsPage,
});

function DownloadsPage() {
  const initialData = Route.useLoaderData();
  const [files, setFiles] = useState(initialData.files);
  const [filter, setFilter] = useState<"all" | "downloads" | "clips">("all");
  const [deletingFile, setDeletingFile] = useState<string | null>(null);

  const filteredFiles = files.filter((file) => {
    if (filter === "all") return true;
    if (filter === "downloads") return file.type === "download";
    if (filter === "clips") return file.type === "clip";
    return true;
  });

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const handleDeleteFile = async (filePath: string) => {
    setDeletingFile(filePath);
    try {
      await deleteFileFn({ data: { filePath } });
      // Remove file from local state
      setFiles((prev) => prev.filter((f) => f.path !== filePath));
    } catch (err) {
      console.error("Failed to delete file:", err);
      alert(
        "Failed to delete file: " +
          (err instanceof Error ? err.message : "Unknown error")
      );
    } finally {
      setDeletingFile(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <FolderOpen className="h-8 w-8" />
                Downloads
              </h1>
              <p className="text-muted-foreground mt-1">
                Browse all your videos and clips
              </p>
            </div>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Files</p>
                    <p className="text-2xl font-bold">{files.length}</p>
                  </div>
                  <FolderOpen className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Downloads</p>
                    <p className="text-2xl font-bold">
                      {files.filter((f) => f.type === "download").length}
                    </p>
                  </div>
                  <Video className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Clips</p>
                    <p className="text-2xl font-bold">
                      {files.filter((f) => f.type === "clip").length}
                    </p>
                  </div>
                  <Scissors className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Table */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All Files</TabsTrigger>
              <TabsTrigger value="downloads">Downloads</TabsTrigger>
              <TabsTrigger value="clips">Clips</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-6">
              {filteredFiles.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No files found</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-left">Filename</TableHead>
                        <TableHead className="text-left">Type</TableHead>
                        <TableHead className="text-left">Size</TableHead>
                        <TableHead className="text-left">Created</TableHead>
                        <TableHead className="text-left">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFiles.map((file) => (
                        <TableRow key={file.path}>
                          <TableCell className="font-mono text-sm max-w-md truncate">
                            {file.name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                file.type === "clip" ? "default" : "secondary"
                              }
                            >
                              {file.type === "clip" ? (
                                <>
                                  <Scissors className="h-3 w-3 mr-1" />
                                  Clip
                                </>
                              ) : (
                                <>
                                  <Video className="h-3 w-3 mr-1" />
                                  Download
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatBytes(file.size)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {formatDate(file.createdAt)}
                          </TableCell>
                          <TableCell className="text-right flex gap-2">
                            <Button asChild size="sm">
                              <a href={file.path} download>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={deletingFile === file.path}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete File?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete{" "}
                                    <strong>{file.name}</strong>? This action
                                    cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteFile(file.path)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
