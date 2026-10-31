import { promises as fs } from "fs";
import path from "path";
import { kv, vaultConfigured } from "./private-store";

/**
 * AUTO-CONFIRM for Printful drafts (the Admiral's ruling, block 973,932:
 * "auto confirm daily cap"). Confirming a Printful draft is the one step
 * that spends the artist's Printful balance in dollars; since 973,932 the
 * settle path may do it by itself, but only when EVERY guard passes:
 *
 *   1. kill switch   PRINTFUL_AUTO_CONFIRM must be "on"
 *   2. cap set       PRINTFUL_AUTO_CONFIRM_DAILY_USD (dollars) > 0; unset/0 = OFF
 *   3. USD known     what the buyer paid is knowable in USD (a USD order, or
 *                    a sats order with a usable bitcoin rate)
 *   4. cost known    Printful's draft cost total was read from the draft
 *   5. cost covered  Printful cost <= what the buyer paid (sats orders keep
 *                    a safety margin, SATS_MARGIN, against rate drift)
 *   6. daily cap     today's (UTC) auto-confirmed total + this cost <= cap
 *
 * Any failed guard leaves the order a draft waiting for the operator's
 * click, exactly as before, and records WHY on `dropship.autoConfirm`.
 *
 * The decision is a pure function (decideAutoConfirm) so it is tested
 * offline. The daily total lives in the same private store the orders use:
 * - vault (Upstash REST / REDIS_URL): one key per UTC day, reserved with an
 *   atomic INCRBY and rolled back with DECRBY, so concurrent webhooks cannot
 *   jointly overshoot the cap.
 * - dev files (data/store-auto-confirm/<date>.json): read-modify-write, NOT
 *   atomic. Two simultaneous settles on a dev box could overshoot by one
 *   order's cost. Production runs on the vault, so this window is dev only.
 */

/** A sats order is valued at the live rate; require cost <= 95% of that so a
 *  falling bitcoin price between payment and confirm cannot make us lose. */
export const SATS_MARGIN = 0.95;

export interface AutoConfirmSettings {
  enabled: boolean;
  /** daily cap in USD cents; 0 = off */
  capUsdMinor: number;
}

/** Pure: read the two switches from an env-like object. */
export function autoConfirmSettings(env: Record<string, string | undefined> = process.env): AutoConfirmSettings {
  const on = (env.PRINTFUL_AUTO_CONFIRM ?? "").trim().toLowerCase() === "on";
  const dollars = Number((env.PRINTFUL_AUTO_CONFIRM_DAILY_USD ?? "").trim());
  const capUsdMinor = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0;
  return { enabled: on && capUsdMinor > 0, capUsdMinor };
}

export interface AutoConfirmDecisionInput {
  settings: AutoConfirmSettings;
  /** Printful's draft cost total, USD cents; null = not read */
  costUsdMinor: number | null;
  /** what the buyer paid, USD cents; null = cannot be determined reliably */
  paidUsdMinor: number | null;
  /** true when paidUsdMinor was derived from sats (margin applies) */
  paidFromSats: boolean;
  /** USD cents already auto-confirmed today (UTC) */
  usedTodayUsdMinor: number;
  /** dropship state right now */
  dropshipState: string | undefined;
  /** an auto-confirm decision already recorded on this order */
  alreadyDecided: boolean;
}

export type AutoConfirmDecision = { decision: "confirm" | "held"; reason: string };

const usd = (minor: number) => `$${(minor / 100).toFixed(2)}`;

