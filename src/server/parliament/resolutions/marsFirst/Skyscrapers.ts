/*
 * SKYSCRAPERS (Mars First) — Turmoil Redux resolution RX20: the first
 * resolution whose recipients are a SET decided by a THRESHOLD, and the first
 * mechanism the engine had no idea of — a CITY STACK: more than one city tile
 * on one cell (docs/TURMOIL_REDUX_SKYSCRAPERS.md).
 *
 * Printed: «When enacted: The player that won this resolution and players
 * with at least 2 Influence each gain a city tile that they MUST place on
 * their existing city on Mars. (Each city in the stack scores VP from
 * adjacent greeneries separately; you gain nothing if you have no city on
 * Mars.)» Chairman quest: 2 cities on Mars.
 *
 * THE READINGS FIXED HERE:
 *  · WHO: the winner of the vote ALWAYS (influence 0 or 1 included — the
 *    star is unconditional), and every other participant with influence ≥ 2
 *    (read through the Redux ledger AFTER the winner's Agenda step, as every
 *    card does). Neither «everyone» nor «the winner only»: the declaration
 *    (`tileGrant.recipients`) and ONE predicate (`tileGrantEligibility`)
 *    decide, for the step and for every client reading alike. A neutral
 *    winner is nobody's star — the threshold alone decides then.
 *  · WHERE: ON TOP of one of the seat's OWN cities ON MARS — never another
 *    player's city, never a reserved off-Mars city slot, never an empty cell
 *    (`MarsBoard.canStackCity`, the candidate set of the `city-tier`
 *    placement). The choice is SHOWN even with one candidate (invariant 3).
 *  · NO CITY ON MARS → NOTHING, and it NAMES ITSELF («no city on Mars to
 *    build on» — a journal line and a `skipped` record), never a silent zero
 *    and never «no influence». A seat below the line is passed over by the
 *    RULE, and that skip names the rule.
 *  · THE CELL PAYS NOTHING AGAIN: the tier goes through `Game.addTile` with
 *    `stacking` — the printed bonus and the ocean adjacency were collected by
 *    the first city, no Ares neighbour pays, no placement cost is charged.
 *    What DOES answer is everything that answers «a city tile was placed»:
 *    the cards (Tharsis Republic, Pets, Immigrant City), the party passives,
 *    the recorder's own event. The chairman quest never counts it (the
 *    political phase — `QuestTracker.eligible`).
 *  · THE STACK IS REAL: the cell keeps its one tile and counts its height
 *    (`Space.stackHeight`); every QUANTITY of cities sums the stacks
 *    (`MarsBoard.countCities` — Mayor, Metropolist, Constructor, Landlord,
 *    the countables, Vermin…), every PREDICATE about a cell («is this a
 *    city», «is it next to a city») reads the cell alone; the endgame scores
 *    the adjacent greeneries ONCE PER TIER, one breakdown row per tier.
 *  · MarsBot never participates in the parliament: no tile, and its cities
 *    are never candidates (a seat's own cities only).
 *  · ONCE PER ENACTMENT: the driver's idempotency keys — a reload inside the
 *    question re-runs `run`, which offers the same cities.
 *
 * THE STEP CONTRACT (IResolution.ts): ONE immediate step for EVERY seat — it
 * ASKS (the pick's own answer builds the tier and reports the cell and the
 * stack it became) or, with nothing to build on or a seat the rule passes
 * over, changes nothing and reports the skip. One step, one record.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {Size} from '../../../../common/cards/render/Size';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {TileType} from '../../../../common/TileType';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {TileGrantDeclaration, tileGrantEligibility} from '../../../../common/parliament/tileGrant';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {createMarsSelectSpace} from '../../../boards/marsSelectSpaceHelper';
import {committedPlacement} from '../../../inputs/placementContext';
import {Board} from '../../../boards/Board';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const SKYSCRAPERS_ID: ResolutionId = 'RDX_MARS_SKYSCRAPERS';
export const SKYSCRAPERS_CODE: ResolutionCode = 'RX20';

/** THE INFLUENCE LINE: a seat at or above it receives the tile without winning. */
export const SKYSCRAPERS_INFLUENCE_LINE = 2;

