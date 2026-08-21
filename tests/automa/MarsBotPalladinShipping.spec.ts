import {expect} from 'chai';
import * as constants from '../../src/common/constants';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {MarsBotPalladinShipping} from '../../src/server/automa/corps/MarsBotPalladinShipping';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const PALLADIN = MarsBotCorpId.C43_PALLADIN_SHIPPING;
/** The six spaces each colour sits on — the SAME numbers on both tracks. */
const CUBE_SPACES = [3, 4, 6, 8, 10, 11];

/** A live Palladin game with the corporation seated (setup already run). */
function palladinGame(suffix: string, corporation: MarsBotCorpId = PALLADIN): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/**
 * Cube spaces that print NOTHING of their own — the SPACE track's #4 and #10,
 * the EVENT track's #11. Every claim about what the CUBE did is measured on
 * one of these, because the mat's own icons are loud: the space track's #3
 * raises the temperature by itself, and reading that as the corporation's work
 * is exactly the mistake a fixture has to rule out.
 */
const QUIET_WHITE = [4, 10];
const QUIET_BLACK = 11;

/** Park a track one space below `position` so the next advance lands on it. */
function armCube(game: IGame, trackIndex: number, position: number) {
  game.automa!.board.tracks[trackIndex].position = position - 1;
}

