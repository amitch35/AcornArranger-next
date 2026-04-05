"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  fetchRolesForSettings,
  updateRole,
  type RoleListItem,
} from "@/src/features/roles/api";
import type { RoleUpdatePayload } from "@/src/features/roles/schemas";
import { PriorityInputField } from "@/src/features/roles/components/PriorityInputField";

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const {
    data: roles = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["roles", "settings"],
    queryFn: fetchRolesForSettings,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RoleUpdatePayload }) =>
      updateRole(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", "settings"] });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Update failed");
    },
  });

  const rowPending = (id: number) =>
    updateMutation.isPending && updateMutation.variables?.id === id;

  const commitPriority = (id: number, next: number) => {
    updateMutation.mutate({ id, payload: { priority: next } });
  };

  const commitFlag = (
    id: number,
    key: "can_lead_team" | "can_clean",
    value: boolean
  ) => {
    updateMutation.mutate({ id, payload: { [key]: value } as RoleUpdatePayload });
  };

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure scheduling-related options for your organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff roles</CardTitle>
          <CardDescription>
            Set scheduling priority (lower numbers are placed in schedules first; duplicate values
            are allowed). Save a priority by pressing Enter or leaving the field. Toggle whether
            each role can lead a team or be assigned cleaning appointments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not load roles</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : "Unknown error"}
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {roles.length} role{roles.length === 1 ? "" : "s"}
              </p>
              <RolesTable
                roles={roles}
                rowPending={rowPending}
                onPriorityCommit={commitPriority}
                onFlagCommit={commitFlag}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RolesTable({
  roles,
  rowPending,
  onPriorityCommit,
  onFlagCommit,
}: {
  roles: RoleListItem[];
  rowPending: (id: number) => boolean;
  onPriorityCommit: (id: number, next: number) => void;
  onFlagCommit: (
    id: number,
    key: "can_lead_team" | "can_clean",
    value: boolean
  ) => void;
}) {
  if (roles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
        No roles found.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px]">Priority</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="w-[120px] text-center">Can lead</TableHead>
          <TableHead className="w-[120px] text-center">Can clean</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((role) => (
          <TableRow key={role.id}>
            <TableCell>
              <PriorityInputField
                roleId={role.id}
                priority={role.priority}
                disabled={rowPending(role.id)}
                onCommit={(next) => onPriorityCommit(role.id, next)}
              />
            </TableCell>
            <TableCell className="font-medium">
              {role.title?.trim() ? role.title : "—"}
            </TableCell>
            <TableCell className="text-center">
              <div className="flex justify-center">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`lead-${role.id}`}
                    checked={role.can_lead_team}
                    disabled={rowPending(role.id)}
                    onCheckedChange={(checked) =>
                      onFlagCommit(role.id, "can_lead_team", checked === true)
                    }
                  />
                  <Label
                    htmlFor={`lead-${role.id}`}
                    className="sr-only"
                  >
                    Can lead team for {role.title ?? `role ${role.id}`}
                  </Label>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-center">
              <div className="flex justify-center">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`clean-${role.id}`}
                    checked={role.can_clean}
                    disabled={rowPending(role.id)}
                    onCheckedChange={(checked) =>
                      onFlagCommit(role.id, "can_clean", checked === true)
                    }
                  />
                  <Label
                    htmlFor={`clean-${role.id}`}
                    className="sr-only"
                  >
                    Can clean for {role.title ?? `role ${role.id}`}
                  </Label>
                </div>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
