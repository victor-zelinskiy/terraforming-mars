import {IPlayer} from '../IPlayer';
import {ICard, IActionCard} from '../cards/ICard';
import {Behavior} from '../behavior/Behavior';
import {Counter} from '../behavior/Counter';
import {Resource} from '../../common/Resource';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {resourcesHereShort} from '../cards/actionReasons';

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
 *
 * Exported so the READ-ONLY action-preview builder (`actionPreview.ts`) can reuse
 * it as its per-(sub-)behavior executability gate: a behavior is executable iff
 * this collects zero reasons — the exact read-only mirror of the `Executor.execute`
 * `or`-branch filter, WITHOUT the `card.warnings.add` side effects `canExecute` has.
 */
export function collectActionBehaviorReasons(
  player: IPlayer,
  card: ICard,
  behavior: Behavior,
  out: Array<UnplayableReason>): void {
  const game = player.game;
  const ctx = new Counter(player, card);

  // `or` action (e.g. Aerial Mappers): available iff ANY sub-behavior can run.
  // Since the action is unavailable, none can — collect each sub's reasons.
  // An OPTIONAL choice (`OrBehavior.optional`) never blocks: with no
  // executable branch the card still plays and the choice is skipped by name,
  // so its branches' reasons are the BRANCHES' (the preview greys each with
  // its own), not the card's.
  //
  // A reason EVERY variant shares closes the whole action, so it leads (TR58: no floater holder refuses «3 plants» and
  // «5 heat» alike — «too few plants» is one variant's, and a card-level line that led with it would name a shortfall
  // whose cure opens nothing). Then each variant's own, in the printed order; the caller dedupes.
  if (behavior.or !== undefined && behavior.or.optional !== true) {
    const perSub = behavior.or.behaviors.map((sub) => {
      const own: Array<UnplayableReason> = [];
      collectActionBehaviorReasons(player, card, sub, own);
      return own;
    });
    const shared = (perSub[0] ?? []).filter((r) => perSub.every((own) => own.some((o) => reasonKey(o) === reasonKey(r))));
    out.push(...shared, ...perSub.flat());
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
    out.push(...spendStockReasons(player, spend));
    if (spend.resourcesHere && card.resourceCount < spend.resourcesHere) {
      // «1 of 2 mechs on this card» — the count, the need and the resource (PL-197), never a bare «not enough».
      out.push(resourcesHereShort(card.resourceType, card.resourceCount, spend.resourcesHere));
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
    const reason = delegateReserveReason(player, ctx.count(behavior.turmoil.sendDelegates.count));
    if (reason !== undefined) {
      out.push(reason);
    }
  }
}

/**
 * «Not enough delegates to place» — why `behavior.turmoil.sendDelegates` fails
 * `Executor.canExecute` (a card's play: Cultural Metropolis, the prelude2 /
 * Pathfinders envoys; an action: Martian Media Center). Reads the FACADE's reserve —
 * the number the Executor gates on — never the classic engine (which throws on a
 * Turmoil Redux table). Redux NAMES the gap («Delegates in your reserve: 1 of 2»);
 * the classic engine keeps upstream's bare line.
 */
export function delegateReserveReason(player: IPlayer, count: number): UnplayableReason | undefined {
  const politics = player.game.politics;
  const inReserve = politics?.delegatesInReserve(player) ?? 0;
  if (inReserve >= count) {
    return undefined;
  }
  if (politics?.engine !== 'redux') {
    return {type: 'party', message: 'Not enough available delegates'};
  }
  return {type: 'party', message: 'Delegates in your reserve: ${0} of ${1}', params: [String(inReserve), String(count)], current: inReserve};
}

/**
 * One reason's identity. The params are part of it: two variants sharing ONE price (TR57 — «2 mechs → steel OR
 * titanium») say the same «1 of 2» once, while two different needs of one template stay two.
 */
function reasonKey(r: UnplayableReason): string {
  return `${r.type}|${r.message}|${(r.params ?? []).join(',')}|${r.resource ?? ''}`;
}

function dedupe(reasons: ReadonlyArray<UnplayableReason>): Array<UnplayableReason> {
  const seen = new Set<string>();
  const out: Array<UnplayableReason> = [];
  for (const r of reasons) {
    const key = reasonKey(r);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

/**
 * A declared STOCK price (`Behavior.spend` — steel, titanium, plants, energy, heat) the player cannot pay: one reason
 * per short unit, its icon and the player's `current`. ONE rung for both doors that declare a price — an action
 * (`actionUnavailableReasons`) and a PLAY (`unplayableReasons` — TR54 Overclocked Equipment's «also pay 3 energy»);
 * the gates themselves are `Executor.canExecute`'s, mirrored here.
 */
export function spendStockReasons(player: IPlayer, spend: NonNullable<Behavior['spend']>): Array<UnplayableReason> {
  const out: Array<UnplayableReason> = [];
  // Steel stored on Modular Floodgates «counts as on your player board»
  // (DP11) — a unit-steel cost can draw on it, so both the gate and the
  // reported `current` count it (mirrors `Executor.canExecute`).
  if (spend.steel && player.steel + player.getSpendable('floodgateSteel') < spend.steel) {
    out.push({type: 'resource', message: 'Not enough steel', resource: Resource.STEEL, current: player.steel + player.getSpendable('floodgateSteel')});
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
  return out;
}
