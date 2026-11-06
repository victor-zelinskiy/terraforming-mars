import {CardName} from '../../../common/cards/CardName';
import {TrackDefinition} from '../../../common/automa/AutomaTypes';
import {newProjectCard} from '../../createCard';
import {BotCriterion, TrackRef} from './BotMARule';
import {botAwardRule, botMilestoneRule} from './botMAInterpreter';
import {pileAmount, pilePredicate} from './pilePredicates';

/**
 * REACHABILITY — can the bot's criterion get anywhere on THIS mat in THIS configuration? A STATIC answer (no game
 * state): the track a ref names exists and is long enough, the deck holds enough cards for a pile criterion, the mat
 * prints enough token cells, the expansion a counter needs is on. The random-set validator asks it of every milestone
 * (`target`) and every award (`1` — a non-zero score), and the generator's report names what it says.
 *
 * «Not in this configuration» is an honest answer, never a zero rule: T. Politician without a Parliament, Martian
 * without Mars-tagged cards in the deck — a human in that game could not score either.
 */
export type MatConfig = {
  readonly tracks: ReadonlyArray<TrackDefinition>;
  readonly venus: boolean;
  readonly colonies: boolean;
  readonly parliament: boolean;
  /** The game's project deck — what a pile criterion and a reveal helper can ever meet. */
  readonly deck: ReadonlyArray<CardName>;
};

export type Reachability = {readonly ok: true} | {readonly ok: false, readonly reason: string};

const OK: Reachability = {ok: true};

function trackOf(ref: TrackRef, config: MatConfig): TrackDefinition | undefined {
  return config.tracks.find((t) => ('role' in ref && t.role === ref.role) || ('tag' in ref && t.tags.includes(ref.tag)) ||
    ('production' in ref && t.productions.includes(ref.production)));
}

function maxOf(track: TrackDefinition): number {
  return track.maxPosition ?? 18;
}

/** Deck readings are a pure function of (deck, reading) — cached per deck array, the validator asks thousands. */
const deckCache = new WeakMap<ReadonlyArray<CardName>, Map<string, number>>();

function deckCount(config: MatConfig, key: string, count: (name: CardName) => number): number {
  let cache = deckCache.get(config.deck);
  if (cache === undefined) {
    cache = new Map();
    deckCache.set(config.deck, cache);
  }
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const value = config.deck.reduce((sum, name) => sum + count(name), 0);
  cache.set(key, value);
  return value;
}

/** The most a criterion can read on this mat / in this deck. */
export function criterionCeiling(criterion: BotCriterion, config: MatConfig): number {
  switch (criterion.kind) {
  case 'track': {
    const track = trackOf(criterion.track, config);
    if (track === undefined) {
      return 0;
    }
    return Math.floor((maxOf(track) * (criterion.times ?? 1)) / (criterion.div ?? 1)) + (criterion.plus ?? 0);
  }
  case 'tracks': {
    const tracks = criterion.of === 'all' ? config.tracks :
      criterion.of === 'martian' ? config.tracks.filter((t) => t.role !== 'venus') :
        criterion.of.map((ref) => trackOf(ref, config)).filter((t): t is TrackDefinition => t !== undefined);
    const maxes = tracks.map(maxOf);
    let value = 0;
    switch (criterion.op) {
    case 'sum': value = maxes.reduce((a, b) => a + b, 0); break;
    case 'max': value = maxes.length === 0 ? 0 : Math.max(...maxes); break;
    case 'min': value = maxes.length === 0 ? 0 : Math.min(...maxes); break;
    case 'countAtLeast': value = maxes.filter((m) => m >= (criterion.at ?? 0)).length; break;
    case 'sumTop': value = [...maxes].sort((a, b) => b - a).slice(0, criterion.top ?? maxes.length).reduce((a, b) => a + b, 0); break;
    }
    // A named ref the mat lacks counts as 0 (the honest reading) — for a `min`, that is the ceiling.
    if (criterion.op === 'min' && criterion.missing !== 'leave-out' && typeof criterion.of !== 'string' && tracks.length < criterion.of.length) {
      value = 0;
    }
    return value * (criterion.times ?? 1) + (criterion.plus ?? 0);
  }
  case 'megacredits':
    return Number.MAX_SAFE_INTEGER;
  case 'pile': {
    let value: number;
    if ('count' in criterion) {
      const matches = pilePredicate(criterion.count);
      value = deckCount(config, `count:${criterion.count}`, (name) => {
        const card = newProjectCard(name);
        return card !== undefined && matches(card) ? 1 : 0;
      });
    } else if ('sum' in criterion) {
      const amount = pileAmount(criterion.sum);
      value = deckCount(config, `sum:${criterion.sum}`, (name) => {
        const card = newProjectCard(name);
        return card === undefined ? 0 : amount(card);
      });
    } else {
      value = Math.min(...criterion.minOf.map((id) => deckCount(config, `count:${id}`, (name) => {
        const card = newProjectCard(name);
        return card !== undefined && pilePredicate(id)(card) ? 1 : 0;
      })));
    }
    return value + (criterion.plus ?? 0);
  }
  case 'counter':
    switch (criterion.counter) {
    case 'floaters':
      return config.venus || config.colonies ? Number.MAX_SAFE_INTEGER : 0;
    case 'tokens:data':
    case 'tokens:fighter': {
      const kind = criterion.counter.substring(7);
      return config.tracks.reduce((sum, t) => sum + t.layout.reduce((s, a) =>
        s + (a === `token_${kind}` ? 1 : a === `token2_${kind}` ? 2 : 0), 0), 0);
    }
    default:
      return Number.MAX_SAFE_INTEGER;
    }
  case 'allOf':
    return criterion.of.filter((part) => criterionCeiling(part.criterion, config) >= part.target).length;
  case 'player':
  case 'rating':
    return Number.MAX_SAFE_INTEGER;
  case 'zero':
    return 0;
  }
}

/** Names whose «as usual» reading needs a module the configuration may lack. */
const NEEDS_PARLIAMENT: ReadonlyArray<string> = ['T. Politician', 'Activist', 'Influencer'];

export function milestoneReachable(name: string, config: MatConfig, printedThreshold?: number): Reachability {
  const rule = botMilestoneRule(name);
  if (rule === undefined) {
    return {ok: false, reason: 'no bot rule'};
  }
  if (NEEDS_PARLIAMENT.includes(name) && !config.parliament) {
    return {ok: false, reason: 'needs the Parliament'};
  }
  const target = rule.target === 'printed' ? printedThreshold ?? rule.printedFallback ?? 1 : rule.target;
  if (target === undefined) {
    return OK;
  }
  // Asked of a GENERATED mat — the random-set game's criterion.
  const ceiling = criterionCeiling(rule.randomSetCriterion ?? rule.criterion, config);
  return ceiling >= target ? OK : {ok: false, reason: `ceiling ${ceiling} < target ${target}`};
}

export function awardReachable(name: string, config: MatConfig): Reachability {
  const rule = botAwardRule(name);
  if (rule === undefined) {
    return {ok: false, reason: 'no bot rule'};
  }
  if (NEEDS_PARLIAMENT.includes(name) && !config.parliament) {
    return {ok: false, reason: 'needs the Parliament'};
  }
  const ceiling = criterionCeiling(rule.criterion, config);
  return ceiling >= 1 ? OK : {ok: false, reason: `ceiling ${ceiling}`};
}
