/*
 * OPEN IP TRADE (the Scientists) — Turmoil Redux resolution RX24, the FIRST
 * card with an ACTION (docs/TURMOIL_REDUX_OPEN_IP_TRADE.md).
 *
 * Printed: «When enacted: Draw cards equal to your Influence. Action: Discard
 * any number of cards. For each card discarded, gain 3 M€ and draw a card.»
 * Chairman quest: play 2 green (automated) cards.
 *
 * THE READINGS FIXED HERE:
 *  · THE ENACTMENT draws EVERY participant their own influence in cards —
 *    voters or not — through the shared external-draw intake (the RX05 / RX16
 *    path): the cards leave the project deck at the enactment in seat order,
 *    are WITHHELD from the hand until the mandatory take, and the prompt is
 *    a projection of serialized state (a reload inside the take draws nothing
 *    twice). Influence 0 is a NAMED skip; a short deck delivers what it has
 *    and says so. MarsBot takes no seat and draws nothing.
 *  · THE ACTION IS A MEMBER OF THE PARTY-ACTION FAMILY — the action menu
 *    nests its prompt beside the party actions (`ParliamentHandler.
 *    resolutionActionOptions`), stamped with the structural marker
 *    `resolutionActionPrompt` the console reads it by (never its title).
 *    Held by PARTICIPANTS only, and only while the card stands ENACTED —
 *    another law takes the slot, the action is gone from the menu.
 *  · ONCE PER GENERATION, like every action of the Parliament
 *    (`usesPerGeneration` = 1); the use is recorded AT THE COMMIT (the
 *    answer), never when the prompt is built — the generation boundary
 *    resets it (`Parliament.resetGenerationUses`).
 *  · UNAVAILABLE WITH A REASON, never hidden: an empty hand («No cards in
 *    hand to discard»), a spent use, a seat outside the parliament — the
 *    model carries the reason, the menu simply lacks the option.
 *  · «ANY NUMBER» IS NOT ZERO. Zero cards is no action: the prompt asks for
 *    1 to the whole hand (the sale's own form), and an empty answer is
 *    refused by the input.
 *  · THE ORDER INSIDE THE COMMIT: discard → M€ (3 × N into the supply, under
 *    the resolution's source) → draw N as an ordinary draw of the seat's OWN
 *    turn (`drawCard`: the cards go straight to the hand — never the external
 *    intake, which is for cards drawn OUTSIDE one's turn). A deck that cannot
 *    deliver N is honest about what it delivered.
 *  · NOT THE PATENT SALE. The standard project pays 1 M€ per card under its
 *    own source; this action pays 3 M€ AND a card under the LAW's source. The
 *    console reuses the sale's FORM (the multi-pick on the hand) and its SCENE
 *    (the trade terminal), never its action.
 *  · THE CHAIRMAN QUEST asks the player to PLAY 2 GREEN CARDS — a
 *    `cardsPlayed` goal by card TYPE (`automated`): blue, event, prelude and
 *    corporation cards are not green; a discard by this action is not a play;
 *    and a play under a resolution source never counts (decision Q5) — which
 *    this action never does anyway, since it plays nothing.
 *
 * THE STEP CONTRACT (IResolution.ts): the draw step is the one documented
 * exception the intake makes safe — it takes the cards off the deck and asks
 * in the same breath, and re-entry (a reload) is idempotent because the
 * intake it remembers IS game state.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {ExternalDrawIntake} from '../../../deferredActions/ExternalDrawIntake';
import {SelectCard} from '../../../inputs/SelectCard';
import {InputError} from '../../../inputs/InputError';
import {IProjectCard} from '../../../cards/IProjectCard';
import {IPlayer} from '../../../IPlayer';
import {EnactStep, ResolutionAction, ResolutionDefinition} from '../IResolution';
import {runResolutionAction} from '../ResolutionAction';

export const OPEN_IP_TRADE_ID: ResolutionId = 'RDX_SCIENTISTS_OPEN_IP_TRADE';
export const OPEN_IP_TRADE_CODE: ResolutionCode = 'RX24';
/** The printed «gain 3 M€» — per card discarded by the action. */
export const OPEN_IP_TRADE_MEGACREDITS_PER_CARD = 3;
/** The printed «draw a card» — per card discarded by the action. */
export const OPEN_IP_TRADE_CARDS_PER_CARD = 1;
/** Once per generation, as every action of the Parliament. */
export const OPEN_IP_TRADE_USES_PER_GENERATION = 1;
/** The action's own gate: nothing to discard. */
export const OPEN_IP_TRADE_NO_CARDS_REASON = 'No cards in hand to discard';

