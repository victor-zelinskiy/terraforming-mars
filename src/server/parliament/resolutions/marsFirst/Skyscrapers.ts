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
 *  · MarsBot is a seat of the grant (decision D11): the same recipients rule
 *    (the winner, or influence 2+) gives it a tier, which it places on one of
 *    ITS OWN cities by its own tie-break (`automa/BotTileGrant.ts`), in its
 *    place in the seat order; a human's candidates stay their own cities.
 *  · ONCE PER ENACTMENT: the driver's idempotency keys — a reload inside the
 *    question re-runs `run`, which offers the same cities.
 *
 * THE STEP CONTRACT (IResolution.ts): ONE immediate step for EVERY seat — the
 * family's shared `tileGrantStep` (`ResolutionTileGrant.ts`, Mars First
 * Budget's city stands on it too). One step, one record.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {Size} from '../../../../common/cards/render/Size';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {
  TILE_GRANT_NO_DESTINATION_REASON, TILE_GRANT_NOT_ELIGIBLE_REASON, TileGrantDeclaration, tileGrantStepKey,
} from '../../../../common/parliament/tileGrant';
import {ResolutionDefinition} from '../IResolution';
import {tileGrantStep} from '../ResolutionTileGrant';

export const SKYSCRAPERS_ID: ResolutionId = 'RDX_MARS_SKYSCRAPERS';
export const SKYSCRAPERS_CODE: ResolutionCode = 'RX20';

/** THE INFLUENCE LINE: a seat at or above it receives the tile without winning. */
export const SKYSCRAPERS_INFLUENCE_LINE = 2;

/** THE GRANT: one city tile, a tier on the seat's own city, for the winner and everyone at or above the line. */
export const SKYSCRAPERS_GRANT: TileGrantDeclaration = {
  tile: 'city',
  placement: 'own-city',
  recipients: {kind: 'threshold', winner: true, influenceAtLeast: SKYSCRAPERS_INFLUENCE_LINE},
};

/** The step's key — the record's name on every surface, derived from the declaration (`tileGrantStepKey`). */
export const SKYSCRAPERS_STEP_KEY = tileGrantStepKey(SKYSCRAPERS_GRANT);

/** The skips' reasons — the declaration's own (English keys; the stage plate translates them). */
export const NOT_ELIGIBLE_REASON = TILE_GRANT_NOT_ELIGIBLE_REASON;
export const NO_CITY_ON_MARS_REASON = TILE_GRANT_NO_DESTINATION_REASON;

/**
 * THE ONE STEP — the family's shared executor (`tileGrantStep`) with this
 * card's own words: it ASKS (the pick's own answer builds the tier and
 * reports the cell and the stack it became) or, with nothing to build on or a
 * seat the rule passes over, changes nothing and reports the skip.
 */
const TIER_STEP = tileGrantStep(SKYSCRAPERS_ID, SKYSCRAPERS_GRANT, {
  title: 'Place the city tile on top of one of your cities on Mars',
  context: 'The resolution is enacted: this city tile must be placed on top of one of your cities on Mars.',
});

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
    effect: 'The winner of the vote and every player with at least 2 influence place a city tile on top of one of their own cities on Mars. Each city in the stack counts separately.',
    quest: 'Place 2 city tiles on Mars',
  },
  quest: {goal: {kind: 'tile', tile: 'city'}, count: 2},
  tileGrant: SKYSCRAPERS_GRANT,
  immediateSteps: [TIER_STEP],
};
