/*
 * @console-shared LIVE — console native stands on this file.
 *
 * X ON A SELF-TARGET INSPECTS THE REAL CARD.
 *
 * THE BUG THIS EXISTS TO REMOVE. The embedded target step gave every candidate
 * a `data-zoom-slot` and inspected it through the generic `slotZoomOrigin`. For
 * an ordinary candidate that is exactly right — the viewer lifts out of the
 * face the player is pointing at, and the slot is held empty behind it, so there
 * is one card on screen at every frame. For the SELF-TARGET it was wrong twice
 * over: the origin resolved to the little proxy chip (so the card rose out of a
 * text box, at a text box's aspect), and the slot held empty was that chip —
 * while the card the proxy NAMES stood untouched in the hero column. The player
 * saw two copies of one card, which is the one thing this whole surface is built
 * to prevent.
 *
 * THE FIX IS A REDIRECTION, NOT A SECOND MECHANISM. The proxy is not a card, so
 * it is not an origin; the hero card is, so it is. Everything downstream —
 * the FLIP entrance, `.con-zoom-hold` on the resolved slot's inner card (which
 * is what empties the origin from BEFORE the proxy's first painted frame until
 * AFTER it is gone), the browse re-target, the mirrored close flight — is the
 * console's one zoom choreography, unchanged and unbranched.
 *
 * IT NAMES NO HOST AND NO CARD. The hero is found by the `[data-ptsel-source]`
 * marker, which the play composer and the blue-action composer both publish on
 * whatever element actually holds their card. A third host publishes the marker
 * and inherits the behaviour; nothing here has to learn about it.
 */
import {slotZoomOrigin, ZoomOrigin} from '@/client/console/consoleCardZoom';

/** The hero-card marker both composers publish. One string, two consumers (this
 *  and the self-target connector), so the contract cannot drift. */
export const PLAYED_TARGET_SOURCE_SELECTOR = '[data-ptsel-source]';

/**
 * The target step's zoom origin: the candidate's own slot, EXCEPT for the card
 * that raised the prompt, which resolves to the hero it is already standing in.
 *
 * `getRoot` is the HOST's root, never `document` — a parked or `v-show`-hidden
 * second composer would otherwise shadow the live one with a zero-rect slot,
 * and `usableRect` would silently degrade the entrance to the textual rise.
 */
export function playedTargetZoomOrigin(
  getRoot: () => HTMLElement | null | undefined,
  keyOf: (index: number) => string,
  sourceCardName: string,
  onBrowse?: (index: number) => void,
): ZoomOrigin {
  // ORDINARY candidates resolve inside the STEP, never merely inside the host:
  // the action composer's hero wrap carries `data-zoom-slot` of its own and
  // stands BEFORE the step in document order, so a host-wide query would prefer
  // it. Harmless while the acting card IS the source — and wrong the moment the
  // two diverge (a Viron repeat re-points the hero to the inner action's card
  // while the outer one is still an ordinary candidate).
  const slots = slotZoomOrigin(() => getRoot()?.querySelector<HTMLElement>('.con-ptsel'), keyOf, onBrowse);
  return {
    // DELEGATION IS TOTAL apart from the one redirection: this wrapper accepts
    // and forwards everything `slotZoomOrigin` does, so a later host that wants
    // LB/RB browse re-targeting gets it here instead of finding a parameter
    // that looks supported and silently does nothing.
    ...slots,
    resolve: (index: number) => {
      const root = getRoot();
      if (root === null || root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      if (sourceCardName !== '' && keyOf(index) === sourceCardName) {
        return root.querySelector<HTMLElement>(PLAYED_TARGET_SOURCE_SELECTOR);
      }
      return slots.resolve?.(index) ?? null;
    },
  };
}
