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

/** The printed cube ladder. */
const CUBES = [3, 6, 9, 12, 15, 18];

/** A live Recyclon game with the corporation seated. */
function recyclonGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C23_RECYCLON): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park the building track one space below `position` so the next advance lands on it. */
function armCube(game: IGame, position: number) {
  game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = position - 1;
}

function at(game: IGame, index: number): number {
  return game.automa!.board.tracks[index].position;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Recyclon (C23)', () => {
  describe('the printed card', () => {
    it('prints a microbe starting tag, a Building priority and six white cubes', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C23_RECYCLON);
      expect(info.original).eq(CardName.RECYCLON);
      expect(info.cardNumber).eq('C23');
      expect(info.startingTags, 'the microbe symbol is a STARTING TAG, the building one is the priority')
        .deep.eq([Tag.MICROBE]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.BUILDING]});
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      const cubes = info.trackCubes ?? [];
      expect(cubes.every((c) => c.tag === Tag.BUILDING), 'every cube sits on the BUILDING track').is.true;
      expect(cubes.every((c) => c.cubeType === 'white'), 'this card prints ONE colour').is.true;
      expect(cubes.map((c) => c.position)).deep.eq(CUBES);
      expect(info.cubeLegend?.black, 'no black cube exists, so no legend for one').is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });

    it('its last cube sits on the last space of the track', () => {
      const [game] = recyclonGame('-rc-last');
      const track = game.automa!.board.tracks[THARSIS_TRACK.BUILDING];
      expect(Math.max(...CUBES)).eq(track.maxPosition);
    });
  });

  describe('the SETUP box', () => {
    it('seeds six cubes on the building track and nothing anywhere else', () => {
      const [game] = recyclonGame('-rc-setup');
      const cubes = AutomaCorporations.cubesOf(game);
      expect(cubes).has.length(CUBES.length);
      expect(cubes.every((c) => c.trackIndex === THARSIS_TRACK.BUILDING)).is.true;
      expect(cubes.map((c) => c.position).sort((a, b) => a - b)).deep.eq(CUBES);
    });

    it('another corporation seeds none', () => {
      const [game] = recyclonGame('-rc-other', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.cubesOf(game)).is.empty;
    });
  });

  describe('the EFFECT — a building cube pushes the PLANT track', () => {
    it('reaching a cube advances the plant track one step', () => {
      const [game] = recyclonGame('-rc-push');
      const before = at(game, THARSIS_TRACK.BIO);
      armCube(game, 3); // Building #3 prints nothing of its own.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(at(game, THARSIS_TRACK.BUILDING)).eq(3);
      expect(at(game, THARSIS_TRACK.BIO), 'the plant track moved').eq(before + 1);
      expect(stat(game, 'recyclonCubesHit')).eq(1);
      expect(stat(game, 'recyclonSteps')).eq(1);
    });

    it('the building space\'s own printed icon still resolves — no «instead of»', () => {
      const [game, , bot] = recyclonGame('-rc-alsoicon');
      const oceans = game.board.getOceanSpaces().length;
      armCube(game, 12); // Building #12 prints an OCEAN.
      const tr = bot.terraformRating;

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(game.board.getOceanSpaces().length, 'the printed ocean was placed too').eq(oceans + 1);
      expect(bot.terraformRating).eq(tr + 1);
      expect(stat(game, 'recyclonCubesHit')).eq(1);
    });

    it('a bare building space between the cubes does nothing', () => {
      const [game] = recyclonGame('-rc-bare');
      const before = at(game, THARSIS_TRACK.BIO);
      armCube(game, 4); // #4 carries no cube and prints nothing.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(at(game, THARSIS_TRACK.BIO)).eq(before);
      expect(stat(game, 'recyclonCubesHit')).eq(0);
    });

    it('the cubes never sit on the track they push — this card cannot accelerate itself', () => {
      const [game] = recyclonGame('-rc-oneway');
      // Park the PLANT track so its next space also carries a printed
      // 'advance' (plant #7): the push therefore cascades on the plant side,
      // which is exactly the state in which a self-feeding card would loop.
      game.automa!.board.tracks[THARSIS_TRACK.BIO].position = 6;
      armCube(game, 3);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(at(game, THARSIS_TRACK.BUILDING), 'the building track took exactly its own one step').eq(3);
      expect(stat(game, 'recyclonCubesHit'), 'and exactly ONE cube was reached').eq(1);
      expect(at(game, THARSIS_TRACK.BIO), 'while the plant side cascaded on its own').is.at.least(8);
    });

    it('a spent cube never fires again, not even after a regression', () => {
      const [game] = recyclonGame('-rc-spent');
      armCube(game, 6);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      const after = at(game, THARSIS_TRACK.BIO);
      const hits = stat(game, 'recyclonCubesHit');

      game.automa!.board.tracks[THARSIS_TRACK.BUILDING].regress();
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(stat(game, 'recyclonCubesHit'), 'the cube is spent for the game').eq(hits);
      expect(at(game, THARSIS_TRACK.BIO)).eq(after);
    });

    it('a MAXED plant track pushes nothing but still spends the cube', () => {
      const [game] = recyclonGame('-rc-maxed');
      const bio = game.automa!.board.tracks[THARSIS_TRACK.BIO];
      bio.position = bio.maxPosition;
      armCube(game, 3);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(at(game, THARSIS_TRACK.BIO)).eq(bio.maxPosition);
      expect(stat(game, 'recyclonCubesHit'), 'the cube was reached — the track simply had nowhere to go').eq(1);
    });

    it('another corporation on the building track pushes nothing', () => {
      const [game] = recyclonGame('-rc-othercorp', MarsBotCorpId.C01_CREDICOR);
      const before = at(game, THARSIS_TRACK.BIO);
      armCube(game, 3);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(at(game, THARSIS_TRACK.BIO)).eq(before);
      expect(game.automa!.corpStats['recyclonCubesHit']).is.undefined;
    });
  });

  describe('the shared cube push', () => {
    it('C14 and C19 keep their own printed wording — one rule per card, never one voice', () => {
      const recyclon = marsBotCorpInfo(MarsBotCorpId.C23_RECYCLON);
      const luna = marsBotCorpInfo(MarsBotCorpId.C14_POINT_LUNA);
      const effectOf = (info: typeof luna) =>
        info.sections.find((s) => s.kind === 'effect')!.lines.map((l) => l.text);
      // Recyclon prints a DIFFERENT sentence, so it must not borrow theirs.
      expect(effectOf(recyclon)).is.not.deep.eq(effectOf(luna));
      expect(recyclon.cubeLegend?.white).is.not.eq(luna.cubeLegend?.white);
    });
  });

  describe('state', () => {
    it('the spent cube and the counters survive a save/load round trip', () => {
      const [game] = recyclonGame('-rc-serialize');
      armCube(game, 9);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      const bio = at(game, THARSIS_TRACK.BIO);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C23_RECYCLON);
      expect(restored.automa!.corpStats['recyclonCubesHit']).eq(1);
      expect(restored.automa!.corpStats['recyclonSteps']).eq(1);
      expect(restored.automa!.board.tracks[THARSIS_TRACK.BIO].position).eq(bio);
      expect(AutomaCorporations.cubeModels(restored).filter((c) => c.spent).map((c) => c.position))
        .deep.eq([9]);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = recyclonGame('-rc-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C23_RECYCLON);
    });
  });
});
