/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DEFERRED FLIP — the generation counter's beat for a seat whose SITTING stood (Turmoil Redux, the soft gates;
 * P89 · ledger EA).
 *
 * Around a standing sitting the next generation already runs on the server, and the strip's «ПКЛ.» reads the
 * sitting's generation (`presentedGeneration` — Р7: the counter flips at the seat's own close). The generation scene
 * that rose INTO the sitting therefore played no flip; the flip is owed to the close. The strip's `ConsoleFlipValue`
 * plays it by itself when the close's answer lands — what was missing is that the screen waited for it: the
 * Parliament → draft swap took the screen in the same flush, so the counter turned over under the draft's entrance.
 *
 * So the close's answer DECLARES the flip as a debt of the screen (`generation-flip` in `screenHandoff.ts`): the
 * handover's third path (`waitScreenHandoff('sitting-into-draft')`) waits for the strip's own completion signal
 * (`flip-end` → `noteDeferredGenerationFlipEnd`), never a timer — the net only bounds a wedged signal. Reduced motion
 * owes nothing (the strip snaps).
 *
 * Light on purpose: the screen director imports it, and the director must not drag the generation scene in.
 */
import {reactive} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleSessionScope} from '@/client/console/session/consoleSession';

/** The flip's own choreography length (ConsoleFlipValue's FLIP_TOTAL_MS) plus room — the net for a wedged signal. */
const DEFERRED_FLIP_NET_MS = 940 + 600;

/** The generation the strip still owes its flip to (0 = nothing owed). Reactive: a cached reader re-evaluates. */
export const deferredGenerationFlipState = reactive({owed: 0});

/** The net's disarm — a GUARANTEED release of the session: the debt is dropped at the net, or when the game screen leaves. */
let disarmNet: () => void = () => {};

/** Declare the debt: the strip is about to flip to `generation`. */
export function oweDeferredGenerationFlip(generation: number): void {
  deferredGenerationFlipState.owed = generation;
  disarmNet();
  disarmNet = consoleSessionScope().guarantee(motionMs(DEFERRED_FLIP_NET_MS), 'the strip\'s deferred generation flip (the net of a wedged signal)', () => {
    disarmNet = () => {};
    deferredGenerationFlipState.owed = 0;
  });
}

/** The strip finished a flip to `generation` (its own `flip-end`). */
export function noteDeferredGenerationFlipEnd(generation: number): void {
  if (deferredGenerationFlipState.owed !== 0 && generation >= deferredGenerationFlipState.owed) {
    resetDeferredGenerationFlip();
  }
}

/** Is the counter's deferred flip still playing? */
export function deferredGenerationFlipOwed(): boolean {
  return deferredGenerationFlipState.owed !== 0;
}

/** Game switch / tests. */
export function resetDeferredGenerationFlip(): void {
  disarmNet();
  disarmNet = () => {};
  deferredGenerationFlipState.owed = 0;
}
