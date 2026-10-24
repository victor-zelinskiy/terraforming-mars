/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A SITTING ON ITS WAY UP COVERS THE BOARD (Turmoil Redux, the soft gates —
 * docs/claude/console/parliament-soft-gates.md).
 *
 * Before the soft gates a sitting was on screen (gate 1, the verdict) when the
 * response that ran the law arrived, so everything the law did ON THE BOARD —
 * a scale stepped (Gas Export, Heat Capture), a tile lifted off (Water Export),
 * another seat's tile of the law (Mars First Budget) — met a COVERED board: the
 * board-beat park held the scales, the removal and the remote landing queued,
 * and the sitting's own world beat stepped aside to tell that story after the
 * law had been read. Now the whole chain rides the PASS, and that response is
 * applied over the board home: watchable, so the story played at once — the
 * oxygen fell under the pass, before any sitting had said why — and by the
 * reward page there was nothing left to show (the trip was a blink that left the
 * section unpainted).
 *
 * So the response that brings the sitting up says so in the apply block: from
 * that commit until the Parliament frame stands, the sitting COVERS the board —
 * the park's watchable verdict and the remote stage's `boardCovered` both read
 * it. Bounded (`SITTING_RISE_NET_MS`): a sitting that never comes up (left
 * behind its plate) lets the board go, and the park's own safety tells the story
 * then. A first view (a reload) owes nothing — `sittingBaselineOf` is the one
 * reading of «this response started the sitting».
 */
import {reactive} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {sittingBaselineOf} from './sittingBaseline';

/** The longest the board stays covered for a sitting that has not come up (the generation scene rises in ~2–4 s). */
export const SITTING_RISE_NET_MS = 15_000;

export const sittingRiseState = reactive({
  /** The response that ran the sitting has been applied; the Parliament frame does not stand yet. */
  owed: false,
});

let net: number | undefined;

function clearNet(): void {
  if (net !== undefined) {
    window.clearTimeout(net);
    net = undefined;
  }
}

/**
 * SEED — the apply block of BOTH roads (the transport's own submit, a poll / socket frame), BEFORE every other
 * parliament seeder: a view with NO sitting followed by the viewer's sitting of the same generation is the response
 * that ran it.
 */
export function noteSittingRise(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  if (before === undefined || after === undefined || before.game.parliament?.phase !== undefined) {
    return;
  }
  if (after.game.parliament?.phase === undefined || sittingBaselineOf(before, after) === undefined) {
    return;
  }
  sittingRiseState.owed = true;
  clearNet();
  if (typeof window !== 'undefined') {
    net = window.setTimeout(giveUpRise, SITTING_RISE_NET_MS);
  }
}

/** The net: a sitting that never stood gives the board back (honestly late — the tiles and scales play on it then). */
function giveUpRise(): void {
  net = undefined;
  sittingRiseState.owed = false;
}

/** Does a sitting on its way up cover the board right now? */
export function sittingRiseOwed(): boolean {
  return sittingRiseState.owed;
}

/** The Parliament frame STANDS (the section mounted, or the game moved on): the board is the sitting's to hand back now. */
export function sittingRiseStood(): void {
  clearNet();
  sittingRiseState.owed = false;
}
