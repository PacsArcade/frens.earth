import type { Metadata } from "next";
import LoginPanel from "@/components/LoginPanel";
import RegistrationPage from "@/components/RegistrationPage";
import { BrandProvider, frensTheme, degenTheme, type BrandTheme } from "@/lib/brand";

/**
 * DEV PREVIEW ONLY — proof that one sign-in package renders in two brands.
 * Not linked from anywhere; safe to delete. Each column wraps the SAME
 * LoginPanel / TagClaim in a BrandProvider carrying a different BrandTheme,
 * so the identical components paint in each brand's colors, fonts and copy.
 */
export const metadata: Metadata = {
  title: "Brand preview — themeable sign-in",
  robots: { index: false, follow: false },
};

function Column({ theme }: { theme: BrandTheme }) {
  return (
    <BrandProvider theme={theme} className="min-w-0 flex-1 bg-void p-6">
      <div className="mx-auto mb-8 max-w-md text-center">
        <p className="mb-3 font-pixel text-[10px] uppercase tracking-widest text-white/40">
          {theme.copy.loginKicker}
        </p>
        <h1 className="font-arcade text-4xl text-coin glow-coin">{theme.copy.loginTitle}</h1>
        <p className="mt-2 font-body text-xs text-white/40">theme: {theme.label}</p>
      </div>
      <LoginPanel />
    </BrandProvider>
  );
}

export default function BrandPreviewPage() {
  return (
    <main className="min-h-screen bg-black">
      <div className="border-b-2 border-edge bg-void px-6 py-4 text-center">
        <p className="font-pixel text-xs text-cyan glow-cyan">
          THEMEABLE SIGN-IN · ONE PACKAGE, TWO BRANDS
        </p>
      </div>

      {/* Same LoginPanel, two themes, side by side */}
      <div className="flex flex-col gap-2 lg:flex-row">
        <Column theme={frensTheme} />
        <Column theme={degenTheme} />
      </div>

      {/* Same TagClaim (registration machine) in each brand */}
      <div className="flex flex-col gap-2 lg:flex-row">
        <BrandProvider theme={frensTheme} className="min-w-0 flex-1 bg-void">
          <RegistrationPage space="frens" nip05Domain="frens.earth" />
        </BrandProvider>
        <BrandProvider theme={degenTheme} className="min-w-0 flex-1 bg-void">
          <RegistrationPage space="degen" nip05Domain="degenwonderland.com" />
        </BrandProvider>
      </div>
    </main>
  );
}
