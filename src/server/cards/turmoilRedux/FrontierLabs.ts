import {IProjectCard} from '../IProjectCard';
import {IActionCard, ICard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionEffect, ActionPreview} from '../../../common/models/ActionPreviewModel';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {recordSkippedEffect} from '../../deferredActions/skippedEffect';
import {TITLES} from '../../inputs/titles';
import {cardSource} from '../../inputs/choiceContext';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/** The action's printed price — «5 M€ →». */
export const FRONTIER_LABS_PRICE = 5;
/** The action's printed addition — one resource of the chosen card's own kind. */
export const FRONTIER_LABS_ADDED = 1;
/** The conditional draw — «also draw a card» when the resource is not science. */
export const FRONTIER_LABS_DRAWN = 1;
/** The action's first blocker: no card of the player's holds a resource yet (rule 3). */
export const FRONTIER_LABS_NO_HOLDER_REASON = 'No card of yours holds a resource yet';
/** The per-candidate note of a SCIENCE holder: the addition comes alone, and the row says so (rule 6). */
export const FRONTIER_LABS_NO_DRAW_NOTE = 'No draw: science';

/**
 * TR53 — FRONTIER LABS («Лаборатории фронтира»), a Turmoil Redux PROJECT card:
 * an action that PAYS to grow a card that ALREADY holds a resource, and draws
 * a card unless the resource is science — the first «what else» that depends
 * on WHICH candidate the player picks (`AddResourcesToCard.extraByCard`).
 *
 * SCAN READING — cost 8, blue (ACTIVE). TWO tags in the corner, in printed
 * order: the atom (Science) and the brown disc (Building). The orange MIN plate
 * beside the cost holds the SCIENTISTS' emblem (the flask): the REQUIREMENT
 * (`{party: SCIENTISTS}`), never a tag. The upper field holds ONE row — the
 * ACTION «[5 M€] → [a card with resources] : + [?] [a card]*»: the price, the
 * arrow, the white card with three orange cubes (`resourceCard()` — «a card
 * that holds resources», not a tag, not a cube), the colon, «+ [?]» (one
 * resource of THAT card's kind — the question mark is the kind the player's
 * choice decides) and the card back with the asterisk (the draw the rule makes
 * conditional). The lower field is the requirement in words. No VP badge.
 * Only the module's symbol at the bottom left (the purple diamond with the
 * arrow): no `compatibility`. Printed lore (italic, under the rule): «It's
 * often hard to tell if they're doing it purely to impress investors or not?»
 * (`lore_texts.json` «TR53»). Art credit: Khang Le — Hawken.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/FrontierLabs.spec.ts):
 *  1. The REQUIREMENT is the Scientists' plate (the TR15 class): the Scientists
 *     rule or 2 of the player's OWN delegates stand on their resolution — at
 *     the play only; TR36 lowers an EFFECT's threshold, never a requirement's.
 *  2. ON PLAY nothing happens (no `behavior`); the tags wake the table — the
 *     Science reactors (Olympus Conference, Mars University, …) and the
 *     Building discounts — all of it the engine's.
 *  3. THE ACTION, once per generation: the price is 5 M€, PAID FIRST (an
 *     M€-only bill is settled without a question — heat for Helion is the
 *     engine's lane). Unavailable, ONE reason in order: no card of the player
 *     holds a resource yet → less than 5 M€.
 *  4. THE TARGET: a card of the PLAYER'S OWN tableau (never a rival's; the
 *     class's own candidate rule) that ALREADY holds ≥ 1 resource of ANY kind; one resource of
 *     THAT card's own kind lands on it (`holderResourceOf`). One candidate is
 *     still a step (invariant 3). A holder with 0 is SHOWN, disabled, «No
 *     resource on this card yet» (`AddResourcesToCard.nearMisses`). This card
 *     holds nothing (no `resourceType`) and is never a candidate.
 *  5. THE DRAW: when the chosen card's resource is NOT science, the player draws
 *     1 card (their ordinary draw, the reveal sourced to this card); science —
 *     no draw. WARE is not science. An empty deck skips the draw BY NAME
 *     (`effect-skipped`); the addition stands.
 *  6. EVERY CANDIDATE SAYS WHAT IT GIVES before the press: «+1 [its kind] ·
 *     +1 card» or «+1 [science] · no draw» — the server's own chips on the
 *     marker (`extraByCard`), never a client test of the kind.
 *  7. PREVIEW = EXECUTION: the price chip, the target step (the candidate
 *     addressed, law 27), and nothing asked twice; the draw is no prompt.
 *  8. THE TABLE'S ANSWERS to the addition (`onResourceAdded` — Martian Fiber's
 *     +1 M€ per data) are the engine's; nobody answers the draw.
 *  9. THE JOURNAL: «spent 5 M€», «added 1 X to Y», «drew 1 card»; a rival's
 *     notification names the receiving card and the draw.
 * 10. VP: none on this card; the addition may move the TARGET's points (the
 *     candidate's `vpBox`).
 * 11. MarsBot never plays the card; its cards are never targets.
 * 12. Save / load: an ordinary card (`actionsThisGeneration` is the engine's).
 * 13. The per-candidate tail is a SHARED marker member
 *     (`ResourceGainPromptMeta.extraByCard`), built here and read by every host.
 */
