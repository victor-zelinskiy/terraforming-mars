import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview, ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import {HolderActionGood} from '../../../common/cards/holderRole';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {cardSource, effectChoice} from '../../inputs/choiceContext';
import {RemoveResourcesFromCard} from '../../deferredActions/RemoveResourcesFromCard';
import * as actionPreviews from '../actionPreviews';

/** Variant B's price — the floaters that leave ONE of the player's cards. */
export const FLOATERS_PER_REFINING = 2;
/** Variant B's title — the upstream key, word for word (the branch the upstream spec pins as `options[0]`). */
export const FLOATING_REFINERY_REMOVE_TITLE = 'Remove 2 floaters from ANY CARD to gain 1 titanium and 2 M€';
/** Variant A's title — the upstream key. */
export const FLOATING_REFINERY_ADD_TITLE = 'Add 1 floater to this card';
/** B's reason when no card of the player's holds 2 floaters (this one included). */
export const FLOATING_REFINERY_NO_SOURCE = 'No card of yours holds 2 floaters';

/**
 * P73 — FLOATING REFINERY («Облачная переработка»), a Prelude 2 project card:
 * blue, 7 M€, Venus tag, a FLOATER holder — the series' first Venus card with
 * an action CHOICE.
 *
 * «Action: Add 1 floater here, OR remove 2 floaters from ANY CARD to gain 1
 * titanium and 2 M€. Add 1 floater here for each Venus tag you have.» The
 * printed asterisk on «2 floaters*» is the footnote «from ANY card».
 *
 * RULE READINGS (pinned by tests/cards/prelude2/FloatingRefinery.spec.ts):
 *  1. The PLAY is declarative (`addResources: {tag: VENUS}`): +1 floater here
 *     per own Venus tag, THIS card's tag included (5 tags → 6) — the hand plate's
 *     count reads «Venus tags K + this card» for free.
 *  2. A — «+1 floater here»: always live.
 *  3. B — «2 floaters off ONE card of yours → +1 titanium and +2 M€»: «ANY CARD»
 *     is any card of the PLAYER's (`RemoveResourcesFromCard` `source: 'self'`,
 *     the corporation and this card included); the whole 2 come off one card
 *     (`requireFullCount` — a holder with 1 is shown DISABLED with its reason,
 *     never hidden); the source is ASKED even with one candidate (`autoselect:
 *     false` — invariant 3; the composer sows it and shows it, T14).
 *  4. No such card → B is not offered (the upstream behaviour: the action IS
 *     «+1 floater here», no question); the preview shows B UNAVAILABLE with its
 *     reason beside A, the sole live variant (invariant 2).
 *  5. The ORDER is the upstream's: the live `OrOptions` is [B, A] (the upstream
 *     spec pins `options[0]` → the source pick) — the preview's branches follow
 *     it, so a pre-collected answer replays byte for byte.
 *  6. THE HOLDER'S ROLE (К-R1 — a bespoke action declares its own): 2 floaters
 *     HERE buy the SET «+1 titanium AND +2 M€» (the printed order). The role of
 *     floaters on OTHER cards (they may be sold through this one) is not
 *     declared — a role belongs to the holder's own resource.
 *  7. The gain goes through `stock.add` (the recorder sees it); the spend writes
 *     the class's own «spent 2 floaters from X» line.
 */
