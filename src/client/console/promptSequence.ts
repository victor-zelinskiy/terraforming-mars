/*
 * PROMPT SEQUENCE — «this is a NEW decision», said where the eye is, and kept
 * from being answered by the rhythm of the last one.
 *
 * One press routinely asks the same player several questions in a row: a tile
 * beside an Ares hazard owned by Philares asks the Ares adjacency card pick, then
 * Philares' reward, then the hazard's production loss — LAST, by the deferred
 * queue's priorities (GAIN 21 before LOSE 22). The player who answered two gifts
 * with A, X answers the third the same way and gives up an income they meant to
 * keep. Three things stop that, and this module owns all three:
 *
 *   1. THE CHAIN. A chain opens on every submit through the transport funnel
 *      (`notePromptSubmit`) and closes when the player is idle again — no prompt,
 *      or the action menu (`notePromptView`). A prompt presented while a chain is
 *      open is the ANSWER to the player's own press, and it knows its ordinal and
 *      whether its character differs from the decision answered just before it.
 *   2. THE PRESENTATION. `presentPrompt` (called by the ONE modal head,
 *      `ConsolePromptHead.vue`) returns what the head shows: «РЕШЕНИЕ 2», the
 *      tone-shift beat (crest wipe, emblem, tag) and the settle meter.
 *   3. THE SETTLE. For a short window after a decision appears, the presses that
 *      DECIDE (A, X, the bumpers, the triggers) are absorbed by the shell
 *      (`promptSettleAbsorbs`, ONE gate before every prompt surface) and greyed
 *      on the command bar (`consolePanelUi.panelCommands`). Navigation, B, Y and
 *      the stick presses always pass — reading, inspecting and minimizing are
 *      never an answer. The window is longest when the character FLIPS
 *      (a gain after a loss, a loss after a gain).
 *
 * The settle is a SAFETY, not motion: it does not scale with `--motion-scale`
 * and reduced motion does not shorten it (its meter simply does not animate).
 * The gate compares timestamps — the timer only repaints the bar.
 *
 * The pure core (`planPresentation`, `settleBlocks`) is spec'd under the server
 * runner (`tests/console/promptSequence.spec.ts`).
 */

import {reactive} from 'vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {isActionMenuTitle} from '@/common/inputs/actionMenuTitles';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {PromptTone} from '@/client/console/promptTone';

/** A decision that opens a chain or stands alone: a double-tap guard only. */
export const SETTLE_FIRST_MS = 300;
/** A follow-up of the same character: long enough to see that the screen changed. */
export const SETTLE_FOLLOW_MS = 650;
/** A follow-up whose character FLIPPED: long enough to read the tag. */
export const SETTLE_SHIFT_MS = 1100;
/** A chain never outlives this — a stale submit is not the cause of a prompt a minute later. */
export const CHAIN_MAX_AGE_MS = 45_000;

/** The presses that DECIDE something on a prompt surface (never navigation, B, Y or a stick press). */
const DECIDING_BUTTONS: ReadonlySet<SemanticButton> = new Set<SemanticButton>([
  'confirm', 'secondary', 'bumperL', 'bumperR', 'triggerL', 'triggerR',
]);

export type ChainAnswer = {key: string, tone: PromptTone};

export type PromptChain = {
  open: boolean;
  openedAt: number;
  /** The DECISIONS answered inside this chain (a placement or a play opens a chain without being one). */
  answered: ReadonlyArray<ChainAnswer>;
};

export type PromptPresentation = {
  key: string;
  tone: PromptTone;
  /** 1 = the first decision of its chain (or a decision standing alone). */
  ordinal: number;
  /** Presented as the answer to the player's own press. */
  inChain: boolean;
  /** The character differs from the decision answered just before it, in this chain. */
  toneShift: boolean;
  previousTone?: PromptTone;
  settleMs: number;
  presentedAt: number;
  /** Re-mounts the head's one-shot beats for a genuinely new presentation. */
  nonce: number;
};

