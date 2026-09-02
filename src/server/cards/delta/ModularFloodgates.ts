import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {all} from '../Options';
import {DeltaProjectExpansion} from '../../delta/DeltaProjectExpansion';
import {DeltaBlockadeInput} from '../../delta/DeltaBlockadeInput';
import {buildBlockadeProjection} from '../../delta/deltaFloodgates';

/**
 * DP11 — MODULAR FLOODGATES.
 *
 * ONE blue-card action, exactly one of two variants per activation:
 *
 *  A. FABRICATE A MODULE — add 1 steel resource to THIS card. The steel is
 *     PHYSICALLY stored here (`resourceType: CardResource.STEEL`), and «it can
 *     be used as a steel resource and counts as on your player board»: the
 *     spendable half is the `floodgateSteel` payment source (`Spendable.ts` —
 *     available wherever the rules let steel pay, protected from every
 *     auto-allocation, spent only by an explicit player choice). It is NEVER
 *     merged into `player.steel`: one physical unit has one identity, one
 *     count, one place it is deducted from.
 *
 *  B. DEPLOY A BLOCKADE — remove 1 steel from this card and place it in front
 *     of another player's marker on the Hydronetwork track, excluding the VP
 *     steps, blocking their advancement for THIS generation; the blockade is
 *     removed at the start of the next generation.
 *
 * ═══ ONE PROJECTION, TWO READERS (the DP10 contract) ═══
 *
 * Variant B's whole intended effect is authored once, server-side
 * (`buildBlockadeProjection`): every candidate's live position, the cell the
 * blockade would occupy, and each refusal named. `actionPreview` serves it to
 * the setup surface, and `action()` rebuilds it at the commit request as the
 * input's own validation baseline — the client never re-derives eligibility.
 *
 * ═══ RULE READINGS (pinned by tests/cards/delta/ModularFloodgates.spec.ts) ═══
 *
 *  1. The blockade is a PLAYER-TARGETED advancement ban, never one cell's
 *     decoration: `DeltaProjectExpansion.placeBlockade` writes the status on
 *     the target, `getValidAdvanceSteps` (and the bot twin) answer [] for a
 *     blocked player, and the movement ledger (`commitDeltaMovement`) holds
 *     the same line as the hard gate — so the standard action, DP03, DP04,
 *     DP07's multi-step, DP10's own advance and the MarsBot Increase are all
 *     closed by ONE contract, and DP08's reward-only grant (no movement)
 *     stays legal.
 *  2. «Excluding the VP steps»: a target whose NEXT cell is a VP terminal
 *     cannot receive the blockade (`blockadeTargetBlockedReason` —
 *     'vp-protected'; the end of the track is 'track-end'; an equivalent
 *     active blockade is 'already-blocked'). Self-targeting is unexpressible.
 *  3. Expiration is the generation boundary's own hook
 *     (`DeltaProjectExpansion.expireBlockades` in `Game.startGeneration`),
 *     exactly once, and the module's steel is NOT returned (the printed rule
 *     removes the blockade, not the cost).
 *  4. The unavailability of one variant never blocks the other: A is always
 *     legal (the `autoResolveSingle` collapse then makes it the whole
 *     action); B needs a steel on the card AND a legal target, each refusal
 *     named on the branch.
 */
