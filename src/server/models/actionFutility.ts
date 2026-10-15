/*
 * THE «NO EFFECT» VERDICT OF AN ACTION — the ONE writer (`common/models/ActionFutilityModel.ts` is the WHY).
 *
 * An action is futile only when the server can PROVE it changes nothing of value right now; without that proof it has
 * value. Two halves:
 *
 *  1. THE CLAIM — what the action's own yields come to: a DECLARATIVE action is read here off its `Behavior` (every
 *     yield key judged with the engine's own arithmetic — a raise against `parameterRoom`, an ocean against
 *     `canAddOcean`, a counted gain through `Counter`, «any card» against the holders `AddResourcesToCard` would offer);
 *     a key this reader does not know is a YIELD (conservative by construction). A BESPOKE action states its own claim
 *     beside `action()` (`ICard.actionFutility`, built with `cards/actionFutilities.ts`).
 *  2. THE RESCUES — what the TABLE answers to an apparently empty action, decided once for every card: a blocked ocean
 *     still pays a Whales owner an animal (`PlaceOceanTile`); a resource added to a card still counts for a card that
 *     reacts to it (`onResourceAdded`), for a LIVE award / milestone that counts its amount (`cardResourceCount`) and
 *     for a live chairman quest that collects it. A maxed parameter needs no further rescue: the engine returns before
 *     every hook (no TR, no party reward, no reaction — `Game.increase*` at the limit).
 *
 * READ-ONLY: it reads the table and builds a deferred action only to ask it for its holders (as `Executor.canExecute`
 * does); nothing is queued, nothing is written.
 */
import {IPlayer} from '../IPlayer';
import {ICard, IActionCard} from '../cards/ICard';
import {Behavior} from '../behavior/Behavior';
import {Counter} from '../behavior/Counter';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {CardName} from '../../common/cards/CardName';
import {CardResource} from '../../common/CardResource';
import {
  ActionBranchFutility, ActionFutility, ActionFutilityVerdict, FutileParameter,
} from '../../common/models/ActionFutilityModel';
import {
  BranchFutilityClaim, futilityOfBranches, noTarget, parameterMaxed, zeroYield,
} from '../cards/actionFutilities';
import {subAvailability} from './actionPreview';
import {milestoneThreshold} from '../milestones/IMilestone';
import {QuestTracker} from '../parliament/quests/QuestTracker';
import {asArray} from '../../common/utils/utils';
import {IStandardProjectCard} from '../cards/IStandardProjectCard';

/** The verdict of `card`'s action for `player` — `undefined` when the action has value (or nothing can be proven). */
export function actionFutility(player: IPlayer, card: ICard & IActionCard): ActionFutility | undefined {
  const claim = card.actionFutility !== undefined ? card.actionFutility(player) : declaredFutility(player, card);
  return claim === undefined ? undefined : rescued(player, claim);
}

// ── 1. THE CLAIM of a declarative action ───────────────────────────────────────────────────────────────────────────

/** What one behavior's yields come to: it yields something · it has no yield key at all · every yield is empty. */
type BehaviorYield = 'yields' | 'none' | ActionFutilityVerdict;

const GLOBAL_KEYS: ReadonlyArray<'temperature' | 'oxygen' | 'venus'> = ['temperature', 'oxygen', 'venus'];

/** Keys that carry no yield of their own (a price, a log line, a branch title, the choice itself). */
const NOT_A_YIELD: ReadonlySet<string> = new Set(['spend', 'log', 'title', 'or']);

