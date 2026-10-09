/**
 * The one footer of frens.earth — and its ONLY outbound link. A fren stays
 * on this page; the single credit line says where the love came from.
 * Values line stays link-free on purpose: it's a promise, not navigation.
 */
export default function EarthFooter() {
  return (
    <footer className="border-t-2 border-edge px-6 py-10 text-center">
      <p className="r6-foot font-body leading-relaxed">
        Your tag belongs to you. We never see or store your secret key.
      </p>
      <p className="r6-foot mt-3 font-body leading-relaxed">
        Frens.earth. Made with love at{" "}
        <a href="https://pacsarcade.org" className="text-pink hover:glow-pink">
          Pac&apos;s Arcade
        </a>
        . A non-profit in formation.
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
