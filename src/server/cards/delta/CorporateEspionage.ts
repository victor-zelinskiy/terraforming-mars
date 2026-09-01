import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {all} from '../Options';
import {Priority} from '../../deferredActions/Priority';
import {DP10_ADVANCE, DeltaProjectExpansion} from '../../delta/DeltaProjectExpansion';
import {DeltaEspionageInput} from '../../delta/DeltaEspionageInput';
import {buildEspionageProjection} from '../../delta/deltaEspionage';

/**
 * DP10 — CORPORATE ESPIONAGE.
 *
 * ONE compound, strictly ordered effect: push another player 1 step BACK on
 * the Hydronetwork (unless they stand on a VP level), then advance YOURSELF
 * 1 step — ignoring up to 1 required path tag — and BOTH markers receive the
 * reward of the stage they actually land on, each only after its own marker
 * actually moved.
 *
 * ═══ ONE PROJECTION, TWO READERS ═══
 *
 * The whole intended effect is authored ONCE, server-side
 * (`buildEspionageProjection`): every candidate's `from → to` and resulting
 * reward, the owner's own transition, the consumed tag waiver, the passive
 * movement bonuses. `cardPlayPreview` serves it to the setup screen (the
 * target selector, the track ghosts, the summary all read that one payload),
 * and `bespokePlay` rebuilds it at the commit request as the input's own
 * validation baseline — so what the player saw and what the server checks are
 * the same derivation. The client never computes a transition from a cell
 * number.
 *
 * ═══ RULE READINGS (pinned by tests/cards/delta/CorporateEspionage.spec.ts) ═══
 *
 *  1. The OWNER'S advance is MANDATORY — the card is unplayable when it is
 *     impossible even with the waiver (`getValidAdvanceSteps` under
 *     {@link DP10_ADVANCE}: end of track, an occupied VP slot one step ahead,
 *     or 2+ uncoverable path tags all block the PLAY, never half-run it).
 *  2. The ATTACK is mandatory when possible: with ≥1 legal target the pick is
 *     required before the play commits; with none the attack half is a NAMED
 *     skip and the card still plays for the owner's own advance.
 *  3. «Unless they are already at the VP level» and the track's lower bound
 *     are `DeltaProjectExpansion.retreatBlockedReason` — the one verdict the
 *     projection and the commit share. Self-targeting is unexpressible (the
 *     owner is never listed).
 *  4. ORDER IS THE PHYSICAL CARD'S: the target retreats and their landing
 *     reward FULLY resolves (their own choices, their own prompts) before
 *     the owner's marker moves — the owner's advance rides one deferred step
 *     at BACK_OF_THE_LINE, behind everything the target's reward defers (the
 *     Delta Surge traversal precedent).
 *  5. Both movements go through the ONE ledger (`commitDeltaRetreat` /
 *     `commitDeltaMovement` via `advance`), publishing two separate canonical
 *     movement facts — Social Heating and every future reactive rule read
 *     those, and this card never grants, moves or pays anything by hand.
 *  6. A reward belongs to the RESULTING position only, only after the actual
 *     move, resolved by the ONE arrival resolver (`resolveReward`); a player
 *     whose standing rule voids stage rewards (MarsBot's Solo Delta Project —
 *     `takesStageRewards`) still retreats, with the void clause NAMED.
 *  7. The tag waiver is {@link DP10_ADVANCE}'s `tagWaiver` through the shared
 *     evaluator — consumed only when needed, never covering two, never
 *     leaking into later moves, identical in preview and commit.
 */
