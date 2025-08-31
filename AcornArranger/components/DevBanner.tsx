"use client";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useEffect, useState } from "react";

export default function DevBanner() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Read from environment variable, default to false if not set
  const enabled = process.env.NEXT_PUBLIC_EXTERNAL_CALLS_ENABLED === 'true';
  
  // Don't render anything until the component is mounted on the client
  if (!mounted) return null;
  
  return enabled ? null : (
    <div className="fixed bottom-2 left-2 z-50">
      <Alert>
        <AlertTitle>Sandbox mode</AlertTitle>
        <AlertDescription>External API calls are disabled.</AlertDescription>
      </Alert>
    </div>
  );
}
