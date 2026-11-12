/**
 * Safe wrapper around the NIP-07 browser signer (window.nostr).
 *
 * Why it exists: a signer that logs in through a remote signer (NIP-46) waits
 * on a relay and can wait forever, and its own refusal text is the most useful
 * thing we can show. So every call here has a time limit, never throws, and
 * hands back the signer's own words.
 *
 * Gesture rule: some signers (Ditto) refuse a site's first call unless it
 * happens within ~500 ms of a trusted click. The signer function is therefore
 * invoked SYNCHRONOUSLY when one of these helpers is called. Call them straight
 * from the click handler with no await before them.
 */

export type Nip07Failure = {
  ok: false;
  /** missing = no window.nostr; timeout = no answer in time; signer = it refused or errored */
  kind: "missing" | "timeout" | "signer";
  message: string;
};
export type Nip07Result<T> = { ok: true; value: T } | Nip07Failure;

export type Nip07Options = {
  /** time limit in ms before we give up (default 90 s) */
  timeoutMs?: number;
  /** ms before onSlow fires (default 6 s) */
  hintMs?: number;
  /** called once if the signer has not answered after hintMs */
  onSlow?: () => void;
};

export const NIP07_TIMEOUT_MS = 90_000;
export const NIP07_HINT_MS = 6_000;
const MESSAGE_CAP = 160;

/* UI copy, one place, lower-case house voice */
export const NIP07_WAITING_HINT =
  "waiting on your signer. if you sign with a phone app or a remote signer, approve it there.";
export const NIP07_TIMEOUT_COPY =
  "your signer didn't answer. if you use a phone app or remote signer, check it's open and online, then try again.";

export type Nip07Template = { kind: number; created_at: number; tags: string[][]; content: string };
export type Nip07Event = { id: string; pubkey: string; sig: string } & Record<string, unknown>;

function plainMessage(err: unknown): string {
  let raw: unknown = err;
  if (err && typeof err === "object" && "message" in err) raw = (err as { message?: unknown }).message;
  let text = typeof raw === "string" ? raw : String(raw ?? "");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > MESSAGE_CAP) text = `${text.slice(0, MESSAGE_CAP - 3).trimEnd()}...`;
  return text || "no reason given";
}

function run<T>(call: () => Promise<T>, opts: Nip07Options): Promise<Nip07Result<T>> {
  const timeoutMs = opts.timeoutMs ?? NIP07_TIMEOUT_MS;
  const hintMs = opts.hintMs ?? NIP07_HINT_MS;
  return new Promise<Nip07Result<T>>((resolve) => {
    let settled = false;
    /* the limit starts with the call; the callback only runs later, so `finish` is ready */
    const limitTimer = setTimeout(
      () => finish({ ok: false, kind: "timeout", message: NIP07_TIMEOUT_COPY }),
      timeoutMs
    );
    let hintTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (r: Nip07Result<T>) => {
      if (settled) return; // a late answer after the limit is ignored
      settled = true;
      clearTimeout(limitTimer);
      clearTimeout(hintTimer);
      resolve(r);
    };
    /* the signer is called here, inside the executor, before anything async */
    let pending: Promise<T>;
    try {
      pending = Promise.resolve(call());
    } catch (err) {
      finish({ ok: false, kind: "signer", message: plainMessage(err) });
      return;
    }

    if (opts.onSlow && hintMs < timeoutMs) {
      hintTimer = setTimeout(() => {
        if (!settled) opts.onSlow?.();
      }, hintMs);
    }
    pending.then(
      (value) => finish({ ok: true, value }),
      (err) => finish({ ok: false, kind: "signer", message: plainMessage(err) })
    );
  });
}

const MISSING: Nip07Failure = { ok: false, kind: "missing", message: "no signer extension found" };

/** Ask the signer to sign an event. Never throws. Call it synchronously from a click. */
export function nip07SignEvent(
  template: Nip07Template,
  opts: Nip07Options = {}
): Promise<Nip07Result<Nip07Event>> {
  const nostr = typeof window === "undefined" ? undefined : window.nostr;
  if (!nostr?.signEvent) return Promise.resolve(MISSING);
  return run(() => nostr.signEvent(template), opts);
}

/** Ask the signer for the public key (hex). Never throws. Call it synchronously from a click. */
export function nip07GetPublicKey(opts: Nip07Options = {}): Promise<Nip07Result<string>> {
  const nostr = typeof window === "undefined" ? undefined : window.nostr;
  if (!nostr?.getPublicKey) return Promise.resolve(MISSING);
  return run(() => nostr.getPublicKey(), opts);
}

/** The line to show for a failed result. `missingCopy` overrides the no-signer line. */
export function nip07FailureCopy(f: Nip07Failure, missingCopy?: string): string {
  if (f.kind === "timeout") return NIP07_TIMEOUT_COPY;
  if (f.kind === "signer") return `your signer said: ${f.message}`;
  return missingCopy ?? f.message;
}
