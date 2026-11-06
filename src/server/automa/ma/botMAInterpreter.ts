import {IGame} from '../../IGame';
import {IAward} from '../../awards/IAward';
import {IMilestone, milestoneThreshold} from '../../milestones/IMilestone';
import {MilestoneName} from '../../../common/ma/MilestoneName';
import {AwardName} from '../../../common/ma/AwardName';
import {newProjectCard} from '../../createCard';
import {MarsBotBoard, MarsBotTrack} from '../MarsBotBoard';
import {marsBotOf} from '../AutomaUtil';
import {BotAwardRule, BotCounterId, BotCriterion, BotHelper, BotMilestoneRule, DropRule, TrackRef, TrackSet} from './BotMARule';
import {BOT_AWARD_RULES, BOT_MILESTONE_RULES} from './botMARules';
import {pileAmount, pilePredicate} from './pilePredicates';

/**
 * THE ONE INTERPRETER of the bot-rule registry (`botMARules.ts`). Every public bot milestone / award reading in the
 * engine goes through here — `AutomaMAEvaluation` (value, target, normalization), `AutomaBonusCards.tryAwardHelper`
 * (the helper), the player-facing description, and the random-set generator's demands. A rule is DATA; this file is
 * the only place that knows what the data means.
 */

/** The track a ref names on this mat, or undefined (a role / tag / badge the mat does not carry). */
export function resolveTrack(board: MarsBotBoard, ref: TrackRef): MarsBotTrack | undefined {
  const index = resolveTrackIndex(board, ref);
  return index === undefined ? undefined : board.tracks[index];
}

export function resolveTrackIndex(board: MarsBotBoard, ref: TrackRef): number | undefined {
  if ('role' in ref) {
    return board.getTrackIndexOfRole(ref.role);
  }
  if ('tag' in ref) {
    return board.getTrackIndexForTag(ref.tag);
  }
  return board.getTrackIndexForProduction(ref.production);
}

/** A ref's position — 0 for a track the mat does not have (the honest reading, never a special case). */
function position(board: MarsBotBoard, ref: TrackRef): number {
  return resolveTrack(board, ref)?.position ?? 0;
}

function setPositions(board: MarsBotBoard, of: TrackSet, missing?: 'zero' | 'leave-out'): Array<number> {
  if (of === 'all') {
    return board.tracks.map((t) => t.position);
  }
  if (of === 'martian') {
    return board.tracks.filter((t) => t.definition.role !== 'venus').map((t) => t.position);
  }
  if (missing === 'leave-out') {
    return of.map((ref) => resolveTrack(board, ref)?.position).filter((p): p is number => p !== undefined);
  }
  return of.map((ref) => position(board, ref));
}

function dropCount(game: IGame, drop: DropRule | undefined): number {
  if (drop === 'venus') {
    return game.gameOptions.venusNextExtension ? 1 : 0;
  }
  return drop ?? 0;
}

/** The pile cards that are real project cards, resolved once per reading. */
function pileCards(game: IGame) {
  const cards = [];
  for (const name of game.automa?.playedPile ?? []) {
    const card = newProjectCard(name);
    if (card !== undefined) {
      cards.push(card);
    }
  }
  return cards;
}

/** The bot's value under a criterion. `undefined` = the `player` family (the caller reads the human's own metric). */
export function criterionValue(criterion: BotCriterion, game: IGame): number | undefined {
  const board = game.automa?.board;
  switch (criterion.kind) {
  case 'track': {
    const raw = board === undefined ? 0 : position(board, criterion.track);
    return Math.floor((raw * (criterion.times ?? 1)) / (criterion.div ?? 1)) + (criterion.plus ?? 0);
  }
  case 'tracks': {
    const positions = board === undefined ? [] : setPositions(board, criterion.of, criterion.missing);
    let value: number;
    switch (criterion.op) {
    case 'sum':
      value = positions.reduce((a, b) => a + b, 0);
      break;
    case 'max':
      value = positions.length === 0 ? 0 : Math.max(...positions);
      break;
    case 'min': {
      // «At least space N on every track» — the least-advanced position that still COUNTS once `drop` of the lowest
      // may be ignored; it doubles as the honest display value.
      if (positions.length === 0) {
        value = 0;
      } else {
        const sorted = [...positions].sort((a, b) => a - b);
        value = sorted[Math.min(dropCount(game, criterion.drop), sorted.length - 1)];
      }
      break;
    }
    case 'countAtLeast':
      value = positions.filter((p) => p >= (criterion.at ?? 0)).length;
      break;
    case 'sumTop':
      value = [...positions].sort((a, b) => b - a).slice(0, criterion.top ?? positions.length).reduce((a, b) => a + b, 0);
      break;
    }
    return value * (criterion.times ?? 1) + (criterion.plus ?? 0);
  }
  case 'megacredits':
    return Math.floor(marsBotOf(game).megaCredits / (criterion.per ?? 1));
  case 'pile': {
    const cards = pileCards(game);
    let value: number;
    if ('count' in criterion) {
      const matches = pilePredicate(criterion.count);
      value = cards.filter(matches).length;
    } else if ('sum' in criterion) {
      const amount = pileAmount(criterion.sum);
      value = cards.reduce((sum, card) => sum + amount(card), 0);
    } else {
      value = Math.min(...criterion.minOf.map((id) => cards.filter(pilePredicate(id)).length));
    }
    return value + (criterion.plus ?? 0);
  }
  case 'player':
    return undefined;
  case 'rating':
    return marsBotOf(game).terraformRating + (criterion.plus ?? 0);
  case 'counter':
    return counterValue(criterion.counter, game);
  case 'allOf':
    // The number of parts met — each part a criterion and its own target (Landshaper's three conditions).
    return criterion.of.filter((part) => (criterionValue(part.criterion, game) ?? 0) >= part.target).length;
  case 'zero':
    return 0;
  }
}

