import {CardComponent} from '@/common/cards/render/CardComponent';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {isICardRenderItem, isICardRenderSymbol, ItemType} from '@/common/cards/render/Types';
import {buildMechanics, MechGroup} from '@/client/components/premiumCard/mechanicsModel';
import {ActionEffect, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';

/*
 * THE VARIANT CHOICE — ONE grammar for every «choose one of these» in the console (TR51 Influential Discovery, the
 * owner's order of 2026-10-12: «the choice elements themselves more premium — strictly pre-select»).
 *
 * Five surfaces used to ask the same question in five dialects with three different marks for «this is my answer»
 * (the play composer's ✓, the action composer's ◉ / ○, the nested list's ✓ / ›) and a `filter` on the unavailable
 * option the console strips. This module is the pure half of the ONE replacement (`ConsoleVariantChoice.vue`):
 *
 *  · STATE → PAINT: three facts are three different things on screen — the CURSOR (where the player stands), the
 *    CHOICE (the answer given, which survives the cursor leaving) and AVAILABILITY (with its reason). A decided group
 *    lets its unchosen options RECEDE (never hide) — the answer reads before the options it excluded.
 *  · THE PRINTED ROW: an option of a card's choice carries the card's OWN printed graphic of that branch — the same
 *    render nodes the premium face draws (`buildMechanics` keeps node REFERENCES), sliced at the printed OR — never a
 *    copy. The face, the choice and the commit's impulse are one object.
 *
 * No rule lives here: availability, reasons and outcomes are the server's; this module only decides how they look.
 */

export type VariantChoiceState = {
  /** The cursor stands here (the cold ring). */
  focused: boolean;
  /** The player's answer (the seal) — survives the cursor walking away. */
  selected: boolean;
  /** The rules refuse it (shown, never hidden — with its reason). */
  off: boolean;
};

/**
 * A PALETTE tile's HERO (TR54, «ПАЛИТРА СТАНДАРТНОГО РЕСУРСА») — when an option has no printed graphic of its own but
 * IS a kind of resource («which standard resource?», «which production?»), the tile leads with that resource's own
 * sprite at the scene's scale (a production on its bronze plate), then the number it moves, the loudest text of the
 * tile. The number is the SERVER's (the option's chip); the client formats it and computes nothing.
 */
export type VariantHero = {
  kind: 'resource' | 'production';
  /** The icon key every chip of this console resolves (`iconClassFor`) — a standard resource. */
  icon: string;
  /** How many the option moves — absent when the server states no number (a live prompt without its marker). */
  amount?: number;
  /** A gain reads «+N», a loss «−N». */
  direction: 'gain' | 'loss';
};

/**
 * WHERE THIS OPTION'S PAYLOAD CAN LAND (TR56 «КУДА ЛЯЖЕТ», П1) — the holders the SERVER offers for the option's own
 * «put N on ANY card» pick, in its order. A tile that only says WHAT («3 [мех]») hides the half of the decision that
 * differs most between options: each kind has its own set of holders, and the set is the reason to pick one kind over
 * another. The tile shows up to three of their faces and their count; the client never looks for a holder itself.
 */
export type VariantDestinations = {
  /** The candidate holders, the server's own models (the capsule states each one's count). */
  cards: ReadonlyArray<CardModel>;
  /** How many there are — the faces shown are capped, the count never is. */
  count: number;
};

/** How many holder faces a tile fans out — the rest are the count. */
export const VARIANT_DESTINATION_FACES = 3;

/**
 * The option's DESTINATIONS — the candidates of its one GAIN-to-a-card pick: an input step whose `SelectCard` puts a
 * positive amount on the chosen card (`step.amount`), or, for a branch whose target is its OPTION (no step carries
 * it), that option's `SelectCard` beside the branch's own «to a card» gain. A branch with no such pick, or with
 * several (the payload would be ambiguous), has none; a branch the rules refuse keeps none either (its reason speaks).
 */
export function variantDestinationsOf(branch: Pick<ActionPreviewBranch, 'steps' | 'optionInput' | 'effects' | 'available'> | undefined): VariantDestinations | undefined {
  if (branch === undefined || !branch.available) {
    return undefined;
  }
  const picks: Array<SelectCardModel> = [];
  for (const step of branch.steps) {
    if (step.kind === 'input' && step.input.type === 'card' && (step.amount ?? 0) > 0) {
      picks.push(step.input as SelectCardModel);
    }
  }
  const option = branch.optionInput;
  if (picks.length === 0 && option !== undefined && option.type === 'card' &&
      branch.effects.some((e) => e.note === 'to a card' && e.direction === 'gain' && e.amount > 0)) {
    picks.push(option as SelectCardModel);
  }
  if (picks.length !== 1 || picks[0].cards.length === 0) {
    return undefined;
  }
  return {cards: picks[0].cards, count: picks[0].cards.length};
}

export type VariantChoiceOption = {
  key: string;
  state: VariantChoiceState;
  /** The option's own words (already translated). Empty → the printed row speaks alone. */
  title: string;
  /** Why the rules refuse it (already translated). Absent → the tile says nothing (PL-171: one loss, one voice). */
  reason?: string;
  /**
   * The option is LIVE but would change nothing right now — the server's proven «no effect» verdict, already
   * translated. The tile quiets (its print a step back) and names it in a calm line; it stays a full answer (a
   * player may take it to stall). Never on an `off` option — a refusal already says why.
   */
  quiet?: string;
  /** The card's printed graphic of THIS option (face node references) — the tile's headline. */
  printed?: ReadonlyArray<ItemType>;
  /** The palette tile's hero — the kind of resource the option IS, when no print of its own speaks for it. */
  hero?: VariantHero;
  /** WHERE the option's payload can land (TR56, П1) — the holders' faces and their count under the print. */
  destinations?: VariantDestinations;
  /** The option OPENS a pick of its own (a door, not an answer) — the ›. */
  door?: boolean;
  /** A player row's colour (the owner dot). */
  color?: string;
  /** The host's own data attributes on the tile (its e2e / probe hooks — `data-branch-pos`, …). */
  attrs?: Readonly<Record<string, string | undefined>>;
};

/** Is the group DECIDED — has the player given an answer? */
export function groupDecided(options: ReadonlyArray<{state: VariantChoiceState}>): boolean {
  return options.some((o) => o.state.selected);
}

/**
 * A decided group's unchosen options RECEDE — the answer reads first, the rest stay legible and reachable. The
 * cursor's own option never recedes (the player is reading it), and an unavailable one has its own paint.
 */
export function variantRecedes(state: VariantChoiceState, decided: boolean): boolean {
  return decided && !state.selected && !state.focused && !state.off;
}

/** The option tile's classes — the ONE mapping of the three facts to paint. */
export function variantOptionClasses(state: VariantChoiceState, decided: boolean): Record<string, boolean> {
  return {
    'con-vchoice__opt--focused': state.focused,
    'con-vchoice__opt--selected': state.selected,
    'con-vchoice__opt--off': state.off,
    'con-vchoice__opt--recede': variantRecedes(state, decided),
  };
}

/** A live option the server proved changes nothing — the quiet paint and its line (never on a refused one). */
export function variantQuiet(opt: {state: VariantChoiceState, quiet?: string}): boolean {
  return !opt.state.off && opt.quiet !== undefined && opt.quiet !== '';
}

/** The six standard resources — the only kinds a palette hero is (their sprites are the rail's own). */
const STANDARD_HEROES: ReadonlySet<string> = new Set(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);

/**
 * The hero an option's OWN chip makes — a standard resource gained into (or taken from) the stock, or a production
 * of one; anything else (a card resource, a tile, a TR, a chip with a note of its own) is no palette hero.
 */
export function heroOfEffect(effect: ActionEffect | undefined): VariantHero | undefined {
  if (effect === undefined || effect.icon === undefined || !STANDARD_HEROES.has(effect.icon)) {
    return undefined;
  }
  const kind = effect.note === undefined ? 'resource' : effect.note === 'production' ? 'production' : undefined;
  if (kind === undefined) {
    return undefined;
  }
  return {kind, icon: effect.icon, amount: effect.amount, direction: effect.direction === 'gain' ? 'gain' : 'loss'};
}

/**
 * Is this group a PALETTE — N comparable options of ONE kind of thing («which of the six standard resources»)? Every
 * option carries a hero, all of one kind, and there are at least `min` of them (a host whose row is a palette by
 * construction — the Industrialists' «+1 production» of two — passes its own floor). A palette is one object: one row
 * of equal tiles, no «ИЛИ» medallions (the group's kicker carries the exclusion).
 */
export function paletteOf(options: ReadonlyArray<{hero?: VariantHero}>, min = 3): boolean {
  if (options.length < min || options.length === 0) {
    return false;
  }
  const kind = options[0].hero?.kind;
  return kind !== undefined && options.every((o) => o.hero !== undefined && o.hero.kind === kind);
}

/** The palette tile's number as it reads — «+3», «−1», a zero bare. */
export function heroFigure(hero: VariantHero): string {
  if (hero.amount === undefined) {
    return '';
  }
  if (hero.amount === 0) {
    return '0';
  }
  return (hero.direction === 'gain' ? '+' : '−') + String(hero.amount);
}

function isOrNode(node: ItemType): boolean {
  return node !== undefined && node !== null && typeof node !== 'string' && isICardRenderSymbol(node) && node.type === CardRenderSymbolType.OR;
}

function isSpacer(node: ItemType): boolean {
  if (node === undefined || node === null || typeof node === 'string') {
    return true;
  }
  if (isICardRenderSymbol(node)) {
    return node.type === CardRenderSymbolType.NBSP || node.type === CardRenderSymbolType.EMPTY || node.type === CardRenderSymbolType.VSPACE;
  }
  return isICardRenderItem(node) && node.type === CardRenderItemType.NBSP;
}

function trimmed(nodes: ReadonlyArray<ItemType>): ReadonlyArray<ItemType> {
  let a = 0;
  let b = nodes.length;
  while (a < b && isSpacer(nodes[a])) {
    a++;
  }
  while (b > a && isSpacer(nodes[b - 1])) {
    b--;
  }
  return nodes.slice(a, b);
}

/** Every maximal run of groups joined by the face's «ИЛИ» divider (`orJoin`) — the alternatives drawn as separate rows. */
function orJoinedRuns(groups: ReadonlyArray<MechGroup>): Array<ReadonlyArray<MechGroup>> {
  const runs: Array<Array<MechGroup>> = [];
  let run: Array<MechGroup> = [];
  for (const group of groups) {
    if (group.orJoin === true && run.length > 0) {
      run.push(group);
      continue;
    }
    if (run.length > 1) {
      runs.push(run);
    }
    run = [group];
  }
  if (run.length > 1) {
    runs.push(run);
  }
  return runs;
}

/** A group split at its INTERIOR printed ORs («[science]* OR 6 [data]*») — the alternatives drawn on one row. */
function interiorSegments(group: MechGroup): ReadonlyArray<ReadonlyArray<ItemType>> {
  const segments: Array<Array<ItemType>> = [[]];
  for (const node of group.nodes) {
    if (isOrNode(node)) {
      segments.push([]);
      continue;
    }
    segments[segments.length - 1].push(node);
  }
  return segments.map(trimmed).filter((s) => s.length > 0);
}

/**
 * The card's PRINTED graphic of each option of its choice, in the printed order — the SAME node references the
 * premium face renders (`buildMechanics`), sliced at the printed OR. Two shapes the face knows: alternatives drawn as
 * separate rows joined by the «ИЛИ» divider (an action's two variants), and alternatives drawn on ONE row around an
 * interior OR (a play's «2 [animal]* OR 4 [microbe]*»). The slice is taken only when it is UNAMBIGUOUS — exactly one
 * candidate with exactly `count` alternatives; anything else answers `undefined` and the options speak in words.
 */
export function printedVariantRows(renderData: CardComponent | undefined, count: number): ReadonlyArray<ReadonlyArray<ItemType>> | undefined {
  if (count < 2) {
    return undefined;
  }
  const vm = buildMechanics(renderData);
  const candidates: Array<ReadonlyArray<ReadonlyArray<ItemType>>> = [];
  for (const run of orJoinedRuns(vm.groups)) {
    if (run.length === count) {
      candidates.push(run.map((g) => trimmed(g.nodes)));
    }
  }
  for (const group of vm.groups) {
    const segments = interiorSegments(group);
    if (segments.length === count && segments.length > 1) {
      candidates.push(segments);
    }
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Does an option DRAW a card when chosen? The ONE reading lives with the rule that needs it
 * (`common/models/tableQuestionDeferral.ts` — a discard behind a draw may wait for it); re-exported for the readers here.
 */
export {optionDraws} from '@/common/models/tableQuestionDeferral';
