import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <main className="container mx-auto py-8">
      <h1 className="text-2xl font-semibold">Welcome to AcornArranger</h1>
      <p className="text-muted-foreground mt-2">You are signed in.</p>
    </main>
  );
}
