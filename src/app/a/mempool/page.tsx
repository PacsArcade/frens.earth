import { redirect } from "next/navigation";

/**
 * The chain node (mempool) link now lives as a section on CONNECTIONS
 * (/a/connections#chain). This old room redirects so old links don't 404.
 */
export default function MempoolRedirect() {
  redirect("/a/connections");
}
