"use client";

import * as React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange }: TablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const canPrev = page > 1;
  const canNext = page < pageCount;

  // simple windowed pages
  const pages = React.useMemo(() => {
    const window = 3;
    const out: (number | "ellipsis")[] = [];
    for (let p = 1; p <= pageCount; p++) {
      if (p === 1 || p === pageCount || Math.abs(p - page) <= window) out.push(p);
      else if (out[out.length - 1] !== "ellipsis") out.push("ellipsis");
    }
    return out;
  }, [page, pageCount]);

  return (
    <div className="flex w-full items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="rows-per-page">Rows per page</Label>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger id="rows-per-page" aria-labelledby="rows-per-page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious aria-disabled={!canPrev} onClick={(e) => { e.preventDefault(); if (canPrev) onPageChange(page - 1); }} href="#" />
          </PaginationItem>
          {pages.map((p, idx) => (
            <PaginationItem key={idx} className="hidden sm:list-item">
              {p === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink href="#" isActive={p === page} onClick={(e) => { e.preventDefault(); if (p !== page) onPageChange(p); }}>
                  {p}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext aria-disabled={!canNext} onClick={(e) => { e.preventDefault(); if (canNext) onPageChange(page + 1); }} href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}


