import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions, addCity} from '../TestingUtils';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Phase} from '@/common/Phase';
import {Resource} from '@/common/Resource';
import {GameEvent} from '@/common/events/GameEvent';
import {actionOverlayStats, effectOverlayStats} from '@/common/events/aggregate';
import {Pets} from '@/server/cards/base/Pets';
import {CarbonNanosystems} from '@/server/cards/promo/CarbonNanosystems';
import {TradingColony} from '@/server/cards/colonies/TradingColony';

describe('effect channel stats (byChannel split)', () => {
  it('splits a multi-effect card by channel: hook trigger vs resource-as-payment (Carbon Nanosystems)', () => {
    const [game, player] = testGame(1);
    const events = game.events;
    const cn = new CarbonNanosystems();
    // Effect #0: the owner plays a science card → +1 graphene (an effect scope
    // with the 'card-played' trigger, exactly how Player.playCard wraps the hook).
    events.withEffect(player, cn, 'card-played', () => {
      events.recordCardResourceDelta(player, cn, 1);
    });
    // Effect #1: 2 graphene spent as payment, worth 8 M€ (tag-identified family).
    events.recordResourceAsPayment(player, cn, 2, 8);

    const stats = effectOverlayStats(events.events, player.color);
    const stat = stats.find((s) => s.card === cn.name);
    expect(stat, 'Carbon Nanosystems stat').to.not.be.undefined;
    // Card-level totals unchanged by the split (regression):
    expect(stat!.cardResources[CardResource.GRAPHENE]).to.eq(1);
    expect(stat!.megacreditsSaved).to.eq(8);
    expect(stat!.triggerCount).to.eq(1); // the marker only; a payment event is not a card-level trigger

    const byChannel = stat!.byChannel;
    expect(byChannel, 'byChannel').to.not.be.undefined;
    expect(byChannel!.unattributed, 'no unattributed residue').to.be.undefined;
    expect(byChannel!['card-played']?.cardResources[CardResource.GRAPHENE]).to.eq(1);
    expect(byChannel!['card-played']?.triggerCount).to.eq(1);
    expect(byChannel!['card-played']?.megacreditsSaved ?? 0).to.eq(0);
    expect(byChannel!['resource-payment']?.megacreditsSaved).to.eq(8);
    expect(byChannel!['resource-payment']?.paymentResources[CardResource.GRAPHENE]).to.eq(2);
    // A payment channel counts one per payment event (deliberately NOT part of
    // the card-level total — documented on EffectChannelStat).
    expect(byChannel!['resource-payment']?.triggerCount).to.eq(1);
  });

  it('routes a discount onto the discount channel', () => {
    const [game, player] = testGame(1);
    const events = game.events;
    events.recordDiscount(player, {kind: 'card', card: CardName.EARTH_CATAPULT, owner: player.color}, 2, CardName.BIRDS);
    events.recordDiscount(player, {kind: 'card', card: CardName.EARTH_CATAPULT, owner: player.color}, 2, CardName.FISH);

    const stat = effectOverlayStats(events.events, player.color).find((s) => s.card === CardName.EARTH_CATAPULT);
    expect(stat?.byChannel?.discount?.megacreditsSaved).to.eq(4);
    expect(stat?.byChannel?.discount?.triggerCount).to.eq(2);
    expect(stat?.byChannel?.discount?.lastTrigger?.generation).to.eq(game.generation);
  });

  it('recovers the channel for DEFERRED impacts through the marker chain (Pets on city placement)', () => {
    const [game, player] = testGame(1);
    player.playedCards.push(new Pets());
    addCity(player);
    addCity(player);
    runAllActions(game);

    const stat = effectOverlayStats(game.events.events, player.color).find((s) => s.card === CardName.PETS);
    expect(stat, 'Pets stat').to.not.be.undefined;
    const byChannel = stat!.byChannel;
    expect(byChannel, 'byChannel').to.not.be.undefined;
    expect(byChannel!.unattributed, 'no unattributed residue').to.be.undefined;
    expect(byChannel!['tile-placed']?.cardResources[CardResource.ANIMAL]).to.eq(2);
    expect(byChannel!['tile-placed']?.triggerCount).to.eq(2);
  });

  it('routes the trigger-less colony recorders by their tag channel', () => {
    const [game, player] = testGame(1);
    const events = game.events;
    const card = new TradingColony();
    events.recordColonyTrackBonus(player, card, ColonyName.LUNA, 1, 2);

    const stat = effectOverlayStats(events.events, player.color).find((s) => s.card === card.name);
    expect(stat?.byChannel?.['colony-track']?.colonyTrack.steps).to.eq(1);
    expect(stat?.byChannel?.['colony-track']?.colonyTrack.extraReward).to.eq(2);
    expect(stat?.byChannel?.['colony-track']?.triggerCount).to.eq(1);
    expect(stat?.byChannel?.unattributed).to.be.undefined;
  });

  it('classifies an orphaned passive impact as unattributed (older/degraded streams)', () => {
    const orphan: GameEvent = {
      id: 1,
      generation: 2,
      phase: Phase.ACTION,
      player: 'red' as GameEvent['player'],
      type: 'resource-changed',
      source: {kind: 'card', card: CardName.ROVER_CONSTRUCTION, owner: 'red' as GameEvent['player']},
      impact: {stock: {megacredits: 2}},
      correlationId: 1,
      visibility: 'analytics',
      tags: ['passive-effect'],
    };
    const stat = effectOverlayStats([orphan], orphan.player!).find((s) => s.card === CardName.ROVER_CONSTRUCTION);
    expect(stat?.byChannel?.unattributed?.stock.megacredits).to.eq(2);
    // Card-level totals still fold the impact (the split never loses data).
    expect(stat?.stock.megacredits).to.eq(2);
  });

  it('keeps byChannel OFF the action stats (effects-only field)', () => {
    const [game, player] = testGame(1);
    const events = game.events;
    const cn = new CarbonNanosystems();
    events.beginAction(player, {kind: 'card', card: cn.name, owner: player.color}, {category: 'card-action'});
    events.recordResourceDelta(player, Resource.MEGACREDITS, 3, false, {card: cn});
    events.endScope();

    const action = actionOverlayStats(events.events, player.color).find((s) => s.card === cn.name);
    expect(action, 'action stat').to.not.be.undefined;
    expect(action!.byChannel).to.be.undefined;
  });

  it('a nested foreign effect stays off the outer card\'s channels', () => {
    const [game, player] = testGame(1);
    const events = game.events;
    const cn = new CarbonNanosystems();
    const pets = new Pets();
    events.withEffect(player, cn, 'card-played', () => {
      events.recordCardResourceDelta(player, cn, 1);
      // A nested DIFFERENT card's effect firing inside the outer scope.
      events.withEffect(player, pets, 'tile-placed', () => {
        events.recordCardResourceDelta(player, pets, 1);
      });
    });

    const stats = effectOverlayStats(events.events, player.color);
    const cnStat = stats.find((s) => s.card === cn.name);
    const petsStat = stats.find((s) => s.card === pets.name);
    expect(cnStat?.byChannel?.['card-played']?.cardResources[CardResource.GRAPHENE]).to.eq(1);
    expect(cnStat?.byChannel?.['tile-placed'], 'the foreign effect is not a CN channel').to.be.undefined;
    expect(petsStat?.byChannel?.['tile-placed']?.cardResources[CardResource.ANIMAL]).to.eq(1);
    expect(petsStat?.byChannel?.unattributed).to.be.undefined;
  });
});
