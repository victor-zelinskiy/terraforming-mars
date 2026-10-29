import {Tag} from '../../../common/cards/Tag';
import {GlobalParameter} from '../../../common/GlobalParameter';
import {SpaceBonus} from '../../../common/boards/SpaceBonus';
import {OCEAN_TILES} from '../../../common/TileType';
import {MarsBotTrackRole} from '../../../common/automa/AutomaTypes';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {IProjectCard} from '../../cards/IProjectCard';
import {newProjectCard} from '../../createCard';
import {AwardScorer} from '../../awards/AwardScorer';
import {MarsBotTrack} from '../MarsBotBoard';
import {humansOf, marsBotOf} from '../AutomaUtil';

/**
 * THE SHARED READS of the dividend clauses (docs/claude/prompts/
 * marsbot-portfolio-dividends.md §2 П1) — every one a pure function of the
 * game's state or its event stream, so a clause is one line of arithmetic over
 * these and can never keep a tally that drifts. Nothing here writes anything;
 * the purity guard (`tests/automa/MarsBotDividends.spec.ts`) snapshots the
 * whole automa record and the board around every clause.
 *
 * A clause counts what the BOT did or owns. The few reads of the OTHER seats
 * exist for the four corporations whose printed card is already two-sided
 * (C08, C21's regressions, C22, C24, C33) and count what the humans do for
 * themselves.
 */

/** The bot's played pile, rebuilt into cards (a name that no longer resolves is skipped). */
export function pileCards(game: IGame): ReadonlyArray<IProjectCard> {
  const automa = game.automa;
  if (automa === undefined) {
    return [];
  }
  const cards: Array<IProjectCard> = [];
  for (const name of automa.playedPile) {
    const card = newProjectCard(name);
    if (card !== undefined) {
      cards.push(card);
    }
  }
  return cards;
}

/** Printed tag OCCURRENCES of `tags` in the played pile (a card with two Jovian tags counts twice). */
export function pileTagCount(game: IGame, tags: ReadonlyArray<Tag>): number {
  let n = 0;
  for (const card of pileCards(game)) {
    for (const tag of card.tags) {
      if (tags.includes(tag)) {
        n++;
      }
    }
  }
  return n;
}

/** Cards of the played pile satisfying `predicate`. */
export function pileCount(game: IGame, predicate: (card: IProjectCard) => boolean): number {
  return pileCards(game).filter(predicate).length;
}

/** The printed number of a card's VP icon (0 for none, a negative or a variable one). */
export function printedVictoryPoints(card: IProjectCard): number {
  return typeof card.victoryPoints === 'number' ? card.victoryPoints : 0;
}

/** The bot's track of this role, if this board has one. */
export function trackOf(game: IGame, role: MarsBotTrackRole): MarsBotTrack | undefined {
  return game.automa?.board.tracks.find((t) => t.definition.role === role);
}

/** The bot's marker position on the track of this role (0 when the board has none). */
export function trackPosition(game: IGame, role: MarsBotTrackRole): number {
  return trackOf(game, role)?.position ?? 0;
}

/** The mat's tracks WITHOUT the Venus board's — the ones every game has. */
export function matTracks(game: IGame): ReadonlyArray<MarsBotTrack> {
  return (game.automa?.board.tracks ?? []).filter((t) => t.definition.role !== 'venus');
}

/** Spaces where the bot owns a tile. */
export function botTileSpaces(game: IGame): ReadonlyArray<Space> {
  const bot = marsBotOf(game);
  return game.board.spaces.filter((s) => s.tile !== undefined && s.player?.id === bot.id);
}

export function botCityCount(game: IGame): number {
  return botTileSpaces(game).filter((s) => Board.isCitySpace(s)).length;
}

export function botGreenerySpaces(game: IGame): ReadonlyArray<Space> {
  return botTileSpaces(game).filter((s) => Board.isGreenerySpace(s));
}

/** Steps of `parameter` the BOT raised — the event stream's own record, never a parameter «by anyone». */
export function botParameterSteps(game: IGame, parameter: GlobalParameter): number {
  const bot = marsBotOf(game);
  let n = 0;
  for (const e of game.events.events) {
    if (e.type === 'global-parameter-changed' && e.player === bot.color &&
        e.impact.globalParameter?.parameter === parameter && e.impact.globalParameter.steps > 0) {
      n += e.impact.globalParameter.steps;
    }
  }
  return n;
}

