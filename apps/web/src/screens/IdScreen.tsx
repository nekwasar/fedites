/**
 * Digital alumni ID v1 (1.3): in-app proof card with QR linking to the
 * member's profile. Signature surface, family-skinned via tokens only.
 */
import React, { useEffect, useState } from "react";
import { Api } from "../api.js";
import { Empty } from "./InboxScreen.js";
import type { IdCard } from "@fedites/config";

export function IdScreen({ ssrData }: { ssrData?: { card?: IdCard } }): React.ReactElement {
  const [card, setCard] = useState<IdCard | null>(ssrData?.card ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ssrData?.card === undefined) Api.idCard().then(setCard).catch((e: Error) => setError(e.message));
  }, []);

  if (error !== null) return <Empty title="Sign in to see your ID" body="Your alumni ID appears after you sign in." />;
  if (card === null) return <main className="screen-pad" />;

  return (
    <main style={{ paddingBottom: 96 }}>
      <h1 className="screen-title">Alumni ID</h1>
      <div style={{ padding: "0 16px" }}>
        <div
          style={{
            border: "2px solid var(--c-accent)",
            background: "var(--c-base)",
            color: "var(--c-base-contrast)",
          }}
          aria-label="Digital alumni ID card"
        >
          <div style={{ padding: "16px", borderBottom: "1px solid var(--c-hairline)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ font: "700 22px var(--font-masthead)", color: "var(--c-accent)" }}>{card.card.school}</span>
            <span className="micro">Alumni ID</span>
          </div>
          <div style={{ display: "flex", gap: 16, padding: 16, alignItems: "flex-start" }}>
            <div
              style={{ width: 96, height: 96, background: "var(--c-accent)", color: "var(--c-accent-contrast)", display: "flex", alignItems: "center", justifyContent: "center", font: "700 40px var(--font-masthead)", flexShrink: 0 }}
              aria-hidden="true"
            >
              {card.card.holder.slice(0, 1)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: "700 17px var(--font-ui)" }}>{card.card.holder}</div>
              <div className="tabular" style={{ font: "13px var(--font-ui)", marginTop: 4 }}>
                {card.card.setYear !== null ? `Set '${String(card.card.setYear).slice(-2)}` : "Set unassigned"}
                {card.card.house !== null ? ` · ${card.card.house}` : ""}
              </div>
              <div className="micro" style={{ marginTop: 8 }}>{card.card.verification}</div>
              <div className="micro tabular" style={{ marginTop: 4 }}>Member since {new Date(card.card.memberSince).getFullYear()}</div>
            </div>
            <div style={{ width: 88, height: 88, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: card.qrSvg }} />
          </div>
        </div>
        <p style={{ font: "13px var(--font-ui)", color: "var(--c-neutral-500)" }}>
          The QR code opens your profile for venue check-ins. Your contact details stay private (K1).
        </p>
      </div>
    </main>
  );
}
