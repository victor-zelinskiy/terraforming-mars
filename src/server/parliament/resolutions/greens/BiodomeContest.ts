/*
 * BIODOME CONTEST (the Greens) — Turmoil Redux resolution RX03: the first
 * resolution that pays every participant a STANDARD resource by influence
 * and gives the winner a tile whose own placement moves a global parameter —
 * the template of «a reward for everyone by influence + the winner's tile with
 * all its consequences» (docs/TURMOIL_REDUX_BIODOME_CONTEST.md).
 *
 * Printed: «When enacted: Gain 2 plants per point of Influence you have. The
 * player that won this resolution places a greenery tile and raises Oxygen 1
 * step.» Chairman quest: place 2 greenery tiles.
 *
 * THE READINGS FIXED HERE:
 *  · PLANTS: 2 × the player's influence for EVERY participant — voters or not,
 *    with the party effect or not — read through the Redux ledger AFTER the
 *    winner's Agenda step (the driver seeds `ctx.influence` after step 1), so
 *    every influence the ledger knows counts (the track and its bonuses).
 *    Ordinary plants into the supply: never production, never plants on a
 *    card, never a share of a pool, and NO cap (Architecture Award's «max 5»
 *    is that card's rule, not the family's). The winner gets its own plants
 *    once, like everyone. Influence 0 → nothing, NAMED (a journal line and a
 *    `skipped` outcome), no empty question.
 *  · THE WINNER'S GREENERY is ONE standard placement (`PlaceGreeneryTile`):
 *    the general validator's cells (`getAvailableSpacesForType('greenery')`
 *    and the Red City rule — never «any free cell»), the tile's owner and the
 *    cell's bonuses, `Game.addGreenery` → oxygen +1. The printed «raises
 *    Oxygen 1 step» IS that raise — nothing raises it a second time. On top,
 *    the greenery revision's own +1 TR for the tile (`ParliamentHandler
 *    .onGreeneryPlaced`), the TR of the ACTUAL oxygen step, the 8 % temperature
 *    step, and everything the cell and the table react with. The phase is
 *    PARLIAMENT — never SOLAR (the World Government's TR-less mode) and never
 *    the final-greenery mode that suppresses oxygen, even in the last
 *    generation. The Greens rule the moment this card is enacted, so their
 *    ordinary hook pays 2 M€ per TR step that actually lands. Free: no plants
 *    spent, no standard-project cost, no action counted.
 *  · OXYGEN AT ITS MAXIMUM: the greenery still lands and still pays its own
 *    TR; oxygen does not move (nothing «rounds up» to a phantom step).
 *  · NO LEGAL CELL: the part is NAMED and skipped (journal + outcome) — no
 *    empty prompt, nothing substituted (no money, no plants, no free oxygen
 *    step: the raise belongs to the placement that did not happen). This is
 *    the PROJECT's reading of the edge — the rulebook's FAQ does not cover it.
 *  · A NEUTRAL winner places no greenery (`winnerSteps` never run for one —
 *    rulebook FAQ p.18, Colony Contest); the plants still reach everyone.
 *  · THE CHAIRMAN QUEST («place 2 greenery tiles») counts a player's OWN
 *    action-phase placements; this greenery never counts — its chain's root is
 *    the political phase, the resolution sits on the event stack and the phase
 *    is not ACTION (`QuestTracker.eligible`), however and whenever the cell
 *    prompt is answered (the prompt carries the scope it was raised in).
 *  · ONCE PER ENACTMENT: the driver's idempotency keys
 *    (`effect:<generation>:<instance>:<player>:<step>`) — a reload, a repeated
 *    answer or a model refresh pays nothing twice; a later legal enactment of
 *    the card is a new generation's keys, a new application.
 *
 * THE STEP CONTRACT (IResolution.ts): the plants step MUTATES; the greenery
 * step ASKS (the placement's own answer mutates and reports) — or, with no
 * legal cell, changes nothing and reports the skip. A reload inside the
 * placement re-runs `run`, which builds the same question and reads the same
 * oxygen (nothing on the table moves while the phase waits for this answer).
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {PlaceGreeneryTile} from '../../../deferredActions/PlaceGreeneryTile';
import {committedPlacement} from '../../../inputs/placementContext';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const BIODOME_CONTEST_ID: ResolutionId = 'RDX_GREENS_BIODOME_CONTEST';
export const BIODOME_CONTEST_CODE: ResolutionCode = 'RX03';

/** THE FORMULA: 2 plants per point of influence, for every participant — no cap. */
export const BIODOME_CONTEST_PLANTS: InfluenceScaledEffect = {
  id: 'plants',
  unit: {kind: 'stock', resource: Resource.PLANTS},
  perInfluence: 2,
  recipient: 'each',
};

