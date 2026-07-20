"use client";

import { useState } from "react";
import EarthFooter from "@/components/EarthFooter";
import SignerDoors from "@/components/SignerDoors";

/**
 * The admin door — same trust model as everything else here: the operator IS
 * a key. Sign a fresh challenge with an allowlisted key (OPERATOR_NPUBS) and
 * the admin side opens. No password, nothing stored, nothing to leak.
 * Mobile parity (Module 6): the same challenge signs through a remote
 * signer or an Android signer app — the artist's shelf works from a phone.
 */
export default function OperatorGate({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* One submit path for every door — extension, bunker, Android signer. */
  async function submitConsole(event: unknown): Promise<string | null> {
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      let data: { ok?: boolean; reason?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        /* non-JSON = the server fell over, not the key */
      }
      if (!res.ok || !data?.ok) {
        return (
          data?.reason ?? `the server hiccuped (HTTP ${res.status}) — your key is fine; check the deployment env`
        );
      }
      window.location.reload();
      return null;
    } catch {
      return "couldn't reach the server — check your connection and try again";
    }
  }

  async function verify() {
    setError(null);
    if (!window.nostr) {
      setError("no signer extension in this browser — use the phone doors below, or install nos2x / Alby");
      return;
    }
    setBusy(true);
    /* signer rejection = the operator's call; a server fault = ours. Never
       blame the key for a 500 (the SEAT_SECRET lesson). */
    let event;
    try {
      event = await window.nostr.signEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `PACS-CONSOLE-${Date.now()}`,
      });
    } catch {
      setError("signing was declined — nothing sent");
      setBusy(false);
      return;
    }
    const reason = await submitConsole(event);
    if (reason) setError(reason);
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen flex-col console-ground">
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="console-card w-full max-w-md p-8 text-center" data-accent="cyan">
          <p className="lcars-eyebrow mb-4 justify-center" data-accent="cyan">
            ADMIN SIDE · OPERATORS
          </p>
          <h1 className="mb-4 font-arcade text-3xl text-cyan glow-cyan">TRUST, VERIFIED</h1>
          <p className="mb-6 font-body text-sm text-white/70">
            This side of the earth is for operators. Sign a fresh challenge with an
            operator key and step through — we don&apos;t ask who you are, we verify it.
          </p>
          {configured ? (
            <>
              <button
                onClick={verify}
                disabled={busy}
                className="btn-pill btn-pill--solid min-h-11 w-full touch-manipulation"
                data-accent="cyan"
              >
                {busy ? "READING YOUR SIGNATURE…" : "▶ VERIFY OPERATOR KEY"}
              </button>
              <details className="mt-4 text-left">
                <summary className="cursor-pointer font-pixel text-[9px] uppercase text-white/50">
                  ON A PHONE, OR NO EXTENSION HERE? MORE DOORS ▸
                </summary>
                <div className="mt-3">
                  <SignerDoors kind="console" submit={submitConsole} />
                </div>
              </details>
            </>
          ) : (
            <p
              className="console-card p-4 font-pixel text-[10px] uppercase leading-relaxed text-cyan"
              data-accent="cyan"
            >
              NO OPERATOR KEYS CONFIGURED — SET{" "}
              <span className="text-white/80">OPERATOR_NPUBS</span> IN THE DEPLOYMENT ENV
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
