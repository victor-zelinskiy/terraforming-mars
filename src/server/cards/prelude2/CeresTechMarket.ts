import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {digit} from '../Options';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IActionCard} from '../ICard';
import {PlayerInput} from '../../PlayerInput';
import {SelectCard} from '../../inputs/SelectCard';
import {Resource} from '../../../common/Resource';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {ChoiceContextSource, DiscardPromptMeta} from '../../../common/models/PlayerInputModel';
import {cardDiscard, cardSource, discardForMegacredits} from '../../inputs/discardPrompt';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/** The printed exchange: «2x [M€]» per card thrown. */
export const CERES_TECH_MARKET_MEGACREDITS_PER_CARD = 2;
/** The live discard's title (and the preview step's — one key, one ask). */
export const CERES_TECH_MARKET_DISCARD_TITLE = 'Discard cards for 2 M€ each';
/** The multi-pick's count label in the composer row. */
export const CERES_TECH_MARKET_COUNT_LABEL = 'Cards to discard';
/** WHY the action is blocked — the patent sale's own words (one key, `ru/ui.json`). */
export const CERES_TECH_MARKET_NO_CARDS_REASON = 'No cards in hand';

/**
 * P68 — CERES TECH MARKET («Технорынок Цереры»), a Prelude 2 blue card: cost 12,
 * Science + Space, 1 VP, no requirement, Colonies-compatible.
 *
 * SCAN READING — «12» the price, no requirement plate, the atom and the star
 * (Science, Space) in the corner; the action frame «−X [card] → 2x [M€]» with its
 * caption; below, «2 [M€] / [colony]» with «(Gain 2 M€ per colony you own.)» — the
 * play; the VP «1» in its circle (the planet is the badge's ground, not a tag);
 * the Prelude 2 and Colonies icons at the bottom left. Lore: «Ceres is the
 * commercial hub of the asteroid belt, where you find independent buyers from the
 * outer solar system.»
 *
 * RULE READINGS (pinned by tests/cards/prelude2/CeresTechMarket.spec.ts):
 *  1. PLAY — 2 M€ per colony of the player's own (declarative, one counted term).
 *  2. ACTION — available while the hand holds a card; otherwise blocked and NAMED
 *     («No cards in hand»).
 *  3. The action's pick is a DISCARD over the whole hand, `min 1` (the owner's
 *     decision 2026-10-30: an action that throws nothing is a move into nowhere —
 *     «not now» is B in the composer and spends nothing), `max` = the hand; the live
 *     `SelectCard` and the preview step carry ONE marker from ONE builder
 *     (`discardOptions`).
 *  4. The answer: each card is discarded by name (public), then +2 M€ per card
 *     through the stock (`stock.add` — the recorder sees the payout under the
 *     action's scope, this card the source), one typed log line.
 *  5. PREVIEW = EXECUTION: one `selectCardStep` over the hand, addressed to this
 *     card's discard, its `revealGain` the rate; no effect chip — the number is the
 *     player's, not the table's. Read-only.
 */
export class CeresTechMarket extends Card implements IActionCard {
  constructor() {
    super({
      name: CardName.CERES_TECH_MARKET,
      type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.SPACE],
      cost: 12,
      victoryPoints: 1,

      behavior: {
        stock: {
          megacredits: {
            colonies: {colonies: {}},
            each: 2,
          },
        },
      },

      metadata: {
        cardNumber: 'P68',
        infoText: [
          {text: 'Gain 2 M€ per colony you own.', tokens: ['megacredits']},
          // The action browser's one-liner: the full rule is over the caption budget (tests/cards/actionCaption.spec.ts).
          {kind: 'action-short', text: 'Discard any cards: 2 M€ each'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.action('Discard any number of cards from your hand to gain 2 M€ for each discarded card.', (ab) =>
            ab.text('-X').cards(1).startAction.text('2x').megacredits(1, {digit})).br;
          b.megacredits(2).slash().colonies();
        }),
        description: 'Gain 2 M€ per colony you own.',
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return player.cardsInHand.length > 0;
  }

  /** Rule 2 — the one blocker. */
  public actionUnavailableReason(player: IPlayer) {
    return player.cardsInHand.length === 0 ? actionReason.ruleReason(CERES_TECH_MARKET_NO_CARDS_REASON) : undefined;
  }

  /** THE discard this card asks — ONE source + exchange for the live `SelectCard` and the preview's marker. */
  private discardOptions(): {source: ChoiceContextSource, exchange: DiscardPromptMeta['exchange']} {
    return {source: cardSource(this), exchange: discardForMegacredits(CERES_TECH_MARKET_MEGACREDITS_PER_CARD)};
  }

  /** Rule 3 — the bounds of the one discard (the live prompt, its marker and the preview read them alike). */
  private discardBounds(player: IPlayer): {min: number, max: number} {
    return {min: 1, max: player.cardsInHand.length};
  }

  // Pretty much a duplicate of SellPatents. Also similar to Ender.
  // Should make card discarding a behavior.
  public action(player: IPlayer): PlayerInput | undefined {
    const bounds = this.discardBounds(player);
    const {exchange} = this.discardOptions();
    return new SelectCard(
      CERES_TECH_MARKET_DISCARD_TITLE,
      'Discard',
      player.cardsInHand,
      {min: bounds.min, max: bounds.max, played: false})
      .markDiscardPrompt(cardDiscard(this, bounds, {exchange}))
      .andThen((cards) => {
        cards.forEach((card) => player.discardCardFromHand(card, {log: true}));
        const megacredits = cards.length * CERES_TECH_MARKET_MEGACREDITS_PER_CARD;
        player.stock.add(Resource.MEGACREDITS, megacredits, {log: false, from: {card: this}});
        player.game.log('${0} gained ${1} M€ by discarding ${2} cards', (b) => b.player(player).number(megacredits).number(cards.length));
        return undefined;
      });
  }

  /** Rule 5 — the pre-collected discard, nothing counted in the effects. */
  public actionPreview(player: IPlayer): ActionPreview {
    const hand = player.cardsInHand;
    const bounds = this.discardBounds(player);
    const discard = this.discardOptions();
    const steps = hand.length === 0 ? [] : [
      actionPreviews.selectCardStep(player, CERES_TECH_MARKET_DISCARD_TITLE, 'Discard', hand, {
        min: bounds.min,
        max: bounds.max,
        showSelectAll: true,
        multiSelect: {
          countLabel: CERES_TECH_MARKET_COUNT_LABEL,
          revealGain: {resource: Resource.MEGACREDITS, amount: CERES_TECH_MARKET_MEGACREDITS_PER_CARD},
        },
        // The live prompt is a DISCARD of this card's: the answer is addressed to exactly that…
        for: {role: 'discard', source: discard.source},
        // …and carries the live prompt's own marker, from the ONE builder above.
        discard: {...bounds, ...discard},
      }),
    ];
    return actionPreviews.singleBranch(this, player, steps, []);
  }
}
