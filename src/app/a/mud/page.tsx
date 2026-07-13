import { redirect } from "next/navigation";

/**
 * The MUD node link now lives as a section on CONNECTIONS
 * (/a/connections#mud). This old room redirects so old links don't 404.
 */
export default function MudRedirect() {
  redirect("/a/connections");
}