function yieldOf(player: IPlayer, card: ICard, behavior: Behavior): BehaviorYield {
  const counter = new Counter(player, card);
  const empties: Array<ActionFutilityVerdict> = [];
  for (const key of Object.keys(behavior) as Array<keyof Behavior>) {
    if (NOT_A_YIELD.has(key) || behavior[key] === undefined) {
      continue;
    }
    switch (key) {
    case 'global': {
      const global = behavior.global ?? {};
      for (const parameter of GLOBAL_KEYS) {
        const steps = global[parameter];
        if (steps === undefined) {
          continue;
        }
        // A LOWERING moves the table (whoever it hurts) — never «nothing».
        if (steps < 0) {
          return 'yields';
        }
        const maxed = parameterMaxed(player, parameter);
        if (maxed === undefined) {
          return 'yields';
        }
        empties.push(maxed);
      }
      break;
    }
    case 'ocean': {
      const maxed = parameterMaxed(player, 'oceans');
      if (maxed === undefined) {
        return 'yields';
      }
      empties.push(maxed);
      break;
    }
    case 'tr':
    case 'addResources': {
      const n = counter.count(behavior[key] ?? 0);
      if (n > 0) {
        return 'yields';
      }
      // A negative TR is a price; a zero is a counted gain that comes to nothing.
      if (n === 0) {
        empties.push(zeroYield());
      }
      break;
    }
    case 'stock':
    case 'production': {
      const units = behavior[key] ?? {};
      let zero = false;
      for (const raw of Object.values(units)) {
        if (raw === undefined) {
          continue;
        }
        const n = counter.count(raw);
        if (n > 0) {
          return 'yields';
        }
        // A negative unit is a price (Venus Magnetizer's energy production): neither a yield nor «nothing».
        zero = zero || n === 0;
      }
      if (zero) {
        empties.push(zeroYield());
      }
      break;
    }
    case 'addResourcesToAnyCard': {
      for (const add of asArray(behavior.addResourcesToAnyCard ?? [])) {
        const count = counter.count(add.count);
        if (count <= 0) {
          empties.push(zeroYield());
          continue;
        }
        // The holders the live step would offer — the deferred action's own reading (`Executor.canExecute` asks it so).
        const holders = new AddResourcesToCard(player, add.type, {
          count, restrictedTag: add.tag, min: add.min, robotCards: add.robotCards !== undefined,
        }).getCards();
        if (holders.length > 0) {
          return 'yields';
        }
        empties.push(noTarget());
      }
      break;
    }
    default:
      // Anything else (a draw, a tile, a resource of choice, a colony, a delegate, an attack…) is a yield this reader
      // does not judge — so it has value.
      return 'yields';
    }
  }
  if (empties.length === 0) {
    return 'none';
  }
  // A maxed parameter names the cause best (it is what the player sees on the board).
  return empties.find((v) => v.kind === 'parameter-maxed') ?? empties[0];
}

function declaredFutility(player: IPlayer, card: ICard & IActionCard): ActionFutility | undefined {
  const behavior = card.actionBehavior;
  if (behavior === undefined) {
    return undefined;
  }
  if (behavior.or === undefined) {
    const y = yieldOf(player, card, behavior);
    return y === 'yields' || y === 'none' ? undefined : {verdict: y};
  }
  // The keys BESIDE the choice run whichever branch is taken (`deriveOrBranches`): a yield there gives every branch value.
  const outer: Behavior = {...behavior};
  delete outer.or;
  const outerYield = yieldOf(player, card, outer);
  if (outerYield === 'yields') {
    return undefined;
  }
  const claims = behavior.or.behaviors.map((sub): BranchFutilityClaim => {
    const available = subAvailability(player, card, sub).available;
    const own = yieldOf(player, card, sub);
    if (own === 'yields') {
      return {available};
    }
    // The branch's own keys are empty (or absent): futile only if what runs beside it is too.
    const verdict = own === 'none' ? (outerYield === 'none' ? undefined : outerYield) : own;
    return {available, verdict};
  });
  return futilityOfBranches(claims);
}

// ── 2. THE RESCUES — what the table answers to an apparently empty action ──────────────────────────────────────────

function rescued(player: IPlayer, claim: ActionFutility): ActionFutility | undefined {
  const keep = (v: ActionFutilityVerdict | undefined) => v !== undefined && !rescuedVerdict(player, v);
  if (claim.branches === undefined) {
    return keep(claim.verdict) ? claim : undefined;
  }
  const branches = claim.branches.map((b): ActionBranchFutility => b.futile && keep(b.verdict) ? b : {futile: false});
  if (!branches.some((b) => b.futile)) {
    return undefined;
  }
  // The WHOLE verdict stands only if the claim had one and its own cause was not answered.
  return keep(claim.verdict) ? {verdict: claim.verdict, branches} : {branches};
}

