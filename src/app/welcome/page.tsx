import type { Metadata } from "next";
import { headers } from "next/headers";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import WelcomeWizard from "@/components/welcome/WelcomeWizard";
import { spaceForHost } from "@/lib/identity-config";

export const metadata: Metadata = {
  title: "Welcome, fren — the walk-in path",
  description:
    "Signer, tag, face, wallet — the whole nostr onboarding gauntlet, walked with you step by step. Skip anything; nothing punishes you.",
};

/**
 * /welcome — the onboarding wizard. Exists because the raw nostr gauntlet
 * is brutal to walk alone: this is the same claim machine and the same
 * profile plumbing as everywhere else, laid out as a path. The host decides
 * the space (brand cartridge law), same as the registration page.
 */
export default async function WelcomePage() {
  const host = (await headers()).get("host") ?? "";
  const { space, nip05Domain } = spaceForHost(host);
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <div className="px-6 py-12">
        <WelcomeWizard space={space} nip05Domain={nip05Domain} />
      </div>
      <EarthFooter />
    </main>
  );
}