/**
 * Ocean tiles the bot placed. An ocean belongs to nobody, so the cell cannot
 * say who laid it — the event stream is the witness, and the question is
 * about the PLACED TILE TYPE the event recorded, never about what lies on a
 * cell now (that one goes through `cellPieces`).
 */
export function botOceansPlaced(game: IGame): number {
  const bot = marsBotOf(game);
  return game.events.events.filter((e) => {
    const placed = e.type === 'tile-placed' && e.player === bot.color ? e.tile : undefined;
    return placed !== undefined && OCEAN_TILES.has(placed);
  }).length;
}

/**
 * Borders between a space matching `a` and a space matching `b`. When both
 * predicates are the same, every border is seen twice — pass `symmetric` and
 * the count is halved.
 */
export function borders(game: IGame, a: (s: Space) => boolean, b: (s: Space) => boolean, symmetric: boolean = false): number {
  let n = 0;
  for (const space of game.board.spaces) {
    if (!a(space)) {
      continue;
    }
    for (const adjacent of game.board.getAdjacentSpaces(space)) {
      if (b(adjacent)) {
        n++;
      }
    }
  }
  return symmetric ? n / 2 : n;
}

export function isBotTile(game: IGame): (s: Space) => boolean {
  const bot = marsBotOf(game);
  return (s) => s.tile !== undefined && s.player?.id === bot.id;
}

/** A tile another (human) player owns — an ocean belongs to nobody. */
export function isOtherPlayersTile(game: IGame): (s: Space) => boolean {
  const bot = marsBotOf(game);
  return (s) => s.tile !== undefined && s.player !== undefined && s.player.id !== bot.id && !Board.isOceanSpace(s);
}

/** Colonies in play — the bot's and everyone's (an inactive colony tile counts nobody's). */
export function colonyCounts(game: IGame): {bot: number, all: number} {
  const bot = marsBotOf(game);
  let own = 0;
  let all = 0;
  for (const colony of game.colonies) {
    if (!colony.isActive) {
      continue;
    }
    all += colony.colonies.length;
    own += colony.colonies.filter((id) => id === bot.id).length;
  }
  return {bot: own, all};
}

/** Cards carrying `tag` the OTHER players played. */
export function otherPlayersCardsWithTag(game: IGame, tag: Tag): number {
  let n = 0;
  for (const human of humansOf(game)) {
    n += human.playedCards.asArray().filter((card) => card.tags.includes(tag)).length;
  }
  return n;
}

/** Track spaces the other players pushed the bot back from (the mat's ✕ marks). */
export function regressedSpaces(game: IGame): number {
  return (game.automa?.board.tracks ?? []).reduce((n, t) => n + t.regressedPositions.size, 0);
}

/** Failed Actions the bot took this game. */
export function failedActionCount(game: IGame): number {
  return game.automa?.failedActions ?? 0;
}

/**
 * Awards — funded or not — where the bot leads (a tie for the lead leads) and
 * where it is second, by the ONE derivation of its award strength
 * (`AwardScorer` → `AutomaMAEvaluation.botAwardScore`). A zero score leads
 * nothing.
 */
export function awardStandings(game: IGame): {first: number, second: number} {
  const bot = marsBotOf(game);
  const others: ReadonlyArray<IPlayer> = humansOf(game);
  let first = 0;
  let second = 0;
  for (const award of game.awards) {
    const scorer = new AwardScorer(game, award);
    const own = scorer.get(bot);
    if (own <= 0) {
      continue;
    }
    const ahead = others.filter((p) => scorer.get(p) > own).length;
    if (ahead === 0) {
      first++;
    } else if (ahead === 1) {
      second++;
    }
  }
  return {first, second};
}

// ── THE GOALS' READS (docs/claude/marsbot-dividend-goals-catalog.md): a goal counts something the bot itself
//    did or owns that its formula does not — never where the PLAYERS build (the owner, 2026-10-29).

/** Spaces where the bot owns a city. */
export function botCitySpaces(game: IGame): ReadonlyArray<Space> {
  return botTileSpaces(game).filter((s) => Board.isCitySpace(s));
}

