import { validateHandle, isAvailable } from "@/lib/registry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("handle") ?? "";

  const valid = validateHandle(raw);
  if (!valid.ok) {
    return Response.json({ handle: raw, available: false, reason: valid.reason });
  }

  const available = await isAvailable(valid.handle);
  return Response.json({
    handle: valid.handle,
    available,
    reason: available ? null : "already claimed",
  });
}
