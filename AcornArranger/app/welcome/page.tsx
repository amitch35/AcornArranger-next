import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getClientRole } from "@/lib/auth";
import { ProfileMenu } from "@/components/layout/Header/ProfileMenu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserIcon, MailIcon } from "lucide-react";

export default async function WelcomePage() {
  // Check role and redirect if they're already authorized
  const role = await getClientRole();
  
  if (role === 'authorized_user') {
    redirect('/dashboard');
  }
  
  if (!role) {
    redirect('/auth/login');
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* Floating Profile Menu in top right (aligned to page edge) */}
      <div className="pointer-events-none absolute inset-x-0 top-4 z-50 flex justify-end px-4">
        <div className="pointer-events-auto">
          <ProfileMenu />
        </div>
      </div>

      <div className="w-full max-w-2xl">
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3">
            <Image
              src="/icon.png"
              alt="AcornArranger"
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <CardTitle className="text-2xl">Welcome to AcornArranger!</CardTitle>
          </div>
          <CardDescription>
            Your account has been created successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 space-y-2">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              Account Activation Pending
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Your account is currently awaiting activation by an administrator. 
              Once activated, you'll have full access to all AcornArranger features including:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 list-disc list-inside space-y-1 ml-2">
              <li>View and manage properties, staff, and appointments</li>
              <li>Create and manage schedules</li>
              <li>See missing shifts and conflicts</li>
              <li>Adjust the priority and behaviour of staff roles</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">What you can do now:</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <Link href="/profile" className="block">
                <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">Complete Your Profile</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Add your profile information and preferences.
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <a 
                href="mailto:info@acornarranger.com" 
                className="block"
              >
                <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <MailIcon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">Contact Support</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Have questions? Reach out to our support team.
                    </p>
                  </CardContent>
                </Card>
              </a>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              Need immediate assistance?{" "}
              <a 
                href="mailto:info@acornarranger.com" 
                className="text-primary hover:underline font-medium"
              >
                Contact an administrator
              </a>
            </p>
          </div>

          <div className="flex justify-center">
            <Link href="/profile">
              <Button size="lg">
                Go to Profile
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}