export const EMPTY_CHAIN: PromptChain = {open: false, openedAt: 0, answered: []};

/** Is the chain still the cause of what is presented now? */
export function chainLive(chain: PromptChain, now: number): boolean {
  return chain.open && now - chain.openedAt <= CHAIN_MAX_AGE_MS;
}

/**
 * What a decision presented NOW is, given the chain and the presentation it
 * replaces. The SAME key re-presented (a minimize → restore, a re-render) keeps
 * its ordinal and its shift — it is the same decision — and gets only the
 * double-tap guard, because the player re-opened it themselves.
 */
export function planPresentation(
  chain: PromptChain,
  previous: PromptPresentation | undefined,
  key: string,
  tone: PromptTone,
  now: number,
  nonce: number,
): PromptPresentation {
  if (previous !== undefined && sameDecision(previous.key, key)) {
    return {...previous, key, tone, settleMs: SETTLE_FIRST_MS, presentedAt: now, nonce};
  }
  const inChain = chainLive(chain, now);
  const answered = inChain ? chain.answered : [];
  const last = answered.length > 0 ? answered[answered.length - 1] : undefined;
  const ordinal = answered.length + 1;
  // A shift is a flip between the two CHARACTERS that cost something to confuse;
  // a neutral step between them is its own kind of screen, not a reversal.
  const toneShift = last !== undefined && last.tone !== tone && last.tone !== 'neutral' && tone !== 'neutral';
  const settleMs = ordinal === 1 ? SETTLE_FIRST_MS : toneShift ? SETTLE_SHIFT_MS : SETTLE_FOLLOW_MS;
  return {key, tone, ordinal, inChain, toneShift, previousTone: last?.tone, settleMs, presentedAt: now, nonce};
}

/**
 * Two keys of ONE decision: the same key, or the decision and a wizard step the player opened inside it
 * (`promptSequenceKey`'s `|n<step>` tail). Opening a step is the player's own press — it is never a new decision to
 * be guarded against.
 */
export function sameDecision(a: string, b: string): boolean {
  const root = (key: string) => key.replace(/\|n\d+$/, '');
  return root(a) === root(b);
}

/** The chain after a submit: the presented decision (if any) joins it; a bare action only opens it. */
export function chainAfterSubmit(chain: PromptChain, presented: PromptPresentation | undefined, now: number): PromptChain {
  const live = chainLive(chain, now);
  const answered = live ? chain.answered : [];
  const openedAt = live ? chain.openedAt : now;
  if (presented === undefined) {
    return {open: true, openedAt, answered};
  }
  const last = answered.length > 0 ? answered[answered.length - 1] : undefined;
  // A refused submit is re-sent from the SAME decision — it is answered once.
  if (last !== undefined && last.key === presented.key) {
    return {open: true, openedAt, answered};
  }
  return {open: true, openedAt, answered: [...answered, {key: presented.key, tone: presented.tone}]};
}

/** Does the settle window swallow this intent? Pure — the shell's gate and the spec ask the same thing. */
export function settleBlocks(intent: GamepadIntent, settleUntil: number, now: number): boolean {
  return now < settleUntil && intent.kind === 'press' && DECIDING_BUTTONS.has(intent.button);
}

/** A command bar control that DECIDES — greyed while the decision settles. */
export function settleGreysControl(control: string): boolean {
  return DECIDING_BUTTONS.has(control as SemanticButton);
}

/**
 * A decision's identity for the chain: the server's own serial (`promptId` — a
 * new one every time a prompt is SET, stable across polls) beside the shared
 * identity key, plus the open wizard step. Two Ares adjacency picks with the
 * same title are two decisions; a re-render of one is not.
 */
export function promptSequenceKey(wf: PlayerInputModel | undefined, identity: string, step?: number): string {
  return `${wf?.promptId ?? '-'}|${identity}${step !== undefined ? `|n${step}` : ''}`;
}

