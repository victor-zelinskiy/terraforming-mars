import {IProjectCard} from '../IProjectCard';
import {IActionCard, ICard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {PlayerInput} from '../../PlayerInput';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {PATENTS_SOLD_UNIT} from '../base/standardProjects/patentSale';
import {cardSource} from '../../inputs/choiceContext';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** The printed «3 [data]» of the play. */
export const DATA_ON_PLAY = 3;
/** The effect's printed rate — data here per card sold. */
export const DATA_PER_PATENT_SOLD = 1;
/** The action's printed keep — «Take 1 of them in hand». */
export const CARDS_KEPT = 1;

/** The action's first blocker: no data on the card — nothing to discard, nothing to draw. */
export const RESEARCH_STARTUPS_NO_DATA_REASON = '${0} of 1 data on this card';

/**
 * WHAT ONE ACTIVATION DOES with the data on the card — THE ONE reading the
 * preview, the reason and the action share (rules 5, 6): all `spent` data
 * leave the card, the deck turns over `revealed` cards (the deck and its
 * reshuffled discard hold fewer than `spent` → as many as there are), the
 * player keeps `kept` of them (one, or the only one — no choice), and
 * `discarded` go to the discard pile.
 */
export type ResearchStartupsActivation = {spent: number, revealed: number, kept: number, discarded: number};

/**
 * TR46 — RESEARCH STARTUPS («Исследовательские стартапы»), a Turmoil Redux
 * PROJECT card: the set's first card that answers THE PATENT SALE. The
 * standard project «Sell patents» calls the fork hook `onPatentsSold` with the
 * cards it discarded (the ONE writer, `SellPatentsStandardProject`), and this
 * card stores 1 data per card sold; its action spends ALL the data here for as
 * many cards off the deck, of which the player keeps one — Hi-Tech Lab's
 * «X → X cards, keep 1» with X fixed by the card instead of chosen.
 *
 * SCAN READING — cost 8, blue (ACTIVE). Two tags in the corner, in this order:
 * the atom (Science) and the brown roof (Building). The orange MIN plate beside
 * the cost holds the SCIENTISTS' emblem (the flask, the vertical «MIN»): the
 * REQUIREMENT (`{party: SCIENTISTS}`), never a tag. The upper field holds TWO
 * rows: the EFFECT «[orange «Sell Patents» plate] : [data] / [card]» (the
 * standard project's plate, the effect's colon, «1 data per card») and the
 * ACTION «X [data] → X [card]*» (the asterisk: «take 1, discard the rest»).
 * The lower field is the on-play row «3 [data]» (a digit and ONE icon). No VP
 * badge. Only the module's symbol at the bottom left (the purple diamond with
 * the arrow): no `compatibility`. Printed lore: «Failing upwards - a proud
 * tradition kept all the way since Silicon Valley!» (`lore_texts.json`
 * «TR46»). Art credit Michal Ures.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/ResearchStartups.spec.ts):
 *  1. The REQUIREMENT is the Scientists' plate (the TR15 / TR38 class): the
 *     Scientists rule or 2 of the player's OWN delegates stand on their
 *     resolution — checked at the play only; TR36 lowers an EFFECT's
 *     threshold, never a requirement's.
 *  2. ON PLAY: +3 data on THIS card (fixed). The Science tag wakes the
 *     engine's science reactors (TR05 Vector Computations, Olympus
 *     Conference, Mars University); the 3 data wake TR18 Martian Fiber (+3
 *     M€); the Building tag lets steel pay.
 *  3. THE EFFECT: after EVERY sale of patents by the card's OWNER, +1 data here
 *     per card sold — N cards, N data in ONE addition (one `onResourceAdded`
 *     of N: Martian Fiber pays N). A rival's sale pays nothing; a card in the
 *     hand answers nothing (only the tableau is walked).
 *  4. «SELL PATENTS» IS THE STANDARD PROJECT «Sell patents» — its one writer
 *     calls the hook with the cards sold. CEO Stefan's sale and Ceres Tech
 *     Market (out of the premium scope) and the Scientists' resolution Open IP
 *     Trade («not the patent sale», RX24) are not it.
 *  5. THE ACTION: X = the data on this card at the press (X ≥ 1). All X leave
 *     the card; the deck turns over X cards (its discard reshuffled when the
 *     pile runs out — the engine's rule; fewer than X in deck AND discard →
 *     as many as there are, named before the press); the player takes ONE in
 *     hand, the rest go to the discard pile. Once per generation.
 *  6. ONE CARD TURNED OVER (X = 1, or a deck holding one) is no choice: it goes
 *     to the hand through the plain draw's reveal (the keep-all branch) —
 *     invariant 3's exemption, no target is hidden. NO DATA → the action is
 *     unavailable, «0 of 1 data on this card»; an empty deck AND discard →
 *     «The deck is empty». The data are never burnt for nothing.
 *  7. THE PICK IS HIDDEN INFORMATION: the cards come off the deck at the
 *     press, so the pick is never pre-collected — it is the step AFTER the
 *     press, in the same workspace (`deckPickPrompt` mode `keep`, sourced by
 *     this card).
 *  8. THE ORDER of the live path: the data leave → the deck turns X over → the
 *     pick → the rest to the discard pile (`ChooseCards.keep`).
 *  9. THE JOURNAL: the sale reads «sold N patents», then the effect «added N
 *     data to Research Startups» with its reason «for N patents sold» (the
 *     event's `basis`); the action «discarded X data from Research Startups
 *     to look at X cards», then the engine's «drew 1 card(s)» (the card's
 *     name is the owner's private line).
 * 10. A RIVAL is told the sale's answer in the event order and the action's
 *     «drew 1 card» without the card (hidden information).
 * 11. MarsBot never plays the card and never sells patents; save / load:
 *     nothing new — the data count and the once-per-generation flag
 *     serialize as on every holder.
 * 12. FORECAST: the play's «+3 data» and the table's answers come from the
 *     engine (declarative); the action's preview reads the activation above;
 *     the sale's answer (this card and what answers it) rides the sale
 *     prompt's `patentSale` model, read off `patentsSoldForecast` — the live
 *     hook's twin, by the same rate.
 */
export class ResearchStartups extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.RESEARCH_STARTUPS,
      type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.BUILDING],
      cost: 8,
      resourceType: CardResource.DATA,
      requirements: {party: PartyName.SCIENTISTS},

      // Rule 2 — fixed.
      behavior: {
        addResources: DATA_ON_PLAY,
      },

      metadata: {
        cardNumber: 'TR46',
        infoText: [
          // The printed rules run past the browser's caption budget of 52 in both languages.
          {kind: 'effect-short', text: 'Sell patents: +1 data here per card sold'},
          {kind: 'action-short', text: 'Spend all data: draw that many, keep 1'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.effect('When you Sell Patents, add 1 data here per card sold.', (eb) => {
            eb.plate('Sell Patents').startEffect.resource(CardResource.DATA).slash().cards(1);
          }).br;
          b.action('Discard all data from here and pick up the same number of cards from the deck. Take 1 of them in hand, discard the rest.', (eb) => {
            eb.text('X').resource(CardResource.DATA).startAction.text('X').cards(1).asterix();
          }).br;
          b.resource(CardResource.DATA, {amount: DATA_ON_PLAY, digit});
        }),
        description: 'Requires the Scientists to be ruling or that you have 2 delegates there. Add 3 data resources to this card.',
      },
    });
  }

  /** THE ONE READING of an activation (rules 5, 6) — the preview, the reason and the action ask it alike. */
  public static activationAt(player: IPlayer, dataHere: number): ResearchStartupsActivation {
    const revealed = Math.min(dataHere, player.game.projectDeck.size());
    const kept = Math.min(CARDS_KEPT, revealed);
    return {spent: dataHere, revealed, kept, discarded: revealed - kept};
  }

  /** Rule 3 — the patent sale's ONE writer calls this with the cards it discarded: one addition of N. */
  public onPatentsSold(player: IPlayer, sold: ReadonlyArray<ICard>): void {
    const count = sold.length * DATA_PER_PATENT_SOLD;
    if (count <= 0) {
      return;
    }
    player.addResourceTo(this, {qty: count, log: true, basis: {count: sold.length, unitKey: PATENTS_SOLD_UNIT}});
  }

  /** Mirrors `onPatentsSold`: the data the sale of `count` cards lands here, at once. */
  public patentsSoldForecast(owner: IPlayer, count: number): ReadonlyArray<EffectForecastFact> {
    if (count <= 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, owner, 'standard-project'),
      [actionPreviews.cardGain(this, count * DATA_PER_PATENT_SOLD)],
      'You sell patents')];
  }

  /** Rule 6 — ONE reason, in order: the data here, then the deck. */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.resourceCount <= 0) {
      return {type: 'count', message: RESEARCH_STARTUPS_NO_DATA_REASON, params: [String(this.resourceCount)], current: this.resourceCount};
    }
    if (!player.game.projectDeck.canDraw(1)) {
      return actionReason.deckEmpty();
    }
    return undefined;
  }

  public canAct(player: IPlayer): boolean {
    return this.actionUnavailableReason(player) === undefined;
  }

  /** Rules 5, 6, 8 — all the data leave, the deck turns X over, the pick (or the lone card's reveal). */
  public action(player: IPlayer): PlayerInput | undefined {
    const activation = ResearchStartups.activationAt(player, this.resourceCount);
    player.removeResourceFrom(this, activation.spent, {log: false});
    player.game.log('${0} discarded ${1} ${2} from ${3} to look at ${4} card(s) from the deck', (b) =>
      b.player(player).number(activation.spent).cardResource(CardResource.DATA).card(this).number(activation.revealed));
    if (activation.revealed <= 1) {
      player.drawCard(activation.revealed, {source: {type: 'card', cardName: this.name}});
    } else {
      player.drawCardKeepSome(activation.revealed, {keepMax: CARDS_KEPT, promptSource: cardSource(this)});
    }
    return undefined;
  }

  /**
   * ONE branch: the data leaving the card (`X → 0`) and the draw that keeps one —
   * «+1 card · of X turned over» (`look`), every number from the activation the
   * action itself reads. The pick behind the press is hidden information and
   * is never a pre-collected step (rule 7).
   */
  public actionPreview(player: IPlayer): ActionPreview {
    const activation = ResearchStartups.activationAt(player, this.resourceCount);
    return actionPreviews.singleBranch(this, player, [], [
      actionPreviews.cardCost(this, activation.spent),
      actionPreviews.deckLookGain(activation.revealed, activation.kept),
    ]);
  }
}
