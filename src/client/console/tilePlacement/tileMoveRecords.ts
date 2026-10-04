/*
 * @console-shared LIVE — console native stands on this file.
 *
 * tileMoveRecords — the SERVER's word that two cell changes are ONE move
 * (`GameModel.tileMoves`, Turmoil Redux TR14 Re-settlement) and the ledger
 * that lets each client play a record at most once.
 *
 * A move shows up in the board diff as two unrelated facts: a tile left one
 * cell and a tile stands on another. The remote stage may NOT pair them by
 * geometry — two cities next to each other changing in one response is not
 * proof of anything — so the pairing is the server's: a record names `from`
 * and `to`, and it is honoured only when THIS diff shows exactly the declared
 * pair (`verifyMove` — the same proof the viewer's own hero demands). No
 * record (an old save, a restart between the move and the poll) → the two
 * changes keep their own separate beats, honestly.
 *
 * Pure but for the bounded claims set (the `aresAdjacencyFlights` precedent):
 * the ring rides every response, so a record must be consumed once per client.
 */
import {TileMoveRecordModel} from '@/common/boards/TileMove';
import {SpaceModel} from '@/common/models/SpaceModel';
import {VerifiedMove, VerifiedPlacement, verifyMove} from '@/client/console/tilePlacement/tilePlacementModel';

const MAX_CLAIMS = 64;
const claimedSeqs = new Set<number>();

/** TRUE exactly once per record — the scene that wins presents it. */
export function claimTileMove(seq: number): boolean {
  if (claimedSeqs.has(seq)) {
    return false;
  }
  claimedSeqs.add(seq);
  if (claimedSeqs.size > MAX_CLAIMS) {
    const oldest = claimedSeqs.values().next().value;
    if (oldest !== undefined) {
      claimedSeqs.delete(oldest);
    }
  }
  return true;
}

export function tileMoveClaimed(seq: number): boolean {
  return claimedSeqs.has(seq);
}

/** Specs/unmount reset (module state is bundle-shared in mochapack). */
export function resetTileMoveClaims(): void {
  claimedSeqs.clear();
}

/** The NEWEST record naming exactly this pair of cells (a city can be moved back another generation). */
export function tileMoveRecordFor(
  records: ReadonlyArray<TileMoveRecordModel> | undefined,
  from: string,
  to: string,
): TileMoveRecordModel | undefined {
  let best: TileMoveRecordModel | undefined;
  for (const record of records ?? []) {
    if (record.from === from && record.to === to && (best === undefined || record.seq > best.seq)) {
      best = record;
    }
  }
  return best;
}

/** One move the server declared AND this diff shows. */
export type PairedTileMove = {
  record: TileMoveRecordModel,
  landed: VerifiedPlacement & {moves: VerifiedMove},
};

/**
 * Every unconsumed record whose two cells show the declared pair in THIS diff,
 * oldest first. A cell takes part in at most one pair; a record the diff does
 * not bear out is left alone (and unclaimed) — it is not this response's move.
 * Pure: `isClaimed` is the ledger's read side, nothing is claimed here.
 */
export function pairTileMoves(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
  records: ReadonlyArray<TileMoveRecordModel> | undefined,
  isClaimed: (seq: number) => boolean = tileMoveClaimed,
): Array<PairedTileMove> {
  const out: Array<PairedTileMove> = [];
  const taken = new Set<string>();
  const ordered = [...(records ?? [])].sort((a, b) => a.seq - b.seq);
  for (const record of ordered) {
    if (isClaimed(record.seq) || taken.has(record.from) || taken.has(record.to)) {
      continue;
    }
    const landed = verifyMove(prevSpaces, newSpaces, record.from, record.to);
    if (landed?.moves === undefined) {
      continue;
    }
    taken.add(record.from);
    taken.add(record.to);
    out.push({record, landed: {...landed, moves: landed.moves}});
  }
  return out;
}
