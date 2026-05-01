import { Suspense } from "react";
import { AuthBrandHomeLink } from "@/components/auth-brand-home-link";
import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <AuthBrandHomeLink />
      <div className="w-full max-w-sm">
        {/* LoginForm reads `?redirect=` via useSearchParams(); wrap in Suspense
            so Next's prerender can bail out cleanly for this client-side read. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
