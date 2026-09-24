/*
 * AQUIFER CONTEST (the Greens) — Turmoil Redux resolution RX01, and THE
 * TEMPLATE every real resolution after it follows (docs/TURMOIL_REDUX_AQUIFER_CONTEST.md).
 *
 * Printed: «When enacted: Add 1 animal resource to any card per point of
 * Influence. The player that won this resolution places an Ocean tile.»
 * Chairman quest: play a card with an animal tag.
 *
 * THE READINGS FIXED HERE:
 *  · «per point of Influence» pays EVERY participant by THEIR OWN influence at
 *    the enactment — not the voters, not the winner only, not the delegates
 *    on the card. The winner's Agenda step of the phase already counts (the
 *    driver seeds `ctx.influence` after step 1 — rulebook p.10).
 *  · «to any card» is ONE payout onto ONE own card that can hold animals: the
 *    card's own storage rule decides (`getResourceCards(ANIMAL)` — an animal
 *    TAG is not storage; 0 stored animals is a fine target). Nothing is split
 *    across cards, nothing is banked, nothing is converted.
 *  · Influence 0 asks no question. No eligible card: the payout is NAMED and
 *    forfeited (the journal and the outcome say so — never a silent loss).
 *  · The ocean is the WINNER's, through the standard placement (legal cells,
 *    TR, cell and adjacency bonuses, the Greens' own 2 M€ per TR through the
 *    ordinary hook — nothing re-implemented here). A neutral winner places
 *    none (`winnerSteps` never run for one); no ocean left, or no cell that
 *    can take one → the part is named and skipped.
 *  · Both parts fire AT THE ENACTMENT only: the driver's idempotency keys
 *    (`effect:<generation>:<instance>:<player>:<step>`) make a reload, a
 *    repeated answer or a model refresh pay nothing twice, and a LATER
 *    enactment of the same card (after a reshuffle) is a new generation's
 *    keys — a separate application.
 *
 * THE STEP CONTRACT (IResolution.ts): a step MUTATES or ASKS, never both —
 * the driver re-runs `run` on a reload to rebuild the pending prompt. The
 * animals step therefore fixes its AMOUNT in `ctx.state` the first time it
 * runs and re-reads it afterwards (the number the question was built with is
 * the number the answer pays), and every mutation happens inside the prompt's
 * own callback.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {CardResource} from '../../../../common/CardResource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {message} from '../../../logs/MessageBuilder';
import {AddResourcesToCard} from '../../../deferredActions/AddResourcesToCard';
import {PlaceOceanTile} from '../../../deferredActions/PlaceOceanTile';
import {committedPlacement} from '../../../inputs/placementContext';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const AQUIFER_CONTEST_ID: ResolutionId = 'RDX_GREENS_AQUIFER_CONTEST';
export const AQUIFER_CONTEST_CODE: ResolutionCode = 'RX01';

/** THE FORMULA: 1 animal per point of influence, for every participant. */
export const AQUIFER_CONTEST_ANIMALS: InfluenceScaledEffect = {
  id: 'animals',
  unit: {kind: 'cardResource', resource: CardResource.ANIMAL},
  perInfluence: 1,
  recipient: 'each',
};

/** WHO asks — the same source on the picker, the placement and every skip. */
const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: AQUIFER_CONTEST_ID};

/** The state key the animals step fixes its amount under (see the contract above). */
const ANIMALS_OWED_KEY = 'animalsOwed';

