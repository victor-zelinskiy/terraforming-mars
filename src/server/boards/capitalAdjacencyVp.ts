// TYPE-ONLY: `Game.ts` imports this module beside `Board`, and a VALUE import of `Board` here closed an import cycle
// (Board → … → MoonBoard → Board, «Cannot access 'Board' before initialization» in every server spec). The ocean
// predicate is the SAME set `Board.isOceanSpace` reads (`OCEAN_TILES`), taken from the common module directly.
import type {Board} from './Board';
import type {Space} from './Space';
import {OCEAN_TILES, TileType} from '../../common/TileType';
import {SpaceId} from '../../common/Types';
import {AdjacencyVpChange} from '../../common/boards/TileMove';

/**
 * THE CAPITALS' ADJACENCY VP AROUND A MOVE (PL-041 — the TR39 walk, the owner's
 * decision 2026-10-10): a Capital scores +1 VP per adjacent ocean at the END,
 * so an ocean that moves (TR39), a Capital that moves (TR14) or an ocean that
 * leaves (RX33) RECOUNTS somebody's standing — and nothing in the event stream
 * said so: the journal read «moved the ocean 33 → 34», the rival's notification
 * «+1 TR», and the only trace of their lost point was the endgame.
 *
 * A projection, never a mutation (VP is endgame-computed): the writer takes a
 * SNAPSHOT of every Capital beside the cells a move touches BEFORE the board
 * changes, the same snapshot AFTER, and the difference rides the `tile-moved`
 * event as a FACT (`TileMoveFact.adjacencyVp`) — the journal prints it as the
 * Capital owner's row, the owner's notification as their loss, the dossier
 * already promised it (`BoardInformationEngine.capitalMoveFacts` reads the
 * same predicate: adjacent oceans).
 *
 * Read-only over the board; the two readings share ONE predicate with the
 * dossier's (`Board.isOceanSpace` beside the Capital).
 */
export type CapitalAdjacencyVp = {space: SpaceId; player: string; oceans: number};

/** How many oceans stand beside `space` — the Capital's own scoring predicate. */
function adjacentOceans(board: Board, space: Space): number {
  return board.getAdjacentSpaces(space).filter((s) => s.tile !== undefined && OCEAN_TILES.has(s.tile.tileType)).length;
}

/**
 * Every OWNED Capital whose count a change on `cells` can touch: the Capitals beside any of the cells, and a Capital
 * standing ON one of them (the tile that is itself about to move).
 */
export function capitalAdjacencyVpAround(board: Board, cells: ReadonlyArray<Space>): Array<CapitalAdjacencyVp> {
  const seen = new Map<SpaceId, Space>();
  for (const cell of cells) {
    for (const candidate of [cell, ...board.getAdjacentSpaces(cell)]) {
      if (candidate.tile?.tileType === TileType.CAPITAL && candidate.player !== undefined && candidate.player.color !== 'neutral') {
        seen.set(candidate.id, candidate);
      }
    }
  }
  return [...seen.values()].map((capital) => ({space: capital.id, player: capital.player!.color, oceans: adjacentOceans(board, capital)}));
}

/**
 * The Capitals whose count CHANGED between two snapshots, joined by cell — a Capital that itself moved is read at
 * its new cell against its old one (`movedFrom` → `movedTo`). Unchanged counts are no fact.
 */
export function capitalAdjacencyVpChanges(
  before: ReadonlyArray<CapitalAdjacencyVp>, after: ReadonlyArray<CapitalAdjacencyVp>,
  moved?: {from: SpaceId, to: SpaceId},
): Array<AdjacencyVpChange> {
  const out: Array<AdjacencyVpChange> = [];
  for (const now of after) {
    const wasAt = moved !== undefined && now.space === moved.to ? moved.from : now.space;
    const was = before.find((b) => b.space === wasAt && b.player === now.player);
    if (was === undefined || was.oceans === now.oceans) {
      continue;
    }
    out.push({space: now.space, player: now.player as AdjacencyVpChange['player'], tile: TileType.CAPITAL, before: was.oceans, after: now.oceans});
  }
  return out;
}
