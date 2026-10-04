/*
 * «ALL YOUR COLONY BONUSES» — the ONE module of the rule four things print:
 * TR23 Habitat Science («spend 2 data → gain all your colony bonuses»),
 * Productive Outpost («gain all your colony bonuses»), the CEO Yvonne («…
 * twice») and the resolution RX07 Colonial Affairs («… k times»). It used to
 * be written three times and counted two ways — the engine pays a trade's
 * owner bonus PER CUBE, Productive Outpost and Yvonne walked the cubes
 * themselves, and the resolution counted TILES («a player never holds two
 * cubes on one tile» — false: Space Port Colony and Research Colony build
 * over one's own cube).
 *
 * WHAT A COLONY BONUS IS: the tile's PRINTED colony bonus — the third line of
 * the tile (`metadata.colony`, `IColony.colonyBonusGrant`), what a cube's
 * owner receives when SOMEBODY ELSE trades there. Never the trade income and
 * never the build bonus (Miranda pays a CARD here, not an animal).
 *
 * THE FOUR HALVES, one rule:
 *  · `ownColonyBonuses`        — WHO IS PAID: the tiles carrying the player's
 *    cubes and how many, in the table's order. A grouping of the engine's one
 *    reading of «each colony you have» (`ColoniesHandler.coloniesOf`).
 *  · `gainAllColonyBonuses`    — THE PAYOUT (a card's): one cube at a time
 *    through the engine's only door (`IColony.giveColonyBonus`), each cube
 *    told which it is («1 of 2») and which CARD pays it (`via`). Never merged:
 *    two cubes are two full payouts (the resolution's ×k merge is ITS law).
 *  · `allColonyBonusesLedger`  — THE READING: the same rows IN THE ORDER THE
 *    ENGINE PAYS THEM, each saying what it will ask and what cannot land.
 *  · `allColonyBonusesEffects` — THE SUMS: the aggregated `current → resulting`
 *    chips and the pre-collectable target steps.
 * The last two are READ-ONLY (state snapshot guarded by the module's spec).
 *
 * THE ORDER OF PAYMENT (`payoutPhase`) is the deferred queue's own, stated
 * once so the reading cannot drift from it: every cube is a lambda at
 * `Priority.DEFAULT`, queued Titania → the table → Leavitt. A lambda that
 * MUTATES pays at once (a supply / production gain, a loss, a discount); a
 * plain DRAW (`Priority.DRAW_CARDS`, ahead of DEFAULT) pays right behind its
 * own lambda — so those run in the table's order. Pluto's pair re-defers
 * itself at DEFAULT and therefore stands BEHIND every remaining lambda; a
 * resource onto a card (`Priority.GAIN_RESOURCE_OR_PRODUCTION`, after
 * DEFAULT) stands behind the pairs too. Pinned against the real queue by
 * tests/colonies/allColonyBonuses.spec.ts («the ledger is the payout»).
 */
import {CardName} from '../../common/cards/CardName';
import {CardResource} from '../../common/CardResource';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {colonyCardResources} from '../../common/colonies/ColonyMetadata';
import {ColonyName} from '../../common/colonies/ColonyName';
import {Tag} from '../../common/cards/Tag';
import {Resource} from '../../common/Resource';
import {ActionEffect, ActionPreviewStep} from '../../common/models/ActionPreviewModel';
import {AllColonyBonusesModel, ColonyBonusAsk, ColonyLedgerEntryModel} from '../../common/models/ColonyBonusLedgerModel';
import {ColonyBonusShape, colonyBonusShape} from '../../common/parliament/colonyLedger';
import {AddResourcesToCard, Options as AddResourceOptions} from '../deferredActions/AddResourcesToCard';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {colonySource} from '../inputs/choiceContext';
import {message} from '../logs/MessageBuilder';
import * as actionPreviews from '../cards/actionPreviews';
import {ColoniesHandler} from './ColoniesHandler';
import {IColony} from './IColony';

/** ONE tile the player has colonies on, and how many of their cubes stand there. */
export type OwnColonyBonus = {colony: IColony, cubes: number};

/**
 * WHO pays the bonuses (a card — it names itself on every prompt and batch)
 * and HOW MANY TIMES each cube pays (Yvonne's «twice»; once by default).
 */
export type AllColonyBonusesOptions = {via?: CardName, times?: number};

