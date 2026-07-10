import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ROM LOAD ERROR — frens.earth",
  description: "This cabinet won't boot. The page you're looking for isn't on the floor.",
};

/**
 * 404 as a busted arcade cabinet stuck in a glitchy attract mode — "MACHINE A · ROM LOAD ERROR".
 * Neon line-art cabinet (reusing the arcade's cyan→blue→pink synthwave look), pure-CSS glitch +
 * scanlines, no JS. Wraps in the site layout, so the header/footer stay put.
 */
export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-8 py-10 text-center">
      <style>{`
        @keyframes bb404-flicker { 0%,100%{opacity:1} 42%{opacity:1} 43%{opacity:.25} 45%{opacity:1} 60%{opacity:1} 61%{opacity:.4} 63%{opacity:1} 88%{opacity:1} 89%{opacity:.15} 90%{opacity:1} }
        @keyframes bb404-glitch { 0%,100%{text-shadow:2px 0 #53e0d4,-2px 0 #b795ff;transform:translate(0,0)} 20%{text-shadow:-2px 0 #53e0d4,2px 0 #b795ff;transform:translate(1px,-1px)} 40%{text-shadow:2px 0 #ff6b6b,-2px 0 #53e0d4;transform:translate(-1px,0)} 60%{text-shadow:-1px 0 #b795ff,2px 0 #53e0d4;transform:translate(1px,1px)} 80%{text-shadow:2px 0 #53e0d4,-2px 0 #b795ff;transform:translate(-1px,0)} }
        @keyframes bb404-scan { 0%{transform:translateY(-10%)} 100%{transform:translateY(110%)} }
        @keyframes bb404-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes bb404-shake { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-1px,1px)} 50%{transform:translate(1px,0)} 75%{transform:translate(0,-1px)} }
        @keyframes bb404-jitter { 0%,100%{clip-path:inset(0 0 0 0)} 20%{clip-path:inset(30% 0 40% 0)} 21%{clip-path:inset(0 0 0 0)} 55%{clip-path:inset(60% 0 10% 0)} 56%{clip-path:inset(0 0 0 0)} }
        .bb404-cab { filter: drop-shadow(0 0 6px rgba(83,224,212,.55)) drop-shadow(0 0 22px rgba(83,224,212,.25)); animation: bb404-shake 3.2s steps(4) infinite; }
        .bb404-screen { animation: bb404-flicker 4.5s infinite; }
        .bb404-err { animation: bb404-glitch .9s steps(2) infinite; }
        .bb404-scanline { animation: bb404-scan 2.6s linear infinite; }
        .bb404-jit { animation: bb404-jitter 3.7s steps(2) infinite; }
        .bb404-blink { animation: bb404-blink 1.1s steps(1) infinite; }
        @media (prefers-reduced-motion: reduce) { .bb404-cab,.bb404-screen,.bb404-err,.bb404-scanline,.bb404-jit,.bb404-blink{animation:none!important} .bb404-err{text-shadow:1px 0 #53e0d4,-1px 0 #b795ff} }
      `}</style>

      {/* ── the cabinet ── */}
      <div className="relative w-full max-w-[280px]">
        <svg viewBox="0 0 240 336" className="bb404-cab w-full" fill="none" stroke="#53e0d4" strokeWidth="2.4" strokeLinejoin="round" aria-hidden>
          {/* marquee */}
          <path d="M58 16 H182 L196 48 H44 Z" />
          {/* little ghost token on the marquee */}
          <path d="M104 40 v-9 a8 8 0 0 1 16 0 v9 l-4 -3 -4 3 -4 -3 Z" stroke="#b795ff" />
          {/* body */}
          <path d="M44 48 H196 V300 H44 Z" />
          {/* screen bezel */}
          <rect x="60" y="64" width="120" height="96" rx="7" />
          {/* control-panel shelf */}
          <path d="M44 190 H196 M52 214 H188" />
          <path d="M60 190 L52 214 M180 190 L188 214" />
          {/* joystick + buttons */}
          <circle cx="86" cy="203" r="5" stroke="#b795ff" />
          <line x1="86" y1="203" x2="86" y2="194" stroke="#b795ff" />
          <circle cx="146" cy="205" r="3.5" stroke="#ff6b6b" />
          <circle cx="162" cy="205" r="3.5" stroke="#f7c948" />
          {/* coin door */}
          <rect x="98" y="244" width="44" height="34" rx="3" />
          <line x1="112" y1="252" x2="128" y2="252" stroke="#f7c948" />
          {/* base + feet */}
          <path d="M36 300 H204 V318 H36 Z" />
          <path d="M52 318 V330 M188 318 V330" />
        </svg>

        {/* the screen — glitchy attract mode, positioned over the bezel */}
        <div className="bb404-screen absolute overflow-hidden rounded-[6px]"
          style={{ left: "25%", top: "19%", width: "50%", height: "28.5%", background: "radial-gradient(120% 100% at 50% 0%, #0c1f1c, #050b0a)" }}>
          <div className="bb404-jit flex h-full flex-col items-center justify-center gap-1 px-2 font-mono leading-none">
            <span className="text-[6px] tracking-[0.3em] text-cyan/70">MACHINE A</span>
            <span className="bb404-err text-[11px] font-bold tracking-widest text-cyan">ROM LOAD</span>
            <span className="bb404-err text-[11px] font-bold tracking-widest text-cyan">ERROR</span>
            <span className="text-[6px] tracking-[0.25em] text-pink/80">0x0000_0404</span>
          </div>
          <div className="bb404-scanline pointer-events-none absolute inset-x-0 top-0 h-4"
            style={{ background: "linear-gradient(rgba(83,224,212,0), rgba(83,224,212,.18), rgba(83,224,212,0))" }} />
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,.32) 0 1px, transparent 1px 3px)" }} />
        </div>
      </div>

      {/* ── the message ── */}
      <div className="flex flex-col items-center gap-3">
        <h1 className="bb404-err font-arcade text-4xl text-cyan sm:text-5xl">404</h1>
        <p className="font-pixel text-xs uppercase tracking-widest text-neon glow-neon">Cabinet failed to boot</p>
        <p className="max-w-sm font-body text-sm text-white/70">
          This machine&apos;s ROM won&apos;t load — the page you&apos;re looking for isn&apos;t on the floor.
          Give the cabinet a whack, or head back to the arcade.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Link href="/" className="button">◄ RETURN TO THE FLOOR</Link>
        <span className="bb404-blink font-pixel text-[10px] uppercase tracking-[0.3em] text-white/50">Insert coin to continue</span>
      </div>
    </section>
  );
}