export class FrontierLabs extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.FRONTIER_LABS,
      type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.BUILDING],
      cost: 8,
      requirements: {party: PartyName.SCIENTISTS},

      metadata: {
        cardNumber: 'TR53',
        // The printed action runs past the browser's caption budget of 52 in both languages.
        infoText: [{kind: 'action-short', text: '5 M€ → +1 to a card with one; draw unless science'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 5 M€ to add a resource to a card that already has a resource. If it is not a science resource, also draw a card.', (eb) => {
            eb.megacredits(FRONTIER_LABS_PRICE).startAction.resourceCard().colon().plus()
              .resource(CardResource.RESOURCE_CUBE, {questionMark: true}).nbsp.cards(FRONTIER_LABS_DRAWN).asterix();
          });
        }),
        description: 'Requires the Scientists to be ruling or that you have 2 delegates there.',
      },
    });
  }

  /** Rule 5 — does landing on `card` draw? Its resource is not science (WARE included). */
  public static drawsFor(card: ICard): boolean {
    return card.resourceType !== undefined && card.resourceType !== CardResource.SCIENCE;
  }

  /**
   * Rule 6 / 13 — WHAT ELSE choosing `card` gives, as the server's chips: the
   * draw for a non-science holder, a named «no draw» for a science one.
   */
  public static extraFor(card: ICard): ReadonlyArray<ActionEffect> {
    return FrontierLabs.drawsFor(card) ?
      [actionPreviews.drawGain(FRONTIER_LABS_DRAWN)] :
      [{direction: 'gain', icon: 'cards', amount: 0, note: FRONTIER_LABS_NO_DRAW_NOTE}];
  }

  /** Rules 4, 6 — THE ONE construction of the target: the action defers it, the preview and the reason ask it. */
  public target(player: IPlayer): AddResourcesToCard {
    return new AddResourcesToCard(player, undefined, {
      count: FRONTIER_LABS_ADDED,
      min: 1,
      autoSelect: false,
      cause: cardSource(this),
      extraByCard: (card) => FrontierLabs.extraFor(card),
    });
  }

  /** Rule 3 — ONE reason, in order: a card to grow, then the price. */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.target(player).getCards().length === 0) {
      return actionReason.targetReason(FRONTIER_LABS_NO_HOLDER_REASON);
    }
    if (!player.canAfford(FRONTIER_LABS_PRICE)) {
      return actionReason.needMoreMC(player, FRONTIER_LABS_PRICE);
    }
    return undefined;
  }

  public canAct(player: IPlayer): boolean {
    return this.actionUnavailableReason(player) === undefined;
  }

  /** Rules 3–5 — pay, then the target, then the draw the target decides. */
  public action(player: IPlayer): undefined {
    player.game.defer(new SelectPaymentDeferred(player, FRONTIER_LABS_PRICE, {
      title: TITLES.payForCardAction(this.name),
      cause: cardSource(this),
    })).andThen(() => {
      player.game.defer(this.target(player)).andThen((card) => {
        if (!FrontierLabs.drawsFor(card)) {
          return;
        }
        if (!player.game.projectDeck.canDraw(FRONTIER_LABS_DRAWN)) {
          recordSkippedEffect(player, actionPreviews.SKIP_REASON.deckEmpty, {
            label: actionPreviews.SKIPPED_LABEL.drawCards,
            effect: actionPreviews.drawGain(FRONTIER_LABS_DRAWN),
          });
          return;
        }
        player.drawCard(FRONTIER_LABS_DRAWN, {source: {type: 'card', cardName: this.name}});
      });
    });
    return undefined;
  }

  /**
   * Rule 7 — ONE branch: the price off the rail, «+1 resource to a card», and the
   * target step whose candidates carry their own tail (+1 card / no draw).
   */
  public actionPreview(player: IPlayer): ActionPreview {
    // The 5 M€ is a CHOICE the moment anything but M€ can pay it (Helion's heat, Stormcraft's floaters as heat): the
    // live `SelectPaymentDeferred` asks FIRST, so it is pre-collected in the live order — never asked after the press
    // (TR58's Stormcraft profile of `actionPromptCoverage` found it). The widget states the price; no flat chip beside.
    const pay = actionPreviews.paymentStep(player, FRONTIER_LABS_PRICE, {
      title: TITLES.payForCardAction(this.name),
      cause: cardSource(this),
    });
    const step = actionPreviews.addToCardStep(player, undefined, {
      count: FRONTIER_LABS_ADDED,
      min: 1,
      cause: cardSource(this),
      extraByCard: (card) => FrontierLabs.extraFor(card),
    });
    return actionPreviews.singleBranch(this, player, [...(pay !== undefined ? [pay] : []), ...(step !== undefined ? [step] : [])], [
      ...(pay === undefined ? [actionPreviews.stockCost(player, Resource.MEGACREDITS, FRONTIER_LABS_PRICE)] : []),
      // «+1 to a card» in the declarative vocabulary of an addition of ANY kind (the kind is the chosen card's own).
      {direction: 'gain', icon: 'resources', amount: FRONTIER_LABS_ADDED, note: 'to a card'},
    ]);
  }
}
