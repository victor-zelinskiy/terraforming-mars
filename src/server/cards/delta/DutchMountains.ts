import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {Resource} from '../../../common/Resource';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {DeltaProjectExpansion} from '../../delta/DeltaProjectExpansion';
import {DeltaStageRewardInput} from '../../delta/DeltaStageRewardInput';

/** The action's fixed price — asked for in full BEFORE the reward resolves,
 *  so energy the claimed stage pays out can never fund its own claim. */
export const DP08_ENERGY_COST = 3;

/**
 * DP08 — DUTCH MOUNTAINS.
 *
 * ONE blue-card action: pay 3 energy → gain the ordinary reward of the
 * player's CURRENT Hydronetwork stage or one they have PASSED, excluding the
 * Jovian step and both VP steps.
 *
 * THIS IS A GRANT, NEVER A MOVEMENT. The whole card rides the reward-only
 * entry point ({@link DeltaProjectExpansion.grantStageReward}): the marker
 * does not move, no stop is recorded, no movement requirement/price is
 * re-checked, the generation's own advance is untouched, no terminal
 * ceremony/VP pool can be reached — and the reward itself is THE resolver
 * every arrival uses, so a claimed reward and a landed reward cannot diverge
 * (already-rewarded stages may be claimed again by design).
 *
 * ELIGIBILITY IS SEMANTIC AND SERVER-AUTHORITATIVE
 * ({@link DeltaProjectExpansion.rewardClaimableStages}): reached ∧ has a path
 * tag (start/VP cells have none) ∧ not Jovian — never number literals in UI,
 * never localized names. The console presents the pick ON the Hydronetwork
 * track itself (the workspace's reward-select bridge); the composed nested
 * plan of the chosen stage rides the input's own `answer` (the same
 * invocation-plan contract the move step carries).
 *
 * THE PRICE IS ENERGY, NOT «а Delta Project step price». Delta Works's steel
 * substitution applies to the STANDARD advance's per-step price only
 * (`resolveAdvancePayment` — its rule source); this card's toll is a card
 * action cost with a printed resource, so no substitution is offered.
 */
export class DutchMountains extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.DUTCH_MOUNTAINS,
      tags: [Tag.EARTH],
      cost: 13,

      requirements: {deltaPosition: 4},

      metadata: {
        cardNumber: 'DP08',
        // ONE block: the exclusion of the Jovian/VP steps already lives in the
        // Action text itself — a separate «Особое правило» note restated it
        // and read as a GLOBAL restriction on the player rather than a clause
        // of this card's own action.
        infoText: [
          {kind: 'action-short', text: 'Claim a reached stage reward for 3 energy', tokens: ['plate']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The scan's «Delta Project bonuses» in the fork's own vocabulary —
          // the module is presented as the Hydronetwork everywhere a player
          // reads (guarded by tests/i18n/hydronetworkNaming.spec.ts).
          b.action('Pay 3 energy. Gain the reward of your current Hydronetwork stage or one you have passed, excluding the Jovian step and the VP steps.', (ab) => {
            ab.energy(3).startAction.plate('Hydronetwork').asterix();
          });
        }),
      },
    });
  }

  private canPayToll(player: IPlayer): boolean {
    return player.energy >= DP08_ENERGY_COST;
  }

  public canAct(player: IPlayer): boolean {
    return this.canPayToll(player) &&
      DeltaProjectExpansion.rewardClaimableStages(player).length > 0;
  }

  /** ONE blocker, in check order: the price first (the printed cost is the
   *  action's own premise), then the pool of claimable stages. */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (!this.canPayToll(player)) {
      return reason.notEnoughEnergy();
    }
    if (DeltaProjectExpansion.rewardClaimableStages(player).length === 0) {
      return reason.ruleReason('No reached Hydronetwork stage offers a claimable reward');
    }
    return undefined;
  }

  /**
   * ONE branch, ONE step: the stage-reward claim input itself IS the step
   * (`{kind: 'input'}` — the composer's ordinary capture/confirm gating then
   * applies with no special case), presented by the console as the
   * Hydronetwork workspace's reward-select bridge. The 3-energy toll is the
   * branch's declared cost effect, so the projected resource plan seats it
   * BEFORE anything the claimed reward's own nested action may spend.
   */
  public actionPreview(player: IPlayer): ActionPreview {
    const claimable = DeltaProjectExpansion.rewardClaimableStages(player);
    const available = this.canAct(player);
    return actionPreviews.singleBranch(this, player, available ? [
      {kind: 'input', input: new DeltaStageRewardInput(claimable).toModel()},
    ] : [], [
      actionPreviews.stockCost(player, Resource.ENERGY, DP08_ENERGY_COST),
    ], {unavailableReason: this.actionUnavailableReason(player)});
  }

  /**
   * NOTHING IS SPENT BY CHOOSING. The claim commits only when the input's
   * response arrives: one atomic callback that re-validates the toll,
   * charges it, and grants the chosen stage's reward through the shared
   * resolver — with the composed nested plan (`input.answer`) consumed by
   * the very closures the prompts would run. A refused validation throws
   * before anything mutates (the action is then not marked used either —
   * the standard action pipeline stamps it only on a successful resolution).
   */
  public action(player: IPlayer): PlayerInput | undefined {
    const claimable = DeltaProjectExpansion.rewardClaimableStages(player);
    if (claimable.length === 0) {
      return undefined;
    }
    const input = new DeltaStageRewardInput(claimable);
    return input.andThen((position) => {
      if (player.energy < DP08_ENERGY_COST) {
        throw new Error(`Not enough energy for ${this.name}`);
      }
      player.stock.deduct(Resource.ENERGY, DP08_ENERGY_COST, {log: true, from: {card: this.name}});
      DeltaProjectExpansion.grantStageReward(player, position, {source: this.name, answer: input.answer});
      return undefined;
    });
  }
}
