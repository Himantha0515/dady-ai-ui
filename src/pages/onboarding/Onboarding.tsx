import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { Button } from "../../components/ui";
import { useAuth } from "../../lib/auth/context";

export function Onboarding() {
  const { profile, completeOnboarding } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding({ full_name: name, phone });
      nav("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-main" style={{ maxWidth: 480, margin: "72px auto" }}>
      <Logo variant="hero" to="/" />
      <h1 style={{ marginTop: 18 }}>Welcome to DaDy&apos;s.ai</h1>
      <p style={{ color: "var(--text-muted)" }}>A few details so we can personalise your workspace.</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
        <label>
          <div className="field-label">Full name</div>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          <div className="field-label">Phone (optional)</div>
          <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {error ? <div className="field-error">{error}</div> : null}
        <Button variant="lime" disabled={busy}>
          {busy ? "Saving…" : "Continue to dashboard"}
        </Button>
      </form>
    </div>
  );
}

export function Forbidden() {
  return (
    <div className="app-main" style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
      <h1>403</h1>
      <p style={{ color: "var(--text-muted)" }}>You don’t have access to this area.</p>
      <Button variant="lime" onClick={() => (window.location.href = "/app")}>
        Go to dashboard
      </Button>
    </div>
  );
}
