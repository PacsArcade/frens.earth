import type { Metadata } from "next";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import MePanel from "@/components/me/MePanel";

export const metadata: Metadata = {
  title: "My tag — frens.earth",
  description:
    "Your tag, your sessions, your profile card — the fren's own control room. Sign in with your key to open it.",
};

/**
 * /me — the profile builder. Fren-session gated: the panel reads the
 * session client-side (honest "sign in first" when there is none), and
 * every API it touches checks the cookie server-side — the page is the
 * doorway, the routes are the locks.
 */
export default function MePage() {
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <div className="px-6 py-12">
        <MePanel />
      </div>
      <EarthFooter />
    </main>
  );
}
