import { redirect } from "next/navigation";

/**
 * The Spaces node console now lives as a section on CONNECTIONS
 * (/a/connections#spaces). This old room redirects so old links don't 404.
 */
export default function SpacesRedirect() {
  redirect("/a/connections");
}
