/*
 * THE START WORKSPACE'S PLAY-FROM-HAND STEP — «Эпатажный спонсор».
 *
 * ── WHAT THE SERVER ACTUALLY DOES ────────────────────────────────────────
 *
 * `EccentricSponsor.bespokePlay` defers `PlayProjectCard`, which raises a
 * plain top-level `SelectProjectCardToPlay` over `player.getPlayableCards()`.
 * By then the prelude is already in the tableau and `lastCardPlayed` names it,
 * so `getCardDiscount` is live: the candidate list, every card's
 * `calculatedCost` and every `unplayableReasons` line ALREADY carry the 25 M€.
 * The discount is therefore authoritative end-to-end and the client must not
 * re-derive, re-apply or even name a number of its own — it only has to stop
 * throwing the player out of the workspace they are standing in.
 * (Ecology Experts uses the same deferred action and rides this for free.)
 *
 * ── WHAT WENT WRONG ──────────────────────────────────────────────────────
 *
 * `consoleTaskRouter` classifies that prompt `projectCard/playFromHand`, and
 * that kind is in `SHELL_SECTION_KINDS` — so the shell called
 * `openShellTaskSurface`, which flips `consoleState.section` to `'hand'`. The
 * Game Start Workspace stayed MOUNTED (its lifetime hold), but the hand took
 * the screen: a second full surface with its own «КАРТЫ В РУКЕ» crumb root
 * appeared over the start, and every reading of the causality — «this project
 * is being played BECAUSE of that prelude» — was gone.
 *
 * ── THE CLAIM ────────────────────────────────────────────────────────────
 *
 * This module is the claim that says «that prompt belongs to the workspace the
 * player is already inside». It is deliberately STRUCTURAL, never a card-name
 * or title match:
 *
 *   the Game Start Workspace serves  ∧  the live prompt is play-from-hand
 *   ⇒ the hand is a STEP of the start workspace, not a screen of its own.
 *
 * The SOURCE (which prelude caused it) is recorded by the start scene at the
 * moment it arms that card's hero — the one place the client legitimately
 * knows it. It is used for the breadcrumb subject and for the `L3 Источник`
 * grammar; nothing behavioural depends on it, so a missed capture degrades to
 * a generic «ПРОЛОГИ» crumb rather than to a broken flow.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';

export const startSponsorState = reactive({
  /**
   * The play-from-hand prompt is being served INSIDE the Game Start
   * Workspace. Mirrored from the shell's own computed (the shell owns the
   * signals), so plain-TS consumers — the leak detector, the input gate, the
   * task-surface opener — can read it without a Vue context.
   */
  embedded: false,
  /**
   * The card whose effect asked for the play. Captured when the start scene
   * arms its hero; '' when unknown (the crumb then says the honest generic).
   */
  source: '' as CardName | '',
  /**
   * The player has committed the sponsored play — the composer's submit is on
   * the wire. Holds the step past the point where `waitingFor` briefly names
   * nothing, so the workspace cannot decide the effect is over and let go
   * while the project is still flying to «Разыграно».
   */
  committing: false,
  /**
   * OWNERSHIP ≠ READINESS. The claim is made the moment the prompt arrives,
   * but the zone the hand teleports into is rendered by the start scene one
   * flush later — and a `<Teleport>` whose target does not resolve DROPS its
   * content (here: to `body`, i.e. a full-screen hand outside the workspace,
   * which is the exact artefact this whole step removes). The HOST publishes
   * this selector from a `flush: 'post'` watcher, so it is only ever non-empty
   * when the element genuinely stands. Same idiom as
   * `workspaceStageState.slot` / `workspaceOutcomeState.embedSlot`.
   */
  slot: '' as string,
});

/** The host's zone is standing (publish '' to retract). */
export function setStartSponsorSlot(selector: string): void {
  startSponsorState.slot = selector;
}

/** The teleport target, or undefined while the zone does not exist yet. */
export function startSponsorSlot(): string | undefined {
  return startSponsorState.slot === '' ? undefined : startSponsorState.slot;
}

/** The start workspace is hosting the play-from-hand step right now. */
export function startSponsorEmbedded(): boolean {
  return startSponsorState.embedded;
}

/** Mirror the shell's verdict (called from one watcher, never guessed). */
export function setStartSponsorEmbedded(on: boolean): void {
  startSponsorState.embedded = on;
  if (!on) {
    startSponsorState.committing = false;
  }
}

/**
 * The start scene records WHICH card it is playing as it arms the hero. If
 * that card's effect turns out to ask for a play-from-hand, this is the
 * source the breadcrumb names.
 */
export function noteStartPlaySource(card: CardName): void {
  startSponsorState.source = card;
}

export function startSponsorSource(): CardName | '' {
  return startSponsorState.source;
}

/** The sponsored play is on the wire (see `committing`). */
export function markStartSponsorCommitting(): void {
  startSponsorState.committing = true;
}

export function startSponsorCommitting(): boolean {
  return startSponsorState.committing;
}

/** A fresh start (new deal / workspace release) — forget everything. */
export function resetStartSponsor(): void {
  startSponsorState.embedded = false;
  startSponsorState.source = '';
  startSponsorState.committing = false;
  startSponsorState.slot = '';
}
