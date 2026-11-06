import {HAZARD_STEPS, hazardSeverity} from '../../common/AresTileType';
import {Space} from '../boards/Space';
import {IGame} from '../IGame';
import {AresHandler} from '../ares/AresHandler';
import {botRewardIcons} from './AutomaPlacementBonus';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';

/**
 * MarsBot's Ares house rules (the official Automa material predates Ares and
 * does not cover it — see docs/AUTOMA_DATA_AUDIT.md):
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
 * 4. CLEARANCE (the owner's decision 2026-11-06 — docs/AUTOMA_DATA_AUDIT.md §22.7, HOME): the bot places ON a
 *    hazard only by `clearanceCandidates` — its FINAL greenery always covers one it can pay for («free points — the
 *    players always grab them»), the one giving the most TR first; during the game only when it truly pays, never
 *    early and never greedily (from generation 4, once a generation, 5 M€ kept for Corporate Competition, the hazard
 *    strictly better than the best ordinary cell by the placement evaluation with the TR counted; Purifier in the set
 *    and unclaimed lifts the priority while the bot has cleared fewer than three). The price and the reward are the
 *    human's, through the ONE pipeline (`Game.addTile` → `AresHandler`: the M€ deducted without a prompt, the TR, the
 *    Purifier count). Every other placement still never lands on a hazard (`withoutHazardSpaces`).
 *
 * Every helper is a no-op / identity without the Ares expansion, so non-Ares
 * games are byte-identical. The read-only helpers NEVER mutate game state —
 * only `applyHazardConsequence` does, and it must never run during dry-run
 * evaluation (it is called from the commit path in
 * `AresHandler.payAdjacencyAndHazardCosts`).
 */
/**
 * THE IN-GAME CLEARANCE PARAMETERS (house rule 4, the owner's decision): «only when it truly pays, not early, not
 * aggressively». A hazard's score = WHAT THE CELL PAYS THE BOT — its Ares adjacency units, and NOT the icons printed
 * under the hazard: a tile that covers a hazard is paid no printed bonus (`Game.grantPlacementBonuses`, the
 * `coveringExistingTile` branch — the hazard is the tile already on the cell) — − 2 per adjacent hazard + 8 per TR
 * step − its price (+ 4 while chasing Purifier); it must beat the best ordinary cell's (icons + units − 2 per
 * adjacent hazard) STRICTLY. 8 M€ a TR step is the price itself — a cleared hazard wins on its own merits (the
 * adjacency it earns, the milestone it chases), never on the TR alone. (Until the review of 2026-11-06 the score
 * counted the printed icons too: a storm on a 3-steel cell beat every 2-icon cell and the bot paid 8 M€ for nothing
 * it was then paid.) Tuned on the Ares bench (docs/AUTOMA_DATA_AUDIT.md §22.7).
 */
export const CLEARANCE = {
  fromGeneration: 4,
  keepMegacredits: 5,
  megacreditsPerTr: 8,
  perAdjacentHazard: 2,
  purifierBonus: 4,
} as const;

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

  /**
   * HOUSE RULE 4 — the hazards the bot will COVER with this placement, or undefined (none — place as usual). `legal`
   * is the full legal list (hazards included), `ordinary` the list without them. Read-only.
   *
   * `final`: the end-of-game greenery — any hazard it can pay for, the most TR first (the placement strategy then
   * picks among them). `turn`: the in-game test, every gate of the owner's decision — see `CLEARANCE`.
   */
  public static clearanceCandidates(game: IGame, legal: ReadonlyArray<Space>, ordinary: ReadonlyArray<Space>,
    mode: 'final' | 'turn'): ReadonlyArray<Space> | undefined {
    if (!game.gameOptions.aresExtension || game.automa === undefined) {
      return undefined;
    }
    const bot = marsBotOf(game);
    const priced = legal.filter((space) => hazardSeverity(space.tile?.tileType) !== 'none').map((space) => ({
      space,
      steps: HAZARD_STEPS[hazardSeverity(space.tile?.tileType)],
      cost: AresHandler.placementCosts(bot, space, AresHandler.subjectToHazardAdjacency(bot, undefined)).megacredits,
    }));
    if (mode === 'final') {
      const affordable = priced.filter((p) => p.cost <= bot.megaCredits);
      if (affordable.length === 0) {
        return undefined;
      }
      const most = Math.max(...affordable.map((p) => p.steps));
      return affordable.filter((p) => p.steps === most).map((p) => p.space);
    }
    if (game.generation < CLEARANCE.fromGeneration || game.automa.lastClearanceGeneration === game.generation) {
      return undefined;
    }
    // What the cell pays: the printed icons only where they ARE paid — never under a hazard the tile covers.
    const value = (space: Space, coversHazard = false) => (coversHazard ? 0 : botRewardIcons(game, bot, space)) +
      AutomaAres.adjacencyBonusUnits(game, space) - CLEARANCE.perAdjacentHazard * AutomaAres.hazardAdjacencyCount(game, space);
    const bestOrdinary = ordinary.length === 0 ? Number.NEGATIVE_INFINITY : Math.max(...ordinary.map((space) => value(space)));
    const purifierChase = AutomaAres.chasesPurifier(game) ? CLEARANCE.purifierBonus : 0;
    const worth = priced
      .filter((p) => bot.megaCredits - p.cost >= CLEARANCE.keepMegacredits)
      .map((p) => ({space: p.space, score: value(p.space, true) + CLEARANCE.megacreditsPerTr * p.steps - p.cost + purifierChase}))
      .filter((p) => p.score > bestOrdinary);
    if (worth.length === 0) {
      return undefined;
    }
    const best = Math.max(...worth.map((p) => p.score));
    return worth.filter((p) => p.score === best).map((p) => p.space);
  }

  /**
   * The bot decided to cover a hazard (house rule 4): the journal says WHY in one line before the placement's own
   * lines (the price, the TR — `AresHandler`), and an in-game clearance spends the generation's one.
   */
  public static noteClearance(game: IGame, final: boolean): void {
    const bot = marsBotOf(game);
    if (final) {
      game.log('${0} covers an Ares hazard with a final greenery — the cleanup TR it can pay for', (b) => b.player(bot));
      return;
    }
    if (game.automa !== undefined) {
      game.automa.lastClearanceGeneration = game.generation;
    }
    game.log('${0} covers an Ares hazard — that cell beats every other one even after the cleanup price', (b) => b.player(bot));
  }

  /** Purifier stands in the game, nobody has claimed it, and the bot has cleared fewer than three hazards. */
  private static chasesPurifier(game: IGame): boolean {
    const purifier = game.milestones.find((m) => m.name === 'Purifier');
    if (purifier === undefined || game.milestoneClaimed(purifier)) {
      return false;
    }
    const bot = marsBotOf(game);
    const entry = game.aresData?.milestoneResults.find((e) => e.id === bot.id);
    return (entry?.purifierCount ?? 0) < 3;
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
