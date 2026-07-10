import type { BrandTheme } from "../contract";

/**
 * frens.earth — "Digital Renaissance" PLACEHOLDER brand.
 *
 * frens.earth has its own identity: cozy earth with a future edge. Deep loam
 * surfaces, sprout-neon for what's alive, verification teal for what's true,
 * harvest gold only where money moves, and the purple heart 💜 as the flair.
 * Tick tock — everything gets tied to the block.
 *
 * PLACEHOLDER means: the brand team owns the real deliverables (logos,
 * banners, fonts, colors, accents). When those land, their values replace
 * these slots — same contract, zero markup changes. Until then this sets a
 * neutral, fun tone that is clearly not the arcade's midnight neon.
 * Semantic slots stay honest per the house rules: coin = money ONLY,
 * neon = live/success, cyan = info, ghost = danger, pink = flair.
 */
export const frensEarthTheme: BrandTheme = {
  id: "frens-earth",
  label: "frens.earth — Digital Renaissance (placeholder)",
  tokens: {
    // surfaces — the night garden
    void: "#0d1210",
    panel: "#151d18",
    edge: "#2f4033",
    // semantic accents (locked meanings, new hues)
    coin: "#f7c948", // harvest gold — money only
    neon: "#5ef78a", // sprout — live/success
    cyan: "#53e0d4", // verification teal — info ("trust because we verify")
    ghost: "#ff6b6b", // ember — danger
    pink: "#b795ff", // 💜 heartlight — the one free-moving flair accent
    // legacy base (body + .button)
    background: "#0d1210",
    foreground: "#f1efe7",
    primary: "#f7c948",
    secondary: "#151d18",
    border: "#2f4033",
    accent: "#b795ff",
  },
  fonts: {
    /* Placeholder keeps the pixel DNA — typefaces are a brand-team
       deliverable; they land here as font slots when chosen. */
    arcade: "var(--font-retronoid), var(--font-press-start), monospace",
    pixel: "var(--font-press-start), monospace",
    body: "var(--font-roboto), sans-serif",
  },
  copy: {
    productName: "frens.earth",
    memberNoun: "fren",
    loginKicker: "FRENS.EARTH ▸ LOGIN",
    loginTitle: "KEYS OPEN DOORS",
    returningTitle: "WELCOME HOME, FREN",
    returningBlurb:
      "Your key is your login — sign a fresh challenge and you're home. We don't ask for trust here; we verify it. Nothing stored, nothing to leak.",
    signInCta: "▶ VERIFY ME",
    signingCta: "READING YOUR SIGNATURE…",
    doorsHeading: "NO TAG YET? THE GARDEN HAS A GATE",
    doorsFootnote:
      "Tick tock — every tag gets tied to the block. It's free and it's yours — stay sovereign, grow with your frens.",
  },
  doors: [
    {
      tag: "@FRENS",
      role: "THE HOME ACCOUNT",
      blurb:
        "Free forever. Your tag, your keys, your patch of earth — play, learn, back your frens. The digital renaissance starts at home.",
      href: "/",
      cta: "CLAIM YOUR TAG ▸",
      accent: "neon",
    },
    {
      tag: "@PACSARCADE",
      role: "THE SCHOOL ACCOUNT",
      blurb:
        "When you're ready to go deeper: classes → etched certs → the artist gate. School is a walk up the road — same keys, same frens.",
      href: "https://pacsarcade.org/register",
      cta: "ENROLL AT THE ARCADE ▸",
      accent: "pink",
    },
  ],
  roleLabels: {
    frens: "HOME",
    pacsarcade: "SCHOOL",
  },
};
