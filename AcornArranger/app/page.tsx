import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Users,
} from "lucide-react";
import { getClientRole } from "@/lib/auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Same address as welcome/profile support links. */
const SUPPORT_EMAIL = "info@acornarranger.com";
const mailtoSupport = `mailto:${SUPPORT_EMAIL}`;

export const metadata: Metadata = {
  title: "AcornArranger | Housekeeping scheduling for vacation rentals",
  description:
    "Build daily schedule plans, align with Homebase, and send work to ResortCleaning—scheduling for short-term rental housekeeping teams.",
};

export default async function Home() {
  const role = await getClientRole();

  if (role === "authorized_user") {
    redirect("/dashboard");
  }
  if (role === "authenticated") {
    redirect("/welcome");
  }

  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-svh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-foreground transition-colors hover:text-foreground/80"
            aria-label="AcornArranger home"
          >
            <Image
              src="/icon.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9"
              priority
            />
            <span>AcornArranger</span>
          </Link>
          <nav
            className="hidden items-center gap-2 sm:flex"
            aria-label="Account"
          >
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/auth/sign-up">Sign up</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section
          className="relative overflow-hidden bg-gradient-to-br from-brand-teal to-brand-teal-dark px-4 py-16 text-primary-foreground sm:px-6 sm:py-24"
          aria-labelledby="landing-hero-heading"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="mb-6 flex justify-center rounded-full bg-white/15 p-3 ring-2 ring-white/25">
              <Image
                src="/icon.png"
                alt=""
                width={64}
                height={64}
                className="h-16 w-16"
                priority
              />
            </div>
            <h1
              id="landing-hero-heading"
              className="text-balance font-serif text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
            >
              Smarter scheduling for vacation rental teams
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-base text-white/90 sm:text-lg">
              AcornArranger helps housekeeping managers build daily schedule
              plans across many properties—without the spreadsheet pain. Plan
              with your real constraints, align with Homebase, and keep
              ResortCleaning as your source of truth.
            </p>
            <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button
                size="lg"
                className="bg-white text-brand-teal hover:bg-white/90"
                asChild
              >
                <Link href="/auth/sign-up">Get started</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/auth/login">Log in</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          className="border-b border-border bg-brand-lavender px-4 py-14 dark:bg-background sm:px-6 sm:py-20"
          aria-labelledby="landing-features-heading"
        >
          <div className="mx-auto max-w-6xl">
            <h2
              id="landing-features-heading"
              className="text-center font-serif text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Built for complex housekeeping operations
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              From multi-property portfolios to tight cleaning time windows, AcornArranger
              focuses on the schedule board—not generic dropdown selectors.
            </p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              <li>
                <Card className="h-full border-border/80 shadow-sm">
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalendarDays className="h-5 w-5" aria-hidden />
                    </div>
                    <CardTitle>Daily schedule plans</CardTitle>
                    <CardDescription>
                      Let the app build optimized daily plans with your routing,
                      cleaning windows, and staffing constraints—then refine on
                      the board.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
              <li>
                <Card className="h-full border-border/80 shadow-sm">
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Users className="h-5 w-5" aria-hidden />
                    </div>
                    <CardTitle>Staff &amp; Homebase</CardTitle>
                    <CardDescription>
                      Manage available cleaners, pull in today&apos;s Homebase
                      shifts, and spot mismatches between plans and who&apos;s
                      actually on the clock.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
              <li>
                <Card className="h-full border-border/80 shadow-sm">
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" aria-hidden />
                    </div>
                    <CardTitle>Property management</CardTitle>
                    <CardDescription>
                      Track properties, sizes, and service types across your
                      portfolio so every plan reflects the real work on the
                      ground.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
              <li>
                <Card className="h-full border-border/80 shadow-sm">
                  <CardHeader>
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ClipboardList className="h-5 w-5" aria-hidden />
                    </div>
                    <CardTitle>Backlog &amp; workflow</CardTitle>
                    <CardDescription>
                      Manage schedules with a drag-and-drop schedule board,
                      handle unscheduled work in the backlog, and when
                      you&apos;re ready, send plans to ResortCleaning for your
                      staff.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section
          className="bg-background px-4 py-14 sm:px-6 sm:py-20"
          aria-labelledby="landing-cta-heading"
        >
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-sm sm:px-10">
            <h2
              id="landing-cta-heading"
              className="font-serif text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Ready to simplify your schedule?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Create an account to get started. Your administrator will activate
              full access when your team is ready.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" asChild>
                <Link href="/auth/sign-up">Create an account</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/auth/login">Log in</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Interested organizations */}
        <section
          className="border-t border-border bg-muted/35 px-4 py-14 dark:bg-muted/15 sm:px-6 sm:py-16"
          aria-labelledby="landing-partners-heading"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="landing-partners-heading"
              className="font-serif text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Interested in AcornArranger for your company?
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              Right now AcornArranger is built for one housekeeping operation,
              with ResortCleaning as the system of record. If you run a similar
              short-term rental program or are exploring tailored scheduling
              software, we are open to a conversation about future availability
              or related work.
            </p>
            <p className="mt-6">
              <a
                href={`${mailtoSupport}?subject=${encodeURIComponent("AcornArranger inquiry")}`}
                className="text-base font-medium text-primary underline-offset-4 hover:underline"
              >
                Get in touch
              </a>
              <span className="text-muted-foreground">
                {" "}
                — {SUPPORT_EMAIL}
              </span>
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-brand-deep text-white">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
          <p className="text-center text-sm text-white/90">
            Questions?{" "}
            <a
              href={mailtoSupport}
              className="font-medium text-brand-teal underline-offset-4 hover:underline"
            >
              Contact us for assistance
            </a>
            {" "}
            — or reach out to your administrator for account access.
          </p>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
            <p className="text-sm text-white/80">
              © {year} AcornArranger. All rights reserved.
            </p>
            <ThemeSwitcher className="border-white/40 bg-white/15 text-white shadow-none hover:bg-white/25 hover:text-white" />
          </div>
        </div>
      </footer>
    </div>
  );
}
