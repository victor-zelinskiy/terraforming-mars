import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {MarsBotEcotec} from '../../src/server/automa/corps/MarsBotEcotec';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const SETUP_PLANTS = 2;
const CONVERSION_PLANTS = 5;

/**
 * A live Ecotec game. ⚠️ TWO shared rules are already visible at the first
 * action phase: the framework runs the Setup box and THEN resolves the
 * starting tags (so the card holds 2 + 1 plants), and the Before-Action-Phase
 * box has already been offered once — so every counter is read as a DELTA.
 */
function ecotecGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C40_ECOTEC): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function runBox(game: IGame, corporation: MarsBotCorpId = MarsBotCorpId.C40_ECOTEC) {
  AutomaCorporations.corpFor(corporation).beforeActionPhase?.(game);
}

function plants(game: IGame): number {
  return game.automa!.corpResources;
}

function plantTrack(game: IGame): number {
  return game.automa!.board.tracks[THARSIS_TRACK.BIO].position;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Ecotec (C40)', () => {
  describe('the printed card', () => {
    it('prints a plant tag, a three-tag priority, a plant store and all three boxes', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C40_ECOTEC);
      expect(info.original).eq(CardName.ECOTEC);
      expect(info.cardNumber).eq('C40');
      expect(info.startingTags).deep.eq([Tag.PLANT]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]});
      expect(info.resource).eq('plant');
      expect(info.whiteMarkerTracks, 'the setup marker rides the plant track').deep.eq([Tag.PLANT]);
      expect(info.markerLegend, 'and it names what it reminds of').is.a('string');
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect', 'beforeActionPhase']);
    });

    it('shares C31 Arklight\'s printed marker sentence, but not its legend', () => {
      const ecotec = marsBotCorpInfo(MarsBotCorpId.C40_ECOTEC);
      const arklight = marsBotCorpInfo(MarsBotCorpId.C31_ARKLIGHT);
      const markerLine = (id: MarsBotCorpId) => marsBotCorpInfo(id).sections
        .flatMap((s) => s.lines).find((line) => line.icon === 'cube-white')?.text;
      expect(markerLine(MarsBotCorpId.C40_ECOTEC), 'ONE sentence, ONE i18n key')
        .eq(markerLine(MarsBotCorpId.C31_ARKLIGHT));
      expect(ecotec.markerLegend, 'what the cube reminds of is each card\'s own')
        .does.not.eq(arklight.markerLegend);
    });

    it('is registered and answers only to its own hooks', () => {
      const corp = AutomaCorporations.corpFor(MarsBotCorpId.C40_ECOTEC);
      expect(corp).eq(MarsBotEcotec);
      expect(corp.setup, 'the SETUP box').is.a('function');
      expect(corp.onTagResolved, 'the EFFECT box').is.a('function');
      expect(corp.onMicrobeAdvancement, 'the FAQ reading of the Venus microbe cell').is.a('function');
      expect(corp.beforeActionPhase, 'the conversion box').is.a('function');
      expect(corp.onTilePlaced, 'it watches no tile').is.undefined;
      expect(corp.resolveBonusCard, 'and owns no bonus card').is.undefined;
    });
  });

  describe('the SETUP box', () => {
    it('places 2 plants — and the starting tag makes it 3, because the box runs FIRST', () => {
      const [game] = ecotecGame('-c40-setup');
      // `selectCorporation` runs the Setup box and only then resolves the
      // starting tags, so «including the starting tag» is visible right here.
      expect(plants(game)).eq(SETUP_PLANTS + 1);
      expect(stat(game, 'ecotecPlantsAdded')).eq(SETUP_PLANTS + 1);
      expect(plantTrack(game), 'and that tag moved the plant track too').is.greaterThan(0);
    });

    it('another corporation stores nothing', () => {
      const [game] = ecotecGame('-c40-other', MarsBotCorpId.C01_CREDICOR);
      expect(plants(game)).eq(0);
      expect(game.automa!.corpStats['ecotecPlantsAdded']).is.undefined;
    });
  });

  describe('the EFFECT — every bio tag feeds the card', () => {
    for (const tag of [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]) {
      it(`a ${tag} tag puts one plant on the card`, () => {
        const [game] = ecotecGame(`-c40-tag-${tag}`);
        const before = plants(game);

        AutomaResolver.resolveTag(game, tag);

        expect(plants(game)).eq(before + 1);
      });
    }

    it('any other tag feeds nothing', () => {
      const [game] = ecotecGame('-c40-tag-other');
      const before = plants(game);

      AutomaResolver.resolveTag(game, Tag.SPACE);
      AutomaResolver.resolveTag(game, Tag.BUILDING);
      AutomaResolver.resolveTag(game, Tag.EARTH);

      expect(plants(game), 'the store did not grow').eq(before);
    });

    it('the Venus microbe cell counts as a microbe — the FAQ reading C24 already follows', () => {
      const [game] = ecotecGame('-c40-microbe-cell');
      const before = plants(game);

      AutomaCorporations.onMicrobeAdvancement(game);

      expect(plants(game)).eq(before + 1);
      expect(stat(game, 'ecotecMicrobeCells'), 'counted apart, so the finale can tell them apart').eq(1);
    });
  });

  describe('the BEFORE ACTION PHASE box', () => {
    it('under the threshold nothing is spent', () => {
      const [game] = ecotecGame('-c40-under');
      game.automa!.corpResources = CONVERSION_PLANTS - 1;
      const track = plantTrack(game);

      runBox(game);

      expect(plants(game), 'the store is untouched').eq(CONVERSION_PLANTS - 1);
      expect(plantTrack(game)).eq(track);
      expect(stat(game, 'ecotecSpends')).eq(0);
    });

    it('at the threshold it spends exactly 5 and advances the plant track', () => {
      const [game] = ecotecGame('-c40-at');
      game.automa!.corpResources = CONVERSION_PLANTS;
      const track = plantTrack(game);

      runBox(game);

      expect(plants(game)).eq(0);
      expect(plantTrack(game), 'one step, from the shared advance').is.greaterThan(track);
      expect(stat(game, 'ecotecSpends')).eq(1);
      expect(stat(game, 'ecotecSteps')).eq(1);
    });

    it('a full store spends 5 ONCE — the printed box is not a loop', () => {
      const [game] = ecotecGame('-c40-once');
      game.automa!.corpResources = 12;

      runBox(game);

      expect(plants(game), '12 − 5').eq(7);
      expect(stat(game, 'ecotecSpends')).eq(1);
    });

    it('a completed plant track turns the step into the official Failed Action', () => {
      const [game, , bot] = ecotecGame('-c40-maxed');
      const track = game.automa!.board.tracks[THARSIS_TRACK.BIO];
      track.position = track.maxPosition;
      game.automa!.corpResources = CONVERSION_PLANTS;
      const mc = bot.megaCredits;

      runBox(game);

      expect(plants(game), 'the plants were still spent — the printed box says «remove 5»').eq(0);
      expect(bot.megaCredits, 'the Failed Action compensation').is.at.least(mc + 5);
      expect(stat(game, 'ecotecSpends')).eq(1);
      expect(stat(game, 'ecotecSteps'), 'a Failed Action is not a step it landed').eq(0);
    });

    it('another corporation converts nothing', () => {
      const [game] = ecotecGame('-c40-convert-other', MarsBotCorpId.C01_CREDICOR);
      game.automa!.corpResources = 9;

      runBox(game, MarsBotCorpId.C01_CREDICOR);

      expect(plants(game)).eq(9);
    });
  });

  describe('state', () => {
    it('the store and the counters survive a save/load round trip', () => {
      const [game] = ecotecGame('-c40-serialize');
      AutomaResolver.resolveTag(game, Tag.ANIMAL);
      const stored = plants(game);
      const added = stat(game, 'ecotecPlantsAdded');

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C40_ECOTEC);
      expect(restored.automa!.corpResources).eq(stored);
      expect(restored.automa!.corpStats['ecotecPlantsAdded']).eq(added);
    });
  });
});
