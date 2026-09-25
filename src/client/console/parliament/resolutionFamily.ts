import {InfluenceScaledEffect} from '@/common/parliament/influenceScaling';
import {resolutionCountKind} from '@/common/parliament/resolutionCounts';
import {WinnerRewardDeclaration} from '@/common/parliament/winnerReward';
import {TileGrantDeclaration} from '@/common/parliament/tileGrant';
import {WorldParameterMove} from '@/common/parliament/parameterMove';

/*
 * WHICH FAMILY OF SCENARIOS A RESOLUTION READS — derived from its DECLARATION
 * (`scaled` / `winnerReward` / a `count` / a `sequel` term), never from a table
 * keyed by resolution id: the «Полигон» stand opens the family of a resolution
 * it has never seen, and the contract guard (`ResolutionContract.spec`) asks
 * this function for every catalog entry so a card whose declaration fits no
 * family cannot ship silently.
 *
 *   influence     — a payout scaled by influence alone (onto a card, into the supply);
 *   counted       — a COUNT of cards + influence (Architecture Award);
 *   counted-tags  — a COUNT of tags + influence (Central Power Grid);
 *   counted-board — a COUNT of the player's TILES on the board + influence (Colonization Funding's
 *                   space cities) — the instrument is a set of CELLS, not a tableau;
 *   counted-metric — a COUNT of the full STEPS one player METRIC stands above a threshold + influence
 *                   (Generous Funding's sets of 5 TR over 15) — the instrument is a single VALUE, and
 *                   the scenarios are its thresholds (below, at, just over, a set short, several sets);
 *   counted-production — a COUNT of the player's PRODUCTION STEPS over a list of resources + influence,
 *                   behind a LEVY (Industrialist Budget: −10 M€, then steel + titanium + energy steps) —
 *                   the instrument is the production TRACK and the seat's SUPPLY the levy reads; the
 *                   scenarios are the levy's edges (paid whole, short, nothing to pay) and the track's;
 *   counted-colonies — a COUNT of the player's COLONIES (their cubes on the colony tiles) beside a
 *                   plain influence payout (Jovian Tax Rights: titanium = influence, +1 M€ production
 *                   per colony, max 5) — the instrument is the COLONY TABLE, and the scenarios are the
 *                   cube counts against the cap (none, one, several, at the cap, past it);
 *   distributed   — a card-resource payout LAID OUT over the player's holders, 0..N per card
 *                   (Cloud Development: floaters by Venus + Jovian tags + influence) — the count
 *                   is a term of it, the SPREAD is what the player works with;
 *   winner-tile   — a supply payout by influence + the WINNER's tile (Biodome Contest);
 *   sequel        — a second half that reads what the first half left behind (Climate Research);
 *   colony-bonuses — the player's COLONY BONUSES paid a number of times (Colonial Affairs: 2 + 1 per 2
 *                   influence) — the instrument is the LEDGER of the player's tiles, multiplied;
 *   world-move    — the enactment moves the PLANET (Gas Export: oxygen −1, Venus +2, no TR for anybody) —
 *                   the instrument is the GLOBAL PARAMETERS, and the scenarios are their limits;
 *   up-to         — a LEVEL the player is brought up to (Joint Research: «draw until you have 6 + influence in
 *                   hand») — the instrument is the seat's CURRENT LEVEL (the hand), and the scenarios are its
 *                   positions against the target (empty, short by a few, at it, above it, at influence 0);
 *   tile-grant    — a TILE granted by THRESHOLD (Skyscrapers: the winner and every seat with influence ≥ 2 place a
 *                   city tier on their own city) — the instrument is the seat's ELIGIBILITY (the star, the influence
 *                   line) and its CITIES ON MARS (the only legal destination), and the scenarios are their edges
 *                   (below the line, on it, the winner under it, no city to build on, the stack recorded).
 */
export const RESOLUTION_FAMILIES = [
  'influence', 'counted', 'counted-tags', 'counted-board', 'counted-metric', 'counted-production', 'counted-colonies', 'distributed', 'winner-tile', 'sequel',
  'colony-bonuses', 'world-move', 'up-to', 'tile-grant',
] as const;
export type ResolutionFamily = typeof RESOLUTION_FAMILIES[number];

/** The declaration facts the family reads — what the server definition and the client manifest share. */
export type ResolutionFamilyFacts = {
  scaled?: ReadonlyArray<InfluenceScaledEffect>;
  winnerReward?: WinnerRewardDeclaration;
  /** A TILE granted by threshold (Skyscrapers) — the recipients rule and the tile's one destination. */
  tileGrant?: TileGrantDeclaration;
  /** The WORLD's part — the global parameters the enactment moves for the whole table. */
  worldMoves?: ReadonlyArray<WorldParameterMove>;
};

/** The scaled part that reads a FIRST part's result (a sequel), if any. */
export function sequelEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.sequel !== undefined);
}

/** The scaled part with a COUNT term, if any. */
export function countEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.count !== undefined);
}

/** The scaled part paid ONTO A CARD (the shared picker asks where), if any. */
export function pickerEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.unit.kind === 'cardResource');
}

/** The card-resource part the player LAYS OUT over several holders (the shared distribution), if any. */
export function spreadEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.unit.kind === 'cardResource' && effect.unit.spread === true);
}

/** The part paid as the player's COLONY BONUSES a number of times, if any. */
export function colonyBonusesEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.unit.kind === 'colonyBonuses');
}

/** The part that brings the player UP TO a level (a `upTo` term), if any. */
export function levelEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.upTo !== undefined);
}

export function familyOf(facts: ResolutionFamilyFacts): ResolutionFamily {
  // A TILE BY THRESHOLD first: the instrument is who qualifies and where the tile may go — no amount, no count.
  if (facts.tileGrant !== undefined) {
    return 'tile-grant';
  }
  // THE COLONY LEDGER next: what is multiplied is the player's own tiles, an instrument no other family has.
  if (colonyBonusesEffectOf(facts) !== undefined) {
    return 'colony-bonuses';
  }
  // A LEVEL next: the instrument is the player's current level against a target, which no count reads.
  if (levelEffectOf(facts) !== undefined) {
    return 'up-to';
  }
  // A SEQUENTIAL resolution next: its second half reads what its first half
  // leaves behind, which is a different instrument from a count.
  if (sequelEffectOf(facts) !== undefined) {
    return 'sequel';
  }
  // A SPREAD next: the player's instrument is the layout over their holders;
  // whatever counts toward N is a term of the reading, not the family.
  if (spreadEffectOf(facts) !== undefined) {
    return 'distributed';
  }
  const count = countEffectOf(facts)?.count;
  if (count !== undefined) {
    switch (resolutionCountKind(count.id).kind) {
    case 'tags': return 'counted-tags';
    case 'board': return 'counted-board';
    case 'threshold': return 'counted-metric';
    case 'production': return 'counted-production';
    case 'colonies': return 'counted-colonies';
    case 'cards': return 'counted';
    }
  }
  // THE PLANET is the instrument when nothing more specific is: the scenarios of a world move are the
  // parameters' own limits (a ceiling, a floor, a step that is cut), which no other family exercises.
  if ((facts.worldMoves ?? []).length > 0) {
    return 'world-move';
  }
  // A winner's TILE with no card to pick for everyone's part: the winner-tile family.
  return facts.winnerReward !== undefined && pickerEffectOf(facts) === undefined ? 'winner-tile' : 'influence';
}
