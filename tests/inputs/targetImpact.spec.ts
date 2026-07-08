import {expect} from 'chai';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {computeTargetImpact} from '../../src/server/inputs/targetImpact';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {testGame} from '../TestGame';
import {testAutomaGame} from '../automa/AutomaTestGame';

describe('computeTargetImpact — universal target before→after (human + MarsBot)', () => {
  describe('human target', () => {
    it('stock removal: the named resource, floored at 0', () => {
      const [/* game */, player] = testGame(2);
      player.plants = 5;
      const impact = computeTargetImpact(player, Resource.PLANTS, 3, 'stock');
      expect(impact.color).eq(player.color);
      expect(impact.changes).deep.eq([{icon: 'plants', from: 5, to: 2, scope: 'stock'}]);
    });

    it('stock removal cannot go below 0', () => {
      const [/* game */, player] = testGame(2);
      player.steel = 1;
      expect(computeTargetImpact(player, Resource.STEEL, 4, 'stock').changes).deep.eq([
        {icon: 'steel', from: 1, to: 0, scope: 'stock'},
      ]);
    });

    it('production decrease: the production field + step count, M€ floors at −5', () => {
      const [/* game */, player] = testGame(2);
      player.production.override({energy: 3});
      expect(computeTargetImpact(player, Resource.ENERGY, 2, 'production').changes).deep.eq([
        {icon: 'energy', from: 3, to: 1, scope: 'production', steps: 2},
      ]);
      player.production.override({megacredits: -3});
      expect(computeTargetImpact(player, Resource.MEGACREDITS, 4, 'production').changes).deep.eq([
        {icon: 'megacredits', from: -3, to: -5, scope: 'production', steps: 4}, // floored at −5
      ]);
    });
  });

  describe('MarsBot target', () => {
    it('production decrease REGRESSES the mapped TRACK — shown by its tag + steps', () => {
      const [game, /* human */, bot] = testAutomaGame();
      // Heat production maps to the EARTH track (tags: earth, city).
      game.automa!.board.tracks[THARSIS_TRACK.EARTH].position = 4;
      const impact = computeTargetImpact(bot, Resource.HEAT, 2, 'production');
      expect(impact.changes).deep.eq([{icon: Tag.EARTH, from: 4, to: 2, scope: 'track', steps: 2}]);
    });

    it('production decrease is capped by the track position (can never go below 0)', () => {
      const [game, /* human */, bot] = testAutomaGame();
      game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = 1;
      // Energy production maps to the ENERGY track (tags: power, jovian).
      const impact = computeTargetImpact(bot, Resource.ENERGY, 3, 'production');
      expect(impact.changes).deep.eq([{icon: Tag.POWER, from: 1, to: 0, scope: 'track', steps: 1}]);
    });

    it('stock removal drains the M€ supply — the bot\'s «gold», shown with the M€ icon', () => {
      const [/* game */, /* human */, bot] = testAutomaGame();
      bot.megaCredits = 7;
      // Removing plants from the bot (no Colonies storage) hits its M€ supply.
      expect(computeTargetImpact(bot, Resource.PLANTS, 5, 'stock').changes).deep.eq([
        {icon: 'megacredits', from: 7, to: 2, scope: 'stock'},
      ]);
    });

    it('stealing M€ shows the M€ supply drop directly', () => {
      const [/* game */, /* human */, bot] = testAutomaGame();
      bot.megaCredits = 4;
      expect(computeTargetImpact(bot, Resource.MEGACREDITS, 3, 'stock').changes).deep.eq([
        {icon: 'megacredits', from: 4, to: 1, scope: 'stock'},
      ]);
    });
  });
});
