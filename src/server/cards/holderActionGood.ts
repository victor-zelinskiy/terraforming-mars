import {ICard, isIActionCard} from './ICard';
import {Behavior} from '../behavior/Behavior';
import {ActionGood, HolderActionGood} from '../../common/cards/holderRole';
import {Resource} from '../../common/Resource';

/**
 * THE ACTION ROLE OF A HOLDER (PL-135, the TR40 walk — `common/cards/holderRole.ts`):
 * what the resource stored on a card BUYS through the card's own declarative
 * action. Read off `action` (and each variant of an `or`) at manifest-export
 * time and handed to the client card as `actionGood`; never declared by a card
 * (invariant 8 — a declaration in the card file would be a fork-only table in
 * disguise, and a central table would rot).
 *
 * The reading is deliberately narrow — generically or not at all:
 *  · the variant must SPEND `resourcesHere` (a number) and pay PLAIN goods:
 *    production steps, stock gains, a draw (with its tag filter at most), a TR
 *    step or a global-parameter step — each one of a single resource /
 *    parameter — or a declared TILE (a greenery, one ocean, a city — TR69's
 *    «3 floaters → a greenery»: the tile is the good, it raises its own
 *    parameter);
 *  · a variant that spends this card's resource for anything the console
 *    cannot name as plain goods (a target to pick, a special tile, a
 *    draw-and-keep) makes the WHOLE card plain storage — half a truth on a
 *    chip is a lie;
 *  · ONE spending variant paying SEVERAL plain goods at once is a SET — «1
 *    fighter → +1 M€ production AND 3 M€» (TR60 Civilian Spacefighters, the
 *    owner's decision 4a; Arborist Collective's «2 plants and +1 plant
 *    production»): the same role, every good in the declared order — a card
 *    declares its payload as it is printed (`good` + `with`);
 *  · several variants spending this card's resource at ONE price (Atmo
 *    Collectors' «1 floater → 2 titanium OR 3 energy OR 4 heat», TR57's «2 mechs
 *    → +1 steel OR titanium production») are a CHOICE of goods — the same role,
 *    every good in the printed order (`good` + `or`, PL-484); at two DIFFERENT
 *    prices there is no one reading of «spend N», and a choice between SETS has
 *    no one plate: storage;
 *  · a variant that spends something else (TR40's A: energy → a mech) is
 *    ignored — it buys the resource, it does not spend it.
 *
 * PRECEDENCE lives on the client (`console/holderRoles.ts`): a declared role,
 * then a payment unit, then a printed VP rule, then this — so EVA Mechs stay
 * tender and Mech Sports stay VP whatever their actions say.
 */
export function holderActionGoodOf(card: ICard): HolderActionGood | undefined {
  if (card.resourceType === undefined || !isIActionCard(card)) {
    return undefined;
  }
  const action = card.actionBehavior;
  if (action === undefined) {
    // A BESPOKE action has no declaration to read: its good is the card's own, declared ONCE beside the reading
    // its action and its preview share (`ICard.holderActionGood` — TR46), or there is none.
    return card.holderActionGood;
  }
  const variants: ReadonlyArray<Behavior> = action.or !== undefined ? action.or.behaviors : [action];
  const found: Array<{spend: number, goods: ReadonlyArray<ActionGood>}> = [];
  for (const variant of variants) {
    const spend = variant.spend?.resourcesHere;
    if (typeof spend !== 'number' || spend <= 0) {
      continue;
    }
    const goods = goodsOf(variant);
    if (goods === undefined) {
      return undefined;
    }
    found.push({spend, goods});
  }
  if (found.length === 0) {
    return undefined;
  }
  if (found.length === 1) {
    // One good, or a SET of goods one press buys together (TR60).
    const [{spend, goods: [good, ...rest]}] = found;
    return rest.length === 0 ? {spend, good} : {spend, good, with: rest};
  }
  // A CHOICE of goods — only at ONE price and only between single goods: «spend 2 → this OR that» reads as one role;
  // two prices do not, and a choice between SETS has no one plate.
  const spend = found[0].spend;
  if (found.some((f) => f.spend !== spend || f.goods.length !== 1)) {
    return undefined;
  }
  return {spend, good: found[0].goods[0], or: found.slice(1).map((f) => f.goods[0])};
}

/**
 * The plain goods a variant pays beside its `spend`, in the declared (= printed) order, or undefined when it pays
 * anything else — a payload the console cannot name, or a payload naming several resources under one key («+1 steel
 * and +1 titanium production» would be a set the declaration does not order).
 */
function goodsOf(variant: Behavior): ReadonlyArray<ActionGood> | undefined {
  const goods: Array<ActionGood> = [];
  // A variant of an `or` is a TitledBehavior — its `title` is no payload.
  for (const key of Object.keys(variant)) {
    switch (key) {
    case 'spend':
    case 'title':
      break;
    case 'production':
    case 'stock': {
      const entries = Object.entries(variant[key] ?? {}).filter(([, v]) => v !== undefined && v !== 0);
      const [resource, amount] = entries[0] ?? [];
      if (entries.length !== 1 || typeof amount !== 'number' || amount < 0) {
        return undefined;
      }
      goods.push({kind: key, resource: resource as Resource, amount});
      break;
    }
    case 'drawCard': {
      const draw = variant.drawCard;
      if (typeof draw === 'number') {
        goods.push({kind: 'cards', amount: draw});
      } else if (draw !== undefined && typeof draw.count === 'number' && draw.keep === undefined && draw.pay !== true && draw.type === undefined && draw.resource === undefined) {
        goods.push(draw.tag === undefined ? {kind: 'cards', amount: draw.count} : {kind: 'cards', amount: draw.count, tag: draw.tag});
      } else {
        return undefined;
      }
      break;
    }
    case 'tr': {
      const tr = variant.tr;
      if (typeof tr !== 'number' || tr <= 0) {
        return undefined;
      }
      goods.push({kind: 'tr', amount: tr});
      break;
    }
    case 'global': {
      // The global steps are typed as non-zero literals — a declared key is a step.
      const entries = Object.entries(variant.global ?? {}).filter(([, v]) => v !== undefined);
      const [parameter, steps] = entries[0] ?? [];
      if (entries.length !== 1 || typeof steps !== 'number' || steps <= 0 || (parameter !== 'temperature' && parameter !== 'oxygen' && parameter !== 'venus')) {
        return undefined;
      }
      goods.push({kind: 'global', parameter, steps});
      break;
    }
    case 'greenery':
      // A TILE (TR69): the declared greenery — the tile raises its own oxygen, so the tile IS the good.
      goods.push({kind: 'tile', tile: 'greenery'});
      break;
    case 'ocean': {
      // One ocean, wherever the declaration puts it — two oceans are no single plate.
      const count = variant.ocean?.count ?? 1;
      if (count !== 1) {
        return undefined;
      }
      goods.push({kind: 'tile', tile: 'ocean'});
      break;
    }
    case 'city':
      // A city the player places (a reserved off-grid space is no choice of the player's — still a city).
      goods.push({kind: 'tile', tile: 'city'});
      break;
    default:
      // Any other payload (a resource onto a card, a special tile, a colony, a delegate, …) — not a plain good.
      return undefined;
    }
  }
  return goods.length === 0 ? undefined : goods;
}
