/*
 * SPONSORED PROJECTS (the Scientists) — Turmoil Redux resolution RX40, and the
 * first law that pays the seats' cards WITHOUT A QUESTION
 * (docs/TURMOIL_REDUX_SPONSORED_PROJECTS.md).
 *
 * Printed: «When enacted: Draw cards equal to your Influence. Add 1 resource
 * to each of your cards that already has a resource.» Chairman quest: add 4
 * data resources to your cards.
 *
 * THE READINGS FIXED HERE (each pinned by tests/parliament/SponsoredProjects.spec.ts):
 *  · THE PRINTED ORDER IS THE EXECUTED ORDER, seat by seat: the draw, then the
 *    resources. The draw puts cards in the HAND, never on the table, so it
 *    changes no number of the second part — but the records and the scene go
 *    in the printed order.
 *  · THE DRAW = INFLUENCE for EVERY participant (voters or not), through the
 *    shared external-draw intake — Open IP Trade's step: the cards leave the
 *    deck at the enactment, are withheld until the mandatory take, and a
 *    reload inside the take draws nothing twice. Influence 0 is a NAMED skip
 *    («No influence»), an empty deck another («The project deck is empty»), a
 *    short deck delivers what it has and says so.
 *  · «EACH OF YOUR CARDS THAT ALREADY HAS A RESOURCE» is the seat's tableau
 *    read by THE ENGINE (`Player.getCardsWithResources` — a storage rule AND
 *    at least one resource on it, at the step): the count `cardsWithResources`,
 *    the payout and every reading stand on that one function. A corporation is
 *    a card of the tableau (decision Р2 — Arklight, Celestic, Recyclon); a
 *    holder with nothing on it is not («already has»); another seat's card
 *    never is.
 *  · EACH CARD TAKES ONE OF ITS OWN KIND — the unit declares no kind
 *    (`'own-kind'`) and asks nothing (`onto: 'each-counted'`, the shared step
 *    `eachCountedCardStep`): 1 animal on Fish, 1 floater on Dirigibles, 1 data
 *    on Political Science. No question of the kind, none of the card.
 *  · THROUGH `addResourceTo`: the journal names each card under the law, the
 *    cards' points move by their own rules, and the table's answers to an
 *    added resource answer (Meat Industry's 2 M€ per animal).
 *  · TWO PARTS, TWO NAMED ZEROS: «No influence» for the draw, «No card of
 *    yours has a resource yet» for the resources — never one «nothing».
 *  · THE QUEST — 4 data added to the seat's cards: the law's own data never
 *    count (the political phase is a resolution's root); the seat's own
 *    actions do.
 *  · MARSBOT — nothing (decision Р3): the draw and the resources are PAYOUTS
 *    of the law, not a deed on the board or the track; the bot has no hand and
 *    no cards (its «card resources» are a storage area), and a translation
 *    would be invented — exactly what D3 excludes and D11 does not change.
 *  · ONCE per enactment: the driver's keys; the intake is game state; the
 *    counted cards are fixed in `ctx.state` the first time the step runs.
 *
 * THE STEP CONTRACT (IResolution.ts): the draw ASKS through the intake (the
 * one documented exception, safe by construction); the resources MUTATE and
 * ask nothing.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {CardResource} from '../../../../common/CardResource';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ExternalDrawIntake} from '../../../deferredActions/ExternalDrawIntake';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {eachCountedCardStep} from '../ResolutionEachCard';

export const SPONSORED_PROJECTS_ID: ResolutionId = 'RDX_SCIENTISTS_SPONSORED_PROJECTS';
export const SPONSORED_PROJECTS_CODE: ResolutionCode = 'RX40';
/** The printed «4 [data]» — the chairman quest's count. */
export const SPONSORED_PROJECTS_QUEST_DATA = 4;

/** THE DRAW: 1 card per point of influence, for every participant — Open IP Trade's part, word for word. */
export const SPONSORED_PROJECTS_DRAW: InfluenceScaledEffect = {
  id: 'draw',
  unit: {kind: 'cards'},
  perInfluence: 1,
  recipient: 'each',
};

/**
 * THE RESOURCES: 1 of its own kind onto EVERY card of the seat that already
 * holds a resource — no influence term, no base, no question.
 */
