import * as React from "react";
import { cn } from "@/lib/utils";

export interface ResultsCountProps {
  total: number;
  filtered?: number;
  loading?: boolean;
  entityName?: string;
  className?: string;
}

/**
 * ResultsCount Component
 * 
 * Displays the count of results, with optional filtered state indication.
 * Shows "X results" or "X of Y total" when filters are active.
 * 
 * @example
 * <ResultsCount total={150} filtered={45} entityName="properties" />
 * // Shows: "45 of 150 properties"
 * 
 * <ResultsCount total={150} entityName="staff" />
 * // Shows: "150 staff members"
 */
export function ResultsCount({
  total,
  filtered,
  loading = false,
  entityName = "results",
  className,
}: ResultsCountProps) {
  if (loading) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        Loading...
      </div>
    );
  }

  const isFiltered = filtered !== undefined && filtered !== total;

  if (isFiltered) {
    return (
      <div className={cn("text-sm", className)}>
        <span className="font-medium">{filtered.toLocaleString()}</span>
        <span className="text-muted-foreground"> of </span>
        <span className="font-medium">{total.toLocaleString()}</span>
        <span className="text-muted-foreground"> {entityName}</span>
      </div>
    );
  }

  return (
    <div className={cn("text-sm", className)}>
      <span className="font-medium">{total.toLocaleString()}</span>
      <span className="text-muted-foreground"> {entityName}</span>
    </div>
  );
}
