import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {Units} from '../../../common/Units';
import {IActionCard} from '../ICard';
import {PreludeCard} from '../prelude/PreludeCard';
import {IPlayer} from '../../IPlayer';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectAmount} from '../../inputs/SelectAmount';
import {SelectResource} from '../../inputs/SelectResource';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {cardEffect, cardSource, effectChoice} from '../../inputs/choiceContext';
import * as actionPreviews from '../actionPreviews';
import {ActionPreview, ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';

/**
 * P49 · THE FLOATING TRADE HUB — a prelude with NO play effect and an action with a VARIABLE X (PRELUDE2_ADAPTATION
 * §3.1 form 3, bespoke in Titan Shuttles' shape — the DSL has no variable X and is not taught one):
 *  (a) «add 2 floaters to ANY card» — a `SelectOption` whose follow-up is the shared `AddResourcesToCard` (`autoSelect:
 *      false`, its own `resourceGainPrompt` marker); ANY card means the hub itself too (P43's «never itself» is a rule
 *      of a spend FROM the card, and (a) spends nothing);
 *  (b) «remove any number of floaters here → that many of ONE standard resource» — a `SelectAmount` dial 1…N, and THEN
 *      the resource as its own prompt (`SelectResource.withGainAmount(X)`, addressed `{role: 'resource', source: hub}`)
 *      — a SEQUENCE of two addressable prompts, never an `AndOptions` the console cannot answer.
 * With no floater here the live `OrOptions` carries (a) alone (the server is authoritative); the preview still prints
 * BOTH rows, (b) refused with its reason.
 */
export class FloatingTradeHub extends PreludeCard implements IActionCard {
  constructor() {
    super({
      name: CardName.FLOATING_TRADE_HUB,
      tags: [Tag.SPACE],
      resourceType: CardResource.FLOATER,

      metadata: {
        cardNumber: 'P49',
        renderData: CardRenderer.builder((b) => {
          b.action('Add 2 floaters to ANY card.', (ab) => ab.empty().startAction.resource(CardResource.FLOATER, 2).asterix()).br;
          b.or().br;
          b.action('Remove any number of floaters here to gain that many of one standard resource.', (ab) => {
            ab.text('X').resource(CardResource.FLOATER).startAction.text('X').wild(1);
          }).br;
        }),
        // The printed rule runs past the action caption's budget; the short form names both rows.
        infoText: [
          {kind: 'action-short', text: 'Add 2 floaters to any card', tokens: ['res-floater']},
          {kind: 'action-short', text: 'Remove X floaters: gain X of one standard resource', tokens: ['res-floater', 'wild']},
        ],
      },
    });
  }

  /** The dial counts the FLOATERS REMOVED (its icon), each yielding one unit of the resource chosen next (`wild`). */
  private static readonly FLOATER_AMOUNT = {icon: 'floater', result: {icon: 'wild', perUnit: 1}} as const;

  /** The play has no effect — said, never a silent `dynamic` branch: the hub acts from this generation on. */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [], [actionPreviews.noteStep('generic', 'No immediate effect — the hub acts from this generation on')]);
  }

  public canAct(): boolean {
    // (a) always has a target — the hub itself holds floaters.
    return true;
  }

  /** The (b) row refused with no floater here — named, never hidden. */
  private static readonly NO_FLOATERS: UnplayableReason = {type: 'count', message: 'No floaters on this card'};

  /** The resource prompt (b) asks after the dial — ONE builder for the live prompt and the preview's step. */
  private gainPrompt(amount: number): SelectResource {
    return new SelectResource('Gain which resource?')
      .withGainAmount(amount)
      .markChoiceContext(cardEffect(this, undefined, 'reward'));
  }

  // Branch order MUST match action(): add-to-any-card first, remove-for-a-resource second.
  public actionPreview(player: IPlayer): ActionPreview {
    const max = this.resourceCount;
    const resourceStep: ActionPreviewStep = {kind: 'input', input: this.gainPrompt(Math.max(1, max)).toModel(), dialBound: true};
    return actionPreviews.orBranches(this, [
      {
        available: true,
        title: 'Add 2 floaters to any card',
        effects: [actionPreviews.cardResourceGain(CardResource.FLOATER, 2)],
        steps: [actionPreviews.addToCardStep(player, CardResource.FLOATER, {count: 2})],
      },
      {
        available: max > 0,
        title: 'Remove X floaters here to gain X of one standard resource',
        unavailableReason: FloatingTradeHub.NO_FLOATERS,
        // The OrOptions option IS the dial (nested into the branch pick); the resource is the prompt it raises —
        // `dialBound`: its gain is the dial's X, read by the composer from the dial (never a title).
        optionInput: actionPreviews.amountInput('Remove how many floaters?', 'Remove floaters', 1, Math.max(1, max),
          FloatingTradeHub.FLOATER_AMOUNT),
        steps: [resourceStep],
      },
    ]);
  }

  public action(player: IPlayer) {
    const addFloaters = new SelectOption('Add 2 floaters to any card', 'Add floaters').andThen(() => {
      // autoSelect:false — ALWAYS ask which card (the hub included), so the player sees where the floaters land.
      player.game.defer(new AddResourcesToCard(player, CardResource.FLOATER, {count: 2, autoSelect: false, cause: cardSource(this)}));
      return undefined;
    });
    if (this.resourceCount === 0) {
      // (a) alone — the preview's lone branch auto-resolves (index −1), so the live action asks the target directly.
      player.game.defer(new AddResourcesToCard(player, CardResource.FLOATER, {count: 2, autoSelect: false, cause: cardSource(this)}));
      return undefined;
    }
    const removeFloaters = new SelectAmount('Remove how many floaters?', 'Remove floaters', 1, this.resourceCount, true,
      FloatingTradeHub.FLOATER_AMOUNT,
    ).andThen((amount) => this.gainPrompt(amount).andThen((unit: keyof Units) => {
      player.removeResourceFrom(this, amount, {log: false});
      // stock.add (never a field write) so the gain is a recorded event beside the floater spend.
      player.stock.add(unit as Resource, amount, {log: false});
      player.game.log('${0} removes ${1} floaters from ${2} and gains ${3} ${4}', (b) =>
        b.player(player).number(amount).card(this).number(amount).resource(unit as Resource));
      return undefined;
    }));
    return new OrOptions(addFloaters, removeFloaters).markChoiceContext(effectChoice(this));
  }
}
