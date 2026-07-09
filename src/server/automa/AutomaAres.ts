import {hazardSeverity} from '../../common/AresTileType';
import {Space} from '../boards/Space';
import {IGame} from '../IGame';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';

/**
 * MarsBot's Ares house rules (the official Automa material predates Ares and
 * does not cover it — see AUTOMA_DATA_AUDIT.md):
 *
 * 1. NEIGHBORHOOD BONUSES count like printed placement bonuses: the placement
 *    evaluation values each Ares adjacency-bonus unit exactly like a printed
 *    bonus icon, and on placement the bot converts each unit to 1 M€ (the
 *    same conversion the rulebook applies to covered printed icons — the bot
 *    has no use for plants/energy/cards). The isMarsBot grant branch lives in
 *    `AresHandler.earnAdacencyBonus` (the ONE shared pipeline); this module
 *    only provides the read-only evaluation helper.
 * 2. The bot AVOIDS placing next to hazard tiles: a strong scoring preference
 *    (`preferAwayFromHazards`, applied AFTER the tile's printed placement
 *    criteria and BEFORE the generic tiebreakers) — never a legality change.
 *    A hazard-adjacent space wins only when it is strictly better by the
 *    tile's own placement strategy.
 * 3. If the bot still places next to a hazard, ONE random tag track regresses
 *    one step (`applyHazardConsequence`) — the bot's equivalent of the
 *    printed "lose production per adjacent hazard" cost, resolved ONCE per
 *    placement regardless of how many hazards surround the space. The
 *    standard regression marker guarantees a crossed track bonus never fires
 *    a second time when the track re-advances.
 *
 * The bot never places ON a hazard tile (`withoutHazardSpaces`): hazard
 * cleanup (8/16 M€ for 1/2 TR) is a human economic decision the automa has no
 * rules for, and it would otherwise require a payment prompt the bot cannot
 * answer.
 *
 * Every helper is a no-op / identity without the Ares expansion, so non-Ares
 * games are byte-identical. The read-only helpers NEVER mutate game state —
 * only `applyHazardConsequence` does, and it must never run during dry-run
 * evaluation (it is called from the commit path in
 * `AresHandler.payAdjacencyAndHazardCosts`).
 */
export class AutomaAres {
  /** Adjacent hazard tiles of `space` (0 without Ares — hazards cannot exist). */
  public static hazardAdjacencyCount(game: IGame, space: Space): number {
    if (!game.gameOptions.aresExtension) {
      return 0;
    }
    return game.board.getAdjacentSpaces(space)
      .filter((adj) => hazardSeverity(adj.tile?.tileType) !== 'none').length;
  }

  /**
   * The Ares adjacency-bonus units the bot would EARN by placing on `space`
   * (each is worth exactly 1 M€ to the bot — the printed-icon conversion), so
   * the shared "cover the most bonus icons" tiebreaker can count them like
   * printed icons. Read-only; 0 without Ares.
   */
  public static adjacencyBonusUnits(game: IGame, space: Space): number {
    if (!game.gameOptions.aresExtension) {
      return 0;
    }
    let units = 0;
    for (const adj of game.board.getAdjacentSpaces(space)) {
      units += adj.adjacency?.bonus.length ?? 0;
    }
    return units;
  }

  /** Bot placement candidates never include hazard-COVER spaces (see the module doc). */
  public static withoutHazardSpaces(game: IGame, spaces: ReadonlyArray<Space>): ReadonlyArray<Space> {
    if (!game.gameOptions.aresExtension) {
      return spaces;
    }
    return spaces.filter((space) => hazardSeverity(space.tile?.tileType) === 'none');
  }

  /**
   * The strong hazard-avoidance preference: keep the candidates with the FEWEST
   * adjacent hazards. Applied after the tile's printed placement criteria and
   * before the generic tiebreakers, so a hazard-adjacent space survives only
   * when it strictly wins on the bot's own placement strategy. Identity
   * without Ares (every count is 0).
   */
  public static preferAwayFromHazards(game: IGame, spaces: ReadonlyArray<Space>): ReadonlyArray<Space> {
    if (!game.gameOptions.aresExtension || spaces.length <= 1) {
      return spaces;
    }
    const counts = spaces.map((space) => AutomaAres.hazardAdjacencyCount(game, space));
    const min = Math.min(...counts);
    return spaces.filter((_, i) => counts[i] === min);
  }

  /**
   * House rule 3 — the COMMIT-time consequence of placing next to a hazard:
   * regress ONE random tag track by one step (once per placement). Randomness
   * rides the game's seeded RNG so save/replay behavior stays stable. Only
   * tracks that have advanced can regress; when every track is still at the
   * start the consequence honestly resolves to nothing (logged all the same).
   * The turn review gets a structured 'hazard' step (which track, from → to).
   */
  public static applyHazardConsequence(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    const eligible = automa.board.tracks
      .map((track, index) => ({track, index}))
      .filter(({track}) => track.position > 0);
    if (eligible.length === 0) {
      game.log('${0} placed next to an Ares hazard, but its tracks are all at the start', (b) => b.player(bot));
      AutomaTurnLog.note(game, {kind: 'hazard'}, {consumeLog: true});
      return;
    }
    const picked = eligible[game.rng.nextInt(eligible.length)];
    const from = picked.track.position;
    picked.track.regress();
    const label = picked.track.definition.tags.join('/');
    game.log('${0} placed next to an Ares hazard — its ${1} track regressed from ${2} to ${3}', (b) =>
      b.player(bot).string(label).number(from).number(picked.track.position));
    AutomaTurnLog.note(game, {kind: 'hazard', trackIndex: picked.index, from, to: picked.track.position}, {consumeLog: true});
  }
}