/**
 * THE PLAYER'S TILES AND THEIR CUBES, in the table's order — `coloniesOf`
 * (one entry per cube, a tile's cubes adjacent) folded by tile. The ONE
 * reading every payer of «all your colony bonuses» stands on.
 */
export function ownColonyBonuses(game: IGame, player: IPlayer): Array<OwnColonyBonus> {
  const out: Array<OwnColonyBonus> = [];
  for (const colony of ColoniesHandler.coloniesOf(game, player)) {
    const last = out[out.length - 1];
    if (last !== undefined && last.colony === colony) {
      last.cubes++;
    } else {
      out.push({colony, cubes: 1});
    }
  }
  return out;
}

/**
 * The QUEUEING order of the cubes' lambdas: Titania first (its bonus is a
 * LOSS — taken before the gains can cover it), Leavitt last (its paid reveal
 * is best decided with the gains in hand), the table's order between —
 * Productive Outpost's own order, kept.
 */
function queueingOrder(bonuses: ReadonlyArray<OwnColonyBonus>): Array<OwnColonyBonus> {
  const rank = (b: OwnColonyBonus): number => b.colony.name === ColonyName.TITANIA ? -1 : b.colony.name === ColonyName.LEAVITT ? 1 : 0;
  // Stable: equal ranks keep the table's order.
  return [...bonuses].sort((a, b) => rank(a) - rank(b));
}

/**
 * WHEN a bonus of this shape actually lands, relative to the other cubes'
 * (see the module header): 0 — with its own lambda; 1 — behind every lambda
 * (Pluto's pair); 2 — behind the pairs (a resource onto a card).
 */
function payoutPhase(shape: ColonyBonusShape): 0 | 1 | 2 {
  switch (shape) {
  case 'drawDiscard': return 1;
  case 'cardResource':
  case 'venusCardResource':
    return 2;
  default: return 0;
  }
}

/** The player's tiles IN THE ORDER THE ENGINE PAYS THEM — what the ledger's rows and the pre-collected steps follow. */
function payoutOrder(game: IGame, player: IPlayer): Array<OwnColonyBonus> {
  const queued = queueingOrder(ownColonyBonuses(game, player));
  const phaseOf = (b: OwnColonyBonus): number => payoutPhase(colonyBonusShape(b.colony.metadata.colony.type));
  // Stable: within a phase the queueing order stands.
  return [...queued].sort((a, b) => phaseOf(a) - phaseOf(b));
}

/**
 * THE PAYOUT: every cube of the player's pays its tile's colony bonus, `times`
 * times, one payout at a time through `giveColonyBonus` — each told its
 * ordinal on the tile («2 of 2») and the card paying it. Each payout is its
 * own deferred lambda (never the trade's `GiveColonyBonus`, which pays EVERY
 * owner of a tile): a lambda that mutates pays at once, a lambda that asks
 * queues its question behind the remaining ones.
 */
export function gainAllColonyBonuses(player: IPlayer, options: AllColonyBonusesOptions = {}): void {
  const times = options.times ?? 1;
  for (const {colony, cubes} of queueingOrder(ownColonyBonuses(player.game, player))) {
    const total = cubes * times;
    for (let index = 1; index <= total; index++) {
      player.defer(() => colony.giveColonyBonus(player, {ordinal: {index, total}, via: options.via}));
    }
  }
}

/** The server's own skip reason for a card resource with no holder (the ledger row's words — Colonial Affairs' records print the same key). */
export function noHolderReason(resource: CardResource | undefined): string {
  switch (resource) {
  case CardResource.ANIMAL: return 'No card can hold animals';
  case CardResource.FLOATER: return 'No card can hold floaters';
  case CardResource.MICROBE: return 'No card can hold microbes';
  case CardResource.DATA: return 'No card can hold data';
  default: return 'No card can hold this resource';
  }
}

/** A Venus-card bonus with no Venus holder. */
export const NO_VENUS_HOLDER_REASON = 'No Venus card can hold resources';

/**
 * THE TARGET PICK of one cube's «add a resource to a card» bonus, exactly as
 * `Colony.giveBonusImpl` builds it for a card's payout — the kinds, the
 * count, the cause (the colony + the paying card) and `autoSelect: false`.
 * `undefined` for a benefit that is not such a pick. ONE description for the
 * reading's holders test and the pre-collected step, so neither can drift
 * from the live prompt.
 */
