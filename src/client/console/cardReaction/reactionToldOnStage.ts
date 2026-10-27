/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A REACTION THE SCENE PLAYS IS NOT TOLD AGAIN BY THE FEED («СРАБАТЫВАНИЕ КАРТЫ», iteration 4 — the owner,
 * 2026-10-27: «для таких кейсов игроку не должна приходить обычная нотификация, чтобы не дублировать инфу»). An
 * enacted law's payout on the viewer's own move used to arrive twice: the console's scene (the law's face rising,
 * its tokens leaving its printed icons, the counters ticking on the touchdowns) AND the feed's «Сработал эффект»
 * card about the very same chain. The director marks every OWN reaction it will play at the seed — the apply block,
 * which runs BEFORE the feed ingests the response's events — and the notification builder asks before it builds the
 * law's card. The `accessToldOnStage` precedent, keyed by the CHAIN ROOT (the record's `root.actionId` is the chain's
 * `correlationId`), the seat and the source. Bounded, never consumed (a card may be rebuilt from a grown chain).
 * Pure module state: no Vue, read by the notification model under the server runner.
 */
import {Color} from '@/common/Color';
import {CardReactionRecord} from '@/common/models/CardReactionModel';

const told = new Set<string>();
const CAP = 128;
const KEEP = 64;

function keyOf(actionId: number, owner: Color, source: string): string {
  return `${actionId}|${owner}|${source}`;
}

/** The director's seed: this record's reaction will be PLAYED for the viewer (a record with no chain root is never told). */
export function markReactionTold(record: Pick<CardReactionRecord, 'root' | 'owner' | 'card'>): void {
  const actionId = record.root.actionId;
  if (actionId === undefined) {
    return;
  }
  told.add(keyOf(actionId, record.owner, record.card));
  if (told.size > CAP) {
    const keep = [...told].slice(-KEEP);
    told.clear();
    keep.forEach((k) => told.add(k));
  }
}

/** The notification builder: is the payout of `source` to `owner` under this chain root told by the scene? */
export function reactionToldOnStage(correlationId: number | undefined, owner: Color | undefined, source: string): boolean {
  return correlationId !== undefined && owner !== undefined && told.has(keyOf(correlationId, owner, source));
}

/** Test-only reset. */
export function resetReactionTold(): void {
  told.clear();
}

// ── THE RING (PL-1090): the order-independent half ─────────────────────────
// The box's first run showed the card beside the risen law: the feed's events read lands BEFORE the apply block that
// marks the reaction (and before the claim that marks an attached one), builds the card, stashes it while the chain
// is open and releases it as built. The SERVER's own ring (`GameModel.cardReactions`, riding the view the feed holds)
// says the same thing with no clock: a resolution record under this chain, for this seat and this law, with a share
// the scene flies — and the ingest holds a chain the applied view still lists as open, so by the time a card can be
// built the view carries the record. Whether the scene PLAYS at all (the layer mounted, motion not reduced) is the
// director's to say: it registers the probe; without one (a spec) nothing plays.
let scenePlays: () => boolean = () => false;

/** The director: can a reaction be played on this client right now? */
export function registerReactionScenePlays(probe: () => boolean): void {
  scenePlays = probe;
}

export function reactionScenePlays(): boolean {
  return scenePlays();
}

/** The server's ring names a reaction of `source` to `owner` under this chain root that the scene flies (a draw / a global step alone is not flown). */
export function ringTellsReaction(ring: ReadonlyArray<CardReactionRecord> | undefined, correlationId: number | undefined, owner: Color | undefined, source: string): boolean {
  if (ring === undefined || correlationId === undefined || owner === undefined) {
    return false;
  }
  return ring.some((r) => r.kind === 'resolution' && r.card === source && r.owner === owner && r.root.actionId === correlationId &&
    r.impacts.some((i) => i.to === owner && (i.kind === 'stock' || i.kind === 'production' || i.kind === 'card-resource' || i.kind === 'tr')));
}

/** ONE answer for the feed: the director's mark, or the ring while the scene plays. */
export function reactionTold(ring: ReadonlyArray<CardReactionRecord> | undefined, correlationId: number | undefined, owner: Color | undefined, source: string): boolean {
  return reactionToldOnStage(correlationId, owner, source) || (scenePlays() && ringTellsReaction(ring, correlationId, owner, source));
}
