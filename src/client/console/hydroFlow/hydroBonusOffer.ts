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
import type {DeltaAdvanceOffer, DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import type {PlayerInputModel} from '@/common/models/PlayerInputModel';
import type {HydroStage} from '@/client/components/hydronetwork/hydroStages';
import type {TaskKind} from '@/client/console/consoleTaskRouter';

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

/**
 * WHAT A COMMITTED BONUS MOVE STILL OWES — the workspace's serving contract for
 * the stage it lands on.
 *
 * THE STANDARD ADVANCE PRE-COLLECTS its landing stage's follow-up (the
 * position-7 repeat is composed in the action browser before the batch leaves).
 * A BONUS MOVE CANNOT: the offer arrives already framed by the server as a
 * two-option question, so everything past «take it» is asked afterwards, as an
 * ordinary follow-up prompt. That is not a degradation — it is the same
 * contract the workspace already honours for the standard move's own
 * consequences — but it only reads that way if the follow-up EMBEDS. A prompt
 * the frame does not serve rises as a band OVER the workspace that caused it:
 * one press, two surfaces, the reported «модалка поверх Гидросети».
 *
 * Keyed on the stage's own `followUp` (the same table the rail and the reward
 * view read), never on a position literal — a re-numbered track cannot make
 * this silently wrong.
 */
export type HydroBonusAdvancePlan = {
  /** Prompt kinds the hydro frame must serve while the landed stage resolves. */
  serves: ReadonlyArray<TaskKind>;
  /** The landed stage DRAWS a batch the player picks from (pos 5) — the
   *  workspace claims it so the pick is a stage of this flow, not a new demand. */
  claimsDraw: boolean;
  /** How many cards that batch holds (the claim's expected count). */
  drawCount: number;
};

/** Every input the repeated action of position 7 can itself raise. Identical to
 *  what `submitHydroAdvance` serves for a COMPOSED repeat — the two paths reach
 *  the same server code, so they may not advertise different contracts. */
const REPEAT_SERVES: ReadonlyArray<TaskKind> =
  ['deckSelect', 'cardSelect', 'payment', 'choice', 'amount', 'resource', 'player'];

export function hydroBonusAdvancePlan(stage: HydroStage | undefined): HydroBonusAdvancePlan {
  switch (stage?.followUp) {
  case 'draw':
    // «Гидромоделирование»: look at 4, keep 2 — the embedded deck pick.
    return {serves: ['deckSelect'], claimsDraw: true, drawCount: 4};
  case 'reuse-action':
    return {serves: REPEAT_SERVES, claimsDraw: false, drawCount: 0};
  case 'add-animals':
    // The target card is asked by the server (the bonus offer had no room to
    // pre-select it) — the pick belongs inside this workspace.
    return {serves: ['cardSelect'], claimsDraw: false, drawCount: 0};
  default:
    return {serves: [], claimsDraw: false, drawCount: 0};
  }
}

/**
 * HOW THE PLAYER GOT HERE — the ONE thing that differs between the two ways a
 * card puts a move on this track, and therefore the only axis the zone branches
 * on.
 *
 *  · `prompt`     — the server ASKED (Dynamic Ocean Barrier's ocean grant). An
 *                   `OrOptions` is standing, so the refusal is an OPTION the
 *                   player focuses and confirms, exactly like every other
 *                   refusal in this console.
 *  · `card-entry` — the player CHOSE this move inside a card's own action
 *                   (Storm Surge Barrier). Nothing is on the wire: the whole
 *                   step is a pre-commit draft, so there is nothing to decline —
 *                   B walks back to the card's variant selector and spends
 *                   nothing. Offering «Пропустить» here would answer a question
 *                   nobody asked and read as a mandatory effect.
 */
export type DeltaOfferOrigin = 'prompt' | 'card-entry';

/**
 * THE NEXT REQUIRED INTERACTION of a track move — the ONE thing the primary
 * CTA is named after, whatever door the move came through. The parity law of
 * the workspace: a source card changes CONTEXT (the card, the explanation,
 * the price, an optional refusal), never the DECISION LANGUAGE — so a move
 * with an unresolved stage choice asks «Выберите награду» from every door,
 * and a ready move commits as «Укрепить гидросеть» from every door.
 * «Продвинуться» as a source-only final verb is the fork this retires.
 */
export type HydroNextInteraction = 'choose-reward' | 'reinforce';

export function hydroNextInteraction(input: {needsChoice: boolean, choiceMade: boolean}): HydroNextInteraction {
  return input.needsChoice && !input.choiceMade ? 'choose-reward' : 'reinforce';
}

/** The primary CTA's label KEY per interaction — one vocabulary, every flow. */
export const HYDRO_PRIMARY_KEY: Readonly<Record<HydroNextInteraction, string>> = {
  'choose-reward': 'Choose a reward',
  'reinforce': 'Reinforce the hydronetwork',
};

/** The zone's copy, as ENGLISH i18n KEYS (+ params). Never rendered raw.
 *  (The primary CTA is NOT here: it is named by {@link hydroNextInteraction}
 *  — the source explains itself, it never renames the decision.) */
export type HydroBonusCopy = {
  /** Stage name handed UP to the workspace crumb — never drawn by the zone. */
  stageKey: string;
  titleKey: string;
  bodyKey: string;
  /** `${0}` in `bodyKey` — the granting card's name (translated by the caller). */
  bodyParams: ReadonlyArray<string>;
  /** The REFUSAL option, or '' when there is none to offer (`card-entry`). */
  skipKey: string;
};

/**
 * The four things the player must understand, in one place:
 * WHO granted it, WHY, that the generation's own advance SURVIVES, and WHAT
 * confirming does.
 *
 * THE VERB IS THE VERB, and only the verb, in every shape. The price is stated
 * by the workspace's own «Будет потрачено» delta row, in the SAME «сейчас →
 * станет» grammar the plan panel uses — never folded into the button, which is
 * echoed into the ONE command bar where a 34-character label crowded out
 * «X Осмотреть» and «B Свернуть» and then truncated itself. Identical for all
 * three shapes: a card's advance must not read differently from an ordinary one.
 */
export function hydroAdvanceCopy(offer: DeltaAdvanceOffer, origin: DeltaOfferOrigin): HydroBonusCopy {
  if (origin === 'card-entry') {
    return {
      // ONE WORD, and it names the SUBDIVISION the player walked into — the
      // crumb reads «ДЕЙСТВИЯ КАРТ › <карта> › ГИДРОСЕТЬ», so the tail says
      // WHERE they are, which is the only thing that changed. (It used to say
      // «ПРОДВИЖЕНИЕ», which describes the act rather than the place, and the
      // act is what the CTA already says.)
      stageKey: 'Hydronetwork',
      titleKey: 'Extra advance',
      bodyKey: '${0} lets you spend 1 energy and advance 1 step on the Hydronetwork. Your usual advance this generation stays available.',
      bodyParams: [offer.source],
      skipKey: '',
    };
  }
  return offer.waivesTag ? {
    stageKey: 'BONUS STEP',
    titleKey: 'Bonus advance',
    bodyKey: 'The next stage is 1 required tag short. Spend 1 energy and take the bonus step? ${0} grants it for placing an ocean, and your usual advance this generation stays available.',
    bodyParams: [offer.source],
    skipKey: 'Skip',
  } : {
    stageKey: 'BONUS STEP',
    titleKey: 'Bonus advance',
    bodyKey: '${0} lets you advance 1 step on the Hydronetwork for free for placing an ocean. Your usual advance this generation stays available.',
    bodyParams: [offer.source],
    skipKey: 'Skip',
  };
}

/** The standing-prompt shape (the historical signature, unchanged for callers
 *  that only ever see a server offer). */
export function hydroBonusCopy(meta: DeltaBonusPromptMeta): HydroBonusCopy {
  return hydroAdvanceCopy(meta, 'prompt');
}
