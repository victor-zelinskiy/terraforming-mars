/*
 * THE PHASE WORKSPACE STILL TELLING ITS CONCLUSION — ONE answer for every reader (FREEZE ZERO, CI #153 · #154: the
 * monkey's `*-adjourn` tables).
 *
 * The research's buy ends the phase: the draft workspace reads its closing «ГОТОВО» (its flights, then its terminal
 * beat — `draftCompletionHolding`) while the server already asks the next question of the generation — a corporation's
 * first action owed since the opening, its colony pick. That question waits for the closing beat to leave: the surfaces
 * go IN TURN, never in one frame. Two readers ask it, and they must never part:
 *   · THE ONE FUNCTION (`servingOwnerOf` — its fact `concluding`): another owner's question is HELD by the scene, the
 *     press is the closing beat's (the bar stood on the research's commands while A went to the first action —
 *     `bar-APART:draft>corpFirst`);
 *   · THE BOARD's ANNOUNCEMENT (`mandatoryController`): its plate «A Открыть» is the held question's door, and a door
 *     offered over a surface that holds the press promises a button nobody keeps — the plate stood over the leaving
 *     research with the function already saying «held by the scene» (the e2e's record, 2026-11-25).
 *
 * NOT concluding: the research of the NEXT generation already live (`betweenGenResearchLive` — the draft workspace
 * owns that question itself), or no draft frame on the stack. Reactive by construction: the stack's frames and the
 * draft's flow state are `reactive` (invariant 17 — a cached fact moves at its edge).
 */
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {WorkspaceFrameKind, workspaceFrameIndex} from '@/client/console/consoleWorkspaceStack';
import {betweenGenResearchLive, draftCompletionHolding} from '@/client/console/draft/consoleDraftFlow';

/** The phase workspace whose closing beat holds the screen, or `''`. */
export function phaseWorkspaceConcluding(view: PlayerViewModel): WorkspaceFrameKind | '' {
  return workspaceFrameIndex('draft') !== -1 && draftCompletionHolding() && !betweenGenResearchLive(view) ? 'draft' : '';
}
