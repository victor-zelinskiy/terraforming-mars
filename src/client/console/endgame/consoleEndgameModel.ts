/*
 * CONSOLE FINAL SCORING — the pure view-model of the console-native scoring
 * ceremony (the workspace that replaces the desktop endgame reveal in
 * console mode).
 *
 * It is a RE-PROJECTION of the already-built reveal model
 * (`buildFinalScoringRevealModel` over `EndgameModel`) — the same numbers the
 * desktop reveal and the detailed results overlay show, no second source of
 * truth. What this layer adds is the CONSOLE information architecture:
 *
 *  · TOP-LEVEL CATEGORIES in the ceremony's dramaturgic order
 *    (TR → milestones → awards → greenery → cities → [moon/tracks/delta] →
 *    cards → [penalties]) — cards deliberately last among the positives: the
 *    least public information, the biggest late swing.
 *  · TWO-LEVEL reveals: TR opens as a quick run of its real sources
 *    (starting rating / temperature / oxygen / …), cards as its three
 *    families — then each settles back into ONE segment.
 *  · THE MARSBOT IS AN ORDINARY PLAYER: the legacy top-level «Подсчёт бота»
 *    group is GONE from this presentation. Its three summands are folded
 *    into the card families they factually are:
 *      mcToVp        → Resource cards   (M€ accumulated by the bot's engine,
 *                                        exchanged for VP at the end)
 *      neuralInstance → Conditional cards (board-state dependent VP)
 *      cardVp         → Fixed VP cards  (printed icons of the played pile)
 *    This is presentation only — the summands are the server's own, so the
 *    per-player category sum still equals `breakdown.total` exactly.
 *
 * Invariants (spec-guarded):
 *    Σ categories[c].values[color]            === rows[color].finalTotal
 *    Σ category.subs[s].values[color]         === category.values[color]
 *    bot: mapped card subs ≡ legacy cards+automa total — nothing lost, nothing doubled.
 *
 * NO Vue / DOM / i18n here — labels are English i18n KEYS.
 */
import {Color} from '@/common/Color';
import {EndgameMode, EndgameModel} from '@/client/components/endgame/endgameModel';
import {DIFFICULTY_LABEL} from '@/client/components/marsbot/marsBotView';
import {
  buildFinalScoringRevealModel,
  FinalScoringRevealSegment,
  RevealTieBreak,
} from '@/client/components/endgame/finalScoringRevealModel';

export type ConsoleEndgameCategoryKey =
  | 'tr' | 'milestones' | 'awards' | 'greenery' | 'city'
  | 'moon' | 'tracks' | 'delta' | 'cards' | 'penalty';

/** One sub-step of a two-level category (a TR source / a card family). */
export type ConsoleEndgameSub = {
  key: string;
  label: string; // i18n KEY
  values: Record<string, number>; // color -> signed points
};

export type ConsoleEndgameCategory = {
  key: ConsoleEndgameCategoryKey;
  label: string; // i18n KEY — the full category name (stage caption)
  /** Compact legend voice («РТ» for tr, else = label). i18n KEY. */
  legend: string;
  /** `.con-eg-cat--<accent>` colour family. */
  accent: ConsoleEndgameCategoryKey;
  values: Record<string, number>; // color -> category total
  /**
   * The micro-reveal steps. `[]` for a single-beat category; length > 1 for
   * TR / cards. Subs where every player is zero are dropped (they must not
   * stretch the ceremony) — EXCEPT the TR base, which `buildFinalScoring
   * RevealModel` already always keeps (everyone starts at a rating).
   */
  subs: ReadonlyArray<ConsoleEndgameSub>;
  /** A subtractive category (penalties): values are ≤ 0, the bar SHRINKS. */
  penalty: boolean;
};

export type ConsoleEndgameRow = {
  color: Color;
  /** DISPLAY name (the MarsBot seat is already localized by the adapter). */
  name: string;
  /** Corporation name; the bot's own corporation when the save carries one
   *  (`botCorporation` via the reveal model). '' when unknown. */
  corporation: string;
  isBot: boolean;
  /** The bot seat's difficulty LABEL (i18n key, e.g. 'Hard') — its identity
   *  line where a corpless bot shows nothing else; SECONDARY next to the
   *  corporation once the bot has one. Absent for humans. */
  difficulty?: string;
  finalTotal: number;
  megacredits: number;
  /** 1-based place; ties share the lower number (from the ranked model). */
  place: number;
  isWinner: boolean;
};