function counterValue(counter: BotCounterId, game: IGame): number {
  switch (counter) {
  case 'floaters':
    return game.automa?.floaters ?? 0;
  case 'destroyedBonusCards':
    return game.automa?.destroyedBonusCards.length ?? 0;
  case 'smallActionDeck':
    return (game.automa?.actionDeck.length ?? 0) <= 2 ? 1 : 0;
  case 'cities':
    return game.board.getCities(marsBotOf(game)).length;
  case 'greeneries':
    return game.board.getGreeneries(marsBotOf(game)).length;
  case 'tokens:data':
    return game.automa?.tokens.data ?? 0;
  case 'tokens:fighter':
    return game.automa?.tokens.fighter ?? 0;
  }
}

/** The registry row of a milestone, or undefined when the name has no bot rule (it then reads the player metric). */
export function botMilestoneRule(name: MilestoneName | string): BotMilestoneRule | undefined {
  return BOT_MILESTONE_RULES[name as MilestoneName];
}

/** The registry row of an award, or undefined. */
export function botAwardRule(name: AwardName | string): BotAwardRule | undefined {
  return BOT_AWARD_RULES[name as AwardName];
}

/** The fallback helper of a name the registry does not know — nothing to do, the card tries the next award. */
const NO_HELPER: BotHelper = {kind: 'none', reasonKey: 'No competition effect for this award'};

/** The Corporate Competition helper of an award. */
export function botAwardHelper(name: AwardName | string): BotHelper {
  return botAwardRule(name)?.helper ?? NO_HELPER;
}

/**
 * MarsBot's criterion for one milestone as a FRACTION — `value` out of `target` — or `undefined` for the player
 * family. The target is a CONSTANT of the name (decision R3), or the milestone's own printed threshold.
 */
export function botMilestoneProgress(milestone: IMilestone, game: IGame): {value: number, target: number} | undefined {
  const rule = botMilestoneRule(milestone.name);
  if (rule === undefined || rule.target === undefined) {
    return undefined;
  }
  const value = criterionValue(milestoneCriterion(rule, game), game);
  if (value === undefined) {
    return undefined;
  }
  const target = rule.target === 'printed' ?
    milestoneThreshold(milestone, game) ?? rule.printedFallback ?? 1 :
    rule.target;
  return {value, target};
}

/** The criterion THIS game reads — a random-set game takes the rule's `randomSetCriterion` where one is declared. */
export function milestoneCriterion(rule: BotMilestoneRule, game: IGame | undefined): BotCriterion {
  return game?.automa?.mat !== undefined && rule.randomSetCriterion !== undefined ? rule.randomSetCriterion : rule.criterion;
}

/** What the bot pays when it claims this milestone (Briber's 12 M€) — 0 for every other name. */
export function botMilestoneClaimCost(name: MilestoneName | string): number {
  return botMilestoneRule(name)?.claimCost?.megacredits ?? 0;
}

/** True when the bot's progress on this milestone is shown as a 0 / 1 flag (a human row with no numeric threshold). */
export function botMilestoneShownAsFlag(name: MilestoneName | string): boolean {
  return botMilestoneRule(name)?.display === 'flag';
}

/**
 * The bot's RAW strength in one award (before the difficulty and the corporation modifiers, which
 * `AutomaMAEvaluation.botAwardScore` applies to every award alike). The player family reads the award's own score.
 */
export function botAwardRawScore(award: IAward, game: IGame): number {
  const rule = botAwardRule(award.name);
  const value = rule === undefined ? undefined : criterionValue(rule.criterion, game);
  return value ?? award.getScore(marsBotOf(game));
}
