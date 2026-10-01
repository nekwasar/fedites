/**
 * Unauthenticated landing (§P: the public web is minimal — about + request
 * invite, no member content) + the app-choice prompt.
 *
 * - Landing = brand, one line about, Sign in / Join. No shell chrome at all.
 * - AppChoiceSheet (mobile only — desktop skips entirely): bottom sheet (E10:
 *   sheets, not modals, on phones) over a scrim; interaction blocked until
 *   chosen; "Continue in web" is the always-neutral one-tap decline (K5);
 *   choice is remembered and never re-nags; "Install the app" fires the real
 *   PWA install prompt (Android/Chrome) — store URLs arrive in Phase 7.
 * - a11y (L5): Esc = decline, focus lands on the sheet, aria-modal.
 * - Motion (F2/F9): transform-only slide-up; reduced-motion honored.
 */
import React, { useEffect, useState } from "react";

const CHOICE_KEY = "fedites.appChoice";
const DESKTOP_MIN = 1024;

interface PwaInstallEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

export function LandingScreen({ boot, onSignedIn }: {
  boot: { brand: string; about: string } | null;
  onSignedIn: (pendingRoute: string) => void;
}): React.ReactElement {
  const [form, setForm] = useState<"none" | "signin" | "join">("none");
  const [pendingRoute, setPendingRoute] = useState("/");

  // A deep link lands back here after sign-in.
  useEffect(() => {
    const saved = window.sessionStorage.getItem("fedites.pendingRoute");
    if (saved !== null) setPendingRoute(saved);
  }, []);

  const start = (mode: "signin" | "join"): void => {
    setPendingRoute(window.location.pathname);
    window.sessionStorage.setItem("fedites.pendingRoute", window.location.pathname);
    setForm(mode);
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "24px 16px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="crest-block" aria-hidden="true">{(boot?.brand ?? "F").slice(0, 1)}</span>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ font: "700 22px var(--font-masthead)", color: "var(--c-accent)" }}>{boot?.brand ?? "Fedites"}</span>
          <span className="masthead-sub">alumni community</span>
        </span>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 420, width: "100%", margin: "0 auto" }}>
        {form === "none" ? (
          <>
            <h1 style={{ font: "700 32px var(--font-ui)", lineHeight: "38px", letterSpacing: "-0.02em", margin: "0 0 8px" }}>
              Welcome home.
            </h1>
            <p style={{ font: "15px var(--font-ui)", color: "var(--c-neutral-500)", margin: "0 0 24px" }}>
              {boot?.about ?? "One school, one community. Reconnect, belong, and give back."}
            </p>
            <button type="button" className="btn btn--filled press" onClick={() => start("signin")}>Sign in</button>
            <button type="button" className="btn btn--outlined press" style={{ marginTop: 8 }} onClick={() => start("join")}>
              Join with invite code
            </button>
            <p className="micro" style={{ marginTop: 16 }}>
              Membership is by invite from a verified member.
            </p>
          </>
        ) : (
          <AuthForm initial={form} onDone={() => onSignedIn(pendingRoute)} />
        )}
      </div>

      <footer className="micro" style={{ textAlign: "center", paddingBottom: 8 }}>
        {(boot?.brand ?? "Fedites")} — one school, one community. Member content stays private.
      </footer>
    </main>
  );
}

import { AuthScreen } from "./AuthScreen.js";

function AuthForm({ initial, onDone }: { initial: "signin" | "join"; onDone: () => void }): React.ReactElement {
  return <AuthScreen onDone={onDone} initial={initial} />;
}

/** Mobile-only app-choice sheet. Desktop never shows it (skipped entirely). */
export function AppChoiceSheet(): React.ReactElement | null {
  const [show, setShow] = useState(false);
  const [install, setInstall] = useState<PwaInstallEvent | null>(null);
  const [instructions, setInstructions] = useState(false);

  useEffect(() => {
    if (window.innerWidth < DESKTOP_MIN) {
      if (window.localStorage.getItem(CHOICE_KEY) === null) {
        const t = setTimeout(() => setShow(true), 600);
        return () => clearTimeout(t);
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event): void => {
      e.preventDefault();
      setInstall(e as PwaInstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!show) return;
    const esc = (e: KeyboardEvent): void => {
      if (e.key === "Escape") decline();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [show]);

  const decline = (): void => {
    window.localStorage.setItem(CHOICE_KEY, "web");
    setShow(false);
  };

  const installApp = (): void => {
    window.localStorage.setItem(CHOICE_KEY, "app");
    if (install !== null) {
      void install.prompt();
      void install.userChoice.finally(() => setShow(false));
      return;
    }
    // No native prompt (e.g. iOS Safari): show the one-line instruction.
    setInstructions(true);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Get the app or continue on the web"
      onClick={decline}
      style={{ position: "fixed", inset: 0, background: "var(--c-scrim)", zIndex: 80, display: "flex", alignItems: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", background: "var(--c-base)", borderTop: "2px solid var(--c-accent)",
          padding: 24, animation: "fedites-sheet-up 220ms ease-out",
        }}
      >
        <h2 style={{ font: "700 22px var(--font-ui)", margin: "0 0 4px" }}>Carry the community in your pocket</h2>
        <p style={{ font: "15px var(--font-ui)", color: "var(--c-neutral-500)", margin: "0 0 16px" }}>
          Install the app, or keep using this page — both work.
        </p>
        {instructions && (
          <p className="micro" style={{ margin: "0 0 12px" }}>
            On this phone: use your browser menu → "Add to Home Screen". The Play Store listing arrives at launch.
          </p>
        )}
        <button type="button" className="btn btn--filled press" onClick={installApp}>Install the app</button>
        <button type="button" className="btn btn--outlined press" style={{ marginTop: 8 }} onClick={decline}>
          Continue in web
        </button>
      </div>
      <style>{`
        @keyframes fedites-sheet-up {
          from { transform: translateY(100%); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="fedites-sheet-up"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
