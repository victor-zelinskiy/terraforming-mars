import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview, ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {PlayerInput} from '../../PlayerInput';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {cardSource, effectChoice} from '../../inputs/choiceContext';
import {RemoveResourcesFromCard} from '../../deferredActions/RemoveResourcesFromCard';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/** The play's fighters — «Add 2 fighter resources to this card». */
const ADDED_ON_PLAY = 2;
/** The action's price: ONE fighter, from any card of the player's own. */
const FIGHTERS_SPENT = 1;
/** Variant A — «gain 2 titanium». */
const TITANIUM_GAINED = 2;
/** Variant B — «add 1 mech resource to ANY card». */
const MECHS_ADDED = 1;

/** The source picker's own title — the class default speaks of «resources» in general. */
export const SPACESHIP_RECYCLING_SOURCE_TITLE = 'Select card to spend 1 fighter from';
/** Variant B's refusal: nothing of the player's can take the mech (the card never offers a fighter for nothing). */
export const SPACESHIP_RECYCLING_NO_MECH_HOLDER = 'No card of yours can hold mechs';

/**
 * TR29 — SPACESHIP RECYCLING («Утилизация космолётов»), a blue card of Turmoil
 * Redux whose action SPENDS a fighter taken from ANY of the player's own cards
 * and pays one of two results. The set's first action with a price on a card
 * the player CHOOSES, and the first with one price and two outcomes.
 *
 * SCAN READING — cost 7; the corner holds TWO tags, Space (the yellow star on
 * black) and Building (the brown disc with the building). The orange MIN box
 * beside the cost holds Unity's emblem: the REQUIREMENT `{party: UNITY}`, never a
 * tag. The upper block is ONE action row — «[fighter]* → [titanium][titanium] OR
 * [mech]*» — with «(Action: Spend 1 fighter from ANY of your cards to gain 2
 * titanium OR to add 1 mech resource to ANY card.)»; the lower block draws two
 * fighters with «(Requires Unity to be ruling or that you have 2 delegates there.
 * Add 2 fighter resources to this card.)». No VP badge. Only the module's icon at
 * the bottom left (no ▲, no Venus icon): no `compatibility`. The quote is printed:
 * «Smartphone manufacturers gladly advertise that their models are 70%
 * spacecan.» The rulebook never names the card (`pdftotext`, grep recycl /
 * spaceship / titanium).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/SpaceshipRecycling.spec.ts):
 *  1. The requirement is a condition of the PLAY (Unity rules, or two of the
 *     player's delegates stand on its resolution); the action works whoever rules.
 *  2. The play puts 2 fighters on this card — declaratively (`addResources`).
 *  3. The action is available ⇔ a fighter stands on ANY card of the player's own
 *     (`RemoveResourcesFromCard.hasTarget(…, 'self')`); another seat's holders
 *     never count. Without one the reason is named: «No fighters on your cards».
 *  4. The price is exactly 1 fighter from the card the player CHOOSES — asked
 *     ALWAYS, even with one candidate (this card itself); a holder at 0 is a
 *     disabled twin with its reason. A spend from Formula Zero costs its VP —
 *     the step says so.
 *  5. Variant A — +2 titanium through `stock.add` (events, journal, statistics).
 *  6. Variant B — +1 mech on ANY mech holder of the player's own, the target
 *     asked ALWAYS (`autoSelect: false`). With no holder the variant is
 *     DISABLED with its reason and never offered — a fighter is never spent for
 *     nothing; A is then the whole action (no `OrOptions`).
 *  7. This card is a legal SOURCE, never a TARGET (it holds fighters, not mechs).
 *  8. The order of events is the order of the icons: the fighter leaves its card,
 *     then the titanium / the mech arrives — one record each, none twice.
 *  9. A mech put here by this card is an ordinary mech of its holder (Automated
 *     Convoys trades with it, Mech Sports scores it, EVA / Construction Mechs pay
 *     with it).
 * 10. The Redux Vesta may put fighters here and mechs on the holders; both count.
 * 11. Nothing at the table answers (no TR, no production, no scale): the forecast
 *     is empty.
 * 12. Save / load keeps the count; the action after a load reads it.
 * 13. MarsBot never plays the card; solo changes nothing (a spend from your own
 *     card never consults the solo neutral rule).
 * 14. The journal: the class's spend line «${0} spent ${1} ${2} from ${3}» (the
 *     source card named — never «removed 1 resource(s) from X's Y»), then the
 *     result's own line (the titanium gain / «added 1 mech to …»).
 *
 * ONE READING. The source picker and the mech target are each ONE construction
 * (`fighterSource` / `mechTarget`) asked by the preview and by the action, so the
 * candidates, the disabled twins and the VP readings the composer shows are the
 * ones the live prompts present. The PRINTED ORDER is the asked order: the source
 * is a card-level step (`preSteps`) before the variant, the target follows variant
 * B — and the server asks source → OrOptions → target.
 */
