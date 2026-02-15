"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, User, Briefcase, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { StaffDetailResponse } from "@/src/features/staff/schemas";
import { fetchStaffDetail } from "@/src/features/staff/api";
import { getListUrl } from "@/lib/navigation/listReturnUrl";

/**
 * Staff Detail Page
 * 
 * Displays comprehensive information for a single staff member:
 * - Basic info (ID, name, status)
 * - Role information (title, priority, capabilities)
 * - Integration data (Homebase ID if available)
 * 
 * Read-only view - no editing capabilities
 */

// Status badge component
function StatusBadge({ status }: { status: StaffDetailResponse["status"] }) {
  if (!status) return <span className="text-muted-foreground text-sm">Unknown</span>;
  
  const variant = status.status === "Active" 
    ? "default" 
    : status.status === "Inactive" 
    ? "secondary" 
    : "outline";
  
  const Icon = status.status === "Active" 
    ? CheckCircle2 
    : status.status === "Inactive" 
    ? XCircle 
    : AlertCircle;
    
  return (
    <Badge variant={variant} className="gap-1.5">
      <Icon className="h-3 w-3" />
      {status.status}
    </Badge>
  );
}

// Capability badge
function CapabilityBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {enabled ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" aria-label="Yes" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" aria-label="No" />
      )}
      <span className={enabled ? "font-medium" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

export default function StaffDetailPage() {
  const params = useParams();
  const userId = params?.user_id as string;
  const listUrl = getListUrl("staff", "/dashboard/staff");

  // Fetch staff detail
  const {
    data: staff,
    isLoading,
    error,
  } = useQuery<StaffDetailResponse>({
    queryKey: ["staff", userId],
    queryFn: () => fetchStaffDetail(userId),
    staleTime: 5 * 60 * 1000, // 2 minutes - avoid refetch on back navigation
    enabled: !!userId,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="container py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container py-8 space-y-6">
        <Link href={listUrl}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Staff
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // No data
  if (!staff) {
    return (
      <div className="container py-8 space-y-6">
        <Link href={listUrl}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Staff
          </Button>
        </Link>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Staff member not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={listUrl}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Staff</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {staff.name || `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "Staff Member"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Staff ID: {staff.user_id}
            </p>
          </div>
        </div>
        <StatusBadge status={staff.status} />
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Personal details and contact information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">User ID</p>
                <p className="font-mono text-sm mt-1">{staff.user_id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="mt-1">
                  <StatusBadge status={staff.status} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Full Name</p>
              <p className="text-base mt-1">
                {staff.name || `${staff.first_name || ""} ${staff.last_name || ""}`.trim() || "—"}
              </p>
            </div>

            {(staff.first_name || staff.last_name) && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">First Name</p>
                  <p className="text-base mt-1">{staff.first_name || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Name</p>
                  <p className="text-base mt-1">{staff.last_name || "—"}</p>
                </div>
              </div>
            )}

            {staff.hb_user_id && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Homebase User ID</p>
                <p className="font-mono text-sm mt-1">{staff.hb_user_id}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role & Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Role & Capabilities
            </CardTitle>
            <CardDescription>
              Job title, priority, and permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {staff.role ? (
              <>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Role</p>
                  <p className="text-lg font-semibold mt-1">{staff.role.title}</p>
                  {staff.role.description && (
                    <p className="text-sm text-muted-foreground mt-1">{staff.role.description}</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Priority</p>
                  <p className="text-base mt-1">{staff.role.priority}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Lower numbers = higher priority in scheduling
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Capabilities</p>
                  <div className="space-y-2">
                    <CapabilityBadge label="Can Clean" enabled={staff.role.can_clean} />
                    <CapabilityBadge label="Can Lead Team" enabled={staff.role.can_lead_team} />
                  </div>
                </div>

                {staff.capabilities && staff.capabilities.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Active Capabilities</p>
                    <div className="flex flex-wrap gap-2">
                      {staff.capabilities.map((cap) => (
                        <Badge key={cap} variant="secondary">
                          {cap.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No role assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Link href={listUrl}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Staff List
          </Button>
        </Link>
      </div>
    </div>
  );
}
