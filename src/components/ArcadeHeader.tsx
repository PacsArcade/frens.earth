import { SiteHeader } from "@pacsarcade/arcade-ui";
import FrenChip from "@/components/FrenChip";
import FrenMenu from "@/components/FrenMenu";
import FrenMenuFooter from "@/components/FrenMenuFooter";
import StripClock from "@/components/time/StripClock";

/**
 * The one header — chip-as-menu (header v4): the fren's face IS the menu
 * button, sign-out shares the bottom row with the easy-eyes toggle. Every
 * page renders this instead of wiring SiteHeader slots by hand, so the next
 * header change is a one-file edit.
 *
 * The telemetry band under the menu carries THE STRIP CLOCK now (owner
 * marked-up spec, 0018.04.27, frens.earth sibling): the study's flip clock
 * as a flat rectangle — hh:mm:ss, date, the height INSIDE it, all the
 * pacman on its border — study face, frens.earth frame, in place of the
 * old "■ BLOCK N" ticker. The whole strip opens /time.
 */
export default function ArcadeHeader() {
  return (
    <>
    <SiteHeader
      wordmark="FRENS.EARTH"
      // frens.earth's own mark — a sprouting planet, not the arcade's coin.
      coinSrc="/frens-mark.svg"
      links={[
        // Doors that exist only: the shelf, the game, then the arcade's LEARN and GROW.
        { href: "/store", label: "SHELF" },
        // The three doors read from public nostr relays (kinds in src/lib/doors).
        { href: "/calendar", label: "CALENDAR" },
        { href: "/market", label: "MARKET" },
        { href: "/rooms", label: "ROOMS" },
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
    {/* Round 3b: the old floating corner clock is gone; the same BFT numbers
        ride one thin glass line directly under the header (strip-clock.css,
        .clock-strip). The SiteHeader's own ticker row stays retired. */}
    <div className="clock-strip">
      <div className="clock-strip-in">
        <StripClock />
      </div>
    </div>
    </>
  );
}