/** THE GRANT: one city tile, a tier on the seat's own city, for the winner and everyone at or above the line. */
export const SKYSCRAPERS_GRANT: TileGrantDeclaration = {
  tile: 'city',
  placement: 'own-city',
  recipients: {winner: true, influenceAtLeast: SKYSCRAPERS_INFLUENCE_LINE},
};

/** The step's key — the record's name on every surface. */
export const SKYSCRAPERS_STEP_KEY = 'city-tier';

/** The skips' reasons — English keys; the stage plate translates them. */
export const NOT_ELIGIBLE_REASON = 'Below 2 influence and not the winner of the vote';
export const NO_CITY_ON_MARS_REASON = 'No city on Mars to build on';

/** WHO asks — the same source on the placement, its dossier and every skip. */
const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: SKYSCRAPERS_ID};

const TIER_STEP: EnactStep = {
  key: SKYSCRAPERS_STEP_KEY,
  run(ctx) {
    const player = ctx.player;
    const game = ctx.game;
    const eligibility = tileGrantEligibility(SKYSCRAPERS_GRANT, {winner: ctx.winner?.id === player.id, influence: ctx.influence});
    if (eligibility === 'none') {
      // The rule passes the seat over — named as the rule, never as «no influence».
      game.log('${0} is below 2 influence and did not win the vote — no city tile from ${1}', (b) => b.player(player).resolution(SKYSCRAPERS_ID));
      ctx.report({kind: 'skipped', influence: ctx.influence, reason: NOT_ELIGIBLE_REASON});
      return undefined;
    }
    // THE CANDIDATES: the seat's own cities on Mars — the ONE placement
    // validator (`city-tier`), the same set the reason pipeline and the
    // dossier read. Re-read by a reload's rebuild: nothing on the table moves
    // while the phase waits for this answer.
    const cities = game.board.getAvailableSpacesForType(player, 'city-tier');
    if (cities.length === 0) {
      // No city on Mars: the tile has nowhere to go — named and skipped,
      // nothing substitutes for it.
      game.log('${0} has no city on Mars — the city tile from ${1} is skipped', (b) => b.player(player).resolution(SKYSCRAPERS_ID));
      ctx.report({kind: 'skipped', influence: ctx.influence, reason: NO_CITY_ON_MARS_REASON});
      return undefined;
    }
    // THE STANDARD PLACEMENT PROMPT over the stack's own kind: the console's
    // board flow with the cell dossier («City stack: 1 → 2 tiers»), every
    // other cell explained («not one of your cities on Mars»), the resolution
    // as the source (`placementContext.source` — the plate, the dossier's
    // chip, L3). The answer builds the tier and reports the cell + the stack.
    return createMarsSelectSpace(player, 'Place the city tile on top of one of your cities on Mars', cities, {
      placementType: 'city-tier',
      tileType: TileType.CITY,
      placementContext: committedPlacement('The resolution is enacted: this city tile must be placed on top of one of your cities on Mars.', SOURCE),
    }).andThen((space) => {
      game.addCityTier(player, space);
      ctx.report({kind: 'city', influence: ctx.influence, space: space.id, stackHeight: Board.tiersOf(space)});
      return undefined;
    });
  },
};

export const SKYSCRAPERS: ResolutionDefinition = {
  id: SKYSCRAPERS_ID,
  code: SKYSCRAPERS_CODE,
  module: 'turmoilRedux',
  party: PartyName.MARS,
  copies: 1,
  // THE FACE, as printed: «STACK:» — a city ONTO a city — and the two
  // recipient marks beside it: the winner's star and the influence line
  // («2+»). One drawing serves the bill, the vote surface and the inspector.
  renderData: CardRenderer.builder((b) => {
    b.text('STACK:', Size.SMALL, true).city({size: Size.SMALL}).arrow(Size.SMALL).city({size: Size.SMALL}).br;
    b.voteWinner({superscript: false}).nbsp.influence().text('2+', Size.TINY, true);
  }),
  text: {
    name: 'Skyscrapers',
    effect: 'The winner of the vote and every player with at least 2 influence each gain a city tile, placed on top of one of their own cities on Mars.',
    quest: 'Place 2 city tiles on Mars',
  },
  quest: {goal: {kind: 'tile', tile: 'city'}, count: 2},
  tileGrant: SKYSCRAPERS_GRANT,
  immediateSteps: [TIER_STEP],
};
