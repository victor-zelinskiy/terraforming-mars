import {expect} from 'chai';
import {testGame} from '../TestGame';
import {standardProjectUnavailableReasons} from '../../src/server/models/standardProjectReasons';
import {BuildColonyStandardProject} from '../../src/server/cards/colonies/BuildColonyStandardProject';
import {CityStandardProject} from '../../src/server/cards/base/standardProjects/CityStandardProject';
import {GreeneryStandardProject} from '../../src/server/cards/base/standardProjects/GreeneryStandardProject';
import {AsteroidStandardProject} from '../../src/server/cards/base/standardProjects/AsteroidStandardProject';
import {SellPatentsStandardProject} from '../../src/server/cards/base/standardProjects/SellPatentsStandardProject';
import {MoonMineStandardProject} from '../../src/server/cards/moon/MoonMineStandardProject';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardName} from '../../src/common/cards/CardName';
import {MAX_COLONIES_PER_TILE} from '../../src/common/constants';
import {IColony} from '../../src/server/colonies/IColony';
import {IPlayer} from '../../src/server/IPlayer';

/** Fill `colony` with dummy owners so `isFull()` is true. */
function fill(colony: IColony) {
  while (colony.colonies.length < MAX_COLONIES_PER_TILE) {
    colony.colonies.push('p-filler' as ReturnType<() => IPlayer['id']>);
  }
}

