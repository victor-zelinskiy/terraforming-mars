/*
 * THE RESOLUTION PAYOUT BEAT (Turmoil Redux) — the physical half of an
 * enacted resolution's card-resource payout that the VIEWER directed
 * («Конкурс водоносных пластов»: 2 animals onto the card they just picked;
 * «Освоение облаков»: 3 floaters laid out over two of their cards).
 *
 * One more client of the shared resource-transfer language, on the transport's
 * cinematic-gate contract (the patent sale's shape):
 *
 *   DETECT (pure) — against the AUTHORITATIVE response: the view that stood
 *     was the payout's own ask (a card pick, or the shared distribution's
 *     marked `and`, whose `choiceContext` source is a resolution) and the
 *     response's phase record gained the viewer's `cardResource` outcome —
 *     the cards, the resource and the amounts are the SERVER's list, never
 *     the client's guess. A refused answer records nothing, so nothing
 *     flies; a reload has no «before» with fewer outcomes, so nothing replays.
 *   RUN — HOLD the commit while ONE chip PER RECIPIENT («+2 [animal]»,
 *     «+1 [floater]») leaves the carrier card's own printed icon and lands on
 *     that candidate's stored-resource capsule in the SHARED picker (still on
 *     screen: the view has not been applied yet), the capsule ticking at the
 *     contact (`pickPayoutLanding`) — the recipients IN TURN, one after
 *     another (the transfer framework staggers a wave); a short read beat,
 *     then the view commits and the flow moves on (the winner's ocean, the
 *     next seat). Bounded by the transfer framework's own wave safety; never
 *     rejects; reduced motion releases at once.
 *
 * Nothing here knows the name of a resolution: any resolution whose step
 * reports a `cardResource` outcome for an ask it raised gets the same beat,
 * and a record that names ONE card is the list of one.
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {AndOptionsModel, PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {scheduleParliamentBeat} from '@/client/console/parliament/parliamentBeat';
import {cardResourceKey, ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  resetCardResourceLandings, runResourceTransfers,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {resolveActionCommitAnchors, resolveGainIconOrigins} from '@/client/console/consoleActionCommitMotion';

/** The ONE enacted-card instance on screen (the stage's hero while carried, the government otherwise). */
export function enactedCardEl(): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return document.querySelector<HTMLElement>('[data-parl-sit-hero] .con-parl__gov-card') ??
    document.querySelector<HTMLElement>('.con-parl [data-parl-gov-carry] .con-parl__gov-card') ?? undefined;
}

/** The printed icon of `spec`'s unit on the carrier card, as a birth point — undefined when the card (or the icon) is not on screen. */
export function carrierIconOrigin(spec: ResourceTransferSpec): TransferPoint | undefined {
  const card = enactedCardEl();
  if (card === undefined) {
    return undefined;
  }
  return resolveGainIconOrigins(resolveActionCommitAnchors(card, undefined), [spec])[0];
}

/** ONE recipient of the payout, as the server recorded it. */
export type ResolutionPayoutTarget = {card: CardName, amount: number};

export type ResolutionPayoutEvent = {
  /** WHERE it landed, card by card, in the record's order (one recipient is the list of one). */
  targets: ReadonlyArray<ResolutionPayoutTarget>;
  /** The normalized card-resource icon key (`animal`, `microbe`, `floater`, …). */
  resource: string;
  /** The whole amount paid (the sum of the targets). */
  amount: number;
  /** The resolution that paid (catalog id) — for diagnostics and the landing scope. */
  resolution: string;
};

/**
 * THE SHARED PICKER'S LANDING TICK — a candidate a payout is flying INTO
 * adds what has landed on it to its displayed stored-resource count, at the
 * chip's own contact — per card, because a distribution lands on several.
 * Scoped to one flight (set on run, cleared when it ends), so no stale
 * landing can ever inflate an unrelated picker.
 */
export const pickPayoutLanding = reactive({
  /** What has landed on each card of the flight so far. */
  landed: {} as Record<string, number>,
});

/** What the picker adds to `card`'s displayed stored-resource count right now. */
export function pickPayoutLandedOn(card: string): number {
  return pickPayoutLanding.landed[card] ?? 0;
}

/**
 * THE ASK THE PAYOUT LANDS ON (pure): a card-resource ask raised by a
 * resolution — the family's card pick (`resourceGainPrompt`) or the shared
 * distribution's marked `and` (`cardResourceDistributionPrompt`); the
 * server's own markers, never a title. Its answer is committed IN PLACE —
 * the chosen candidates stay where they are, the others calm down — so the
 * payout chips have their cards to land on; the generic hero departure would
 * carry a recipient off screen before its resources arrive.
 */
export function payoutPickLandsInPlace(wf: {type?: string, resourceGainPrompt?: unknown, cardResourceDistributionPrompt?: unknown, choiceContext?: {source?: {kind?: string}}} | undefined): boolean {
  if (wf === undefined || wf.choiceContext?.source?.kind !== 'resolution') {
    return false;
  }
  return (wf.type === 'card' && wf.resourceGainPrompt !== undefined) || (wf.type === 'and' && wf.cardResourceDistributionPrompt !== undefined);
}

