/**
 * AN EMBEDDED BATCH THAT LOSES ITS HOST SPENT IS NOT A BAND (FLAKE ZERO's recorder found it, 2026-11-15).
 *
 * A drawn batch a workspace hosts is teleported into that workspace's outcome zone and wears the embedded dress. When the
 * workspace LEAVES with the batch fully taken, the claim is released and the zone unpublished one task before the batch
 * itself ends (a follow-up hold can keep a spent batch current) — and for that task the overlay re-homed to `body` in
 * its STANDALONE dress: the full-bleed band, with nothing on it, standing 2–6 ms on every such teardown
 * (`console-effect-decision-embed`, `console-play-draw-embed` — «never a full-bleed band outside the workspace»; a
 * frame landing in that gap flashes the band). A batch that stood EMBEDDED and has nothing left to take keeps its
 * embedded dress and paints nothing until it ends. A batch with a card STILL TO TAKE keeps the band — a result outlives
 * the surface that produced it; a batch that never stood embedded is the band's own.
 */
export type OrphanFacts = {
  /** The overlay is embedded NOW. */
  embedded: boolean,
  /** The batch on screen (undefined: none). */
  batchId: number | undefined,
  /** The batch this instance last presented EMBEDDED. */
  embeddedBatchId: number | undefined,
  /** Cards of the batch not taken yet. */
  untaken: number,
};

export function embeddedBatchOrphanedSpent(f: OrphanFacts): boolean {
  return !f.embedded && f.batchId !== undefined && f.batchId === f.embeddedBatchId && f.untaken <= 0;
}
