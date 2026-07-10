import type { Metadata } from "next";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import LoginPanel from "@/components/LoginPanel";
import { frensEarthTheme } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Login — frens.earth",
  description:
    "Sign in with your key — no passwords, nothing stored. New here? Two doors: a free @frens home tag, or your @pacsarcade school account.",
};

/* The page header reads the SAME theme the layout injects, so the words and
   the paint can never disagree. */
export default function LoginPage() {
  const { copy } = frensEarthTheme;
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <div className="px-6 py-12">
        <div className="mx-auto mb-8 max-w-md text-center">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            {copy.loginKicker}
          </p>
          <h1 className="font-arcade text-4xl text-coin glow-coin">{copy.loginTitle}</h1>
        </div>
        <LoginPanel />
      </div>
      <EarthFooter />
    </main>
  );
}
