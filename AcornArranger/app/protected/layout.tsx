import { ProtectedLayout } from "@/components/layout/ProtectedLayout";

/**
 * Layout wrapper for all protected (authenticated) pages
 * 
 * This layout is applied to all routes under /protected/*
 * It provides the foundational grid structure that will be enhanced
 * with Header and Sidebar components in subsequent tasks.
 */
export default function ProtectedLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout
      // Header and Sidebar will be added in tasks 16.2 and 16.3
      header={
        <div className="h-full flex items-center px-6 border-b">
          <span className="font-semibold">AcornArranger</span>
          <span className="ml-4 text-sm text-muted-foreground">
            (Header placeholder - Task 16.2)
          </span>
        </div>
      }
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
