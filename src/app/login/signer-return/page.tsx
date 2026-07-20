"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { applyFrenSession } from "@/hooks/useFrenSession";
import { CHALLENGE_ENDPOINT } from "@/lib/signer-doors";

/**
 * The NIP-55 landing strip — an Android signer app (Amber-class) signed our
 * challenge and bounced the browser back here with the event in the query.
 * We submit it to the SAME endpoint the other doors use and walk through.
 * The signed challenge is the auth; this page is just the courier.
 */

function SignerReturn() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  const door = params.get("door") === "console" ? "console" : "login";
  const rawEvent = params.get("event");
  const rawNext = params.get("next");
  /* same-origin paths only — a callback param is not a teleporter */
  const next = rawNext && /^\/(?!\/)/.test(rawNext) ? rawNext : null;

  useEffect(() => {
    if (ran.current) return; // one submission per landing, StrictMode included
    ran.current = true;
    async function deliver() {
      if (!rawEvent) {
        setError("no signed event arrived — the signer app sent nothing back");
        return;
      }
      let event: unknown;
      try {
        event = JSON.parse(rawEvent);
      } catch {
        setError("the signer's answer didn't parse — try the door again");
        return;
      }
      try {
        const res = await fetch(CHALLENGE_ENDPOINT[door], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event }),
        });
        let data: { ok?: boolean; reason?: string; handle?: string; space?: string; npub?: string | null } | null =
          null;
        try {
          data = await res.json();
        } catch {
          /* non-JSON = the server fell over, not the fren */
        }
        if (!res.ok || !data?.ok) {
          setError(
            data?.reason ??
              `the arcade server hiccuped (HTTP ${res.status}) — your signature was fine; tell the operator`
          );
          return;
        }
        if (door === "console") {
          /* operator cookie is set — a hard nav lets the /a layout re-read it */
          window.location.replace(next ?? "/a");
          return;
        }
        applyFrenSession({ handle: data.handle!, space: data.space!, npub: data.npub ?? null });
        router.replace(next ?? `/u/${data.handle}@${data.space}`);
      } catch {
        setError("couldn't reach the arcade — check your connection and try again");
      }
    }
    void deliver();
  }, [door, next, rawEvent, router]);

  return (
    <div className="mx-auto w-full max-w-md border-2 border-cyan/40 bg-panel p-6 text-center">
      {error ? (
        <>
          <p className="mb-3 font-pixel text-[10px] uppercase text-ghost">{error}</p>
          <Link
            href={door === "console" ? "/a" : "/login"}
            className="font-pixel text-[10px] uppercase text-cyan underline"
          >
            ◀ BACK TO THE DOOR
          </Link>
        </>
      ) : (
        <p className="font-pixel text-[10px] uppercase text-cyan glow-cyan">
          READING YOUR SIGNATURE…
        </p>
      )}
    </div>
  );
}

export default function SignerReturnPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-void px-6">
      <Suspense fallback={null}>
        <SignerReturn />
      </Suspense>
    </main>
  );
}
