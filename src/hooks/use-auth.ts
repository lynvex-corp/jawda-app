import { useCallback, useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: "active" | "inactive" | "invited";
  active_org_id: string | null;
  last_activity_at: string | null;
  must_reset_password: boolean;
  created_at: string;
}

export interface OrganizationSummary {
  org_id: string;
  legal_name: string;
  trade_name: string | null;
  role: string;
  is_current: boolean;
}

interface UseAuthResult {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  currentOrg: OrganizationSummary | null;
  organizations: OrganizationSummary[];
  isLoading: boolean;
  signOut: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfileAndOrgs = useCallback(
    async (userId: string) => {
      const [{ data: profileData }, { data: orgsData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.rpc("list_my_organizations"),
      ]);
      setProfile((profileData as Profile) ?? null);
      setOrganizations((orgsData as OrganizationSummary[]) ?? []);
    },
    [supabase],
  );

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      const { data } = result;
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        loadProfileAndOrgs(data.session.user.id).finally(() => {
          if (active) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, newSession: Session | null) => {
      setSession(newSession);
      if (newSession) {
        loadProfileAndOrgs(newSession.user.id);
      } else {
        setProfile(null);
        setOrganizations([]);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfileAndOrgs]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const switchOrganization = useCallback(
    async (orgId: string) => {
      const { error } = await supabase.rpc("set_active_org", { p_org_id: orgId });
      if (error) throw error;
      // Dispara TOKEN_REFRESHED, que reemite o JWT já com o novo org_id e
      // aciona o listener acima para recarregar profile + organizations.
      await supabase.auth.refreshSession();
    },
    [supabase],
  );

  const currentOrg = organizations.find((o) => o.is_current) ?? null;

  return {
    user: session?.user ?? null,
    session,
    profile,
    currentOrg,
    organizations,
    isLoading,
    signOut,
    switchOrganization,
  };
}