describe('standardProjectReasons', () => {
  it('reaches the CLIENT MODEL through the standard-projects menu', () => {
    // The wiring test: explainer → cardsToModel → CardModel.actionReasons. The
    // screen reads that field; if the menu stops passing it the reason silently
    // degrades back to a bare "unavailable right now" and nothing else fails.
    const [game, player] = testGame(2, {coloniesExtension: true});
    player.megaCredits = 510; // the reported case: money was never the problem
    game.colonies.forEach((colony) => {
      colony.isActive = true;
      fill(colony);
    });
    const model = player.getStandardProjectOption().toModel(player);
    const colonyRow = model.cards.find((c) => c.name === CardName.BUILD_COLONY_STANDARD_PROJECT);
    expect(colonyRow, 'Build Colony must be listed').is.not.undefined;
    expect(colonyRow?.isDisabled).is.true;
    expect(colonyRow?.actionReasons?.[0].message).eq('Every colony tile is full');
    // An AVAILABLE project carries no reason at all.
    const powerPlant = model.cards.find((c) => c.name === CardName.POWER_PLANT_STANDARD_PROJECT);
    expect(powerPlant?.isDisabled).is.undefined;
    expect(powerPlant?.actionReasons).is.undefined;
  });

  it('names the M€ deficit when money is the only blocker', () => {
    const [/* game */, player] = testGame(2);
    const card = new AsteroidStandardProject();
    player.megaCredits = 4;
    const reasons = standardProjectUnavailableReasons(player, card);
    expect(reasons[0].type).eq('megacredits');
    expect(reasons[0].message).eq('Need ${0} more M€');
    // 14 M€ project, 4 in the bank.
    expect(reasons[0].params?.[0]).eq('10');
  });

  it('Sell Patents names the empty hand', () => {
    const [/* game */, player] = testGame(2);
    player.cardsInHand = [];
    const reasons = standardProjectUnavailableReasons(player, new SellPatentsStandardProject());
    expect(reasons[0].message).eq('No cards in hand');
  });

  it('City names the placement blocker, and it OUTRANKS the M€ gap', () => {
    const [game, player] = testGame(2);
    // Occupy every land space so no city can be placed.
    for (const space of game.board.getAvailableSpacesOnLand(player)) {
      game.addCity(player, space);
    }
    player.megaCredits = 0;
    const reasons = standardProjectUnavailableReasons(player, new CityStandardProject());
    // The structural block leads: it survives any amount of money.
    expect(reasons[0].type).eq('placement');
    expect(reasons[0].message).eq('No space left for a city tile');
    // ... and the money gap is still reported, second.
    expect(reasons[1]?.type).eq('megacredits');
  });

  it('Greenery names its own placement blocker', () => {
    const [game, player] = testGame(2);
    for (const space of game.board.getAvailableSpacesOnLand(player)) {
      game.addCity(player, space);
    }
    const reasons = standardProjectUnavailableReasons(player, new GreeneryStandardProject());
    expect(reasons[0].message).eq('No space left for a greenery tile');
  });

  it('a Moon project names the missing RESERVED titanium, not a money gap', () => {
    const [/* game */, player] = testGame(2, {moonExpansion: true});
    player.megaCredits = 100;
    player.titanium = 0;
    const reasons = standardProjectUnavailableReasons(player, new MoonMineStandardProject());
    expect(reasons[0].type).eq('resource');
    expect(reasons[0].message).eq('Not enough titanium');
  });

  describe('Build Colony', () => {
    const card = new BuildColonyStandardProject();

    it('says nothing about colonies when a slot is open (money is the blocker)', () => {
      const [/* game */, player] = testGame(2, {coloniesExtension: true});
      player.megaCredits = 0;
      const reasons = standardProjectUnavailableReasons(player, card);
      expect(reasons[0].type).eq('megacredits');
    });

    it('every colony full → says so, not "unavailable right now"', () => {
      const [game, player] = testGame(2, {coloniesExtension: true});
      player.megaCredits = 100;
      game.colonies.forEach((colony) => {
        colony.isActive = true;
        fill(colony);
      });
      const reasons = standardProjectUnavailableReasons(player, card);
      expect(reasons[0].message).eq('Every colony tile is full');
      expect(reasons[0].current).eq(game.colonies.length);
    });

    it('a colony on every tile already → says so', () => {
      const [game, player] = testGame(2, {coloniesExtension: true});
      player.megaCredits = 100;
      game.colonies.forEach((colony) => {
        colony.isActive = true;
        colony.colonies.push(player.id);
      });
      const reasons = standardProjectUnavailableReasons(player, card);
      expect(reasons[0].message).eq('You already have a colony on every colony tile');
    });

    it('mixed full / already-yours → reports the exact inventory', () => {
      const [game, player] = testGame(2, {coloniesExtension: true});
      player.megaCredits = 100;
      game.colonies.forEach((colony, idx) => {
        colony.isActive = true;
        if (idx % 2 === 0) {
          fill(colony);
        } else {
          colony.colonies.push(player.id);
        }
      });
      const expectedFull = game.colonies.filter((_, idx) => idx % 2 === 0).length;
      const expectedOwned = game.colonies.length - expectedFull;
      const reasons = standardProjectUnavailableReasons(player, card);
      expect(reasons[0].message).eq('No colony has a free slot for you: ${0} full, ${1} already yours');
      expect(reasons[0].params).deep.eq([String(expectedFull), String(expectedOwned)]);
    });

    it('an inactive tile in the mix is counted separately, never mislabelled', () => {
      const [game, player] = testGame(2, {coloniesExtension: true});
      player.megaCredits = 100;
      game.colonies.forEach((colony, idx) => {
        colony.isActive = true;
        if (idx === 0) {
          colony.isActive = false;
        } else {
          fill(colony);
        }
      });
      const reasons = standardProjectUnavailableReasons(player, card);
      expect(reasons[0].message).eq('No colony tile is open to you: ${0} blocked, ${1} not active yet');
      expect(reasons[0].params).deep.eq([String(game.colonies.length - 1), '1']);
    });

    it('never claims a colony blocker while one is genuinely buildable', () => {
      const [game, player] = testGame(2, {coloniesExtension: true});
      player.megaCredits = 100;
      // Leave exactly one colony open (skip Venus/Europa/Leavitt — those add a
      // TR-affordability check the fixture doesn't control).
      const open = game.colonies.find((c) => c.name !== ColonyName.VENUS &&
        c.name !== ColonyName.EUROPA && c.name !== ColonyName.LEAVITT);
      expect(open, 'fixture needs one plain colony').is.not.undefined;
      game.colonies.forEach((colony) => {
        colony.isActive = true;
        if (colony !== open) {
          fill(colony);
        }
      });
      expect(card.actionUnavailableReason(player)).is.undefined;
    });
  });
});