const ANIMALS_STEP: EnactStep = {
  key: 'animals',
  run(ctx) {
    const player = ctx.player;
    const remembered = ctx.state[ANIMALS_OWED_KEY];
    const owed = typeof remembered === 'number' ? remembered : scaledAmount(AQUIFER_CONTEST_ANIMALS, ctx.influence);
    ctx.state[ANIMALS_OWED_KEY] = owed;
    if (owed <= 0) {
      ctx.game.log('${0} has no influence — no animals from ${1}', (b) => b.player(player).resolution(AQUIFER_CONTEST_ID));
      ctx.report({kind: 'skipped', effect: AQUIFER_CONTEST_ANIMALS.id, resource: CardResource.ANIMAL, amount: 0, influence: ctx.influence, reason: 'No influence'});
      return undefined;
    }
    const cards = player.getResourceCards(CardResource.ANIMAL);
    if (cards.length === 0) {
      ctx.game.log('${0} has no card that can hold animals — ${1} animal(s) from ${2} are forfeited', (b) =>
        b.player(player).number(owed).resolution(AQUIFER_CONTEST_ID));
      ctx.report({kind: 'skipped', effect: AQUIFER_CONTEST_ANIMALS.id, resource: CardResource.ANIMAL, amount: owed, influence: ctx.influence, reason: 'No card can hold animals'});
      return undefined;
    }
    // THE SHARED PICKER — the same `AddResourcesToCard` every card, corporation
    // and colony bonus uses: the candidates (0-animal cards included), the
    // «current → resulting» and VP readings and the source dock all come from
    // it. `autoSelect: false` is the «to ANY card» law of this fork: a single
    // candidate is still SHOWN and confirmed, never applied behind the board.
    // The title states the ASK alone; WHO asks is the prompt's source
    // (`cause`) — the dock / the enactment stage name the resolution, so a
    // title that repeated it read twice on every surface.
    return new AddResourcesToCard(player, CardResource.ANIMAL, {
      count: owed,
      autoSelect: false,
      title: message('Add ${0} animal(s) to one of your cards', (b) => b.number(owed)),
      cause: SOURCE,
      from: {resolution: AQUIFER_CONTEST_ID},
    }).andThen((card) => {
      ctx.report({kind: 'cardResource', effect: AQUIFER_CONTEST_ANIMALS.id, resource: CardResource.ANIMAL, amount: owed, card: card.name, influence: ctx.influence});
    }).execute();
  },
};

const OCEAN_STEP: EnactStep = {
  key: 'ocean',
  run(ctx) {
    const player = ctx.player;
    const game = ctx.game;
    if (!game.canAddOcean()) {
      game.log('No ocean tile is left — the winner\'s ocean from ${0} is skipped', (b) => b.resolution(AQUIFER_CONTEST_ID));
      ctx.report({kind: 'skipped', reason: 'No ocean tile is left'});
      // The standard operation still runs for its own no-ocean rule (an
      // Underworld Whales takes the animal instead) — it asks nothing.
      new PlaceOceanTile(player).execute();
      return undefined;
    }
    if (game.board.getAvailableSpacesForOcean(player).length === 0) {
      game.log('No space can take an ocean — the winner\'s ocean from ${0} is skipped', (b) => b.resolution(AQUIFER_CONTEST_ID));
      ctx.report({kind: 'skipped', reason: 'No space can take an ocean'});
      return undefined;
    }
    // THE STANDARD PLACEMENT: the console's board flow with the cell dossier,
    // the tile's own bonuses and follow-ups, `addOcean` → TR (the phase is
    // PARLIAMENT, never SOLAR, so the TR is paid and the Greens react through
    // their ordinary hook). No standard-project cost, no action spent — the
    // prompt is the phase's, not the player's turn.
    // The STANDARD title («Select space for ocean tile» — the dossier demotes
    // the generic sentence and leads with the tile); the source plate names
    // the resolution through `placementContext.source`.
    return new PlaceOceanTile(player, {
      placementContext: committedPlacement('The winner of the vote places this ocean. The resolution is already enacted.', SOURCE),
    }).andThen((space) => {
      if (space !== undefined) {
        // The ocean IS its parameter's step: the count after the placement
        // is the one before plus this tile (the count moves by nothing else
        // inside the answer).
        const after = game.board.getOceanSpaces().length;
        ctx.report({kind: 'ocean', space: space.id, parameter: {id: 'oceans', before: after - 1, after}});
      }
    }).execute();
  },
};

export const AQUIFER_CONTEST: ResolutionDefinition = {
  id: AQUIFER_CONTEST_ID,
  code: AQUIFER_CONTEST_CODE,
  module: 'turmoilRedux',
  party: PartyName.GREENS,
  copies: 1,
  // THE FACE: the per-influence formula on its own row (animal / influence),
  // the winner's ocean on the next with the winner star — two readings, two
  // rows, never one line the eye has to split.
  renderData: CardRenderer.builder((b) => {
    b.resource(CardResource.ANIMAL, 1).slash().influence().br;
    b.oceans(1).voteWinner();
  }),
  text: {
    name: 'Aquifer Contest',
    effect: 'Add 1 animal per influence to one of your cards that can hold animals.',
    winner: 'Place an ocean tile.',
    quest: 'Play a card with an animal tag',
  },
  quest: {goal: {kind: 'tag', tag: Tag.ANIMAL}, count: 1},
  scaled: [AQUIFER_CONTEST_ANIMALS],
  winnerReward: {kind: 'tile', tile: 'ocean'},
  immediateSteps: [ANIMALS_STEP],
  winnerSteps: [OCEAN_STEP],
};
