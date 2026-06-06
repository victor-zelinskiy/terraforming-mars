import {IPlayer} from '../IPlayer';
import {ICard, IActionCard} from '../cards/ICard';
import {Behavior} from '../behavior/Behavior';
import {Counter} from '../behavior/Counter';
import {Resource} from '../../common/Resource';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {Turmoil} from '../turmoil/Turmoil';

/**
 * Authoritative, structured explanation of why an action card's ACTIVATABLE
 * ACTION can't be used right now. The analog of `unplayableReasons.ts` (which
 * explains why a hand card can't be PLAYED). Returns `[]` when the action IS
 * available (turn-independent — `canAct` doesn't depend on whose turn it is; the
 * client adds the "not your turn" soft reason). Capped + deduped, read-only.
 *
 * Strategy:
 *   1. For DECLARATIVE action cards (`actionBehavior` set), mirror the relevant
 *      checks `Executor.canExecute` runs and emit a reason per failing check.
 *   2. For BESPOKE action cards (custom `canAct`), the optional
 *      `ICard.actionUnavailableReason` hook supplies the message.
 *   3. Honest generic fallback so the popover is never empty.
 */
export function actionUnavailableReasons(player: IPlayer, card: ICard & IActionCard): ReadonlyArray<UnplayableReason> {
  // canAct is the authoritative gate (same one getPlayableActionCards uses).
  if (card.canAct(player)) {
    return [];
  }
  const reasons: Array<UnplayableReason> = [];
  const behavior = card.actionBehavior;
  if (behavior !== undefined) {
    collectActionBehaviorReasons(player, card, behavior, reasons);
  }
  // Bespoke reason from the card's own `actionUnavailableReason` hook — consulted
  // only when the declarative behavior scan surfaced nothing. So a declarative
  // card blocked by a covered check keeps its specific reason, and a card with a
  // bespoke `canAct` (or a declarative card blocked by a bespoke gate, e.g. Water
  // Splitting Plant's Reds tax when energy is fine) gets its hook's reason. The
  // hook lives in the CARD FILE next to `canAct`, so a `canAct` change (refactor
  // or upstream merge) lands in the same diff and the two can't drift out of sync.
  if (reasons.length === 0) {
    const bespoke = card.actionUnavailableReason?.(player);
    if (bespoke !== undefined) {
      reasons.push(bespoke);
    }
  }
  if (reasons.length === 0) {
    reasons.push({type: 'rule', message: 'Action conditions are not met right now'});
  }
  return dedupe(reasons).slice(0, 5);
}

const PLACEMENT: UnplayableReason = {type: 'placement', message: 'No space available for the tile'};

/**
 * Mirror the action-relevant checks from `Executor.canExecute`, emitting a
 * structured reason per failing check instead of a short-circuit `false`. We do
 * NOT short-circuit — every blocker is surfaced (deduped + capped by the caller).
 */
