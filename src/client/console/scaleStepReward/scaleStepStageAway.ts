/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «THE PLAYER HAS GONE TO DO SOMETHING ELSE» — the one answer the three members of a scale step's story ask (the
 * rating — `scaleStepRatingBeat`, the step's reward — `scaleStepRewardBeat`, the Venus bonus cell —
 * `venusBonusCellBeat`) before they wait for their stage.
 *
 * A step the viewer made pays on the RAIL, and the payment is held there so that it can be told on the board: the
 * marker glides, a token is born on its rim and flies to the cell it ticks. The hold is honest for as long as the
 * board is coming: the workspace that made the step is past its commit and leaves by itself (PL-002 — the rating must
 * not tick under an action's workspace with nothing on screen to explain it).
 *
 * It is NOT honest once the player has walked off into a screen of their own. They place a tile, the oxygen steps,
 * and before the marker has finished they open «Действия карт» and read: the board is behind their screen for as long
 * as they like, the RAIL is in front of them the whole time — an instrument, in view, holding a number the server has
 * already changed. The story waited for a stage that was not coming: the rating stood held up to thirty-two seconds
 * and was then applied untold on a clock; the park's blocking window stood with it («still hold — board-beat-scale-
 * story stand 6 s with nothing moving»), and the notifications behind it starved («held behind an ANIMATION hold for
 * over 12000 ms — delivering anyway»). Three lines of a whole game's log, each filed «planned» or «info»
 * (FREEZE ZERO, the zero bar — the fourth hundred, 2026-11-25).
 *
 * THE LAW (truth before story — invariant 16): the member keeps the screens its step was MADE under (`stepWitness()`,
 * taken when the step arrives — and only for a step of the VIEWER's: another seat's, the World Government's, was made
 * under no screen of this page). The player has gone to do something else when the board is out of their view and
 *   · a screen with NO frame covers it («Информация», «Разыграно» — the player's own looks), or
 *   · the top frame was entered AFTER the step, none of the makers still stands on the live stack (a maker still
 *     standing will leave by itself — a flow past its commit, a follow-up step of the same flow, a maker whose record
 *     steps back to «configure» for the beat between its resolution's end and its conclusion: the colonies after a
 *     trade), and it is not in a transient beat (`executing` · `completing` — read where the surface derives it:
 *     card-actions); a flow the player committed in that NEW screen owes this step nothing, or
 *   · the maker itself stands in a VERDICT (the player reads it; a verdict never leaves by itself).
 * Then the member lets its hold go AT ONCE: the cell ticks, named by its chip, nothing flies (the walk's trail says it —
 * `noteStepAway`). The scale's own marker stays the board's to tell (the park — it glides when the board is back).
 * Otherwise the member waits, as before, bounded by its due.
 */
import {markRaw, toRaw} from 'vue';
import {boardOutOfViewForStory} from '@/client/console/boardBeatPark';
import {liveFrameIdentities, standingFrameIdentities, workspaceStackTop} from '@/client/console/consoleWorkspaceStack';
import {isTransientBeat, surfacePhaseOf} from '@/client/console/workspaceBeatStall';
import {noteTransferTrail} from '@/client/console/resourceTransfer/consoleResourceTransfer';

/** The screens a step was made under — kept by the member from the step's arrival. */
export type ScaleStepWitness = ReadonlySet<object>;

/** Taken when a step ARRIVES: the live frames it was made under. */
export function stepWitness(): ScaleStepWitness {
  return markRaw(liveFrameIdentities() as Set<object>);
}

/** A step made under no screen of this page (another seat's, the World Government's, a resolution's world move). */
export const NO_MAKERS: ScaleStepWitness = markRaw(new Set<object>());

/** The member let go — said to the walk's trail, so a walk tells «let go» from «told» (invariant 4). */
export function noteStepAway(member: string, why: string): void {
  noteTransferTrail('scale-step:away', {member, why});
}

/** Two arrivals merged into one entry (a beat still owed for an earlier response plays this one's tokens too). */
export function mergeStepWitness(a: ScaleStepWitness | undefined, b: ScaleStepWitness): ScaleStepWitness {
  return a === undefined ? b : markRaw(new Set([...a, ...b]));
}

/** Where the player has gone (the line of a diagnosis), or `undefined` — the stage is coming, or stands. */
export function scaleStepStageAway(madeUnder: ScaleStepWitness): string | undefined {
  const behind = boardOutOfViewForStory();
  if (behind === undefined) {
    return undefined;
  }
  const top = workspaceStackTop();
  if (top === undefined) {
    // A screen with no frame covers the board («Информация», «Разыграно»): the player's own look — unless a maker
    // still STANDS somewhere (parked, aside for the board: the start workspace through its opening — its own screen
    // still covers the board, and its step is told when the opening is over, or at its due, said `planned`).
    const standing = standingFrameIdentities();
    for (const maker of madeUnder) {
      if (standing.has(maker)) {
        return undefined;
      }
    }
    return `${behind} — the player is at a screen of their own`;
  }
  const phase = surfacePhaseOf(top.kind) ?? top.phase;
  if (madeUnder.has(toRaw(top))) {
    // The maker on top leaves by itself — unless it stands in a verdict the player reads.
    return phase === 'verdict' ? `${behind} — the player reads the verdict of «${top.kind}»` : undefined;
  }
  const live = liveFrameIdentities();
  for (const maker of madeUnder) {
    if (live.has(maker)) {
      return undefined;
    }
  }
  return isTransientBeat(phase) ? undefined : `${behind} — the player is at «${top.kind}» (${phase})`;
}