export class CorporateEspionage extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.CORPORATE_ESPIONAGE,
      tags: [Tag.EARTH],
      cost: 5,

      metadata: {
        cardNumber: 'DP10',
        // ONE block per mechanic, in EXECUTION order (the order IS the
        // sequencing — no connective words): the attack, the own advance
        // with its waiver, then the shared reward clause both landings obey.
        infoText: [
          {text: 'Push another player 1 step back on the Hydronetwork — a player at a VP level cannot be pushed back', tokens: ['plate']},
          {text: 'Advance 1 step on the Hydronetwork, ignoring up to 1 required tag', tokens: ['plate']},
          {text: 'Each moved player receives the reward of the stage their marker lands on', tokens: ['text']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The printed formula: an opponent's marker one step back, yours
          // one step forward, and «?» — the rewards are whatever the two
          // resulting stages pay (the asterisked rules text carries the VP
          // protection and the tag waiver).
          b.text('-1').plate('Hydronetwork', {all}).text('+1').plate('Hydronetwork').colon().text('?').asterix();
        }),
        description: 'Reduce another player\'s Hydronetwork track by 1 step (unless they are already at the VP level). Increase your Hydronetwork track by 1 step. You may ignore 1 required tag. Both players receive the bonus associated with their resulting levels.',
      },
    });
  }

  /**
   * The mandatory own advance gates the whole play — the SHARED movement
   * pipeline's verdict under this card's own context (free step + one-tag
   * waiver), never a card-local re-derivation of tags / position / VP
   * occupancy. No target is required to exist: the attack half skips.
   */
  public override bespokeCanPlay(player: IPlayer): boolean {
    return player.deltaProjectData !== undefined &&
      DeltaProjectExpansion.getValidAdvanceSteps(player, DP10_ADVANCE).includes(1);
  }

  /**
   * ONE blocker, in the movement pipeline's own check order — the SHARED
   * card-granted-move refusal, asked under this card's context so the waiver
   * is already honoured (a single missing tag never blocks; the named tag of
   * a deeper deficit is one that really stays uncovered).
   */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.bespokeCanPlay(player)) {
      return undefined;
    }
    return DeltaProjectExpansion.bonusAdvanceUnavailableReason(player, DP10_ADVANCE);
  }

  /**
   * The on-play preview: ONE step — the espionage ask itself, carrying the
   * whole server-authored projection. The console routes it into the
   * Hydronetwork workspace's target-selection mode (the DP08 reward-pick
   * bridge precedent); the captured response replays byte-identically into
   * {@link bespokePlay}'s input.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const projection = buildEspionageProjection(player);
    return actionPreviews.playPreview(this, player, [], [
      {kind: 'input', input: new DeltaEspionageInput(projection).toModel()},
    ]);
  }

  public override bespokePlay(player: IPlayer): PlayerInput {
    const game = player.game;
    // Built AT THE COMMIT REQUEST — the input validates the response against
    // this live projection (while it stands, the queue is blocked on it, so
    // no position can move underneath). A stale/foreign answer refuses in
    // `process()` and the ask stands again, fresh — never a silent retarget,
    // never a half-run effect.
    const input = new DeltaEspionageInput(buildEspionageProjection(player));
    return input.andThen((response) => {
      // ── The attack half: first, and fully. ──
      if (response.target !== undefined) {
        const target = game.players.find((p) => p.color === response.target);
        if (target === undefined) {
          throw new Error(`No such player to target: ${response.target}`);
        }
        // Retreat + the target's landing reward (their own prompts defer on
        // THEM; everything they raise resolves before the owner moves).
        DeltaProjectExpansion.retreat(target, {source: this.name, by: player});
      } else {
        // No legal target — the attack half is a NAMED skip (validated by
        // the input: this branch is unreachable while a legal target exists).
        game.log('${0} found no player to push back on the Hydronetwork — the attack of ${1} is skipped', (b) =>
          b.player(player).cardName(this.name));
      }

      // ── The owner's own advance: strictly after the attack resolves. ──
      const ownerAnswer = response.ownerAnswer;
      player.defer(() => {
        // Deferred at BACK_OF_THE_LINE: anything the target's reward defers
        // (their choice, their draw, their repeated action and every prompt
        // IT raises) queues nearer and fully resolves before this runs —
        // the printed order without re-implementing a single reward.
        if (!DeltaProjectExpansion.getValidAdvanceSteps(player, DP10_ADVANCE).includes(1)) {
          // Unreachable today: no target reward can occupy the owner's
          // destination or strip the owner's tags. Stated as a NAMED skip
          // (never a silent half-effect, never a throw that would poison
          // the target's own response request) and pinned by the spec.
          game.log('${0} could no longer advance on the Hydronetwork — the advance of ${1} is skipped', (b) =>
            b.player(player).cardName(this.name));
          return undefined;
        }
        DeltaProjectExpansion.advance(player, 1, DP10_ADVANCE,
          ownerAnswer !== undefined ? {answers: [ownerAnswer]} : undefined);
        return undefined;
      }, Priority.BACK_OF_THE_LINE);
      return undefined;
    });
  }
}
