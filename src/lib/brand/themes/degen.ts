import type { BrandTheme } from "../contract";

/**
 * Degen Wonderland theme — proves the same sign-in renders in a completely
 * different brand. Colors come from the REAL degenwonderland/src/app/globals.css
 * palette (dark psychedelic purple with gold/green/cyan/pink accents), mapped
 * onto the arcade-ui semantic slots:
 *
 *   surfaces  void/panel/edge  ← bg-void / bg-card / purple-mid
 *   coin(money)  ← accent-gold   neon(live) ← accent-green
 *   cyan(info)   ← accent-cyan   ghost(danger) ← accent-pink
 *   pink(flair)  ← 624 nm ember  (see note below)
 *
 * NOTE ON THE EMBER: the design brief calls DW's signature a "624 nm
 * orange-red #FF4500–#FF6600", but degenwonderland's committed globals.css
 * has NO orange-red — it is purple/gold. So the ember is used only for the
 * FLAIR slot (which globals.css leaves unpinned) and the button CTA. If Pac
 * wants DW to stay pure-purple, change `pink`/`primary` to purple-glow
 * (#9d8bc4). This is the one open brand decision in this theme.
 */
export const degenTheme: BrandTheme = {
  id: "degen",
  label: "Degen Wonderland",
  tokens: {
    void: "#0a0810",
    panel: "#1a1428",
    edge: "#382e4d",
    coin: "#d4a843", // DW accent-gold → money/funding
    neon: "#3de08c", // DW accent-green → live/success
    cyan: "#00cec9", // DW accent-cyan → info/links
    ghost: "#e84393", // DW accent-pink → danger/warnings
    pink: "#ff4500", // 624 nm ember → flair (see NOTE)
    background: "#0a0810",
    foreground: "#eee8f5",
    primary: "#ff4500", // ember button CTA
    secondary: "#1a1428",
    border: "#382e4d",
    accent: "#9d8bc4", // purple-glow → button drop shadow
  },
  fonts: {
    arcade: "'Lewis Carroll', 'Georgia', serif",
    pixel: "'Lewis Carroll', 'Georgia', serif",
    body: "'Inter', system-ui, sans-serif",
    button: "'Lewis Carroll', 'Georgia', serif",
  },
  copy: {
    productName: "Degen Wonderland",
    memberNoun: "degen",
    loginKicker: "DEGEN WONDERLAND ▸ SIGN IN",
    loginTitle: "DOWN THE RABBIT HOLE",
    returningTitle: "BACK AGAIN, DEGEN?",
    returningBlurb:
      "Your key is your login — sign a fresh challenge and step back through the looking glass. No password, nothing stored, nothing to leak.",
    signInCta: "▶ SIGN IN WITH MY KEY",
    signingCta: "WAITING FOR YOUR KEY…",
    doorsHeading: "NEW HERE? PICK YOUR RABBIT HOLE",
    doorsFootnote:
      "Two keys, two selves — mint on one, keep the other clean. Blast radius is self-custody's first habit.",
  },
  doors: [
    {
      tag: "@DEGEN",
      role: "THE WONDERLAND PASS",
      blurb:
        "Free for everyone. Explore the collection, join the mint, follow the White Rabbit — the identity you carry all the way down the hole.",
      href: "https://degenwonderland.com",
      cta: "GET YOUR DEGEN TAG — FREE ▸",
      accent: "cyan",
    },
  ],
  roleLabels: {
    degen: "WONDER",
  },
};
