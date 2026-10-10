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
 *  · the variant must SPEND `resourcesHere` (a number) and pay exactly ONE
 *    plain good: one production step, one stock gain, a draw (with its tag
 *    filter at most), a TR step or one global-parameter step;
 *  · a variant that spends this card's resource for anything the console
 *    cannot name as one good (a target to pick, a placement, a choice of goods,
 *    several goods at once, a draw-and-keep) makes the WHOLE card plain storage
 *    — half a truth on a chip is a lie;
 *  · two variants spending this card's resource (Atmo Collectors' «1 floater →
 *    2 titanium OR 2 energy OR 3 heat») is a CHOICE, not one good: storage;
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
    return undefined;
  }
  const variants: ReadonlyArray<Behavior> = action.or !== undefined ? action.or.behaviors : [action];
  const found: Array<HolderActionGood> = [];
  for (const variant of variants) {
    const spend = variant.spend?.resourcesHere;
    if (typeof spend !== 'number' || spend <= 0) {
      continue;
    }
    const good = goodOf(variant);
    if (good === undefined) {
      return undefined;
    }
    found.push({spend, good});
  }
  return found.length === 1 ? found[0] : undefined;
}

/** The ONE plain good a variant pays beside its `spend`, or undefined when it pays anything else. */
function goodOf(variant: Behavior): ActionGood | undefined {
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
    default:
      // Any other payload (a resource onto a card, a tile, a colony, a delegate, …) — not one plain good.
      return undefined;
    }
  }
  return goods.length === 1 ? goods[0] : undefined;
}
