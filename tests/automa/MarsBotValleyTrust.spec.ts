import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/**
 * A live Valley Trust game. PRELUDE IS PART OF THE FIXTURE — the printed card
 * says «use this corporation only when playing with Prelude», so a game
 * without it can never seat C16 (the dev-force falls back to random).
 */
function valleyGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C16_VALLEY_TRUST): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation, preludeExtension: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park the science track one space below `position` so the next advance lands on it. */
function armCube(game: IGame, position: number) {
  game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].position = position - 1;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function projectCount(game: IGame): number {
  return game.automa!.actionDeck.filter((e) => e.kind === 'project').length;
}

describe('MarsBot Valley Trust (C16)', () => {
  describe('the printed card', () => {
    it('prints no starting tag, a Science priority and two science cubes', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C16_VALLEY_TRUST);
      expect(info.original).eq(CardName.VALLEY_TRUST);
      expect(info.cardNumber).eq('C16');
      expect(info.startingTags, 'the science symbol on the card is the DRAFT PRIORITY').is.empty;
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.SCIENCE]});
      expect(info.requiresModules).deep.eq(['prelude']);
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      const cubes = info.trackCubes ?? [];
      expect(cubes.every((c) => c.tag === Tag.SCIENCE && c.cubeType === 'white')).is.true;
      expect(cubes.map((c) => c.position)).deep.eq([8, 16]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });
  });

  describe('«Use this corporation only when playing with Prelude»', () => {
    it('is out of the selection pool without Prelude, and in it with', () => {
      const [without] = testAutomaGame({corporation: MarsBotCorpId.C01_CREDICOR}, '-vt-pool-no');
      expect(AutomaCorporations.eligibleCorpIds(without)).not.contains(MarsBotCorpId.C16_VALLEY_TRUST);

      const [with_] = testAutomaGame({corporation: MarsBotCorpId.C01_CREDICOR, preludeExtension: true}, '-vt-pool-yes');
      expect(AutomaCorporations.eligibleCorpIds(with_)).contains(MarsBotCorpId.C16_VALLEY_TRUST);
    });

    it('the module condition is a pure predicate over the enabled expansions', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C16_VALLEY_TRUST);
      expect(AutomaCorporations.hasRequiredModules(info, {prelude: true})).is.true;
      expect(AutomaCorporations.hasRequiredModules(info, {prelude: false})).is.false;
      expect(AutomaCorporations.hasRequiredModules(info, {})).is.false;
      // A corporation printing no condition is always satisfied.
      expect(AutomaCorporations.hasRequiredModules(marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR), {})).is.true;
    });

    it('even a dev-force cannot seat it in a game without Prelude', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C16_VALLEY_TRUST}, '-vt-force');
      game.playerIsFinishedWithResearchPhase(human);
      expect(game.automa!.corporation, 'the request was ignored — another corporation was seated')
        .is.not.eq(MarsBotCorpId.C16_VALLEY_TRUST);
      expect(game.automa!.corporation).is.not.undefined;
    });
  });

  describe('the SETUP box', () => {
    it('adds exactly one extra project card to the starting deck', () => {
      const [valley] = valleyGame('-vt-extra');
      // C01 has no setup box at all: the same Prelude game, one card fewer.
      const [credicor] = valleyGame('-vt-extra-base', MarsBotCorpId.C01_CREDICOR);
      expect(projectCount(valley) - projectCount(credicor)).eq(1);
      expect(stat(valley, 'valleyExtraStartCards')).eq(1);
    });

    it('the extra card is a real project entry, shuffled INTO the deck', () => {
      const [game] = valleyGame('-vt-shuffled');
      const deck = game.automa!.actionDeck;
      expect(deck.every((e) => e.kind !== 'project' || typeof e.name === 'string')).is.true;
      // Prelude deals 3 + 3 projects, +1 here, plus the one bonus card.
      expect(projectCount(game)).eq(7);
      expect(deck.filter((e) => e.kind === 'bonus')).has.length(1);
    });

    it('seeds the two science cubes and nothing anywhere else', () => {
      const [game] = valleyGame('-vt-cubes');
      const cubes = AutomaCorporations.cubesOf(game);
      expect(cubes).has.length(2);
      expect(cubes.every((c) => c.trackIndex === THARSIS_TRACK.SCIENCE && c.cubeType === 'white')).is.true;
      expect(cubes.map((c) => c.position).sort((a, b) => a - b)).deep.eq([8, 16]);
    });

    it('another corporation seeds none and gets no extra card', () => {
      const [game] = valleyGame('-vt-other', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.cubesOf(game)).is.empty;
      expect(game.automa!.corpStats['valleyExtraStartCards']).is.undefined;
    });
  });

  describe('the EFFECT — a white cube flips a project', () => {
    it('draws and resolves a card from the project deck', () => {
      const [game] = valleyGame('-vt-draw');
      const played = game.automa!.playedPile.length;
      armCube(game, 16); // Science #16 prints nothing else.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);

      expect(game.automa!.playedPile.length, 'the flipped card was PLAYED').eq(played + 1);
      expect(stat(game, 'valleyCubesHit')).eq(1);
      expect(stat(game, 'valleyCardsDrawn')).eq(1);
    });

    it('the space\'s own printed icon still resolves — no «instead of»', () => {
      const [game, , bot] = valleyGame('-vt-addition');
      const tr = bot.terraformRating;
      armCube(game, 8); // Science #8 prints tr2 AND carries a cube.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);

      expect(bot.terraformRating, 'the printed TR still landed').is.at.least(tr + 2);
      expect(stat(game, 'valleyCubesHit')).eq(1);
    });

    it('a bare science space between the cubes does nothing', () => {
      const [game] = valleyGame('-vt-bare');
      armCube(game, 17); // Science #17 carries no cube.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);

      expect(stat(game, 'valleyCubesHit')).eq(0);
    });

    it('a spent cube never fires again, not even after a regression', () => {
      const [game] = valleyGame('-vt-once');
      armCube(game, 16);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);
      expect(stat(game, 'valleyCubesHit')).eq(1);

      game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].regress();
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);

      expect(stat(game, 'valleyCubesHit'), 'RB-B: a triggered cube never re-arms').eq(1);
    });

    it('an exhausted project deck is not a crash — the cube simply pays nothing', () => {
      const [game] = valleyGame('-vt-empty');
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      armCube(game, 16);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);

      expect(stat(game, 'valleyCubesHit')).eq(1);
      expect(stat(game, 'valleyCardsDrawn'), 'nothing was drawn').eq(0);
    });

    it('another corporation on the science track flips nothing', () => {
      const [game] = valleyGame('-vt-othercorp', MarsBotCorpId.C01_CREDICOR);
      const played = game.automa!.playedPile.length;
      armCube(game, 16);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);
      expect(game.automa!.playedPile.length).eq(played);
      expect(game.automa!.corpStats['valleyCubesHit']).is.undefined;
    });
  });

  describe('state', () => {
    it('the spent cube and the counters survive a save/load round trip', () => {
      const [game] = valleyGame('-vt-serialize');
      armCube(game, 16);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C16_VALLEY_TRUST);
      expect(restored.automa!.corpStats['valleyCardsDrawn']).eq(1);
      expect(restored.automa!.corpStats['valleyExtraStartCards']).eq(1);
      expect(AutomaCorporations.cubeModels(restored).filter((c) => c.spent)).has.length(1);
    });
  });
});
