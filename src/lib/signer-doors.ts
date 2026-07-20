"use client";

import { generateSecretKey, getPublicKey, type EventTemplate, type VerifiedEvent } from "nostr-tools/pure";
import {
  parseBunkerInput,
  createNostrConnectURI,
  BunkerSigner,
  type BunkerSignerParams,
} from "nostr-tools/nip46";

/**
 * The mobile signer doors (spec: Module 6 / S1.5) — three ways to sign the
 * SAME challenge, one session model:
 *
 * - NIP-07: the desktop extension (window.nostr) — the existing door.
 * - NIP-46: a remote signer / bunker — works on iOS and any browser. The
 *   fren's key lives in the bunker; we hold only a throwaway CLIENT key for
 *   the encrypted conversation, generated per sign-in and dropped after.
 * - NIP-55: Android signer apps (Amber-class) via the nostrsigner: scheme —
 *   the browser bounces to the signer app, the fren approves, the app
 *   bounces back with the signed event.
 *
 * Every door produces the same signed 22242 challenge and submits to the
 * same endpoint — the server's verification logic doesn't know or care
 * which door signed. Keys never touch this app on ANY platform (house law).
 */

export type ChallengeKind = "login" | "console";

export const CHALLENGE_ENDPOINT: Record<ChallengeKind, string> = {
  login: "/api/frens/session",
  console: "/api/admin/session",
};

/** The SAME challenge the NIP-07 path signs — built at sign time so the
    5-minute freshness window starts when the fren acts, not when the page
    loaded. */
export function challengeTemplate(kind: ChallengeKind): EventTemplate {
  const label = kind === "console" ? "PACS-CONSOLE" : "PACS-LOGIN";
  return {
    kind: 22242,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: `${label}-${Date.now()}`,
  };
}

// ---------------------------------------------------------------------------
// NIP-46 — remote signer / bunker
// ---------------------------------------------------------------------------

/** Relays a client-generated nostrconnect:// invite listens on. The bunker
    paste path doesn't use these — bunker:// URIs carry their own relays. */
const NOSTRCONNECT_RELAYS = ["wss://relay.nsec.app", "wss://relay.damus.io"];

/** How long we wait for a bunker to answer before calling it honestly dead. */
const BUNKER_TIMEOUT_MS = 120_000;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} didn't answer in ${ms / 1000}s`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/**
 * Paste path: a bunker:// URI or a name@domain NIP-05 → connect → sign the
 * challenge. The template is built AFTER the connect handshake so a slow
 * approval in the bunker app can't expire the challenge.
 */
export async function signViaBunker(
  input: string,
  kind: ChallengeKind,
  onauth?: (url: string) => void
): Promise<VerifiedEvent> {
  const bp = await parseBunkerInput(input.trim());
  if (!bp) {
    throw new Error("that doesn't read as a bunker:// address or a name@domain signer");
  }
  const clientKey = generateSecretKey(); // throwaway conversation key — never the fren's
  const params: BunkerSignerParams = onauth ? { onauth } : {};
  const signer = BunkerSigner.fromBunker(clientKey, bp, params);
  try {
    await withTimeout(signer.connect(), BUNKER_TIMEOUT_MS, "the bunker");
    return await withTimeout(
      signer.signEvent(challengeTemplate(kind)),
      BUNKER_TIMEOUT_MS,
      "the bunker"
    );
  } finally {
    signer.close().catch(() => {});
  }
}

export interface NostrConnectInvite {
  /** nostrconnect:// URI — tap it (same phone) or paste it into the signer. */
  uri: string;
  /** Resolves with the signed challenge once a signer answers and signs. */
  signed: Promise<VerifiedEvent>;
  /** Stop waiting (door closed, fren changed their mind). */
  cancel: () => void;
}

/**
 * Invite path: WE mint the nostrconnect:// URI, the signer app scans/opens
 * it and calls back over the relay. Same challenge, same endpoint.
 */
export function startNostrConnect(kind: ChallengeKind, onauth?: (url: string) => void): NostrConnectInvite {
  const clientKey = generateSecretKey();
  const secretBytes = new Uint8Array(16);
  crypto.getRandomValues(secretBytes);
  const secret = Array.from(secretBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const uri = createNostrConnectURI({
    clientPubkey: getPublicKey(clientKey),
    relays: NOSTRCONNECT_RELAYS,
    secret,
    perms: ["sign_event:22242"],
    name: "frens.earth",
    url: typeof location !== "undefined" ? location.origin : undefined,
  });
  const abort = new AbortController();
  const params: BunkerSignerParams = onauth ? { onauth } : {};
  const signed = (async () => {
    const signer = await BunkerSigner.fromURI(clientKey, uri, params, abort.signal);
    try {
      return await withTimeout(
        signer.signEvent(challengeTemplate(kind)),
        BUNKER_TIMEOUT_MS,
        "your signer"
      );
    } finally {
      signer.close().catch(() => {});
    }
  })();
  return { uri, signed, cancel: () => abort.abort() };
}

// ---------------------------------------------------------------------------
// NIP-55 — Android signer apps (Amber-class), nostrsigner: scheme
// ---------------------------------------------------------------------------

/** The only platform where a mobile BROWSER can hand an event to a signer
    app and get it back — the nostrsigner: scheme is an Android intent.
    iOS offers no equivalent; that's why the remote-signer door exists. */
export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

/**
 * Build the nostrsigner: URI for the challenge. The signer app appends the
 * signed event to callbackUrl and reopens the browser there — our
 * /login/signer-return page catches it and submits to the same endpoint.
 * (nostr-tools ships a nip55 module but doesn't export it from the package;
 * the URI contract is small enough to state here honestly.)
 */
export function nip55SignUri(kind: ChallengeKind, next?: string): string {
  const event = challengeTemplate(kind);
  const ret = new URL("/login/signer-return", location.origin);
  ret.searchParams.set("door", kind);
  if (next) ret.searchParams.set("next", next);
  /* the signer appends its answer right after `event=` */
  const callbackUrl = `${ret.toString()}&event=`;
  const params = new URLSearchParams({
    compressionType: "none",
    returnType: "event",
    type: "sign_event",
    appName: "frens.earth",
    callbackUrl,
  });
  return `nostrsigner:${encodeURIComponent(JSON.stringify(event))}?${params.toString()}`;
}
