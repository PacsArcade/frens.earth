"use client";

import { useState } from "react";
import EarthFooter from "@/components/EarthFooter";

/**
 * The admin door — same trust model as everything else here: the operator IS
 * a key. Sign a fresh challenge with an allowlisted key (OPERATOR_NPUBS) and
 * the admin side opens. No password, nothing stored, nothing to leak.
 */
export default function OperatorGate({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setError(null);
    if (!window.nostr) {
      setError("no signer extension found — install nos2x or Alby, then try again");
      return;
    }
    setBusy(true);
    try {
      const event = await window.nostr.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `PACS-CONSOLE-${Date.now()}`,
      });
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.reason ?? "that didn't verify");
        return;
      }
      window.location.reload();
    } catch {
      setError("signing was declined — nothing sent");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-void">
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md border-2 border-edge bg-panel p-8 text-center">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            FRENS.EARTH ▸ ADMIN SIDE
          </p>
          <h1 className="mb-4 font-arcade text-3xl text-cyan glow-cyan">TRUST, VERIFIED</h1>
          <p className="mb-6 font-body text-sm text-white/70">
            This side of the earth is for operators. Sign a fresh challenge with an
            operator key and step through — we don&apos;t ask who you are, we verify it.
          </p>
          {configured ? (
            <button onClick={verify} disabled={busy} className="button w-full">
              {busy ? "READING YOUR SIGNATURE…" : "▶ VERIFY OPERATOR KEY"}
            </button>
          ) : (
            <p className="border-2 border-coin/60 bg-coin/5 p-4 font-pixel text-[10px] uppercase leading-relaxed text-coin">
              NO OPERATOR KEYS CONFIGURED — SET{" "}
              <span className="text-cyan">OPERATOR_NPUBS</span> IN THE DEPLOYMENT ENV
              (COMMA-SEPARATED NPUBS), THEN RELOAD
            </p>
          )}
          {error && (
            <p className="mt-4 font-pixel text-[10px] uppercase text-ghost">{error}</p>
          )}
        </div>
      </div>
      <EarthFooter />
    </main>
  );
}
