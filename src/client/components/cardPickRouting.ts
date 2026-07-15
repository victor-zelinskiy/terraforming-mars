/**
 * @deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
 * All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
 * desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
 * here cannot affect console. Fix only what breaks the shared layer or play.
 * See DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
 */
import {CardName} from '@/common/cards/CardName';
import {PLAYED_PICK_OVERLAY_THRESHOLD} from '@/client/components/playedCards/playedCardsPickState';

/**
 * The SURFACE that hosts a card-target pick inside the play / action-confirm modal:
 *  - `'hand'`   → the КАРТЫ В РУКЕ overlay in client-pick mode (candidates are HAND cards);
 *  - `'board'`  → the РАЗЫГРАНО board in pick mode (candidates are PLAYED / tableau cards);
 *  - `'inline'` → a compact `ActionTargetCard` row right in the modal.
 */
export type CardPickSurface = 'hand' | 'board' | 'inline';

/**
 * Decide which surface a card-target pick uses — the SINGLE source of truth shared
 * by both modals (play + action) for BOTH the branch's optionInput and its steps, so
 * the logic is uniform and clearly correct.
 *
 * Two orthogonal questions:
 *  1. ROOMY or inline? A roomy surface (hand overlay / played board) is used when the
 *     inline tile grid would be cramped — MORE THAN `PLAYED_PICK_OVERLAY_THRESHOLD`
 *     (3) candidates, OR a MULTI-card pick (`multiCard` — ≥2 card picks in one modal:
 *     two inline grids don't fit, they collapse to vertical columns). A ≤3 single-card
 *     pick stays inline as a centred ROW of tiles.
 *  2. WHICH roomy surface? Follow the candidate OWNERSHIP: every candidate in the
 *     viewer's HAND → the КАРТЫ В РУКЕ overlay; every candidate on the viewer's
 *     TABLEAU → the РАЗЫГРАНО board. MIXED owners (rare) fall back to inline — no single
 *     roomy surface owns them.
 *
 * `candidates` is the FULL shown set (selectable + disabled), since the inline grid and
 * both overlays render all of them.
 */
export function cardPickSurface(
  candidates: ReadonlyArray<{name: CardName}>,
  hand: ReadonlySet<CardName>,
  tableau: ReadonlySet<CardName>,
  multiCard: boolean,
): CardPickSurface {
  if (candidates.length === 0) {
    return 'inline';
  }
  const roomy = candidates.length > PLAYED_PICK_OVERLAY_THRESHOLD || multiCard;
  if (!roomy) {
    return 'inline';
  }
  if (candidates.every((c) => hand.has(c.name))) {
    return 'hand';
  }
  if (candidates.every((c) => tableau.has(c.name))) {
    return 'board';
  }
  return 'inline';
}
