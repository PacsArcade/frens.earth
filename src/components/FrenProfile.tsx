"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { nip19, SimplePool } from "nostr-tools";
import type { HandleStatus } from "@/lib/registry";

/* Public relays we read the fren's kind-0 profile from — same set the
   registration machine broadcasts to, so a fresh starter profile is found. */
const PROFILE_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];

interface NostrProfile {
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* The fren's live signal: their kind-0 profile as the nostr network sees it
   right now. Read-only, best-effort — the page never blocks on relays. */
function useNostrProfile(npub: string) {
  const [state, setState] = useState<"tuning" | "found" | "silent">("tuning");
  const [profile, setProfile] = useState<NostrProfile | null>(null);
  useEffect(() => {
    let alive = true;
    const pool = new SimplePool();
    (async () => {
      try {
        const decoded = nip19.decode(npub);
        if (decoded.type !== "npub") throw new Error();
        const event = await Promise.race([
          pool.get(PROFILE_RELAYS, { kinds: [0], authors: [decoded.data as string] }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
        ]);
        if (!alive) return;
        if (event) {
          setProfile(JSON.parse(event.content) as NostrProfile);
          setState("found");
        } else {
          setState("silent");
        }
      } catch {
        if (alive) setState("silent");
      } finally {
        pool.close(PROFILE_RELAYS);
      }
    })();
    return () => {
      alive = false;
    };
  }, [npub]);
  return { state, profile };
}

/**
 * A fren's public profile page — where every registration lands. Shows the
 * tag as the network sees it (registry + live nostr signal) and hands the
 * fren a controller for their next move into the nostr verse.
 */
export default function FrenProfile({
  handle,
  npub,
  status,
  requestedAt,
  space,
  nip05Domain,
}: {
  handle: string;
  npub: string;
  status: HandleStatus;
  requestedAt: string;
  space: string;
  nip05Domain: string;
}) {
  const spaceTag = `@${space}`;
  const nip05Id = `${handle}@${nip05Domain}`;
  const njumpUrl = `https://njump.me/${nip05Id}`;
  const [copied, setCopied] = useState<"none" | "pub" | "nip05" | "page">("none");
  const { state: signal, profile } = useNostrProfile(npub);
  const registered = new Date(requestedAt);
  const registeredLabel = isNaN(registered.getTime())
    ? null
    : registered.toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-void">
      <header className="border-b-2 border-edge px-6 py-5">
        <nav className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="https://pacsarcade.org" className="font-pixel text-sm text-coin glow-coin">
            PAC&apos;S ARCADE
          </Link>
          <span className="font-pixel text-xs text-pink glow-pink uppercase">{spaceTag}</span>
        </nav>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">
          PAC&apos;S ARCADE ▸ FREN PROFILE
        </p>

        {/* Identity header — the arcade marquee version of "this is you".
            py-0/border-b-0 beat the legacy base-layer section styles. */}
        <section className="flex flex-wrap items-center gap-5 border-b-0 py-0">
          <div
            className="grid h-18 w-18 flex-none place-items-center border-3 border-cyan bg-panel font-arcade text-3xl text-cyan"
            aria-hidden
          >
            {handle[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="break-all font-arcade text-[clamp(1.6rem,6vw,2.6rem)] leading-tight text-coin glow-coin">
              {handle}
              {spaceTag}
            </h1>
            {registeredLabel && (
              <p className="mt-1 font-pixel text-[10px] text-white/40">
                PLAYER SINCE {registeredLabel}
              </p>
            )}
          </div>
        </section>

        {/* Badges — verified only because the checks actually hold */}
        <section className="flex flex-wrap gap-3 border-b-0 py-0">
          <span className="border-2 border-cyan/60 px-3 py-1.5 font-pixel text-[10px] text-cyan">
            ✓ NOSTR VERIFIED — {nip05Id}
          </span>
          {status === "committed" ? (
            <span className="border-2 border-neon/60 px-3 py-1.5 font-pixel text-[10px] text-neon glow-neon">
              ✓ ETCHED ON BITCOIN
            </span>
          ) : (
            <span className="border-2 border-coin/60 px-3 py-1.5 font-pixel text-[10px] text-coin pulse-neon">
              ⧗ ANCHOR PENDING — ETCHES AT THE NEXT CEREMONY
            </span>
          )}
        </section>

        {/* Live nostr signal — proof the profile exists beyond this site */}
        <section className="border-2 border-edge bg-panel p-6">
          <p className="mb-4 font-pixel text-xs text-cyan">ON AIR — YOUR SIGNAL ON NOSTR</p>
          {signal === "tuning" && (
            <p className="font-pixel text-xs text-coin pulse-neon">TUNING RELAYS…</p>
          )}
          {signal === "found" && profile && (
            <div className="flex items-start gap-4">
              {profile.picture && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.picture}
                  alt=""
                  className="h-14 w-14 flex-none border-2 border-edge object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="break-words font-pixel text-sm text-neon glow-neon">
                  {profile.display_name || profile.name || handle}
                </p>
                {profile.about && (
                  <p className="mt-2 break-words font-body text-sm text-white/75">{profile.about}</p>
                )}
                <p className="mt-3 font-body text-xs text-white/50">
                  This is what other frens see — live from the open network, not from our database.
                </p>
              </div>
            </div>
          )}
          {signal === "silent" && (
            <p className="font-body text-sm text-white/70">
              The relays haven&apos;t heard from you yet. Sign in to any nostr app with your keys,
              set your name and bio there, and this card lights up — no permission from us needed.
            </p>
          )}
        </section>

        {/* The controller — explicit continue into the nostr verse */}
        <section className="border-4 border-neon bg-panel p-6 shadow-[8px_8px_0_#ff00ff] sm:p-8">
          <p className="mb-2 font-pixel text-xs text-neon glow-neon">NEXT LEVEL</p>
          <h2 className="mb-4 font-arcade text-2xl text-cyan glow-cyan">ENTER THE NOSTR VERSE</h2>
          <p className="mb-6 font-body text-sm text-white/80">
            Your tag isn&apos;t just a name on this site — it&apos;s a passport to{" "}
            <a
              href="https://nostr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan hover:glow-cyan underline"
            >
              nostr
            </a>
            , an open network no company controls. Every app out there already recognizes you as{" "}
            <span className="text-cyan">{nip05Id}</span>.
          </p>
          <a
            href={njumpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button block w-full text-center"
          >
            ▶ SEE YOURSELF ON NOSTR
          </a>
          <p className="mt-2 text-center font-body text-xs text-white/50">
            Opens njump — a public window into the network. No sign-in needed to look.
          </p>

          <div className="mt-8 space-y-5 border-t border-dashed border-edge pt-6 font-body text-sm text-white/80">
            <p>
              <span className="mr-2 font-pixel text-xs text-neon">LEVEL 1 · GEAR UP</span>
              Pick a nostr app —{" "}
              <a
                href="https://primal.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan hover:glow-cyan underline"
              >
                Primal
              </a>
              {" "}(web + phones),{" "}
              <a
                href="https://damus.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan hover:glow-cyan underline"
              >
                Damus
              </a>
              {" "}(iPhone), or{" "}
              <a
                href="https://play.google.com/store/apps/details?id=com.vitorpamplona.amethyst"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan hover:glow-cyan underline"
              >
                Amethyst
              </a>
              {" "}(Android) — and sign in with the secret key you saved at registration. That key
              is your only login, and its sign-in screen is the only place it ever belongs.
            </p>
            <p>
              <span className="mr-2 font-pixel text-xs text-neon">LEVEL 2 · SAY GM</span>
              Post your first note: <span className="text-coin">&quot;gm frens 💜&quot;</span>.
              &quot;gm&quot; is the network&apos;s hello — expect a few back.
            </p>
            <p>
              <span className="mr-2 font-pixel text-xs text-neon">LEVEL 3 · FIND THE ARCADE</span>
              Search for <span className="text-pink">pacsarcade</span>{" "}and follow — that&apos;s
              where etch ceremonies are announced, including the one that anchors{" "}
              <span className="text-coin">{handle}{spaceTag}</span>{" "}to Bitcoin forever.
            </p>
          </div>
        </section>

        {/* The plumbing — keys and addresses, copy-ready */}
        <section className="border-2 border-edge bg-panel p-6">
          <p className="mb-4 font-pixel text-xs text-cyan">PLAYER DATA</p>
          <div className="space-y-4 font-body text-sm">
            <div>
              <p className="mb-1 font-pixel text-[10px] text-white/40">VERIFIED ADDRESS (NIP-05)</p>
              <button
                onClick={async () => {
                  if (await copyToClipboard(nip05Id)) setCopied("nip05");
                }}
                className="break-all border border-cyan/60 px-2 py-1 text-left font-mono text-xs text-cyan hover:bg-cyan/10"
              >
                {copied === "nip05" ? "✓ copied" : nip05Id}
              </button>
            </div>
            <div>
              <p className="mb-1 font-pixel text-[10px] text-white/40">PUBLIC KEY — SAFE TO SHARE</p>
              <button
                onClick={async () => {
                  if (await copyToClipboard(npub)) setCopied("pub");
                }}
                className="break-all border border-edge px-2 py-1 text-left font-mono text-xs text-white/70 hover:border-cyan hover:text-cyan"
              >
                {copied === "pub" ? "✓ copied" : npub}
              </button>
            </div>
            <div>
              <p className="mb-1 font-pixel text-[10px] text-white/40">THIS PAGE</p>
              <button
                onClick={async () => {
                  if (await copyToClipboard(`https://${nip05Domain}/fren/${handle}`)) setCopied("page");
                }}
                className="break-all border border-edge px-2 py-1 text-left font-mono text-xs text-white/70 hover:border-cyan hover:text-cyan"
              >
                {copied === "page" ? "✓ copied" : `https://${nip05Domain}/fren/${handle}`}
              </button>
              <p className="mt-1 font-body text-xs text-white/50">
                Bookmark it, share it — this is your start screen. Frens without keys can still
                see you here.
              </p>
            </div>
          </div>
        </section>

        <p className="text-center font-pixel text-[10px] text-white/30">
          <Link href="/" className="text-cyan hover:glow-cyan">
            REGISTER ANOTHER TAG
          </Link>
        </p>
      </div>

      <footer className="border-t-2 border-edge px-6 py-10 text-center">
        <p className="font-pixel text-xs leading-relaxed text-white/40">
          A PROJECT OF THE PAC&apos;S ARCADE NON-PROFIT —{" "}
          <a href="https://pacsarcade.org" className="text-cyan hover:glow-cyan">
            PACSARCADE.ORG
          </a>{" "}·{" "}
          YOUR TAG BELONGS TO YOU — WE NEVER SEE OR STORE YOUR SECRET KEY · POWERED BY THE{" "}
          <a
            href="https://spacesprotocol.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan hover:glow-cyan"
          >
            SPACES PROTOCOL
          </a>
        </p>
      </footer>
    </main>
  );
}
