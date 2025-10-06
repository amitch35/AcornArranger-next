"use client";

import * as React from "react";
import DateRangePicker, { type DateRange } from "@/components/filters/DateRangePicker";

export default function Page() {
  const [range, setRange] = React.useState<DateRange>(undefined);
  return (
    <div className="container mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">DateRangePicker Demo</h1>
      <DateRangePicker value={range} onChange={setRange} />
      <div className="rounded-md border p-3">
        <div className="text-sm font-medium">Current range</div>
        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(range, null, 2)}</pre>
      </div>
    </div>
  );
}


