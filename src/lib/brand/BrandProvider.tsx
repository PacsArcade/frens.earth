"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { BrandTheme } from "./contract";
import { frensTheme } from "./themes/frens";

/**
 * BrandProvider — the one place a consumer app injects its brand.
 *
 * Two channels, both driven by a single `BrandTheme`:
 *   1. Colors + fonts → CSS custom properties on a wrapper element. Because
 *      arcade-ui's Tailwind utilities (text-cyan, bg-panel, border-edge, the
 *      .button, …) already resolve to var(--color-*) / var(--*), overriding
 *      those variables on a scope re-themes every child WITHOUT touching a
 *      single className — exactly how arcade-ui's data-arcade-theme works.
 *   2. Copy + doors + roleLabels → React context, read via useBrand().
 *
 * Default context = frensTheme, so a sign-in rendered WITHOUT a provider (the
 * live frens.earth / pacsarcade.org pages today) is byte-identical to before.
 */

const BrandContext = createContext<BrandTheme>(frensTheme);

export function useBrand(): BrandTheme {
  return useContext(BrandContext);
}

/** Map a theme's tokens + fonts onto the CSS variables the components read. */
export function brandCssVars(theme: BrandTheme): CSSProperties {
  const t = theme.tokens;
  const f = theme.fonts;
  const vars: Record<string, string> = {
    // arcade-ui Tailwind @theme colors
    "--color-void": t.void,
    "--color-panel": t.panel,
    "--color-edge": t.edge,
    "--color-coin": t.coin,
    "--color-neon": t.neon,
    "--color-cyan": t.cyan,
    "--color-ghost": t.ghost,
    "--color-pink": t.pink,
    // legacy base vars (globals.css :root — body + .button)
    "--background": t.background,
    "--foreground": t.foreground,
    "--primary": t.primary,
    "--secondary": t.secondary,
    "--border": t.border,
    "--accent": t.accent,
    // type roles
    "--font-arcade": f.arcade,
    "--font-pixel": f.pixel,
    "--font-body": f.body,
  };
  // Only re-face .button when the brand asks — otherwise keep next/font.
  if (f.button) vars["--font-press-start"] = f.button;
  return vars as CSSProperties;
}

export function BrandProvider({
  theme,
  className,
  children,
}: {
  theme: BrandTheme;
  className?: string;
  children: ReactNode;
}) {
  return (
    <BrandContext.Provider value={theme}>
      <div data-brand={theme.id} style={brandCssVars(theme)} className={className}>
        {children}
      </div>
    </BrandContext.Provider>
  );
}
