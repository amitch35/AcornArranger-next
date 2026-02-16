"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  CalendarDays,
  Building2,
  Users,
  RotateCw,
  Clock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import type { AppointmentDetailResponse } from "@/src/features/appointments/schemas";
import { fetchAppointmentDetail } from "@/src/features/appointments/api";
import {
  formatDateTime,
  formatAppointmentStaffName,
  getStatusBadgeVariant,
  isWithinHours,
} from "@/src/features/appointments/schemas";
import { getListUrl } from "@/lib/navigation/listReturnUrl";

/**
 * Appointment Detail Page (read-only)
 *
 * Two-card layout:
 * - Card 1: Appointment Overview (times, status, T/A)
 * - Card 2: Related Information (property, service, staff)
 */

// ============================================================================
// Status Badge (same variant mapping as list page)
// ============================================================================

function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentDetailResponse["status"];
}) {
  if (!status)
    return <span className="text-muted-foreground text-sm">Unknown</span>;
  const variant = getStatusBadgeVariant(status.status);
  return <Badge variant={variant}>{status.status ?? "Unknown"}</Badge>;
}

// ============================================================================
// Main Component
// ============================================================================

export default function AppointmentDetailPage() {
  const params = useParams();
  const appointmentId = params?.id as string;
  const listUrl = getListUrl("appointments", "/dashboard/appointments");

  // Fetch appointment detail
  const {
    data: appointment,
    isLoading,
    error,
  } = useQuery<AppointmentDetailResponse>({
    queryKey: ["appointment", appointmentId],
    queryFn: () => fetchAppointmentDetail(appointmentId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!appointmentId,
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
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
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
            Back to Appointments
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

  // Not found
  if (!appointment) {
    return (
      <div className="container py-8 space-y-6">
        <Link href={listUrl}>
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Appointments
          </Button>
        </Link>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Appointment not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const displayId =
    appointment.appointment_id ?? appointment.id;
  const urgentArrival = isWithinHours(appointment.next_arrival_time, 2);

  return (
    <div className="container py-8 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={listUrl}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Appointments</span>
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Appointment #{displayId}
            </h1>
            <p className="text-muted-foreground mt-1">
              Read-only appointment details
            </p>
          </div>
        </div>
        <AppointmentStatusBadge status={appointment.status} />
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Appointment Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Appointment Overview
            </CardTitle>
            <CardDescription>
              Timing, status, and scheduling details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Appointment ID
                </p>
                <p className="font-mono text-sm mt-1">{displayId}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <div className="mt-1">
                  <AppointmentStatusBadge status={appointment.status} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Arrival Time
              </p>
              <div className="text-base mt-1">
                {appointment.arrival_time ? (
                  formatDateTime(appointment.arrival_time)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Departure Time
              </p>
              <div className="text-base mt-1">
                {appointment.departure_time ? (
                  formatDateTime(appointment.departure_time)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Next Arrival Time
              </p>
              <div className="mt-1">
                {appointment.next_arrival_time ? (
                  urgentArrival ? (
                    <Badge variant="destructive" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(appointment.next_arrival_time)}
                    </Badge>
                  ) : (
                    <span className="text-base">
                      {formatDateTime(appointment.next_arrival_time)}
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Turn-around
                </p>
                <div className="mt-1 flex items-center gap-2">
                  {appointment.turn_around ? (
                    <>
                      <RotateCw
                        className="h-4 w-4 text-muted-foreground"
                        aria-label="Turn-around appointment"
                      />
                      <span className="text-sm font-medium">Yes</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">No</span>
                  )}
                </div>
              </div>
              {appointment.cancelled_date && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Cancelled
                  </p>
                  <p className="text-sm mt-1 text-destructive">
                    {formatDateTime(appointment.cancelled_date)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Related Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Related Information
            </CardTitle>
            <CardDescription>
              Property, service, and assigned staff
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Property */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Property
              </p>
              {appointment.property_info ? (
                <Link
                  href={`/dashboard/properties/${appointment.property_info.properties_id}`}
                  className="text-base text-primary hover:underline mt-1 inline-block"
                >
                  {appointment.property_info.property_name}
                </Link>
              ) : (
                <p className="text-muted-foreground mt-1">—</p>
              )}
            </div>

            {/* Service */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Service
              </p>
              <p className="text-base mt-1">
                {appointment.service_info?.name ?? "—"}
              </p>
            </div>

            {/* Staff */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                <Users className="h-4 w-4 inline mr-1" />
                Assigned Staff
              </p>
              {appointment.staff.length > 0 ? (
                <div className="space-y-2">
                  {appointment.staff.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-2"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {(member.first_name?.[0] ?? member.name?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {formatAppointmentStaffName(member)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ID: {member.user_id}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Unassigned</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-4">
        <Link href={listUrl}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Appointments List
          </Button>
        </Link>
      </div>
    </div>
  );
}
