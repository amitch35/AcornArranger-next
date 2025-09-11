import * as React from "react";
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, MoreHorizontal as MoreHorizontalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function Pagination({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <nav role="navigation" aria-label="pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />;
}

export function PaginationContent({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("flex flex-row items-center gap-1", className)} {...props} />;
}

export function PaginationItem({ className, ...props }: React.LiHTMLAttributes<HTMLLIElement>) {
  return <li className={cn("list-none", className)} {...props} />;
}

type PaginationLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  isActive?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
};

export function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  const ariaDisabled = (props as any)["aria-disabled"] === true || (props as any)["aria-disabled"] === "true";
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? "outline" : "ghost", size }),
        ariaDisabled && "pointer-events-none opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function PaginationPrevious(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <PaginationLink aria-label="Go to previous page" size="default" className="gap-1 px-2.5 sm:pl-2.5" {...props}>
      <ChevronLeftIcon className="h-4 w-4" />
      <span className="hidden sm:block">Previous</span>
    </PaginationLink>
  );
}

export function PaginationNext(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <PaginationLink aria-label="Go to next page" size="default" className="gap-1 px-2.5 sm:pr-2.5" {...props}>
      <span className="hidden sm:block">Next</span>
      <ChevronRightIcon className="h-4 w-4" />
    </PaginationLink>
  );
}

export function PaginationEllipsis({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span aria-hidden className={cn("flex h-9 w-9 items-center justify-center", className)} {...props}>
      <MoreHorizontalIcon className="h-4 w-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}


