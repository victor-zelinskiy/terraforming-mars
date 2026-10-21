/*
 * THE SEAT CHIP'S INTAKE (T06 «ОБА КОНЦА ПОЛЁТА — ЖИВЫЕ», the owner's decision 6 = M1 «плашка-хвост», 2026-10-21).
 *
 * Another seat's gain off the field (a rival's city on a cell printing two steel, the data an adjacent city pays to a
 * rival's card) flew to a POINT 16 px under that seat's dot — into the air under the chip, a receiver with no body:
 * the players read it as «flew into nothing» or «flew into my rail and missed». The seat's chip is the rival's only
 * body on this screen, so it gets an INTAKE: a plaque hanging from the chip's lower edge, in the seat's tone, that
 * OPENS before the token is born (EXPECTING — a thin ring, the units it waits for, «…»), takes the token ON ITS NUMBER
 * (the delta-chip anchor law — the token lands on the ink that changes), TICKS on the touchdown (RECEIVED — «+2»),
 * stands for one read and folds back into the chip. One plaque per seat; one item per resource (several units of one
 * resource are one token with its sum — never a swarm); a later payout to the same seat extends the standing plaque.
 *
 * The module owns the STATE and the lifecycle on the animation clock (never a wall clock); `ConsoleStatusStrip`
 * renders it (absolute in the chip ribbon — the chip's width and the ribbon never move), the payout scenes call
 * `openSeatIntake` → fly to `seatIntakeEnd` → `acceptSeatIntake` on each touchdown.
 */
import {nextTick, reactive} from 'vue';
import {gsap} from 'gsap';
import {Color} from '@/common/Color';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ResourceTransferSpec, TransferEnd} from '@/client/console/resourceTransfer/resourceTransferModel';
import {transferEndVerdict} from '@/client/console/resourceTransfer/transferEndVisible';
import {probeTick} from '@/client/console/probeTick';

export type SeatIntakeItem = {
  /** The resource key of the token (`steel`, `data`, `megacredits`, …) — the icon the plaque prints. */
  resource: string;
  /** What the token(s) bring — the plaque's promise while it waits. */
  expected: number;
  /** What has touched down so far — the number it reads. */
  received: number;
};

export type SeatIntake = {
  seat: Color;
  items: Array<SeatIntakeItem>;
  /** `expecting` — a token is on its way (the thin ring); `received` — every unit has landed (the number reads). */
  phase: 'expecting' | 'received';
  /** Bumped on every change — the strip re-measures the chip under it. */
  seq: number;
};

/**
 * The longest the opening waits for the plaque to be PAINTED (its CSS entry — `.con-intake-enter-active`, 160 ms —
 * starts a frame after the mount) — then the tokens go anyway (on the chip). Waited on `probeTick` + the wall clock.
 */
export const INTAKE_PAINT_WAIT_MS = 700;
/** The received plaque stands for one read (ms @ motion scale 1) — then folds back into the chip. */
export const INTAKE_READ_MS = 1200;
/**
 * A plaque whose tokens never came (an aborted stage, a degraded scene that told nobody) folds by itself — every hold
 * of this console is bounded and this is no hold: a plaque that waits forever would be a receiver announcing nothing.
 */
export const INTAKE_SAFETY_MS = 6000;

export const statusIntakeState = reactive({
  intakes: [] as Array<SeatIntake>,
});

const folds = new Map<Color, gsap.core.Tween>();

/** PURE: the plaque's items with these specs merged in — one item per resource, the order of first arrival. */
export function mergeIntakeItems(items: ReadonlyArray<SeatIntakeItem>, specs: ReadonlyArray<Pick<ResourceTransferSpec, 'resource' | 'amount'>>): Array<SeatIntakeItem> {
  const out = items.map((item) => ({...item}));
  for (const spec of specs) {
    if (spec.amount <= 0) {
      continue;
    }
    const item = out.find((i) => i.resource === spec.resource);
    if (item === undefined) {
      out.push({resource: spec.resource, expected: spec.amount, received: 0});
    } else {
      item.expected += spec.amount;
    }
  }
  return out;
}

/** PURE: every promised unit has landed. */
export function intakeSettled(intake: Pick<SeatIntake, 'items'>): boolean {
  return intake.items.every((item) => item.received >= item.expected);
}

/** The plaque's number as the item reads it: «…» while nothing has landed, «+N» from the first touchdown on. */
export function intakeItemText(item: SeatIntakeItem): string {
  return item.received > 0 ? `+${item.received}` : '…';
}

function intakeOf(seat: Color): SeatIntake | undefined {
  return statusIntakeState.intakes.find((i) => i.seat === seat);
}