/** A greenery the bot owns. */
export function isBotGreenery(game: IGame): (s: Space) => boolean {
  const bot = marsBotOf(game);
  return (s) => Board.isGreenerySpace(s) && s.player?.id === bot.id;
}

/** Adjacent spaces of `space` on this board. */
export function adjacentSpaces(game: IGame, space: Space): ReadonlyArray<Space> {
  return game.board.getAdjacentSpaces(space);
}

/** How many ocean tiles (anyone's — an ocean belongs to nobody) touch `space`. */
export function oceanNeighbours(game: IGame, space: Space): number {
  return adjacentSpaces(game, space).filter((s) => Board.isOceanSpace(s)).length;
}

/** How many of `space`'s neighbours carry a bot tile (any, or the ones `predicate` picks). */
export function botNeighbours(game: IGame, space: Space, predicate: (s: Space) => boolean = isBotTile(game)): number {
  return adjacentSpaces(game, space).filter(predicate).length;
}

/** The printed bonus ICONS of `bonus` on a space (a double-steel space prints two). */
export function bonusUnits(space: Space, bonus: SpaceBonus): number {
  return space.bonus.filter((b) => b === bonus).length;
}

/**
 * Bot tiles ON a space printing `bonus` or BESIDE one. «On» alone cannot carry
 * three tiers on every map — Tharsis prints two titanium land spaces where
 * the other maps print four or five — so the goal counts the neighbourhood.
 */
export function botTilesOnOrBeside(game: IGame, bonus: SpaceBonus): number {
  return botTileSpaces(game).filter((s) => bonusUnits(s, bonus) > 0 || adjacentSpaces(game, s).some((n) => bonusUnits(n, bonus) > 0)).length;
}

/** A space on the map's rim — fewer than six neighbours. */
export function isMapEdge(game: IGame, space: Space): boolean {
  return adjacentSpaces(game, space).length < 6;
}

/**
 * The GEOMETRIC column of a space, 0…8 with the map's centre at 4. The
 * server's `x` carries the row offset (row y starts at |4 − y|), so a raw
 * `x <= 3` is a skewed wedge, not a hemisphere; half-columns are the odd rows.
 */
export function mapColumn(space: Space): number {
  return space.x - Math.abs(4 - space.y) / 2;
}

/** Ocean tiles the BOT placed, as spaces — from the event stream (an ocean belongs to nobody on the cell). */
export function botOceanSpaces(game: IGame): ReadonlyArray<Space> {
  const bot = marsBotOf(game);
  const ids = new Set<string>();
  for (const e of game.events.events) {
    if (e.type === 'tile-placed' && e.player === bot.color && e.tile !== undefined && e.space !== undefined && OCEAN_TILES.has(e.tile)) {
      ids.add(e.space);
    }
  }
  return game.board.spaces.filter((s) => ids.has(s.id) && Board.isOceanSpace(s));
}

/** The bot's largest group of mutually adjacent tiles. */
export function largestBotCluster(game: IGame): number {
  const tiles = botTileSpaces(game);
  const ids = new Set(tiles.map((s) => s.id));
  const seen = new Set<string>();
  let largest = 0;
  for (const start of tiles) {
    if (seen.has(start.id)) {
      continue;
    }
    seen.add(start.id);
    const stack = [start];
    let size = 0;
    for (let cur = stack.pop(); cur !== undefined; cur = stack.pop()) {
      size++;
      for (const n of adjacentSpaces(game, cur)) {
        if (ids.has(n.id) && !seen.has(n.id)) {
          seen.add(n.id);
          stack.push(n);
        }
      }
    }
    largest = Math.max(largest, size);
  }
  return largest;
}

/** How many KINDS of tag the played pile holds at least `atLeast` cards of (a card with two of a kind counts once). */
export function pileTagKinds(game: IGame, atLeast: number): number {
  const counts = new Map<Tag, number>();
  for (const card of pileCards(game)) {
    for (const tag of new Set(card.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.values()].filter((n) => n >= atLeast).length;
}

/** Bonus cards in the bonus deck's discard. */
export function bonusDiscardCount(game: IGame): number {
  return game.automa?.bonusDiscard.length ?? 0;
}
