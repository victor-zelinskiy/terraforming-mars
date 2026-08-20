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
import {VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {newProjectCard} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** What one paying tag is worth. */
const TAG_MC = 2;
/** The only base card carrying BOTH paying tags — probed from the corpus. */
const PLANT_AND_ANIMAL = CardName.ECOLOGICAL_ZONE;

/** A live Arklight game. */
function arklightGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C31_ARKLIGHT,
  options: Record<string, unknown> = {}): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation, ...options}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function bioPosition(game: IGame): number {
  return game.automa!.board.tracks[THARSIS_TRACK.BIO].position;
}

describe('MarsBot Arklight (C31)', () => {
  describe('the printed card', () => {
    it('prints an animal starting tag, an animal > plant priority and a white tracker', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C31_ARKLIGHT);
      expect(info.original).eq(CardName.ARKLIGHT);
      expect(info.cardNumber).eq('C31');
      expect(info.startingTags).deep.eq([Tag.ANIMAL]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.ANIMAL, Tag.PLANT]});
      expect(info.whiteMarkerTracks).deep.eq([Tag.PLANT]);
      expect(info.markerLegend, 'and the reminder says what it reminds of').is.a('string').and.not.empty;
      expect(info.markerLegend, 'including the exclusion, which is the whole point')
        .contains('microbe');
      expect(info.trackCubes, 'a tracker is not a seeded cube').is.undefined;
      expect(info.requiresModules).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });

    it('paints the tracker of the track those tags ride', () => {
      const [game] = arklightGame('-ak-marker');
      expect(AutomaCorporations.whiteMarkerTrackIndexes(game)).deep.eq([THARSIS_TRACK.BIO]);
    });

    it('another corporation paints none', () => {
      const [game] = arklightGame('-ak-marker-other', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.whiteMarkerTrackIndexes(game)).is.empty;
    });
  });

  describe('the EFFECT — «including the starting tag»', () => {
    it('the animal tag it opens with has already paid it by the first action phase', () => {
      const [game] = arklightGame('-ak-start');
      expect(bioPosition(game), 'the starting tag really resolved').eq(1);
      expect(stat(game, 'arklightTags')).eq(1);
      expect(stat(game, 'arklightMc')).eq(TAG_MC);
    });

    it('a PLANT tag pays', () => {
      // Exact balances are honest here and only here: the starting tag leaves
      // the plant track on #1, so the next advance lands on a BARE cell and
      // nothing but the corporation moves the money.
      const [game, , bot] = arklightGame('-ak-plant');
      const before = bot.megaCredits;
      const tags = stat(game, 'arklightTags');

      AutomaResolver.resolveTag(game, Tag.PLANT);

      expect(bot.megaCredits).eq(before + TAG_MC);
      expect(stat(game, 'arklightTags')).eq(tags + 1);
    });

    it('an ANIMAL tag pays', () => {
      const [game, , bot] = arklightGame('-ak-animal');
      const before = bot.megaCredits;

      AutomaResolver.resolveTag(game, Tag.ANIMAL);

      expect(bot.megaCredits).eq(before + TAG_MC);
    });

    it('a card carrying BOTH pays TWICE — the trigger is the tag, not the card', () => {
      const [game] = arklightGame('-ak-both');
      const tags = stat(game, 'arklightTags');
      const mc = stat(game, 'arklightMc');
      const card = newProjectCard(PLANT_AND_ANIMAL)!;

      AutomaResolver.resolveProjectCard(game, card);

      // Counted, never measured as a NET balance: the second tag lands the
      // plant track on its greenery cell, and a greenery beside an ocean pays
      // its own 2 M€ — a real gain that has nothing to do with this card.
      expect(stat(game, 'arklightTags') - tags, 'two printed tags, two payments').eq(2);
      expect(stat(game, 'arklightMc') - mc).eq(2 * TAG_MC);
    });
  });

  describe('«(not microbe!)» — the printed exclamation', () => {
    it('a MICROBE tag advances the very same track and pays NOTHING', () => {
      const [game, , bot] = arklightGame('-ak-microbe');
      const before = bot.megaCredits;
      const position = bioPosition(game);
      const tags = stat(game, 'arklightTags');

      AutomaResolver.resolveTag(game, Tag.MICROBE);

      expect(bioPosition(game), 'the tag did resolve — it rides the plant track').eq(position + 1);
      expect(bot.megaCredits, 'and paid nothing').eq(before);
      expect(stat(game, 'arklightTags')).eq(tags);
    });

    it('the TRACK advancing on its own pays nothing either — this is not C09', () => {
      // C09 Teractor paints the same reminder and pays for ADVANCING the
      // track; this card pays for a TAG. Same marking, opposite trigger.
      const [game, , bot] = arklightGame('-ak-track');
      const before = bot.megaCredits;

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BIO);

      expect(bioPosition(game)).is.greaterThan(0);
      expect(bot.megaCredits).eq(before);
    });

    it('a WILD tag is neither of the two the card names', () => {
      const [game, , bot] = arklightGame('-ak-wild');
      const before = bot.megaCredits;
      const tags = stat(game, 'arklightTags');

      AutomaResolver.resolveTag(game, Tag.WILD);

      expect(bot.megaCredits).eq(before);
      expect(stat(game, 'arklightTags')).eq(tags);
    });

    it('an unrelated tag pays nothing', () => {
      const [game, , bot] = arklightGame('-ak-other-tag');
      const before = bot.megaCredits;

      AutomaResolver.resolveTag(game, Tag.BUILDING);

      expect(bot.megaCredits).eq(before);
    });

    it('the Venus board\'s MICROBE ADVANCEMENT pays nothing — deliberately deaf to that cell', () => {
      // C24 Splice implements `onMicrobeAdvancement` for exactly this cell.
      // A microbe is the ONE thing this card's effect box rules out, so being
      // deaf here is the reading, not an omission.
      const [game, , bot] = arklightGame('-ak-venus', MarsBotCorpId.C31_ARKLIGHT, {venusNextExtension: true});
      game.automa!.board.tracks[VENUS_TRACK_INDEX].position = 8;
      const before = bot.megaCredits;
      const tags = stat(game, 'arklightTags');

      AutomaResolver.advanceTrack(game, VENUS_TRACK_INDEX);

      expect(game.automa!.board.tracks[VENUS_TRACK_INDEX].position, 'it landed on the microbe cell').eq(9);
      expect(bot.megaCredits).eq(before);
      expect(stat(game, 'arklightTags')).eq(tags);
    });

    it('another corporation collects nothing from the same tags', () => {
      const [game, , bot] = arklightGame('-ak-corp-other', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;

      AutomaResolver.resolveTag(game, Tag.ANIMAL);
      AutomaResolver.resolveTag(game, Tag.PLANT);

      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['arklightTags']).is.undefined;
    });
  });

  describe('draft priority — «animal, then plant»', () => {
    it('prefers an animal card, and falls back to a plant one', () => {
      const [game] = arklightGame('-ak-draft');
      const animal = newProjectCard(CardName.BIRDS)!;
      const plant = newProjectCard(CardName.BUSHES)!;
      const neither = newProjectCard(CardName.CARBONATE_PROCESSING)!;

      expect(AutomaCorporations.draftPick(game, [neither, plant, animal]).name).eq(CardName.BIRDS);
      expect(AutomaCorporations.draftPick(game, [neither, plant]).name).eq(CardName.BUSHES);
    });
  });

  describe('state', () => {
    it('the counters survive a save/load round trip', () => {
      const [game] = arklightGame('-ak-serialize');
      AutomaResolver.resolveTag(game, Tag.PLANT);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C31_ARKLIGHT);
      expect(restored.automa!.corpStats['arklightMc']).eq(2 * TAG_MC);
      expect(AutomaCorporations.whiteMarkerTrackIndexes(restored)).deep.eq([THARSIS_TRACK.BIO]);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = arklightGame('-ak-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C31_ARKLIGHT);
    });
  });
});
