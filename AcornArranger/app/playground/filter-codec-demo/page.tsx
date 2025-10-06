"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  decodeFromSearchParams,
  encodeToSearchParams,
  Schemas,
  validateBaseFilters,
} from "@/lib/filters/URLQueryCodec";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function FilterCodecDemoPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const decoded = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    const raw = decodeFromSearchParams(params);
    // Use appointment schema as a representative superset
    return validateBaseFilters(raw, Schemas.appointment);
  }, [searchParams]);

  const [q, setQ] = useState(decoded.q ?? "");
  const [page, setPage] = useState<number>(decoded.page ?? 1);
  const [pageSize, setPageSize] = useState<number>(decoded.pageSize ?? 25);
  const [sort, setSort] = useState(decoded.sort ?? "");
  const [statusIds, setStatusIds] = useState<string>((decoded.statusIds ?? []).join(","));
  const [serviceIds, setServiceIds] = useState<string>((decoded.serviceIds ?? []).join(","));
  const [staffIds, setStaffIds] = useState<string>((decoded.staffIds ?? []).join(","));
  const [propertyIds, setPropertyIds] = useState<string>((decoded.propertyIds ?? []).join(","));
  const [dateFrom, setDateFrom] = useState<string>(decoded.dateFrom ?? "");
  const [dateTo, setDateTo] = useState<string>(decoded.dateTo ?? "");

  useEffect(() => {
    setQ(decoded.q ?? "");
    setPage(decoded.page ?? 1);
    setPageSize(decoded.pageSize ?? 25);
    setSort(decoded.sort ?? "");
    setStatusIds((decoded.statusIds ?? []).join(","));
    setServiceIds((decoded.serviceIds ?? []).join(","));
    setStaffIds((decoded.staffIds ?? []).join(","));
    setPropertyIds((decoded.propertyIds ?? []).join(","));
    setDateFrom(decoded.dateFrom ?? "");
    setDateTo(decoded.dateTo ?? "");
  }, [decoded.q, decoded.page, decoded.pageSize, decoded.sort, decoded.statusIds, decoded.serviceIds, decoded.staffIds, decoded.propertyIds, decoded.dateFrom, decoded.dateTo]);

  function apply() {
    const parsed = {
      q,
      page,
      pageSize,
      sort,
      statusIds: statusIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s)),
      serviceIds: serviceIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s)),
      staffIds: staffIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s)),
      propertyIds: propertyIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s)),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    } as Record<string, unknown>;

    const next = encodeToSearchParams(parsed);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function resetAll() {
    router.replace(pathname);
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Filter Codec Demo</h1>
      <p className="text-sm text-muted-foreground">
        Edit values and click Apply to update the URL via the codec. Unknown keys are ignored. ID arrays accept comma-separated integers.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm">q</label>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search" />
        </div>
        <div className="space-y-2">
          <label className="text-sm">sort</label>
          <Input value={sort} onChange={(e) => setSort(e.target.value)} placeholder="field:dir" />
        </div>
        <div className="space-y-2">
          <label className="text-sm">page</label>
          <Input
            value={page}
            onChange={(e) => setPage(Number(e.target.value))}
            type="number"
            min={1}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm">pageSize</label>
          <Input
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            type="number"
            min={1}
          />
        </div>
        <Separator className="md:col-span-2" />
        <div className="space-y-2">
          <label className="text-sm">statusIds (CSV)</label>
          <Input value={statusIds} onChange={(e) => setStatusIds(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm">serviceIds (CSV)</label>
          <Input value={serviceIds} onChange={(e) => setServiceIds(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm">staffIds (CSV)</label>
          <Input value={staffIds} onChange={(e) => setStaffIds(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm">propertyIds (CSV)</label>
          <Input value={propertyIds} onChange={(e) => setPropertyIds(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm">dateFrom (ISO)</label>
          <Input value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm">dateTo (ISO)</label>
          <Input value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={apply}>Apply</Button>
        <Button variant="secondary" onClick={resetAll}>Reset</Button>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="text-sm font-medium">Current URL</div>
        <code className="block p-2 rounded bg-muted text-xs break-all">
          {`${pathname}?${searchParams.toString()}`}
        </code>
      </div>
    </div>
  );
}


