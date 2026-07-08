import type { BrandTheme } from "../contract";

/**
 * The default theme — the current frens.earth / Pac's Arcade "midnight" look,
 * extracted verbatim from arcade-ui's tailwind theme + globals.css `:root`
 * and LoginPanel's copy. Because these are the exact strings/values used
 * today, an un-wrapped sign-in (no BrandProvider) renders byte-identically.
 */
export const frensTheme: BrandTheme = {
  id: "frens",
  label: "Pac's Arcade — Midnight",
  tokens: {
    void: "#050505",
    panel: "#1a1a1a",
    edge: "#333333",
    coin: "#ffd700",
    neon: "#39ff14",
    cyan: "#00ffff",
    ghost: "#e91e63",
    pink: "#ff00ff",
    background: "#000000",
    foreground: "#ffffff",
    primary: "#FFD700",
    secondary: "#1a1a1a",
    border: "#333333",
    accent: "#E91E63",
  },
  fonts: {
    arcade: "var(--font-retronoid), var(--font-press-start), monospace",
    pixel: "var(--font-press-start), monospace",
    body: "var(--font-roboto), sans-serif",
    // no `button` override — keep the host's next/font Press Start 2P
  },
  copy: {
    productName: "Pac's Arcade",
    memberNoun: "fren",
    loginKicker: "PAC'S ARCADE ▸ LOGIN",
    loginTitle: "INSERT KEY",
    returningTitle: "RETURNING FREN?",
    returningBlurb:
      "Your key is your login — sign a fresh challenge and land on your profile. No password, nothing stored, nothing to leak.",
    signInCta: "▶ SIGN IN WITH MY KEY",
    signingCta: "WAITING FOR YOUR KEY…",
    doorsHeading: "NO ACCOUNT? TWO DOORS, ONE ARCADE",
    doorsFootnote:
      "Two accounts is a feature, fren: experiment on one, keep the other clean — blast radius is self-custody's first habit.",
  },
  doors: [
    {
      tag: "@FRENS",
      role: "THE PLAY ACCOUNT",
      blurb:
        "Free for everyone. Learn together, test, tinker, join classes, back campaigns — the account you can afford to experiment with. As frens, we learn together.",
      href: "https://frens.earth",
      cta: "GET YOUR PLAY TAG — FREE ▸",
      accent: "cyan",
    },
    {
      tag: "@PACSARCADE",
      role: "THE SCHOOL ACCOUNT",
      blurb:
        "The step up when you commit to the path: classes → etched certs → the artist gate → running campaigns. When you're ready for school, this is enrollment.",
      href: "/register",
      cta: "SET UP YOUR SCHOOL ACCOUNT ▸",
      accent: "pink",
    },
  ],
  roleLabels: {
    frens: "PLAY",
    pacsarcade: "SCHOOL",
  },
};
