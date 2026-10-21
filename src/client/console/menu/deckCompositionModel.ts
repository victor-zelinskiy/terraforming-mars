import {Expansion} from '@/common/cards/GameModule';
import {DeckCompositionModel, ExpansionContribution} from '@/common/models/DeckCompositionModel';

/*
 * THE DECK METER'S VIEW (T04 «the deck is visible before launch») — PURE: the server's
 * `DeckCompositionModel` (`PUT /api/deck-composition`) in, what the three surfaces print
 * out (the expansions deck's head, the briefing, the launch plate). No count happens here
 * or in a template: every number is the server's, this module only orders and labels it.
 * `docs/claude/console/pregame-showcase.md` § 6a.
 */

/** A project card's colour — the premium face's identity of the type. */
export type ProjectKind = 'automated' | 'active' | 'event';

export type ProjectSegment = {
  kind: ProjectKind;
  count: number;
  /** Share of the project deck, 0…1 — the segment's `scaleX`. */
  share: number;
  /** The segment's own label with its count (`${0}` — direct labelling: the colour is never alone). */
  labelKey: string;
};

export type DeckTile = {
  id: 'projects' | 'corporations' | 'preludes';
  labelKey: string;
  total: number;
};

export type DeckExtra = {id: 'colonies' | 'resolutions', key: string, params: ReadonlyArray<string>};

export type DeckMeterView = {
  tiles: ReadonlyArray<DeckTile>;
  /** The project deck by colour, in the fixed order green · blue · red (never re-ordered by size). */
  segments: ReadonlyArray<ProjectSegment>;
  /** «Also in the party» — each present only with the expansion that brings it. */
  extras: ReadonlyArray<DeckExtra>;
};

const PROJECT_KINDS: ReadonlyArray<{kind: ProjectKind, labelKey: string}> = [
  {kind: 'automated', labelKey: '${0} automated'},
  {kind: 'active', labelKey: '${0} active'},
  {kind: 'event', labelKey: '${0} events'},
];

export function deckMeterView(model: DeckCompositionModel): DeckMeterView {
  const projects = model.projects.total;
  return {
    tiles: [
      {id: 'projects', labelKey: 'Projects', total: projects},
      {id: 'corporations', labelKey: 'Corporations', total: model.corporations.total},
      {id: 'preludes', labelKey: 'Preludes', total: model.preludes.total},
    ],
    segments: PROJECT_KINDS.map(({kind, labelKey}) => ({
      kind,
      count: model.projects.byType[kind],
      share: projects === 0 ? 0 : model.projects.byType[kind] / projects,
      labelKey,
    })),
    extras: [
      ...(model.extras.colonies === undefined ? [] : [{
        id: 'colonies' as const,
        // The POOL the table deals from (the owner, 2026-10-21) — how many stand at the start is the deal's, not the deck's.
        key: '${0} colony tiles',
        params: [String(model.extras.colonies.pool)],
      }]),
      ...(model.extras.resolutions === undefined ? [] : [{
        id: 'resolutions' as const,
        key: '${0} resolutions',
        params: [String(model.extras.resolutions)],
      }]),
    ],
  };
}

/** One chip of what an expansion brings: an amount and its word, in the deck's order. */
export type ContributionChip = {id: keyof ExpansionContribution, key: string, amount: number};

const CHIP_ORDER: ReadonlyArray<{id: keyof ExpansionContribution, key: string}> = [
  {id: 'projects', key: '+${0} projects'},
  {id: 'corporations', key: '+${0} corporations'},
  {id: 'preludes', key: '+${0} preludes'},
  {id: 'resolutions', key: '+${0} resolutions'},
  {id: 'colonies', key: '+${0} colony tiles'},
];

/**
 * What THIS expansion adds to the decks with the rest of the set as it stands — the
 * server's «with it − without it» (`contributions`). An OFF tile reads the same numbers
 * («would add»); a zero is not printed (an expansion that adds no cards — Ares — prints
 * no chip rather than «+0»).
 */
export function contributionChips(model: DeckCompositionModel | undefined, expansion: Expansion): ReadonlyArray<ContributionChip> {
  const contribution = model?.contributions[expansion];
  if (contribution === undefined) {
    return [];
  }
  return CHIP_ORDER
    .filter(({id}) => contribution[id] > 0)
    .map(({id, key}) => ({id, key, amount: contribution[id]}));
}

/** The launch plate's one line — «Decks: N projects · N corporations · N preludes» (a zero deck is left out). */
export function deckLine(model: DeckCompositionModel): ReadonlyArray<{id: DeckTile['id'], key: string, amount: number}> {
  const line: Array<{id: DeckTile['id'], key: string, amount: number}> = [
    {id: 'projects', key: '${0} projects', amount: model.projects.total},
    {id: 'corporations', key: '${0} corporations', amount: model.corporations.total},
    {id: 'preludes', key: '${0} preludes', amount: model.preludes.total},
  ];
  return line.filter((part) => part.amount > 0);
}