function collectActionBehaviorReasons(
  player: IPlayer,
  card: ICard,
  behavior: Behavior,
  out: Array<UnplayableReason>): void {
  const game = player.game;
  const ctx = new Counter(player, card);

  // `or` action (e.g. Aerial Mappers): available iff ANY sub-behavior can run.
  // Since the action is unavailable, none can — collect each sub's reasons.
  if (behavior.or !== undefined) {
    for (const sub of behavior.or.behaviors) {
      collectActionBehaviorReasons(player, card, sub, out);
    }
  }

  if (behavior.production !== undefined && !player.production.canAdjust(ctx.countUnits(behavior.production))) {
    out.push({type: 'production', message: 'Cannot reduce production'});
  }

  const spend = behavior.spend;
  if (spend !== undefined) {
    if (spend.megacredits && !player.canAfford(spend.megacredits)) {
      const deficit = Math.max(1, spend.megacredits - player.spendableMegacredits());
      out.push({type: 'megacredits', message: 'Need ${0} more M€', params: [String(deficit)]});
    }
    if (spend.steel && player.steel < spend.steel) {
      out.push({type: 'resource', message: 'Not enough steel', resource: Resource.STEEL, current: player.steel});
    }
    if (spend.titanium && player.titanium < spend.titanium) {
      out.push({type: 'resource', message: 'Not enough titanium', resource: Resource.TITANIUM, current: player.titanium});
    }
    if (spend.plants && player.plants < spend.plants) {
      out.push({type: 'resource', message: 'Not enough plants', resource: Resource.PLANTS, current: player.plants});
    }
    if (spend.energy && player.energy < spend.energy) {
      out.push({type: 'resource', message: 'Not enough energy', resource: Resource.ENERGY, current: player.energy});
    }
    if (spend.heat && player.availableHeat() < spend.heat) {
      out.push({type: 'resource', message: 'Not enough heat', resource: Resource.HEAT, current: player.availableHeat()});
    }
    if (spend.resourcesHere && card.resourceCount < spend.resourcesHere) {
      out.push({type: 'count', message: 'Not enough resources on this card', current: card.resourceCount});
    }
    if (spend.resourceFromAnyCard && player.getCardsWithResources(spend.resourceFromAnyCard.type).length === 0) {
      out.push({type: 'target', message: 'No card has the right resource to remove'});
    }
    if (spend.cards && player.cardsInHand.filter((c) => c !== card).length < spend.cards) {
      out.push({type: 'count', message: 'Not enough cards in hand'});
    }
  }

  if (behavior.decreaseAnyProduction !== undefined && !game.isSoloMode()) {
    const dap = behavior.decreaseAnyProduction;
    const targets = game.players.filter((p) => p.canHaveProductionReduced(dap.type, dap.count, player));
    if (targets.length === 0) {
      out.push({type: 'target', message: 'No target to reduce production', resource: dap.type});
    }
  }

  if (behavior.colonies?.buildColony !== undefined) {
    if (player.colonies.getPlayableColonies(behavior.colonies.buildColony.allowDuplicates).length === 0) {
      out.push({type: 'target', message: 'No colony available to build on'});
    }
  }

  if (behavior.city !== undefined && behavior.city.space === undefined) {
    if (game.board.getAvailableSpacesForType(player, behavior.city.on ?? 'city').length === 0) {
      out.push(PLACEMENT);
    }
  }
  if (behavior.greenery !== undefined) {
    const spaces = game.board.getAvailableSpacesForType(player, behavior.greenery.on ?? 'greenery');
    if (game.board.filterSpacesAroundRedCity(spaces).length === 0) {
      out.push(PLACEMENT);
    }
  }
  if (behavior.tile !== undefined) {
    if (game.board.getAvailableSpacesForType(player, behavior.tile.on).length === 0) {
      out.push(PLACEMENT);
    }
  }

  if (behavior.addResourcesToAnyCard !== undefined && !Array.isArray(behavior.addResourcesToAnyCard)) {
    const arctac = behavior.addResourcesToAnyCard;
    if (arctac.mustHaveCard === true) {
      const action = new AddResourcesToCard(player, arctac.type, {
        count: ctx.count(arctac.count),
        restrictedTag: arctac.tag,
        min: arctac.min,
        robotCards: arctac.robotCards !== undefined,
      });
      if (action.getCards().length === 0) {
        out.push({type: 'target', message: 'No card to add the resource to'});
      }
    }
  }

  if (behavior.drawCard !== undefined) {
    const drawCard = behavior.drawCard;
    const count = typeof(drawCard) === 'number' ? drawCard : ctx.count(drawCard.count);
    if (game.projectDeck.canDraw(count) === false) {
      out.push({type: 'rule', message: 'The deck is empty'});
    }
  }

  if (behavior.turmoil?.sendDelegates !== undefined) {
    const count = ctx.count(behavior.turmoil.sendDelegates.count);
    if (Turmoil.getTurmoil(game).getAvailableDelegateCount(player) < count) {
      out.push({type: 'party', message: 'Not enough available delegates'});
    }
  }
}

function dedupe(reasons: ReadonlyArray<UnplayableReason>): Array<UnplayableReason> {
  const seen = new Set<string>();
  const out: Array<UnplayableReason> = [];
  for (const r of reasons) {
    const key = `${r.type}|${r.message}|${r.resource ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}
