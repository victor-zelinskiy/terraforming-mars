/*
 * THE LIVE SCORE MODEL — the Information workspace's projection of ONE
 * participant's `VictoryPointsBreakdown` into the SAME category system the
 * final scoring ceremony speaks.
 *
 * WHY A THIRD PROJECTION IS NOT A THIRD SOURCE OF NUMBERS. The console had
 * two decompositions of the same breakdown: the endgame ceremony
 * (`consoleEndgameModel` — 10 categories, bot dissolved into the card
 * families) and the live Info panel (`victoryPointsModel` — 4+4 scales with
 * a standalone «Подсчёт бота» bar). Same totals, different grouping, labels
 * and colours — so live and final read as two products, and the bot carried
 * an opaque bot-only category the finale had already learned to explain.
 *
 * This module is a POLICY REUSE, not a new policy:
 *   · segments   — `FINAL_SCORING_SEGMENTS` (each pulls EXACTLY one field
 *     the server's builder summed, so Σ ≡ breakdown.total by construction);
 *   · categories — `SCORE_CATEGORY_TABLE` (the ceremony's set, order, keys
 *     — which are also the `.con-eg-cat--<key>` colour classes);
 *   · the bot    — `AUTOMA_SEGMENT_FAMILY` (mcToVp → resource cards,
 *     neuralInstance → conditional, cardVp/corpVp → fixed) — the exact
 *     normalisation the ceremony ships, spec-guarded «nothing lost,
 *     nothing doubled».
 *
 * The one thing LIVE adds is per-game category STABILITY: an LB/RB seat
 * switch must morph VALUES, never re-compose the list — so the category set
 * is derived from the GAME configuration (core always; moon/tracks/delta by
 * expansions), not from what this participant happens to have scored. A
 * zero category renders as an honest dim 0 (the endgame's own rule). The
 * penalty row is the exception: it exists only when this participant
 * actually lost points — it appends at the END, so its arrival never moves
 * another category.
 *
 * PURE: no Vue / DOM / i18n — labels are English i18n KEYS.
 */
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {FINAL_SCORING_SEGMENTS} from '@/client/components/endgame/finalScoringRevealModel';
import {
  AUTOMA_SEGMENT_FAMILY,
  CARD_FAMILY_ORDER,
  ConsoleEndgameCategoryKey,
  SCORE_CATEGORY_TABLE,
  TR_SUB_LABEL,
} from '@/client/console/endgame/consoleEndgameModel';

/** One source line inside a category (a TR source / a card family). */
export type LiveScoreSub = {
  key: string;
  label: string; // i18n KEY
  value: number; // signed
};

export type LiveScoreCategory = {
  key: ConsoleEndgameCategoryKey;
  label: string; // i18n KEY
  /** `.con-eg-cat--<accent>` — the ceremony's own colour class. */
  accent: ConsoleEndgameCategoryKey;
  value: number; // signed category total
  subs: ReadonlyArray<LiveScoreSub>; // non-zero sources, reveal order
  penalty: boolean;
};

export type LiveScoreModel = {
  /** The server's own total — and, invariant, Σ categories[].value. */
  total: number;
  categories: ReadonlyArray<LiveScoreCategory>;
  /** Σ positive category values — the summary bar's denominator half. */
  positiveTotal: number;
  /** Σ negative category values (≤ 0). */
  penaltyTotal: number;
  /** max positive category value — the detail bars' shared denominator. */
  maxCategoryValue: number;
};

export type LiveScoreOptions = {
  /** The participant is the MarsBot seat (labels the TR residual honestly). */
  isBot: boolean;
  /** Game configuration — which conditional categories exist AT THE TABLE. */
  hasMoon: boolean;
  hasPathfinders: boolean;
  hasDelta: boolean;
  /** FINAL campaign mission: «Титулы» is a real category from generation 1. */
  hasTitles?: boolean;
};

