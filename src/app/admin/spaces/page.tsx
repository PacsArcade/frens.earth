import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import SpacesPanel from "@/components/SpacesPanel";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";
import { SPACE_NAME } from "@/lib/identity-config";

/**
 * The admin connections room: the Spaces node console. An operator ("admiral")
 * connects this deployment's own `spaced` node, watches the chain, sees the
 * queue, and runs the batch anchor ceremony. Same key-is-the-operator gate as
 * the rest of /admin.
 */
export const metadata: Metadata = {
  title: "Spaces node — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminSpacesPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return <SpacesPanel space={SPACE_NAME} />;
}
