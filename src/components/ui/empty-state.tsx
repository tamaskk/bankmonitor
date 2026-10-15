import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

// One line saying what belongs here, plus at most one primary action (DESIGN_SYSTEM.md §06).
function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center",
        className,
      )}
    >
      <p className="text-base font-semibold">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-prose text-sm">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}

export { EmptyState };
