"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { authUserMenuSummaryQueryKey } from "@/lib/query-keys/auth";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthUserMenuSummary = {
  email?: string;
  name?: string;
};

async function fetchAuthUserMenuSummary(): Promise<AuthUserMenuSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const u = data.user;
  if (!u) return null;

  const meta = u.user_metadata as Record<string, unknown> | undefined;
  const display =
    typeof meta?.display_name === "string" ? meta.display_name.trim() : "";
  const nameMeta = typeof meta?.name === "string" ? meta.name.trim() : "";

  return {
    email: u.email ?? undefined,
    name: display || nameMeta || undefined,
  };
}

/** Events excluded on purpose (GoTrueClient):
 *  - TOKEN_REFRESHED: routine refresh / tab focus token handling.
 *  - SIGNED_IN: also emitted when the tab becomes visible again (`_recoverAndRefresh`
 *    notifies subscribers with the existing session), not only on a real login.
 *  Invalidating on those refetches this query and calls `getUser()` every refocus.
 *  Real logins/remounts still run the query once on mount; profile saves use
 *  `invalidateQueries`; metadata edits emit USER_UPDATED. */
const INVALIDATING_EVENTS = new Set<string>(["SIGNED_OUT", "USER_UPDATED"]);

/**
 * Cached `getUser()` summary for the header menu. Long staleTime; invalidated on
 * relevant auth events and after profile saves (via queryClient.invalidateQueries).
 */
export function useAuthUserMenuSummary() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (INVALIDATING_EVENTS.has(event)) {
        void queryClient.invalidateQueries({
          queryKey: authUserMenuSummaryQueryKey,
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return useQuery({
    queryKey: authUserMenuSummaryQueryKey,
    queryFn: fetchAuthUserMenuSummary,
    staleTime: ONE_WEEK_MS,
    refetchOnWindowFocus: false,
  });
}
