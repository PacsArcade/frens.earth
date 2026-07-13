import { redirect } from "next/navigation";

/**
 * The chat floor link now lives as a section on CONNECTIONS
 * (/a/connections#chat). This old room redirects so old links don't 404.
 */
export default function ChatRedirect() {
  redirect("/a/connections");
}
