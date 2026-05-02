"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { authUserMenuSummaryQueryKey } from "@/lib/query-keys/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import type { Role } from "@/lib/auth";

const profileSchema = z.object({
  display_name: z.string().min(2, "Display name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  user: User;
  profile: { display_name?: string | null; email?: string | null } | null;
  userRole: Role;
}

export function ProfileForm({ user, profile, userRole }: ProfileFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile?.display_name || "",
      email: user.email || "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const supabase = createClient();

      // Update user profile (RLS will enforce user can only update their own)
      const { error: profileError } = await supabase
        .from('users')
        .update({
          display_name: data.display_name,
          email: data.email,
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      const { error: authMetaError } = await supabase.auth.updateUser({
        data: { display_name: data.display_name ?? "" },
      });

      if (authMetaError) {
        setMessage({
          type: "warning",
          text:
            "Your profile was saved, but we could not refresh your session display name. Try signing out and back in, or save again.",
        });
      } else {
        await queryClient.invalidateQueries({
          queryKey: authUserMenuSummaryQueryKey,
        });
        setMessage({
          type: "success",
          text: "Profile updated successfully!",
        });
      }

      router.refresh();
    } catch (error: unknown) {
      console.error('Profile update error:', error);
      const text =
        error instanceof Error
          ? error.message
          : 'Failed to update profile. Please try again.';
      setMessage({ type: 'error', text });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : message.type === "warning" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          disabled
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          Email cannot be changed. Contact support if you need to update your email.
        </p>
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="display_name">Display Name</Label>
        <Input
          id="display_name"
          type="text"
          placeholder="Your name"
          {...register("display_name")}
        />
        {errors.display_name && (
          <p className="text-sm text-destructive">{errors.display_name.message}</p>
        )}
      </div>

      <div className="pt-4">
        <Button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="w-full sm:w-auto"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="pt-4 border-t space-y-2">
        <h3 className="font-medium text-sm">Account Status</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Role:</span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              userRole === "authorized_user"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-sky-400/70 bg-sky-50 text-sky-900 dark:border-sky-500/45 dark:bg-sky-950/50 dark:text-sky-200"
            }`}
          >
            {userRole === "authorized_user" ? "Authorized User" : "Awaiting Activation"}
          </span>
        </div>
      </div>
    </form>
  );
}

