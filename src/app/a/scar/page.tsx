import { redirect } from "next/navigation";

/**
 * SCAR folded into the four-tab console: the merge-queue APPROVALS now live on
 * ACTION ITEMS (/a) and the IN FLIGHT lane + ship's log on BUG TESTING
 * (/a/testing). This old room redirects so bookmarks and RTFM links (which
 * point at /a/scar) still land somewhere real.
 */
export default function ScarRedirect() {
  redirect("/a");
}
