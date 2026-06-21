/*
 * Pure, framework-agnostic adapter for the premium FINAL SCORING REVEAL — the
 * Wingspan-style "reveal the result category by category" screen shown before
 * the detailed results overlay when the game was played in HIDDEN-VP mode
 * (`gameOptions.showOtherPlayersVP === false`).
 *
 * It is a thin re-projection of the already-built `EndgameModel`, so the reveal
 * and the detailed results screen are driven by the SAME numbers — there is no
 * second source of truth and no risk of the totals diverging.
 *
 * Two granularities, ONE set of numbers:
 *   • `segments` — the FLAT reveal order. Terraform rating is split into the
 *     SAME sub-parts the detailed score report shows
 *     (`terraformRatingBreakdown`: base / temperature / oxygen / oceans /
 *     venus / cards), reusing its exact labels + accents, so РТ never lands as
 *     one big monolith and the reveal and the report can't disagree. Each
 *     segment pulls EXACTLY one field that `VictoryPointsBreakdownBuilder`
 *     sums, so the per-player segment sum always equals the real final total.
 *   • `groups` — the GROUP level (TR / greenery / cities / cards / …) shown as
 *     pills + chips. A group's value is the sum of its segments.
 *
 * Suspense rules:
 *   • Players are laid out in a NEUTRAL order (seating order passed by the
 *     caller), NOT ranked winner-first — ranking would spoil the reveal.
 *   • Segments are ordered for drama (the steady terraform/board base first,
 *     the swingy milestones/awards near the end, penalties last).
 *   • Only segments where at least one player scored a non-zero value are
 *     included (the TR base is always kept — everyone starts at a rating).
 *
 * NO Vue / DOM / i18n here — labels are English i18n KEYS the component
 * translates (so this stays unit-testable; see finalScoringRevealModel.spec.ts).
 */
import {Color} from '@/common/Color';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {EndgameMode, EndgameModel} from '@/client/components/endgame/endgameModel';

// The top-level scoring GROUPS shown as pills + lane chips.
export type RevealGroupKey =
  | 'tr' | 'greenery' | 'city' | 'cards'
  | 'milestones' | 'awards' | 'moon' | 'tracks' | 'delta' | 'penalty';

export type FinalScoringRevealSegment = {
  // Unique colour/identity key — drives the `.fsr-cat--<key>` accent. For TR
  // sub-parts this is 'tr-base' / 'tr-temperature' / … ; otherwise == group.
  key: string;
  group: RevealGroupKey;
  label: string; // i18n KEY (the sub-part name, e.g. 'Temperature' / 'Cards')
  order: number; // global reveal order
  // color -> points scored in this segment (signed; negative for penalties)
  values: Record<string, number>;
  penalty: boolean;
};

export type FinalScoringRevealGroup = {
  key: RevealGroupKey;
  label: string; // i18n KEY (group name, e.g. 'Terraform rating')
  accent: string; // representative `.fsr-cat--<accent>` colour for pill/chip
  description: string; // i18n KEY — short inspector description
  order: number; // group order (index of its first segment)
  // global reveal indices of this group's segments (into `segments`)
  segmentIndexes: ReadonlyArray<number>;
  // color -> group total (sum of its segments)
  values: Record<string, number>;
};

export type FinalScoringRevealPlayer = {
  color: Color;
  name: string;
  corporation: string;
  finalTotal: number;
};

export type RevealTieBreak = {
  contenders: Array<Color>;
  metric: 'megacredits';
  values: Record<string, number>;
  winner: Color | undefined;
};

export type FinalScoringRevealModel = {
  players: Array<FinalScoringRevealPlayer>;
  segments: Array<FinalScoringRevealSegment>;
  groups: Array<FinalScoringRevealGroup>;
  winner: Color | undefined;
  winners: Array<Color>;
  tieBreak: RevealTieBreak | undefined;
  // Denominator for bar normalisation — the highest FINAL total (never shown as text).
  maxTotal: number;
  mode: EndgameMode;
  generation: number;
};

