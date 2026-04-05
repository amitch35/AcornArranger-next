import { redirect } from "next/navigation";
import { getClientRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/profile-form";
import { ThemeSwitcher } from "@/components/theme-switcher";
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

      {role === "authenticated" && (
        <Card className="border-primary/30 bg-primary/10 dark:border-primary/25 dark:bg-primary/15">
          <CardHeader>
            <CardTitle className="text-foreground">
              Account Activation Pending
            </CardTitle>
            <CardDescription className="text-muted-foreground space-y-2">
              <span>
                Your account is awaiting activation. Once activated by an
                administrator, you&apos;ll have full access to all features.
              </span>
              <span className="block">
                In the meantime, you can{" "}
                <Link
                  href="/welcome"
                  className="font-medium text-primary underline underline-offset-4 hover:text-primary/90"
                >
                  return to the welcome page
                </Link>{" "}
                for more information.
              </span>
            </CardDescription>
          </CardHeader>
        </Card>
      )}

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

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Preference for light, dark, or match your system.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <span className="text-sm font-medium leading-none">Theme</span>
          <ThemeSwitcher />
        </CardContent>
      </Card>
    </div>
  );
}


