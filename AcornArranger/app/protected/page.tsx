import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InfoIcon } from "lucide-react";
import { PageContent } from "@/components/layout/ProtectedLayout";
import { Button } from "@/components/ui/button";

export default async function ProtectedPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <PageContent
      title={<h1 className="text-3xl font-bold">Dashboard</h1>}
      primaryActions={
        <Button>
          Primary Action
        </Button>
      }
      secondaryActions={
        <Button variant="outline">
          Secondary Action
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="bg-accent text-sm p-4 rounded-md text-foreground flex gap-3 items-center">
          <InfoIcon size="16" strokeWidth={2} />
          This is a protected page using the new ProtectedLayout (Task 16.1 complete)
        </div>
        
        <div className="flex flex-col gap-2 items-start">
          <h2 className="font-bold text-2xl">Your user details</h2>
          <pre className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto w-full">
            {JSON.stringify(data.claims, null, 2)}
          </pre>
        </div>

        <div className="bg-muted p-4 rounded-md">
          <h3 className="font-semibold mb-2">Layout Features Implemented:</h3>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>✅ CSS Grid layout with header, sidebar, and content areas</li>
            <li>✅ Skip-to-content link for accessibility (press Tab to see)</li>
            <li>✅ Responsive layout with CSS variables for theming</li>
            <li>✅ Slot system for title, actions, filters, and content</li>
            <li>✅ Portal mount points for modals and toasts</li>
            <li>⏳ Header component (Task 16.2)</li>
            <li>⏳ Sidebar with navigation (Task 16.3)</li>
          </ul>
        </div>
      </div>
    </PageContent>
  );
}
