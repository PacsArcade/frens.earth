"use client";

import Link from "next/link";
import { PixelAvatar } from "@pacsarcade/arcade-ui";
import useFrenSession from "@/hooks/useFrenSession";
import useNostrProfile from "@/hooks/useNostrProfile";

/**
 * The menu's identity rows — who you are up top, then your doors. Signed
 * in: identity block (avatar + tag + network) and MY PROFILE. Signed out:
 * the LOGIN door. SIGN OUT lives in the menu footer now (FrenMenuFooter),
 * split with the easy-eyes toggle. Injected into SiteHeader's menuSlot on
 * every page via ArcadeHeader.
 */
export default function FrenMenu() {
  const { fren } = useFrenSession();
  const { profile } = useNostrProfile(fren?.npub);

  if (!fren) {
    return (
      <Link
        href="/login"
        className="flex min-h-11 items-center border-b-2 border-edge px-4 font-pixel text-[10px] text-coin glow-coin"
      >
        🕹️ LOGIN
      </Link>
    );
  }

  return (
    <>
      {/* who you are — full identity: avatar, tag, and the network below */}
      <div className="flex items-center gap-3 border-b-2 border-edge bg-void px-4 py-3">
        {profile?.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.picture}
            alt=""
            className="h-10 w-10 flex-none border-2 border-cyan object-cover"
          />
        ) : (
          <PixelAvatar variant="player" seed={fren.handle} size={40} />
        )}
        <span className="min-w-0">
          <span className="block truncate font-pixel text-[10px] text-cyan">
            {fren.handle.toUpperCase()}
          </span>
          <span className="block font-mono text-[10px] text-white/40">
            @{fren.space} · {fren.space === "pacsarcade" ? "school" : "play"}
          </span>
        </span>
      </div>
      <Link
        href={`/u/${fren.handle}@${fren.space}`}
        className="flex min-h-11 items-center border-b-2 border-edge px-4 font-pixel text-[10px] text-cyan"
      >
        MY PROFILE
      </Link>
    </>
  );
}
