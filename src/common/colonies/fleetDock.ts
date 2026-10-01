/**
 * FLEET DOCK — the words both sides share (the server's refusal and the
 * client's reading of the PUBLIC state must be one sentence).
 *
 * A fleet dock is a card that is a destination of its owner's trade action
 * (`server/colonies/FleetDock.ts`). One fleet per generation stands on it;
 * while it does, the dock is not a destination.
 */

/** The shared blocker: one fleet per generation stands on the card (an English i18n key). */
export const FLEET_DOCK_BUSY_REASON = 'The trade fleet is already on this card this generation';