function cancelFold(seat: Color): void {
  folds.get(seat)?.kill();
  folds.delete(seat);
}

/**
 * OPEN (or extend) the seat's plaque for these tokens — EXPECTING. Resolves once the plaque's numbers are PAINTED
 * (`painted` — the verdict on `probeTick`, bounded on the wall clock), so the caller's run measures a painted receiver
 * and the token flies after the receiver announced itself. Never on the animation clock alone: GSAP's ticker stands
 * still with the compositor (a background window, a quiet screen) and a wait on it held a rival's payout forever.
 * Reduced motion opens nothing (the tokens are not flown there either) and resolves at once.
 */
export function openSeatIntake(seat: Color, specs: ReadonlyArray<Pick<ResourceTransferSpec, 'resource' | 'amount'>>): Promise<void> {
  if (consoleReducedMotionActive()) {
    return Promise.resolve();
  }
  cancelFold(seat);
  folds.set(seat, gsap.delayedCall(motionMs(INTAKE_SAFETY_MS) / 1000, () => foldSeatIntake(seat)));
  const standing = intakeOf(seat);
  if (standing !== undefined) {
    standing.items = mergeIntakeItems(standing.items, specs);
    standing.phase = 'expecting';
    standing.seq++;
    return Promise.resolve();
  }
  statusIntakeState.intakes = [...statusIntakeState.intakes, {seat, items: mergeIntakeItems([], specs), phase: 'expecting', seq: 0}];
  return painted(seat, specs);
}

/**
 * The plaque's numbers are PAINTED (the one verdict of a visible end — its entry transition starts a frame after the
 * mount, so the motion clock alone cannot promise it) — measured on `probeTick`, bounded by `INTAKE_PAINT_WAIT_MS`;
 * past the bound the tokens go anyway and land on the chip itself.
 */
async function painted(seat: Color, specs: ReadonlyArray<Pick<ResourceTransferSpec, 'resource' | 'amount'>>): Promise<void> {
  await nextTick();
  const deadline = performance.now() + motionMs(INTAKE_PAINT_WAIT_MS);
  const ready = () => specs.every((spec) => spec.amount <= 0 || seatIntakeEnd(seat, spec.resource) !== undefined);
  while (!ready() && performance.now() < deadline) {
    await new Promise<void>((resolve) => probeTick(() => resolve()));
  }
}

/**
 * A TOKEN TOUCHED DOWN on the plaque (or was degraded — its units arrive all the same): the item ticks by its amount;
 * once every promised unit has landed the plaque reads RECEIVED and folds after one read.
 */
export function acceptSeatIntake(seat: Color, spec: Pick<ResourceTransferSpec, 'resource' | 'amount'>): void {
  const intake = intakeOf(seat);
  if (intake === undefined) {
    return;
  }
  const item = intake.items.find((i) => i.resource === spec.resource);
  if (item !== undefined) {
    item.received = Math.min(item.expected, item.received + spec.amount);
  }
  intake.seq++;
  if (!intakeSettled(intake)) {
    return;
  }
  intake.phase = 'received';
  cancelFold(seat);
  folds.set(seat, gsap.delayedCall(motionMs(INTAKE_READ_MS) / 1000, () => foldSeatIntake(seat)));
}

/** Fold the seat's plaque back into its chip (the strip's leave transition plays it). */
export function foldSeatIntake(seat: Color): void {
  cancelFold(seat);
  statusIntakeState.intakes = statusIntakeState.intakes.filter((i) => i.seat !== seat);
}

/** Drop every plaque (a game switch, an abort of the remote stage). */
export function resetStatusIntakes(): void {
  for (const seat of [...folds.keys()]) {
    cancelFold(seat);
  }
  statusIntakeState.intakes = [];
}

/**
 * The plaque's NUMBER for a resource as an OBJECT end (the delta-chip anchor law — the token lands on the ink that
 * changes) — undefined while no plaque of that seat stands (the caller does not fly).
 */
export function seatIntakeEnd(seat: Color | undefined, resource: string): TransferEnd | undefined {
  if (typeof document === 'undefined' || seat === undefined) {
    return undefined;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(resource) : resource;
  const num = document.querySelector<HTMLElement>(`[data-intake-seat="${seat}"] [data-intake-resource="${esc}"] .con-status__intake-num`);
  // Only a PAINTED number is a landing (the visible-end verdict); a plaque still unfolding answers none — the caller's
  // run then lands on the chip itself, never on a receiver the player cannot see yet.
  return num !== null && transferEndVerdict(num).visible ? {el: num, fx: 0.5, fy: 0.5} : undefined;
}
