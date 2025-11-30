import { redirect } from "next/navigation";
import { getClientRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default async function ProfilePage() {
  const role = await getClientRole();

  if (!role) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account information and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Update your profile details. Changes are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm user={user} profile={profile} userRole={role} />
        </CardContent>
      </Card>

      {role === "authenticated" && (
        <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950">
          <CardHeader>
            <CardTitle className="text-yellow-900 dark:text-yellow-100">
              Account Activation Pending
            </CardTitle>
            <CardDescription className="text-yellow-800 dark:text-yellow-200 space-y-2">
              <span>
                Your account is awaiting activation. Once activated by an
                administrator, you&apos;ll have full access to all features.
              </span>
              <span className="block">
                In the meantime, you can{" "}
                <Link
                  href="/welcome"
                  className="font-medium text-yellow-900 underline underline-offset-4 dark:text-yellow-100"
                >
                  return to the welcome page
                </Link>{" "}
                for more information.
              </span>
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}


