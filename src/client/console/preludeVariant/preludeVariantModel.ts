/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PRELUDE'S VARIANT, CHOSEN BEFORE THE PRESS (P44 Atmospheric Enhancers · ledger EQ) — the ONE pure model of the
 * «ВАРИАНТ» step every host of a prelude's play stands up: the start queue (the opening's deployment) and the
 * «ВЫБОР ПРОЛОГА» stage of a prelude played mid-game (WG Project; Karen / P45 by construction). A prelude whose play
 * preview carries more than one EXECUTABLE branch is a choice the player makes BEFORE the commit (the law «every choice
 * is made before the commit»): the rows are the preview's branches in the printed order, each with its own reading
 * (the parameter's `current → resulting`, the rating), a branch at its ceiling offered and SAID («на максимуме · ничего
 * не изменит»), a branch the rules refuse SHOWN with its reason; what every branch shares (P44's draw of 2 cards with a
 * floater icon) is read ONCE beside the rows, never repeated on each. The answer is ADDRESSED (`branch.for` — the
 * server's own exit pass stamps it), so it rides the press's batch and lands on the card's own `or`, never on an
 * interloper's.
 *
 * Pure: no DOM, no Vue, no translation — the hosts render keys.
 */
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {ActionEffect, ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {addressed} from '@/common/inputs/preselectAddress';

export type PreludeVariantRow = {
  key: string;
  /** Position in the preview's `branches` (the forecast's `byBranch` index too). */
  position: number;
  /** The server's RUNTIME index of the `or` answer (`ActionPreviewBranch.index`); −1 for a refused row. */
  branchIndex: number;
  title: string | Message;
  /** What THIS branch alone brings — the shared chips are the variant's, read once. */
  chips: ReadonlyArray<ActionEffect>;
  /** i18n KEY — the branch raises a scale already at its maximum: offered, and it says so. */
  notice?: string;
  available: boolean;
  /** Why the rules refuse it (an English i18n template) + its params — a refused row is SHOWN, never dropped. */
  reason?: string | Message;
  reasonParams?: ReadonlyArray<string>;
};

export type PreludeVariant = {
  card: CardName;
  rows: ReadonlyArray<PreludeVariantRow>;
  /** What every branch brings (the draw of a floater search) — read once, beside the rows. */
  shared: ReadonlyArray<ActionEffect>;
};

export const AT_MAXIMUM_NOTICE = 'At its maximum · changes nothing';

const GLOBAL_ICONS: ReadonlySet<string> = new Set(['temperature', 'oxygen', 'venus', 'oceans']);

function sameChip(a: ActionEffect, b: ActionEffect): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** A scale gain that moves nothing (the chip the preview clamps at the ceiling: «8 → 8»). */
function atCeiling(chip: ActionEffect): boolean {
  return chip.direction === 'gain' && GLOBAL_ICONS.has(chip.icon) && chip.amount > 0 &&
    chip.current !== undefined && chip.current === chip.resulting;
}

/**
 * The variant step of a prelude's play, or `undefined` when there is nothing to choose — no preview yet, a single
 * branch, or ONE executable branch (the server's `OrOptions.reduce` answers it — the exemption of invariant 3; the
 * other branches are still NAMED by the queue's reading line, `preludeVariantReading`).
 */
export function preludeVariantOf(card: CardName, preview: ActionPreview | undefined): PreludeVariant | undefined {
  const branches = preview?.branches ?? [];
  const executable = branches.filter((b) => b.available && b.index >= 0);
  if (branches.length < 2 || executable.length < 2) {
    return undefined;
  }
  // The RATING is the branch's own (a scale's steps pay it, and a maxed scale pays none) — never «shared», even when
  // every branch happens to pay the same: the rows keep one shape whatever the scales read.
  const shared = branches[0].effects.filter((chip) => chip.icon !== 'tr' && branches.every((b) => b.effects.some((e) => sameChip(e, chip))));
  const rows = branches.map((branch, position): PreludeVariantRow => {
    const chips = branch.effects.filter((chip) => !shared.some((s) => sameChip(s, chip)));
    const row: PreludeVariantRow = {
      key: 'v' + position,
      position,
      branchIndex: branch.available ? branch.index : -1,
      title: branch.title,
      chips,
      available: branch.available,
    };
    if (chips.some(atCeiling)) {
      row.notice = AT_MAXIMUM_NOTICE;
    }
    if (!branch.available) {
      row.reason = branch.unavailableReason ?? 'Not available right now';
      if (branch.unavailableReasonParams !== undefined) {
        row.reasonParams = branch.unavailableReasonParams;
      }
    }
    return row;
  });
  return {card, rows, shared};
}

/** The branch a row answers — the preview's own, for its address. */
function branchOf(preview: ActionPreview, row: PreludeVariantRow): ActionPreviewBranch | undefined {
  return preview.branches[row.position];
}

/**
 * The ADDRESSED answer of the chosen row — `{type: 'or', index, response: {type: 'option'}}` stamped with the branch's
 * address, riding the press's batch behind the pick that plays the prelude. `undefined` for a refused row.
 */
export function preludeVariantAnswer(preview: ActionPreview, row: PreludeVariantRow): InputResponse | undefined {
  if (!row.available || row.branchIndex < 0) {
    return undefined;
  }
  const branch = branchOf(preview, row);
  return addressed({type: 'or', index: row.branchIndex, response: {type: 'option'}}, branch?.for);
}

/** The first row the cursor stands on — the first the player can take. */
export function firstAvailableRow(variant: PreludeVariant): number {
  const i = variant.rows.findIndex((r) => r.available);
  return i < 0 ? 0 : i;
}

/** One d-pad step down the column — wraps, walks over nothing (a refused row is a stop: its reason is read there). */
export function stepVariantFocus(variant: PreludeVariant, focus: number, dir: 1 | -1): number {
  const n = variant.rows.length;
  return n === 0 ? 0 : (focus + dir + n) % n;
}

/**
 * THE QUEUE'S READING of a prelude with branches — the icon of each branch's parameter in the printed order, a
 * maxed one marked, so the queue says «a choice comes» before A (`[data-qcard-reading]`). Icons, never words: the
 * reading line renders them as the scale glyphs. Empty for a prelude with no branches to name.
 */
export function preludeVariantReading(preview: ActionPreview | undefined): ReadonlyArray<{icon: string, maxed: boolean}> {
  const branches = preview?.branches ?? [];
  if (branches.length < 2) {
    return [];
  }
  return branches.flatMap((b) => {
    const chip = b.effects.find((e) => e.direction === 'gain' && GLOBAL_ICONS.has(e.icon));
    return chip === undefined ? [] : [{icon: chip.icon, maxed: atCeiling(chip)}];
  });
}
