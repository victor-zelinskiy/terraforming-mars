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
  | {kind: 'without', tags: ReadonlyArray<Tag>}
  /** «со значком аэростата» — Celestic / P44 (`DrawSearchModel.floaterIcon`); drawn as the floater icon. */
  | {kind: 'floaterIcon'}
  /** «с требованием партии» — P51 High Circles (`DrawSearchModel.partyRequirement`); drawn as the requirement plate glyph. */
  | {kind: 'partyRequirement'}
  /** «с требованием» — P54 Nobel Prize (`DrawSearchModel.requirement`, ANY requirement); drawn as the bare MIN plate glyph. */
  | {kind: 'requirement'}
  /** «без меток» — PC03 Sagitta (`DrawSearchModel.noTags` — no printed tag, not an event); drawn as the crossed blank tag. */
  | {kind: 'noTags'};

/** The word a clause opens with — an English i18n key. The tag / resource itself is drawn as its icon. */
export function drawSearchTermLabel(term: DrawSearchTerm): string {
  switch (term.kind) {
  case 'type': return TYPE_LABELS[term.type] ?? 'cards';
  case 'with': return 'with the tag';
  case 'resource': return 'collecting';
  case 'without': return 'without the tags';
  case 'floaterIcon': return 'with a floater icon';
  case 'partyRequirement': return 'with a party requirement';
  case 'requirement': return 'with a requirement';
  case 'noTags': return 'with no tags';
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
  if (search.floaterIcon === true) {
    out.push({kind: 'floaterIcon'});
  }
  if (search.partyRequirement === true) {
    out.push({kind: 'partyRequirement'});
  }
  if (search.requirement === true) {
    out.push({kind: 'requirement'});
  }
  if (search.noTags === true) {
    out.push({kind: 'noTags'});
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

/**
 * EVERY RULE a batch searched by, in SEGMENT order, each once (P56 Planetary Alliance — a Jovian search, then a Venus
 * one, in one play: one batch, two segments, two rules). The batch-level `search` is the FIRST segment's — a reader
 * that names the batch's rule from it alone tells half the story. Two segments with one rule (a count apart) read once.
 */
export function drawSearchRules(reveal: Pick<CardDrawRevealModel, 'search' | 'segments'> | undefined): Array<DrawSearchModel> {
  if (reveal === undefined) {
    return [];
  }
  const out: Array<DrawSearchModel> = [];
  const seen = new Set<string>();
  for (const search of [...(reveal.segments ?? []).map((segment) => segment.search), reveal.search]) {
    if (search === undefined) {
      continue;
    }
    const key = termsKey(drawSearchTerms(search));
    if (!seen.has(key)) {
      seen.add(key);
      out.push(search);
    }
  }
  return out;
}

function termsKey(terms: ReadonlyArray<DrawSearchTerm>): string {
  return JSON.stringify(terms);
}

/**
 * ONE clause of a SEVERAL-RULE phrase, in reading order (the terms of every rule in turn — the rule chassis already
 * draws «·» between two clauses); `labelled` — its word is printed. Two rules that are each one tag read «с меткой
 * [J] · [V]»: the second medallion continues the first rule's word instead of repeating it.
 */
export type DrawSearchClause = {term: DrawSearchTerm, labelled: boolean};

export function drawSearchClauses(rules: ReadonlyArray<DrawSearchModel>): Array<DrawSearchClause> {
  const out: Array<DrawSearchClause> = [];
  let previous: ReadonlyArray<DrawSearchTerm> | undefined;
  for (const rule of rules) {
    const terms = drawSearchTerms(rule);
    const continues = previous !== undefined && isOneTag(previous) && isOneTag(terms);
    terms.forEach((term, i) => out.push({term, labelled: !(continues && i === 0)}));
    if (terms.length > 0) {
      previous = terms;
    }
  }
  return out;
}

function isOneTag(terms: ReadonlyArray<DrawSearchTerm>): boolean {
  return terms.length === 1 && terms[0].kind === 'with';
}

/**
 * The rule that turned over the batch tape's step `index` — the SEGMENT that owns it, by the segments' cumulative
 * tape lengths (a segment's run on the batch tape is its own `sequence`, or its `count` matched steps when it threw
 * nothing away — `Player.enqueueCardDrawReveal` builds the batch tape exactly so; an empty exhausted search is its
 * tape alone). Falls back to the batch-level rule when the segments do not account for the tape.
 */
export function searchOwningStep(reveal: Pick<CardDrawRevealModel, 'search' | 'segments' | 'sequence'> | undefined, index: number): DrawSearchModel | undefined {
  if (reveal === undefined) {
    return undefined;
  }
  const segments = reveal.segments ?? [];
  const lengths = segments.map((segment) => segment.sequence?.length ?? Math.max(0, Math.floor(segment.count)));
  const total = lengths.reduce((n, length) => n + length, 0);
  if (segments.length < 2 || reveal.sequence === undefined || total !== reveal.sequence.length) {
    return reveal.search;
  }
  let end = 0;
  for (let i = 0; i < segments.length; i++) {
    end += lengths[i];
    if (index < end) {
      return segments[i].search;
    }
  }
  return reveal.search;
}

/** WHY each discarded card went, in the tray's order (`discardedSteps`) — each judged by the rule of ITS OWN search. */
export function discardVerdictsOf(reveal: Pick<CardDrawRevealModel, 'search' | 'segments' | 'sequence'> | undefined): Array<DrawDiscardVerdict | undefined> {
  const out: Array<DrawDiscardVerdict | undefined> = [];
  (reveal?.sequence ?? []).forEach((step, index) => {
    if (!step.matched) {
      out.push(drawDiscardVerdict(step, searchOwningStep(reveal, index)));
    }
  });
  return out;
}

/** The discarded steps of a batch, in the server's order — what the tray holds, card by card. */
export function discardedSteps(reveal: Pick<CardDrawRevealModel, 'sequence'> | undefined): Array<CardDrawRevealStep> {
  return (reveal?.sequence ?? []).filter((step) => !step.matched);
}
