/**
 * Service name substrings used to pre-select the "standard workload" filter
 * on the dashboard and the schedule page backlog panel. Any service whose
 * label contains one of these strings (case-insensitive) is selected by
 * default so that Hot Tub and other non-standard services are excluded from
 * dashboard metrics and the unscheduled backlog until explicitly added back.
 */
export const DEFAULT_SERVICE_FILTER_LABELS: readonly string[] = [
  "Departure Clean",
  "Office Cleaning",
];

/** Resolve default service IDs from a loaded options list. */
export function resolveDefaultServiceIds(
  options: { value: string; label: string }[]
): string[] {
  return options
    .filter((o) =>
      DEFAULT_SERVICE_FILTER_LABELS.some((d) =>
        o.label.toLowerCase().includes(d.toLowerCase())
      )
    )
    .map((o) => o.value);
}
