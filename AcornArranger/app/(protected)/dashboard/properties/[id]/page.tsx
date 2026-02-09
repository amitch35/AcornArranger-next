"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, MapPin, Settings, Clock, Link2, AlertCircle, Edit } from "lucide-react";
import Link from "next/link";
import type { PropertyRow } from "@/src/features/properties/schemas";
import { formatMinutes } from "@/src/features/properties/schemas";
import { fetchPropertyDetail } from "@/src/features/properties/api";

/**
 * Property Detail Page
 * 
 * Displays comprehensive information for a single property:
 * - Basic info (ID, name, status)
 * - Address block (street, city, state, postal code, country)
 * - Settings (estimated cleaning time, linked double units)
 * 
 * Read-only view with Edit button to modify settings
 */

// Status badge component
function StatusBadge({ status }: { status: PropertyRow["status"] }) {
  if (!status) return <span className="text-muted-foreground text-sm">Unknown</span>;
  
  const variant = status.status === "Active" 
    ? "default" 
    : status.status === "Inactive" 
    ? "secondary" 
    : "outline";
    
  return (
    <Badge variant={variant}>
      {status.status}
    </Badge>
  );
}

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  // Fetch property detail
  const {
    data: property,
    isLoading,
    error,
  } = useQuery<PropertyRow>({
    queryKey: ["properties", propertyId],
    queryFn: async () => {
      return fetchPropertyDetail(propertyId);
    },
    enabled: !!propertyId,
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
        <Button 
          variant="ghost" 
          className="gap-2"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Properties
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // No data
  if (!property) {
    return (
      <div className="container py-8 space-y-6">
        <Button 
          variant="ghost" 
          className="gap-2"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Properties
        </Button>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Property not found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Properties</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {property.property_name || "Property"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Property ID: {property.properties_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={property.status} />
          <Link href={`/dashboard/properties/${propertyId}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Edit Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Address Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </CardTitle>
            <CardDescription>
              Property location details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {property.address ? (
              <>
                {property.address.address && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Street Address</p>
                    <p className="text-base mt-1">{property.address.address}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {property.address.city && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">City</p>
                      <p className="text-base mt-1">{property.address.city}</p>
                    </div>
                  )}
                  {property.address.state_name && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">State</p>
                      <p className="text-base mt-1">{property.address.state_name}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {property.address.postal_code && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Postal Code</p>
                      <p className="font-mono text-sm mt-1">{property.address.postal_code}</p>
                    </div>
                  )}
                  {property.address.country && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Country</p>
                      <p className="text-base mt-1">{property.address.country}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No address information available</p>
            )}
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Property Settings
            </CardTitle>
            <CardDescription>
              Cleaning time and linked units
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estimated Cleaning Time */}
            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Estimated Cleaning Time
              </p>
              {property.estimated_cleaning_mins !== null && property.estimated_cleaning_mins !== undefined ? (
                <div className="mt-2">
                  <p className="text-2xl font-semibold">{formatMinutes(property.estimated_cleaning_mins)}</p>
                  <p className="text-sm text-muted-foreground">{property.estimated_cleaning_mins} minutes</p>
                </div>
              ) : (
                <p className="text-muted-foreground mt-2">Not set</p>
              )}
            </div>

            {/* Double Unit (Linked Properties) */}
            <div>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Linked Double Units
              </p>
              {property.double_unit && property.double_unit.length > 0 ? (
                <div className="mt-2 space-y-2">
                  <div className="text-base">
                    <Badge variant="outline" className="font-mono">
                      {property.double_unit.length} {property.double_unit.length === 1 ? "unit" : "units"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {property.double_unit.map((unitId) => (
                      <Link key={unitId} href={`/dashboard/properties/${unitId}`}>
                        <Badge variant="secondary" className="font-mono cursor-pointer hover:bg-secondary/80">
                          #{unitId}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click an ID to view linked property
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground mt-2">No linked units</p>
              )}
            </div>

            {/* Status Info */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-2">
                <StatusBadge status={property.status} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Properties List
        </Button>
        <Link href={`/dashboard/properties/${propertyId}/edit`}>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
