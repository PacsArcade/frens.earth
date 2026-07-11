import type { Metadata } from "next";
import { headers } from "next/headers";
import OperatorGate from "@/components/OperatorGate";
import ChatPanel from "@/components/ChatPanel";
import AdminNav from "@/components/AdminNav";
import { operatorFromCookieHeader, operatorsConfigured } from "@/lib/operator-auth";

/**
 * Admin connections — link this deployment to its chat floor (orbee door,
 * chat.frens.earth by default). Same key-is-the-operator gate as the rest
 * of /a.
 */
export const metadata: Metadata = {
  title: "Chat floor — frens.earth admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminChatPage() {
  const cookie = (await headers()).get("cookie");
  const operator = operatorFromCookieHeader(cookie);
  if (!operator) {
    return <OperatorGate configured={operatorsConfigured()} />;
  }
  return (
    <main className="min-h-screen bg-void">
      <AdminNav current="chat" />
      <ChatPanel />
    </main>
  );
}
