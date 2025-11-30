"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { Role } from "@/lib/auth";

const profileSchema = z.object({
  display_name: z.string().min(2, "Display name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  user: User;
  profile: any;
  userRole: Role;
}

export function ProfileForm({ user, profile, userRole }: ProfileFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

      setMessage({
        type: 'success',
        text: 'Profile updated successfully!',
      });

      // Refresh the page data
      router.refresh();
    } catch (error: any) {
      console.error('Profile update error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Failed to update profile. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
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
          <span className={`text-sm font-medium ${
            userRole === 'authorized_user' 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-yellow-600 dark:text-yellow-400'
          }`}>
            {userRole === 'authorized_user' ? 'Authorized User' : 'Awaiting Activation'}
          </span>
        </div>
      </div>
    </form>
  );
}