function cardTargetOf(colony: IColony, via: CardName | undefined): {kinds: ReadonlyArray<CardResource>, options: AddResourceOptions} | undefined {
  const bonus = colony.metadata.colony;
  const cause = colonySource(colony.name, via);
  const shown = via !== undefined ? {autoSelect: false} : {};
  if (bonus.type === ColonyBenefit.ADD_RESOURCES_TO_CARD) {
    return {kinds: colonyCardResources(colony.metadata), options: {count: bonus.quantity, cause, ...shown}};
  }
  if (bonus.type === ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD) {
    return {
      kinds: [],
      options: {
        count: bonus.quantity,
        restrictedTag: Tag.VENUS,
        title: message('Select Venus card to add ${0} resource(s)', (b) => b.number(bonus.quantity)),
        cause,
        ...shown,
      },
    };
  }
  return undefined;
}

/** The kinds as `AddResourcesToCard` takes them: one, a list, or `undefined` for any. */
function kindsArg(kinds: ReadonlyArray<CardResource>): CardResource | ReadonlyArray<CardResource> | undefined {
  return kinds.length === 0 ? undefined : kinds.length === 1 ? kinds[0] : kinds;
}

/** What a row will ASK of the player once the press is made — by the bonus's shape. */
function askOf(shape: ColonyBonusShape): ColonyBonusAsk | undefined {
  switch (shape) {
  case 'cardResource':
  case 'venusCardResource':
    return 'card';
  case 'draw': return 'draw';
  case 'drawDiscard': return 'draw-discard';
  case 'revealBuy': return 'choice';
  default: return undefined;
  }
}

/**
 * THE READING — read-only: the player's tiles IN THE ORDER THE ENGINE PAYS
 * THEM, each with its printed bonus, its cubes, what it will ask (a card
 * target, a take, Pluto's pair) and — when it cannot land — the refusal with
 * its size (a resource no card of the player's can hold). An empty list is a
 * player with no colonies.
 */
export function allColonyBonusesLedger(player: IPlayer, options: AllColonyBonusesOptions = {}): AllColonyBonusesModel {
  const times = options.times ?? 1;
  const entries = payoutOrder(player.game, player).map(({colony, cubes}): ColonyLedgerEntryModel => {
    const grant = colony.colonyBonusGrant();
    const entry: ColonyLedgerEntryModel = {colony: colony.name, grant, description: colony.metadata.colony.description, cubes};
    const target = cardTargetOf(colony, options.via);
    if (target !== undefined && new AddResourcesToCard(player, kindsArg(target.kinds), target.options).getCards().length === 0) {
      entry.skipped = {
        reason: grant.benefit === ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD ? NO_VENUS_HOLDER_REASON : noHolderReason(target.kinds.length === 1 ? target.kinds[0] : undefined),
        amount: grant.quantity * cubes * times,
      };
      return entry;
    }
    const asks = askOf(colonyBonusShape(grant.benefit));
    if (asks !== undefined) {
      entry.asks = asks;
    }
    return entry;
  });
  return times === 1 ? {entries} : {entries, times};
}

const STANDARD_RESOURCES: ReadonlyArray<Resource> = [
  Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM, Resource.PLANTS, Resource.ENERGY, Resource.HEAT,
];

/**
 * THE SUMS — read-only: what «all your colony bonuses» comes to, as the
 * composer's ordinary chips (one parameter — one `current → resulting`
 * vector) and the steps it can collect before the press.
 *
 * Every owned tile's FIXED bonus is known when the composer opens, so the
 * player reads EXACTLY what arrives — supply, production, draws, TR, Venus
 * steps and card resources, summed over the cubes — instead of opening the
 * colonies screen and adding it up. A resource onto a card is a TARGET STEP
 * per cube, in the order the engine will ask (one holder is still shown); a
 * resource no card can hold is a NAMED warning per cube — the very
 * description the paying step records (`skippedAddToCard`); a bonus whose
 * answer cannot exist before the press (Pluto's discard, a paid reveal, a
 * card resource of several kinds) is named by the one note.
 */
