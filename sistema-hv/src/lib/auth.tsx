import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { Role } from "./rbac";
import { getSupabaseBrowserClient } from "./supabase/browser";

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  status: string;
};

type AuthState = {
  session: Session | null;
  profile: UserProfile | null;
  role: Role | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  role: null,
  loading: true,
});

/**
 * Mantém a sessão do Supabase Auth + o perfil (papel) em contexto. Roda só no
 * cliente (getSession lê do storage do navegador); no SSR começa em loading.
 * O papel vem de system_users (RLS de select liberado para a própria org).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    let mounted = true;

    async function loadProfile(s: Session | null) {
      if (!s?.user?.id) {
        setProfile(null);
        return;
      }
      const { data } = await sb
        .from("system_users_active")
        .select("id, email, full_name, role, status")
        .eq("id", s.user.id)
        .maybeSingle();
      if (mounted) setProfile((data as UserProfile) ?? null);
    }

    sb.auth.getSession().then(async ({ data, error: sessionErr }) => {
      if (!mounted) return;
      if (sessionErr) {
        // Refresh token inválido/expirado — limpar sessão e forçar re-login
        console.warn("Sessão expirada, redirecionando para login:", sessionErr.message);
        await sb.auth.signOut();
        setSession(null);
        setProfile(null);
        if (mounted) setLoading(false);
        return;
      }
      setSession(data.session);
      await loadProfile(data.session);
      if (mounted) setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
      void loadProfile(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, role: profile?.role ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export async function signOut() {
  await getSupabaseBrowserClient().auth.signOut();
}
