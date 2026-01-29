import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DryRunBadgeProps {
  className?: string;
  variant?: "default" | "small";
}

export function DryRunBadge({
  className,
  variant = "default",
}: DryRunBadgeProps) {
  if (variant === "small") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-amber-500 text-amber-500 bg-amber-500/10 text-xs",
          className
        )}
      >
        <AlertCircle className="h-3 w-3 mr-1" />
        DRY RUN
      </Badge>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500 rounded-lg",
        "animate-pulse",
        className
      )}
    >
      <AlertCircle className="h-5 w-5 text-amber-500" />
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-amber-500">
          DRY RUN MODE ACTIVE
        </span>
        <span className="text-xs text-amber-600">
          No actual processes will be spawned
        </span>
      </div>
    </div>
  );
}
