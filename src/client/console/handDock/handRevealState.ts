/*
 * HAND REVEAL STATE — the reactive registry behind the dock ⇄ album
 * transition (ConsoleHandRevealLayer = the HAND BODIES layer +
 * handRevealDirector).
 *
 * SINGLE-OWNER REWORK: the layer owns ONE persistent body per hand card
 * (see handBodies.ts) — there are no spawned proxies and no hidden dock
 * backs any more, so this module keeps only the episode-level presentation
 * state the Vue side renders from:
 *
 *  - `phase` — the presentation state machine:
 *      docked  → the hand lives in the pack (no episode running);
 *      opening → bodies fly pack → album slots (reversible);
 *      open    → the album owns the cards (page bodies shelved under the
 *                interactive slots, the rest parked as page packets);
 *      closing → bodies fly album → pack (reversible).
 *  - `holdSlots` — the album slots render held (`.con-hand--transit`)
 *    while the bodies are the single visible representation of each card;
 *  - `flightVisuals` — the landed presentation each flying FACE carries
 *    (dim + blocker chip + live model), so nothing pops at the handoff;
 *  - `stageClip` — the static STAGE WINDOW on the layer (packet physics).
 */

import {reactive} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {createCursorArrival, trackCursorArrival} from '@/client/console/cursorArrival';

/**
 * THE ALBUM'S CURSOR ARRIVAL (TR58). The album mounts with its focused card already logically cursored, but the POSE
 * (ring + lift) is gated while the copies fly and through the handoff: the copies are identical to the RESTING slot,
 * they leave on the frame after the slots show, and only then does the cursor arrive — one transition, never a ring
 * born under a copy and revealed with it. Held by the open episode, released by its handoff
 * (`handRevealDirector.finalizeOpenForward`); the section binds it as `[data-cursor-pending]`.
 */
export const handCursor = createCursorArrival('hand album');
trackCursorArrival(handCursor);

export type HandRevealPhase = 'docked' | 'opening' | 'open' | 'closing';

/**
 * The card's FINAL grid presentation, carried by its flying body so the
 * landed state can never pop at the handoff: `dim` mirrors the slot's
 * unplayable ('soft') / select-disabled ('strong') filter, `chip` is the
 * compact blocker label (english i18n key — the layer translates). The
 * face flips into view mid-flight ALREADY in its true state.
 *
 * `card` is the LIVE model the landed slot renders from, and it belongs here
 * for exactly the same reason the dim does: the discount chip, the stored-
 * resource capsule and the disabled wash are all read off it, and the cost
 * chip's presence additionally re-insets the title (`--pcard-title-safe-l`),
 * so a model-less body also breaks the name's SIZE and line breaks.
 */
export type RevealVisual = {
  card?: CardModel,
  dim?: 'soft' | 'strong',
  chip?: string,
  /** The chip of a NAMED reason — the emblem and its compact counter (the slot's own, PL-479). */
  chipEmblem?: {emblem: string, text: string},
  /** The slot's mint «playable» thread — the copy lands as the RESTING slot paints, so the handoff changes no pixel (TR58). */
  playable?: boolean,
};

export const handRevealState = reactive({
  phase: 'docked' as HandRevealPhase,
  /** Album slots held empty (the bodies are the cards right now). */
  holdSlots: false,
  /**
   * THE ALBUM'S CHROME COMES IN THREE BEATS, NEVER ONE (PL-508 — the smoothness iteration after TR58). The open used
   * to lift the header, the status rail, the page edges and the dock spine in the SAME flush as the copies' handoff,
   * the cursor one frame later: three events in one beat. Now:
   *  · `held`  — pre-armed with the open (`phase: 'opening'`): nothing of the chrome paints;
   *  · `frame` — the copies took off: the album's FRAME (the header, the page edges) rises around the flight — it is
   *    never on a flight path (the cards land BELOW the header), so it frames them instead of covering them;
   *  · `all`   — the copies have handed over: the READING (the status rail — it names the card under the cursor — and
   *    the dock spine) comes WITH the cursor's arrival, its own beat after the handoff.
   * `all` is the resting value — every other path (a plain open, reduced motion, a close) paints the chrome as before.
   */
  chrome: 'all' as 'held' | 'frame' | 'all',
  /** A tag-FILTER episode is airborne — the status rail holds its text
   *  until the cards settle (the section's `--hold` class). */
  filterActive: false,
  /** The landed presentation per FLYING card (director-stamped at seize,
   *  cleared with the episode) — the layer binds it onto the face. */
  flightVisuals: {} as Record<string, RevealVisual>,
  /** THE DESTINATION'S ART TIER (perf iteration 3) — stamped by the hand
   *  section from its solved album plan, read by the bodies' faces so a
   *  flight decodes the same file its landing slot paints. */
  artTier: 'full' as 'full' | 'thumb',
  /**
   * THE TRANSITION CORE'S REVISION — stamped on the layer root as
   * `data-hand-reveal-rev` and named in the per-episode arm log. Exists to
   * kill the ONE debugging failure mode that cost this flow the most: a
   * stale served bundle looking exactly like «the fix changed nothing»
   * (the server caches chunks at startup; desktop builds ship their own).
   * Bump it whenever the episode architecture changes. 15 = the FACE-UP
   * ALBUM model (the whole spread — pages AND packets — is laid out
   * face-up: every open flight turns every card, a close seats packets at
   * their anchors and turns everything to the dock's presentation, filter
   * episodes never turn a card) + the dock presentation setting
   * («Рубашкой»/«Лицом», handDockPresentation.ts).
   */
  rev: 15,
  /**
   * THE STAGE WINDOW — the album's x-range, applied as a STATIC `clip-path`
   * on the whole layer for the album's lifetime. A packet-parked body is
   * erased/revealed by the boundary purely by WHERE IT IS — zero per-frame
   * style writes, magnets and reversals included. Set by the director at
   * episode start, kept through the open album (the packets stay parked
   * beyond it), cleared when the hand docks.
   */
  stageClip: undefined as {left: number, right: number} | undefined,
});

/** The album/episode is mid-flight — hosts gate confirm-inputs on this. */
export function handRevealBusy(): boolean {
  return handRevealState.phase === 'opening' || handRevealState.phase === 'closing';
}
