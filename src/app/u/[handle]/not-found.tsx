import Link from "next/link";

/* No entry on the board for this tag — the arcade's 404. */
export default function FrenNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-void px-6 text-center">
      <p className="font-arcade text-5xl text-ghost glow-ghost">GAME OVER</p>
      <p className="max-w-md font-body text-lg text-white/80">
        No fren holds this tag yet. The board doesn&apos;t know it — which means it might still be
        up for grabs.
      </p>
      <Link href="/" className="button">
        ▶ REGISTER A TAG
      </Link>
      <p className="font-pixel text-xs text-white/40">
        <Link href="https://pacsarcade.org" className="text-cyan hover:glow-cyan">
          BACK TO PAC&apos;S ARCADE
        </Link>
      </p>
    </main>
  );
}
