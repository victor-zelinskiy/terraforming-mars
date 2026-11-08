/**
 * THE QUESTION DOOR — a finished flow whose frame OWNS the standing question hands the screen to it IN PLACE.
 *
 * The field lock of 2026-11-07 (games pe81fc58 · p61ca6a9 — ledger HC): a vote in the Parliament completed the
 * chairman's quest, and the server's quest gate rode the vote's own answer. The vote mode reported its flow finished
 * from its `landed` stage; the shell's ONE guarded conclusion HELD the Parliament on `owned-prompt` (the frame serves
 * `chairmanQuest`) — correctly: closing it would throw the player out of the very screen the quest is answered in.
 * But the section opens the quest's stage only from its OVERVIEW, and the finished vote never folded back to it. Two
 * parties each waiting for the other: the conclusion for the prompt to be answered, the surface for the conclusion to
 * take it away. Nothing but the 8 s beat-stall teardown ended it.
 *
 * The law: a conclusion HELD on `owned-prompt` is not a dead end, it is a HAND-OVER. The frame that owns the question
 * registers ONE door here — «serve the standing question from where you stand» (fold a finished stage back, let the
 * overview's own doors open the question's stage) — and the shell opens it on every such hold of a frame standing on
 * screen at the top of the stack. A door is IDEMPOTENT: a stage already serving the question answers `true` and does
 * nothing. A frame kind with no door is a named worklist row (`[workspace-question] … no door`), never a silent wait.
 */
import type {WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';

/**
 * Serve the standing question in place. `true` = this surface serves it now (or already did); `false` = it has no
 * door for this question (the shell names the hold).
 */
export type FrameQuestionDoor = () => boolean;

const doors = new Map<WorkspaceFrameKind, FrameQuestionDoor>();

/** Register `kind`'s door (a mounted surface — the returned function retracts it, and only THIS door). */
export function registerFrameQuestionDoor(kind: WorkspaceFrameKind, door: FrameQuestionDoor): () => void {
  doors.set(kind, door);
  return () => {
    if (doors.get(kind) === door) {
      doors.delete(kind);
    }
  };
}

export type FrameQuestionDoorResult = 'served' | 'refused' | 'no-door';

/** Open `kind`'s door: what the surface answered, or `no-door` when none is registered. */
export function openFrameQuestionDoor(kind: WorkspaceFrameKind): FrameQuestionDoorResult {
  const door = doors.get(kind);
  if (door === undefined) {
    return 'no-door';
  }
  return door() ? 'served' : 'refused';
}

/** Test seam — drop every door. */
export function resetFrameQuestionDoors(): void {
  doors.clear();
}
