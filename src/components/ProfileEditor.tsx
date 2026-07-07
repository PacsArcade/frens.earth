"use client";

import { useState, useSyncExternalStore } from "react";
import { nip19, SimplePool } from "nostr-tools";
import type { Event as NostrEvent } from "nostr-tools";
import { PROFILE_RELAYS, type RawKind0 } from "@/hooks/useNostrProfile";
import useFrenSession from "@/hooks/useFrenSession";
import SigningExplainer from "@/components/SigningExplainer";
import SignerNudge from "@/components/SignerNudge";

/* one-shot environment read, hydration-safe and lint-clean */
const noopSubscribe = () => () => {};
function useHasSigner(): boolean | null {
  return useSyncExternalStore(noopSubscribe, () => !!window.nostr, () => null);
}

/** The eight fields the form edits — Primal parity, arcade dress. */
const FIELDS = [
  { key: "name", label: "USERNAME", hint: "your everyday handle in apps" },
  { key: "display_name", label: "DISPLAY NAME", hint: "the marquee version" },
  { key: "about", label: "ABOUT ME", hint: "say something to the frens", textarea: true },
  { key: "website", label: "WEBSITE", hint: "https://…" },
  { key: "lud16", label: "BITCOIN LIGHTNING ADDRESS", hint: "zaps land here — looks like an email" },
  { key: "nip05", label: "VERIFIED NOSTR ADDRESS (NIP-05)", hint: "" },
  { key: "picture", label: "AVATAR IMAGE URL", hint: "https:// image link" },
  { key: "banner", label: "BANNER IMAGE URL", hint: "https:// image link" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type Draft = Record<FieldKey, string>;

const ADDRESS_RE = /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

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
    if (v && !/^https:\/\//i.test(v)) return `${k} must be an https:// image link`;
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
  const hasSigner = useHasSigner();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  /* the editor exists only on your own profile — UX gate; the real security
     is that publishing requires YOUR key in the signer anyway */
  if (!fren || fren.handle !== handle || fren.space !== space) return null;

  const defaultNip05 = `${handle}@${nip05Domain}`;

  function openEditor() {
    setDraft(draftFrom(raw?.content, defaultNip05));
    setError(null);
    setPublished(false);
    setOpen(true);
  }

  async function save() {
    if (!draft) return;
    setError(null);
    const problem = validate(draft);
    if (problem) {
      setError(problem);
      return;
    }
    if (!window.nostr) {
      setError("no signer extension found — see the gear-up note below");
      return;
    }
    setBusy(true);
    let pool: SimplePool | null = null;
    try {
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

      const event = (await window.nostr.signEvent({
        kind: 0,
        created_at,
        tags: raw?.tags ?? [],
        content: JSON.stringify(content),
      })) as NostrEvent;

      /* wrong-key guard: the signer must hold THIS profile's key */
      const decoded = nip19.decode(npub);
      if (decoded.type !== "npub" || event.pubkey !== decoded.data) {
        setError("this signer holds a different fren's key — nothing sent");
        return;
      }

      pool = new SimplePool();
      await Promise.race([
        Promise.any(pool.publish(PROFILE_RELAYS, event)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("relay timeout")), 8000)),
      ]);

      onPublished(content, created_at);
      setPublished(true);
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "relay timeout"
          ? "the relays didn't answer — nothing may have saved, try again"
          : "signing was declined — nothing sent"
      );
    } finally {
      pool?.close(PROFILE_RELAYS);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button type="button" onClick={openEditor} className="button cursor-pointer">
          ◆ EDIT PROFILE
        </button>
        {published && (
          <p className="mt-2 font-pixel text-[9px] uppercase text-neon glow-neon">
            ✓ SIGNAL UPDATED — THE RELAYS GOSSIP IT OUT FROM HERE
          </p>
        )}
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
              {f.key === "nip05" && draft.nip05.trim() !== defaultNip05 && (
                <p className="mt-1 font-pixel text-[9px] uppercase text-coin">
                  ⚠ {defaultNip05} is your verified arcade address — change it and the checkmark
                  goes dark
                </p>
              )}
              {(f.key === "picture" || f.key === "banner") &&
                /^https:\/\//i.test(draft[f.key].trim()) && (
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

      <div className="mt-5 flex flex-wrap gap-3">
        {hasSigner === false ? (
          <div className="w-full">
            <SignerNudge />
          </div>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="button cursor-pointer disabled:opacity-50"
          >
            {busy ? "WAITING FOR YOUR KEY…" : "▶ SIGN & PUBLISH"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
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
