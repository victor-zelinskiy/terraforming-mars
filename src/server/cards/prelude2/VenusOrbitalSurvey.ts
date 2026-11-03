import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IActionCard} from '../ICard';
import {DrawCards} from '../../deferredActions/DrawCards';
import {IProjectCard} from '../IProjectCard';
import {LogType, keep} from '../../deferredActions/ChooseCards';
import {ChooseCards} from '../../deferredActions/ChooseCards';
import {cardSource} from '../../inputs/choiceContext';
import {oneWayDifference} from '../../../common/utils/utils';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/** How many cards the action turns over (the printed «top 2»). */
export const VENUS_ORBITAL_SURVEY_REVEAL = 2;
/** The printed check, named for the verdict line (the existing `Venus tag` key). */
export const VENUS_ORBITAL_SURVEY_CHECK_LABEL = 'Venus tag';
/** WHY the action is blocked — ONE honest reason (`canDraw` counts the draw pile AND the discard pile). */
export const VENUS_ORBITAL_SURVEY_DECK_REASON = 'Fewer than 2 cards left in the deck';

/**
 * P88 — VENUS ORBITAL SURVEY («Орбитальная разведка Венеры»), a Prelude 2 blue
 * card: cost 18, Venus + Space, no VP, no requirement, Venus-compatible.
 *
 * SCAN READING — «18» the price, no requirement plate, the Venus and the star
 * (Venus, Space) in the corner; the action frame — an arrow and the TEXT «ACTION:
 * REVEAL THE TOP 2 CARDS. TAKE ANY VENUS CARDS TO HAND FOR FREE. ANY OTHER CARD YOU
 * EITHER BUY OR DISCARD» (no result icons printed); the art — a map of Venus's
 * active volcanoes; the Prelude 2 and Venus icons at the bottom left. Lore: «Finding
 * suitable locations for your terraforming projects on Venus».
 *
 * RULE READINGS (pinned by tests/cards/prelude2/VenusOrbitalSurvey.spec.ts):
 *  1. ACTION — available while the deck can deal 2 (draw pile + discard pile);
 *     otherwise blocked and NAMED («Fewer than 2 cards left in the deck»).
 *  2. The 2 cards are revealed PUBLICLY: one log line names both (with their tags),
 *     carries the reveal marker (`RevealLogMeta` — the rivals' «Открыты карты»
 *     notification) and the reveal is recorded (`recordCardReveal`).
 *  3. ONE REVEAL — ONE QUESTION. Any non-Venus card → ONE `ChooseCards` buy over the
 *     non-Venus cards ONLY (an upstream spec indexes `cards[0]`), its marker
 *     carrying the Venus cards as COMPANIONS in reveal order; the Venus cards join
 *     the hand WITH the answer (synchronously, before any payment) — so the free
 *     and the bought cards are one intake and nothing reached the hand unseen.
 *     `max 0` (cannot afford) still asks: the player sees the reveal, «Ok» discards.
 *  4. Both Venus → no question: both to the hand at once as ONE drawn batch named
 *     by this card (`enqueueCardDrawReveal`) — the ordinary draw.
 *  5. PREVIEW — one branch, `revealSplit` (count, check, price, the open deck
 *     size); nothing counted in the effects (the result is the deck's). Read-only.
 */
export class VenusOrbitalSurvey extends Card implements IActionCard {
  constructor() {
    super({
      name: CardName.VENUS_ORBITAL_SURVEY,
      type: CardType.ACTIVE,
      tags: [Tag.VENUS, Tag.SPACE],
      cost: 18,

      metadata: {
        cardNumber: 'P88',
        // The action browser's one-liner: the full rule is over the caption budget (tests/cards/actionCaption.spec.ts).
        infoText: [{kind: 'action-short', text: 'Reveal 2: Venus cards free, buy or discard the rest'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Reveal the top 2 cards of the deck. Take any Venus cards into your hand for free. Buy or discard any other card.', (ab) =>
            ab.empty().startAction.cards(2));
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return player.game.projectDeck.canDraw(VENUS_ORBITAL_SURVEY_REVEAL);
  }

  /** Rule 1 — the one blocker. */
  public actionUnavailableReason(player: IPlayer) {
    return this.canAct(player) ? undefined : actionReason.ruleReason(VENUS_ORBITAL_SURVEY_DECK_REASON);
  }

  /** Rule 5 — the split reveal, structure only. */
  public actionPreview(player: IPlayer): ActionPreview {
    const cardCost = player.cardCost;
    return actionPreviews.singleBranch(this, player, [], [], {revealSplit: {
      deck: 'project',
      count: VENUS_ORBITAL_SURVEY_REVEAL,
      check: {tag: Tag.VENUS, label: VENUS_ORBITAL_SURVEY_CHECK_LABEL},
      match: {destination: 'hand', free: true},
      miss: {kind: 'buy', cardCost, affordable: cardCost > 0 ? Math.floor(player.spendableMegacredits() / cardCost) : VENUS_ORBITAL_SURVEY_REVEAL},
      deckSize: player.game.projectDeck.size(),
    }});
  }

  public action(player: IPlayer) {
    const game = player.game;
    const isVenus = (card: IProjectCard) => player.tags.cardHasTag(card, Tag.VENUS);

    game.defer(new DrawCards(player, VENUS_ORBITAL_SURVEY_REVEAL).andThen((cards) => {
      const venus = cards.filter(isVenus);
      // Rule 2 — the reveal is public, named, and a fact.
      game.events?.recordCardReveal(player, this, {origin: 'deck', result: 'revealed', count: cards.length, found: venus.length > 0});
      game.log('${0} revealed ${1} and ${2}', (b) => {
        b.player(player)
          .card(cards[0], {tags: true})
          .card(cards[1], {tags: true});
      }, {reveal: {origin: 'deck', result: 'revealed', source: this.name}});

      const rest = oneWayDifference(cards, venus);
      if (rest.length === 0) {
        // Rule 4 — nothing to decide: the ordinary drawn batch, named by this card.
        keep(player, venus, [], LogType.DREW_VERBOSE);
        game.events?.recordCardsDrawn(player, venus.length, undefined, {revealed: true});
        player.enqueueCardDrawReveal(venus, {type: 'card', cardName: this.name});
        return;
      }
      // Rule 3 — ONE question carrying the whole reveal.
      game.defer(new ChooseCards(player, rest, {
        paying: true,
        logBoughtCards: true,
        promptSource: cardSource(this),
        companions: venus.length === 0 ? undefined : {
          cards: venus,
          check: {tag: Tag.VENUS, label: VENUS_ORBITAL_SURVEY_CHECK_LABEL},
          order: cards,
        },
      }));
    }));

    return undefined;
  }
}