export const SPONSORED_PROJECTS_RESOURCES: InfluenceScaledEffect = {
  id: 'resources',
  unit: {kind: 'cardResource', resources: 'own-kind', onto: 'each-counted'},
  base: 0,
  perInfluence: 0,
  count: {id: 'cardsWithResources', per: 1},
  recipient: 'each',
};

/** The intake the draw step opened — the proof it already drew (game state carries the cards). */
const INTAKE_KEY = 'drawIntake';

const DRAW_STEP: EnactStep = {
  key: 'draw',
  run(ctx) {
    const player = ctx.player;
    const effect = SPONSORED_PROJECTS_DRAW;
    // RE-ENTRY (a reload inside the take): the cards already left the deck and
    // sit in the intake — game state. Nothing is drawn again; the mandatory
    // prompt is re-derived from the intake.
    const remembered = ctx.state[INTAKE_KEY];
    if (typeof remembered === 'number') {
      const pending = ExternalDrawIntake.pendingOf(player, remembered);
      return pending === undefined ? undefined : ExternalDrawIntake.takePromptFor(player, pending);
    }
    const influence = ctx.influence;
    const owed = scaledAmount(effect, influence);
    if (owed <= 0) {
      ctx.game.log('${0} has no influence — no cards from ${1}', (b) => b.player(player).resolution(SPONSORED_PROJECTS_ID));
      ctx.report({kind: 'skipped', effect: effect.id, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    // THE SHARED INTAKE: the project deck, the standard exhaustion behaviour,
    // the cards withheld from the hand until taken, the prompt re-derivable.
    const intake = ExternalDrawIntake.open(player, owed, {kind: 'resolution', resolution: SPONSORED_PROJECTS_ID, effect: effect.id});
    if (intake === undefined) {
      // The deck (and its discard) had nothing left — named, never silent.
      ctx.report({kind: 'skipped', effect: effect.id, amount: owed, drawn: 0, influence, reason: 'The project deck is empty'});
      return undefined;
    }
    ctx.state[INTAKE_KEY] = intake.id;
    ctx.game.log('${0} draws ${1} card(s) from ${2}: 1 per point of influence, influence ${3}', (b) =>
      b.player(player).number(intake.count).resolution(SPONSORED_PROJECTS_ID).number(influence));
    if (intake.count < owed) {
      ctx.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) =>
        b.number(intake.count).number(owed).player(player));
    }
    ctx.report({kind: 'cards', effect: effect.id, amount: owed, drawn: intake.count, intake: intake.id, influence});
    return ExternalDrawIntake.takePromptFor(player, intake);
  },
};

export const SPONSORED_PROJECTS: ResolutionDefinition = {
  id: SPONSORED_PROJECTS_ID,
  code: SPONSORED_PROJECTS_CODE,
  module: 'turmoilRedux',
  party: PartyName.SCIENTISTS,
  copies: 1,
  // THE FACE, as printed: «[a card holding resources] : + [?]» — the set's own
  // holder glyph (the white card with its three cubes, TR53 Frontier Labs'
  // `resourceCard()`) and the «?» cube: one resource of THAT card's kind —
  // beside «[card] / [influence]». (The classic global event draws the same
  // rule with a card wearing the wild-resource corner; this set prints the
  // holder itself, and the premium face draws it whole.)
  renderData: CardRenderer.builder((b) => {
    b.resourceCard().colon().plus().resource(CardResource.RESOURCE_CUBE, {questionMark: true}).nbsp;
    b.cards(1).slash().influence();
  }),
  text: {
    name: 'Sponsored Projects',
    effect: 'Draw 1 card per point of your influence. Then add 1 resource to each of your cards that already holds a resource.',
    quest: 'Add 4 data resources to your cards',
  },
  quest: {goal: {kind: 'cardResource', resource: CardResource.DATA}, count: SPONSORED_PROJECTS_QUEST_DATA},
  scaled: [SPONSORED_PROJECTS_DRAW, SPONSORED_PROJECTS_RESOURCES],
  // THE PRINTED ORDER: the cards first, then a resource onto every card that holds one.
  immediateSteps: [DRAW_STEP, eachCountedCardStep(SPONSORED_PROJECTS_ID, SPONSORED_PROJECTS_RESOURCES)],
};
