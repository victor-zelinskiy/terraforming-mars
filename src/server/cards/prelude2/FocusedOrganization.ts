import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PreludeCard} from '../prelude/PreludeCard';
import {IPlayer} from '../../IPlayer';
import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {Units} from '../../../common/Units';
import {Resource} from '../../../common/Resource';
import {sum} from '../../../common/utils/utils';
import {SelectCard} from '../../inputs/SelectCard';
import {cardDiscard} from '../../inputs/discardPrompt';
import {SelectResource} from '../../inputs/SelectResource';
import {cardEffect, cardSource} from '../../inputs/choiceContext';
import {PathfindersExpansion} from '../../pathfinders/PathfindersExpansion';
import {ActionPreview, ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import * as actionReason from '../actionReasons';

/** WHY the action is blocked — one blocker each, the hand first (the patent sale's own words, `ru/ui.json`). */
export const FOCUSED_ORGANIZATION_NO_CARDS_REASON = 'No cards in hand';
export const FOCUSED_ORGANIZATION_NO_RESOURCES_REASON = 'No standard resources to spend';

/**
 * P50 — FOCUSED ORGANIZATION («Точная организация»), a Prelude 2 prelude with no tag (PRELUDE2_ADAPTATION §3.1, forms
 * 1 + 3): the PLAY is declarative («draw 1 card and gain 1 standard resource» — `drawCard` + `standardResource`, whose
 * one builder already addresses its «?» as a `reward` of this card); the ACTION is bespoke.
 *
 * SCAN READING — the PRELUDE frame, no tag circle; the ACTION block «[card][?] → [card][?]» with «(Action: Discard 1
 * card and spend 1 standard resource to draw 1 card and gain 1 standard resource.)»; below «[card] [?]» with «(Draw 1
 * card and gain 1 standard resource.)»; «P50»; the Prelude 2 badge. Lore: «Cutting off weak investments to find new
 * ones».
 *
 * RULE READINGS (pinned by tests/cards/prelude2/FocusedOrganization.spec.ts):
 *  1. The action is available while the hand holds a card AND the supply holds a standard resource; the blocker is
 *     named, ONE at a time — the hand first.
 *  2. The action is a SEQUENCE of three addressable prompts (the law of P49 — never an `AndOptions`, which the console
 *     has no surface for): SPEND which resource (`spendAmount 1` → role `spend`; only a resource the player holds is
 *     offered) → DISCARD which card (the `discardPrompt` marker → role `discard`) → the card drawn → GAIN which
 *     resource (`withGainAmount 1`, mode `reward` → role `resource`). The two «?» can never trade answers in a batch:
 *     their ROLES differ, so a pre-collected spend lands on the spend prompt and the gain on the gain prompt.
 *  3. Spending M€ / steel / titanium feeds a Sol Bank (Pathfinders — outside the scope, kept).
 *  4. ONE typed log line names the whole action; the discard and the draw are their own recorded events.
 *  5. PREVIEW = EXECUTION: four steps in the executed order — the spend, the discard, the gain (the draw is the
 *     branch's chip). Read-only.
 */
export class FocusedOrganization extends PreludeCard implements IActionCard {
  constructor() {
    super({
      name: CardName.FOCUSED_ORGANIZATION,

      behavior: {
        drawCard: 1,
        standardResource: 1,
      },

      metadata: {
        cardNumber: 'P50',
        renderData: CardRenderer.builder((b) => {
          b.action('Discard 1 card and spend 1 standard resource to draw 1 card and gain 1 standard resource.', (ab) => {
            ab.cards(1).wild(1).startAction.cards(1).wild(1);
          }).br;
          b.cards(1).wild(1).br;
        }),
        description: 'Draw 1 card and gain 1 standard resource.',
        // The printed rule runs past the action caption's budget (tests/cards/actionCaption.spec.ts).
        infoText: [
          {kind: 'action-short', text: 'Discard a card and 1 resource: draw and gain 1', tokens: ['cards', 'wild']},
        ],
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return player.cardsInHand.length > 0 && sum(Units.values(player.stock)) > 0;
  }

  /** Rule 1 — one blocker, the hand first. */
  public actionUnavailableReason(player: IPlayer) {
    if (player.cardsInHand.length === 0) {
      return actionReason.ruleReason(FOCUSED_ORGANIZATION_NO_CARDS_REASON);
    }
    if (sum(Units.values(player.stock)) === 0) {
      return actionReason.ruleReason(FOCUSED_ORGANIZATION_NO_RESOURCES_REASON);
    }
    return undefined;
  }

  /** The SPEND «?» — ONE builder for the live prompt and the preview's step. Only a resource the player holds. */
  private spendPrompt(player: IPlayer): SelectResource {
    return new SelectResource('Spend which resource?', Units.keys.filter((type) => player.stock[type] > 0))
      .withSpendAmount(1)
      .markChoiceContext(cardEffect(this, undefined, 'effect-choice'));
  }

  /** The DISCARD — ONE builder for the live prompt and the preview's step. */
  private discardPrompt(player: IPlayer): SelectCard<IProjectCard> {
    return new SelectCard('Discard which card?', 'Discard', player.cardsInHand)
      .markDiscardPrompt(cardDiscard(this, {min: 1, max: 1}));
  }

  /** The GAIN «?» — ONE builder for the live prompt and the preview's step (P49's shape). */
  private gainPrompt(): SelectResource {
    return new SelectResource('Gain which resource?')
      .withGainAmount(1)
      .markChoiceContext(cardEffect(this, undefined, 'reward'));
  }

  public action(player: IPlayer) {
    return this.spendPrompt(player).andThen((spent) => {
      player.stock.deduct(spent as Resource, 1, {log: false});
      if (spent === 'megacredits' || spent === 'steel' || spent === 'titanium') {
        PathfindersExpansion.addToSolBank(player);
      }
      return this.discardPrompt(player).andThen(([card]) => {
        player.discardCardFromHand(card);
        player.drawCard();
        return this.gainPrompt().andThen((gained) => {
          // stock.add (never a field write) so the gain is a recorded event beside the spend.
          player.stock.add(gained as Resource, 1, {log: false});
          player.game.log('${0} spends 1 ${1}, discards ${2}, draws a card and gains 1 ${3}', (b) =>
            b.player(player).resource(spent as Resource).card(card).resource(gained as Resource));
          return undefined;
        });
      });
    });
  }

  /** Rule 5 — the three decisions in the executed order; the draw is the branch's chip. */
  public actionPreview(player: IPlayer): ActionPreview {
    const steps: Array<ActionPreviewStep> = [
      {kind: 'input', input: this.spendPrompt(player).toModel()},
      actionPreviews.selectCardStep(player, 'Discard which card?', 'Discard', player.cardsInHand, {
        min: 1,
        max: 1,
        // The live prompt is a DISCARD of this card's: the answer is addressed to exactly that…
        for: {role: 'discard', source: cardSource(this)},
        // …and carries the live prompt's own marker, from the ONE builder above.
        discard: cardDiscard(this, {min: 1, max: 1}),
      }),
      {kind: 'input', input: this.gainPrompt().toModel()},
    ];
    return actionPreviews.singleBranch(this, player, steps, [
      {direction: 'cost', icon: 'wild', amount: 1, note: 'of your choice'},
      actionPreviews.drawGain(1),
      {direction: 'gain', icon: 'wild', amount: 1, note: 'of your choice'},
    ]);
  }
}