export class ModularFloodgates extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.MODULAR_FLOODGATES,
      tags: [Tag.EARTH],
      cost: 7,
      resourceType: CardResource.STEEL,

      metadata: {
        cardNumber: 'DP11',
        // ONE CAPTION PER PRINTED ACTION ROW (the DP04 contract): the console
        // draws the two rows as two variants, each far past the caption clamp.
        // Row A's graphic signature is a PREFIX of row B's (`res-steel` vs
        // `res-steel,plate`), so its token is the full closed signature.
        infoText: [
          {kind: 'action-short', text: 'Store 1 steel on this card', tokens: ['action(res-steel)']},
          {kind: 'action-short', text: 'Blockade a player on the Hydronetwork', tokens: ['plate']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.action('Add 1 steel to this card. It can be used as a steel resource and counts as on your player board.', (ab) => {
            ab.empty().startAction.resource(CardResource.STEEL);
          }).br;
          b.or().br;
          b.action('Remove 1 steel from this card to place a blockade in front of another player\'s marker on the Hydronetwork track, excluding the VP steps, blocking their advancement for this generation. Remove the blockade at the start of the next generation.', (ab) => {
            ab.resource(CardResource.STEEL).startAction.plate('Hydronetwork', {all}).asterix();
          }).br;
        }),
      },
    });
  }

  /** Variant A (fabricate) has no precondition, so the ACTION is always
   *  available — a refusal only ever belongs to variant B's branch. */
  public canAct(): boolean {
    return true;
  }

  /**
   * ONE blocker for variant B, in check order: the module premise first (a
   * steel ON THIS CARD is what gets deployed), then the module data, then the
   * live target pool — each refusal names the ONE thing actually missing.
   */
  private blockadeVariantReason(player: IPlayer): UnplayableReason | undefined {
    if (this.resourceCount < 1) {
      return reason.noResourcesHere();
    }
    if (player.deltaProjectData === undefined) {
      return reason.ruleReason('Not in this game');
    }
    if (!buildBlockadeProjection(player, this).hasLegalTarget) {
      return reason.targetReason('No opponent can receive a Hydronetwork blockade right now');
    }
    return undefined;
  }

  /**
   * Two declared branches, in the SAME order `action()` pushes its options.
   * Variant B carries the blockade ask itself as its one step (`{kind:
   * 'input'}` — the composer's ordinary capture/confirm gating applies, and
   * the console routes it into the Hydronetwork workspace's target-selection
   * bridge); nothing is spent by choosing.
   */
  public actionPreview(player: IPlayer): ActionPreview {
    const blockadeReason = this.blockadeVariantReason(player);
    const available = blockadeReason === undefined;
    return actionPreviews.orBranches(this, [
      {
        available: true,
        title: 'Add 1 steel to this card',
        effects: [actionPreviews.cardGain(this, 1)],
      },
      {
        available,
        title: 'Deploy a blockade on the Hydronetwork',
        unavailableReason: blockadeReason,
        effects: [actionPreviews.cardCost(this, 1)],
        steps: available ? [
          {kind: 'input', input: new DeltaBlockadeInput(buildBlockadeProjection(player, this)).toModel()},
        ] : [],
      },
    ]);
  }

  /**
   * NOTHING IS SPENT BY CHOOSING. Variant B commits in one atomic callback:
   * re-validate the live target (`placeBlockade` runs the same verdict the
   * projection promised), take the module off THIS card, write the status.
   * A refused validation throws before anything mutates — the action is then
   * not marked used either (the pipeline stamps it only on success).
   */
  public action(player: IPlayer): PlayerInput | undefined {
    const options: Array<SelectOption> = [];
    options.push(new SelectOption('Add 1 steel to this card', 'Add steel').andThen(() => {
      player.addResourceTo(this, {qty: 1, log: true});
      return undefined;
    }));
    if (this.blockadeVariantReason(player) === undefined) {
      options.push(new SelectOption('Deploy a blockade on the Hydronetwork', 'Deploy').andThen(() => {
        // Built AT THE COMMIT REQUEST — the input validates the response
        // against this live projection (while it stands, the queue is blocked
        // on it, so no position can move underneath). A stale/foreign answer
        // refuses in `process()` and the ask stands again, fresh.
        const input = new DeltaBlockadeInput(buildBlockadeProjection(player, this));
        return input.andThen((response) => {
          const target = player.game.players.find((p) => p.color === response.target);
          if (target === undefined) {
            throw new Error(`No such player to block: ${response.target}`);
          }
          if (this.resourceCount < 1) {
            throw new Error(`No steel resource on ${this.name} to deploy`);
          }
          // ATOMIC: the LIVE eligibility verdict runs BEFORE the steel leaves
          // the card (the input validated against the projection of the
          // request, and the state can still move under a standing input) —
          // a refused target costs nothing. Only then the module leaves the
          // card (physical causality: the steel becomes the blockade) and the
          // status commits; `placeBlockade` re-runs the same verdict as its
          // own last line of defence.
          const blocked = DeltaProjectExpansion.blockadeTargetBlockedReason(target);
          if (blocked !== undefined) {
            throw new Error(`${target.color} can no longer receive a Hydronetwork blockade (${blocked})`);
          }
          player.removeResourceFrom(this, 1, {log: false});
          DeltaProjectExpansion.placeBlockade(target, {source: this.name, by: player});
          return undefined;
        });
      }));
    }
    if (options.length === 1) {
      return options[0].cb(undefined);
    }
    return new OrOptions(...options);
  }
}
