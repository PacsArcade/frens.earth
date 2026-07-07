"use client";

import { useRouter } from "next/navigation";
import { EasyModeToggle } from "@pacsarcade/arcade-ui";
import useFrenSession from "@/hooks/useFrenSession";

/**
 * The menu's bottom row (SiteHeader menuFooterSlot — deliberately outside
 * the auto-close wrapper so the toggle doesn't shut the panel). Signed in:
 * the row splits in half — SIGN OUT | EASY ON THE EYES. Signed out there's
 * nothing to sign out of, so the toggle keeps the full row.
 */
export default function FrenMenuFooter() {
  const router = useRouter();
  const { fren, signOut } = useFrenSession();

  const easy = (
    <span className="flex min-w-0 items-center gap-2">
      <EasyModeToggle />
      <span className="truncate font-pixel text-[8px] uppercase text-white/60">
        EASY ON THE EYES
      </span>
    </span>
  );

  if (!fren) {
    return <div className="flex min-h-11 items-center px-4 py-2">{easy}</div>;
  }

  return (
    <div className="grid grid-cols-2 divide-x-2 divide-edge">
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.refresh();
        }}
        className="flex min-h-11 cursor-pointer items-center px-3 text-left font-pixel text-[9px] uppercase text-white/50 hover:text-ghost"
      >
        SIGN OUT
      </button>
      <div className="flex min-h-11 items-center px-3 py-2">{easy}</div>
    </div>
  );
}