type SegMeta = {key: string; group: RevealGroupKey; label: string; penalty: boolean; always?: boolean; value: (b: VictoryPointsBreakdown) => number};

// Ordered for drama. TR is split into the SAME sub-parts (labels + accents) the
// detailed VP report uses (`victoryPointsModel.trScale`) so the two never diverge.
const SEGMENTS: ReadonlyArray<SegMeta> = [
  {key: 'tr-base', group: 'tr', label: 'Starting rating', penalty: false, always: true, value: (b) => b.terraformRatingBreakdown.base},
  {key: 'tr-temperature', group: 'tr', label: 'Temperature', penalty: false, value: (b) => b.terraformRatingBreakdown.temperature},
  {key: 'tr-oxygen', group: 'tr', label: 'Oxygen', penalty: false, value: (b) => b.terraformRatingBreakdown.oxygen},
  {key: 'tr-oceans', group: 'tr', label: 'Oceans', penalty: false, value: (b) => b.terraformRatingBreakdown.oceans},
  {key: 'tr-venus', group: 'tr', label: 'Venus', penalty: false, value: (b) => b.terraformRatingBreakdown.venus},
  {key: 'tr-cards', group: 'tr', label: 'Cards & effects', penalty: false, value: (b) => b.terraformRatingBreakdown.cards},
  {key: 'greenery', group: 'greenery', label: 'Greenery', penalty: false, value: (b) => b.greenery},
  {key: 'city', group: 'city', label: 'Cities', penalty: false, value: (b) => b.city},
  {key: 'cards', group: 'cards', label: 'Cards', penalty: false, value: (b) => b.victoryPoints},
  {key: 'milestones', group: 'milestones', label: 'Milestones', penalty: false, value: (b) => b.milestones},
  {key: 'awards', group: 'awards', label: 'Awards', penalty: false, value: (b) => b.awards},
  {key: 'moon', group: 'moon', label: 'Moon', penalty: false, value: (b) => b.moonHabitats + b.moonMines + b.moonRoads},
  {key: 'tracks', group: 'tracks', label: 'Planetary tracks', penalty: false, value: (b) => b.planetaryTracks},
  {key: 'delta', group: 'delta', label: 'Hydronetwork', penalty: false, value: (b) => b.deltaProject},
  {key: 'penalty', group: 'penalty', label: 'Escape Velocity', penalty: true, value: (b) => b.escapeVelocity},
];

const GROUP_META: Record<RevealGroupKey, {label: string; accent: string; description: string}> = {
  tr: {label: 'Terraform rating', accent: 'tr-cards', description: 'Your terraform rating and what raised it'},
  greenery: {label: 'Greenery', accent: 'greenery', description: 'VP from greenery tiles'},
  city: {label: 'Cities', accent: 'city', description: 'VP from cities next to greeneries'},
  cards: {label: 'Cards', accent: 'cards', description: 'VP printed on and stored by your cards'},
  milestones: {label: 'Milestones', accent: 'milestones', description: 'Milestones you claimed'},
  awards: {label: 'Awards', accent: 'awards', description: 'Awards you placed in'},
  moon: {label: 'Moon', accent: 'moon', description: 'Lunar habitats, mines and roads'},
  tracks: {label: 'Planetary tracks', accent: 'tracks', description: 'Planetary track positions'},
  delta: {label: 'Hydronetwork', accent: 'delta', description: 'Hydronetwork end-game VP'},
  penalty: {label: 'Escape Velocity', accent: 'penalty', description: 'Escape Velocity penalty'},
};

const GROUP_ORDER: ReadonlyArray<RevealGroupKey> = ['tr', 'greenery', 'city', 'cards', 'milestones', 'awards', 'moon', 'tracks', 'delta', 'penalty'];

