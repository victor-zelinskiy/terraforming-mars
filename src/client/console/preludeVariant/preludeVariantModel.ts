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
 * …AND ITS RESOURCE (P50 Focused Organization · ledger FC — the law generalised to a PRE-STEP: a variant OR a
 * resource). A prelude whose ONE branch asks «a standard resource of your choice» (the declarative `standardResource`
 * the preview pre-collects as a `resource` step — `withGainAmount`, role `resource`) is chosen before the press on the
 * SAME three hosts, through the SAME step: the rows are the lanes the server offers, each «+N [resource]»; the rest of
 * the play (P50's card) is read once as the shared chips; the answer is the step's own `{type: 'resource', resource}`
 * ADDRESSED by its `for`, riding the press's batch — the live palette never stands for it. The kind is `resource` and
 * the hosts' crumb reads «› РЕСУРС» (`preludePreStepStage`).
 *
 * Pure: no DOM, no Vue, no translation — the hosts render keys.
 */
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {ActionEffect, ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {addressed} from '@/common/inputs/preselectAddress';
import {OrOptionsModel, PlacementOrderPromptMeta, PlayerInputModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {TileType} from '@/common/TileType';
import {CardComponent} from '@/common/cards/render/CardComponent';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {isICardRenderItem, ItemType} from '@/common/cards/render/Types';
import {buildMechanics} from '@/client/components/premiumCard/mechanicsModel';

export type PreludeVariantRow = {
  key: string;
  /** Position in the preview's `branches` (the forecast's `byBranch` index too). */
  position: number;
  /**
   * The row's identity for a host's «which row was chosen» — the branch position of a variant, the row's own index of a
   * resource step (its six rows share ONE branch).
   */
  choice: number;
  /** A RESOURCE row (P50 · FC): the lane it answers and the branch step it answers at. */
  resource?: string;
  stepIndex?: number;
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
  /** A PLACEMENT-ORDER row (P58 · FS): the tile it places, and the card's own printed hex of it (its face's node). */
  tileType?: TileType;
  print?: ReadonlyArray<ItemType>;
  /** Placed already — the row is SEALED in place (a kant and a mark, never removed: the column never reflows). */
  sealed?: boolean;
};

export type PreludeVariant = {
  card: CardName;
  /**
   * `variant` — the branches (P44); `resource` — one branch's «?» (P50); `placement-order` — the LIVE «which tile
   * next» of a card that places several in the player's order (P58 · FS), asked between its placements.
   */
  kind: 'variant' | 'resource' | 'placement-order';
  /** A placement-order step's place in the play — «2 / 3» (`PlacementOrderPromptMeta.index` / `of`). */
  order?: {index: number, of: number};
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
  if (branches.length === 1) {
    return preludeResourceOf(card, branches[0]);
  }
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
      choice: position,
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
  return {card, kind: 'variant', rows, shared};
}

/** The six lanes, in the grid's order (M€ · steel · titanium / plants · energy · heat). */
const STANDARD_LANES: ReadonlyArray<string> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

/**
 * THE RESOURCE PRE-STEP of a one-branch play (P50 · FC): its `resource` step that GAINS (never a spend — a play spends
 * nothing it asks), one row per lane the server offers, «+N [lane]»; the play's other chips shared. Undefined when the
 * branch asks no such step (or is unavailable).
 */
function preludeResourceOf(card: CardName, branch: ActionPreviewBranch): PreludeVariant | undefined {
  if (!branch.available) {
    return undefined;
  }
  const stepIndex = branch.steps.findIndex((s) => s.kind === 'input' && s.input.type === 'resource' &&
    (s.input as {spendAmount?: number}).spendAmount === undefined);
  const step = branch.steps[stepIndex];
  if (step === undefined || step.kind !== 'input') {
    return undefined;
  }
  const input = step.input as {include?: ReadonlyArray<string>, amount?: number};
  const amount = input.amount ?? 1;
  const offered = input.include ?? STANDARD_LANES;
  const lanes = STANDARD_LANES.filter((lane) => offered.includes(lane));
  const rows = lanes.map((resource, i): PreludeVariantRow => ({
    key: 'r' + resource,
    position: 0,
    choice: i,
    branchIndex: branch.index,
    title: RESOURCE_TITLE[resource] ?? resource,
    chips: [{direction: 'gain', icon: resource, amount}],
    available: true,
    resource,
    stepIndex,
  }));
  // The «?» chip IS the question the rows answer — never shared; everything else (P50's card) is read once.
  const shared = branch.effects.filter((chip) => !(chip.icon === 'wild' && chip.note === 'of your choice'));
  return {card, kind: 'resource', rows, shared};
}

const RESOURCE_TITLE: Readonly<Record<string, string>> = {
  megacredits: 'M€', steel: 'Steel', titanium: 'Titanium', plants: 'Plants', energy: 'Energy', heat: 'Heat',
};

/** The host's crumb stage of a pre-step: «› ВАРИАНТ» (a branch) · «› РЕСУРС» (a resource) · «› ОЧЕРЁДНОСТЬ» (P58). */
export function preludePreStepStage(variant: PreludeVariant): string {
  return variant.kind === 'resource' ? 'Resource' : variant.kind === 'placement-order' ? 'Order' : 'Variant';
}

/** The crumb's stage of a placement-order step WITH its count — «ОЧЕРЁДНОСТЬ 2 / 3»: the key and its params. */
export const PLACEMENT_ORDER_STAGE = 'Order ${0} / ${1}';
export function placementOrderStageParams(variant: PreludeVariant): ReadonlyArray<string> | undefined {
  return variant.order === undefined ? undefined : [String(variant.order.index), String(variant.order.of)];
}

/** The tile families in the order a card prints them (P58: «1 ocean, 1 city, 1 greenery») — a row's stable place. */
const TILE_ORDER: ReadonlyArray<TileType> = [TileType.OCEAN, TileType.CITY, TileType.GREENERY];
const TILE_ITEM: Readonly<Partial<Record<TileType, CardRenderItemType>>> = {
  [TileType.OCEAN]: CardRenderItemType.OCEANS,
  [TileType.CITY]: CardRenderItemType.CITY,
  [TileType.GREENERY]: CardRenderItemType.GREENERY,
};
const TILE_TITLE: Readonly<Partial<Record<TileType, string>>> = {
  [TileType.OCEAN]: 'Ocean', [TileType.CITY]: 'City', [TileType.GREENERY]: 'Greenery',
};
export const PLACED_NOTICE = 'Placed';
/** The tile's STABLE key for a probe / a selector — `TileType` is numeric on the wire, a name is not. */
const TILE_KEY: Readonly<Partial<Record<TileType, string>>> = {
  [TileType.OCEAN]: 'ocean', [TileType.CITY]: 'city', [TileType.GREENERY]: 'greenery',
};
export function placementTileKey(tile: TileType | undefined): string | undefined {
  return tile === undefined ? undefined : TILE_KEY[tile] ?? String(tile);
}
export const OCEANS_FULL_REASON = 'All oceans are on the board';

/** The card face's own node for `tile` (its printed hex), or undefined. */
function printedTile(renderData: CardComponent | undefined, tile: TileType): ReadonlyArray<ItemType> | undefined {
  const type = TILE_ITEM[tile];
  if (type === undefined) {
    return undefined;
  }
  for (const group of buildMechanics(renderData).groups) {
    const node = group.nodes.find((n) => isICardRenderItem(n) && n.type === type);
    if (node !== undefined) {
      return [node];
    }
  }
  return undefined;
}

/** The marker of a live «which tile next» prompt (P58), or undefined — STRUCTURAL, never a title. */
export function placementOrderPromptOf(wf: PlayerInputModel | undefined): PlacementOrderPromptMeta | undefined {
  return wf?.type === 'or' ? (wf as OrOptionsModel).placementOrderPrompt : undefined;
}

/**
 * THE «ОЧЕРЁДНОСТЬ» STEP of a live placement-order prompt (P58 · FS) — one row per printed tile in the card's order
 * (never the order they are placed in: the column never reflows between steps): a tile still owed is a row the player
 * takes (its OPTION found by the option's own `tileType` metadata — never by a title), a placed one SEALED in place, a
 * skipped one (an ocean at the maximum) SHOWN with its reason. Each row is the card's own printed hex. Undefined when
 * the prompt is no such step.
 */
export function placementOrderStepOf(wf: PlayerInputModel | undefined, renderData?: CardComponent): PreludeVariant | undefined {
  const meta = placementOrderPromptOf(wf);
  if (meta === undefined || wf === undefined) {
    return undefined;
  }
  const options = (wf as OrOptionsModel).options;
  const skipped = meta.skipped ?? [];
  const tiles = [...meta.done, ...meta.remaining, ...skipped];
  const ordered = [...TILE_ORDER.filter((t) => tiles.includes(t)), ...tiles.filter((t) => !TILE_ORDER.includes(t))];
  const rows = ordered.map((tile, position): PreludeVariantRow => {
    const optionIndex = options.findIndex((o) => o.type === 'option' && (o as SelectOptionModel).metadata?.tileType === tile);
    const placed = meta.done.includes(tile);
    const row: PreludeVariantRow = {
      key: 't' + tile,
      position,
      choice: position,
      branchIndex: optionIndex,
      title: TILE_TITLE[tile] ?? 'Tile',
      chips: [],
      available: optionIndex >= 0 && !placed,
      tileType: tile,
    };
    const print = printedTile(renderData, tile);
    if (print !== undefined) {
      row.print = print;
    }
    if (placed) {
      row.sealed = true;
      row.notice = PLACED_NOTICE;
    } else if (skipped.includes(tile)) {
      row.reason = tile === TileType.OCEAN ? OCEANS_FULL_REASON : 'Not available right now';
    }
    return row;
  });
  return {card: meta.source, kind: 'placement-order', rows, shared: [], order: {index: meta.index, of: meta.of}};
}

/**
 * The answer of a placement-order row — the LIVE `OrOptions` answered in place (the prompt stands: never an addressed
 * batch), the index the option's own. Undefined for a sealed / skipped row.
 */
export function placementOrderAnswer(row: PreludeVariantRow | undefined): InputResponse | undefined {
  if (row === undefined || !row.available || row.branchIndex < 0) {
    return undefined;
  }
  return {type: 'or', index: row.branchIndex, response: {type: 'option'}};
}

/** The row a host recorded (its `choice`). */
export function preludeVariantRowOf(variant: PreludeVariant | undefined, choice: number | undefined): PreludeVariantRow | undefined {
  return choice === undefined ? undefined : variant?.rows.find((r) => r.choice === choice);
}

/** The step answers a chosen RESOURCE row carries for the play's reward wave (`extractPlayRewards`) — `{}` otherwise. */
export function preludeVariantStepResponses(row: PreludeVariantRow | undefined): Record<number, unknown> {
  return row?.resource !== undefined && row.stepIndex !== undefined ? {[row.stepIndex]: {type: 'resource', resource: row.resource}} : {};
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
  const branch = branchOf(preview, row);
  if (row.resource !== undefined && row.stepIndex !== undefined) {
    // A RESOURCE row: the step's own answer, addressed by the step (role `resource`, this card).
    const step = branch?.steps[row.stepIndex];
    return addressed({type: 'resource', resource: row.resource} as InputResponse, step?.kind === 'input' ? step.for : undefined);
  }
  if (!row.available || row.branchIndex < 0) {
    return undefined;
  }
  return addressed({type: 'or', index: row.branchIndex, response: {type: 'option'}}, branch?.for);
}

/** The first row the cursor stands on — the first the player can take. */
export function firstAvailableRow(variant: PreludeVariant): number {
  const i = variant.rows.findIndex((r) => r.available);
  return i < 0 ? 0 : i;
}

/**
 * One d-pad step down the column — wraps; a refused row is a stop (its reason is read there), a SEALED one (a tile
 * already placed) is walked over: there is nothing left to read or take on it.
 */
export function stepVariantFocus(variant: PreludeVariant, focus: number, dir: 1 | -1): number {
  const n = variant.rows.length;
  if (n === 0) {
    return 0;
  }
  let next = focus;
  for (let i = 0; i < n; i++) {
    next = (next + dir + n) % n;
    if (variant.rows[next].sealed !== true) {
      return next;
    }
  }
  return focus;
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