export function allColonyBonusesEffects(player: IPlayer, options: AllColonyBonusesOptions = {}): {effects: Array<ActionEffect>, steps: Array<ActionPreviewStep | undefined>} {
  const game = player.game;
  const times = options.times ?? 1;
  const stock: Partial<Record<Resource, number>> = {};
  const production: Partial<Record<Resource, number>> = {};
  const cardRes: Partial<Record<CardResource, number>> = {};
  let draw = 0;
  let tr = 0;
  let venusSteps = 0;
  let hasInteractiveBonus = false;
  const steps: Array<ActionPreviewStep | undefined> = [];

  for (const {colony, cubes} of payoutOrder(game, player)) {
    const bonus = colony.metadata.colony;
    for (let i = 0; i < cubes * times; i++) {
      switch (bonus.type) {
      case ColonyBenefit.GAIN_RESOURCES:
        if (bonus.resource !== undefined) {
          stock[bonus.resource] = (stock[bonus.resource] ?? 0) + bonus.quantity;
        }
        break;
      case ColonyBenefit.GAIN_PRODUCTION:
        if (bonus.resource !== undefined) {
          production[bonus.resource] = (production[bonus.resource] ?? 0) + bonus.quantity;
        }
        break;
      case ColonyBenefit.DRAW_CARDS:
      case ColonyBenefit.DRAW_EARTH_CARD:
        draw += bonus.quantity;
        break;
      case ColonyBenefit.GAIN_TR:
        tr += bonus.quantity;
        break;
      case ColonyBenefit.INCREASE_VENUS_SCALE:
        venusSteps += bonus.quantity;
        break;
      case ColonyBenefit.GAIN_MC_PER_HAZARD_TILE:
        stock[Resource.MEGACREDITS] = (stock[Resource.MEGACREDITS] ?? 0) + game.board.getHazards().length;
        break;
      case ColonyBenefit.ADD_RESOURCES_TO_CARD:
      case ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD: {
        const target = cardTargetOf(colony, options.via);
        if (target === undefined) {
          break;
        }
        if (target.kinds.length > 1) {
          // SEVERAL kinds: the unit's kind is the chosen card's own, so no ONE
          // chip can name it honestly — the pick after the confirm names it.
          // (No tile prints such a COLONY bonus today.)
          hasInteractiveBonus = true;
          break;
        }
        const resource = target.kinds.length === 1 ? target.kinds[0] : undefined;
        const step = actionPreviews.addToCardStep(player, resource, target.options);
        if (step === undefined) {
          // No card can hold it → the resource is lost. Named with the SAME
          // description this cube's step records if the press goes ahead —
          // never an anonymous warning on a payout made of many bonuses.
          steps.push(actionPreviews.warningNote('No eligible card — this resource is not added.', {
            resource,
            skipped: actionPreviews.skippedAddToCard(resource, bonus.quantity),
          }));
        } else {
          if (resource !== undefined) {
            cardRes[resource] = (cardRes[resource] ?? 0) + bonus.quantity;
          }
          // The live prompt names WHO asks (the colony, and the card paying it) through its `choiceContext`
          // — serialized centrally for a top-level prompt only; a pre-collected step states it itself, so the
          // composer's step reads «КОЛОНИЯ · Титан» exactly as the live question would.
          if (step.kind === 'input' && target.options.cause !== undefined) {
            step.input.choiceContext = {source: target.options.cause, mode: 'reward'};
          }
          steps.push(step);
        }
        break;
      }
      default:
        // Pluto's «draw 1, then discard 1» / STEAL / COPY_TRADE / PLACE_* /
        // a paid reveal — decided after the confirm.
        hasInteractiveBonus = true;
        break;
      }
    }
  }

  const effects: Array<ActionEffect> = [];
  for (const resource of STANDARD_RESOURCES) {
    const amount = stock[resource];
    if (amount !== undefined && amount !== 0) {
      effects.push(actionPreviews.stockGain(player, resource, amount));
    }
  }
  for (const resource of STANDARD_RESOURCES) {
    const amount = production[resource];
    if (amount !== undefined && amount !== 0) {
      effects.push(actionPreviews.productionChange(player, resource, amount));
    }
  }
  if (draw > 0) {
    effects.push(actionPreviews.drawGain(draw));
  }
  if (tr > 0) {
    effects.push(actionPreviews.trGain(player, tr));
  }
  if (venusSteps > 0) {
    effects.push(actionPreviews.globalGain(player, 'venus', venusSteps));
  }
  for (const [resource, amount] of Object.entries(cardRes) as Array<[CardResource, number]>) {
    if (amount > 0) {
      effects.push(actionPreviews.cardResourceGain(resource, amount));
    }
  }
  if (hasInteractiveBonus) {
    steps.push(actionPreviews.noteStep('generic', 'Some colony bonuses are resolved after confirming.'));
  }
  return {effects, steps};
}
