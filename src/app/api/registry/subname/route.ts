import { handleSubnameRequest } from "@/lib/subname-api";

// Reads env and the registry at request time
export const dynamic = "force-dynamic";

/** Seat <name>.<parent> for the parent app (vend). Shared-secret header. */
export async function POST(request: Request) {
  return handleSubnameRequest(request, "seat");
}

/** Release a pending sub-name when someone leaves the crew. */
export async function DELETE(request: Request) {
  return handleSubnameRequest(request, "release");
}
