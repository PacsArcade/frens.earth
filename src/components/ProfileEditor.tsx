"use client";

import { useState } from "react";
import { nip19 } from "nostr-tools";
import type { Event as NostrEvent } from "nostr-tools";
import type { EventTemplate, VerifiedEvent } from "nostr-tools/pure";
import { type RawKind0 } from "@/hooks/useNostrProfile";
import useFrenSession from "@/hooks/useFrenSession";
import SigningExplainer from "@/components/SigningExplainer";
import Kind0Doors from "@/components/Kind0Doors";
import ArtUpload from "@/components/ArtUpload";
import RelayResults from "@/components/RelayResults";
import { anyAccepted, publishKind0, type RelayResult } from "@/lib/kind0-publish";

/** The eight fields the form edits — Primal parity, arcade dress. These are
    all NOSTR profile-card fields: none of them touch the etched arcade tag. */
const FIELDS = [
  { key: "name", label: "NOSTR USERNAME", hint: "what nostr apps show — not your arcade tag" },
  { key: "display_name", label: "ARCADE NAME (DISPLAY NAME)", hint: "the marquee version — change it any time; only your tag is etched" },
  { key: "about", label: "ABOUT ME", hint: "say something to the frens", textarea: true },
  { key: "website", label: "WEBSITE", hint: "https://…" },
  { key: "lud16", label: "LIGHTNING ADDRESS (ZAPS)", hint: "name@wallet-provider — lightning, not an on-chain address" },
  { key: "nip05", label: "VERIFIED NOSTR ADDRESS (NIP-05)", hint: "" },
  { key: "picture", label: "AVATAR IMAGE URL", hint: "https:// image link" },
  { key: "banner", label: "BANNER IMAGE URL", hint: "https:// image link" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type Draft = Record<FieldKey, string>;

const ADDRESS_RE = /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

/** https everywhere; plain-http only for localhost (the dev upload driver). */
export function isImageUrl(v: string): boolean {
  return /^https:\/\//i.test(v) || /^http:\/\/(localhost|127\.)/i.test(v);
}

function draftFrom(content: Record<string, unknown> | undefined, fallbackNip05: string): Draft {
  const read = (k: string) => {
    const v = content?.[k];
    return typeof v === "string" ? v : "";
  };
  return {
    name: read("name"),
    display_name: read("display_name"),
    about: read("about"),
    website: read("website"),
    lud16: read("lud16"),
    nip05: read("nip05") || fallbackNip05,
    picture: read("picture"),
    banner: read("banner"),
  };
}

function validate(draft: Draft): string | null {
  const web = draft.website.trim();
  if (web && !/^https?:\/\//i.test(web) && !/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}/i.test(web)) {
    return "website doesn't look like a link";
  }
  for (const k of ["picture", "banner"] as const) {
    const v = draft[k].trim();
    if (v && !isImageUrl(v)) return `${k} must be an https:// image link`;
  }
  for (const k of ["lud16", "nip05"] as const) {
    const v = draft[k].trim();
    if (v && !ADDRESS_RE.test(v)) return `${k === "lud16" ? "lightning address" : "nostr address"} should look like name@domain`;
  }
  return null;
}

/**
 * EDIT PROFILE — Primal-parity kind-0 editor, own profile only. The flow is
 * read → merge → sign → publish, all in the browser: the key never touches
 * our server, there is no API route, and the merge spreads the RAW existing
 * content so fields other apps set (and fields we don't render) survive.
 * Publishing kind-0 replaces the whole card — the merge is the safety.
 *
 * Signing rides the signer doors (Kind0Doors): NIP-07 extension when
 * present, NIP-46 remote signer always. Publish results are shown per
 * relay, truthfully — one accepting relay is success (the network gossips),
 * but the fren sees exactly who took the card.
 */
export default function ProfileEditor({
  npub,
  handle,
  space,
  nip05Domain,
  raw,
  signal,
  onPublished,
}: {
  npub: string;
  handle: string;
  space: string;
  nip05Domain: string;
  /** The full current kind-0 (content object + created_at + tags) from
      useNostrProfile — null while tuning or when the fren is silent. */
  raw: RawKind0 | null;
  signal: "tuning" | "found" | "silent";
  /** FrenProfile's applyLocal — flips the page (and cache) optimistically. */
  onPublished: (content: Record<string, unknown>, created_at: number) => void;
}) {
  const { fren } = useFrenSession();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [relayResults, setRelayResults] = useState<RelayResult[] | null>(null);
  const [lnCheck, setLnCheck] = useState<"idle" | "checking" | "live" | "bad" | "unknown">("idle");

  /* the editor exists only on your own profile — UX gate; the real security
     is that publishing requires YOUR key in the signer anyway */
  if (!fren || fren.handle !== handle || fren.space !== space) return null;

  const defaultNip05 = `${handle}@${nip05Domain}`;

  function openEditor() {
    setDraft(draftFrom(raw?.content, defaultNip05));
    setError(null);
    setPublished(false);
    setRelayResults(null);
    setLnCheck("idle");
    setOpen(true);
  }

  /* Does the lightning address actually catch zaps? LNURL-pay lives at a
     well-known URL — ask it directly, best-effort (some providers block
     cross-site reads; that's an "unknown", not a failure). */
  async function testLightning() {
    const v = draft?.lud16.trim() ?? "";
    if (!ADDRESS_RE.test(v)) {
      setLnCheck("bad");
      return;
    }
    setLnCheck("checking");
    try {
      const [name, domain] = v.split("@");
      const res = await fetch(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`, {
        signal: AbortSignal.timeout(6000),
      });
      const data = (await res.json()) as { tag?: string };
      setLnCheck(data?.tag === "payRequest" ? "live" : "bad");
    } catch {
      setLnCheck("unknown");
    }
  }

  /* Build the card to sign — Kind0Doors calls this at sign time, so a slow
     bunker approval still gets a truthful created_at. */
  function prepare(): EventTemplate | { problem: string } {
    if (!draft) return { problem: "nothing to sign yet" };
    const problem = validate(draft);
    if (problem) return { problem };

    /* MERGE — the clobber guard: spread the whole existing card first, so
       every field other apps set survives; then apply the edits. An empty
       field removes its key (that's how you clear a value on nostr). */
    const content: Record<string, unknown> = { ...(raw?.content ?? {}) };
    for (const f of FIELDS) {
      let v = draft[f.key].trim();
      if (f.key === "website" && v && !/^https?:\/\//i.test(v)) v = `https://${v}`;
      if (v) content[f.key] = v;
      else delete content[f.key];
    }

    /* relays keep the newest created_at — never publish one that ties/loses */
    const created_at = Math.max(Math.floor(Date.now() / 1000), (raw?.created_at ?? 0) + 1);

    return { kind: 0, created_at, tags: raw?.tags ?? [], content: JSON.stringify(content) };
  }

  /* The signed card comes back from WHICHEVER door signed it — verify the
     key, then broadcast and show the per-relay truth. */
  async function submit(event: NostrEvent | VerifiedEvent): Promise<string | null> {
    /* wrong-key guard: the signer must hold THIS profile's key */
    const decoded = nip19.decode(npub);
    if (decoded.type !== "npub" || event.pubkey !== decoded.data) {
      return "this signer holds a different fren's key — nothing sent";
    }
    setError(null);
    const results = await publishKind0(event as NostrEvent);
    setRelayResults(results);
    if (!anyAccepted(results)) {
      return "no relay accepted the card — nothing saved, try again";
    }
    let content: Record<string, unknown> = {};
    try {
      content = JSON.parse(event.content) as Record<string, unknown>;
    } catch {
      /* we built this content — unreachable, but never crash the flow */
    }
    onPublished(content, event.created_at);
    setPublished(true);
    setOpen(false);
    return null;
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={openEditor} className="button cursor-pointer">
          ◆ EDIT PROFILE
        </button>
        {published && relayResults && <RelayResults results={relayResults} />}
      </div>
    );
  }

  return (
    <section className="border-2 border-cyan bg-panel p-6">
      <p className="mb-1 font-pixel text-xs text-cyan glow-cyan">EDIT PROFILE</p>
      <p className="mb-5 font-body text-xs text-white/50">
        {signal === "found"
          ? "Prefilled from your live signal. Saving signs a fresh card with your key and sends it to the relays — everything you set in other apps rides along untouched."
          : signal === "silent"
            ? "The relays haven't heard from you yet — this will be your first profile card."
            : "Still tuning the relays… fields may prefill in a moment."}
      </p>

      {/* the one thing this form can NEVER touch — answer the question
          before it's asked: the tag is registry + Bitcoin, not kind-0 */}
      <div className="mb-5 border-2 border-edge bg-void px-3 py-2">
        <p className="mb-1 font-pixel text-[10px] text-white/40">
          YOUR ARCADE TAG — ETCHED, NEVER CHANGES
        </p>
        <p className="font-mono text-sm text-coin">
          {handle}@{space}
        </p>
        <p className="mt-1 font-body text-xs text-white/50">
          Everything below is your nostr profile card — the outfit, not the player. The tag
          stays yours no matter what you set here.
        </p>
      </div>

      <div className="space-y-4">
        {draft &&
          FIELDS.map((f) => (
            <div key={f.key}>
              <label
                htmlFor={`pe-${f.key}`}
                className="mb-1 block font-pixel text-[10px] text-white/40"
              >
                {f.label}
              </label>
              {"textarea" in f && f.textarea ? (
                <textarea
                  id={`pe-${f.key}`}
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  rows={3}
                  placeholder={f.hint}
                  className="w-full border-2 border-edge bg-void p-2 font-body text-sm text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
                />
              ) : (
                <input
                  id={`pe-${f.key}`}
                  type="text"
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  placeholder={f.hint}
                  className="w-full border-2 border-edge bg-void p-2 font-mono text-sm text-white/85 placeholder:text-white/25 focus:border-cyan focus:outline-none"
                />
              )}
              {f.key === "lud16" && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={testLightning}
                    disabled={lnCheck === "checking" || !draft.lud16.trim()}
                    className="cursor-pointer border border-cyan/60 px-2 py-0.5 font-pixel text-[9px] uppercase text-cyan hover:bg-cyan/10 disabled:opacity-40"
                  >
                    {lnCheck === "checking" ? "TESTING…" : "TEST THIS ADDRESS ▸"}
                  </button>
                  {lnCheck === "live" && (
                    <span className="font-pixel text-[9px] uppercase text-neon">
                      ✓ LIVE — THIS ADDRESS CAN CATCH ZAPS
                    </span>
                  )}
                  {lnCheck === "bad" && (
                    <span className="font-pixel text-[9px] uppercase text-ghost">
                      ✗ NO ZAP SERVICE ANSWERED AT THAT ADDRESS
                    </span>
                  )}
                  {lnCheck === "unknown" && (
                    <span className="font-body text-xs text-white/50">
                      couldn&apos;t confirm from the browser (provider blocks cross-site checks) —
                      try a tiny zap from any wallet
                    </span>
                  )}
                </div>
              )}
              {f.key === "nip05" && draft.nip05.trim() !== defaultNip05 && (
                <div className="mt-1 space-y-1">
                  <p className="font-pixel text-[9px] uppercase text-coin">
                    ⚠ {defaultNip05} is your verified arcade address — change it and the checkmark
                    goes dark
                  </p>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, nip05: defaultNip05 })}
                    className="cursor-pointer border border-cyan/60 px-2 py-0.5 font-pixel text-[9px] uppercase text-cyan hover:bg-cyan/10"
                  >
                    USE {defaultNip05} ▸
                  </button>
                </div>
              )}
              {(f.key === "picture" || f.key === "banner") && (
                <div className="mt-1">
                  <ArtUpload
                    label={f.key === "picture" ? "UPLOAD AVATAR ART" : "UPLOAD BANNER ART"}
                    onUrl={(url) => setDraft({ ...draft, [f.key]: url })}
                  />
                </div>
              )}
              {(f.key === "picture" || f.key === "banner") &&
                isImageUrl(draft[f.key].trim()) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft[f.key].trim()}
                    alt=""
                    aria-hidden
                    className={
                      f.key === "picture"
                        ? "mt-2 h-14 w-14 border-2 border-edge object-cover"
                        : "mt-2 h-14 w-full border-2 border-edge object-cover"
                    }
                  />
                )}
            </div>
          ))}
      </div>

      {error && <p className="mt-4 font-pixel text-[9px] uppercase text-ghost">{error}</p>}
      {relayResults && !published && (
        <div className="mt-4">
          <RelayResults results={relayResults} />
        </div>
      )}

      <div className="mt-5 space-y-3">
        <Kind0Doors prepare={prepare} submit={submit} />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="cursor-pointer border-2 border-edge px-4 py-2 font-pixel text-[10px] uppercase text-white/50 hover:border-cyan hover:text-cyan"
        >
          CANCEL
        </button>
      </div>

      <div className="mt-4">
        <SigningExplainer kind="profile" />
      </div>
    </section>
  );
}
