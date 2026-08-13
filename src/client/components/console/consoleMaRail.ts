/**
 * THE MILESTONES/AWARDS STATUS RAIL — the PURE view-model of the workspace's
 * one projected-transaction line.
 *
 * Both states of the workspace ask the same question in the same language:
 * «what happens to ME if I take this, and if I cannot — why». So the list's
 * context strip and the detail stage's bottom band render the SAME model, in
 * the SAME `current → resulting` chips every other console surface speaks
 * (`ActionEffectChip` over `ActionEffect` — the standard-projects rail, the
 * card-play preview and the blue-action composer are the precedents).
 *
 * The rules this file exists to keep:
 *  · the projected transaction lives in ONE place — the rail. The header
 *    carries only the PRICE (what the thing costs), never a wallet delta:
 *    a price is not a projection, and one action must read as one statement.
 *  · a BLOCKED item never renders a success preview. Money is the one blocker
 *    the shared chip states natively (`current < amount` → «have / need»), so
 *    it keeps its chip; every other blocker is a sentence, and it is the ONLY
 *    thing the rail says.
 *  · the slot economics ride the same chip grammar (`1 → 2` with the category
 *    label as the note) instead of a bespoke «останется свободных слотов: N».
 */
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {ConsoleMaItem, ConsoleMaKind} from '@/client/components/console/consoleMaModel';

export type MaRailTone = 'projected' | 'blocked' | 'owner' | 'none';

export type MaRailView = {
  tone: MaRailTone,
  /** The projected transaction (empty for a blocked-by-rule / owned item). */
  chips: ReadonlyArray<ActionEffect>,
  /** The ONE sentence: the concrete blocker, or the owner's name. '' = none. */
  message: string,
  /** `${0}`-slots for `message` (the threshold gap, the owner). */
  messageParams?: ReadonlyArray<string>,
};

export type MaRailInput = {
  item: ConsoleMaItem | undefined,
  kind: ConsoleMaKind,
  /** The LIVE price of this action (the engine's own, never a UI constant). */
  cost: number,
  /** Vitor's free sponsorship — the action charges nothing. */
  free: boolean,
  myMegacredits: number,
  /** How many slots of the category are already taken (the header's tally). */
  takenCount: number,
  maxSlots: number,
};

const EMPTY: MaRailView = {tone: 'none', chips: [], message: ''};

/**
 * The M€ chip. A cost the player can afford reads `462 → 454`; one they cannot
 * reads «6 / 8» in the shared insufficient style — the same chip, the same
 * component, no bespoke shortfall widget. A FREE action has no money chip at
 * all: «−0 → the same number» is noise pretending to be a transaction.
 */
function moneyChip(input: MaRailInput): ActionEffect | undefined {
  if (input.free || input.cost <= 0) {
    return undefined;
  }
  return {
    direction: 'cost',
    icon: 'megacredits',
    amount: input.cost,
    current: input.myMegacredits,
    resulting: input.myMegacredits - input.cost,
  };
}

/** The slot economics — the category's own counter moving by one. */
function slotChip(input: MaRailInput): ActionEffect {
  return {
    direction: 'gain',
    icon: '',
    amount: 1,
    current: input.takenCount,
    resulting: Math.min(input.maxSlots, input.takenCount + 1),
    note: input.kind === 'milestones' ? 'Claimed' : 'Funded',
  };
}

export function buildMaRail(input: MaRailInput): MaRailView {
  const item = input.item;
  if (item === undefined) {
    return EMPTY;
  }
  // TAKEN — the race is over for this one. Who owns it is the whole message.
  if (item.takenBy !== undefined) {
    return {
      tone: 'owner',
      chips: [],
      message: item.kind === 'milestone' ? 'Claimed by ${0}' : 'Funded by ${0}',
      messageParams: [item.takenBy.name],
    };
  }
  if (item.available) {
    const money = moneyChip(input);
    return {
      tone: 'projected',
      chips: money === undefined ? [slotChip(input)] : [money, slotChip(input)],
      // The free sponsorship is the one projection with something to SAY: the
      // absent money chip would otherwise read as an oversight.
      message: input.free ? 'Free sponsorship' : '',
    };
  }
  // BLOCKED. Money is the blocker the chip itself states best (it names both
  // numbers); everything else is a sentence, and then the rail says only that.
  const short = !input.free && input.cost > input.myMegacredits;
  if (short) {
    return {
      tone: 'blocked',
      chips: [{
        direction: 'cost',
        icon: 'megacredits',
        amount: input.cost,
        current: input.myMegacredits,
      }],
      message: '',
    };
  }
  // A milestone merely short of its threshold has no `blocker` by design (the
  // progress explains it), so the rail states the GAP — the quantitative fact,
  // never a second «this cannot be claimed» that adds nothing.
  if (item.blocker === '' && item.kind === 'milestone' &&
      item.threshold !== undefined && !item.myReady) {
    return {
      tone: 'blocked',
      chips: [],
      message: 'To the threshold: ${0}',
      messageParams: [String(Math.max(0, item.threshold - item.myScore))],
    };
  }
  return {
    tone: 'blocked',
    chips: [],
    message: item.blocker !== '' ? item.blocker : 'Unavailable right now',
  };
}

/** Chip identity for the rail's crossfade — what makes two chips the SAME
 *  statement across a focus change (the M€ chip stays put while the slot chip
 *  beside it swaps its label between the two categories). */
export function maRailChipKey(e: ActionEffect): string {
  return `${e.direction}:${e.icon}:${e.note ?? ''}`;
}
