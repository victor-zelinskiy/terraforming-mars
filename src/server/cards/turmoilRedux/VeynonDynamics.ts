import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Size} from '../../../common/cards/render/Size';
import {DeclaredHolderRole} from '../../../common/cards/holderRole';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {Behavior} from '../../behavior/Behavior';
import {getBehaviorExecutor} from '../../behavior/BehaviorExecutor';
import {CardResourceTrader, CardTradeDoorSpec, cardTradeDoorOption, cardTradeDoorReason} from '../../colonies/cardTradeDoor';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {effectChoice} from '../../inputs/choiceContext';
import {effectsForBehavior, stepsForBehavior} from '../../models/actionPreview';
import {IActionCard} from '../ICard';
import {CorporationCard} from '../corporation/CorporationCard';
import {CardRenderer} from '../render/CardRenderer';
import * as actionPreviews from '../actionPreviews';
import * as reason from '../actionReasons';

/** Variant A's title — the option, the branch and its printed row. */
export const VEYNON_MECH_TITLE = 'Add 1 mech resource to ANY card';
/** Variant B's title — TR66's option key, word for word (the same door). */
export const VEYNON_TRADE_TITLE = 'Spend 1 mech from this card to trade for free';
/** The printed effect — a new key (Trade Envoys prints «When you trade, …»; this one names the colony track). */
export const VEYNON_EFFECT_TEXT = 'When you trade with a colony track, you may first increase it 1 step.';

/** Variant A's whole result, as a behavior VALUE — the Executor runs it as a library (`CorporationCard.initialAction`'s form), the preview walkers read it. */
export const VEYNON_MECH_TO_ANY_CARD: Behavior = {addResourcesToAnyCard: {type: CardResource.MECH, count: 1}};

/** Variant B — the shared card door (`colonies/cardTradeDoor.ts`): TFLP's floater, TR66's mech, and this mech. */
export const VEYNON_DYNAMICS_TRADE_DOOR: CardTradeDoorSpec = {
  card: CardName.VEYNON_DYNAMICS,
  icon: 'mech',
  price: 1,
  optionText: 'Pay 1 mech (use ${0} action)',
  logText: '${0} spent 1 mech to trade with ${1}',
  noResourceReason: 'No mechs on this card',
  spend: 'recorded',
};

/**
 * TR85 — VEYNON DYNAMICS («Veynon Dynamics»), the EIGHTH and last of the eight NEW corporations of Turmoil Redux (not
 * a replacement — `common/cards/turmoilReduxCorporations.ts`, numbered TR85 by the order of the scan folder). Its own
 * art and its own printed lore, both keyed TR85; no `reimplements`.
 *
 * SCAN READING — the Jovian (banded sphere) and Venus («V» on blue) tags in the corner; «36» + a production plate with
 * a gold star (titanium) + a blue mech square — «You start with 36 M€, 1 titanium production, and a mech resource on
 * this card». The EFFECT box: «[colony tile] : +1» — «When you trade with a colony track, you may first increase it 1
 * step». The ACTION box, one row: «→ [mech]* OR [mech] → [colony tile]» — «Add 1 mech resource to ANY card, OR spend
 * 1 mech from here to trade for free». Printed lore: «Veynons "vessels" come with articulating limbs…». No VP, no
 * first action. The ▲ beside the art is the Colonies mark (`compatibility: 'colonies'` — TR66's precedent); the purple
 * diamond is the module itself.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/VeynonDynamics.spec.ts):
 *  1. THE EFFECT is Trade Envoys' declaration (`colonies: {tradeOffset: 1}`): the Executor adds the step to
 *     `player.colonies.tradeOffset` at the play (and takes it back if the card leaves), and every trade with a COLONY
 *     reads it through the one plan (`Colony.tradeTrackPlan` — the «increase the track before trading» question, its
 *     «don't» option, a colony's refusals at the low positions as disabled steps; one SERVER sum with the Unity path's
 *     `bonusTradeOffset`). A fleet dock has no track — the step does not apply there by construction; a selfish trade
 *     (Coordinated Raid) reads no offset.
 *  2. THE ACTION — exactly one of two variants per activation, in the printed order:
 *     A. «Add 1 mech resource to ANY card» — free; {@link VEYNON_MECH_TO_ANY_CARD} executed as a value: the pick is
 *        ALWAYS asked (`AddResourcesToCard`, `autoSelect: false`), this card itself among the candidates — so A is
 *        always live (the card holds mechs) and a sole candidate is SHOWN, never applied silently.
 *     B. «Spend 1 mech from here to trade for free» — the trade's SECOND DOOR through the shared card door
 *        ({@link TradeWithVeynonDynamics} in `Colonies.tradeHandlers`): NOT a trade of its own; FREE, never fleetless.
 *        Live ⇔ a mech here AND `tradeBlockedReason()` clear — ONE blocker, the card's own premise first.
 *  3. One live variant is the whole action (A alone: straight to the pick); two → `OrOptions` marked `effect-choice`.
 *  4. The mechs here buy a TRADE (`resourceRole`) — never money (the `mechs` payment unit reads EVA Mechs only), never
 *     VP.
 *  5. MarsBot never holds the card (no twin).
 */
