import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {BonusCardId, MARS_BOT_CORP_IDS, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {corporationCardsFromJSON} from '../../src/server/createCard';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

/** Answer SelectInitialCards through the REAL process path (corp + no cards). */
function answerInitialCards(game: IGame, human: TestPlayer, corporation: CardName) {
  human.dealtCorporationCards.splice(0, human.dealtCorporationCards.length,
    ...corporationCardsFromJSON([corporation]));
  human.dealtProjectCards.splice(0, human.dealtProjectCards.length);
  human.process({type: 'initialCards', responses: [
    {type: 'card', cards: [corporation]},
    {type: 'card', cards: []},
  ]});
  runAllActions(game);
}

/** The explicit corporationPlay press (issued once EVERY human has picked). */
function playCorporation(game: IGame, human: TestPlayer, corporation: CardName) {
  human.process({type: 'card', cards: [corporation]});
  runAllActions(game);
}

/** The full solo start: pick + play in one go. */
function pickCorporation(game: IGame, human: TestPlayer, corporation: CardName) {
  answerInitialCards(game, human, corporation);
  playCorporation(game, human, corporation);
}

describe('AutomaCorporations — the MarsBot corporation framework', () => {
  describe('original-corporation mapping (identity, art/lore, collision key)', () => {
    it('Credicor → CrediCor, Ecoline → EcoLine, Spire → Spire (canonical CardNames)', () => {
      expect(marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR).original).eq(CardName.CREDICOR);
      expect(marsBotCorpInfo(MarsBotCorpId.C02_ECOLINE).original).eq(CardName.ECOLINE);
      expect(marsBotCorpInfo(MarsBotCorpId.C45_SPIRE).original).eq(CardName.SPIRE);
    });

    it('bot corporations print their OWN tags — no human tags leak', () => {
      // Human EcoLine prints a plant tag, human Spire prints city+earth; the
      // MarsBot cards print none (C01/C02) and Earth only (C45).
      expect(marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR).startingTags).deep.eq([]);
      expect(marsBotCorpInfo(MarsBotCorpId.C02_ECOLINE).startingTags).deep.eq([]);
      expect(marsBotCorpInfo(MarsBotCorpId.C45_SPIRE).startingTags).deep.eq([Tag.EARTH]);
    });

    it('only Ecoline brings a corporation-specific bonus card (B23)', () => {
      expect(marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR).corpBonusCards).deep.eq([]);
      expect(marsBotCorpInfo(MarsBotCorpId.C02_ECOLINE).corpBonusCards).deep.eq([BonusCardId.B23_RAPID_SPROUTING]);
      expect(marsBotCorpInfo(MarsBotCorpId.C45_SPIRE).corpBonusCards).deep.eq([]);
    });
  });

  describe('eligibility (RB-B Setup 1 collision rule)', () => {
    it('a corporation held by a human is not eligible', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.isMarsBotCorporationEligible(info, new Set([CardName.CREDICOR]))).is.false;
      expect(AutomaCorporations.isMarsBotCorporationEligible(info, new Set([CardName.ECOLINE]))).is.true;
      expect(AutomaCorporations.isMarsBotCorporationEligible(info, new Set())).is.true;
    });

    it('Spire stays eligible in the current matrix (its human counterpart needs Prelude 2, which conflicts with the bot)', () => {
      const [game] = testAutomaGame({corporation: 'random'}, '-elig');
      expect(AutomaCorporations.eligibleCorpIds(game)).contains(MarsBotCorpId.C45_SPIRE);
    });
  });

  describe('selection at the generation-1 research → action gate', () => {
    it('a new game always receives a corporation once every human corporation is played', () => {
      const [game, human] = testAutomaGame({corporation: 'random'}, '-always');
      expect(game.automa!.corporation).is.undefined; // The human is not done yet.
      game.playerIsFinishedWithResearchPhase(human);
      expect(game.automa!.corporation).is.not.undefined;
      expect(MARS_BOT_CORP_IDS).contains(game.automa!.corporation);
    });

    it('the human\'s corporation is excluded — the real process path', () => {
      const [game, human] = testAutomaGame(
        {corporation: 'random', keepInitialCardSelection: true}, '-solo-coll');
      pickCorporation(game, human, CardName.CREDICOR);
      expect(game.automa!.corporation).is.not.undefined;
      expect(game.automa!.corporation).not.eq(MarsBotCorpId.C01_CREDICOR);
    });

    it('the dev/test override forces the corporation while eligible', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C45_SPIRE}, '-force');
      game.playerIsFinishedWithResearchPhase(human);
      expect(game.automa!.corporation).eq(MarsBotCorpId.C45_SPIRE);
    });

    it('an ineligible override falls back to the random selection', () => {
      const [game, human] = testAutomaGame(
        {corporation: MarsBotCorpId.C01_CREDICOR, keepInitialCardSelection: true}, '-force-coll');
      pickCorporation(game, human, CardName.CREDICOR); // The human takes CrediCor first.
      expect(game.automa!.corporation).is.not.undefined;
      expect(game.automa!.corporation).not.eq(MarsBotCorpId.C01_CREDICOR);
    });

    it('multiplayer collision: a corporation picked by ANY human is excluded', () => {
      const [game, humans] = testAutomaMultiplayerGame(2,
        {corporation: 'random', keepInitialCardSelection: true}, '-mp-coll');
      answerInitialCards(game, humans[0], CardName.CREDICOR);
      expect(game.automa!.corporation, 'selection waits for BOTH humans').is.undefined;
      answerInitialCards(game, humans[1], CardName.ECOLINE);
      // Every human picked → both receive the corporationPlay press.
      playCorporation(game, humans[0], CardName.CREDICOR);
      expect(game.automa!.corporation, 'selection waits until every corporation is PLAYED').is.undefined;
      playCorporation(game, humans[1], CardName.ECOLINE);
      // Credicor and Ecoline are taken by humans — only Spire is left.
      expect(game.automa!.corporation).eq(MarsBotCorpId.C45_SPIRE);
    });

    it('an empty eligible pool is an invariant error, never a corpless bot', () => {
      const [game, human] = testAutomaGame({corporation: 'random'}, '-empty');
      const originalEligible = AutomaCorporations.eligibleCorpIds;
      AutomaCorporations.eligibleCorpIds = () => [];
      try {
        expect(() => game.playerIsFinishedWithResearchPhase(human)).to.throw(/corporation pool is empty/);
      } finally {
        AutomaCorporations.eligibleCorpIds = originalEligible;
      }
    });

    it('a legacy corpless save past generation 1 never receives a corporation mid-game', () => {
      const [game, human] = testAutomaGame({corporation: 'random'}, '-legacy');
      game.playerIsFinishedWithResearchPhase(human);
      expect(game.automa!.corporation).is.not.undefined;
      // Rebuild the legacy shape: corpless, generation 2.
      const serialized = structuredClone(game.serialize());
      delete serialized.automa!.corporation;
      delete serialized.automa!.corpResources;
      delete serialized.automa!.corpStats;
      delete serialized.automa!.corpBapGeneration;
      serialized.generation = 2;
      const legacy = Game.deserialize(serialized);
      expect(legacy.automa!.corporation).is.undefined;
      const legacyHuman = legacy.players.find((p) => !p.isMarsBot)!;
      legacy.gotoResearchPhase();
      legacy.playerIsFinishedWithResearchPhase(legacyHuman);
      expect(legacy.automa!.corporation, 'still corpless — by design').is.undefined;
    });
  });

  describe('starting tags (RB-B Setup 4: resolved like a revealed card)', () => {
    it('Spire\'s Earth starting tag advances the Earth track — landing on cell 1 places a city', () => {
      const [game, human, bot] = testAutomaGame({corporation: MarsBotCorpId.C45_SPIRE}, '-tags');
      const cities = () => game.board.spaces.filter((s) => s.tile?.tileType === TileType.CITY && s.player?.id === bot.id).length;
      expect(cities()).eq(0);
      game.playerIsFinishedWithResearchPhase(human);
      // Earth track 0 → 1; Tharsis Earth[1] prints 'city' — the action fires
      // during setup, exactly like a revealed card's tag (RB-B Setup 4).
      expect(game.automa!.board.tracks[THARSIS_TRACK.EARTH].position).eq(1);
      expect(cities()).eq(1);
    });

    it('Credicor and Ecoline have no starting tags — no track moves at setup', () => {
      for (const [id, suffix] of [[MarsBotCorpId.C01_CREDICOR, '-nt1'], [MarsBotCorpId.C02_ECOLINE, '-nt2']] as const) {
        const [game, human] = testAutomaGame({corporation: id}, suffix);
        game.playerIsFinishedWithResearchPhase(human);
        expect(game.automa!.board.tracks.every((t) => t.position === 0)).is.true;
      }
    });
  });

  describe('serialization', () => {
    it('corporation identity, resources, stats and the BAP guard survive a round-trip', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C45_SPIRE}, '-ser');
      game.playerIsFinishedWithResearchPhase(human);
      game.automa!.corpResources = 7;
      game.automa!.corpStats['scienceAdded'] = 7;
      const restored = Game.deserialize(structuredClone(game.serialize()));
      expect(restored.automa!.corporation).eq(MarsBotCorpId.C45_SPIRE);
      expect(restored.automa!.corpResources).eq(7);
      expect(restored.automa!.corpStats['scienceAdded']).eq(7);
      expect(restored.automa!.corpBapGeneration).eq(1);
    });

    it('an old save without corporation fields deserializes corpless', () => {
      const [game] = testAutomaGame({}, '-old');
      const serialized = structuredClone(game.serialize());
      delete serialized.automa!.corporation;
      delete serialized.automa!.corpResources;
      delete serialized.automa!.corpStats;
      delete serialized.automa!.corpBapGeneration;
      const restored = Game.deserialize(serialized);
      expect(restored.automa!.corporation).is.undefined;
      expect(restored.automa!.corpResources).eq(0);
      expect(restored.automa!.corpStats).deep.eq({});
    });
  });
});