export class FloatingRefinery extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.FLOATING_REFINERY,
      cost: 7,
      tags: [Tag.VENUS],
      resourceType: CardResource.FLOATER,

      behavior: {
        addResources: {tag: Tag.VENUS},
      },

      metadata: {
        cardNumber: 'P73',
        // B's full rule is 60 characters — over the browser's caption budget (52); the short keeps the price and the set.
        infoText: [{kind: 'action-short', text: 'Spend 2 floaters from a card: 1 titanium and 2 M€', tokens: ['res-floater', 'titanium', 'megacredits']}],
        renderData: CardRenderer.builder((b) => {
          b.action('Add 1 floater here.', (ab) => {
            ab.empty().startAction.resource(CardResource.FLOATER);
          }).br;
          b.or().br;
          b.action('Remove 2 floaters from ANY CARD to gain 1 titanium and 2 M€.', (eb) => {
            eb.resource(CardResource.FLOATER, 2).asterix().startAction.titanium(1).megacredits(2);
          }).br.resource(CardResource.FLOATER, 1).slash().tag(Tag.VENUS);
        }),
        description: 'Add 1 floater here for each Venus tag you have.',
      },
    });
  }

  /** Rule 6 — 2 floaters here buy the SET «+1 titanium AND +2 M€» (К-R1: a bespoke action declares its good once, here). */
  public readonly holderActionGood: HolderActionGood = {
    spend: FLOATERS_PER_REFINING,
    good: {kind: 'stock', resource: Resource.TITANIUM, amount: 1},
    with: [{kind: 'stock', resource: Resource.MEGACREDITS, amount: 2}],
  };

  /** THE source pick of B (rule 3) — the one construction the action and the preview both ask. */
  private sourceRemoval(player: IPlayer): RemoveResourcesFromCard {
    return new RemoveResourcesFromCard(player, CardResource.FLOATER, FLOATERS_PER_REFINING, {
      source: 'self',
      blockable: false,
      autoselect: false,
      requireFullCount: true,
      cause: cardSource(this),
    });
  }

  /** Why B is NOT live (rule 4) — undefined when a card of the player's holds 2 floaters. */
  private refiningReason(player: IPlayer): UnplayableReason | undefined {
    return this.sourceRemoval(player).previewTargetCards().length > 0 ?
      undefined :
      {type: 'count', message: FLOATING_REFINERY_NO_SOURCE};
  }

  public canAct() {
    return true;
  }

  public action(player: IPlayer) {
    const addFloater = new SelectOption(FLOATING_REFINERY_ADD_TITLE, 'Add floater').andThen(() => {
      player.addResourceTo(this, {log: true});
      return undefined;
    });

    const remove2floaters = new SelectOption(FLOATING_REFINERY_REMOVE_TITLE, 'Remove floaters').andThen(() => {
      const removal = this.sourceRemoval(player);
      removal.andThen(({card, proceed}) => {
        if (card === undefined || !proceed) {
          return;
        }
        player.stock.add(Resource.MEGACREDITS, 2, {log: true});
        player.stock.add(Resource.TITANIUM, 1, {log: true});
      });
      return removal.execute();
    });

    if (this.refiningReason(player) === undefined) {
      return new OrOptions(remove2floaters, addFloater).markChoiceContext(effectChoice(this));
    } else {
      player.addResourceTo(this, {log: true});
      return undefined;
    }
  }

  /**
   * Rule 5 — the preview mirrors the action in the live order [B, A]: B's
   * floaters off the chosen card (the source step — the SAME removal the action
   * asks, its candidates' points read over the set it offers), +1 titanium and
   * +2 M€; A's floater here. A refused B is SHOWN with its reason; a lone live A
   * auto-resolves (`OrOptions.reduce()`'s exemption — the server asks nothing).
   */
  public actionPreview(player: IPlayer): ActionPreview {
    const refiningWhy = this.refiningReason(player);
    const steps: Array<ActionPreviewStep> = [];
    if (refiningWhy === undefined) {
      const removal = this.sourceRemoval(player);
      const model = removal.previewSelectCard();
      if (model !== undefined) {
        steps.push({
          kind: 'input',
          input: model,
          amount: -FLOATERS_PER_REFINING,
          cardResource: actionPreviews.cardResourceIcon(CardResource.FLOATER),
          vpBox: actionPreviews.targetVictoryPoints(player, removal.previewTargetCards(), -FLOATERS_PER_REFINING),
        });
      }
    }
    return actionPreviews.orBranches(this, [
      {
        available: refiningWhy === undefined,
        title: FLOATING_REFINERY_REMOVE_TITLE,
        // The printed rows are [A, B], the live order [B, A] — each branch names its own printed row.
        renderKey: '1',
        effects: [
          actionPreviews.cardResourceCost(CardResource.FLOATER, FLOATERS_PER_REFINING),
          actionPreviews.stockGain(player, Resource.TITANIUM, 1),
          actionPreviews.stockGain(player, Resource.MEGACREDITS, 2),
        ],
        steps,
        unavailableReason: refiningWhy,
      },
      {
        available: true,
        title: FLOATING_REFINERY_ADD_TITLE,
        renderKey: '0',
        effects: [actionPreviews.cardGain(this, 1)],
      },
    ]);
  }
}