export class VeynonDynamics extends CorporationCard implements IActionCard {
  /** The mechs here buy a free TRADE (`common/cards/holderRole.ts` — the satellite's split, the target step's value line). */
  public readonly resourceRole: DeclaredHolderRole = {kind: 'trade', price: VEYNON_DYNAMICS_TRADE_DOOR.price};

  constructor() {
    super({
      name: CardName.VEYNON_DYNAMICS,
      tags: [Tag.JOVIAN, Tag.VENUS],
      startingMegaCredits: 36,
      resourceType: CardResource.MECH,

      behavior: {
        production: {titanium: 1},
        addResources: 1,
        colonies: {tradeOffset: 1},
      },

      metadata: {
        cardNumber: 'TR85',
        description: 'You start with 36 M€, 1 titanium production, and a mech resource on this card.',
        // Three printed frames — the effect and the action's two rows: each caption names ITS frame (`tokens`), never
        // the printed order alone (two action rows under one set of icons — TR84's gotcha).
        infoText: [
          {kind: 'effect-short', text: 'You may raise the colony track before trading'},
          {kind: 'action-short', text: 'A mech to any card'},
          {kind: 'action-short', text: 'Spend 1 mech for a free trade'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br;
          // The scan's «36», the titanium production plate, the mech square.
          b.megacredits(36).nbsp.production((pb) => pb.titanium(1)).nbsp.resource(CardResource.MECH);
          b.corpBox('effect-action', (ce) => {
            ce.effect(VEYNON_EFFECT_TEXT, (eb) => {
              eb.colonies(1).startEffect.text('+1', Size.LARGE);
            });
            ce.vSpace();
            // Each row describes ITSELF (the scan's one sentence covers both): one information group per console
            // variant, so a caption never names the wrong branch (the TFLP / Titan contract).
            ce.action(VEYNON_MECH_TITLE + '.', (eb) => {
              eb.empty().startAction.resource(CardResource.MECH).asterix().or();
            });
            ce.vSpace();
            ce.action('Spend 1 mech from here to trade for free.', (eb) => {
              eb.resource(CardResource.MECH).startAction.colonies(1);
            });
          });
        }),
      },
    });
  }

  /** A's candidates — every mech holder of the player's, this card among them (the live pick's own set). */
  private mechHolders(player: IPlayer) {
    return new AddResourcesToCard(player, CardResource.MECH, {autoSelect: false}).getCards();
  }

  private tradeVariantReason(player: IPlayer): string | undefined {
    return cardTradeDoorReason(player, this, VEYNON_DYNAMICS_TRADE_DOOR);
  }

  public canAct(player: IPlayer): boolean {
    return this.mechHolders(player).length > 0 || this.tradeVariantReason(player) === undefined;
  }

  /** Unreachable while the card is on the table (it holds mechs itself) — stated so the type is total. */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.canAct(player)) {
      return undefined;
    }
    return reason.ruleReason(this.tradeVariantReason(player) ?? 'No colony available to trade with');
  }

  /** Two declared branches, in the SAME order `action()` pushes its options. */
  public actionPreview(player: IPlayer): ActionPreview {
    const tradeReason = this.tradeVariantReason(player);
    return actionPreviews.orBranches(this, [
      {
        available: this.mechHolders(player).length > 0,
        title: VEYNON_MECH_TITLE,
        effects: effectsForBehavior(player, this, VEYNON_MECH_TO_ANY_CARD),
        steps: stepsForBehavior(player, this, VEYNON_MECH_TO_ANY_CARD),
        // Unreachable while the card is on the table — it holds mechs itself (a preview asked off the table reads it).
        unavailableReason: reason.ruleReason('No card can hold this resource'),
      },
      {
        // The trade's SECOND DOOR: the console hands the player to the colony workspace with this card's payment path
        // locked — nothing commits until the trade itself is confirmed.
        available: tradeReason === undefined,
        title: VEYNON_TRADE_TITLE,
        effects: [actionPreviews.cardCost(this, VEYNON_DYNAMICS_TRADE_DOOR.price)],
        steps: [actionPreviews.colonyTradeStep(this)],
        unavailableReason: reason.ruleReason(tradeReason ?? 'No colony available to trade with'),
      },
    ]);
  }

  public action(player: IPlayer): PlayerInput | undefined {
    const options: Array<SelectOption> = [];
    if (this.mechHolders(player).length > 0) {
      options.push(new SelectOption(VEYNON_MECH_TITLE, 'Add mech').andThen(() => {
        getBehaviorExecutor().execute(VEYNON_MECH_TO_ANY_CARD, player, this);
        return undefined;
      }));
    }
    if (this.tradeVariantReason(player) === undefined) {
      // The trader IS the implementation — the shared card door.
      options.push(cardTradeDoorOption(player, new TradeWithVeynonDynamics(player), VEYNON_TRADE_TITLE, 'Trade'));
    }
    if (options.length === 0) {
      return undefined;
    }
    if (options.length === 1) {
      return options[0].cb(undefined);
    }
    return new OrOptions(...options).markChoiceContext(effectChoice(this));
  }
}

/** Pays a colony trade fee with 1 mech from Veynon Dynamics (the corporation's action) — the shared card door. */
export class TradeWithVeynonDynamics extends CardResourceTrader {
  constructor(player: IPlayer) {
    super(player, VEYNON_DYNAMICS_TRADE_DOOR);
  }
}
