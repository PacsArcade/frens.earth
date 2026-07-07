"use client";

import { PixelAvatar } from "@pacsarcade/arcade-ui";
import useFrenSession from "@/hooks/useFrenSession";
import useNostrProfile from "@/hooks/useNostrProfile";

/**
 * The face on the marquee — rendered INSIDE SiteHeader's trigger button
 * (identityAsTrigger), so no links or buttons in here: pressing the chip
 * opens the menu, and navigation lives in the menu rows.
 *
 * Signed out: the vacant ghost — nobody's home, press to find the door.
 * Signed in: the fren's kind-0 picture, or their seeded pixel body.
 */
export default function FrenChip() {
  const { fren, checked } = useFrenSession();
  const { profile } = useNostrProfile(fren?.npub);

  if (!checked) return <span className="w-8" aria-hidden />;

  if (!fren) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <PixelAvatar variant="ghost" size={32} />
        <span className="hidden whitespace-nowrap font-pixel text-[10px] text-coin glow-coin md:block">
          LOGIN
        </span>
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      {profile?.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.picture}
          alt=""
          className="h-8 w-8 flex-none border-2 border-cyan object-cover"
        />
      ) : (
        <PixelAvatar variant="player" seed={fren.handle} size={32} />
      )}
      <span className="hidden max-w-28 truncate font-pixel text-[10px] text-cyan md:block">
        {fren.handle.toUpperCase()}
      </span>
    </span>
  );
}