export type ConsoleEndgameVm = {
  /** Rows in NEUTRAL seating order — ranking is a ceremony STAGE, not a given. */
  rows: ReadonlyArray<ConsoleEndgameRow>;
  /** Colors in FINAL ranked order (winner first) — the FLIP target. */
  rankedColors: ReadonlyArray<Color>;
  categories: ReadonlyArray<ConsoleEndgameCategory>;
  /** Bar normalisation denominator (highest final total; never shown as text). */
  maxTotal: number;
  winner: Color | undefined;
  /** ≥ 2 entries = a SHARED victory (full tie after every tie-break). */
  winners: ReadonlyArray<Color>;
  /** Present ⇔ the top total was shared and M€ had to decide. */
  tieBreak: RevealTieBreak | undefined;
  mode: EndgameMode;
  soloWin: boolean;
  /** MarsBot won ON THE CLOCK — overrides the score comparison entirely. */
  automaClockWin: boolean;
  generation: number;
};

// ── category tables ────────────────────────────────────────────────────────

type CategoryMeta = {
  key: ConsoleEndgameCategoryKey;
  label: string;
  legend: string;
  penalty: boolean;
  /** Which reveal-model groups feed this category. */
  groups: ReadonlyArray<string>;
};

/**
 * The ceremony order. TR first (the calm base every player understands),
 * the board-and-laurels middle, CARDS last among the positives (the least
 * public category — the biggest late swing), penalties after everything
 * (they subtract from an already-standing bar, which only reads honestly
 * at the end).
 */
const CATEGORIES: ReadonlyArray<CategoryMeta> = [
  {key: 'tr', label: 'Terraform rating', legend: 'TR', penalty: false, groups: ['tr']},
  {key: 'milestones', label: 'Milestones', legend: 'Milestones', penalty: false, groups: ['milestones']},
  {key: 'awards', label: 'Awards', legend: 'Awards', penalty: false, groups: ['awards']},
  {key: 'greenery', label: 'Greenery', legend: 'Greenery', penalty: false, groups: ['greenery']},
  {key: 'city', label: 'Cities', legend: 'Cities', penalty: false, groups: ['city']},
  {key: 'moon', label: 'Moon', legend: 'Moon', penalty: false, groups: ['moon']},
  {key: 'tracks', label: 'Planetary tracks', legend: 'Planetary tracks', penalty: false, groups: ['tracks']},
  {key: 'delta', label: 'Hydronetwork', legend: 'Hydronetwork', penalty: false, groups: ['delta']},
  // 'automa' is listed as a SOURCE group here so its segments are consumed —
  // they are remapped into the card families below, never shown as their own
  // category (the whole point of the normalisation).
  {key: 'cards', label: 'Cards', legend: 'Cards', penalty: false, groups: ['cards', 'automa']},
  {key: 'penalty', label: 'Penalties', legend: 'Penalties', penalty: true, groups: ['penalty']},
];

/**
 * THE BOT NORMALISATION — the deterministic mapping of every legacy
 * «MarsBot scoring» summand onto the card family it factually is.
 * Spec-guarded: mapped ≡ legacy (no VP lost, none double-counted).
 */
const AUTOMA_SEGMENT_FAMILY: Readonly<Record<string, string>> = {
  'automa-mc': 'cards-resource', // M€ → VP conversion: the bot's engine income
  'automa-neural': 'cards-conditional', // Neural Instance: board-state dependent
  'automa-cards': 'cards-fixed', // printed icons of the played pile
};

/** The card families in the console reveal order (user-facing dramaturgy:
 *  resource → conditional → fixed — the most volatile family first, the
 *  printed certainty last). */
const CARD_FAMILY_ORDER: ReadonlyArray<{key: string; label: string}> = [
  {key: 'cards-resource', label: 'Resource cards'},
  {key: 'cards-conditional', label: 'Conditional cards'},
  {key: 'cards-fixed', label: 'Fixed VP cards'},
];

// ── helpers ────────────────────────────────────────────────────────────────

function zeroValues(colors: ReadonlyArray<Color>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of colors) {
    out[c] = 0;
  }
  return out;
}

function addValues(into: Record<string, number>, from: Record<string, number>): void {
  for (const key of Object.keys(from)) {
    into[key] = (into[key] ?? 0) + (from[key] ?? 0);
  }
}

function anyNonZero(values: Record<string, number>): boolean {
  return Object.values(values).some((v) => v !== 0);
}

/**
 * The one label that depends on WHO scored it: the TR residual is «Cards &
 * effects» for a human and «Track actions» for the bot (its TR grows from
 * track advances, not cards). In a mixed game the humans' meaning wins.
 */
function trCardsLabel(values: Record<string, number>, botColors: ReadonlySet<string>): string {
  const contributors = Object.keys(values).filter((c) => values[c] !== 0);
  if (contributors.length > 0 && contributors.every((c) => botColors.has(c))) {
    return 'Track actions';
  }
  return 'Cards & effects';
}

/** «Base rating» is the reveal model's voice; the console ceremony speaks the
 *  VP report's calmer «Starting rating» (a base, not an achievement). */
const TR_SUB_LABEL: Readonly<Record<string, string>> = {
  'tr-base': 'Starting rating',
  'tr-temperature': 'Temperature',
  'tr-oxygen': 'Oxygen',
  'tr-oceans': 'Oceans',
  'tr-venus': 'Venus',
  'tr-hazards': 'Hazard cleanup',
};

