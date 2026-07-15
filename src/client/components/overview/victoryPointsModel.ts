/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in DESKTOP_DEPRECATION_AUDIT.md.
 */
/*
 * Pure, framework-agnostic model builder for the Victory Points score report.
 *
 * Turns a `VictoryPointsBreakdown` into:
 *   • `scales`  — the breakdown BARS (4 core + conditional expansion bars),
 *                 each with internal colour SEGMENTS. All bars share one
 *                 px-per-VP scale (`maxScalePositive`) so their lengths are
 *                 directly comparable at a glance ("what carried the game").
 *   • `cardGroups` — the "from cards" detail, grouped by VP family and sorted
 *                 (positives desc, penalties last) for the multi-column list.
 *
 * No Vue / DOM / i18n here — labels are English i18n KEYS the component
 * translates, so this stays unit-testable (see victoryPointsModel.spec.ts).
 */
import {CardVictoryPointsDetail, CardVictoryPointsKind, VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';

// One coloured slice of a bar AND its row in the matching detail block. The
// `key` is shared between the bar segment and the detail row so the component
// can cross-highlight on hover. `accent` selects the LESS colour family.
export type VPSegment = {
  key: string;
  accent: string;
  label: string;
  value: number;
  penalty?: boolean;
};

// One breakdown bar (a major VP category) with its internal segments.
export type VPScale = {
  key: string;
  label: string;
  accent: string;
  total: number; // signed — drives the value chip
  positiveTotal: number; // sum of positive segments — drives bar length
  penaltyTotal: number; // sum of negative segments (<= 0)
  segments: Array<VPSegment>;
};

export type VPCardRow = {
  cardName: string;
  victoryPoint: number;
  kind: CardVictoryPointsKind;
  emphasized: boolean; // a big conditional scorer worth calling out
};

export type VPCardGroup = {
  kind: CardVictoryPointsKind;
  label: string;
  accent: string;
  total: number;
  rows: Array<VPCardRow>;
};

export type VictoryPointsModel = {
  scales: Array<VPScale>;
  maxScalePositive: number;
  cardGroups: Array<VPCardGroup>;
  grandTotal: number;
};

export type VictoryPointsModelOptions = {
  hasMoon: boolean;
  hasPathfinders: boolean;
  hasEscapeVelocity: boolean;
};

// A conditional card whose contribution clears this bar is highlighted so big
// "1 VP per X" scorers don't read like an ordinary +1.
export const BIG_CONDITIONAL_VP = 3;

// Stable display order + labels for the "from cards" families.
const CARD_KIND_ORDER: ReadonlyArray<CardVictoryPointsKind> = ['resource', 'conditional', 'fixed', 'penalty'];
const CARD_KIND_LABEL: Record<CardVictoryPointsKind, string> = {
  resource: 'Resource cards',
  conditional: 'Conditional cards',
  fixed: 'Fixed VP cards',
  penalty: 'Penalties',
};
const CARD_KIND_ACCENT: Record<CardVictoryPointsKind, string> = {
  resource: 'cards-resource',
  conditional: 'cards-conditional',
  fixed: 'cards-fixed',
  penalty: 'penalty',
};

function nonZero(segments: Array<VPSegment>): Array<VPSegment> {
  return segments.filter((s) => s.value !== 0);
}

function makeScale(key: string, label: string, accent: string, segments: Array<VPSegment>): VPScale {
  let positiveTotal = 0;
  let penaltyTotal = 0;
  for (const s of segments) {
    if (s.value > 0) {
      positiveTotal += s.value;
    } else {
      penaltyTotal += s.value;
    }
  }
  return {key, label, accent, total: positiveTotal + penaltyTotal, positiveTotal, penaltyTotal, segments};
}

// ── Terraform-rating bar ──────────────────────────────────────────────
// `base` is the reconciling remainder (starting rating). It's shown in a calm
// neutral so it reads as "where you started", not an achievement; the rest
// are the genuine sources of growth.
function trScale(b: VictoryPointsBreakdown): VPScale {
  const tr = b.terraformRatingBreakdown;
  // MarsBot's direct TR comes from its board TRACK ACTIONS, not cards — the
  // honest label for the same accumulator (`terraformRatingFromCards`).
  const directTrLabel = b.automa !== undefined ? 'Track actions' : 'Cards & effects';
  const segments = nonZero([
    {key: 'tr.base', accent: 'tr-base', label: 'Starting rating', value: tr.base},
    {key: 'tr.temperature', accent: 'temperature', label: 'Temperature', value: tr.temperature},
    {key: 'tr.oxygen', accent: 'oxygen', label: 'Oxygen', value: tr.oxygen},
    {key: 'tr.oceans', accent: 'oceans', label: 'Oceans', value: tr.oceans},
    {key: 'tr.venus', accent: 'venus', label: 'Venus', value: tr.venus},
    // Ares — diegetic, never expansion-named («Очистка опасных зон»). 0/absent → filtered.
    {key: 'tr.hazards', accent: 'tr-hazards', label: 'Hazard cleanup', value: tr.hazards ?? 0},
    {key: 'tr.cards', accent: 'tr-cards', label: directTrLabel, value: tr.cards},
  ]);
  // base can fall slightly negative on heavy TR loss — clamp the SEGMENT for
  // honesty (the value chip still shows the real terraformRating).
  return makeScale('tr', 'Terraform rating', 'tr', segments);
}

// ── MarsBot scoring bar (automa-only) ─────────────────────────────────
// The Automa's scoring exceptions: remaining M€ → VP by the final-generation
// ladder, Neural Instance adjacency, and the Hard/Brutal played-pile VP.
// Present only on the bot's breakdown; every field is already inside
// `breakdown.total`, so this bar keeps the segment-sum ≡ total invariant.
function automaScale(b: VictoryPointsBreakdown): VPScale | undefined {
  const a = b.automa;
  if (a === undefined) {
    return undefined;
  }
  const scale = makeScale('automa', 'MarsBot scoring', 'automa', nonZero([
    {key: 'automa.mc', accent: 'automa-mc', label: 'M€ converted to VP', value: a.mcToVp},
    {key: 'automa.neural', accent: 'automa-neural', label: 'Neural Instance', value: a.neuralInstance},
    {key: 'automa.cards', accent: 'automa-cards', label: 'Played card icons', value: a.cardVp},
  ]));
  return scale.segments.length > 0 ? scale : undefined;
}

// ── "From cards" bar + grouped detail ─────────────────────────────────
function cardKindTotals(details: ReadonlyArray<CardVictoryPointsDetail>): Record<CardVictoryPointsKind, number> {
  const totals: Record<CardVictoryPointsKind, number> = {resource: 0, conditional: 0, fixed: 0, penalty: 0};
  for (const d of details) {
    totals[d.kind] += d.victoryPoint;
  }
  return totals;
}

function cardsScale(b: VictoryPointsBreakdown): VPScale {
  const totals = cardKindTotals(b.detailsCards);
  const segments = nonZero([
    {key: 'cards.resource', accent: 'cards-resource', label: CARD_KIND_LABEL.resource, value: totals.resource},
    {key: 'cards.conditional', accent: 'cards-conditional', label: CARD_KIND_LABEL.conditional, value: totals.conditional},
    {key: 'cards.fixed', accent: 'cards-fixed', label: CARD_KIND_LABEL.fixed, value: totals.fixed},
    {key: 'cards.penalty', accent: 'penalty', label: CARD_KIND_LABEL.penalty, value: totals.penalty, penalty: true},
  ]);
  return makeScale('cards', 'Cards', 'cards', segments);
}

function buildCardGroups(details: ReadonlyArray<CardVictoryPointsDetail>): Array<VPCardGroup> {
  const groups: Array<VPCardGroup> = [];
  for (const kind of CARD_KIND_ORDER) {
    const rows = details
      .filter((d) => d.kind === kind)
      .map((d): VPCardRow => ({
        cardName: d.cardName,
        victoryPoint: d.victoryPoint,
        kind: d.kind,
        emphasized: kind === 'conditional' && d.victoryPoint > BIG_CONDITIONAL_VP,
      }));
    if (rows.length === 0) {
      continue;
    }
    // Positives: biggest contribution first. Penalties: deepest first.
    rows.sort((a, c) => kind === 'penalty' ? a.victoryPoint - c.victoryPoint : c.victoryPoint - a.victoryPoint);
    groups.push({
      kind,
      label: CARD_KIND_LABEL[kind],
      accent: CARD_KIND_ACCENT[kind],
      total: rows.reduce((sum, r) => sum + r.victoryPoint, 0),
      rows,
    });
  }
  return groups;
}

export function buildVictoryPointsModel(b: VictoryPointsBreakdown, opts: VictoryPointsModelOptions): VictoryPointsModel {
  const scales: Array<VPScale> = [
    trScale(b),
    cardsScale(b),
    makeScale('board', 'Cities & greenery', 'city', nonZero([
      {key: 'board.city', accent: 'city', label: 'Cities', value: b.city},
      {key: 'board.greenery', accent: 'greenery', label: 'Greenery', value: b.greenery},
    ])),
    makeScale('mca', 'Milestones & awards', 'milestones', nonZero([
      {key: 'mca.milestones', accent: 'milestones', label: 'Milestones', value: b.milestones},
      {key: 'mca.awards', accent: 'awards', label: 'Awards', value: b.awards},
      // Delta Project ("Гидросеть") end-game VP lives in this family per design.
      {key: 'mca.delta', accent: 'delta', label: 'Hydronetwork', value: b.deltaProject},
    ])),
  ];

  const automa = automaScale(b);
  if (automa !== undefined) {
    scales.push(automa);
  }
  if (opts.hasMoon && (b.moonHabitats + b.moonMines + b.moonRoads) !== 0) {
    scales.push(makeScale('moon', 'Moon', 'moon', nonZero([
      {key: 'moon.habitats', accent: 'moon', label: 'Habitats', value: b.moonHabitats},
      {key: 'moon.mines', accent: 'moon-mine', label: 'Mines', value: b.moonMines},
      {key: 'moon.roads', accent: 'moon-road', label: 'Roads', value: b.moonRoads},
    ])));
  }
  if (opts.hasPathfinders && b.planetaryTracks !== 0) {
    scales.push(makeScale('tracks', 'Planetary tracks', 'tracks', [
      {key: 'tracks.all', accent: 'tracks', label: 'Planetary tracks', value: b.planetaryTracks},
    ]));
  }
  if (opts.hasEscapeVelocity && b.escapeVelocity !== 0) {
    scales.push(makeScale('ev', 'Escape Velocity', 'penalty', [
      {key: 'ev.penalty', accent: 'penalty', label: 'Escape Velocity', value: b.escapeVelocity, penalty: true},
    ]));
  }

  const maxScalePositive = scales.reduce((m, s) => Math.max(m, s.positiveTotal), 0);

  return {
    scales,
    maxScalePositive,
    cardGroups: buildCardGroups(b.detailsCards),
    grandTotal: b.total,
  };
}
