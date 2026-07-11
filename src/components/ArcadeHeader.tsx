import { SiteHeader } from "@pacsarcade/arcade-ui";
import FrenChip from "@/components/FrenChip";
import FrenMenu from "@/components/FrenMenu";
import FrenMenuFooter from "@/components/FrenMenuFooter";

/**
 * The one header — chip-as-menu (header v4): the fren's face IS the menu
 * button, sign-out shares the bottom row with the easy-eyes toggle. Every
 * page renders this instead of wiring SiteHeader slots by hand, so the next
 * header change is a one-file edit.
 */
export default function ArcadeHeader() {
  return (
    <SiteHeader
      wordmark="FRENS.EARTH"
      // frens.earth's own mark — a sprouting planet, not the arcade's coin.
      coinSrc="/frens-mark.svg"
      links={[
        // PLAY = frens.earth's own game — Bitcoin Buddy (/bb), the only game here for now.
        // LEARN/GROW stay under Pac's Arcade until frens.earth grows its own.
        { href: "/bb", label: "PLAY" },
        { href: "https://pacsarcade.org/classes", label: "LEARN" },
        { href: "https://pacsarcade.org/campaigns", label: "GROW" },
      ]}
      identityAsTrigger
      identitySlot={<FrenChip />}
      menuSlot={<FrenMenu />}
      menuFooterSlot={<FrenMenuFooter />}
    />
  );
}