/** The candidates the ask that stood offered — the cards a payout may land on. */
function candidatesOf(wf: PlayerInputModel): ReadonlyArray<CardName> {
  if (wf.type === 'card') {
    return (wf as SelectCardModel).cards.map((c) => c.name);
  }
  if (wf.type === 'and') {
    return ((wf as AndOptionsModel).cardResourceDistributionPrompt?.cards ?? []).map((c) => c.name);
  }
  return [];
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

/** The record's recipients — its list, or its one card as the list of one. */
function targetsOf(outcome: ParliamentEnactOutcomeModel): Array<ResolutionPayoutTarget> {
  if (outcome.cards !== undefined && outcome.cards.length > 0) {
    return outcome.cards.filter((t) => t.amount > 0).map((t) => ({card: t.card, amount: t.amount}));
  }
  return outcome.card !== undefined && (outcome.amount ?? 0) > 0 ? [{card: outcome.card, amount: outcome.amount ?? 0}] : [];
}

/**
 * DETECT (pure): the viewer's own card-resource payout this response
 * RECORDED, while the view that stood was that payout's ask. Undefined for
 * everything else (a refusal, another seat's payout, a reload, an ocean).
 */
export function detectResolutionPayout(before: PlayerViewModel | undefined, after: PlayerViewModel): ResolutionPayoutEvent | undefined {
  const wf = before?.waitingFor;
  const source = wf?.choiceContext?.source;
  if (wf === undefined || !payoutPickLandsInPlace(wf) || source?.kind !== 'resolution' || source.resolution === undefined) {
    return undefined;
  }
  const generation = before?.game.parliament?.phase?.generation;
  const viewer = after.thisPlayer.color;
  const old = outcomesOf(before, generation);
  const fresh = outcomesOf(after, generation).find((o) =>
    o.player === viewer && o.kind === 'cardResource' && (o.amount ?? 0) > 0 && targetsOf(o).length > 0 &&
    !old.some((p) => p.player === o.player && p.step === o.step));
  if (fresh === undefined || fresh.resource === undefined) {
    return undefined;
  }
  // Every recipient must have been a candidate of the ask that stood — the chips land on what the player saw.
  const candidates = candidatesOf(wf);
  const targets = targetsOf(fresh);
  if (targets.some((t) => !candidates.includes(t.card))) {
    return undefined;
  }
  return {targets, resource: cardResourceKey(String(fresh.resource)), amount: fresh.amount ?? 0, resolution: source.resolution};
}

/** The read beat after the touchdown: the capsule's tick registers before the surface leaves. */
const PAYOUT_READ_MS = 260;

/**
 * RUN — one chip per recipient, from the carrier card's icon onto that
 * candidate, in the record's order. Resolves after the last touchdown + the
 * read beat; never rejects. The landing ticks STAY until the transport's
 * post-commit half calls `endResolutionPayout` — closed any earlier, the
 * capsules would fall back to their pre-payout counts for the frames before
 * the committed view removes the picker (an «untick» right before the stage
 * leaves).
 */
export async function runResolutionPayout(event: ResolutionPayoutEvent): Promise<void> {
  resetCardResourceLandings();
  pickPayoutLanding.landed = {};
  // `runResourceTransfers` never rejects (its own wave safety releases every
  // touchdown), and the transport's abort battery closes the scope on a failure.
  const specs: Array<ResourceTransferSpec> = event.targets.map((t) => ({channel: 'card-resource', resource: event.resource, amount: t.amount, targetCard: t.card}));
  await runResourceTransfers({
    specs,
    // Born on the CARRIER CARD's own printed icon (the address table: a card
    // resource leaves the resolution's graphic — `resolveGainIconOrigins`
    // over the one enacted-card instance, on the stage's hero or in the
    // government), else where the player READ the amount (the stage's payout
    // reading), else the source dock's face (a standalone host).
    origins: specs.map((spec) => carrierIconOrigin(spec)),
    source: {selectors: ['[data-parl-sit-yield] .con-iyield__out', '[data-parl-sit-yield]', '.con-task .con-src .pcard']},
    arrival: 'auto',
    // The chips land INSIDE the standing picker: a notification-only hold,
    // or the blocking one would retract the very surface they land on.
    inSurface: true,
    onArrive: (spec) => {
      if (spec.targetCard !== undefined) {
        pickPayoutLanding.landed = {...pickPayoutLanding.landed, [spec.targetCard]: (pickPayoutLanding.landed[spec.targetCard] ?? 0) + spec.amount};
      }
    },
  });
  // The READ beat rides the motion clock (`parliamentBeat.ts`) — never a wall-clock timer.
  await new Promise<void>((resolve) => scheduleParliamentBeat(PAYOUT_READ_MS, resolve));
}

/** END (post-commit) / ABORT — the scope closes (the committed view carries the real counts from here on). */
export function endResolutionPayout(): void {
  pickPayoutLanding.landed = {};
}