/** Category keys that exist for every game (honest 0 when unscored). */
const CORE_CATEGORIES: ReadonlySet<ConsoleEndgameCategoryKey> =
  new Set(['tr', 'milestones', 'awards', 'greenery', 'city', 'cards']);

function categoryPresent(key: ConsoleEndgameCategoryKey, value: number, opts: LiveScoreOptions): boolean {
  if (CORE_CATEGORIES.has(key)) {
    return true;
  }
  switch (key) {
  case 'moon': return opts.hasMoon || value !== 0;
  case 'tracks': return opts.hasPathfinders || value !== 0;
  case 'delta': return opts.hasDelta || value !== 0;
  // Configuration-derived like delta: present for the whole FINAL campaign
  // mission (honest 0 included), never anywhere else.
  case 'titles': return opts.hasTitles === true || value !== 0;
  // Penalties append at the END when real — a conditional row there never
  // shifts the stable categories above it.
  case 'penalty': return value !== 0;
  default: return value !== 0;
  }
}

/**
 * Build the live score projection for ONE participant.
 *
 * Invariant (spec-guarded): Σ categories[].value === breakdown.total — for
 * humans and for the bot (whose automa summands land inside `cards` via the
 * ceremony's own normalisation, never as a bot-only category).
 */
export function buildLiveScoreModel(b: VictoryPointsBreakdown, opts: LiveScoreOptions): LiveScoreModel {
  const categories: Array<LiveScoreCategory> = [];

  for (const meta of SCORE_CATEGORY_TABLE) {
    const sourceSegs = FINAL_SCORING_SEGMENTS.filter((seg) => meta.groups.includes(seg.group));

    let subs: Array<LiveScoreSub>;
    if (meta.key === 'cards') {
      // Merge the ordinary card families with the bot's remapped summands —
      // the SAME fold the ceremony performs (AUTOMA_SEGMENT_FAMILY).
      const families = new Map<string, number>();
      for (const fam of CARD_FAMILY_ORDER) {
        families.set(fam.key, 0);
      }
      for (const seg of sourceSegs) {
        const target = seg.group === 'automa' ? AUTOMA_SEGMENT_FAMILY[seg.key] : seg.key;
        if (target !== undefined && families.has(target)) {
          families.set(target, (families.get(target) ?? 0) + seg.value(b));
        }
      }
      subs = CARD_FAMILY_ORDER
        .map((fam) => ({key: fam.key, label: fam.label, value: families.get(fam.key) ?? 0}))
        .filter((sub) => sub.value !== 0);
    } else if (meta.key === 'tr') {
      subs = sourceSegs
        .map((seg) => ({
          key: seg.key,
          label: seg.key === 'tr-cards' ?
            (opts.isBot ? 'Track actions' : 'Cards & effects') :
            (TR_SUB_LABEL[seg.key] ?? seg.label),
          value: seg.value(b),
        }))
        .filter((sub) => sub.value !== 0 || sub.key === 'tr-base');
    } else {
      subs = sourceSegs
        .map((seg) => ({key: seg.key, label: seg.label, value: seg.value(b)}))
        .filter((sub) => sub.value !== 0);
    }

    const value = subs.reduce((sum, sub) => sum + sub.value, 0);
    if (!categoryPresent(meta.key, value, opts)) {
      continue;
    }
    categories.push({
      key: meta.key,
      label: meta.label,
      accent: meta.key,
      value,
      // A single source is not a breakdown — the category IS its value.
      subs: subs.length > 1 ? subs : [],
      penalty: meta.penalty,
    });
  }

  let positiveTotal = 0;
  let penaltyTotal = 0;
  let maxCategoryValue = 0;
  for (const cat of categories) {
    if (cat.value > 0) {
      positiveTotal += cat.value;
      maxCategoryValue = Math.max(maxCategoryValue, cat.value);
    } else {
      penaltyTotal += cat.value;
    }
  }

  return {
    total: b.total,
    categories,
    positiveTotal,
    penaltyTotal,
    maxCategoryValue,
  };
}