/** Walk the bot onto the cube at `position` of `trackIndex`. */
function reachCube(game: IGame, trackIndex: number, position: number) {
  armCube(game, trackIndex, position);
  AutomaResolver.advanceTrack(game, trackIndex);
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

/** What is physically on the corporation card: how many, and of which colour. */
function onCard(game: IGame): {count: number, kind: string | undefined} {
  return {count: game.automa!.corpResources, kind: game.automa!.corpResourceKind};
}

describe('MarsBot Palladin Shipping (C43)', () => {
  describe('the printed card', () => {
    it('prints TWO starting tags, a two-tag priority and twelve cubes on those two tracks', () => {
      const info = marsBotCorpInfo(PALLADIN);
      expect(info.original).eq(CardName.PALLADIN_SHIPPING);
      expect(info.cardNumber).eq('C43');
      // The corner box carries the tags AND the plate carries the priority —
      // the C11/C41 shape, verified by crop.
      expect(info.startingTags).deep.eq([Tag.SPACE, Tag.EVENT]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.SPACE, Tag.EVENT]});
      expect(info.corpBonusCards).is.empty;
      const cubes = info.trackCubes ?? [];
      expect(cubes.filter((c) => c.cubeType === 'white').map((c) => c.position)).deep.eq(CUBE_SPACES);
      expect(cubes.filter((c) => c.cubeType === 'black').map((c) => c.position)).deep.eq(CUBE_SPACES);
      expect(cubes.filter((c) => c.cubeType === 'white').every((c) => c.tag === Tag.SPACE),
        'white rides the SPACE track').is.true;
      expect(cubes.filter((c) => c.cubeType === 'black').every((c) => c.tag === Tag.EVENT),
        'black rides the EVENT track').is.true;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });

    it('declares ONE slot that takes either colour — never two stores', () => {
      const info = marsBotCorpInfo(PALLADIN);
      expect(info.resource).eq('cube-white');
      expect(info.resourceAlt).eq('cube-black');
      // Nobody else declares a second kind — the field exists for this card.
      const others = Object.values(MarsBotCorpId)
        .filter((id) => id !== PALLADIN)
        .filter((id) => marsBotCorpInfo(id).resourceAlt !== undefined);
      expect(others, 'the second kind is C43-only today').is.empty;
    });

    it('gives BOTH colours the same legend, so the mat draws one row with both swatches', () => {
      // The C30 law: what a cube does on arrival does not depend on its colour,
      // and two identical rows would assert a difference the card never prints.
      const info = marsBotCorpInfo(PALLADIN);
      expect(info.cubeLegend?.white).is.a('string');
      expect(info.cubeLegend?.white).eq(info.cubeLegend?.black);
    });

    it('shares C41\'s printed white-cube setup sentence — only the numbers differ', () => {
      const setupLines = (id: MarsBotCorpId) => marsBotCorpInfo(id).sections
        .find((s) => s.kind === 'setup')!.lines;
      const white = (id: MarsBotCorpId) => setupLines(id).find((l) => l.icon === 'cube-white')!.text;
      expect(white(PALLADIN)).eq(white(MarsBotCorpId.C41_KUIPER_COOPERATIVE));
    });

    it('is registered and answers only to its setup and its cube hook', () => {
      const corp = AutomaCorporations.corpFor(PALLADIN);
      expect(corp).eq(MarsBotPalladinShipping);
      expect(corp.setup, 'the SETUP box pays 5 M€').is.a('function');
      expect(corp.onTrackCubeTrigger, 'the EFFECT box').is.a('function');
      expect(corp.beforeActionPhase, 'no before-action-phase box is printed').is.undefined;
      expect(corp.onTrackAdvance, 'the trigger is a CUBE, never every advance').is.undefined;
      expect(corp.resolveBonusCard).is.undefined;
    });

    it('no human Palladin rule leaks — no 36 M€, no titanium, no action', () => {
      const info = marsBotCorpInfo(PALLADIN);
      const printed = info.sections.flatMap((s) => s.lines).map((l) => l.text).join(' ');
      expect(printed).does.not.match(/36|titanium/i);
      expect(info.mcBank).is.undefined;
    });
  });

  describe('the SETUP box', () => {
    it('pays the bot 5 M€', () => {
      const [game, , bot] = palladinGame('-c43-setup');
      const [, , plainBot] = palladinGame('-c43-setup-base', MarsBotCorpId.C01_CREDICOR);
      expect(bot.megaCredits - plainBot.megaCredits).eq(5);
      expect(onCard(game), 'and puts nothing on the card').deep.eq({count: 0, kind: undefined});
    });

    it('the cubes are DATA — only the SPENT set is state', () => {
      const [game] = palladinGame('-c43-seed');
      expect(marsBotCorpInfo(game.automa!.corporation!).trackCubes ?? []).has.length(12);
      expect(game.automa!.corpCubesTriggered, 'nothing has fired yet').is.empty;
    });
  });

  describe('the EFFECT — a cube MOVES onto the card', () => {
    it('a white cube waits there for a black one', () => {
      const [game] = palladinGame('-c43-white');
      const temperature = game.getTemperature();

      reachCube(game, THARSIS_TRACK.SPACE, QUIET_WHITE[0]);

      expect(onCard(game)).deep.eq({count: 1, kind: 'cube-white'});
      expect(game.getTemperature(), 'one half warms nothing').eq(temperature);
      expect(stat(game, 'palladinCubesMoved')).eq(1);
      expect(stat(game, 'palladinPairs')).eq(0);
    });

    it('a black cube waits the same way', () => {
      const [game] = palladinGame('-c43-black');

      reachCube(game, THARSIS_TRACK.EVENT, QUIET_BLACK);

      expect(onCard(game)).deep.eq({count: 1, kind: 'cube-black'});
      expect(stat(game, 'palladinCubesMoved')).eq(1);
    });

    it('cubes of ONE colour simply pile up — a run of space cards warms nothing', () => {
      const [game] = palladinGame('-c43-pile');
      const temperature = game.getTemperature();

      for (const position of [...QUIET_WHITE, 11]) {
        reachCube(game, THARSIS_TRACK.SPACE, position);
      }

      expect(onCard(game)).deep.eq({count: 3, kind: 'cube-white'});
      expect(game.getTemperature()).eq(temperature);
      expect(stat(game, 'palladinCubesMoved')).eq(3);
      expect(stat(game, 'palladinPairs')).eq(0);
    });
  });

  describe('the EFFECT — one of each colour raises the temperature', () => {
    it('the arriving cube never rests: the pair leaves and Mars warms', () => {
      const [game] = palladinGame('-c43-pair');
      reachCube(game, THARSIS_TRACK.SPACE, QUIET_WHITE[0]);
      const temperature = game.getTemperature();

      reachCube(game, THARSIS_TRACK.EVENT, QUIET_BLACK);

      expect(onCard(game), 'both cubes went back to the box').deep.eq({count: 0, kind: undefined});
      expect(game.getTemperature(), 'the shared raise moved it 2 °C').eq(temperature + 2);
      expect(stat(game, 'palladinCubesMoved'), 'the pairing cube MOVED too').eq(2);
      expect(stat(game, 'palladinPairs')).eq(1);
      expect(stat(game, 'palladinTemperatureSteps')).eq(1);
    });

    it('it works from the other side too — black first, then white', () => {
      const [game] = palladinGame('-c43-pair-reverse');
      reachCube(game, THARSIS_TRACK.EVENT, QUIET_BLACK);
      const temperature = game.getTemperature();

      reachCube(game, THARSIS_TRACK.SPACE, QUIET_WHITE[0]);

      expect(onCard(game)).deep.eq({count: 0, kind: undefined});
      expect(game.getTemperature()).is.greaterThan(temperature);
      expect(stat(game, 'palladinPairs')).eq(1);
    });

    it('only ONE pair leaves per arrival — a stack of whites keeps the rest', () => {
      const [game] = palladinGame('-c43-one-pair');
      for (const position of [...QUIET_WHITE, 11]) {
        reachCube(game, THARSIS_TRACK.SPACE, position);
      }

      reachCube(game, THARSIS_TRACK.EVENT, QUIET_BLACK);

      expect(onCard(game), 'one white left with the black one').deep.eq({count: 2, kind: 'cube-white'});
      expect(stat(game, 'palladinPairs')).eq(1);
    });

    it('the card NEVER holds both colours at once — the invariant, over a long walk', () => {
      const [game] = palladinGame('-c43-invariant');
      const walk: Array<[number, number]> = [
        [THARSIS_TRACK.SPACE, 3], [THARSIS_TRACK.SPACE, 4], [THARSIS_TRACK.EVENT, 3],
        [THARSIS_TRACK.EVENT, 4], [THARSIS_TRACK.EVENT, 6], [THARSIS_TRACK.SPACE, 6],
        [THARSIS_TRACK.SPACE, 8], [THARSIS_TRACK.EVENT, 8],
      ];
      for (const [track, position] of walk) {
        reachCube(game, track, position);
        const held = onCard(game);
        // A count of 0 has no colour, and a colour never coexists with its
        // opposite: the state cannot even express «two whites and a black».
        expect(held.count, 'never negative').is.at.least(0);
        expect(held.count === 0 ? held.kind === undefined : held.kind !== undefined,
          `count ${held.count} / kind ${held.kind}`).is.true;
      }
      // 8 cubes moved, 4 of them completed a pair (each pair spends 2).
      expect(stat(game, 'palladinCubesMoved')).eq(8);
      expect(stat(game, 'palladinPairs')).eq(4);
      expect(onCard(game).count).eq(8 - 4 * 2);
    });

    it('a completed temperature still spends the pair — and takes the shared Failed Action', () => {
      const [game, , bot] = palladinGame('-c43-maxed');
      (game as unknown as {temperature: number}).temperature = constants.MAX_TEMPERATURE;
      reachCube(game, THARSIS_TRACK.SPACE, QUIET_WHITE[0]);
      const mc = bot.megaCredits;

      reachCube(game, THARSIS_TRACK.EVENT, QUIET_BLACK);

      expect(onCard(game), 'the printed price is paid either way').deep.eq({count: 0, kind: undefined});
      expect(stat(game, 'palladinPairs')).eq(1);
      expect(stat(game, 'palladinTemperatureSteps'), 'but nothing moved').eq(0);
      expect(bot.megaCredits, 'the Failed Action compensation').is.at.least(mc + 5);
    });
  });

  describe('the EFFECT — its shared rules', () => {
    it('neither colour says «instead of», so the space keeps its printed icon', () => {
      // The SPACE track's #3 prints a TEMPERATURE raise and carries a white
      // cube — the one space that can show both happening.
      const [game] = palladinGame('-c43-and-not-instead');
      const layout = game.automa!.board.tracks[THARSIS_TRACK.SPACE].definition.layout;
      expect(layout[3], 'the fixture space really does print a raise').eq('temperature');
      const temperature = game.getTemperature();

      reachCube(game, THARSIS_TRACK.SPACE, 3);

      expect(stat(game, 'palladinCubesMoved'), 'the cube moved onto the card').eq(1);
      expect(onCard(game), 'and waits there, alone').deep.eq({count: 1, kind: 'cube-white'});
      expect(game.getTemperature(), 'while the SPACE raised the temperature on its own')
        .is.greaterThan(temperature);
      expect(stat(game, 'palladinPairs'), 'no pair was involved').eq(0);
    });

    it('a cube fires at most ONCE — a regressed track does not re-arm it', () => {
      const [game] = palladinGame('-c43-once');
      reachCube(game, THARSIS_TRACK.SPACE, QUIET_WHITE[0]);
      expect(stat(game, 'palladinCubesMoved')).eq(1);

      game.automa!.board.tracks[THARSIS_TRACK.SPACE].regress();
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SPACE);

      expect(stat(game, 'palladinCubesMoved'), 'the spent cube is gone for good').eq(1);
    });

    it('a space with no cube of this corporation does nothing extra', () => {
      const [game] = palladinGame('-c43-empty-space');

      reachCube(game, THARSIS_TRACK.SPACE, 5); // no cube on #5

      expect(stat(game, 'palladinCubesMoved')).eq(0);
      expect(onCard(game).count).eq(0);
    });

    it('another corporation has no cubes and no card slot at all', () => {
      const [game] = palladinGame('-c43-other', MarsBotCorpId.C01_CREDICOR);
      expect(marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR).trackCubes).is.undefined;

      reachCube(game, THARSIS_TRACK.SPACE, QUIET_WHITE[0]);

      expect(game.automa!.corpStats['palladinCubesMoved']).is.undefined;
      expect(game.automa!.corpResourceKind).is.undefined;
    });
  });

  describe('state', () => {
    it('the waiting cubes, their colour and the counters survive a save/load round trip', () => {
      const [game] = palladinGame('-c43-serialize');
      reachCube(game, THARSIS_TRACK.EVENT, 3);
      reachCube(game, THARSIS_TRACK.EVENT, QUIET_BLACK);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(PALLADIN);
      expect(restored.automa!.corpResources).eq(2);
      expect(restored.automa!.corpResourceKind).eq('cube-black');
      expect(restored.automa!.corpStats['palladinCubesMoved']).eq(2);
      expect(restored.automa!.corpCubesTriggered, 'the spent cubes stay spent').is.not.empty;
    });

    it('an OLD save without the colour field reads as an empty card, not a broken one', () => {
      const [game] = palladinGame('-c43-old-save');
      const serialized = structuredClone(game.serialize());
      delete (serialized.automa as {corpResourceKind?: unknown}).corpResourceKind;

      const restored = Game.deserialize(serialized);

      expect(restored.automa!.corpResourceKind).is.undefined;
      expect(restored.automa!.corpResources).eq(0);
    });
  });
});
