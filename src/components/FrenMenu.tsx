"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PixelAvatar } from "@pacsarcade/arcade-ui";
import useFrenSession from "@/hooks/useFrenSession";
import useNostrProfile from "@/hooks/useNostrProfile";
import { SPACE_ROLES } from "@/lib/identity-config";

/* The admin deck row — for a live operator session OR a fren whose key is on
   the operator allowlist (`eligible`: the door shows, the gate still takes a
   fresh signature). Cookies are httpOnly, so the menu asks the whoami
   endpoint; everyone else never sees the row. */
function useIsOperator(): boolean {
  const [isOp, setIsOp] = useState(false);
  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => setIsOp(!!d.ok || !!d.eligible))
      .catch(() => {});
  }, []);
  return isOp;
}

function AdminDeckRow() {
  return (
    <Link
      href="/a"
      className="flex min-h-11 items-center gap-2 border-b-2 border-edge px-4 font-pixel text-[10px] text-coin glow-coin"
    >
      <span aria-hidden>⚓</span> SCAR·LET
    </Link>
  );
}

/* Floor accents: pink = school/artist, cyan = play. The same colors the
   profile banner wears — a fren always knows which door they're behind. */
function accentText(space: string): string {
  return space === "pacsarcade" ? "text-pink" : "text-cyan";
}

/**
 * The menu's identity rows — who you are up top (accent-striped by floor),
 * then your doors. Signed in: identity block, MY PROFILE, and a SWITCH row
 * for every other door signed in on this browser. Signed out: the LOGIN
 * door. SIGN OUT lives in the menu footer (split with easy-eyes).
 */
export default function FrenMenu() {
  const router = useRouter();
  const { fren, accounts, switchTo } = useFrenSession();
  const { profile } = useNostrProfile(fren?.npub);
  const isOperator = useIsOperator();

  if (!fren) {
    return (
      <>
        <Link
          href="/login"
          className="flex min-h-11 items-center border-b-2 border-edge px-4 font-pixel text-[10px] text-coin glow-coin"
        >
          🕹️ LOGIN
        </Link>
        {isOperator && <AdminDeckRow />}
      </>
    );
  }

  const others = accounts.filter((a) => !(a.handle === fren.handle && a.space === fren.space));

  return (
    <>
      {/* who you are — full identity, striped with the floor's accent */}
      <div
        className={`flex items-center gap-3 border-b-2 border-l-4 border-edge bg-void px-4 py-3 ${
          fren.space === "pacsarcade" ? "border-l-pink" : "border-l-cyan"
        }`}
      >
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
          <span className={`block font-mono text-[10px] ${accentText(fren.space)}`}>
            @{fren.space} · {(SPACE_ROLES[fren.space] ?? "verse").toLowerCase()}
          </span>
        </span>
      </div>
      <Link
        href={`/u/${fren.handle}@${fren.space}`}
        className="flex min-h-11 items-center border-b-2 border-edge px-4 font-pixel text-[10px] text-cyan"
      >
        MY PROFILE
      </Link>
      {isOperator && <AdminDeckRow />}
      {/* the door switcher — every other signed-in door, one press away */}
      {others.map((a) => (
        <button
          key={`${a.handle}@${a.space}`}
          type="button"
          onClick={async () => {
            if (await switchTo(a.handle, a.space)) router.refresh();
          }}
          className="flex min-h-11 w-full cursor-pointer items-center gap-2 border-b-2 border-edge px-4 text-left font-pixel text-[10px] text-white/60 hover:text-cyan"
        >
          <span aria-hidden>⇄</span>
          <span className="truncate">
            {a.handle.toUpperCase()}
            <span className={`ml-1 normal-case ${accentText(a.space)}`}>@{a.space}</span>
          </span>
        </button>
      ))}
    </>
  );
}