export class SpaceshipRecycling extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.SPACESHIP_RECYCLING,
      type: CardType.ACTIVE,
      tags: [Tag.SPACE, Tag.BUILDING],
      cost: 7,
      resourceType: CardResource.FIGHTER,
      requirements: {party: PartyName.UNITY},

      // Rule 2 — the play's whole effect.
      behavior: {
        addResources: ADDED_ON_PLAY,
      },

      metadata: {
        cardNumber: 'TR29',
        infoText: [
          // The printed rule runs past the caption clamp in both languages.
          {kind: 'action-short', text: 'Spend a fighter: 2 titanium or a mech', tokens: ['res-fighter']},
        ],
        renderData: CardRenderer.builder((b) => {
          // ONE printed row for both variants — the two titanium and the mech are the commit's anchors.
          b.action('Spend 1 fighter from ANY of your cards to gain 2 titanium OR to add 1 mech resource to ANY card.', (eb) => {
            eb.resource(CardResource.FIGHTER).asterix().startAction.titanium(TITANIUM_GAINED).or().resource(CardResource.MECH).asterix();
          }).br;
          b.resource(CardResource.FIGHTER, ADDED_ON_PLAY);
        }),
        description: 'Requires Unity to be ruling or that you have 2 delegates there. Add 2 fighter resources to this card.',
      },
    });
  }

  /** THE source step (rules 3, 4) — the one construction the preview and the action both ask. */
  private fighterSource(player: IPlayer): RemoveResourcesFromCard {
    return new RemoveResourcesFromCard(player, CardResource.FIGHTER, FIGHTERS_SPENT, {
      source: 'self',
      blockable: false,
      autoselect: false,
      cause: cardSource(this),
      title: SPACESHIP_RECYCLING_SOURCE_TITLE,
    });
  }

  /** THE mech target (rule 6) — the one construction the preview and the action both ask. */
  private mechTarget(player: IPlayer): AddResourcesToCard {
    return new AddResourcesToCard(player, CardResource.MECH, {count: MECHS_ADDED, autoSelect: false, cause: cardSource(this)});
  }

  private canAddMech(player: IPlayer): boolean {
    return this.mechTarget(player).getCards().length > 0;
  }

  public canAct(player: IPlayer): boolean {
    return RemoveResourcesFromCard.hasTarget(player, CardResource.FIGHTER, 'self');
  }

  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    return this.canAct(player) ? undefined : reason.notEnoughFighters();
  }

  /**
   * The composer's reading in the PRINTED order: the source (a card-level step, before the variant), the two
   * variants — A, then B — and B's target. The fighter's cost chip stands on each variant's price side; WHICH card
   * pays it is the source step's own reading (current → resulting, the source's VP).
   */
  public actionPreview(player: IPlayer): ActionPreview {
    const live = this.canAct(player);
    const removal = this.fighterSource(player);
    const model = removal.previewSelectCard();
    // The removeAddCardResource step (Ants / Predators), card-level: the signed −1 (each candidate's `current → resulting`),
    // the resource it moves, and each candidate's VP over EXACTLY the set the picker presents.
    const source: ActionPreviewStep | undefined = model === undefined ? undefined : {
      kind: 'input',
      input: model,
      amount: -FIGHTERS_SPENT,
      cardResource: actionPreviews.cardResourceIcon(CardResource.FIGHTER),
      vpBox: actionPreviews.targetVictoryPoints(player, removal.previewTargetCards(), -FIGHTERS_SPENT),
    };
    const mechs = this.canAddMech(player);
    const preview = actionPreviews.orBranches(this, [
      {
        available: live,
        title: 'Gain 2 titanium',
        effects: [
          actionPreviews.cardResourceCost(CardResource.FIGHTER, FIGHTERS_SPENT),
          actionPreviews.stockGain(player, Resource.TITANIUM, TITANIUM_GAINED),
        ],
        unavailableReason: reason.notEnoughFighters(),
      },
      {
        available: live && mechs,
        title: 'Add 1 mech to any card',
        effects: [
          actionPreviews.cardResourceCost(CardResource.FIGHTER, FIGHTERS_SPENT),
          actionPreviews.cardResourceGain(CardResource.MECH, MECHS_ADDED),
        ],
        steps: [actionPreviews.addToCardStep(player, CardResource.MECH, {count: MECHS_ADDED, cause: cardSource(this)})],
        // ONE blocker, in order: the fighter (the whole action's), then the holder (this variant's).
        unavailableReason: live ? reason.targetReason(SPACESHIP_RECYCLING_NO_MECH_HOLDER) : reason.notEnoughFighters(),
      },
    ]);
    return {
      ...preview,
      preSteps: source === undefined ? [] : [source],
    };
  }

  /** Rule 8 — source, then the variant, then its target: the printed order is the asked order. */
  public action(player: IPlayer): PlayerInput | undefined {
    const removal = this.fighterSource(player);
    removal.andThen(() => {
      this.payResult(player);
    });
    player.game.defer(removal);
    return undefined;
  }

  /** The fighter has left its card: one variant pays (rule 6 — no holder, no question). */
  private payResult(player: IPlayer): void {
    const gainTitanium = new SelectOption('Gain 2 titanium').andThen(() => {
      player.stock.add(Resource.TITANIUM, TITANIUM_GAINED, {log: true, from: {card: this.name}});
      return undefined;
    });
    if (!this.canAddMech(player)) {
      gainTitanium.cb(undefined);
      return;
    }
    const addMech = new SelectOption('Add 1 mech to any card').andThen(() => {
      player.game.defer(this.mechTarget(player));
      return undefined;
    });
    player.defer(new OrOptions(gainTitanium, addMech).markChoiceContext(effectChoice(this)));
  }
}
