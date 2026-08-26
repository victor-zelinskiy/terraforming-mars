import {expect} from 'chai';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {RemoveResources} from '../../src/server/deferredActions/RemoveResources';
import {Resource} from '../../src/common/Resource';
import {ProtectedHabitats} from '../../src/server/cards/base/ProtectedHabitats';
import {BotanicalExperience} from '../../src/server/cards/pathfinders/BotanicalExperience';
import {LunarSecurityStations} from '../../src/server/cards/moon/LunarSecurityStations';
import {runAllActions} from '../TestingUtils';
import {IGame} from '../../src/server/IGame';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {assertIsMaybeBlock} from '../underworld/underworldAssertions';
import {cast} from '@/common/utils/utils';

describe('RemoveResources', () => {
  let player: TestPlayer;
  let target: TestPlayer;

  let removed: number;
  const andThen = (c: number) => {
    removed = c;
  };

  beforeEach(() => {
    [/* game */, player, target] = testGame(3);
    removed = 0;
  });

  it('simple', () => {
    target.plants = 15;
    new RemoveResources(target, player, Resource.PLANTS, 2).andThen(andThen).execute();
    expect(removed).eq(2);
    expect(target.plants).eq(13);
  });

  it('not enough', () => {
    target.plants = 1;
    new RemoveResources(target, player, Resource.PLANTS, 2).andThen(andThen).execute();
    expect(removed).eq(1);
    expect(target.plants).eq(0);
  });

  /*
   * EVERY printed protection is worded against SOMEBODY ELSE («…by other
   * players» / «Opponents may not…»), so none of them defends its owner from
   * their own card. This deferred carries exactly that case: Small Comet and
   * Plant Tax make EVERY player lose 2 plants, the caster included.
   */
  it('a self-inflicted loss is never protected (Protected Habitats)', () => {
    player.plants = 5;
    player.playedCards.push(new ProtectedHabitats());
    new RemoveResources(player, player, Resource.PLANTS, 2).andThen(andThen).execute();
    expect(removed).eq(2);
    expect(player.plants).eq(3);
  });

  it('a self-inflicted loss is never protected (Lunar Security Stations)', () => {
    player.steel = 5;
    player.playedCards.push(new LunarSecurityStations());
    new RemoveResources(player, player, Resource.STEEL, 2).andThen(andThen).execute();
    expect(removed).eq(2);
    expect(player.steel).eq(3);
  });

  it('a self-inflicted loss is not halved either (Botanical Experience)', () => {
    player.plants = 5;
    player.playedCards.push(new BotanicalExperience());
    new RemoveResources(player, player, Resource.PLANTS, 4).andThen(andThen).execute();
    expect(removed).eq(4);
    expect(player.plants).eq(1);
  });

  /* An empty stock is an ANSWER, not silence: the protected branch reports 0,
   * so this one must too — a caller chaining `andThen` would otherwise wait
   * for a callback that never arrives. */
  it('reports 0 when there is nothing to take', () => {
    target.plants = 0;
    let called = false;
    new RemoveResources(target, player, Resource.PLANTS, 2)
      .andThen((c) => {
        called = true;
        removed = c;
      })
      .execute();
    expect(called, 'the callback fires even with an empty stock').is.true;
    expect(removed).eq(0);
  });

  it('Protected Habitats', () => {
    target.plants = 5;
    target.playedCards.push(new ProtectedHabitats());
    new RemoveResources(target, player, Resource.PLANTS, 2).andThen(andThen).execute();
    expect(removed).eq(0);
    expect(target.plants).eq(5);
  });

  it('Protected Habitats works only for plants', () => {
    target.steel = 5;
    target.playedCards.push(new ProtectedHabitats());
    new RemoveResources(target, player, Resource.STEEL, 2).andThen(andThen).execute();
    expect(removed).eq(2);
    expect(target.steel).eq(3);
  });

  it('Botanical Experience', () => {
    target.plants = 5;
    target.playedCards.push(new BotanicalExperience());
    new RemoveResources(target, player, Resource.PLANTS, 4).andThen(andThen).execute();
    expect(removed).eq(2);
    expect(target.plants).eq(3);
  });

  it('Lunar Security Stations', () => {
    target.steel = 5;
    target.playedCards.push(new LunarSecurityStations());
    new RemoveResources(target, player, Resource.STEEL, 2).andThen(andThen).execute();
    expect(removed).eq(0);
    expect(target.steel).eq(5);
  });

  it('Lunar Security Stations works only for alloys', () => {
    target.plants = 5;
    target.playedCards.push(new LunarSecurityStations());
    new RemoveResources(target, player, Resource.PLANTS, 2).andThen(andThen).execute();
    expect(removed).eq(2);
    expect(target.plants).eq(3);
  });

  it('Underworld blocking', () => {
    let game: IGame;
    [game, player, target] = testGame(3, {underworldExpansion: true});
    target.plants = 15;
    target.underworldData.corruption = 1;
    new RemoveResources(target, player, Resource.PLANTS, 2).andThen(andThen).execute();
    runAllActions(game);
    const orOptions = cast(target.popWaitingFor(), OrOptions);

    assertIsMaybeBlock(player, orOptions, 'corruption');
    expect(removed).eq(0);
    expect(target.plants).eq(15);
    expect(target.underworldData.corruption).eq(0);

    assertIsMaybeBlock(player, orOptions, 'do not block');
    expect(removed).eq(2);
    expect(target.plants).eq(13);
  });
});
