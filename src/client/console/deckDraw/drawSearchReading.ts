/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SEARCH'S RULE, READ — the ONE client formatter of the server's search
 * descriptor (`DrawSearchModel`, born in `deferredActions/drawSearch.ts`).
 * Every surface that names a filtered draw asks it: the composer's draw chip
 * («+3 · без меток [P][M][A]»), the composer's «Далее» row, the reveal's
 * summary («вскрыто 6 · получено 3 · сброшено 3») and the discard tray's
 * verdict on each thrown-away card. Pure: no DOM, no reactive reads, no
 * translation — the SFCs render keys, this decides which. No rule is
 * re-derived here: a term is a field of the descriptor, a verdict is the
 * step's own `failedTags`, a count is a length of the server's own lists.
 */
import {Tag} from '@/common/cards/Tag';
import {CardType} from '@/common/cards/CardType';
import {CardResource} from '@/common/CardResource';
import {CardDrawRevealModel, CardDrawRevealStep, DrawSearchModel} from '@/common/models/CardDrawRevealModel';

/**
 * ONE clause of the rule, in reading order. The TYPE is the noun («события»)
 * and leads; the tag, the resource and the excluded tags qualify it.
 */
export type DrawSearchTerm =
  | {kind: 'type', type: CardType}
  | {kind: 'with', tag: Tag}
  | {kind: 'resource', resource: CardResource}
  | {kind: 'without', tags: ReadonlyArray<Tag>};

/** The word a clause opens with — an English i18n key. The tag / resource itself is drawn as its icon. */
export function drawSearchTermLabel(term: DrawSearchTerm): string {
  switch (term.kind) {
  case 'type': return TYPE_LABELS[term.type] ?? 'cards';
  case 'with': return 'with the tag';
  case 'resource': return 'collecting';
  case 'without': return 'without the tags';
  }
}

const TYPE_LABELS: Partial<Record<CardType, string>> = {
  [CardType.EVENT]: 'event cards',
  [CardType.ACTIVE]: 'active cards',
  [CardType.AUTOMATED]: 'automated cards',
};

export function drawSearchTerms(search: DrawSearchModel | undefined): Array<DrawSearchTerm> {
  if (search === undefined) {
    return [];
  }
  const out: Array<DrawSearchTerm> = [];
  if (search.type !== undefined) {
    out.push({kind: 'type', type: search.type});
  }
  if (search.tag !== undefined) {
    out.push({kind: 'with', tag: search.tag});
  }
  if (search.resource !== undefined) {
    out.push({kind: 'resource', resource: search.resource});
  }
  if (search.withoutTags !== undefined && search.withoutTags.length > 0) {
    out.push({kind: 'without', tags: search.withoutTags});
  }
  return out;
}

/**
 * The search's OUTCOME in numbers, from the batch the server sent: how many
 * cards were turned over, kept, thrown away — and whether the deck ran out
 * first. `undefined` for a batch no search produced (a plain draw).
 */
export type DrawSearchTally = {
  revealed: number,
  taken: number,
  discarded: number,
  exhausted: boolean,
};

export function drawSearchTally(reveal: Pick<CardDrawRevealModel, 'cards' | 'sequence' | 'search' | 'exhausted'> | undefined): DrawSearchTally | undefined {
  if (reveal === undefined || reveal.search === undefined) {
    return undefined;
  }
  const discarded = reveal.sequence?.filter((step) => !step.matched).length ?? 0;
  return {
    revealed: reveal.sequence?.length ?? reveal.cards.length,
    taken: reveal.cards.length,
    discarded,
    exhausted: reveal.exhausted === true,
  };
}

/**
 * WHY one card went to the discard pile — the tag it carries that the rule
 * excludes (`tags`, the step's own `failedTags`), or, for a card a POSITIVE
 * filter refused, the rule it did not meet (`rule`). `undefined` for a kept
 * card, and for a discard no descriptor can explain (an opaque `include`).
 */
export type DrawDiscardVerdict =
  | {kind: 'tags', tags: ReadonlyArray<Tag>}
  | {kind: 'rule', terms: ReadonlyArray<DrawSearchTerm>};

export function drawDiscardVerdict(step: CardDrawRevealStep | undefined, search: DrawSearchModel | undefined): DrawDiscardVerdict | undefined {
  if (step === undefined || step.matched) {
    return undefined;
  }
  if (step.failedTags !== undefined && step.failedTags.length > 0) {
    return {kind: 'tags', tags: step.failedTags};
  }
  const terms = drawSearchTerms(search);
  return terms.length > 0 ? {kind: 'rule', terms} : undefined;
}

/** The discarded steps of a batch, in the server's order — what the tray holds, card by card. */
export function discardedSteps(reveal: Pick<CardDrawRevealModel, 'sequence'> | undefined): Array<CardDrawRevealStep> {
  return (reveal?.sequence ?? []).filter((step) => !step.matched);
}
