/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DRAW & SELECT FLOW — module state for «посмотри N карт колоды, оставь K».
 *
 * WHAT THIS OWNS, and why it is not just component state. `ConsoleDeckPick.vue`
 * is mounted for exactly as long as the prompt exists, and the prompt ends the
 * instant the answer reaches the server — which is the ONE moment the surface
 * must not disappear. The whole point of the flow is that the picked cards
 * physically travel to the hand dock and the rest are cleared away AFTERWARDS,
 * and both of those beats live entirely on the far side of the submit. So the
 * commit's lifetime is a MODULE fact, held here, read by the shell:
 *
 *     confirm → sending (picks fly to the dock) → clearing (rest tumble away)
 *             → release → the surface may finally unmount
 *
 * The same shape the final-greenery commit uses (`.claude/rules/console-ui.md`:
 * "a surface that hands a pick to an ALWAYS-MOUNTED host and unmounts must also
 * hold itself down across the SUBMIT round-trip"). Here the always-mounted host
 * is the hand dock.
 *
 * PURE of DOM and Vue components; only `reactive` — the shell's `v-if` and the
 * animation-hold supplier are render-time predicates, so a plain `let` would be
 * invisible to them (the session-freeze `handDeliveryDirector` documents).
 */

import {markRaw, reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';

/**
 * `idle`     — nothing running (the surface is not up, or it is waiting for a
 *              cinematic that another director owns — the hydro fan);
 * `dealing`  — the cards are physically coming off the deck into their slots;
 * `choosing` — the player's turn: focus, pick, confirm;
 * `sending`  — CONFIRMED. The picks are flying into the hand dock;
 * `clearing` — the picks have landed; the cards left behind are tumbling away.
 *
 * `sending` and `clearing` are BEATS, not destinations (consoleWorkspaceFlow's
 * distinction): input is absorbed and B does nothing, so a double submit is
 * impossible by construction rather than by a flag somebody remembers to check.
 */
export type DeckPickPhase = 'idle' | 'dealing' | 'choosing' | 'sending' | 'clearing';

export const deckPickState = reactive({
  phase: 'idle' as DeckPickPhase,
  /**
   * The submit has gone out and the outgoing beats are still owed. THE shell's
   * "keep this surface mounted" flag — `waitingFor` names the next prompt (or
   * nothing at all) long before the cards have reached the dock.
   */
  committing: false,
  /** How many cards the player kept — the clearing beat's copy reads it. */
  kept: 0,
  /**
   * THE BATCH THE DEAL HAS ALREADY PLAYED FOR — the reward batch's stable
   * identity (the surface's structural prompt key: card names + bounds).
   *
   * The deal is the presentation of a NEW batch, exactly once. A remount is
   * not a new batch: collapsing the hosting workspace and reopening the
   * mandatory prompt re-mounts the surface over the SAME server ask, and
   * keying the deal on the mount replayed the whole draw — cards flying off
   * a deck they had already left. Module state, deliberately: a flag in the
   * component died with it, which was the bug.
   */
  dealtKey: '',
});

/**
 * The player's UNSUBMITTED table state, surviving a park (collapse → board →
 * reopen re-mounts the surface): the draft picks and the cursor. Never the
 * answer — the server ask is untouched; this is presentation persistence for
 * the same batch identity only.
 */
let pickDraft: {key: string, picks: Array<CardName>, focusIdx: number} | undefined;

/** Should a mount PLAY THE DEAL for this batch — true only the first time. */
export function shouldDealBatch(key: string): boolean {
  return deckPickState.dealtKey !== key;
}

/** The deal for this batch has physically played (or been adopted). */
export function markBatchDealt(key: string): void {
  deckPickState.dealtKey = key;
}

/** Park the draft on unmount — same-batch remounts restore it. */
export function saveDeckPickDraft(key: string, picks: ReadonlyArray<CardName>, focusIdx: number): void {
  pickDraft = {key, picks: [...picks], focusIdx};
}

/** The draft for THIS batch, consumed; a different batch gets nothing. */
export function takeDeckPickDraft(key: string): {picks: Array<CardName>, focusIdx: number} | undefined {
  const d = pickDraft;
  pickDraft = undefined;
  if (d === undefined || d.key !== key) {
    return undefined;
  }
  return {picks: d.picks, focusIdx: d.focusIdx};
}

/** Is the flow in one of its own animated beats? */
export function isDeckPickBusy(): boolean {
  return deckPickState.phase === 'sending' || deckPickState.phase === 'clearing';
}

/** THE mount gate the shell adds to its own: the prompt may already be gone. */
export function deckPickHolding(): boolean {
  return deckPickState.committing;
}

/**
 * NOTIFICATION-ONLY, deliberately. The flow's own surface is a mandatory
 * decision; a blocking hold would refuse to mount the very screen the beats
 * play on. What it must actually stop is a notification card sliding over the
 * cards mid-flight.
 */
registerAnimationHoldSupplier('deck-pick', isDeckPickBusy, {
  scope: 'notification-only',
  // An outgoing beat past the ceiling ends through the commit's own release (`endDeckPickCommit`): the submit went
  // out long ago, the picks are the hand's (the view) and the surface may let go. A refusal still rolls back — the
  // surface's own `endOutgoing` re-reads the prompt when its awaits settle.
  expire: () => {
    if (!isDeckPickBusy()) {
      return;
    }
    console.warn(`[deck-pick] ${deckPickState.phase} beat (kept ${deckPickState.kept}): outlived its ceiling — ended`);
    endDeckPickCommit();
  },
});

/**
 * THE DEAL'S CEILING (wait graph R13). A deal is a beat of 1–3 s (the arrival plan of the largest batch, plus the
 * handoff); its ending is the surface's own landing (`finishDeal` → `beginDeckPickChoosing`). A landing that never
 * comes (a starved GSAP ticker, a handoff whose `onDone` never fired, a surface torn down mid-flight) left `dealing`
 * standing with the pad shut — and the hydro traversal, which resumes only on an `idle` flow, waiting behind it.
 * Generous, scaled with the motion preset, and ended HONESTLY: the cards are handed over, input opens.
 */
const DEAL_CEILING_MS = 8_000;

/** The deal run's own identity — a ceiling armed for an older deal never ends a newer one. */
let dealSeq = 0;
let dealCeilingId: ReturnType<typeof setTimeout> | undefined;
/** The surface's own handover (the real cards under the proxies, the bodies gone) — absent once it unmounted. */
let dealHandover: (() => void) | undefined;

function clearDealCeiling(): void {
  if (dealCeilingId !== undefined) {
    clearTimeout(dealCeilingId);
    dealCeilingId = undefined;
  }
  dealHandover = undefined;
}

/** The ceiling fired on deal `seq`: the deal ends where it stands — handed over to the player, or let go. */
function endDealAtCeiling(seq: number): void {
  dealCeilingId = undefined;
  if (seq !== dealSeq || deckPickState.phase !== 'dealing') {
    return;
  }
  const handover = dealHandover;
  dealHandover = undefined;
  console.warn(`[deck-pick] the deal outlived its ceiling — ${handover !== undefined ? 'cards handed over, input opens' : 'no surface stands, the flow lets go'}`);
  handover?.();
  clearDeckPickFlight();
  if (deckPickState.phase === 'dealing') {
    // A surface that stands now takes input; with none standing there is nobody to choose — the flow rests.
    deckPickState.phase = handover !== undefined ? 'choosing' : 'idle';
  }
}

/** The cards are coming off the deck (or another director's cinematic is
 *  delivering them) — input stays shut until they have all landed. Bounded by
 *  its own ceiling; `handover` is the surface's honest ending of a deal that
 *  never landed (the cards shown in their slots). Returns the deal's identity. */
export function beginDeckPickDeal(handover?: () => void, ceilingMs: number = DEAL_CEILING_MS): number {
  deckPickState.phase = 'dealing';
  deckPickState.committing = false;
  deckPickState.kept = 0;
  clearDealCeiling();
  const seq = ++dealSeq;
  dealHandover = handover;
  dealCeilingId = setTimeout(() => endDealAtCeiling(seq), motionMs(ceilingMs));
  return seq;
}

/** The surface that dealt `seq` is going: its handover would act on a dead tree — the ceiling only lets the flow go. */
export function disownDeckPickDeal(seq: number): void {
  if (seq === dealSeq) {
    dealHandover = undefined;
  }
}

/** Everything has landed and handed over — the player may act. */
export function beginDeckPickChoosing(): void {
  if (deckPickState.phase !== 'sending' && deckPickState.phase !== 'clearing') {
    deckPickState.phase = 'choosing';
  }
  clearDealCeiling();
}

/**
 * CONFIRMED. Called SYNCHRONOUSLY with the submit — before the response can
 * land — so no frame exists in which the prompt is gone and the hold is not yet
 * up. `kept` rides along because the clearing beat's copy needs it after the
 * picks have already left the surface.
 */
export function beginDeckPickSend(kept: number): void {
  clearDealCeiling();
  deckPickState.phase = 'sending';
  deckPickState.committing = true;
  deckPickState.kept = kept;
}

/** The picks are in the dock; the cards left behind may go. */
export function beginDeckPickClearing(): void {
  if (deckPickState.committing) {
    deckPickState.phase = 'clearing';
  }
}

/**
 * The last beat is over — the surface may unmount.
 *
 * A SERVER REFUSAL takes the same door: the flow rolls back to `choosing` (the
 * prompt is still live, so the surface is still mounted by the ordinary gate)
 * rather than leaving the player inside a beat that will never finish.
 */
export function endDeckPickCommit(): void {
  clearDealCeiling();
  deckPickState.committing = false;
  deckPickState.phase = 'idle';
  // The batch is ANSWERED — a parked draft for it can never be honest again.
  pickDraft = undefined;
}

/** The submit was refused: give the screen back rather than stranding it. */
export function rollbackDeckPickCommit(): void {
  deckPickState.committing = false;
  deckPickState.kept = 0;
  deckPickState.phase = 'choosing';
}

/* ── THE FLIGHT LAYER — APP LEVEL, never inside the surface ───────────────
 *
 * The proxies are `position: fixed` and the director writes ABSOLUTE SCREEN
 * COORDINATES into them. That only holds while no ancestor establishes a
 * containing block — and a teleported surface has plenty: the start
 * workspace's embed zone runs a 260 ms `animation` on arrival (an animating
 * `transform` contains fixed descendants for its whole duration), which is
 * exactly the window the deal launches in.
 *
 * The symptom was unmistakable and completely misleading: the cards flew in
 * FROM THE RIGHT EDGE of the screen instead of off the deck, because every
 * coordinate was being resolved against the zone's own origin — the deck's
 * (x, y) plus the zone's (left, top) lands off-canvas. Not a timing bug, not a
 * measurement bug: a containing-block bug.
 *
 * So the layer lives at APP LEVEL, like every other flight stage in the
 * console (`ConsoleCardExitLayer`, `ConsoleHandDeliveryLayer`,
 * `ConsoleDeckDrawLayer`). The surface publishes the faces; the layer owns the
 * bodies; the surface measures its own slots and hands both to the director.
 */

export const deckPickFlightState = reactive({
  /** The faces to fly, in batch order. Empty = the layer renders nothing. */
  cards: [] as Array<CardName>,
  /** Bumped per arm — the layer re-creates its bodies on it. */
  nonce: 0,
});

/** The proxy ROOTS, by batch index. `markRaw` — these are DOM nodes, never
 *  reactive data (a proxied element breaks GSAP's property writes). */
const proxyEls = new Map<number, HTMLElement>();

export function registerDeckPickProxy(index: number, el: HTMLElement | null | undefined): void {
  if (el === null || el === undefined) {
    proxyEls.delete(index);
    return;
  }
  proxyEls.set(index, markRaw(el));
}

/** The layer's bodies in batch order — `[]` until they are all mounted. */
export function deckPickProxyEls(): Array<HTMLElement> {
  const out: Array<HTMLElement> = [];
  for (let i = 0; i < deckPickFlightState.cards.length; i++) {
    const el = proxyEls.get(i);
    if (el === undefined || !el.isConnected) {
      return [];
    }
    out.push(el);
  }
  return out;
}

/** The surface names the batch; the layer mounts the bodies. */
export function armDeckPickFlight(cards: ReadonlyArray<CardName>): void {
  proxyEls.clear();
  deckPickFlightState.cards = [...cards];
  deckPickFlightState.nonce++;
}

/** The flight is over (settled, handed off, aborted) — the bodies may go. */
export function clearDeckPickFlight(): void {
  proxyEls.clear();
  deckPickFlightState.cards = [];
}

/** Full reset (unmount / game switch / test cleanup). */
export function resetDeckPick(): void {
  clearDealCeiling();
  deckPickState.phase = 'idle';
  deckPickState.committing = false;
  deckPickState.kept = 0;
  deckPickState.dealtKey = '';
  pickDraft = undefined;
  clearDeckPickFlight();
}
