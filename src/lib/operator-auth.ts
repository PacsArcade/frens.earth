import crypto from "crypto";
import { verifyEvent, nip19 } from "nostr-tools";

/**
 * Operator auth — ported from pacsarcade-org's console-auth: the operator IS
 * a key, not a password. Sign-in = signing a fresh challenge with a key on
 * the OPERATOR_NPUBS allowlist (comma-separated env). The session is an HMAC
 * token in an httpOnly cookie; nothing to breach but the operator's own key
 * hygiene. Same wire contract as the org console (PACS-CONSOLE-<ts>) — auth
 * strings are shared constants, not branding.
 *
 * This gates the frens.earth admin side (the brand tester today; the SCAR
 * portal when it lands).
 */

export const OPERATOR_COOKIE = "fe-operator";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;

function secret(): string {
  const s = process.env.SEAT_SECRET?.trim();
  if (!s) throw new Error("SEAT_SECRET not configured");
  return s;
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function operatorHexKeys(): string[] {
  return (process.env.OPERATOR_NPUBS ?? "")
    .split(",")
    .map((npub) => {
      try {
        const d = nip19.decode(npub.trim());
        return d.type === "npub" ? (d.data as string) : null;
      } catch {
        return null;
      }
    })
    .filter((k): k is string => !!k);
}

/** True when the deployment has at least one valid operator key configured. */
export function operatorsConfigured(): boolean {
  return operatorHexKeys().length > 0;
}

/** Is this npub on the operator allowlist? Eligibility only — the gate still
    demands a fresh signature. Lets the menu show the admiral their door even
    before the operator session exists (the lost-admin-item lesson). */
export function isOperatorNpub(npub: string): boolean {
  try {
    const d = nip19.decode(npub);
    return d.type === "npub" && operatorHexKeys().includes(d.data as string);
  } catch {
    return false;
  }
}

/** Login event contract: kind 22242, content `PACS-CONSOLE-<unix-ms>` fresh
    within 5 minutes, signed by an allowlisted key. */
export function verifyOperatorLogin(event: {
  content?: string;
  pubkey?: string;
  sig?: string;
  kind?: number;
  created_at?: number;
  tags?: unknown;
  id?: string;
}): { ok: true; pubkey: string } | { ok: false; reason: string } {
  if (!event?.content || !event.pubkey || !event.sig) {
    return { ok: false, reason: "signed challenge required" };
  }
  const m = event.content.match(/^PACS-CONSOLE-(\d+)$/);
  if (!m) return { ok: false, reason: "not a console challenge" };
  if (Math.abs(Date.now() - Number(m[1])) > CHALLENGE_WINDOW_MS) {
    return { ok: false, reason: "challenge expired — sign a fresh one" };
  }
  if (!operatorHexKeys().includes(event.pubkey)) {
    return { ok: false, reason: "that key isn't on this site's operator list" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!verifyEvent(event as any)) {
    return { ok: false, reason: "signature check failed" };
  }
  return { ok: true, pubkey: event.pubkey };
}

export function makeOperatorToken(pubkey: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  return `${pubkey}.${exp}.${hmac(`${pubkey}|${exp}`)}`;
}

export function verifyOperatorToken(token: string | undefined): string | null {
  if (!token) return null;
  const [pubkey, exp, sig] = token.split(".");
  if (!pubkey || !exp || !sig) return null;
  if (Date.now() > Number(exp)) return null;
  const expected = hmac(`${pubkey}|${exp}`);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return operatorHexKeys().includes(pubkey) ? pubkey : null;
}

/** Pulls the operator pubkey from a cookie header value, or null. */
export function operatorFromCookieHeader(cookieHeader: string | null): string | null {
  const match = (cookieHeader ?? "").match(new RegExp(`${OPERATOR_COOKIE}=([^;]+)`));
  return verifyOperatorToken(match?.[1]);
}