/** THE ENACTMENT: 1 card per point of influence, for every participant — no cap. */
export const OPEN_IP_TRADE_DRAW: InfluenceScaledEffect = {
  id: 'draw',
  unit: {kind: 'cards'},
  perInfluence: 1,
  recipient: 'each',
};

const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: OPEN_IP_TRADE_ID};

/** The intake the draw step opened — the proof it already drew (game state carries the cards). */
const INTAKE_KEY = 'drawIntake';

const DRAW_STEP: EnactStep = {
  key: 'draw',
  run(ctx) {
    const player = ctx.player;
    const effect = OPEN_IP_TRADE_DRAW;
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
      ctx.game.log('${0} has no influence — no cards from ${1}', (b) => b.player(player).resolution(OPEN_IP_TRADE_ID));
      ctx.report({kind: 'skipped', effect: effect.id, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    // THE SHARED INTAKE: the project deck, the standard exhaustion behaviour,
    // the cards withheld from the hand until taken, the prompt re-derivable.
    const intake = ExternalDrawIntake.open(player, owed, {kind: 'resolution', resolution: OPEN_IP_TRADE_ID, effect: effect.id});
    if (intake === undefined) {
      // The deck (and its discard) had nothing left — named, never silent.
      ctx.report({kind: 'skipped', effect: effect.id, amount: owed, drawn: 0, influence, reason: 'The project deck is empty'});
      return undefined;
    }
    ctx.state[INTAKE_KEY] = intake.id;
    ctx.game.log('${0} draws ${1} card(s) from ${2}: 1 per point of influence, influence ${3}', (b) =>
      b.player(player).number(intake.count).resolution(OPEN_IP_TRADE_ID).number(influence));
    if (intake.count < owed) {
      ctx.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) =>
        b.number(intake.count).number(owed).player(player));
    }
    ctx.report({kind: 'cards', effect: effect.id, amount: owed, drawn: intake.count, intake: intake.id, influence});
    return ExternalDrawIntake.takePromptFor(player, intake);
  },
};

/**
 * THE COMMIT of the action: the picked cards leave the hand, the supply
 * receives 3 M€ per card, and N cards are drawn — in that order, all under
 * the resolution's own scope (the caller's `runResolutionAction`). The draw
 * is the seat's ordinary in-turn draw; what the deck could not deliver is
 * journaled, never silent.
 */
export function tradePatents(player: IPlayer, cards: ReadonlyArray<IProjectCard>): {discarded: number, megacredits: number, drawn: number} {
  for (const card of cards) {
    player.discardCardFromHand(card, {log: true});
  }
  const discarded = cards.length;
  const megacredits = OPEN_IP_TRADE_MEGACREDITS_PER_CARD * discarded;
  player.stock.add(Resource.MEGACREDITS, megacredits, {log: false, from: {resolution: OPEN_IP_TRADE_ID}});
  const owed = OPEN_IP_TRADE_CARDS_PER_CARD * discarded;
  const before = player.cardsInHand.length;
  player.drawCard(owed);
  const drawn = player.cardsInHand.length - before;
  player.game.log('${0} discarded ${1} card(s) for ${2}: gains ${3} M€ and draws ${4} card(s)', (b) =>
    b.player(player).number(discarded).resolution(OPEN_IP_TRADE_ID).number(megacredits).number(drawn));
  if (drawn < owed) {
    player.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) =>
      b.number(drawn).number(owed).player(player));
  }
  return {discarded, megacredits, drawn};
}