/** The player is idle again: no prompt, or the turn's action menu. */
export function promptViewIsIdle(wf: PlayerInputModel | undefined): boolean {
  return wf === undefined || (wf.type === 'or' && isActionMenuTitle(typeof wf.title === 'string' ? wf.title : undefined));
}

// ── the reactive store (one per session; reset with the game) ─────────────

export const promptSequenceState = reactive({
  /** The decision on screen now (the ONE modal head registered it). */
  current: undefined as PromptPresentation | undefined,
  /** The settle window is open — the bar greys the deciding verbs. */
  settling: false,
  /** Bumped when a press was absorbed — the head answers with one calm pulse. */
  nudge: 0,
});

let chain: PromptChain = EMPTY_CHAIN;
/** The last decision presented — what a re-mount of the SAME key resumes. */
let lastPresented: PromptPresentation | undefined;
let settleUntil = 0;
let nonce = 0;
let settleTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function armSettle(ms: number): void {
  settleUntil = now() + ms;
  if (settleTimer !== undefined) {
    globalThis.clearTimeout(settleTimer);
    settleTimer = undefined;
  }
  promptSequenceState.settling = ms > 0;
  if (ms > 0) {
    settleTimer = globalThis.setTimeout(() => {
      settleTimer = undefined;
      promptSequenceState.settling = false;
    }, ms);
  }
}

/** A modal head presents a decision (its prompt identity changed, or it mounted). */
export function presentPrompt(key: string, tone: PromptTone): PromptPresentation {
  const at = now();
  const current = promptSequenceState.current;
  // The same decision, still on screen: nothing new happened (a re-render).
  if (current !== undefined && current.key === key && current.tone === tone) {
    return current;
  }
  nonce++;
  const presentation = planPresentation(chain, lastPresented, key, tone, at, nonce);
  lastPresented = presentation;
  promptSequenceState.current = presentation;
  armSettle(presentation.settleMs);
  return presentation;
}

/** The head left the screen (answered, minimized or replaced). */
export function withdrawPrompt(key: string): void {
  if (promptSequenceState.current?.key === key) {
    promptSequenceState.current = undefined;
    armSettle(0);
  }
}

/** The transport's submit funnel: the player answered something. */
export function notePromptSubmit(): void {
  chain = chainAfterSubmit(chain, promptSequenceState.current, now());
}

/** The transport applied a view: a player idle again ends the chain. */
export function notePromptView(wf: PlayerInputModel | undefined): void {
  if (promptViewIsIdle(wf)) {
    chain = EMPTY_CHAIN;
    lastPresented = undefined;
  }
}

/**
 * The shell's ONE gate before every prompt surface: a deciding press inside the
 * settle window is swallowed — and answered with a nudge, so the press is never
 * silently lost.
 */
export function promptSettleAbsorbs(intent: GamepadIntent): boolean {
  if (promptSequenceState.current === undefined || !settleBlocks(intent, settleUntil, now())) {
    return false;
  }
  promptSequenceState.nudge++;
  return true;
}

/** The probe's read (`__conPromptSequence()` on the window) — the chain, the decision on screen and the window. */
export function promptSequenceDiag(): {chain: PromptChain, current: PromptPresentation | undefined, settleLeftMs: number} {
  return {chain, current: promptSequenceState.current, settleLeftMs: Math.max(0, settleUntil - now())};
}
if (typeof window !== 'undefined') {
  (window as unknown as {__conPromptSequence?: typeof promptSequenceDiag}).__conPromptSequence = promptSequenceDiag;
}

/** Game switch / spec isolation. */
export function resetPromptSequence(): void {
  chain = EMPTY_CHAIN;
  lastPresented = undefined;
  promptSequenceState.current = undefined;
  promptSequenceState.nudge = 0;
  nonce = 0;
  armSettle(0);
}
