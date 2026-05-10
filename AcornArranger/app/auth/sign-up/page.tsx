import type { Metadata } from "next";
import { AuthBrandHomeLink } from "@/components/auth-brand-home-link";
import { SignUpForm } from "@/components/sign-up-form";

export const metadata: Metadata = {
  title: "Sign up | AcornArranger",
};

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <AuthBrandHomeLink />
      <div className="w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  );
}
