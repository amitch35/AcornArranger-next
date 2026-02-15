"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, Save, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DurationPicker } from "@/components/filters/DurationPicker";
import PropertyMultiSelect from "@/components/filters/PropertyMultiSelect";
import type { PropertyRow } from "@/src/features/properties/schemas";
import { fetchPropertyDetail, updatePropertySettings } from "@/src/features/properties/api";
import { formatMinutes } from "@/src/features/properties/schemas";
import { usePropertyOptions } from "@/lib/options/usePropertyOptions";

/**
 * Property Settings Edit Page
 * 
 * Allows editing:
 * - Estimated cleaning time (in minutes, displayed as HH:MM)
 * - Linked double units (multi-select, max 20, no self-reference)
 * 
 * Validation:
 * - Cleaning time: 0-1440 minutes (24 hours)
 * - Double units: Prevent self-selection, auto-dedupe, max 20
 * 
 * Uses PropertyMultiSelect with string[] values, converting to/from number[] for API
 */

export default function PropertyEditPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const propertyId = params?.id as string;

  // Form state
  const [cleaningMinutes, setCleaningMinutes] = React.useState<number | null>(null);
  const [linkedUnitsStr, setLinkedUnitsStr] = React.useState<string[]>([]); // PropertyMultiSelect uses strings
  const [hasChanges, setHasChanges] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Fetch property detail
  const {
    data: property,
    isLoading,
    error,
  } = useQuery<PropertyRow>({
    queryKey: ["property", propertyId],
    queryFn: () => fetchPropertyDetail(propertyId),
    enabled: !!propertyId,
    staleTime: 2 * 60 * 1000, // 2 minutes - shares cache with detail page
  });

  // Fetch property options for multi-select (all active properties)
  const { data: propertyOptionsData } = usePropertyOptions({
    q: searchQuery || undefined,
    statusIds: [1], // Only active properties
    limit: 1000, // Fetch all for dropdown
  });

  // Convert options to PropertyMultiSelect format, excluding current property
  const propertyOptions = React.useMemo(() => {
    if (!propertyOptionsData?.options) return [];
    return propertyOptionsData.options
      .filter((opt) => opt.id !== propertyId) // Exclude self
      .map((opt) => ({
        label: opt.label,
        value: String(opt.id),
      }));
  }, [propertyOptionsData, propertyId]);

  // Initialize form values when property loads
  React.useEffect(() => {
    if (property && !hasChanges) {
      setCleaningMinutes(property.estimated_cleaning_mins ?? null);
      // Convert number[] to string[] for PropertyMultiSelect
      setLinkedUnitsStr((property.double_unit ?? []).map(String));
    }
  }, [property, hasChanges]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      // Convert string[] back to number[] for API
      const linkedUnitsNum = linkedUnitsStr.map(Number).filter((id) => !isNaN(id));
      
      return updatePropertySettings(propertyId, {
        estimated_cleaning_mins: cleaningMinutes,
        double_unit: linkedUnitsNum.length > 0 ? linkedUnitsNum : null,
      });
    },
  });

  // Handle form changes
  const handleCleaningTimeChange = (minutes: number | null) => {
    setCleaningMinutes(minutes);
    setHasChanges(true);
  };

  const handleLinkedUnitsChange = (ids: string[]) => {
    // PropertyMultiSelect already excludes self via filtered options
    // Just enforce max 20 limit
    if (ids.length <= 20) {
      setLinkedUnitsStr(ids);
      setHasChanges(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedProperty = await updateMutation.mutateAsync();
      // Write fresh data into cache BEFORE navigating so the detail page
      // renders updated info immediately on mount.
      queryClient.setQueryData(["property", propertyId], updatedProperty);
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Property settings updated successfully");
      router.push(`/dashboard/properties/${propertyId}`);
    } catch {
      // Error is already tracked by updateMutation.error — no extra handling needed
    }
  };

  const handleCancel = () => {
    // Navigate to detail page (explicit target, works regardless of how user arrived)
    router.push(`/dashboard/properties/${propertyId}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !property) {
    return (
      <div className="container py-8 space-y-6">
        <Link href={`/dashboard/properties/${propertyId}`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Property
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Property not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Property Settings</h1>
          <p className="text-muted-foreground mt-2">
            {property.property_name} (ID: {property.properties_id})
          </p>
        </div>
        <Button variant="ghost" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Property Settings</CardTitle>
            <CardDescription>
              Update cleaning time and linked double units
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Estimated Cleaning Time */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Estimated Cleaning Time
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                How long does it typically take to clean this property?
                {cleaningMinutes !== null && (
                  <span className="ml-2 font-mono">
                    ({formatMinutes(cleaningMinutes)} = {cleaningMinutes} minutes)
                  </span>
                )}
              </p>
              <DurationPicker
                valueMinutes={cleaningMinutes}
                onChange={handleCleaningTimeChange}
                minMinutes={0}
                maxMinutes={1440}
                label="Cleaning time"
              />
            </div>

            {/* Linked Double Units */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Linked Double Units
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Select up to 20 properties that are cleaned together with this one/affect scheduling this unit's cleaning.
                {linkedUnitsStr.length > 0 && (
                  <span className="ml-2">
                    ({linkedUnitsStr.length} {linkedUnitsStr.length === 1 ? "unit" : "units"} selected)
                  </span>
                )}
              </p>
              <PropertyMultiSelect
                label="Linked properties"
                placeholder="Search properties..."
                options={propertyOptions}
                value={linkedUnitsStr}
                onChange={handleLinkedUnitsChange}
                loadOptions={({ q }) => setSearchQuery(q ?? "")}
                onClearNotice={(count) => {
                  // Optional: show notification when selections are auto-removed
                  console.log(`${count} selections removed due to filter changes`);
                }}
              />
              {linkedUnitsStr.length >= 20 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Maximum of 20 linked units reached
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Mutation Error */}
            {updateMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Update Failed</AlertTitle>
                <AlertDescription>
                  {updateMutation.error instanceof Error
                    ? updateMutation.error.message
                    : "Failed to update property settings"}
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={!hasChanges || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
