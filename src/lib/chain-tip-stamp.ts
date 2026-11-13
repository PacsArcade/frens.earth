/** The tip block's chain time stamp, ONLY when the block list already holds
 *  the block at `height`. The height and the block list are two separate
 *  reads, and the list can lag the height for a moment at a block break.
 *  The old fallback (`?? blocks[0]`) then paired the NEW height with the
 *  PREVIOUS block's stamp: the clocks thought the new block was already a
 *  whole block old (minute hand pinned, the ₿ showing on the 7th lap).
 *  No match means null; the clocks then use the break they saw themselves. */
export function tipStampFor(blocks: unknown, height: number | null): number | null {
  if (height == null || !Array.isArray(blocks)) return null;
  const b = (blocks as Array<{ height?: unknown; timestamp?: unknown }>).find((x) => x?.height === height);
  return b && typeof b.timestamp === "number" && Number.isFinite(b.timestamp) ? b.timestamp : null;
}
