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
 * Design notes:
 *   • Players are laid out in a NEUTRAL order (seating order passed by the
 *     caller), NOT ranked winner-first — ranking would spoil the reveal.
 *   • The categories are ordered for suspense (stable parameters first, the
 *     swingy milestones/awards near the end, penalties last) and pull EXACTLY
 *     the fields that `VictoryPointsBreakdownBuilder.updateTotal` sums, so the
 *     per-player category sum always lands on the real final total.
 *   • Only categories where at least one player scored a non-zero value are
 *     included (TR is always kept — everyone starts at a rating). Skipping an
 *     all-zero category cannot change a total (its contribution is 0).
 *   • The tie-break mirrors the engine: equal total → decided on M€.
 *
 * NO Vue / DOM / i18n here — labels are English i18n KEYS the component
 * translates (so this stays unit-testable; see finalScoringRevealModel.spec.ts).
 */
import {Color} from '@/common/Color';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {EndgameMode, EndgameModel} from '@/client/components/endgame/endgameModel';

// The categories revealed one-by-one. Each maps to a slice of the breakdown
// total. `penalty` is the negative escape-velocity deduction (shown last).
export type RevealCategoryKey =
  | 'tr' | 'greenery' | 'city' | 'cards'
  | 'milestones' | 'awards' | 'moon' | 'tracks' | 'delta' | 'penalty';

export type FinalScoringRevealCategory = {
  key: RevealCategoryKey;
  label: string; // i18n KEY
  order: number;
  // color -> points scored in this category (signed; negative for penalties)
  values: Record<string, number>;
  // true for a deduction (escape velocity) — rendered in the penalty accent.
  penalty: boolean;
};

export type FinalScoringRevealPlayer = {
  color: Color;
  name: string;
  corporation: string; // first corporation name, or '' (i18n KEY-free, raw)
  finalTotal: number;
};

// When the top total is shared, the win is decided on M€ (or stays a true tie).
export type RevealTieBreak = {
  // colors that tied on the top total, before the M€ comparison
  contenders: Array<Color>;
  metric: 'megacredits';
  // megacredits per contender (the comparison the tie-break shows)
  values: Record<string, number>;
  // single winner after the M€ comparison, or undefined for a genuine tie
  winner: Color | undefined;
};

export type FinalScoringRevealModel = {
  // Neutral (seating) order — never ranked, so the lanes don't spoil the result.
  players: Array<FinalScoringRevealPlayer>;
  // Ordered, only the categories that actually moved a score.
  categories: Array<FinalScoringRevealCategory>;
  // Single decisive winner after every tie-break (undefined = genuine shared win).
  winner: Color | undefined;
  // Everyone sharing the win (1 normally; >1 only on a genuine total+M€ tie).
  winners: Array<Color>;
  // Present only when the top total was shared (drives the dedicated tie-break step).
  tieBreak: RevealTieBreak | undefined;
  // Denominator for bar normalisation — the highest FINAL total (never shown as text).
  maxTotal: number;
  mode: EndgameMode;
  generation: number;
};

// Ordered for drama: the steady terraform/board base first, the swingy
// milestones & awards near the end, expansion extras, penalty last.
const CATEGORY_ORDER: ReadonlyArray<{key: RevealCategoryKey; label: string; penalty: boolean; value: (b: VictoryPointsBreakdown) => number; gate?: 'always'}> = [
  {key: 'tr', label: 'Terraform rating', penalty: false, value: (b) => b.terraformRating, gate: 'always'},
  {key: 'greenery', label: 'Greenery', penalty: false, value: (b) => b.greenery},
  {key: 'city', label: 'Cities', penalty: false, value: (b) => b.city},
  {key: 'cards', label: 'Cards', penalty: false, value: (b) => b.victoryPoints},
  {key: 'milestones', label: 'Milestones', penalty: false, value: (b) => b.milestones},
  {key: 'awards', label: 'Awards', penalty: false, value: (b) => b.awards},
  {key: 'moon', label: 'Moon', penalty: false, value: (b) => b.moonHabitats + b.moonMines + b.moonRoads},
  {key: 'tracks', label: 'Planetary tracks', penalty: false, value: (b) => b.planetaryTracks},
  {key: 'delta', label: 'Hydronetwork', penalty: false, value: (b) => b.deltaProject},
  {key: 'penalty', label: 'Penalty', penalty: true, value: (b) => b.escapeVelocity},
];

/**
 * Build the reveal model from the already-built endgame model.
 *
 * @param model        the endgame model (the SAME breakdowns the results screen uses)
 * @param playerOrder  neutral lane order (seating order); colors not listed go last
 */
export function buildFinalScoringRevealModel(model: EndgameModel, playerOrder: ReadonlyArray<Color>): FinalScoringRevealModel {
  // Lay lanes out in the caller's neutral order (seating), appending any
  // straggler the order forgot so no player is silently dropped.
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

  // Only keep categories that moved at least one score (TR always kept).
  const categories: Array<FinalScoringRevealCategory> = [];
  let order = 0;
  for (const meta of CATEGORY_ORDER) {
    const values: Record<string, number> = {};
    let anyNonZero = false;
    for (const p of model.players) {
      const v = meta.value(p.breakdown);
      values[p.color] = v;
      if (v !== 0) {
        anyNonZero = true;
      }
    }
    if (anyNonZero || meta.gate === 'always') {
      categories.push({key: meta.key, label: meta.label, order: order++, values, penalty: meta.penalty});
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
    // Solo: the "winner" is the player only when the game was actually won.
    winner = model.soloWin ? model.players[0]?.color : undefined;
    winners = winner !== undefined ? [winner] : [];
  }

  return {
    players,
    categories,
    winner,
    winners,
    tieBreak,
    maxTotal: Math.max(1, topTotal),
    mode: model.mode,
    generation: model.generation,
  };
}

// Shared so the component and tests don't re-declare the ordered label list.
export const REVEAL_CATEGORY_LABEL: Record<RevealCategoryKey, string> =
  CATEGORY_ORDER.reduce((acc, m) => {
    acc[m.key] = m.label;
    return acc;
  }, {} as Record<RevealCategoryKey, string>);
