import { headers } from "next/headers";
import ConsoleShell from "@/components/console/ConsoleShell";
import { operatorFromCookieHeader } from "@/lib/operator-auth";

/**
 * The /a layout — mounts the SCAR·LET LCARS shell (elbow ribbon + top bar +
 * mobile bottom elbow bar + the BFT tray-clock) around every console room.
 * Same key-is-the-operator gate as the rooms themselves: no operator cookie,
 * no shell — the page renders its own OperatorGate bare, so the door stays a
 * door and the bridge stays behind it. Room registry + site identity come
 * from src/lib/console.ts (the console is a module, not furniture).
 */
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) return <>{children}</>;
  return <ConsoleShell>{children}</ConsoleShell>;
}
