"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { bftDate } from "@/lib/bb/bft";
import type { HandleStatus } from "@/lib/registry";
import { ANCHOR_BLOCKS_OUT, SPACE_ROLES } from "@/lib/identity-config";
import { ARTIST_GATE_CERT_COUNT, CLASSES_URL } from "@/lib/classes";
import { PixelAvatar, useTipHeight } from "@pacsarcade/arcade-ui";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import PokeArcadeCard from "@/components/PokeArcadeCard";
import ProfileEditor from "@/components/ProfileEditor";
import ReleaseTag from "@/components/ReleaseTag";
import useNostrProfile from "@/hooks/useNostrProfile";
import type { PokeProfile } from "@/lib/poke";

/* kind-0 websites arrive in every shape — make them clickable, never js: */
function safeUrl(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  return null;
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

/* Bitcoin time, not calendar time: entries claimed after round 2 carry the
   tip height; older frens get it backfilled from mempool.space's
   closest-block-to-timestamp lookup. Best-effort — the date is the fallback. */
function usePlayerSinceBlock(
  stored: number | null | undefined,
  requestedAt: string
): number | null {
  const [height, setHeight] = useState<number | null>(stored ?? null);
  useEffect(() => {
    if (height !== null) return;
    const ts = Math.floor(new Date(requestedAt).getTime() / 1000);
    if (!Number.isFinite(ts) || ts <= 0) return;
    let alive = true;
    fetch(`https://mempool.space/api/v1/mining/blocks/timestamp/${ts}`)
      .then((r) => r.json())
      .then((d) => alive && typeof d?.height === "number" && setHeight(d.height))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [height, requestedAt]);
  return height;
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
  blockHeight,
  space,
  nip05Domain,
  matrixProvisioned = false,
  poke = null,
}: {
  handle: string;
  npub: string;
  status: HandleStatus;
  requestedAt: string;
  blockHeight?: number | null;
  space: string;
  nip05Domain: string;
  /** From the registry — set when the tag's Matrix door has been cut. */
  matrixProvisioned?: boolean;
  /** Live stats from the fren's POKE node — null when the node is dark. */
  poke?: PokeProfile | null;
}) {
  const spaceTag = `@${space}`;
  const nip05Id = `${handle}@${nip05Domain}`;
  const njumpUrl = `https://njump.me/${nip05Id}`;
  const [copied, setCopied] = useState<"none" | "pub" | "nip05" | "page">("none");
  const { state: signal, profile, raw, applyLocal } = useNostrProfile(npub);
  const sinceBlock = usePlayerSinceBlock(blockHeight, requestedAt);
  const tipHeight = useTipHeight();
  const registered = new Date(requestedAt);
  const registeredLabel = isNaN(registered.getTime())
    ? null
    : registered.toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />

      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">
          PAC&apos;S ARCADE ▸ FREN PROFILE
        </p>

        {/* The fren's own sky — banner straight from their kind-0 */}
        {profile?.banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.banner}
            alt=""
            aria-hidden
            className="h-32 w-full border-2 border-edge object-cover sm:h-44"
          />
        )}

        {/* Identity header — the arcade marquee version of "this is you":
            the network's picture and display name lead; the tag is the
            anchor underneath. py-0/border-b-0 beat legacy section styles. */}
        <section className="flex flex-wrap items-center gap-5 border-b-0 py-0">
          {profile?.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.picture}
              alt=""
              className="h-18 w-18 flex-none border-3 border-cyan object-cover"
            />
          ) : (
            /* same seeded pixel body the header chip wears — one face everywhere */
            <PixelAvatar variant="player" seed={handle} size={72} />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="break-all font-arcade text-[clamp(1.6rem,6vw,2.6rem)] leading-tight text-coin glow-coin">
              {profile?.display_name || profile?.name || `${handle}${spaceTag}`}
            </h1>
            {(profile?.display_name || profile?.name) && (
              <p className="mt-1 break-all font-mono text-xs text-cyan">
                {handle}
                {spaceTag}
              </p>
            )}
            {sinceBlock !== null ? (
              <p className="mt-1 font-pixel text-[10px] text-white/40">
                PLAYER SINCE BLOCK <span className="text-cyan">{sinceBlock.toLocaleString()}</span>
                {/* Bitcoin time, not the old calendar (Pac, 2026-07-11) */}
                <span className="text-white/25">{" "}· {bftDate(sinceBlock)}</span>
              </p>
            ) : (
              registeredLabel && (
                <p className="mt-1 font-pixel text-[10px] text-white/40">
                  PLAYER SINCE {registeredLabel}
                </p>
              )
            )}
            {profile?.about && (
              <p className="mt-3 max-w-xl break-words font-body text-sm leading-relaxed text-white/75">
                {profile.about}
              </p>
            )}
            {(safeUrl(profile?.website) || profile?.lud16) && (
              <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px]">
                {safeUrl(profile?.website) && (
                  <a
                    href={safeUrl(profile?.website)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-cyan underline hover:glow-cyan"
                  >
                    {profile!.website}
                  </a>
                )}
                {profile?.lud16 && (
                  <span className="break-all text-coin" title="Lightning address — zaps land here">
                    ⚡ {profile.lud16}
                  </span>
                )}
              </p>
            )}
          </div>
        </section>

        {/* Badges — verified only because the checks actually hold. The
            space chip answers "which profile am I in?" — two doors, one arcade. */}
        <section className="flex flex-wrap gap-3 border-b-0 py-0">
          {/* the floor banner — a full row under the profile box; the accent
              says which door this identity lives behind (pink school, cyan
              play). Same colors as the chip and menu stripe. */}
          <span
            className={`w-full border-2 px-3 py-1.5 text-center font-pixel text-[10px] uppercase ${
              space === "pacsarcade"
                ? "border-pink/60 bg-pink/5 text-pink"
                : "border-cyan/60 bg-cyan/5 text-cyan"
            }`}
          >
            {space === "pacsarcade" ? "◆ ARTIST FLOOR" : "● PLAY FLOOR"} — {spaceTag} ·{" "}
            {SPACE_ROLES[space] ?? "VERSE"}
          </span>
          <span className="border-2 border-cyan/60 px-3 py-1.5 font-pixel text-[10px] text-cyan">
            ✓ NOSTR VERIFIED — {nip05Id}
          </span>
          {status === "committed" ? (
            <span className="border-2 border-neon/60 px-3 py-1.5 font-pixel text-[10px] text-neon glow-neon">
              ✓ ETCHED ON BITCOIN
            </span>
          ) : (
            <span className="border-2 border-coin/60 px-3 py-1.5 font-pixel text-[10px] text-coin pulse-neon">
              ⧗ ANCHOR PENDING —{" "}
              {tipHeight !== null
                ? `ETCHES ~BLOCK ${(tipHeight + ANCHOR_BLOCKS_OUT).toLocaleString()}`
                : "ETCHES AT THE NEXT CEREMONY"}
            </span>
          )}
        </section>

        {/* The game floor — live stats from the fren's POKE node; the card
            only exists while the node answers (graceful dark-node fallback) */}
        {poke && <PokeArcadeCard poke={poke} handle={handle} />}

        {/* Artist mode — compact milestone rail in the enrollment order
            (nostr → matrix → classes → wallet). LOCKED lives in the header,
            the border burns ghost-red until every light is on. @frens
            accounts get the honest blurb instead: play-and-support here,
            campaigns are school business. */}
        <section className="border-b-0 py-0">
          <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            RUNNING CAMPAIGNS IS EARNED, NOT BOUGHT
          </p>
          <h2 className="mb-4 font-arcade text-2xl text-ghost glow-ghost">
            ARTIST MODE — 🔒 LOCKED
          </h2>
          {space === "frens" ? (
            <div className="border-2 border-ghost/60 bg-panel p-5">
              <p className="font-body text-sm text-white/80">
                <span className="text-pink">@frens</span>{" "}is the play-and-support account:
                games, classes, backing other frens&apos; runs. Running a campaign of your own is
                school business — it takes an{" "}
                <span className="text-pink">@pacsarcade</span>{" "}account.{" "}
                <a
                  href="https://pacsarcade.org/register"
                  className="font-pixel text-[10px] uppercase text-cyan underline hover:glow-cyan"
                >
                  ENROLL AT PACSARCADE.ORG ▸
                </a>
              </p>
            </div>
          ) : (
            <div className="border-2 border-ghost/60 bg-panel p-5">
              {/* the rail: circles on a line, lit in order */}
              <div className="flex items-start">
                {[
                  { label: "NOSTR TAG", done: true, href: null },
                  {
                    label: "MATRIX",
                    done: matrixProvisioned,
                    href: matrixProvisioned ? null : "https://pacsarcade.org/login",
                  },
                  { label: `CERTS 0/${ARTIST_GATE_CERT_COUNT}`, done: false, href: CLASSES_URL },
                  { label: "WALLET", done: false, href: null },
                ].map((m, i, all) => (
                  <div key={m.label} className="flex flex-1 items-start">
                    {i > 0 && (
                      <span
                        aria-hidden
                        className={`mt-3 h-0.5 flex-1 ${all[i - 1].done && m.done ? "bg-neon/70" : "bg-ghost/40"}`}
                      />
                    )}
                    <span className="flex flex-col items-center gap-1.5 px-1">
                      <span
                        className={`grid h-6 w-6 flex-none place-items-center rounded-full border-2 text-[10px] ${
                          m.done ? "border-neon text-neon glow-neon" : "border-ghost/60 text-ghost/60"
                        }`}
                        title={m.done ? "milestone reached" : "still to earn"}
                      >
                        {m.done ? "✓" : "⚿"}
                      </span>
                      {m.href ? (
                        <a
                          href={m.href}
                          className="whitespace-nowrap font-pixel text-[8px] uppercase text-cyan underline hover:glow-cyan"
                        >
                          {m.label}
                        </a>
                      ) : (
                        <span
                          className={`whitespace-nowrap font-pixel text-[8px] uppercase ${m.done ? "text-white/80" : "text-white/40"}`}
                        >
                          {m.label}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 font-body text-xs text-white/50">
                Four lights in order — tag, Matrix door, certs, wallet — every one free to earn.
                The border goes green when the rail is lit.
              </p>
            </div>
          )}
        </section>

        {/* Live nostr signal — proof the profile exists beyond this site */}
        <section id="on-air" className="scroll-mt-6 border-2 border-edge bg-panel p-6">
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
                {/* same treatment as the H1 up top — the name is always coin,
                    so the reader knows what to look at (not just what's pretty) */}
                <p className="break-words font-arcade text-xl text-coin glow-coin">
                  {profile.display_name || profile.name || handle}
                </p>
                {/* the full network they're attached to, a step smaller */}
                <p className="mt-1 break-all font-mono text-xs text-cyan">
                  {handle}
                  {spaceTag} · {nip05Id}
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

          {/* editing lives WITH the network it edits — this whole card is
              nostr (the lead network); matrix keeps its own block below */}
          <div className="mt-5 border-t border-dashed border-edge pt-5">
            <ProfileEditor
              npub={npub}
              handle={handle}
              space={space}
              nip05Domain={nip05Domain}
              raw={raw}
              signal={signal}
              onPublished={applyLocal}
            />
          </div>
        </section>

        {/* Matrix doors are @tag:pacsarcade.org school hardware — cut from
            the pacsarcade.org profile, not here */}

        {/* Certs — proof you showed up, etched not printed. The shelf renders
            each cert as NES-era box art (CertCase) once the rune index lands;
            until then an honest empty slot + the case legend. Rarity is told
            by Bitcoin Time: the etch block decides the case (src/lib/certs.ts). */}
        <section className="border-b-0 py-0">
          <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            PROOF YOU SHOWED UP — ETCHED, NOT PRINTED
          </p>
          <h2 className="mb-4 font-arcade text-2xl text-cyan glow-cyan">CERTS</h2>
          <div className="border-2 border-edge bg-panel p-6">
            <p className="mb-2 font-pixel text-xs text-white/60">THE SHELF IS EMPTY — FOR NOW</p>
            <div className="flex flex-wrap items-center gap-5">
              {/* the empty slot — a case-shaped hole waiting for the first cart */}
              <div
                aria-hidden
                className="grid h-40 w-32 flex-none place-items-center border-2 border-dashed border-edge"
              >
                <span className="px-2 text-center font-pixel text-[8px] uppercase leading-relaxed text-white/30">
                  YOUR FIRST
                  <br />
                  CART GOES
                  <br />
                  HERE
                </span>
              </div>
              <div className="min-w-[16rem] flex-1">
                <p className="font-body text-sm text-white/80">
                  The arcade teaches free, fren. Take a class, earn a cert — one rune, etched to
                  your wallet, network fee on the house. Every cert ships as box art, and{" "}
                  <span className="text-cyan">the block decides the case</span>: full moons mint{" "}
                  silver, epoch boundaries mint <span className="text-coin">gold</span> — like the
                  Zelda cartridge — and halvings mint the{" "}
                  <span className="text-pink">astronomical</span> tier.
                </p>
                <a href={CLASSES_URL} className="button mt-4 inline-block text-center">
                  SEE THE CLASSES ▸
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* The showcase — runes and ordinals minted supporting projects.
            Honest empty state until the rune index (knowledge-engine) gets
            an HTTP bridge; each mint will then deep-link its campaign's
            cabinet (/campaigns/[slug]) and the billboard rotation. */}
        <section className="border-b-0 py-0">
          <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            WHAT YOU MINTED ALONG THE WAY
          </p>
          <h2 className="mb-4 font-arcade text-2xl text-cyan glow-cyan">THE SHOWCASE</h2>
          <div className="border-2 border-edge bg-panel p-6">
            <p className="mb-2 font-pixel text-xs text-white/60">NO MINTS YET</p>
            <div className="flex flex-wrap items-center gap-5">
              <p className="min-w-[16rem] flex-1 font-body text-sm text-white/80">
                Back a project and the runes and ordinals it mints land here — real artifacts on
                Bitcoin, made in the arcade. Every piece on this shelf will link back to the
                campaign that made it, so a fren who likes what they see can walk straight to
                the cabinet and drop a quarter too.
              </p>
              <Link href="/campaigns" className="button w-full text-center sm:w-auto">
                SEE THE FLOOR ▸
              </Link>
            </div>
          </div>
        </section>

        {/* 1UP supporters — the donor shelf (brand-kit-reference "in flight").
            BTCPay invoices are anonymous today; badges arrive with Contribute
            V2's nostr sign-in. No fake data — the shelf waits honestly. */}
        <section className="border-b-0 py-0">
          <p className="mb-2 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            PAYING IT FORWARD, ON THE RECORD
          </p>
          <h2 className="mb-4 font-arcade text-2xl text-coin glow-coin">1UP SUPPORTERS</h2>
          <div className="border-2 border-coin/40 bg-panel p-6">
            <p className="mb-2 font-pixel text-xs text-white/60">THE SHELF IS WAITING</p>
            <p className="font-body text-sm text-white/80">
              When you back a campaign with your tag signed in, the project&apos;s badge lights
              up here — a 1UP for someone else&apos;s dream, worn on your profile. Supporters see
              their backed projects; visitors see a fren who pays it forward. Contributions
              stay wallet-to-wallet either way — the badge is bragging rights, not custody. 💛
            </p>
          </div>
        </section>

        {/* The controller — now a pull-cord: it opens when a fren wants to
            know what nostr can DO (the ON AIR card above already shows the
            profile itself). The levels stay inside as the fun on-ramp. */}
        <section className="border-4 border-neon bg-panel shadow-[8px_8px_0_#ff00ff]">
          <details>
            <summary className="cursor-pointer p-6 sm:p-8">
              <span className="mb-1 block font-pixel text-xs text-neon glow-neon">NEXT LEVEL</span>
              <span className="font-arcade text-2xl text-cyan glow-cyan">
                WHAT CAN NOSTR DO? ▸
              </span>
            </summary>
            <div className="px-6 pb-6 sm:px-8 sm:pb-8">
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
            href="#on-air"
            onClick={(e) => {
              /* belt and braces: the anchor jump silently no-ops when anything
                 upsets hash navigation — scrollIntoView always moves */
              e.preventDefault();
              document.getElementById("on-air")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="button block w-full text-center"
          >
            ▲ SEE YOUR LIVE SIGNAL
          </a>
          <p className="mt-2 text-center font-body text-xs text-white/50">
            The ON AIR card above reads the open network directly — your own arcade, no
            middleman. Third-party windows if you want a second opinion:{" "}
            <a
              href={njumpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan hover:glow-cyan underline"
            >
              njump
            </a>{" "}·{" "}
            <a
              href={`https://primal.net/p/${npub}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan hover:glow-cyan underline"
            >
              primal
            </a>
            .
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
            </div>
          </details>
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
                  if (await copyToClipboard(`https://${nip05Domain}/u/${handle}`)) setCopied("page");
                }}
                className="break-all border border-edge px-2 py-1 text-left font-mono text-xs text-white/70 hover:border-cyan hover:text-cyan"
              >
                {copied === "page" ? "✓ copied" : `https://${nip05Domain}/u/${handle}`}
              </button>
              <p className="mt-1 font-body text-xs text-white/50">
                Bookmark it, share it — this is your start screen. Frens without keys can still
                see you here.
              </p>
            </div>
          </div>
        </section>

        {/* The right of exit — pending names only; etched is forever */}
        <ReleaseTag handle={handle} space={space} status={status} nip05Domain={nip05Domain} />

        {/* The three doors — the whole arcade from any profile, no dupes */}
        <section className="border-b-0 py-0">
          <p className="mb-2 text-center font-pixel text-[10px] uppercase tracking-widest text-white/40">
            THE THREE DOORS OF THE ARCADE
          </p>
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-3 border-2 border-coin/40 bg-panel p-5">
              <p className="font-pixel text-xs text-coin">PLAY</p>
              <p className="flex-1 font-body text-sm text-white/70">
                The game portal — P.O.K.E. worlds where playing IS learning.
              </p>
              <a
                href="https://pacsarcade.org/play"
                className="self-start font-pixel text-[10px] text-cyan underline hover:glow-cyan"
              >
                INSERT COIN ▸
              </a>
            </div>
            <div className="flex flex-col gap-3 border-2 border-pink/40 bg-panel p-5">
              <p className="font-pixel text-xs text-pink">LEARN</p>
              <p className="flex-1 font-body text-sm text-white/70">
                Free classes, live with Pacman — every one etches a cert.
              </p>
              <a
                href={CLASSES_URL}
                className="self-start font-pixel text-[10px] text-cyan underline hover:glow-cyan"
              >
                SEE CLASSES ▸
              </a>
            </div>
            <div className="flex flex-col gap-3 border-2 border-cyan/40 bg-panel p-5">
              <p className="font-pixel text-xs text-cyan">GROW</p>
              <p className="flex-1 font-body text-sm text-white/70">
                The community floor — frens funding frens, wallet to wallet.
              </p>
              <a
                href="https://pacsarcade.org/campaigns"
                className="self-start font-pixel text-[10px] text-cyan underline hover:glow-cyan"
              >
                WALK THE FLOOR ▸
              </a>
            </div>
          </div>
        </section>

        <p className="text-center font-pixel text-[10px] text-white/30">
          <Link href="/" className="text-cyan hover:glow-cyan">
            REGISTER ANOTHER TAG
          </Link>
        </p>
      </div>

      <EarthFooter />
    </main>
  );
}
