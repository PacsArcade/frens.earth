"use client";

import Link from "next/link";
import { PixelAvatar } from "@pacsarcade/arcade-ui";
import useFrenSession from "@/hooks/useFrenSession";
import useNostrProfile from "@/hooks/useNostrProfile";
import { isNpubDoorSpace, shortNpub } from "@/lib/npub-door";

/**
 * The npub door's public page (W10/N0) — a key with no tag still gets a
 * face: its live kind-0 signal, read straight from the open network. No
 * registry entry, no etch badges — the key IS the identity here, and the
 * page says so honestly in all three signal states.
 */
export default function NpubProfile({ npub }: { npub: string }) {
  const { state: signal, profile } = useNostrProfile(npub);
  const { fren, checked } = useFrenSession();
  const short = shortNpub(npub);

  /* OWNER: the npub door itself (handle IS the npub), or a tag session
     whose registry-recorded key is this npub. The session npub comes from
     the server (cookie-derived) — never from anything the page was told. */
  const isOwner =
    !!fren && ((isNpubDoorSpace(fren.space) && fren.handle === npub) || fren.npub === npub);

  return (
    <>
      {/* the key's own sky — banner straight from its kind-0 */}
      {signal === "found" && profile?.banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.banner}
          alt=""
          aria-hidden
          className="h-32 w-full border-2 border-edge object-cover sm:h-44"
        />
      )}

      {signal === "tuning" && (
        <section className="border-2 border-edge bg-panel p-6">
          <p className="font-pixel text-xs text-coin pulse-neon">TUNING THE SIGNAL…</p>
        </section>
      )}

      {signal === "found" && profile && (
        <section className="flex flex-wrap items-center gap-5 border-b-0 py-0">
          {profile.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.picture}
              alt=""
              className="h-18 w-18 flex-none border-3 border-cyan object-cover"
            />
          ) : (
            /* same seeded pixel body the header chip wears — one face everywhere */
            <PixelAvatar variant="player" seed={npub} size={72} />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="break-all font-arcade text-[clamp(1.6rem,6vw,2.6rem)] leading-tight text-coin glow-coin">
              {profile.display_name || profile.name || short}
            </h1>
            <p className="mt-1 break-all font-mono text-xs text-cyan">{short}</p>
            {profile.about && (
              <p className="mt-3 max-w-xl break-words font-body text-sm leading-relaxed text-white/75">
                {profile.about}
              </p>
            )}
            {(profile.nip05 || profile.lud16) && (
              <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px]">
                {profile.nip05 && (
                  <span className="break-all text-cyan" title="NIP-05 address, as the card claims it">
                    {profile.nip05}
                  </span>
                )}
                {profile.lud16 && (
                  <span className="break-all text-coin" title="Lightning address — zaps land here">
                    ⚡ {profile.lud16}
                  </span>
                )}
              </p>
            )}
          </div>
        </section>
      )}

      {signal === "silent" && (
        <section className="flex flex-wrap items-center gap-5 border-2 border-edge bg-panel p-6">
          {/* seeded by the npub — a silent key still gets a body */}
          <PixelAvatar variant="player" seed={npub} size={72} />
          <div className="min-w-0 flex-1">
            <p className="break-all font-arcade text-2xl text-coin glow-coin">{short}</p>
            <p className="mt-2 font-body text-sm text-white/70">
              this fren hasn&apos;t lit their signal yet — no kind-0 card on the big relays.
            </p>
          </div>
        </section>
      )}

      {/* the plumbing — the full key, honest and copyable by hand */}
      <section className="border-2 border-edge bg-panel p-6">
        <p className="mb-2 font-pixel text-[10px] text-white/40">PUBLIC KEY — SAFE TO SHARE</p>
        <p className="break-all font-mono text-xs text-white/70">{npub}</p>
        <p className="mt-2 font-body text-xs text-white/50">
          No arcade tag on this page — just the key and its live signal from the open network.
        </p>
      </section>

      {/* viewer states — owner gets the workbench pointer, a stranger with
          no session gets the claim door, everyone else just reads */}
      {isOwner && (
        <section className="border-2 border-neon/60 bg-panel p-6 text-center">
          <p className="mb-3 font-pixel text-xs text-neon glow-neon">
            THIS IS YOUR PAGE — ▶ CUSTOMIZE (COMING SOON)
          </p>
          <Link href="/me" className="button inline-block text-center">
            OPEN YOUR CONTROL ROOM ▸
          </Link>
        </section>
      )}
      {checked && !fren && (
        <section className="border-2 border-coin/60 bg-panel p-6 text-center">
          <p className="mb-3 font-pixel text-xs text-coin glow-coin">
            IS THIS YOU? SIGN IN TO CLAIM YOUR PAGE
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/u/${npub}`)}`}
            className="button inline-block text-center"
          >
            ▶ SIGN IN
          </Link>
        </section>
      )}
    </>
  );
}
