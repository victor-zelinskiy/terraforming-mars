import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {MarsBotTerraLabs} from '../../src/server/automa/corps/MarsBotTerraLabs';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const TR_LOSS = 8;
const LATE_GENERATION = 9;

/**
 * A live TerraLabs game. ⚠️ Its Before-Action-Phase box has ALREADY resolved
 * once by the first action phase (RB-B resolves those boxes after setup too,
 * through the shared gate), so every counter here is read as a DELTA.
 */
function terraLabsGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C38_TERRALABS): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Run the printed box directly — the once-per-generation gate is its own concern. */
function runBox(game: IGame, corporation: MarsBotCorpId = MarsBotCorpId.C38_TERRALABS) {
  AutomaCorporations.corpFor(corporation).beforeActionPhase?.(game);
}

function deckSize(game: IGame): number {
  return game.automa!.actionDeck.length;
}

function projectEntries(game: IGame): number {
  return game.automa!.actionDeck.filter((entry) => entry.kind === 'project').length;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot TerraLabs (C38)', () => {
  describe('the printed card', () => {
    it('prints ONE science starting tag, a setup cost and a before-action-phase box', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C38_TERRALABS);
      expect(info.original).eq(CardName.TERRALABS_RESEARCH);
      expect(info.cardNumber).eq('C38');
      // The corner box carries the tag; C16's identical-looking science icon
      // sits in a DRAFT PRIORITY plate instead, and this card prints none.
      expect(info.startingTags).deep.eq([Tag.SCIENCE]);
      expect(info.draftPriority, 'no priority plate is printed').is.undefined;
      expect(info.resource, 'nothing is stored on the card').is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards, 'it owns no bonus card').is.empty;
      expect(info.requiresModules).is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'beforeActionPhase']);
    });

    it('is registered and answers only to its own hooks', () => {
      const corp = AutomaCorporations.corpFor(MarsBotCorpId.C38_TERRALABS);
      expect(corp).eq(MarsBotTerraLabs);
      expect(corp.setup, 'the SETUP box').is.a('function');
      expect(corp.beforeActionPhase, 'the per-generation box').is.a('function');
      expect(corp.onWouldRaiseParameter, 'it replaces nothing').is.undefined;
      expect(corp.onTilePlaced, 'and watches nothing').is.undefined;
      expect(corp.resolveBonusCard).is.undefined;
    });
  });

  describe('the SETUP box — «MarsBot loses 8 TR»', () => {
    it('takes exactly 8 TR off the bot — and off nobody else', () => {
      const [game, human, bot] = terraLabsGame('-c38-tr');
      // The same game with a corporation that charges nothing is the baseline:
      // the difference between the two bots IS the printed price.
      const [, plainHuman, plainBot] = terraLabsGame('-c38-tr-other', MarsBotCorpId.C01_CREDICOR);

      expect(plainBot.terraformRating - bot.terraformRating, 'the printed price').eq(TR_LOSS);
      expect(stat(game, 'terralabsTrLost')).eq(TR_LOSS);
      expect(human.terraformRating, 'the human is untouched').eq(plainHuman.terraformRating);
    });

    it('another corporation pays nothing', () => {
      const [game] = terraLabsGame('-c38-tr-none', MarsBotCorpId.C01_CREDICOR);
      expect(game.automa!.corpStats['terralabsTrLost']).is.undefined;
    });
  });

  describe('the BEFORE ACTION PHASE box', () => {
    it('the first action phase already dealt its card — the box runs after setup too', () => {
      const [game] = terraLabsGame('-c38-first');
      expect(stat(game, 'terralabsCards'), 'generation 1 got its card').eq(1);
      expect(stat(game, 'terralabsLateCards'), 'and it was not the doubled rate').eq(0);
    });

    it('generations 1–8: ONE project card, taken from the project deck', () => {
      const [game] = terraLabsGame('-c38-early');
      const size = deckSize(game);
      const projects = projectEntries(game);
      const deckBefore = game.projectDeck.drawPile.length;
      const cards = stat(game, 'terralabsCards');

      runBox(game);

      expect(deckSize(game), 'the action deck grew by one').eq(size + 1);
      expect(projectEntries(game), 'and the newcomer is a PROJECT card').eq(projects + 1);
      expect(game.projectDeck.drawPile.length, 'it came off the project deck').eq(deckBefore - 1);
      expect(stat(game, 'terralabsCards')).eq(cards + 1);
      expect(stat(game, 'terralabsLateCards')).eq(0);
    });

    it('generation 9 and later: TWO project cards', () => {
      const [game] = terraLabsGame('-c38-late');
      game.generation = LATE_GENERATION;
      const size = deckSize(game);
      const cards = stat(game, 'terralabsCards');

      runBox(game);

      expect(deckSize(game)).eq(size + 2);
      expect(stat(game, 'terralabsCards')).eq(cards + 2);
      expect(stat(game, 'terralabsLateCards'), 'counted as the doubled rate').eq(2);
    });

    it('generation 8 is still the single rate — the boundary is printed, not guessed', () => {
      const [game] = terraLabsGame('-c38-boundary');
      game.generation = LATE_GENERATION - 1;
      const size = deckSize(game);

      runBox(game);

      expect(deckSize(game)).eq(size + 1);
      expect(stat(game, 'terralabsLateCards')).eq(0);
    });

    it('the card joins at a shuffled position, not on top', () => {
      // Ten insertions into a deck of several cards: a rule that always
      // appended (or always prepended) could not produce interior positions.
      const [game] = terraLabsGame('-c38-shuffled');
      const positions = new Set<number>();
      for (let i = 0; i < 10; i++) {
        const before = game.automa!.actionDeck.map((entry) => entry.kind === 'project' ? entry.name : undefined);
        runBox(game);
        const after = game.automa!.actionDeck.map((entry) => entry.kind === 'project' ? entry.name : undefined);
        const at = after.findIndex((name, index) => name !== before[index]);
        positions.add(at === -1 ? after.length - 1 : at);
      }
      expect(positions.size, `saw insertion positions ${[...positions].join(', ')}`).is.greaterThan(1);
    });

    it('an exhausted project deck costs nothing but the card', () => {
      const [game] = terraLabsGame('-c38-empty-deck');
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      const size = deckSize(game);
      const cards = stat(game, 'terralabsCards');

      runBox(game);

      expect(deckSize(game), 'nothing was invented').eq(size);
      expect(stat(game, 'terralabsCards')).eq(cards);
    });

    it('another corporation deals itself nothing', () => {
      const [game] = terraLabsGame('-c38-none', MarsBotCorpId.C01_CREDICOR);
      const size = deckSize(game);

      runBox(game, MarsBotCorpId.C01_CREDICOR);

      expect(deckSize(game)).eq(size);
      expect(game.automa!.corpStats['terralabsCards']).is.undefined;
    });
  });

  describe('state', () => {
    it('the thicker deck and the counters survive a save/load round trip', () => {
      const [game] = terraLabsGame('-c38-serialize');
      runBox(game);
      const size = deckSize(game);
      const cards = stat(game, 'terralabsCards');

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C38_TERRALABS);
      expect(restored.automa!.actionDeck.length).eq(size);
      expect(restored.automa!.corpStats['terralabsCards']).eq(cards);
      expect(restored.automa!.corpStats['terralabsTrLost']).eq(TR_LOSS);
    });
  });
});
