import { redirect } from "next/navigation";
import { getClientRole } from "@/lib/auth";
import { DashboardContent } from "@/src/features/dashboard/DashboardContent";

export default async function DashboardPage() {
  // Middleware should already gate this route; re-check server-side for safety.
  const role = await getClientRole();
  if (role !== "authorized_user") {
    redirect("/welcome");
  }

  return <DashboardContent />;
}
