/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE EXTERNAL-DRAW TAKE FLOW («ДОБОР КАРТЫ») — module state for the mandatory
 * take of cards an effect fired by ANOTHER player's action drew for the viewer
 * (Solar Logistics on a foreign space event, Sponsored Academies' «all
 * opponents draw», MarsBot resolving a space event). Routed off the server's
 * `externalDrawPrompt` marker, never a title.
 *
 * WHY MODULE STATE. The surface must outlive its own prompt twice over:
 *  · a TAKE submits and the response re-issues the prompt with the remainder —
 *    the same physical batch, one deal, one stable layout (`dealtIntake`);
 *  · the LAST take ends the prompt entirely while the card is still flying to
 *    the dock — the shell's close watcher must wait for `committing` to drop
 *    (the deck-pick precedent: a surface that hands cards to an always-mounted
 *    host holds itself down across the round trip).
 *
 * PURE of DOM and Vue components; only `reactive`.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ExternalDrawTakeMeta} from '@/common/models/ExternalDrawPromptModel';
import {SelectCardModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';

/**
 * `idle`    — no intake on screen;
 * `dealing` — the cards are physically coming off the deck into their slots;
 * `ready`   — the player may take (A one · B all · X inspect · L3 source);
 * `sending` — a take is in flight to the dock; input is absorbed BY PHASE, so
 *             a held button or a double press cannot take twice.
 */
export type ExternalDrawPhase = 'idle' | 'dealing' | 'ready' | 'sending';

export const externalDrawState = reactive({
  phase: 'idle' as ExternalDrawPhase,
  /** A take's flights are still owed — the shell must not close the frame. */
  committing: false,
  /**
   * The intake batch the deal has already played for (`<initiator>#<id>`).
   * A re-issued prompt (same intake, fewer cards) and a collapse-free remount
   * adopt the standing cards instead of re-dealing them.
   */
  dealtIntake: '',
  /**
   * Cards of the CURRENT intake already taken this session, in take order —
   * their slots stay as quiet ghosts so the row never re-flows under a
   * flight (the layout the player aimed at is the layout that stays).
   */
  taken: [] as Array<CardName>,
});

/** The marker off the live prompt — the flow's single structural source. */
export function externalDrawTakeOf(wf: PlayerInputModel | undefined): ExternalDrawTakeMeta | undefined {
  return wf?.type === 'card' ? (wf as SelectCardModel).externalDrawPrompt : undefined;
}

/** A stable identity for the batch (per recipient view). */
export function externalDrawIntakeKey(meta: ExternalDrawTakeMeta): string {
  return `${meta.initiator}#${meta.intakeId}`;
}

/** Should a mount PLAY THE DEAL for this intake — true only the first time. */
export function shouldDealIntake(key: string): boolean {
  return externalDrawState.dealtIntake !== key;
}

/** The deal for this intake has physically played (or been adopted). */
export function markIntakeDealt(key: string): void {
  if (externalDrawState.dealtIntake !== key) {
    externalDrawState.dealtIntake = key;
    externalDrawState.taken = [];
  }
}

export function beginExternalDrawDeal(): void {
  externalDrawState.phase = 'dealing';
}

export function beginExternalDrawReady(): void {
  if (externalDrawState.phase !== 'sending') {
    externalDrawState.phase = 'ready';
  }
}

/** A take goes out — synchronous with the submit, so no frame exists in which
 *  the prompt has moved on and the hold is not yet up. */
export function beginExternalDrawSend(taken: ReadonlyArray<CardName>): void {
  externalDrawState.phase = 'sending';
  externalDrawState.committing = true;
  externalDrawState.taken = [...externalDrawState.taken, ...taken];
}

/** The take's flights have landed — back to the (possibly re-issued) prompt. */
export function endExternalDrawSend(): void {
  externalDrawState.committing = false;
  if (externalDrawState.phase === 'sending') {
    externalDrawState.phase = 'ready';
  }
}

/** A REFUSED take: the cards come back into play (their ghosts un-ghost). */
export function rollbackExternalDrawSend(taken: ReadonlyArray<CardName>): void {
  externalDrawState.committing = false;
  externalDrawState.phase = 'ready';
  externalDrawState.taken = externalDrawState.taken.filter((n) => !taken.includes(n));
}

/** The shell's frame-close gate: true while a take's beats are still owed. */
export function externalDrawHolding(): boolean {
  return externalDrawState.committing;
}

/** Is the flow in an animated beat of its own? */
export function isExternalDrawBusy(): boolean {
  return externalDrawState.phase === 'dealing' || externalDrawState.phase === 'sending';
}

/** Full reset (frame closed / game switch / test cleanup). */
export function resetExternalDraw(): void {
  externalDrawState.phase = 'idle';
  externalDrawState.committing = false;
  externalDrawState.dealtIntake = '';
  externalDrawState.taken = [];
}

// NOTIFICATION-ONLY (the deck-pick precedent): the surface itself is the
// mandatory decision — a blocking hold would refuse to mount the very screen
// the beats play on. What it must stop is a notification card sliding over
// the cards mid-flight.
registerAnimationHoldSupplier('external-draw', isExternalDrawBusy, {scope: 'notification-only'});