const OPEN_IP_TRADE_ACTION: ResolutionAction = {
  usesPerGeneration: () => OPEN_IP_TRADE_USES_PER_GENERATION,
  canAct(player) {
    return player.cardsInHand.length > 0 ? {available: true} : {available: false, reason: OPEN_IP_TRADE_NO_CARDS_REASON};
  },
  // THE COMMIT CONTRACT: building the prompt changes nothing; the answer is the
  // commit. The pick is the SALE's own form (any number from the hand, at
  // least one), marked as a DISCARD that BUYS 3 M€ and a card per card — the
  // console's one discard skin reads the exchange from this marker alone.
  execute(player, parliament, meta) {
    const hand = player.cardsInHand;
    const max = hand.length;
    return new SelectCard<IProjectCard>(
      'Discard any number of cards (Open IP Trade)',
      'Discard',
      hand,
      {min: 1, max, played: false})
      .markChoiceContext({source: SOURCE, trigger: 'Resolution action', mode: 'effect-choice'})
      .markDiscardPrompt({
        min: 1, max, source: SOURCE,
        exchange: {icon: 'megacredits', amount: OPEN_IP_TRADE_MEGACREDITS_PER_CARD, perCard: true, draw: OPEN_IP_TRADE_CARDS_PER_CARD},
      })
      .markResolutionActionPrompt(meta)
      .andThen((cards) => {
        // «Any number» is never zero — the input's own bound says so first;
        // this is the belt to its braces.
        if (cards.length === 0) {
          throw new InputError('Discard at least 1 card');
        }
        runResolutionAction(player, parliament, OPEN_IP_TRADE_ID, () => {
          tradePatents(player, cards);
        });
        return undefined;
      });
  },
  // The RATE, honestly: the player chooses N — the tile reads the exchange
  // per card, the pick's own live sum reads the total.
  preview() {
    return [
      {direction: 'cost', icon: 'cards', amount: 1, note: 'per card'},
      {direction: 'gain', icon: 'megacredits', amount: OPEN_IP_TRADE_MEGACREDITS_PER_CARD, note: 'per card'},
      {direction: 'gain', icon: 'cards', amount: OPEN_IP_TRADE_CARDS_PER_CARD, note: 'per card'},
    ];
  },
};

export const OPEN_IP_TRADE: ResolutionDefinition = {
  id: OPEN_IP_TRADE_ID,
  code: OPEN_IP_TRADE_CODE,
  module: 'turmoilRedux',
  party: PartyName.SCIENTISTS,
  copies: 1,
  // THE FACE as printed: «[card] / [influence]» on the first row, the ACTION
  // on the second — «X [card] → X [card] [3X M€]».
  renderData: CardRenderer.builder((b) => {
    b.cards(1).slash().influence().br;
    b.action(undefined, (ab) => ab.text('X').cards(1).startAction.text('X').cards(1).megacredits(OPEN_IP_TRADE_MEGACREDITS_PER_CARD, {text: '3x'}));
  }),
  text: {
    name: 'Open IP Trade',
    effect: 'Draw 1 card per influence.',
    // The per-generation limit is structural (`usesPerGeneration`), never a
    // clause of the sentence — every surface prints it beside the live uses.
    action: 'Discard any number of cards. For each card discarded, gain 3 M€ and draw a card.',
    quest: 'Play 2 green cards',
  },
  // BY TYPE: a green card is an AUTOMATED card — never a tag, never a colour of the face.
  quest: {goal: {kind: 'cardsPlayed', cardType: 'automated'}, count: 2},
  scaled: [OPEN_IP_TRADE_DRAW],
  immediateSteps: [DRAW_STEP],
  action: OPEN_IP_TRADE_ACTION,
};
