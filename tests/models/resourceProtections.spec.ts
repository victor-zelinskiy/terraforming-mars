import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Server} from '../../src/server/models/ServerModel';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {ProtectedHabitats} from '../../src/server/cards/base/ProtectedHabitats';
import {Pets} from '../../src/server/cards/base/Pets';
import {Birds} from '../../src/server/cards/base/Birds';
import {LunarSecurityStations} from '../../src/server/cards/moon/LunarSecurityStations';
import {BotanicalExperience} from '../../src/server/cards/pathfinders/BotanicalExperience';
import {PrivateSecurity} from '../../src/server/cards/pathfinders/PrivateSecurity';
import {AsteroidDeflectionSystem} from '../../src/server/cards/promo/AsteroidDeflectionSystem';

/**
 * THE PROTECTION PROJECTION — `protectedResources` / `protectedProduction` /
 * `protectedCardResources` on the public model, plus the printed per-card
 * shield on `CardModel`.
 *
 * These three feed the console rail's shield marks, which are read PASSIVELY
 * (no prompt is open), for the viewer AND for an inspected opponent. That
 * makes them a public contract in their own right: this file is the guard the
 * projection never had — before it, every source was tested at its own
 * removal path and nothing asserted what the client is told.
 */
describe('ServerModel — protection projection', () => {
  it('a plain player is protected nowhere', () => {
    const [, player] = testGame(2);
    const model = Server.getPlayerModel(player).thisPlayer;
    expect(Object.values(model.protectedResources).every((p) => p === 'off')).is.true;
    expect(Object.values(model.protectedProduction).every((p) => p === 'off')).is.true;
    expect(model.protectedCardResources).deep.eq({});
  });

  it('Protected Habitats: plants on, animals and microbes on', () => {
    const [, player] = testGame(2);
    player.playedCards.push(new ProtectedHabitats());
    const model = Server.getPlayerModel(player).thisPlayer;
    expect(model.protectedResources.plants).eq('on');
    expect(model.protectedCardResources[CardResource.ANIMAL]).eq('on');
    expect(model.protectedCardResources[CardResource.MICROBE]).eq('on');
    // …and it says nothing about anything else.
    expect(model.protectedResources.steel).eq('off');
    expect(model.protectedProduction.plants).eq('off');
  });

  it('Asteroid Deflection System also reads as full plant protection', () => {
    const [, player] = testGame(2);
    player.playedCards.push(new AsteroidDeflectionSystem());
    expect(Server.getPlayerModel(player).thisPlayer.protectedResources.plants).eq('on');
  });

  it('Botanical Experience is HALF, and a full source OUTRANKS it', () => {
    const [, player] = testGame(2);
    player.playedCards.push(new BotanicalExperience());
    expect(Server.getPlayerModel(player).thisPlayer.protectedResources.plants).eq('half');

    player.playedCards.push(new ProtectedHabitats());
    expect(Server.getPlayerModel(player).thisPlayer.protectedResources.plants).eq('on');
  });

  it('Lunar Security Stations shields both alloy stocks AND their production', () => {
    const [, player] = testGame(2);
    player.playedCards.push(new LunarSecurityStations());
    const model = Server.getPlayerModel(player).thisPlayer;
    expect(model.protectedResources.steel).eq('on');
    expect(model.protectedResources.titanium).eq('on');
    expect(model.protectedProduction.steel).eq('on');
    expect(model.protectedProduction.titanium).eq('on');
    expect(model.protectedResources.plants).eq('off');
    expect(model.protectedProduction.megacredits).eq('off');
  });

  it('Private Security shields every production and no stock', () => {
    const [, player] = testGame(2);
    player.playedCards.push(new PrivateSecurity());
    const model = Server.getPlayerModel(player).thisPlayer;
    expect(Object.values(model.protectedProduction).every((p) => p === 'on')).is.true;
    expect(Object.values(model.protectedResources).every((p) => p === 'off')).is.true;
  });

  it('the printed per-card shield rides the tableau card model', () => {
    const [, player] = testGame(2);
    player.playedCards.push(new Pets(), new Birds());
    const tableau = Server.getPlayerModel(player).thisPlayer.tableau;
    expect(tableau.find((c) => c.name === CardName.PETS)?.protectedResources).is.true;
    // Every other card stays silent — absent, never `false`.
    expect(tableau.find((c) => c.name === CardName.BIRDS)?.protectedResources).is.undefined;
  });

  /**
   * The rail shows an INSPECTED opponent's shields, so the projection must be
   * public — a self-only field would silently blank that seat's marks.
   */
  it('every seat sees an opponent\'s protections', () => {
    const [, player, player2] = testGame(2);
    player.playedCards.push(new ProtectedHabitats(), new Pets());

    const fromOpponent = Server.getPlayerModel(player2).players.find((p) => p.color === player.color);
    expect(fromOpponent?.protectedResources.plants).eq('on');
    expect(fromOpponent?.protectedCardResources[CardResource.ANIMAL]).eq('on');
    expect(fromOpponent?.tableau.find((c) => c.name === CardName.PETS)?.protectedResources).is.true;
  });
});