/**
 * Build the reveal model from the already-built endgame model.
 *
 * @param model        the endgame model (the SAME breakdowns the results screen uses)
 * @param playerOrder  neutral lane order (seating order); colors not listed go last
 */
export function buildFinalScoringRevealModel(model: EndgameModel, playerOrder: ReadonlyArray<Color>): FinalScoringRevealModel {
  // Lay lanes out in the caller's neutral order, appending stragglers so no
  // player is silently dropped.
  const byColor = new Map(model.players.map((p) => [p.color, p]));
  const orderedColors: Array<Color> = [];
  for (const c of playerOrder) {
    if (byColor.has(c)) {
      orderedColors.push(c);
    }
  }
  for (const p of model.players) {
    if (!orderedColors.includes(p.color)) {
      orderedColors.push(p.color);
    }
  }

  const players: Array<FinalScoringRevealPlayer> = [];
  for (const color of orderedColors) {
    const p = byColor.get(color);
    if (p === undefined) {
      continue;
    }
    players.push({
      color: p.color,
      name: p.name,
      corporation: p.corporations.length > 0 ? p.corporations[0] : '',
      finalTotal: p.breakdown.total,
    });
  }

  // Flat reveal segments (only those that moved a score; TR base always kept).
  const segments: Array<FinalScoringRevealSegment> = [];
  for (const meta of SEGMENTS) {
    const values: Record<string, number> = {};
    let anyNonZero = false;
    for (const p of model.players) {
      const v = meta.value(p.breakdown);
      values[p.color] = v;
      if (v !== 0) {
        anyNonZero = true;
      }
    }
    if (anyNonZero || meta.always === true) {
      segments.push({key: meta.key, group: meta.group, label: meta.label, order: segments.length, values, penalty: meta.penalty});
    }
  }

  // Derive the groups present (in canonical order), each summing its segments.
  const groups: Array<FinalScoringRevealGroup> = [];
  for (const gkey of GROUP_ORDER) {
    const segmentIndexes: Array<number> = [];
    const values: Record<string, number> = {};
    for (const p of model.players) {
      values[p.color] = 0;
    }
    segments.forEach((seg, i) => {
      if (seg.group === gkey) {
        segmentIndexes.push(i);
        for (const p of model.players) {
          values[p.color] += seg.values[p.color] ?? 0;
        }
      }
    });
    if (segmentIndexes.length > 0) {
      const m = GROUP_META[gkey];
      groups.push({key: gkey, label: m.label, accent: m.accent, description: m.description, order: groups.length, segmentIndexes, values});
    }
  }

  // Tie-break: highest total wins, equal total decided on M€ (engine rule).
  const totals = model.players.map((p) => p.breakdown.total);
  const topTotal = totals.length > 0 ? Math.max(...totals) : 0;
  const topByTotal = model.players.filter((p) => p.breakdown.total === topTotal);

  let tieBreak: RevealTieBreak | undefined;
  let winner: Color | undefined = model.winner?.color;
  let winners: Array<Color> = winner !== undefined ? [winner] : [];

  if (model.mode !== 'solo' && topByTotal.length > 1) {
    const maxMc = Math.max(...topByTotal.map((p) => p.megacredits));
    const coWinners = topByTotal.filter((p) => p.megacredits === maxMc).map((p) => p.color);
    winners = coWinners;
    winner = coWinners.length === 1 ? coWinners[0] : undefined;
    const values: Record<string, number> = {};
    for (const p of topByTotal) {
      values[p.color] = p.megacredits;
    }
    tieBreak = {contenders: topByTotal.map((p) => p.color), metric: 'megacredits', values, winner};
  } else if (model.mode === 'solo') {
    winner = model.soloWin ? model.players[0]?.color : undefined;
    winners = winner !== undefined ? [winner] : [];
  }

  return {
    players,
    segments,
    groups,
    winner,
    winners,
    tieBreak,
    maxTotal: Math.max(1, topTotal),
    mode: model.mode,
    generation: model.generation,
  };
}
