import { useNavigate, useSearchParams } from "react-router-dom";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Logo } from "../components/Logo";
import { Button, Placeholder } from "../components/ui";
import { DEMO_LOGIN } from "../lib/auth/demoCredentials";
import { useAuth } from "../lib/auth/context";
import "./Auth.css";

export function Auth() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const redirectParam = params.get("redirect");
  const redirect =
    redirectParam ||
    sessionStorage.getItem("dady_auth_redirect") ||
    "/app";
  const {
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
    signInWithOtp,
    user,
    profile,
    loading,
  } = useAuth();

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const passwordOk = useMemo(
    () => password.length >= 8 && /\d/.test(password),
    [password],
  );

  const afterAuth = (nextProfile = profile) => {
    sessionStorage.removeItem("dady_auth_redirect");
    if (nextProfile && !nextProfile.onboarding_completed) {
      nav("/onboarding", { replace: true });
      return;
    }
    nav(redirect, { replace: true });
  };

  // After Google OAuth returns to /auth with a session, continue into the app
  useEffect(() => {
    if (loading || !user) return;
    if (profile) {
      afterAuth(profile);
      return;
    }
    // Profile row may lag briefly after first Google signup
    const t = window.setTimeout(() => afterAuth(null), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id, profile?.id, profile?.onboarding_completed]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passwordOk && mode === "signup") {
      setError("Use at least 8 characters, including one number.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUpWithPassword(email, password, fullName);
        sessionStorage.removeItem("dady_auth_redirect");
        nav("/onboarding", { replace: true });
      } else {
        await signInWithPassword(email, password);
        afterAuth();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth-left">
        <Logo variant="auth" to="/" />
        <h2>Start creating with AI</h2>
        <div className="auth-benefits">
          {[
            ["✦", "Outcomes, not model settings", "Pick \"Product Ad\" or \"Reel\" and go."],
            ["₹", "Rupee pricing from ₹99", "UPI, cards, wallets, GST invoice."],
            ["अ", "Eight Indian languages", "Prompts and voiceovers in your language."],
          ].map(([i, t, d]) => (
            <div key={t} className="benefit">
              <div className="benefit-ico">{i}</div>
              <div>
                <strong>{t}</strong>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </div>
        <Placeholder label="showcase reel · creator outputs" height={220} style={{ borderRadius: 18 }} />
      </aside>

      <main className="auth-right">
        <div className="auth-tabs">
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
            Sign up
          </button>
          <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>
            Sign in
          </button>
        </div>

        <form className="auth-card" onSubmit={onSubmit}>
          <h3>{mode === "signup" ? "Create your account" : "Welcome back"}</h3>
          <p>No card needed. You only pay when you buy credits.</p>

          <Button
            type="button"
            block
            style={{ background: "#F2F4F8", color: "#08090D", boxShadow: "none" }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                // Redirects to Google; return handled when /auth loads with a session
                await signInWithGoogle();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Google sign-in failed");
                setBusy(false);
              }
            }}
          >
            Continue with Google
          </Button>

          <Button
            type="button"
            block
            variant="ghost"
            style={{ marginTop: 10 }}
            disabled={busy}
            onClick={async () => {
              setMode("signin");
              setEmail(DEMO_LOGIN.email);
              setPassword(DEMO_LOGIN.password);
              setError(null);
              setBusy(true);
              try {
                await signInWithPassword(DEMO_LOGIN.email, DEMO_LOGIN.password);
                nav(redirect, { replace: true });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Demo sign-in failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Use demo account
          </Button>

          <div className="or">
            <i />
            <span>or</span>
            <i />
          </div>

          {mode === "signup" ? (
            <>
              <div className="field-label">Full name</div>
              <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </>
          ) : null}

          <div className="field-label">Email</div>
          <input
            className="field"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <div className="field-label" style={{ marginTop: 14 }}>
            Password
          </div>
          <input
            className={`field${!passwordOk && password ? " error" : ""}`}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {!passwordOk && password ? (
            <div className="field-error">Use at least 8 characters, including one number.</div>
          ) : null}

          {error ? <div className="field-error">{error}</div> : null}

          <Button block style={{ marginTop: 20 }} disabled={busy}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            block
            style={{ marginTop: 10 }}
            disabled={busy || !email}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await signInWithOtp(email);
                setOtpSent(true);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not send OTP");
              } finally {
                setBusy(false);
              }
            }}
          >
            {otpSent ? "OTP email sent" : "Email me a magic link / OTP"}
          </Button>
        </form>
      </main>
    </div>
  );
}