// ── the builder ────────────────────────────────────────────────────────────

export type ConsoleEndgameVmOptions = {
  /** Colors of MarsBot seats (from `PublicPlayerModel.isMarsBot`). */
  botColors?: ReadonlyArray<Color>;
};

/**
 * Build the console ceremony VM.
 *
 * @param model        the endgame model — the SAME breakdowns every other
 *                     endgame surface uses
 * @param playerOrder  neutral seating order (never ranked — no spoilers)
 */
export function buildConsoleEndgameVm(
  model: EndgameModel,
  playerOrder: ReadonlyArray<Color>,
  options?: ConsoleEndgameVmOptions,
): ConsoleEndgameVm {
  const reveal = buildFinalScoringRevealModel(model, playerOrder);
  const botColors = new Set<string>(options?.botColors ?? []);
  const colors = reveal.players.map((p) => p.color);
  const byColor = new Map(model.players.map((p) => [p.color, p]));

  const rows: Array<ConsoleEndgameRow> = reveal.players.map((p) => {
    const ranked = byColor.get(p.color);
    const difficulty = ranked?.botDifficulty;
    return {
      color: p.color,
      name: p.name,
      corporation: p.corporation,
      isBot: botColors.has(p.color),
      ...(difficulty !== undefined ? {difficulty: DIFFICULTY_LABEL[difficulty]} : {}),
      finalTotal: p.finalTotal,
      megacredits: ranked?.megacredits ?? 0,
      place: ranked?.place ?? reveal.players.length,
      isWinner: ranked?.isWinner ?? false,
    };
  });

  const segsOfGroup = (group: string): ReadonlyArray<FinalScoringRevealSegment> =>
    reveal.segments.filter((s) => s.group === group);

  const categories: Array<ConsoleEndgameCategory> = [];
  for (const meta of CATEGORIES) {
    const sourceSegs = meta.groups.flatMap((g) => [...segsOfGroup(g)]);
    if (sourceSegs.length === 0) {
      continue; // absent in this game configuration — no empty visual noise
    }

    let subs: Array<ConsoleEndgameSub>;
    if (meta.key === 'cards') {
      // Merge the human card families with the bot's remapped summands.
      const families = new Map<string, Record<string, number>>();
      for (const fam of CARD_FAMILY_ORDER) {
        families.set(fam.key, zeroValues(colors));
      }
      for (const seg of sourceSegs) {
        const target = seg.group === 'automa' ? AUTOMA_SEGMENT_FAMILY[seg.key] : seg.key;
        const bucket = target !== undefined ? families.get(target) : undefined;
        if (bucket !== undefined) {
          addValues(bucket, seg.values);
        }
      }
      subs = CARD_FAMILY_ORDER
        .map((fam) => ({key: fam.key, label: fam.label, values: families.get(fam.key) ?? {}}))
        .filter((sub) => anyNonZero(sub.values));
    } else if (meta.key === 'tr') {
      subs = sourceSegs.map((seg) => ({
        key: seg.key,
        label: seg.key === 'tr-cards' ?
          trCardsLabel(seg.values, botColors) :
          (TR_SUB_LABEL[seg.key] ?? seg.label),
        values: {...seg.values},
      }));
    } else {
      subs = sourceSegs.map((seg) => ({key: seg.key, label: seg.label, values: {...seg.values}}));
    }

    const values = zeroValues(colors);
    for (const sub of subs) {
      addValues(values, sub.values);
    }
    // A category whose merged subs all cancelled out (or were all dropped)
    // still shows if the SOURCE had movement — but with no subs left there is
    // nothing to reveal; skip it. (TR never lands here: tr-base is always kept.)
    if (subs.length === 0) {
      continue;
    }

    categories.push({
      key: meta.key,
      label: meta.label,
      legend: meta.legend,
      accent: meta.key,
      values,
      // A single sub is NOT a micro-reveal — one beat, one value.
      subs: subs.length > 1 ? subs : [],
      penalty: meta.penalty,
    });
  }

  return {
    rows,
    rankedColors: model.players.map((p) => p.color),
    categories,
    maxTotal: reveal.maxTotal,
    winner: reveal.winner,
    winners: reveal.winners,
    tieBreak: reveal.tieBreak,
    mode: reveal.mode,
    soloWin: model.soloWin,
    automaClockWin: model.automaClockWin,
    generation: reveal.generation,
  };
}

/** Running total after the first `n` categories — what the count-up shows. */
export function runningTotal(vm: ConsoleEndgameVm, color: Color, categoriesDone: number): number {
  let sum = 0;
  for (let i = 0; i < Math.min(categoriesDone, vm.categories.length); i++) {
    sum += vm.categories[i].values[color] ?? 0;
  }
  return sum;
}
