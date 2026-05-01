import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

/**
 * Layout wrapper for all protected (authenticated) pages
 *
 * This layout is applied to all routes in the (protected) group, e.g. /dashboard, /profile.
 * It provides the foundational grid structure with Header and Sidebar components.
 */

// Protected pages must not be statically prerendered; this opts the
// whole subtree into dynamic rendering and also prevents Next 15 from
// failing the build on CSR bailout errors for filter-driven pages.
export const dynamic = "force-dynamic";

export default function ProtectedLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout header={<Header />} sidebar={<Sidebar />}>
      {children}
    </ProtectedLayout>
  );
}


