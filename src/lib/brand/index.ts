/**
 * The themeable sign-in brand kit — public surface.
 *
 * Consumers:
 *   import { BrandProvider, degenTheme } from "@/lib/brand";
 *   <BrandProvider theme={degenTheme}><LoginPanel /></BrandProvider>
 */
export type {
  BrandTheme,
  BrandTokens,
  BrandFonts,
  BrandCopy,
  BrandDoor,
  DoorAccent,
} from "./contract";
export { BrandProvider, useBrand, brandCssVars } from "./BrandProvider";
export { frensTheme } from "./themes/frens";
export { frensEarthTheme } from "./themes/frens-earth";
export { degenTheme } from "./themes/degen";

import { frensTheme } from "./themes/frens";
import { frensEarthTheme } from "./themes/frens-earth";
import { degenTheme } from "./themes/degen";
import type { BrandTheme } from "./contract";

/** All built-in themes, keyed by id — handy for a theme switcher / preview. */
export const THEMES: Record<string, BrandTheme> = {
  frens: frensTheme,
  "frens-earth": frensEarthTheme,
  degen: degenTheme,
};
