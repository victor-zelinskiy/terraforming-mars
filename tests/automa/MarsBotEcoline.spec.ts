import {expect} from 'chai';
import {Resource} from '../../src/common/Resource';
import {TileType} from '../../src/common/TileType';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {Message} from '../../src/common/logs/Message';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {PlayerInput} from '../../src/server/PlayerInput';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {RemoveAnyPlants} from '../../src/server/deferredActions/RemoveAnyPlants';
import {StealResources} from '../../src/server/deferredActions/StealResources';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

const B23 = BonusCardId.B23_RAPID_SPROUTING;

function b23Count(game: IGame): number {
  return game.automa!.actionDeck.filter((c) => c.kind === 'bonus' && c.id === B23).length;
}

function botTakesOneTurn(game: IGame, human: TestPlayer) {
  human.popWaitingFor();
  game.playerIsFinishedTakingActions();
}

/** Find an option whose title mentions the corporation card. */
function corpOptionOf(options: ReadonlyArray<PlayerInput>): SelectOption | undefined {
  return options.find((o): o is SelectOption => {
    const title = (o as SelectOption).title as Message | string;
    const text = typeof title === 'string' ? title : title.message;
    return text.includes('corporation card');
  });
}

describe('MarsBot Ecoline (C02) + B23 Rapid Sprouting', () => {
  describe('B23 lifecycle — a corporation-owned recurring action card', () => {
    it('generation 1: B23 is in the action deck (exactly one) and in the recurring pool', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C02_ECOLINE}, '-eco-g1');
      expect(b23Count(game)).eq(0); // Built at creation, before the corporation existed.
      game.playerIsFinishedWithResearchPhase(human);
      expect(b23Count(game)).eq(1);
      expect(game.automa!.recurringBonusCards.filter((id) => id === B23)).has.length(1);
    });

    it('every generation: exactly one B23, never lost after a resolution, never in the bonus rotation', () => {
      const [game, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C02_ECOLINE}, '-eco-gen');
      game.playerIsFinishedWithResearchPhase(human);
      const automa = game.automa!;
      // Resolve B23 itself this generation, then run the generation out.
      automa.actionDeck = [{kind: 'bonus', id: B23}];
      botTakesOneTurn(game, human); // The bot flips B23 (0 plants → grows one).
      expect(automa.corpResources).eq(1);
      expect(automa.bonusDiscard).not.contains(B23); // Recurring — never discarded.
      expect(automa.destroyedBonusCards).not.contains(B23);
      expect(automa.recurringBonusCards.filter((id) => id === B23)).has.length(1);
      // Empty the deck; both pass; generation 2 rebuilds the deck.
      automa.actionDeck = [];
      game.playerHasPassed(bot);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.generation).eq(2);
      expect(b23Count(game)).eq(1); // Re-shuffled in — exactly one.
    });

    it('a reload never duplicates B23', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C02_ECOLINE}, '-eco-load');
      game.playerIsFinishedWithResearchPhase(human);
      const restored = Game.deserialize(structuredClone(game.serialize()));
      expect(restored.automa!.actionDeck.filter((c) => c.kind === 'bonus' && c.id === B23)).has.length(1);
      expect(restored.automa!.recurringBonusCards.filter((id) => id === B23)).has.length(1);
      expect(restored.automa!.corpBapGeneration).eq(1); // The BAP guard survived too.
    });
  });

  describe('B23 resolution', () => {
    let game: IGame;
    let human: TestPlayer;
    let bot: IPlayer;

    beforeEach(() => {
      [game, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C02_ECOLINE}, '-eco-res');
      game.playerIsFinishedWithResearchPhase(human);
    });

    it('no plant on the corporation → adds one', () => {
      game.automa!.actionDeck = [{kind: 'bonus', id: B23}];
      botTakesOneTurn(game, human);
      const automa = game.automa!;
      expect(automa.corpResources).eq(1);
      expect(automa.corpStats['sproutingsPlayed']).eq(1);
      expect(automa.corpStats['plantsAdded']).eq(1);
      expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.GREENERY)).is.false;
    });

    it('a plant on the corporation → greenery + oxygen (the standard pipeline: tile, O₂, TR)', () => {
      const automa = game.automa!;
      automa.corpResources = 1;
      automa.actionDeck = [{kind: 'bonus', id: B23}];
      const trBefore = bot.terraformRating;
      botTakesOneTurn(game, human);
      expect(automa.corpResources).eq(0);
      expect(game.board.spaces.filter((s) => s.tile?.tileType === TileType.GREENERY && s.player?.id === bot.id)).has.length(1);
      expect(game.getOxygenLevel()).eq(1);
      expect(bot.terraformRating).eq(trBefore + 1);
      expect(automa.corpStats['plantsSpent']).eq(1);
      expect(automa.corpStats['greeneries']).eq(1);
      expect(automa.corpStats['oxygenSteps']).eq(1);
    });

    it('no legal greenery space → a Failed Action; the plant stays', () => {
      const automa = game.automa!;
      automa.corpResources = 1;
      // Fill every land space so no greenery fits.
      for (const space of game.board.getAvailableSpacesOnLand(bot)) {
        game.simpleAddTile(bot, space, {tileType: TileType.CITY});
      }
      automa.actionDeck = [{kind: 'bonus', id: B23}];
      const mcBefore = bot.megaCredits;
      botTakesOneTurn(game, human);
      expect(automa.corpResources).eq(1); // Kept — the action could not complete.
      expect(bot.megaCredits).eq(mcBefore + 5); // The failed-action compensation.
      expect(automa.recurringBonusCards).contains(B23); // Still recurring.
    });
  });

  describe('the RB-B FAQ — human plant attacks may target the corporation card', () => {
    let game: IGame;
    let human: TestPlayer;
    let bot: IPlayer;

    beforeEach(() => {
      [game, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C02_ECOLINE}, '-eco-faq');
      game.playerIsFinishedWithResearchPhase(human);
    });

    it('a remove-plants attack offers the corporation card as its own target', () => {
      game.automa!.corpResources = 1;
      bot.megaCredits = 10;
      const options = new RemoveAnyPlants(human, 3).buildOptions()!;
      const corpOption = corpOptionOf(options.options);
      expect(corpOption, 'the corporation-card option must exist').is.not.undefined;
      // The generic (M€-proxy) target stays available alongside it.
      expect(options.options.length).to.be.gte(3); // generic + corp + skip.
    });

    it('the excess is LOST — never taken from the M€ supply', () => {
      game.automa!.corpResources = 1;
      bot.megaCredits = 10;
      const options = new RemoveAnyPlants(human, 3).buildOptions()!;
      corpOptionOf(options.options)!.cb(undefined);
      expect(game.automa!.corpResources).eq(0);
      expect(bot.megaCredits).eq(10); // Untouched — the official prohibition.
      expect(game.automa!.corpStats['plantsLostToOpponents']).eq(1);
    });

    it('a steal grants the thief exactly what the card held', () => {
      game.automa!.corpResources = 1;
      bot.megaCredits = 10;
      const plantsBefore = human.plants;
      const options = new StealResources(human, Resource.PLANTS, 3).buildOptions()!;
      corpOptionOf(options.options)!.cb(undefined);
      expect(game.automa!.corpResources).eq(0);
      expect(human.plants).eq(plantsBefore + 1); // 1, not 3 — the excess is lost.
      expect(bot.megaCredits).eq(10);
    });

    it('with no plant on the corporation the option does not exist', () => {
      game.automa!.corpResources = 0;
      bot.megaCredits = 10;
      const options = new RemoveAnyPlants(human, 3).buildOptions()!;
      expect(corpOptionOf(options.options)).is.undefined;
    });

    it('the corporation plant is targetable even when the generic pool is empty', () => {
      game.automa!.corpResources = 1;
      bot.megaCredits = 0; // No M€ proxy, no storage.
      const options = new RemoveAnyPlants(human, 1).buildOptions()!;
      expect(corpOptionOf(options.options)).is.not.undefined;
      // And the bot is NOT listed as a disabled "No plants to remove" target.
      expect(options.disabledOptions?.some((d) => d.metadata?.player?.color === bot.color) ?? false).is.false;
    });

    it('multiplayer: ANY human attacker sees and can take the corporation plant', () => {
      const [mpGame, humans] = testAutomaMultiplayerGame(2, {corporation: MarsBotCorpId.C02_ECOLINE}, '-eco-mp');
      for (const h of humans) {
        mpGame.playerIsFinishedWithResearchPhase(h);
      }
      mpGame.automa!.corpResources = 1;
      const attacker = humans[1];
      const options = new StealResources(attacker, Resource.PLANTS, 2).buildOptions()!;
      const corpOption = corpOptionOf(options.options);
      expect(corpOption).is.not.undefined;
      corpOption!.cb(undefined);
      expect(mpGame.automa!.corpResources).eq(0);
      expect(attacker.plants).eq(1);
    });

    it('the generic MarsBot resource proxy is unchanged for unrelated resources', () => {
      bot.megaCredits = 7;
      game.automa!.corpResources = 1; // A plant on the corp must not affect a steel attack.
      const options = new StealResources(human, Resource.STEEL, 2).buildOptions()!;
      expect(corpOptionOf(options.options)).is.undefined;
      const botOption = options.options.find((o): o is SelectOption => {
        const title = (o as SelectOption).title as Message;
        return title.message.includes('Steal') && title.data.some((d) => d.value === bot.color);
      });
      expect(botOption).is.not.undefined;
      botOption!.cb(undefined);
      expect(bot.megaCredits).eq(5); // The M€ proxy paid, exactly as before.
      expect(game.automa!.corpResources).eq(1);
    });
  });
});
