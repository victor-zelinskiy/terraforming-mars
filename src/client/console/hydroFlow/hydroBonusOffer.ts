/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * THE CARD-GRANTED BONUS MOVE — the Hydronetwork workspace's prompt state.
 *
 * A card may hand the player a move on the track they did not ask for (Dynamic
 * Ocean Barrier, on every ocean they place). The offer arrives as an ordinary
 * `OrOptions` carrying the STRUCTURAL marker `deltaBonusPrompt` — which card,
 * where the marker stands, where it would land, and the server's own verdict on
 * what it costs. Nothing here reads an option title: i18n rewrites
 * `Message.message` in place, so a text match stops matching after the first
 * render (cross-cutting invariant 1).
 *
 * WHAT THIS MODULE OWNS, and why it is not in the component:
 *  - the DOOR's own half of the decision (is there an offer at all, and is the
 *    workspace already standing so it must be QUEUED rather than re-opened);
 *  - the WORKING-ZONE STATE, which is exhaustive and mutually exclusive by
 *    construction — the zone can never paint an offer over the cards of the
 *    placement that produced it, or over a reward still resolving;
 *  - the COPY, as i18n keys + params, so the four things the player must
 *    understand are stated once and are unit-testable without a DOM.
 *
 * PURE: no Vue, no DOM, no i18n import — it returns KEYS. That also lets its
 * spec run under the faster server runner.
 */
import type {DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import type {PlayerInputModel} from '@/common/models/PlayerInputModel';

/**
 * The offer carried by the CURRENT top-level prompt, or undefined. Structural:
 * the marker is set by `BonusDeltaAdvance` and by nothing else.
 */
export function hydroBonusOffer(waitingFor: PlayerInputModel | undefined): DeltaBonusPromptMeta | undefined {
  return waitingFor?.deltaBonusPrompt;
}

/**
 * THE WORKING ZONE'S STATE — the bottom of the Hydronetwork workspace, which in
 * other phases resolves the cards the track itself drew.
 *
 * Exhaustive and mutually exclusive: exactly one of these is true at a time, so
 * «the offer over the previous placement's cards» and «two competing CTAs» stop
 * being expressible rather than being guarded against.
 */
export type HydroZoneState =
  /** A card's bonus move is waiting for the player's decision. */
  | 'bonus-offer'
  /** The decision is submitted; the move's own beat is running. */
  | 'committing'
  /** The landed stage's reward is resolving through the standard flow. */
  | 'resolving'
  /** The ordinary browse/plan layer — nothing of the above. */
  | 'idle';

export type HydroZoneInput = {
  /** An offer is present AND admitted (the door let it through). */
  offerLive: boolean;
  /** The player answered; the commit record is standing. */
  committing: boolean;
  /** The landed stage's own follow-up is still live. */
  resolving: boolean;
};

/**
 * Resolution ORDER is the contract: what is already running outranks what is
 * merely offered. A second ocean's offer arriving mid-commit therefore waits
 * (it is queued on the server anyway, `BACK_OF_THE_LINE`) instead of painting
 * over the move in flight.
 */
export function hydroZoneState(input: HydroZoneInput): HydroZoneState {
  if (input.resolving) {
    return 'resolving';
  }
  if (input.committing) {
    return 'committing';
  }
  return input.offerLive ? 'bonus-offer' : 'idle';
}

/**
 * WHAT THE DOOR SHOULD DO with a live offer.
 *
 *  - `open`  — no Hydronetwork frame anywhere: bring the player to the track;
 *  - `queue` — the workspace is already standing (or parked, mid-resolution):
 *    the offer joins the flow it is already in and shows after the running
 *    rewards/inputs finish. Re-entering here would tear the workspace down and
 *    rebuild it, which is the flicker the whole barrier exists to remove;
 *  - `none`  — nothing to do.
 */
export type HydroDoorAction = 'open' | 'queue' | 'none';

export function hydroBonusDoorAction(input: {
  offerLive: boolean;
  /** A hydro frame exists in the live stack or in the park. */
  frameKnown: boolean;
}): HydroDoorAction {
  if (!input.offerLive) {
    return 'none';
  }
  return input.frameKnown ? 'queue' : 'open';
}

/** The zone's copy, as ENGLISH i18n KEYS (+ params). Never rendered raw. */
export type HydroBonusCopy = {
  /** Stage name handed UP to the workspace crumb — never drawn by the zone. */
  stageKey: string;
  titleKey: string;
  bodyKey: string;
  /** `${0}` in `bodyKey` — the granting card's name (translated by the caller). */
  bodyParams: ReadonlyArray<string>;
  confirmKey: string;
  skipKey: string;
};

/**
 * The four things the player must understand, in one place:
 * WHO granted it, WHY (an ocean was placed), that the generation's own advance
 * SURVIVES, and WHAT confirming does.
 */
export function hydroBonusCopy(meta: DeltaBonusPromptMeta): HydroBonusCopy {
  return meta.waivesTag ? {
    stageKey: 'BONUS STEP',
    titleKey: 'Bonus advance',
    bodyKey: 'The next stage is 1 required tag short. Spend 1 energy and take the bonus step? ${0} grants it for placing an ocean, and your usual advance this generation stays available.',
    bodyParams: [meta.source],
    confirmKey: 'Spend 1 energy and advance',
    skipKey: 'Skip',
  } : {
    stageKey: 'BONUS STEP',
    titleKey: 'Bonus advance',
    bodyKey: '${0} lets you advance 1 step on the Hydronetwork for free for placing an ocean. Your usual advance this generation stays available.',
    bodyParams: [meta.source],
    confirmKey: 'Advance for free',
    skipKey: 'Skip',
  };
}
