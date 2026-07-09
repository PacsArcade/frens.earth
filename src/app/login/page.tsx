import type { Metadata } from "next";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import LoginPanel from "@/components/LoginPanel";

export const metadata: Metadata = {
  title: "Login — Pac's Arcade",
  description:
    "Sign in with your key — no passwords, nothing stored. New here? Two doors: a free @frens play tag, or your @pacsarcade school account.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <div className="px-6 py-12">
        <div className="mx-auto mb-8 max-w-md text-center">
          <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
            PAC&apos;S ARCADE ▸ LOGIN
          </p>
          <h1 className="font-arcade text-4xl text-coin glow-coin">INSERT KEY</h1>
        </div>
        <LoginPanel />
      </div>
      <EarthFooter />
    </main>
  );
}
