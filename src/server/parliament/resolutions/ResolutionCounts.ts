/*
 * THE SERVER SIDE of a resolution's counted term (Turmoil Redux): one
 * player's count, read from the cards they have IN PLAY through the shared
 * predicate (`common/parliament/resolutionCounts.ts`). Read-only.
 *
 * «In play» is the player's tableau — corporations, preludes, CEOs, played
 * projects and events — minus a disabled Pharmacy Union (out of the game, the
 * same exception the tag counts make); the hand, the discard and cards hosted
 * elsewhere (Self-Replicating Robots) are not in the tableau at all. Whether a
 * played event's tags are in play is `Tags.eventTagsInPlay`.
 *
 * A TAG count takes its NUMBER from the project's canonical tag counter
 * (`Tags.count(tag, RESOLUTION_TAG_COUNTING_MODE)`) — one mechanism for every
 * source of a tag, including the permanent modifiers no card prints (Leavitt
 * Station's science, Underworld's plants, the Delta Project's jovian) — while
 * the shared predicate supplies the BREAKDOWN that explains it, card by card
 * with its own contribution. A term over SEVERAL tags (Cloud Development's
 * Venus + Jovian) is the canonical count of EACH tag, added up, and the model
 * keeps the per-tag totals beside the sum. `tests/parliament/CentralPowerGrid.spec.ts`
 * and `tests/parliament/CloudDevelopment.spec.ts` pin the breakdowns against
 * the canonical numbers over a corpus, so the explanation can never drift
 * from the number.
 *
 * A BOARD count (Colonization Funding's space cities) walks no tableau at
 * all: it asks THE ENGINE — `MarsBoard.getCitiesOffMars(player)`, the very
 * function the Cosmic Settler award and the behavior counter stand on — for
 * the number AND the cells, so nothing here restates what a space city is.
 * The shared cell predicate (`spaceCountVerdict`) exists for the stand's
 * synthetic cells and is pinned to this reading by
 * `tests/parliament/ColonizationFunding.spec.ts`.
 *
 * A THRESHOLD count (Generous Funding's sets of 5 TR over 15) walks nothing:
 * it reads ONE player metric off the engine (`player.terraformRating` — never
 * rebuilt from its parts) and divides it by the shared rule
 * (`countMetricToward` → `thresholdSets`), keeping the breakdown that
 * explains the number where no list can.
 */
import {CardName} from '../../../common/cards/CardName';
import {
  BoardCountedTile, cardCountUnits, countCardsToward, countMetricToward, ResolutionCountId, ResolutionCountMetric, ResolutionCountModel,
  resolutionCountKind, RESOLUTION_COUNT_IDS, RESOLUTION_TAG_COUNTING_MODE,
} from '../../../common/parliament/resolutionCounts';
import {Resource} from '../../../common/Resource';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../../cards/ICard';
import {Space} from '../../boards/Space';
import type {ResolutionCatalog} from './ResolutionCatalog';

function inPlay(card: ICard): boolean {
  return !(card.name === CardName.PHARMACY_UNION && card.isDisabled === true);
}

/** THE ENGINE'S OWN LIST of `player`'s tiles of `tiles` kind on the Mars board — the canonical reading of a board count. */
function boardCountSpaces(player: IPlayer, tiles: BoardCountedTile): ReadonlyArray<Space> {
  switch (tiles) {
  case 'spaceCity': return player.game.board.getCitiesOffMars(player);
  }
}

/** THE ENGINE'S OWN VALUE of a player metric — the number a threshold count divides (never rebuilt from its parts). */
function metricValue(player: IPlayer, metric: ResolutionCountMetric): number {
  switch (metric) {
  case 'terraformRating': return player.terraformRating;
  }
}

/** `player`'s count for `id`, with what made it: the cards (in play order), the cells of a board count, or the breakdown of a metric. */
export function resolutionCount(player: IPlayer, id: ResolutionCountId): ResolutionCountModel {
  const kind = resolutionCountKind(id);
  if (kind.kind === 'threshold') {
    // ONE metric, THE shared division — the breakdown rides the model.
    return countMetricToward(id, metricValue(player, kind.metric));
  }
  if (kind.kind === 'board') {
    // THE CANONICAL NUMBER AND ITS CELLS, from the engine — never a walk of
    // this module's own over the board.
    const spaces = boardCountSpaces(player, kind.tiles);
    return {id, count: spaces.length, cards: [], spaces: spaces.map((space) => space.id)};
  }
  const tableau = player.tableau.filter(inPlay);
  const breakdown = countCardsToward(id, tableau, {eventTagsInPlay: player.tags.eventTagsInPlay()});
  if (kind.kind === 'cards') {
    return breakdown;
  }
  // THE CANONICAL NUMBER, tag by tag. The breakdown above is the same rule
  // expressed per card; the counter is the one that also sees a permanent
  // modifier. A single-tag term is the one count; a multi-tag term is the sum
  // of each tag's count, with the per-tag totals kept for the reading.
  const byTag = kind.tags.map((tag) => ({tag, count: player.tags.count(tag, RESOLUTION_TAG_COUNTING_MODE)}));
  const count = byTag.reduce((sum, entry) => sum + entry.count, 0);
  return byTag.length > 1 ? {...breakdown, count, byTag} : {...breakdown, count};
}

/** What ONE card of `player`'s tableau contributes to `id` (0 = it does not count). */
export function resolutionCountUnitsOf(player: IPlayer, id: ResolutionCountId, card: ICard): number {
  return inPlay(card) ? cardCountUnits(id, card, {eventTagsInPlay: player.tags.eventTagsInPlay()}) : 0;
}

/**
 * Every PRODUCTION a SEQUENTIAL effect of `catalog` divides («1 card for
 * every 3 steps of heat production»). The seat's model carries exactly these
 * — the inputs of the formulas that exist, and nothing else: a surface that
 * needs the second half of a chained effect reads the same number the server
 * divided by, never a production it happened to find elsewhere.
 */
export function declaredSequelProductions(catalog: ResolutionCatalog): Array<Resource> {
  const out: Array<Resource> = [];
  for (const definition of catalog.all()) {
    for (const effect of definition.scaled ?? []) {
      const total = effect.sequel?.total;
      if (total?.kind === 'production' && !out.includes(total.resource)) {
        out.push(total.resource);
      }
    }
  }
  return out;
}

/**
 * Does some resolution of `catalog` pay the player's COLONY BONUSES a number
 * of times (Colonial Affairs)? Then every seat's model carries its colony
 * ledger — the tiles it has a cube on with their printed bonus — so a
 * surface can multiply the SERVER's registry, never a list of its own.
 */
export function declaresColonyBonuses(catalog: ResolutionCatalog): boolean {
  return catalog.all().some((definition) => (definition.scaled ?? []).some((effect) => effect.unit.kind === 'colonyBonuses'));
}

/** Every count id some resolution of `catalog` declares — what a player's model carries. */
export function declaredCountIds(catalog: ResolutionCatalog): Array<ResolutionCountId> {
  const ids = new Set<ResolutionCountId>();
  for (const definition of catalog.all()) {
    for (const effect of definition.scaled ?? []) {
      if (effect.count !== undefined) {
        ids.add(effect.count.id);
      }
    }
  }
  return RESOLUTION_COUNT_IDS.filter((id) => ids.has(id));
}