function rescuedVerdict(player: IPlayer, verdict: ActionFutilityVerdict): boolean {
  switch (verdict.kind) {
  case 'parameter-maxed':
    return verdict.parameter === 'oceans' && whalesCollects(player);
  case 'vp-capped':
    return resourceStillCounts(player, verdict.resource);
  default:
    return false;
  }
}

/** A blocked ocean pays the CREDITED player's Whales an animal (`PlaceOceanTile`) — a card action credits its owner. */
function whalesCollects(player: IPlayer): boolean {
  return player.tableau.get(CardName.WHALES) !== undefined;
}

/**
 * One more unit of `resource` on a card still COUNTS for something of the player's: a card that reacts to a resource
 * being added (conservative — any such reactor rescues), a LIVE award / milestone that counts the amount, a live
 * chairman quest that collects it.
 */
function resourceStillCounts(player: IPlayer, resource: CardResource | undefined): boolean {
  if (resource === undefined) {
    return true;
  }
  if (player.tableau.asArray().some((c) => c.onResourceAdded !== undefined)) {
    return true;
  }
  const counts = (declared: ReadonlyArray<CardResource> | 'any' | undefined) =>
    declared === 'any' || (declared !== undefined && declared.includes(resource));
  const game = player.game;
  // An award is LIVE while it is funded or can still be funded.
  const fundable = !game.allAwardsFunded();
  for (const award of game.awards) {
    if (!counts(award.cardResourceCount)) {
      continue;
    }
    const funded = game.fundedAwards.some((f) => f.award.name === award.name);
    if (funded || fundable) {
      return true;
    }
  }
  // A milestone is LIVE while nobody has claimed it, a claim is still open and the player is short of its number.
  if (!game.allMilestonesClaimed()) {
    for (const milestone of game.milestones) {
      if (!counts(milestone.cardResourceCount) || game.claimedMilestones.some((c) => c.milestone.name === milestone.name)) {
        continue;
      }
      const threshold = milestoneThreshold(milestone, game);
      if (threshold === undefined || milestone.getScore(player) < threshold) {
        return true;
      }
    }
  }
  const parliament = game.parliament;
  const quest = parliament?.quest;
  if (parliament !== undefined && quest !== undefined && quest.completedBy === undefined &&
      parliament.participates(player, 'quest') &&
      QuestTracker.match(quest.definition.goal, {kind: 'cardResource', resource, amount: 1}) > 0) {
    return true;
  }
  return false;
}

/** The global parameters a standard project's `tr` declaration may name. */
const PROJECT_PARAMETERS: ReadonlySet<string> = new Set(['temperature', 'oxygen', 'venus', 'oceans']);

/**
 * A STANDARD PROJECT with no effect: its whole result is the step(s) its `tr` declares (the very request `canAct`
 * prices), every one at its limit, with nothing else to give (no extra chip from the card's own hook, no target to
 * place — a greenery's tile is a yield at any oxygen) and nothing on the table answering it: a card reacting to a
 * standard project (CrediCor's, Standard Technology's rebate) pays for any project, a Whales owner collects a blocked
 * ocean. The asteroid at +8 °C, the aquifer with every ocean placed, the air scrapping at 30 %.
 */
export function standardProjectFutility(
  player: IPlayer,
  card: IStandardProjectCard,
  hasExtras: boolean,
  hasTarget: boolean,
): ActionFutilityVerdict | undefined {
  const tr = card.tr;
  if (hasExtras || hasTarget || tr === undefined) {
    return undefined;
  }
  const verdicts: Array<ActionFutilityVerdict> = [];
  for (const [key, value] of Object.entries(tr)) {
    if (value === undefined || value === 0) {
      continue;
    }
    if (!PROJECT_PARAMETERS.has(key) || value < 0) {
      return undefined;
    }
    const verdict = parameterMaxed(player, key as FutileParameter);
    if (verdict === undefined) {
      return undefined;
    }
    verdicts.push(verdict);
  }
  if (verdicts.length === 0 || player.tableau.asArray().some((c) => c.onStandardProject !== undefined)) {
    return undefined;
  }
  return rescuedVerdict(player, verdicts[0]) ? undefined : verdicts[0];
}
