/**
 * Space identity configuration.
 *
 * This site is a standalone registration page for ONE Spaces-protocol space.
 * To stand up registration for another space, deploy this repo again with the
 * two env vars changed (and its own domain + blob store):
 *
 *   NEXT_PUBLIC_SPACE_NAME=frens        # the space (tag = name@frens)
 *   NEXT_PUBLIC_NIP05_DOMAIN=frens.earth # domain serving /.well-known/nostr.json
 */
export const SPACE_NAME = process.env.NEXT_PUBLIC_SPACE_NAME ?? "frens";

export const NIP05_DOMAIN =
  process.env.NEXT_PUBLIC_NIP05_DOMAIN ?? "frens.earth";

export const SPACE_TAG = `@${SPACE_NAME}`;

/** Every space that may have a claim registry on this deployment. */
export const KNOWN_SPACES = [SPACE_NAME] as const;
