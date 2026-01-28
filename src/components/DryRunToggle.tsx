import { useDryRun } from "@/contexts/DryRunContext";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function DryRunToggle() {
  const { isDryRun, toggleDryRun } = useDryRun();

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggleDryRun}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          isDryRun ? "bg-amber-500" : "bg-input"
        )}
        role="switch"
        aria-checked={isDryRun}
        title={isDryRun ? "Disable dry run mode" : "Enable dry run mode"}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
            isDryRun ? "translate-x-6" : "translate-x-0.5"
          )}
        />
      </button>
      <Label
        htmlFor="dry-run-toggle"
        className="text-sm font-medium cursor-pointer select-none"
        onClick={toggleDryRun}
      >
        Dry Run
      </Label>
      {isDryRun && (
        <div className="flex items-center gap-1 text-amber-500 text-xs">
          <AlertCircle className="h-3 w-3" />
          <span>Mock Mode</span>
        </div>
      )}
    </div>
  );
}
