import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

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
      sidebar={<Sidebar />}
    >
      {children}
    </ProtectedLayout>
  );
}
