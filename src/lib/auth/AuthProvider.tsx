import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, mockBackend, supabase } from "../supabase/client";
import type { Profile, Wallet } from "../../types/api";
import { AuthContext, type AuthContextValue } from "./context";

const mockProfile: Profile = {
  id: "00000000-0000-4000-8000-000000000001",
  full_name: "Himanth",
  email: "himanth@dady.ai",
  phone: null,
  avatar_url: null,
  country_code: "IN",
  preferred_language: "en",
  onboarding_completed: true,
  auth_provider: "mock",
  account_status: "active",
  role: "user",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockWallet: Wallet = {
  user_id: mockProfile.id,
  available_credits: 642,
  reserved_credits: 0,
  lifetime_purchased: 700,
  lifetime_promotional: 0,
  lifetime_used: 58,
  lifetime_refunded: 0,
  updated_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(!mockBackend);

  const refreshProfile = async () => {
    if (mockBackend || !user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) setProfile(data as Profile);
  };

  const refreshWallet = async () => {
    if (mockBackend || !user) return;
    const { data } = await supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle();
    if (data) setWallet(data as Wallet);
  };

  useEffect(() => {
    if (mockBackend || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || mockBackend) return;
    void refreshProfile();
    void refreshWallet();

    const channel = supabase
      .channel(`wallet:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) setWallet(payload.new as Wallet);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: mockBackend
        ? profile
          ? ({ id: mockProfile.id, email: profile.email ?? mockProfile.email } as User)
          : null
        : user,
      session,
      profile,
      wallet,
      loading,
      isAdmin: profile?.role === "admin" || profile?.role === "super_admin",
      signInWithGoogle: async () => {
        if (mockBackend) {
          setProfile(mockProfile);
          setWallet(mockWallet);
          return;
        }
        const origin = import.meta.env.VITE_APP_URL ?? window.location.origin;
        const currentRedirect =
          new URLSearchParams(window.location.search).get("redirect") || "/app";
        sessionStorage.setItem("dady_auth_redirect", currentRedirect);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${origin}/auth`,
            queryParams: {
              access_type: "offline",
              prompt: "select_account",
            },
          },
        });
        if (error) throw error;
      },
      signInWithPassword: async (email, password) => {
        if (mockBackend) {
          setProfile({ ...mockProfile, email });
          setWallet(mockWallet);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUpWithPassword: async (email, password, fullName) => {
        if (mockBackend) {
          setProfile({ ...mockProfile, email, full_name: fullName ?? null, onboarding_completed: false });
          setWallet({ ...mockWallet, available_credits: 0, lifetime_purchased: 0 });
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
      },
      signInWithOtp: async (email) => {
        if (mockBackend) return;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${import.meta.env.VITE_APP_URL ?? window.location.origin}/auth`,
          },
        });
        if (error) throw error;
      },
      signOut: async () => {
        if (mockBackend) {
          setProfile(null);
          setWallet(null);
          return;
        }
        await supabase.auth.signOut();
        setProfile(null);
        setWallet(null);
      },
      refreshProfile,
      refreshWallet,
      completeOnboarding: async ({ full_name, phone }) => {
        if (mockBackend) {
          setProfile((prev) =>
            prev
              ? { ...prev, full_name, phone: phone ?? null, onboarding_completed: true }
              : {
                  ...mockProfile,
                  full_name,
                  phone: phone ?? null,
                  onboarding_completed: true,
                },
          );
          if (!wallet) setWallet(mockWallet);
          return;
        }
        if (!user) throw new Error("Not signed in");
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name,
            phone: phone ?? null,
            onboarding_completed: true,
            country_code: "IN",
          })
          .eq("id", user.id);
        if (error) throw error;
        await refreshProfile();
      },
    }),
    [user, session, profile, wallet, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
