import Link from "next/link";

/**
 * GAME OVER as an invitation, not an ending: no fren holds this tag, so it
 * might be free — press start and take it. The registration link pre-fills
 * the searched tag. Reserved names get the honest version instead of a
 * "might be free" promise the claim API would immediately break.
 */
export default function GameOverTag({
  handle,
  spaceTag,
  registerHref,
  reserved,
  elsewhereSpace = null,
}: {
  handle: string;
  spaceTag: string;
  registerHref: string;
  reserved: boolean;
  /** The tag exists behind another door — offer it before selling a claim */
  elsewhereSpace?: string | null;
}) {
  const pressStartHref = reserved
    ? registerHref
    : `${registerHref}${registerHref.includes("?") ? "&" : "?"}tag=${encodeURIComponent(handle)}`;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-void px-6 text-center">
      <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">
        PAC&apos;S ARCADE ▸ TAG NOT FOUND
      </p>
      <p className="font-arcade text-5xl text-ghost glow-ghost">GAME OVER</p>
      <p className="font-pixel text-xs uppercase text-white/80">
        NO FREN HOLDS <span className="text-coin">{handle}{spaceTag}</span>
      </p>
      {reserved ? (
        <p className="max-w-md font-body text-lg text-white/80">
          This one&apos;s held back by the arcade, fren — it can&apos;t go on the board. Another
          name is waiting for you, first-come.
        </p>
      ) : (
        <p className="max-w-md font-body text-lg text-white/80">
          Which means it might be free, fren. Tags are first-come — press start and make it yours
          before another player does.
        </p>
      )}
      {elsewhereSpace && !reserved && (
        <p className="border-2 border-cyan/60 px-4 py-3 font-pixel text-[10px] uppercase text-cyan">
          THIS TAG LIVES BEHIND THE OTHER DOOR —{" "}
          <Link href={`/u/${handle}@${elsewhereSpace}`} className="underline hover:glow-cyan">
            VIEW {handle.toUpperCase()}@{elsewhereSpace.toUpperCase()} ▸
          </Link>
        </p>
      )}
      <Link href={pressStartHref} className="button pulse-neon">
        ▶ NEW PLAYER — PRESS START
      </Link>
      <Link href={registerHref} className="font-pixel text-xs text-cyan hover:glow-cyan">
        SEARCH ANOTHER TAG
      </Link>
      <p className="font-pixel text-[10px] uppercase text-white/40">
        REGISTRATION IS FREE — THE ARCADE&apos;S TREAT
      </p>
      <p className="font-pixel text-xs text-white/40">
        <Link href="https://pacsarcade.org" className="text-cyan hover:glow-cyan">
          BACK TO PAC&apos;S ARCADE
        </Link>
      </p>
    </main>
  );
}
