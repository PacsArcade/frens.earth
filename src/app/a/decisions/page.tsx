import { redirect } from "next/navigation";

/**
 * The decision board now rides ACTION ITEMS (/a), under the approvals queue.
 * This old room redirects so old links don't 404.
 */
export default function DecisionsRedirect() {
  redirect("/a");
}
