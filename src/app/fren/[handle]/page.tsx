import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FrenProfile from "@/components/FrenProfile";
import { getEntry, validateHandle } from "@/lib/registry";
import { SPACE_NAME, NIP05_DOMAIN } from "@/lib/identity-config";

/* The registry changes with every registration — never serve a cached
   "tag not found" to a fren who registered seconds ago. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const tag = `${decodeURIComponent(handle)}@${SPACE_NAME}`;
  return {
    title: `${tag} — fren profile — Pac's Arcade`,
    description: `${tag} is registered on the board: verified on nostr today, etched to Bitcoin at the next ceremony.`,
  };
}

export default async function FrenProfileRoute({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const valid = validateHandle(decodeURIComponent(raw));
  if (!valid.ok) notFound();
  const entry = await getEntry(valid.handle);
  if (!entry) notFound();
  return (
    <FrenProfile
      handle={entry.handle}
      npub={entry.npub}
      status={entry.status}
      requestedAt={entry.requestedAt}
      space={SPACE_NAME}
      nip05Domain={NIP05_DOMAIN}
    />
  );
}
