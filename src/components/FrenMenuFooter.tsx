"use client";

import { useRouter } from "next/navigation";
import { EasyModeToggle } from "@pacsarcade/arcade-ui";
import useFrenSession from "@/hooks/useFrenSession";

/**
 * The menu's bottom row (SiteHeader menuFooterSlot — deliberately outside
 * the auto-close wrapper so the toggle doesn't shut the panel). Signed in:
 * the row splits in half — SIGN OUT | the easy-eyes toggle (icon only,
 * centered, tooltip carries the label). Signed out: the toggle keeps the
 * full row. Sign-out confirms first — it's a lesson, not just a button:
 * your key leaving this site IS how you own your data.
 */

const SIGN_OUT_WARNING =
  "Sign out of everything?\n\n" +
  "This removes your key from this site — that's the point: YOU hold the " +
  "key, so YOU choose which sites, networks, and relays carry your name. " +
  "Sign back in any time with your signer.";

export default function FrenMenuFooter() {
  const router = useRouter();
  const { fren, signOut } = useFrenSession();

  const easy = (
    <span
      className="flex min-w-0 items-center justify-center"
      title="EASY ON THE EYES — dyslexia-friendly text, scanlines off"
    >
      <EasyModeToggle />
    </span>
  );

  if (!fren) {
    return <div className="grid min-h-11 place-items-center px-4 py-2">{easy}</div>;
  }

  return (
    <div className="grid grid-cols-2 divide-x-2 divide-edge">
      <button
        type="button"
        onClick={async () => {
          if (!window.confirm(SIGN_OUT_WARNING)) return;
          await signOut();
          router.refresh();
        }}
        title="Removes your key from this site — sign back in any time"
        className="flex min-h-11 cursor-pointer items-center justify-center px-3 font-pixel text-[9px] uppercase text-white/50 hover:text-ghost"
      >
        SIGN OUT
      </button>
      <div className="grid min-h-11 place-items-center px-3 py-2">{easy}</div>
    </div>
  );
}
