import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { nip19 } from "nostr-tools";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";
import FrenProfile from "@/components/FrenProfile";
import GameOverTag from "@/components/GameOverTag";
import NpubProfile from "@/components/NpubProfile";
import { getEntry, validateHandle } from "@/lib/registry";
import { getPokeProfile } from "@/lib/poke";
import { spaceForHost, domainForSpace, KNOWN_SPACES } from "@/lib/identity-config";
import { NPUB_RE, shortNpub } from "@/lib/npub-door";

/* /u/<64-hex> is the same key in its raw dress — send it to the one true
   npub URL instead of teaching two spellings. */
const HEX_KEY_RE = /^[0-9a-f]{64}$/;

/* Where "press start" leads: frens.earth's root IS its registration page;
   everywhere else the route decides the space. */
function registerHrefFor(host: string, space: string): string {
  const h = host.toLowerCase().split(":")[0];
  if (h === "frens.earth" || h === "www.frens.earth") return "/";
  return space === "pacsarcade" ? "/register" : "/frens";
}

/* /u/pacster reads the HOST's space; /u/pacster@frens is explicit and works
   on every host — the login redirect uses the explicit form so a fren never
   lands behind the wrong door (the pacster GAME OVER bug, 2026-07-07). */
function parseTarget(raw: string, host: string): { handle: string; space: string; nip05Domain: string } {
  const decoded = decodeURIComponent(raw).trim().toLowerCase();
  const at = decoded.indexOf("@");
  if (at > 0) {
    const space = decoded.slice(at + 1);
    if ((KNOWN_SPACES as readonly string[]).includes(space)) {
      return { handle: decoded.slice(0, at), space, nip05Domain: domainForSpace(space) };
    }
  }
  const { space, nip05Domain } = spaceForHost(host);
  return { handle: decoded, space, nip05Domain };
}

/* The registry changes with every registration — never serve a cached
   "tag not found" to a fren who registered seconds ago. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle: raw } = await params;
  const host = (await headers()).get("host") ?? "";
  const decoded = decodeURIComponent(raw).trim().toLowerCase();
  /* npub pages (and their hex spelling, which the page redirects) — no tag,
     no registry: the key is the whole identity */
  if (NPUB_RE.test(decoded) || HEX_KEY_RE.test(decoded)) {
    const npub = NPUB_RE.test(decoded) ? decoded : nip19.npubEncode(decoded);
    return {
      title: `${shortNpub(npub)} — fren profile — Pac's Arcade`,
      description:
        "A nostr key's public page on Pac's Arcade — its live kind-0 signal, straight from the open network.",
    };
  }
  const { handle, space } = parseTarget(raw, host);
  const tag = `${handle}@${space}`;
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
  const host = (await headers()).get("host") ?? "";
  const decoded = decodeURIComponent(raw).trim().toLowerCase();
  /* raw hex key → the one true npub URL */
  if (HEX_KEY_RE.test(decoded)) {
    redirect(`/u/${nip19.npubEncode(decoded)}`);
  }
  /* the npub door's public page — key-only, no registry entry, the live
     kind-0 signal is the whole card. Everything below (the tag flow) is
     untouched. */
  if (NPUB_RE.test(decoded)) {
    return (
      <main className="min-h-screen bg-void">
        <ArcadeHeader />
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
          <p className="font-pixel text-[10px] uppercase tracking-widest text-white/40">
            PAC&apos;S ARCADE ▸ FREN PROFILE
          </p>
          <NpubProfile npub={decoded} />
        </div>
        <EarthFooter />
      </main>
    );
  }
  const { handle, space, nip05Domain } = parseTarget(raw, host);
  const valid = validateHandle(handle);
  if (!valid.ok) {
    /* Reserved names get the honest GAME OVER; garbage input stays a 404. */
    if (valid.reason !== "reserved name") notFound();
    return (
      <GameOverTag
        handle={handle}
        spaceTag={`@${space}`}
        registerHref={registerHrefFor(host, space)}
        reserved
      />
    );
  }
  /* Registry and game node answer in parallel; the node is best-effort —
     unreachable means the profile simply renders without the arcade panel. */
  const [entry, poke] = await Promise.all([
    getEntry(valid.handle, space),
    getPokeProfile(valid.handle),
  ]);
  if (!entry) {
    /* Before declaring a tag homeless, check the other doors. */
    let elsewhere: string | null = null;
    for (const other of KNOWN_SPACES) {
      if (other === space) continue;
      if (await getEntry(valid.handle, other)) {
        elsewhere = other;
        break;
      }
    }
    return (
      <GameOverTag
        handle={valid.handle}
        spaceTag={`@${space}`}
        registerHref={registerHrefFor(host, space)}
        reserved={false}
        elsewhereSpace={elsewhere}
      />
    );
  }
  return (
    <FrenProfile
      handle={entry.handle}
      npub={entry.npub}
      status={entry.status}
      requestedAt={entry.requestedAt}
      blockHeight={entry.blockHeight}
      space={space}
      nip05Domain={nip05Domain}
      matrixProvisioned={entry.matrix ?? false}
      poke={poke}
    />
  );
}
