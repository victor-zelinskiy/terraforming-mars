import {IPlayer} from '../IPlayer';
import {CardName} from '../../common/cards/CardName';
import {
  DeltaBlockadeProjectionModel,
  DeltaBlockadeTargetProjection,
} from '../../common/models/DeltaBlockadeModel';
import {ICard} from '../cards/ICard';
import {DeltaProjectExpansion} from './DeltaProjectExpansion';

/**
 * THE ONE PROJECTION BUILDER for Modular Floodgates (DP11), variant B — the
 * whole intended deployment, server-authored, BEFORE anything is committed.
 * The sibling of `buildEspionageProjection` (DP10), built twice on purpose,
 * from the same functions both times:
 *
 *  - by `actionPreview` (the target selector, the ghost blockade on the
 *    track and the setup summary all read this one payload);
 *  - by `action()` at the commit request, where it becomes the input's own
 *    validation baseline — so «what the player saw» and «what the server
 *    checks» are the same derivation, never two formulas.
 *
 * Every term is a SHARED primitive: target eligibility =
 * `DeltaProjectExpansion.blockadeTargetBlockedReason` (the same verdict the
 * commit re-runs), the steel premise = the card's own `resourceCount`.
 * MUST NOT mutate game state.
 */
export function buildBlockadeProjection(player: IPlayer, card: ICard): DeltaBlockadeProjectionModel {
  // EVERY opponent, seating order, legal and blocked alike — a protected
  // player is SHOWN with the reason, never hidden (no hidden target). The
  // owner is never their own candidate: self-targeting is unexpressible.
  const targets: Array<DeltaBlockadeTargetProjection> = [];
  for (const opponent of player.game.players) {
    if (opponent === player) {
      continue;
    }
    const position = opponent.deltaProjectData?.position ?? 0;
    // The honest-value warning: their once-per-generation standard advance is
    // already gone, so the most visible thing a blockade denies is denied
    // already (card moves and the bot's Increase stay closed either way).
    const spent = opponent.deltaProjectData?.usedThisGeneration === true;
    const blocked = DeltaProjectExpansion.blockadeTargetBlockedReason(opponent);
    if (blocked !== undefined) {
      targets.push({color: opponent.color, position, legal: false, blocked, ...(spent ? {standardMoveSpent: true} : {})});
      continue;
    }
    targets.push({color: opponent.color, position, blockadePosition: position + 1, legal: true, ...(spent ? {standardMoveSpent: true} : {})});
  }

  return {
    source: CardName.MODULAR_FLOODGATES,
    cardSteel: card.resourceCount,
    targets,
    hasLegalTarget: targets.some((t) => t.legal),
    activeGeneration: player.game.generation,
  };
}
