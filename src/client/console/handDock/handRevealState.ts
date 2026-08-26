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
};

export const handRevealState = reactive({
  phase: 'docked' as HandRevealPhase,
  /** Album slots held empty (the bodies are the cards right now). */
  holdSlots: false,
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
   * Bump it whenever the episode architecture changes. 14 = the
   * single-owner bodies rework (11) + the top-left transform-origin fix
   * (12) + the pose ride yielding to episodes (13) + the close's section
   * hook firing one tick late (the collapse parks between — synchronous,
   * it popped the hosted hand frame before the park).
   */
  rev: 14,
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
