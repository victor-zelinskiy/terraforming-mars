/**
 * PLACEMENT RELATIONS — the pure view-model behind the on-field «what does this
 * placement touch» layer (docs/claude/console/board-placement-flow.md § Field
 * grammar).
 *
 * The board must show WHICH cells participate in the focused placement —
 * paying oceans, scored greeneries, taxing hazards, Ares reward tiles, the
 * hazards a planetary event rewrites — and it must never disagree with the
 * dossier beside it. So this module derives everything from the SAME
 * `BoardPlacementPreview` the dossier renders: the server engine names the
 * participating cells on each spatial fact (`BoardFact.spaces`, filled from
 * the very rule call that computed the fact's numbers), and this module only
 * classifies them into a small visual vocabulary. No geometry, no game rules,
 * no second source of truth — a cell lights because a server fact names it.
 *
 * TONES (the board's spatial grammar — colour + form, never colour alone):
 *  - `penalty` — this neighbour taxes the placement (hazard production loss,
 *    an adjacency surcharge). Always wins a conflict: a cost may never be
 *    masked by a reward.
 *  - `ocean`   — a paying ocean (the flat adjacency income).
 *  - `score`   — an endgame-VP tie (greeneries a city will score, cities an
 *    adjacent greenery feeds — possibly an opponent's).
 *  - `reward`  — an immediate Ares-style gain (adjacent tile bonus, the tile
 *    owner's M€).
 *  - `event`   — a positive board-wide planetary consequence (hazard cleanup)
 *    — rendered most quietly: it is context, not adjacency. (An intensify
 *    event keeps the honest `penalty` voice — those hazards become MORE
 *    taxing; the board section quiets any far participant geometrically,
 *    `con-rel--far`, so distance never shouts.)
 */
import {SpaceId} from '@/common/Types';
import {BoardFact, BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';

export type PlacementRelationTone = 'penalty' | 'ocean' | 'score' | 'reward' | 'event';

export type PlacementRelation = {
  spaceId: SpaceId;
  tone: PlacementRelationTone;
};

/** Conflict precedence — LOWER wins. A penalty may never be masked. */
const TONE_RANK: Record<PlacementRelationTone, number> = {
  penalty: 0,
  ocean: 1,
  score: 2,
  reward: 3,
  event: 4,
};

/**
 * The tone of one spatial fact — STRUCTURAL (category first, severity as the
 * fallback for future fact kinds), never a title match.
 */
export function relationToneOf(fact: BoardFact): PlacementRelationTone {
  switch (fact.category) {
  case 'ocean-adjacency-bonus':
    return 'ocean';
  case 'city-greenery-scoring':
  case 'future-scoring':
    return 'score';
  case 'ares-adjacency-bonus':
  case 'tile-owner-benefit':
    return fact.severity === 'warning' || fact.severity === 'danger' ? 'penalty' : 'reward';
  case 'hazard-penalty':
  case 'placement-penalty':
    return 'penalty';
  case 'placement-cost':
    return 'penalty';
  case 'hazard-cleanup':
    return 'event';
  default:
    return fact.severity === 'warning' || fact.severity === 'danger' ? 'penalty' : 'reward';
  }
}

/**
 * Every cell the focused placement genuinely touches, one relation per cell
 * (strongest tone wins). The placement cell itself is excluded — the reticle
 * owns it. Deterministic order: by first appearance in the preview's own
 * fact order (costs → immediate → recipients → warnings → …), so a probe can
 * assert on it.
 */
export function relationsFromPreview(preview: BoardPlacementPreview | undefined): ReadonlyArray<PlacementRelation> {
  if (preview === undefined) {
    return [];
  }
  const byId = new Map<SpaceId, PlacementRelationTone>();
  const groups: ReadonlyArray<ReadonlyArray<BoardFact> | undefined> = [
    preview.costFacts,
    preview.immediateFacts,
    preview.recipientFacts,
    preview.warningFacts,
    preview.futureScoringFacts,
    preview.progressFacts,
    preview.ruleFacts,
  ];
  for (const facts of groups) {
    for (const fact of facts ?? []) {
      const spaces = fact.spaces;
      if (spaces === undefined || spaces.length === 0) {
        continue;
      }
      const tone = relationToneOf(fact);
      for (const spaceId of spaces) {
        if (spaceId === preview.space) {
          continue;
        }
        const standing = byId.get(spaceId);
        if (standing === undefined || TONE_RANK[tone] < TONE_RANK[standing]) {
          byId.set(spaceId, tone);
        }
      }
    }
  }
  return [...byId.entries()].map(([spaceId, tone]) => ({spaceId, tone}));
}
