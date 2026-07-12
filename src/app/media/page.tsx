import type { Metadata } from "next";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import MediaKit from "@/components/MediaKit";

/**
 * /media — the house MEDIA / ASSETS page: copy-to-clipboard bitcoin glyphs
 * (₿, the sat mark, a₿ / b₿ / ▣, ⚡), the frens.earth brand assets (mark,
 * wordmark, palette), and a press blurb. So nobody has to leave home to grab
 * a ₿. Gold rides money only.
 */
export const metadata: Metadata = {
  title: "Media & assets — frens.earth",
  description:
    "Copy bitcoin glyphs (₿, sats, a₿, ▣, ⚡) and frens.earth brand assets — the mark, wordmark, palette, and a press blurb. No trip to emojipedia required.",
};

export default function MediaPage() {
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <MediaKit />
      <EarthFooter />
    </main>
  );
}
