import { nip05Names } from "@/lib/registry";

// The registry changes at every claim — never prerender this at build time
export const dynamic = "force-dynamic";

/**
 * NIP-05 nostr identity verification for this deployment's space. Every
 * queued tag verifies as name@<domain> before its on-chain batch commits.
 */
export async function GET() {
  const names = await nip05Names();
  return Response.json(
    { names },
    {
      headers: {
        // NIP-05 requires CORS for browser clients
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
