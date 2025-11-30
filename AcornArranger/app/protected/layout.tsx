import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { Header } from "@/components/layout/Header";

/**
 * Layout wrapper for all protected (authenticated) pages
 * 
 * This layout is applied to all routes under /protected/*
 * It provides the foundational grid structure with Header and Sidebar components.
 */
export default function ProtectedLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout
      header={<Header />}
      sidebar={
        <div className="p-6">
          <p className="text-sm text-muted-foreground">
            Sidebar placeholder
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            (Task 16.3)
          </p>
        </div>
      }
    >
      {children}
    </ProtectedLayout>
  );
}
