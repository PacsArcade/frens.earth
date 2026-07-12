/**
 * The one footer of frens.earth — and its ONLY outbound link. A fren stays
 * on this page; the single credit line says where the love came from.
 * Values line stays link-free on purpose: it's a promise, not navigation.
 */
export default function EarthFooter() {
  return (
    <footer className="border-t-2 border-edge px-6 py-10 text-center">
      <p className="font-pixel text-xs leading-relaxed text-white/40">
        YOUR TAG BELONGS TO YOU — WE NEVER SEE OR STORE YOUR SECRET KEY
      </p>
      <p className="mt-3 font-pixel text-[10px] leading-relaxed text-white/40">
        FRENS.EARTH — MADE WITH LOVE AT{" "}
        <a href="https://pacsarcade.org" className="text-pink hover:glow-pink">
          PAC&apos;S ARCADE
        </a>{" "}
        · A 501(C)(3) NON-PROFIT
      </p>
      {/* Discoverable, not loud: glyphs + brand assets + a press blurb, all on-site. */}
      <p className="mt-3 font-pixel text-[10px] leading-relaxed text-white/30">
        <a href="/media" className="hover:text-cyan hover:glow-cyan">
          MEDIA / PRESS
        </a>
      </p>
    </footer>
  );
}
