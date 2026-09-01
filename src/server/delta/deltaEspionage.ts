import {IPlayer} from '../IPlayer';
import {CardName} from '../../common/cards/CardName';
import {
  DeltaEspionageOwnerProjection,
  DeltaEspionageProjectionModel,
  DeltaEspionageTargetProjection,
} from '../../common/models/DeltaEspionageModel';
import {DP10_ADVANCE, DeltaProjectExpansion} from './DeltaProjectExpansion';

/**
 * THE ONE PROJECTION BUILDER for Corporate Espionage (DP10) — the whole
 * intended effect, server-authored, BEFORE anything is committed.
 *
 * Built twice on purpose, from the same functions both times:
 *  - by `cardPlayPreview` (the setup screen / target selector / ghost
 *    markers / summary all read this one payload);
 *  - by `bespokePlay` at the commit request, where it becomes the input's
 *    own validation baseline — so «what the player saw» and «what the server
 *    checks» are the same derivation, never two formulas.
 *
 * Every term is a SHARED primitive, never espionage-local arithmetic:
 * legality = `getValidAdvanceSteps` under {@link DP10_ADVANCE} (the same
 * evaluator the commit re-runs), the waiver tag = `missingPathTags`, target
 * eligibility = `retreatBlockedReason`, rewards = `stageOutcomeProjection`
 * (the pure mirror of the arrival resolver), passive bonuses =
 * `projectedMovementBonuses`. MUST NOT mutate game state.
 */
export function buildEspionageProjection(player: IPlayer): DeltaEspionageProjectionModel {
  const source = CardName.CORPORATE_ESPIONAGE;
  const fromPosition = player.deltaProjectData?.position ?? 0;
  const toPosition = fromPosition + 1;
  const legal = player.deltaProjectData !== undefined &&
    DeltaProjectExpansion.getValidAdvanceSteps(player, DP10_ADVANCE).includes(1);

  // The waiver is consumed only when actually NEEDED: exactly one path tag
  // uncovered. A fully-met path shows nothing (no phantom step for the
  // player to confirm); a deficit of two is simply illegal and the card
  // unplayable — both by the shared evaluator, never re-counted here.
  const missing = player.deltaProjectData !== undefined ?
    DeltaProjectExpansion.missingPathTags(player, toPosition) : [];
  const waivedTag = legal && missing.length === 1 ? missing[0] : undefined;

  const owner: DeltaEspionageOwnerProjection = {
    color: player.color,
    fromPosition,
    toPosition,
    legal,
    ...(waivedTag !== undefined ? {waivedTag} : {}),
    reward: DeltaProjectExpansion.stageOutcomeProjection(player, toPosition),
  };
  const movementBonuses = legal ?
    DeltaProjectExpansion.projectedMovementBonuses(player, toPosition, DP10_ADVANCE) : [];
  if (movementBonuses.length > 0) {
    owner.movementBonuses = movementBonuses;
  }

  // EVERY opponent, seating order, legal and blocked alike — a protected
  // player is SHOWN with the reason, never hidden (no hidden target). The
  // owner is never their own candidate.
  const targets: Array<DeltaEspionageTargetProjection> = [];
  for (const opponent of player.game.players) {
    if (opponent === player) {
      continue;
    }
    const targetFrom = opponent.deltaProjectData?.position ?? 0;
    const blocked = DeltaProjectExpansion.retreatBlockedReason(opponent);
    if (blocked !== undefined) {
      targets.push({color: opponent.color, fromPosition: targetFrom, legal: false, blocked});
      continue;
    }
    const targetTo = targetFrom - 1;
    const entry: DeltaEspionageTargetProjection = {
      color: opponent.color,
      fromPosition: targetFrom,
      toPosition: targetTo,
      legal: true,
    };
    // «Both players receive the bonus associated with their resulting
    // levels» — the target's half, from the same pure mirror the resolver
    // executes. A player whose own standing rule voids stage rewards
    // (MarsBot's Solo Delta Project) is still a fully legal target; the
    // void clause is NAMED, so the selector can say it instead of promising
    // a reward that never arrives.
    if (DeltaProjectExpansion.takesStageRewards(opponent)) {
      entry.reward = DeltaProjectExpansion.stageOutcomeProjection(opponent, targetTo);
    } else {
      entry.rewardSkipped = 'automa-rules';
    }
    targets.push(entry);
  }

  return {
    source,
    owner,
    targets,
    hasLegalTarget: targets.some((t) => t.legal),
  };
}