/** Pure: should this draft be confirmed by the shop itself? */
export function decideAutoConfirm(i: AutoConfirmDecisionInput): AutoConfirmDecision {
  const held = (reason: string): AutoConfirmDecision => ({ decision: "held", reason });
  if (!i.settings.enabled) return held("auto-confirm is off");
  if (i.dropshipState !== "draft_created") return held(`drop-ship is "${i.dropshipState ?? "none"}", not a fresh draft`);
  if (i.alreadyDecided) return held("auto-confirm already decided for this order");
  if (i.costUsdMinor == null || i.costUsdMinor <= 0) return held("Printful draft cost was not readable");
  if (i.paidUsdMinor == null || i.paidUsdMinor <= 0) return held("the USD value of this order cannot be determined reliably");
  const ceiling = i.paidFromSats ? Math.floor(i.paidUsdMinor * SATS_MARGIN) : i.paidUsdMinor;
  if (i.costUsdMinor > ceiling) {
    return held(`Printful cost ${usd(i.costUsdMinor)} is above ${i.paidFromSats ? "the margin-adjusted " : ""}amount paid ${usd(ceiling)}`);
  }
  if (i.usedTodayUsdMinor + i.costUsdMinor > i.settings.capUsdMinor) {
    return held(`daily cap ${usd(i.settings.capUsdMinor)} would be exceeded (used ${usd(i.usedTodayUsdMinor)} + ${usd(i.costUsdMinor)})`);
  }
  return { decision: "confirm", reason: `cost ${usd(i.costUsdMinor)} covered and within the daily cap` };
}

/** Pure: the order's paid value in USD cents. USD orders are exact; SATS
 *  orders use the order's own stored rate (USD per BTC) if it has one, else
 *  the live rate passed in; neither = null (unknown, never a guess). */
export function paidUsdMinor(
  snapshot: { amount: number; currency: string; rate?: number },
  liveUsdPerBtc: number | null,
): { minor: number | null; fromSats: boolean } {
  if (snapshot.currency === "USD") return { minor: snapshot.amount, fromSats: false };
  if (snapshot.currency === "SATS") {
    const rate = snapshot.rate && snapshot.rate > 0 ? snapshot.rate : liveUsdPerBtc;
    if (!rate || !(rate > 0)) return { minor: null, fromSats: true };
    return { minor: Math.floor((snapshot.amount / 1e8) * rate * 100), fromSats: true };
  }
  return { minor: null, fromSats: false };
}

// ---------------------------------------------------------------------------
// The daily total (UTC day)
// ---------------------------------------------------------------------------

export const utcDay = (ms: number = Date.now()) => new Date(ms).toISOString().slice(0, 10);
const kvKey = (day: string) => `store:autoconfirm:${day}`;
const dayFile = (day: string) => path.join(process.cwd(), "data", "store-auto-confirm", `${day}.json`);

async function fileRead(day: string): Promise<number> {
  try {
    const n = Number(JSON.parse(await fs.readFile(dayFile(day), "utf8")).usedUsdMinor);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
async function fileWrite(day: string, n: number): Promise<void> {
  await fs.mkdir(path.dirname(dayFile(day)), { recursive: true });
  await fs.writeFile(dayFile(day), JSON.stringify({ day, usedUsdMinor: Math.max(0, n) }), "utf8");
}

/** USD cents auto-confirmed so far on this UTC day. */
export async function autoConfirmUsedToday(day: string = utcDay()): Promise<number> {
  if (vaultConfigured()) {
    const res = await kv(["GET", kvKey(day)]);
    const n = Number(res?.result ?? 0);
    return Number.isFinite(n) ? n : 0;
  }
  return fileRead(day);
}

/** Take `cost` of today's budget. Vault: atomic INCRBY, rolled back when it
 *  lands over the cap. Files: read-modify-write (documented window above). */
export async function reserveAutoConfirm(
  cost: number,
  capUsdMinor: number,
  day: string = utcDay(),
): Promise<{ ok: true } | { ok: false; used: number }> {
  if (vaultConfigured()) {
    const res = await kv(["INCRBY", kvKey(day), cost]);
    const total = Number(res?.result);
    if (!Number.isFinite(total)) return { ok: false, used: 0 };
    await kv(["EXPIRE", kvKey(day), 3 * 24 * 3600]);
    if (total > capUsdMinor) {
      await kv(["DECRBY", kvKey(day), cost]);
      return { ok: false, used: total - cost };
    }
    return { ok: true };
  }
  const used = await fileRead(day);
  if (used + cost > capUsdMinor) return { ok: false, used };
  await fileWrite(day, used + cost);
  return { ok: true };
}

/** Give a reservation back (the confirm call did not land). */
export async function releaseAutoConfirm(cost: number, day: string = utcDay()): Promise<void> {
  if (vaultConfigured()) {
    await kv(["DECRBY", kvKey(day), cost]);
    return;
  }
  await fileWrite(day, (await fileRead(day)) - cost);
}
