/*
 * Pure, framework-agnostic model builder for the premium END-OF-GAME report.
 *
 * Turns the per-player end-state (each player's `VictoryPointsBreakdown`, VP-by-
 * generation series and global-parameter contributions) into the analytic model
 * the endgame overlay renders:
 *   • `players`     — ranked standings (winner first), each with headline
 *                     category values + top scoring cards + parameter steps.
 *   • `mode`        — 'solo' | 'duel' (exactly 2 players) | 'standings' (3+).
 *   • `categories`  — VP categories with a per-player value + the leader(s), so
 *                     the overview can show "who won what" at a glance.
 *   • `parameters`  — per-global-parameter contribution (steps) + leader(s).
 *   • `insights`    — rule-based, structured "why won / how it was decided"
 *                     tokens the component renders into translated sentences.
 *
 * NO Vue / DOM / i18n here — labels are English i18n KEYS the component
 * translates, so this stays unit-testable (see endgameModel.spec.ts). Corp
 * names are resolved by the caller (needs the client card manifest) and passed
 * in via `EndgamePlayerInput.corporations`, keeping this module client-free.
 */
import {Color} from '@/common/Color';
import {GlobalParameter} from '@/common/GlobalParameter';
import {CardVictoryPointsDetail, CardVictoryPointsKind, VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';

// What the builder needs from each player — a thin, pure projection of
// PublicPlayerModel (the component maps it before calling the builder).
export type EndgamePlayerInput = {
  color: Color;
  name: string;
  corporations: ReadonlyArray<string>;
  megacredits: number;
  breakdown: VictoryPointsBreakdown;
  vpByGeneration: ReadonlyArray<number>;
  globalSteps: Partial<Record<GlobalParameter, number>>;
};

export type EndgameModelOptions = {
  hasMoon: boolean;
  hasPathfinders: boolean;
  hasVenus: boolean;
  generation: number;
  // game.isSoloModeWin — only meaningful for a solo game.
  soloWin?: boolean;
};

// The major VP families compared across players ("who won what").
export type EndgameCategoryKey = 'tr' | 'cards' | 'board' | 'mca' | 'moon' | 'tracks';

export type EndgameCategory = {
  key: EndgameCategoryKey;
  label: string; // i18n KEY
  accent: string; // victory_points.less accent family — reused for colour
  values: Record<string, number>; // color -> value
  max: number;
  leaders: Array<Color>; // who holds the max (>0); empty if all zero
};

export type EndgameParameter = {
  key: GlobalParameter;
  label: string; // i18n KEY
  accent: string;
  values: Record<string, number>; // color -> steps contributed
  max: number;
  leaders: Array<Color>;
};

export type EndgameTopCard = {
  cardName: string;
  victoryPoint: number;
  kind: CardVictoryPointsKind;
};

export type EndgamePlayerScore = {
  color: Color;
  name: string;
  corporations: ReadonlyArray<string>;
  place: number; // 1-based, ties share the lower place number
  isWinner: boolean;
  total: number;
  megacredits: number;
  breakdown: VictoryPointsBreakdown;
  vpByGeneration: ReadonlyArray<number>;
  categories: Record<EndgameCategoryKey, number>;
  // The player's biggest VP cards (positives desc), penalties excluded — used
  // for "key cards" callouts.
  topCards: Array<EndgameTopCard>;
  penaltyCards: Array<EndgameTopCard>;
  globalSteps: Partial<Record<GlobalParameter, number>>;
  parametersTotal: number;
  // The single category this player scored the most in (their identity).
  strongestCategory: EndgameCategoryKey | undefined;
};

// Structured, rule-based narrative tokens. The component composes the actual
// translated sentence from `kind` + the referenced players / categories.
export type EndgameInsightKind =
  | 'winner-strength' // winner's standout categories
  | 'runnerup-strength' // what the runner-up was better at
  | 'lead-taken' // the generation the winner took the (final) lead
  | 'wire-to-wire' // winner led from the first generation
  | 'margin'; // final point gap to 2nd

export type EndgameInsight = {
  kind: EndgameInsightKind;
  player?: Color;
  otherPlayer?: Color;
  categories?: Array<EndgameCategoryKey>;
  value?: number;
  gen?: number;
};

export type EndgameMode = 'solo' | 'duel' | 'standings';

export type EndgameModel = {
  mode: EndgameMode;
  players: Array<EndgamePlayerScore>; // ranked, winner first
  winner: EndgamePlayerScore | undefined;
  runnerUp: EndgamePlayerScore | undefined;
  margin: number; // winner.total - runnerUp.total (0 for solo)
  categories: Array<EndgameCategory>; // only categories with any non-zero value
  parameters: Array<EndgameParameter>;
  insights: Array<EndgameInsight>;
  generation: number;
  soloWin: boolean;
  // Generation (1-based) the eventual winner took the lead and never lost it.
  // undefined when they led from generation 1 (wire-to-wire) or it's solo.
  winnerTookLeadGen: number | undefined;
};

const CATEGORY_LABEL: Record<EndgameCategoryKey, string> = {
  tr: 'Terraform rating',
  cards: 'Cards',
  board: 'Cities & greenery',
  mca: 'Milestones & awards',
  moon: 'Moon',
  tracks: 'Planetary tracks',
};
const CATEGORY_ACCENT: Record<EndgameCategoryKey, string> = {
  tr: 'tr-cards',
  cards: 'cards-resource',
  board: 'greenery',
  mca: 'milestones',
  moon: 'moon',
  tracks: 'tracks',
};

const PARAMETER_META: ReadonlyArray<{key: GlobalParameter; label: string; accent: string}> = [
  {key: GlobalParameter.TEMPERATURE, label: 'Temperature', accent: 'temperature'},
  {key: GlobalParameter.OXYGEN, label: 'Oxygen', accent: 'oxygen'},
  {key: GlobalParameter.OCEANS, label: 'Oceans', accent: 'oceans'},
  {key: GlobalParameter.VENUS, label: 'Venus', accent: 'venus'},
  {key: GlobalParameter.MOON_HABITAT_RATE, label: 'L. Habitat', accent: 'moon'},
  {key: GlobalParameter.MOON_MINING_RATE, label: 'L. Mining', accent: 'moon-mine'},
  {key: GlobalParameter.MOON_LOGISTIC_RATE, label: 'L. Logistic', accent: 'moon-road'},
];

function categoryValue(b: VictoryPointsBreakdown, key: EndgameCategoryKey): number {
  switch (key) {
  case 'tr': return b.terraformRating;
  case 'cards': return b.victoryPoints;
  case 'board': return b.city + b.greenery;
  case 'mca': return b.milestones + b.awards;
  case 'moon': return b.moonHabitats + b.moonMines + b.moonRoads;
  case 'tracks': return b.planetaryTracks;
  }
}

function leadersOf(values: Record<string, number>): {max: number; leaders: Array<Color>} {
  let max = 0;
  for (const v of Object.values(values)) {
    if (v > max) {
      max = v;
    }
  }
  const leaders: Array<Color> = [];
  if (max > 0) {
    for (const [color, v] of Object.entries(values)) {
      if (v === max) {
        leaders.push(color as Color);
      }
    }
  }
  return {max, leaders};
}

// Tiebreak mirrors the legacy game-end: higher total wins, then higher M€.
function compareScores(a: EndgamePlayerInput, b: EndgamePlayerInput): number {
  const at = a.breakdown.total;
  const bt = b.breakdown.total;
  if (at !== bt) {
    return bt - at;
  }
  return b.megacredits - a.megacredits;
}

function topCardsOf(details: ReadonlyArray<CardVictoryPointsDetail>): {top: Array<EndgameTopCard>; penalties: Array<EndgameTopCard>} {
  const top: Array<EndgameTopCard> = [];
  const penalties: Array<EndgameTopCard> = [];
  for (const d of details) {
    const card: EndgameTopCard = {cardName: d.cardName, victoryPoint: d.victoryPoint, kind: d.kind};
    if (d.victoryPoint < 0 || d.kind === 'penalty') {
      penalties.push(card);
    } else if (d.victoryPoint > 0) {
      top.push(card);
    }
  }
  top.sort((x, y) => y.victoryPoint - x.victoryPoint);
  penalties.sort((x, y) => x.victoryPoint - y.victoryPoint);
  return {top, penalties};
}

function strongestCategoryOf(categories: Record<EndgameCategoryKey, number>, present: ReadonlyArray<EndgameCategoryKey>): EndgameCategoryKey | undefined {
  let best: EndgameCategoryKey | undefined;
  let bestVal = 0;
  for (const key of present) {
    const v = categories[key];
    if (v > bestVal) {
      bestVal = v;
      best = key;
    }
  }
  return best;
}

// The generation (1-based) the eventual winner first held a strict, never-lost
// lead. Reads each player's cumulative VP-by-generation series. Returns
// undefined when the winner led from generation 1 (wire-to-wire).
function computeWinnerTookLeadGen(winner: EndgamePlayerInput, others: ReadonlyArray<EndgamePlayerInput>, generation: number): number | undefined {
  const len = Math.min(
    winner.vpByGeneration.length,
    ...others.map((o) => o.vpByGeneration.length),
    generation,
  );
  if (len <= 0 || others.length === 0) {
    return undefined;
  }
  // Find the LAST generation where the winner was NOT strictly ahead of all
  // others; they took the final lead the generation after that.
  let lastNotAhead = -1;
  for (let g = 0; g < len; g++) {
    const w = winner.vpByGeneration[g];
    let ahead = true;
    for (const o of others) {
      if (o.vpByGeneration[g] >= w) {
        ahead = false;
        break;
      }
    }
    if (!ahead) {
      lastNotAhead = g;
    }
  }
  if (lastNotAhead < 0) {
    return undefined; // strictly ahead the whole game
  }
  if (lastNotAhead + 1 >= len) {
    return undefined; // never pulled clearly ahead — don't claim a moment
  }
  return lastNotAhead + 2; // +1 for next gen, +1 for 1-based generation
}

function buildInsights(
  model: Pick<EndgameModel, 'mode' | 'winner' | 'runnerUp' | 'margin' | 'categories' | 'winnerTookLeadGen'>,
): Array<EndgameInsight> {
  const insights: Array<EndgameInsight> = [];
  const {winner, runnerUp} = model;
  if (winner === undefined || model.mode === 'solo') {
    return insights;
  }

  // Per category, the winner's lead over the best opponent.
  const winnerLeads: Array<{key: EndgameCategoryKey; lead: number}> = [];
  const runnerLeads: Array<{key: EndgameCategoryKey; lead: number}> = [];
  for (const cat of model.categories) {
    const wv = cat.values[winner.color] ?? 0;
    let bestOther = 0;
    let runnerVal = 0;
    for (const [color, v] of Object.entries(cat.values)) {
      if (color !== winner.color && v > bestOther) {
        bestOther = v;
      }
      if (runnerUp !== undefined && color === runnerUp.color) {
        runnerVal = v;
      }
    }
    if (wv > bestOther) {
      winnerLeads.push({key: cat.key, lead: wv - bestOther});
    }
    // Runner-up's edge over the winner specifically (duel-flavoured).
    if (runnerUp !== undefined && runnerVal > wv) {
      runnerLeads.push({key: cat.key, lead: runnerVal - wv});
    }
  }
  winnerLeads.sort((a, b) => b.lead - a.lead);
  runnerLeads.sort((a, b) => b.lead - a.lead);

  if (winnerLeads.length > 0) {
    insights.push({
      kind: 'winner-strength',
      player: winner.color,
      categories: winnerLeads.slice(0, 2).map((l) => l.key),
    });
  }
  if (model.winnerTookLeadGen !== undefined) {
    insights.push({kind: 'lead-taken', player: winner.color, gen: model.winnerTookLeadGen});
  } else if (winnerLeads.length > 0) {
    insights.push({kind: 'wire-to-wire', player: winner.color});
  }
  if (runnerUp !== undefined && runnerLeads.length > 0) {
    insights.push({
      kind: 'runnerup-strength',
      player: runnerUp.color,
      otherPlayer: winner.color,
      categories: runnerLeads.slice(0, 2).map((l) => l.key),
    });
  }
  insights.push({kind: 'margin', player: winner.color, otherPlayer: runnerUp?.color, value: model.margin});
  return insights;
}

export function buildEndgameModel(inputs: ReadonlyArray<EndgamePlayerInput>, opts: EndgameModelOptions): EndgameModel {
  const ranked = [...inputs].sort(compareScores);
  const mode: EndgameMode = ranked.length <= 1 ? 'solo' : (ranked.length === 2 ? 'duel' : 'standings');

  // Which VP categories are present at all (any player scored non-zero, gated
  // by the active expansions) — drives the "who won what" set + score bars.
  const presentCategories: Array<EndgameCategoryKey> = [];
  const allCategoryKeys: Array<EndgameCategoryKey> = ['tr', 'cards', 'board', 'mca'];
  if (opts.hasMoon) {
    allCategoryKeys.push('moon');
  }
  if (opts.hasPathfinders) {
    allCategoryKeys.push('tracks');
  }
  for (const key of allCategoryKeys) {
    const anyNonZero = ranked.some((p) => categoryValue(p.breakdown, key) !== 0);
    if (anyNonZero || key === 'tr' || key === 'cards' || key === 'board' || key === 'mca') {
      presentCategories.push(key);
    }
  }

  const topVal = ranked.length > 0 ? ranked[0].breakdown.total : 0;
  const topMc = ranked.length > 0 ? ranked[0].megacredits : 0;

  const players: Array<EndgamePlayerScore> = ranked.map((p, i) => {
    const isWinner = mode === 'solo' ? (opts.soloWin === true) : (p.breakdown.total === topVal && p.megacredits === topMc);
    const categories = {} as Record<EndgameCategoryKey, number>;
    for (const key of allCategoryKeys) {
      categories[key] = categoryValue(p.breakdown, key);
    }
    const {top, penalties} = topCardsOf(p.breakdown.detailsCards);
    let parametersTotal = 0;
    for (const v of Object.values(p.globalSteps)) {
      parametersTotal += v ?? 0;
    }
    return {
      color: p.color,
      name: p.name,
      corporations: p.corporations,
      place: i + 1,
      isWinner,
      total: p.breakdown.total,
      megacredits: p.megacredits,
      breakdown: p.breakdown,
      vpByGeneration: p.vpByGeneration,
      categories,
      topCards: top,
      penaltyCards: penalties,
      globalSteps: p.globalSteps,
      parametersTotal,
      strongestCategory: strongestCategoryOf(categories, presentCategories),
    };
  });

  // Collapse tied places to the lower place number (1,1,3 …).
  for (let i = 1; i < players.length; i++) {
    const prev = players[i - 1];
    const cur = players[i];
    if (cur.total === prev.total && cur.megacredits === prev.megacredits) {
      cur.place = prev.place;
    }
  }

  const categories: Array<EndgameCategory> = presentCategories.map((key) => {
    const values: Record<string, number> = {};
    for (const p of ranked) {
      values[p.color] = categoryValue(p.breakdown, key);
    }
    const {max, leaders} = leadersOf(values);
    return {key, label: CATEGORY_LABEL[key], accent: CATEGORY_ACCENT[key], values, max, leaders};
  });

  const parameters: Array<EndgameParameter> = PARAMETER_META
    .filter((meta) => {
      if (meta.key === GlobalParameter.VENUS) {
        return opts.hasVenus;
      }
      if (meta.key === GlobalParameter.MOON_HABITAT_RATE || meta.key === GlobalParameter.MOON_MINING_RATE || meta.key === GlobalParameter.MOON_LOGISTIC_RATE) {
        return opts.hasMoon;
      }
      return true;
    })
    .map((meta) => {
      const values: Record<string, number> = {};
      for (const p of ranked) {
        values[p.color] = p.globalSteps[meta.key] ?? 0;
      }
      const {max, leaders} = leadersOf(values);
      return {key: meta.key, label: meta.label, accent: meta.accent, values, max, leaders};
    })
    // Drop a parameter nobody touched (keeps the contribution view tight).
    .filter((param) => param.max > 0);

  const winner = players.find((p) => p.isWinner) ?? players[0];
  const runnerUp = players.find((p) => !p.isWinner && p.place > (winner?.place ?? 0));
  const margin = winner !== undefined && runnerUp !== undefined ? winner.total - runnerUp.total : 0;

  let winnerTookLeadGen: number | undefined;
  if (mode !== 'solo' && winner !== undefined) {
    const winnerInput = ranked.find((p) => p.color === winner.color);
    const others = ranked.filter((p) => p.color !== winner.color);
    if (winnerInput !== undefined) {
      winnerTookLeadGen = computeWinnerTookLeadGen(winnerInput, others, opts.generation);
    }
  }

  const insights = buildInsights({mode, winner, runnerUp, margin, categories, winnerTookLeadGen});

  return {
    mode,
    players,
    winner,
    runnerUp,
    margin,
    categories,
    parameters,
    insights,
    generation: opts.generation,
    soloWin: opts.soloWin === true,
    winnerTookLeadGen,
  };
}

// Shared label/accent lookups so components and tests don't re-declare them.
export const ENDGAME_CATEGORY_LABEL = CATEGORY_LABEL;
export const ENDGAME_CATEGORY_ACCENT = CATEGORY_ACCENT;
