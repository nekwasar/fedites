/**
 * Auth screens (1.1/1.2): invite-code signup (code -> profile -> set claim)
 * and sign-in with optional 2FA. Typographic, hairline, no emojis (D1/G4).
 */
import React, { useState } from "react";
import { Api, ApiError } from "../api.js";

export function AuthScreen({ onDone }: { onDone: () => void }): React.ReactElement {
  const [mode, setMode] = useState<"signin" | "join">("signin");

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 96 }}>
      <h1 className="screen-title">{mode === "signin" ? "Sign in" : "Join with your invite code"}</h1>
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--c-hairline)", marginBottom: 8 }}>
        {(["signin", "join"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className="press"
            onClick={() => setMode(m)}
            style={{
              minHeight: 44, flex: 1, background: "transparent", border: "none",
              borderBottom: mode === m ? "2px solid var(--c-accent)" : "2px solid transparent",
              color: mode === m ? "var(--c-accent)" : "var(--c-neutral-600)",
              font: "600 13px var(--font-ui)", cursor: "pointer",
            }}
          >
            {m === "signin" ? "Sign in" : "New member"}
          </button>
        ))}
      </div>
      {mode === "signin" ? <SignIn onDone={onDone} /> : <Join onDone={onDone} />}
    </main>
  );
}

function fieldStyle(): React.CSSProperties {
  return {
    width: "100%", minHeight: 44, padding: "0 12px", marginBottom: 12,
    border: "none", borderBottom: "1px solid var(--c-hairline)",
    background: "transparent", color: "var(--c-base-contrast)", font: "15px var(--font-ui)",
  };
}

function SignIn({ onDone }: { onDone: () => void }): React.ReactElement {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await Api.login({ email, password, totp: needsTotp ? totp : undefined });
      onDone();
    } catch (err) {
      const apiErr = err as ApiError;
      if ((err as { message?: string }).message === "totp-required" || apiErr.status === 401 && /code/i.test(apiErr.message)) setNeedsTotp(true);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)}>
      <input style={fieldStyle()} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" required />
      <input style={fieldStyle()} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" required />
      {needsTotp && (
        <input style={fieldStyle()} inputMode="numeric" placeholder="6-digit authentication code" value={totp} onChange={(e) => setTotp(e.target.value)} aria-label="Authentication code" />
      )}
      {error && <p style={{ color: "var(--c-danger)", font: "13px var(--font-ui)" }}>{error}</p>}
      <button type="submit" className="btn btn--filled press" disabled={busy}>{busy ? "Signing in" : "Sign in"}</button>
    </form>
  );
}

function Join({ onDone }: { onDone: () => void }): React.ReactElement {
  const [step, setStep] = useState<"code" | "profile" | "done">("code");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setYear, setSetYear] = useState("");
  const [error, setError] = useState<string | null>(null);

  const claimCode = (e: React.FormEvent): void => {
    e.preventDefault();
    if (code.trim().length >= 4) setStep("profile");
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    try {
      await Api.signup({
        inviteCode: code.trim(),
        email,
        password,
        displayName,
        setYear: setYear ? Number(setYear) : undefined,
      });
      setStep("done");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (step === "done") {
    return (
      <div className="empty">
        <h2>Application received</h2>
        <p>Your setmates and the admins have been asked to confirm you. Sign in to read the community while you wait.</p>
        <button type="button" className="btn btn--filled press" onClick={onDone}>Sign in</button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={claimCode}>
        <input style={fieldStyle()} placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Invite code" required />
        <p style={{ font: "13px var(--font-ui)", color: "var(--c-neutral-500)" }}>
          Signup needs an invite code from a verified member. Accounts stay limited until three setmates identify you or an admin confirms.
        </p>
        <button type="submit" className="btn btn--filled press">Continue</button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <input style={fieldStyle()} placeholder="Full name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label="Full name" required minLength={2} />
      <input style={fieldStyle()} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" required />
      <input style={fieldStyle()} type="password" placeholder="Password (10+ characters, letters and numbers)" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" required minLength={10} />
      <input style={fieldStyle()} inputMode="numeric" placeholder="Your set year, e.g. 1998 (optional)" value={setYear} onChange={(e) => setSetYear(e.target.value)} aria-label="Set year" />
      {error && <p style={{ color: "var(--c-danger)", font: "13px var(--font-ui)" }}>{error}</p>}
      <button type="submit" className="btn btn--filled press">Create account</button>
    </form>
  );
}
