import type { Metadata } from "next";
import RegistrationPage from "@/components/RegistrationPage";
import { SPACE_NAME, NIP05_DOMAIN } from "@/lib/identity-config";

export const metadata: Metadata = {
  title: "Claim your player tag — Pac's Arcade",
  description: `Free sovereign bitcoin handles from @${SPACE_NAME}. Your name, your keys — verifiable on nostr today, permanent on Bitcoin at the next batch.`,
};

export default function Home() {
  return <RegistrationPage space={SPACE_NAME} nip05Domain={NIP05_DOMAIN} />;
}
