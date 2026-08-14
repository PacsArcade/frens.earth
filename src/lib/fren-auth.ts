import crypto from "crypto";
import { verifyEvent, nip19 } from "nostr-tools";
import { findHandleByNpub } from "./registry";

/**
 * Fren sessions — the arcade's persistent "you're in": sign a fresh
 * challenge with the key bound to your tag, get an HMAC cookie, and every
 * page's header knows you. No passwords, no accounts — the tag IS the
 * identity, exactly like the seat claim and the operator console.
 */

export const FREN_COOKIE = "pa-fren";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // a month — it's an arcade, not a bank
const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;

/** The npub door (W10/N0): a key that owns no tag can still walk in — the
    session's "space" is this reserved name and the "handle" is the npub
    itself. identity-config reserves the name forever; no registry space may
    ever take it, or key-only sessions would collide with tag sessions. */
export const NPUB_SPACE = "npub";

export function isNpubDoor(space: string): boolean {
  return space === NPUB_SPACE;
}

/** The exact rejection verifyFrenLogin gives an untagged key — the session
    route's cue to open the npub door instead. A constant, so the tag-holder
    path and its wording stay bit-for-bit unchanged. */
export const NO_TAG_REASON =
  "that key doesn't own a tag on the board — check which profile your signer is using, or register free";

function secret(): string {
  const s = process.env.SEAT_SECRET?.trim();
  if (!s) throw new Error("SEAT_SECRET not configured");
  return s;
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export async function verifyFrenLogin(
  event: {
    content?: string;
    pubkey?: string;
    sig?: string;
    kind?: number;
    created_at?: number;
    tags?: unknown;
    id?: string;
  },
  /** The host's space — a key holding tags behind both doors lands here. */
  preferSpace?: string
): Promise<{ ok: true; handle: string; space: string } | { ok: false; reason: string }> {
  if (!event?.content || !event.pubkey || !event.sig) {
    return { ok: false, reason: "signed challenge required" };
  }
  const m = event.content.match(/^PACS-LOGIN-(\d+)$/);
  if (!m) return { ok: false, reason: "not a login challenge" };
  if (Math.abs(Date.now() - Number(m[1])) > CHALLENGE_WINDOW_MS) {
    return { ok: false, reason: "challenge expired — sign a fresh one" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!verifyEvent(event as any)) {
    return { ok: false, reason: "signature check failed" };
  }
  const npub = nip19.npubEncode(event.pubkey);
  const owner = await findHandleByNpub(npub, preferSpace);
  if (!owner) {
    return { ok: false, reason: NO_TAG_REASON };
  }
  return { ok: true, ...owner };
}

/**
 * The npub door's verifier — the SAME challenge checks as verifyFrenLogin
 * (fresh PACS-LOGIN, real signature) MINUS the registry lookup: any valid
 * key gets in as itself. Kind is pinned to 22242 (NIP-42 style) so a signed
 * note can never double as a login.
 */
export function verifyNpubLogin(event: {
  content?: string;
  pubkey?: string;
  sig?: string;
  kind?: number;
  created_at?: number;
  tags?: unknown;
  id?: string;
}): { ok: true; npub: string } | { ok: false; reason: string } {
  if (!event?.content || !event.pubkey || !event.sig) {
    return { ok: false, reason: "signed challenge required" };
  }
  if (event.kind !== 22242) {
    return { ok: false, reason: "not a login challenge" };
  }
  const m = event.content.match(/^PACS-LOGIN-(\d+)$/);
  if (!m) return { ok: false, reason: "not a login challenge" };
  if (Math.abs(Date.now() - Number(m[1])) > CHALLENGE_WINDOW_MS) {
    return { ok: false, reason: "challenge expired — sign a fresh one" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!verifyEvent(event as any)) {
    return { ok: false, reason: "signature check failed" };
  }
  return { ok: true, npub: nip19.npubEncode(event.pubkey) };
}

/* Npub-door tokens reuse this exact grammar: handle = the npub itself,
   space = NPUB_SPACE. Bech32 npubs are [a-z0-9] with no dots, so
   parseToken's `.`-split grammar holds untouched.
   N1 law: every edit API derives the npub from THIS cookie token
   server-side and compares it to the target path npub — never trust a
   client-sent npub. */
export function makeFrenToken(handle: string, space: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  return `${handle}.${space}.${exp}.${hmac(`${handle}|${space}|${exp}`)}`;
}

/* The cookie can carry SEVERAL tokens joined by "~" (a legal cookie-value
   char; tokens themselves only use [a-z0-9-.]). First token = the active
   door. One key, two tags, zero re-signing — the door switcher. */
const TOKEN_JOIN = "~";
/* 8 doors: real frens carry many tags (the admiral tests with 6–7). Tokens
   are ~100 bytes each — 8 stays comfortably under the 4KB cookie ceiling. */
export const MAX_SESSIONS = 8;

function parseToken(raw: string): { handle: string; space: string } | null {
  const [handle, space, exp, sig] = raw.split(".");
  if (!handle || !space || !exp || !sig) return null;
  if (Date.now() > Number(exp)) return null;
  const expected = hmac(`${handle}|${space}|${exp}`);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return { handle, space };
}

/** Every valid session in the cookie, in order (first = active). */
export function sessionsFromRequest(
  request: Request
): { token: string; handle: string; space: string }[] {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${FREN_COOKIE}=([^;]+)`));
  if (!match) return [];
  const out: { token: string; handle: string; space: string }[] = [];
  for (const raw of match[1].split(TOKEN_JOIN)) {
    const fren = parseToken(raw);
    if (fren && !out.some((o) => o.handle === fren.handle && o.space === fren.space)) {
      out.push({ token: raw, ...fren });
    }
  }
  return out.slice(0, MAX_SESSIONS);
}

/** Join tokens back into one cookie value (first = active). */
export function joinSessionTokens(tokens: string[]): string {
  return tokens.slice(0, MAX_SESSIONS).join(TOKEN_JOIN);
}

export function frenFromRequest(request: Request): { handle: string; space: string } | null {
  const sessions = sessionsFromRequest(request);
  return sessions.length ? { handle: sessions[0].handle, space: sessions[0].space } : null;
}
