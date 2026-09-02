/**
 * DOCK INSPECTION — the HandDock's presentation seat while the Information
 * Workspace (Y) inspects a participant.
 *
 * The dock is the ONE physical representation of a hand in this console, so
 * while the player inspects a seat the dock softly BECOMES that seat's hand:
 *  - the viewer's own seat → the ordinary dock (this module answers
 *    `undefined` — the real pack, the real counter, nothing changes);
 *  - another human → a read-only CLOSED FAN + the exact public count
 *    (`cardsInHandNbr`). The fan NEVER consumes the private card list —
 *    everything it renders is derived from one integer, so a face, a name,
 *    a cost or a sort order is not expressible on any frame;
 *  - the MarsBot → the SAME closed-fan language over its ACTION DECK
 *    (`MarsBotModel.actionDeckSize`) — the deck it plays from and, empty,
 *    passes on (AutomaController's own rule). The count is the server's own
 *    field, never a parallel client counter.
 *
 * PURE: no Vue, no DOM — unit-tested under the server runner
 * (tests/console/dockInspection.spec.ts).
 */

import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {handDockPlan} from '@/client/console/consoleHandDock';
import {packProfileTuning} from '@/client/console/handDock/handBodies';

export type DockInspectionKind = 'human' | 'bot';

export type DockInspectionSeat = {
  kind: DockInspectionKind,
  color: Color,
  /** The EXACT public count. Human: the server's `cardsInHandNbr` (the one
   *  number an opponent is allowed to know). Bot: `actionDeckSize` — the
   *  authoritative play-deck counter (empty ⇒ the bot passes). */
  count: number,
};

/**
 * The inspected seat's dock presentation, or `undefined` for the ordinary
 * own-hand dock (the viewer's own seat — inspection changes NOTHING there).
 * The bot kind requires the live automa model (mirrors the workspace's own
 * `viewedKind`); a bot seat on a legacy save without one degrades to the
 * human presentation over its public hand count.
 */
export function dockInspectionFor(
  viewerColor: Color,
  seat: PublicPlayerModel,
  automa: MarsBotModel | undefined,
): DockInspectionSeat | undefined {
  if (seat.color === viewerColor) {
    return undefined;
  }
  if (seat.isMarsBot === true && automa !== undefined) {
    return {kind: 'bot', color: seat.color, count: automa.actionDeckSize};
  }
  return {kind: 'human', color: seat.color, count: seat.cardsInHandNbr};
}

/**
 * The closed fan SATURATES visually past this many sleeves — the fan is an
 * abstraction of density, not a 1:1 inventory (a 40-card hand must not cost
 * 40 DOM boxes), while the COUNTER always carries the exact number. 24 keeps
 * the 20 readable edges + a visible thickness band (handDockPlan's own
 * distinct/overflow split).
 */
export const INSPECTION_FAN_MAX = 24;

export type InspectionFanSlot = {
  /** X offset of the sleeve's centre from the tray axis, rem (pack-scale
   *  already applied — the value renders verbatim). */
  xRem: number,
  /** A dense-thickness sleeve (beyond the readable edges) — painted dim. */
  deep: boolean,
};

export type InspectionFan = {
  slots: ReadonlyArray<InspectionFanSlot>,
  /** Uniform tuck below the tray axis, rem (the compact pose's own sink —
   *  the guest hand sits exactly where the own pack sits when tucked). */
  sinkRem: number,
  /** Uniform pack scale (the compact «further away» read). */
  scale: number,
  cardWRem: number,
  cardHRem: number,
};

/**
 * The closed fan's geometry — handDockPlan slots posed with the COMPACT
 * pose's own knobs (flat arc, no tilt, profile-tuned sink/scale), so the
 * inspected hand occupies EXACTLY the tray the viewer's own tucked pack
 * occupies: the context switch reads as one physical object changing owner,
 * never as a new component arriving.
 */
export function inspectionFan(count: number, profile: string): InspectionFan {
  const tune = packProfileTuning(profile);
  const plan = handDockPlan(Math.min(Math.max(0, Math.floor(count)), INSPECTION_FAN_MAX));
  return {
    // The compact pose irons the arc flat (dy dropped) and folds the fan
    // tilt away; the pack-scale compacts dx about the tray axis.
    slots: plan.slots.map((s) => ({
      xRem: round2(s.dx * tune.baseSpread * tune.compactScale),
      deep: s.deep,
    })),
    sinkRem: tune.compactSink,
    scale: tune.compactScale,
    cardWRem: tune.cardW,
    cardHRem: tune.cardH,
  };
}

/** The dock's whole inspection prop — seat + solved fan, one object. */
export type DockInspectionView = DockInspectionSeat & {fan: InspectionFan};

export function buildDockInspectionView(seat: DockInspectionSeat, profile: string): DockInspectionView {
  return {...seat, fan: inspectionFan(seat.count, profile)};
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
