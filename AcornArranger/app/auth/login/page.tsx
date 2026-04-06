import { AuthBrandHomeLink } from "@/components/auth-brand-home-link";
import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <AuthBrandHomeLink />
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
