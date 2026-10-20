/*
 * THE EACH-COUNTED CARD STEP (Turmoil Redux) — the ONE executor of a
 * card-resource unit that ASKS NOBODY (`InfluenceYieldUnit.cardResource` with
 * `onto: 'each-counted'`): `count.per` units onto EVERY card the effect's
 * count counted, each of that card's OWN kind. Sponsored Projects (RX40) is
 * the first: «add 1 resource to each of your cards that already has a
 * resource» — the count is the seat's cards that already hold one
 * (`cardsWithResources`, the engine's `Player.getCardsWithResources`), and
 * every one of them receives. A card declares the unit; this step is the same
 * for every one of them, so the next «each card …» law adds no code here.
 *
 * WHAT THE STEP FIXES:
 *  · THE CARDS ARE THE COUNT'S — the very list the count model carries (the
 *    seat's model before the vote, the record after it), read through the one
 *    server reading (`resolutionCount`), never a walk of its own: a second walk
 *    would promise one set and pay another. The list is fixed in `ctx.state`
 *    the first time the step runs and re-read after, so nothing a payout sets
 *    off (a reactor adding a resource to a card that held none) widens it:
 *    «ALREADY has» is read before the first unit lands.
 *  · EACH CARD TAKES ITS OWN KIND — the unit declares none (`'own-kind'`): an
 *    animal on Fish, a floater on Dirigibles, a data on Political Science. No
 *    question of the kind and none of the card: «each» is each, so there is
 *    no target anybody chooses (invariant 3 has nothing to show).
 *  · THROUGH `addResourceTo` — every consequence is the engine's: the journal
 *    line per card under the law's source (`from: {resolution}`), the
 *    `cardResource` event inside the law's scope, the card's own points, the
 *    table's answers to an added resource (`onResourceAdded` — Meat Industry,
 *    Martian Fiber). The chairman quest never counts it: the political phase
 *    is a resolution's root (`QuestTracker.eligible`).
 *  · ZERO IS NAMED — a seat with no card holding a resource records a
 *    `skipped` with its own reason (`EACH_COUNTED_NO_HOLDER_REASON`), apart
 *    from any other part's zero.
 *  · THE RECORD — `kind: 'cardResource'`, `onto: 'each-counted'`, the count
 *    and its cards with what each held (`countedByCard`), and WHERE every
 *    unit landed with what the card held BEFORE and what the unit did to its
 *    points (`cards[].before`, `cards[].vp` — the receipt's «2 → 3», «ПО
 *    1 → 2», measured at the landing). The ONE `resource` only when every
 *    card took one kind (Medical Database's rule); a mixed landing names no
 *    single kind — its cards name their own.
 *
 * The step MUTATES and never asks, so a reload never finds it half-done: the
 * driver's per-seat key makes it once. MarsBot holds no cards (its «card
 * resources» are a storage area) and is never walked here (decision D3 — a
 * law's PAYOUT is no deed; D11 hands the bot only a tile or a Career step).
 */
import {ResolutionId} from '../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, paysEachCountedCard, scaledAmount} from '../../../common/parliament/influenceScaling';
import {ResolutionCountModel, resolutionCountKind} from '../../../common/parliament/resolutionCounts';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {targetVictoryPoints} from '../../cards/actionPreviews';
import {EnactStep} from './IResolution';
import {resolutionCount} from './ResolutionCounts';

/** The zero of an each-counted payout: the seat has no card holding a resource yet. */
export const EACH_COUNTED_NO_HOLDER_REASON = 'No card of yours has a resource yet';

/** The state key the step fixes its counted cards under (see the contract above). */
const COUNTED_KEY = 'eachCountedCards';

function isCountModel(value: unknown): value is ResolutionCountModel {
  return typeof value === 'object' && value !== null && typeof (value as ResolutionCountModel).count === 'number' &&
    Array.isArray((value as ResolutionCountModel).cards);
}

/**
 * THE STEP paying `effect` — a card-resource unit `onto: 'each-counted'` whose
 * count is a HOLDERS count — for `resolution`. Refuses any other declaration
 * at construction: the step and its declaration are one thing.
 */
export function eachCountedCardStep(resolution: ResolutionId, effect: InfluenceScaledEffect): EnactStep {
  const count = effect.count;
  if (!paysEachCountedCard(effect) || count === undefined || resolutionCountKind(count.id).kind !== 'holders') {
    throw new Error(`${resolution}: the each-counted step pays a card-resource unit onto every card of a HOLDERS count (effect '${effect.id}')`);
  }
  return {
    key: effect.id,
    run(ctx) {
      const player = ctx.player;
      const influence = ctx.influence;
      // THE CARDS, fixed the first time — what «already has a resource» read before anything landed.
      const remembered = ctx.state[COUNTED_KEY];
      const counted: ResolutionCountModel = isCountModel(remembered) ? remembered : resolutionCount(player, count.id);
      ctx.state[COUNTED_KEY] = counted;
      const owed = scaledAmount(effect, influence, counted.count);
      const recorded = {
        effect: effect.id,
        onto: 'each-counted' as const,
        influence,
        count: counted.count,
        counted: [...counted.cards],
        ...(counted.byCard === undefined ? {} : {countedByCard: counted.byCard.map((entry) => ({...entry}))}),
      };
      if (owed <= 0) {
        ctx.game.log('${0} has no card with a resource on it — nothing from ${1}', (b) => b.player(player).resolution(resolution));
        ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: EACH_COUNTED_NO_HOLDER_REASON});
        return undefined;
      }
      const cards: Array<{card: CardName; amount: number; resource: CardResource; before: number; vp?: {from: number; to: number}}> = [];
      for (const name of counted.cards) {
        // The counted card, live: the count was read off this tableau a moment ago, inside the same step.
        const card = player.playedCards.get(name);
        if (card === undefined || card.resourceType === undefined) {
          continue;
        }
        const before = card.resourceCount;
        // The card's points after the unit — the preview family's own reading, taken before the unit lands.
        const points = targetVictoryPoints(player, [card], count.per)?.[card.name];
        player.addResourceTo(card, {qty: count.per, log: true, from: {resolution}});
        cards.push({
          card: card.name, amount: count.per, resource: card.resourceType, before,
          ...(points === undefined ? {} : {vp: {from: points.from, to: points.to}}),
        });
      }
      const kinds = new Set(cards.map((entry) => entry.resource));
      ctx.report({
        kind: 'cardResource',
        ...recorded,
        amount: owed,
        ...(kinds.size === 1 ? {resource: cards[0].resource} : {}),
        ...(cards.length === 1 ? {card: cards[0].card} : {}),
        cards,
      });
      return undefined;
    },
  };
}
