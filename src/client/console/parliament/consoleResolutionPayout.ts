/*
 * THE RESOLUTION PAYOUT BEAT (Turmoil Redux) — the physical half of an
 * enacted resolution's card-resource payout that the VIEWER directed
 * («Конкурс водоносных пластов»: 2 animals onto the card they just picked).
 *
 * One more client of the shared resource-transfer language, on the transport's
 * cinematic-gate contract (the patent sale's shape):
 *
 *   DETECT (pure) — against the AUTHORITATIVE response: the view that stood
 *     was the payout's own pick (a card pick whose `choiceContext` source is
 *     a resolution) and the response's phase record gained the viewer's
 *     `cardResource` outcome — the card, the resource and the amount are the
 *     SERVER's, never the client's guess. A refused answer records nothing,
 *     so nothing flies; a reload has no «before» with fewer outcomes, so
 *     nothing replays.
 *   RUN — HOLD the commit while ONE chip («+2 [animal]») leaves the stage's
 *     payout reading and lands on the chosen candidate's own stored-resource
 *     capsule in the SHARED picker (still on screen: the view has not been
 *     applied yet), the capsule ticking at the contact (`pickPayoutLanding`);
 *     a short read beat, then the view commits and the flow moves on (the
 *     winner's ocean, the next seat). Bounded by the transfer framework's own
 *     wave safety; never rejects; reduced motion releases at once.
 *
 * Nothing here knows the name «Aquifer Contest»: any resolution whose step
 * reports a `cardResource` outcome for a pick it raised gets the same beat.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  resetCardResourceLandings, runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';

export type ResolutionPayoutEvent = {
  /** The chosen card (a candidate of the pick that just closed). */
  card: CardName;
  /** The normalized card-resource icon key (`animal`, `microbe`, …). */
  resource: string;
  amount: number;
  /** The resolution that paid (catalog id) — for diagnostics and the landing scope. */
  resolution: string;
};

/**
 * THE SHARED PICKER'S LANDING TICK — the candidate a payout is flying INTO
 * adds what has landed on it to its displayed stored-resource count, at the
 * chip's own contact. Scoped to one flight (set on run, cleared when it
 * ends), so no stale landing can ever inflate an unrelated picker.
 */
export const pickPayoutLanding = reactive({
  card: undefined as string | undefined,
  landed: 0,
});

/** What the picker adds to `card`'s displayed stored-resource count right now. */
export function pickPayoutLandedOn(card: string): number {
  return pickPayoutLanding.card === card ? pickPayoutLanding.landed : 0;
}

/**
 * THE PICK THE PAYOUT LANDS ON (pure): a card-resource pick raised by a
 * resolution (the server's own markers — `choiceContext.source` and
 * `resourceGainPrompt`, never a title). Its answer is committed IN PLACE —
 * the chosen candidate stays where it is (picked), the others calm down — so
 * the payout chip has the card to land on; the generic hero departure would
 * carry the recipient off screen before its animals arrive.
 */
export function payoutPickLandsInPlace(wf: {type?: string, resourceGainPrompt?: unknown, choiceContext?: {source?: {kind?: string}}} | undefined): boolean {
  return wf?.type === 'card' && wf.resourceGainPrompt !== undefined && wf.choiceContext?.source?.kind === 'resolution';
}

/** The phase's outcome record the view carries for the phase `generation` (live, or completed within this response). */
function outcomesOf(view: PlayerViewModel | undefined, generation: number | undefined): ReadonlyArray<ParliamentEnactOutcomeModel> {
  const parl = view?.game.parliament;
  if (parl === undefined || generation === undefined) {
    return [];
  }
  if (parl.phase !== undefined && parl.phase.generation === generation) {
    return parl.phase.outcomes ?? [];
  }
  return parl.lastPhase?.generation === generation ? parl.lastPhase.outcomes ?? [] : [];
}

/**
 * DETECT (pure): the viewer's own card-resource payout this response
 * RECORDED, while the view that stood was that payout's pick. Undefined for
 * everything else (a refusal, another seat's payout, a reload, an ocean).
 */
export function detectResolutionPayout(before: PlayerViewModel | undefined, after: PlayerViewModel): ResolutionPayoutEvent | undefined {
  const wf = before?.waitingFor;
  const source = wf?.choiceContext?.source;
  if (wf === undefined || wf.type !== 'card' || source?.kind !== 'resolution' || source.resolution === undefined) {
    return undefined;
  }
  const generation = before?.game.parliament?.phase?.generation;
  const viewer = after.thisPlayer.color;
  const old = outcomesOf(before, generation);
  const fresh = outcomesOf(after, generation).find((o) =>
    o.player === viewer && o.kind === 'cardResource' && o.card !== undefined && (o.amount ?? 0) > 0 &&
    !old.some((p) => p.player === o.player && p.step === o.step));
  if (fresh === undefined || fresh.card === undefined || fresh.resource === undefined) {
    return undefined;
  }
  // The recipient must have been a candidate of the pick that stood — the chip lands on what the player saw.
  if (!wf.cards.some((c) => c.name === fresh.card)) {
    return undefined;
  }
  return {card: fresh.card, resource: cardResourceKey(String(fresh.resource)), amount: fresh.amount ?? 0, resolution: source.resolution};
}

/** The read beat after the touchdown: the capsule's tick registers before the surface leaves. */
const PAYOUT_READ_MS = 260;

/**
 * RUN — one chip from the stage's payout reading onto the chosen candidate.
 * Resolves after the touchdown + the read beat; never rejects. The landing
 * tick STAYS until the transport's post-commit half calls
 * `endResolutionPayout` — closed any earlier, the capsule would fall back to
 * its pre-payout count for the frames before the committed view removes the
 * picker (an «untick» right before the stage leaves).
 */
export async function runResolutionPayout(event: ResolutionPayoutEvent): Promise<void> {
  resetCardResourceLandings();
  pickPayoutLanding.card = event.card;
  pickPayoutLanding.landed = 0;
  // `runResourceTransfers` never rejects (its own wave safety releases every
  // touchdown), and the transport's abort battery closes the scope on a failure.
  await runResourceTransfers({
    specs: [{channel: 'card-resource', resource: event.resource, amount: event.amount, targetCard: event.card}],
    // Born where the player READ the amount: the stage's payout reading, else
    // the source dock's resolution face (a standalone host).
    source: {selectors: ['[data-parl-enact-yield] .con-iyield__out', '[data-parl-enact-yield]', '.con-task .con-src .pcard']},
    arrival: 'auto',
    // The chips land INSIDE the standing picker: a notification-only hold,
    // or the blocking one would retract the very surface they land on.
    inSurface: true,
    onArrive: (spec) => {
      pickPayoutLanding.landed += spec.amount;
    },
  });
  await new Promise<void>((resolve) => window.setTimeout(resolve, motionMs(PAYOUT_READ_MS)));
}

/** END (post-commit) / ABORT — the scope closes (the committed view carries the real count from here on). */
export function endResolutionPayout(): void {
  pickPayoutLanding.card = undefined;
  pickPayoutLanding.landed = 0;
}