/** WHO asks — the same source on the placement, its dossier and every skip. */
const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: BIODOME_CONTEST_ID};

const PLANTS_STEP: EnactStep = {
  key: 'plants',
  run(ctx) {
    const player = ctx.player;
    const effect = BIODOME_CONTEST_PLANTS;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no plants from ${1}', (b) => b.player(player).resolution(BIODOME_CONTEST_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.PLANTS, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.plants;
    // The standard gain: its event carries this resolution as the source (the
    // journal chip, the notification's «why», the recorder). The ONE journal
    // line below carries the whole calculation, so the add itself stays silent.
    player.stock.add(Resource.PLANTS, amount, {log: false, from: {resolution: BIODOME_CONTEST_ID}});
    const after = player.plants;
    ctx.game.log('${0} gained ${1} ${2} from ${3}: 2 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).number(amount).resource(Resource.PLANTS).resolution(BIODOME_CONTEST_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.PLANTS, amount, influence, before, after});
    return undefined;
  },
};

const GREENERY_STEP: EnactStep = {
  key: 'greenery',
  run(ctx) {
    const player = ctx.player;
    const game = ctx.game;
    // Read when the question is built — and re-read by a reload's rebuild:
    // nothing on the table moves while the phase waits for this one answer.
    const oxygenBefore = game.getOxygenLevel();
    // THE STANDARD PLACEMENT: the cells the general validator allows, the
    // console's board flow with the cell dossier, the tile's own bonuses and
    // follow-ups, `addGreenery` with its ordinary oxygen raise. The STANDARD
    // title (the dossier leads with the tile); the resolution is the source
    // (`placementContext.source` — the plate, the dossier's chip, L3).
    const prompt = new PlaceGreeneryTile(player, 'greenery', {
      placementContext: committedPlacement('The winner of the vote places this greenery. The resolution is already enacted.', SOURCE),
    }).andThen((space) => {
      if (space !== undefined) {
        ctx.report({kind: 'greenery', space: space.id, parameter: {id: 'oxygen', before: oxygenBefore, after: game.getOxygenLevel()}});
      }
    }).execute();
    if (prompt === undefined) {
      // The validator left no cell: named and skipped — nothing substitutes
      // for the greenery, and no oxygen step happens without it.
      game.log('No space can take a greenery — the winner\'s greenery from ${0} is skipped', (b) => b.resolution(BIODOME_CONTEST_ID));
      ctx.report({kind: 'skipped', reason: 'No space can take a greenery'});
    }
    return prompt;
  },
};

export const BIODOME_CONTEST: ResolutionDefinition = {
  id: BIODOME_CONTEST_ID,
  code: BIODOME_CONTEST_CODE,
  module: 'turmoilRedux',
  party: PartyName.GREENS,
  copies: 1,
  // THE FACE: the per-influence formula on its own row (2 plants / influence —
  // the RESOURCE, never a plant tag), the winner's greenery on the next: the
  // game's own «greenery tile + oxygen» symbol (ONE raise, the tile's own) with
  // the winner star.
  renderData: CardRenderer.builder((b) => {
    b.plants(2).slash().influence().br;
    b.greenery().voteWinner();
  }),
  text: {
    name: 'Biodome Contest',
    effect: 'Gain 2 plants for every point of your influence.',
    winner: 'Place a greenery tile for free. Raise oxygen 1 step if it is not at its maximum.',
    quest: 'Place 2 greeneries',
  },
  quest: {goal: {kind: 'tile', tile: 'greenery'}, count: 2},
  scaled: [BIODOME_CONTEST_PLANTS],
  winnerReward: {kind: 'tile', tile: 'greenery'},
  immediateSteps: [PLANTS_STEP],
  winnerSteps: [GREENERY_STEP],
};
