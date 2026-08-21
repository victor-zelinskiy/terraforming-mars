import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {MarsBotSagittaFrontierServices} from '../../src/server/automa/corps/MarsBotSagittaFrontierServices';
import {resolveProjectCardForBot} from '../../src/server/automa/AutomaCardDraw';
import {failedAction} from '../../src/server/automa/AutomaFailedAction';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {fakeCard} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const SAGITTA = MarsBotCorpId.C44_SAGITTA_FRONTIER_SERVICES;

/** A live Sagitta game with the corporation seated (setup already run). */
function sagittaGame(suffix: string, corporation: MarsBotCorpId = SAGITTA): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/**
 * Park every track on a space that prints NOTHING, so the only money that moves
 * during a test is the corporation's. Building #1, science #4, event #11 and
 * the rest are blank on the Tharsis mat; building stays LOWEST so a wild tag
 * has one unambiguous destination.
 */
function quietBoard(game: IGame) {
  const tracks = game.automa!.board.tracks;
  tracks[THARSIS_TRACK.BUILDING].position = 0;
  tracks[THARSIS_TRACK.SPACE].position = 3;
  tracks[THARSIS_TRACK.EVENT].position = 10;
  tracks[THARSIS_TRACK.SCIENCE].position = 4;
  tracks[THARSIS_TRACK.ENERGY].position = 8;
  tracks[THARSIS_TRACK.EARTH].position = 6;
  tracks[THARSIS_TRACK.BIO].position = 4;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function failedActionLines(game: IGame): Array<string> {
  return game.gameLog.filter((m) => m.message.includes('Failed Action')).map((m) => m.message);
}

/**
 * The amounts the LAST failed action's journal line carries. The message itself
 * is the untranslated TEMPLATE (`… gained ${1} M€`), so the number lives in the
 * line's data — which is exactly where the journal and the turn theater read it.
 */
function failedActionAmounts(game: IGame): Array<string> {
  const line = game.gameLog.filter((m) => m.message.includes('Failed Action')).pop();
  return (line?.data ?? []).map((d) => String(d.value));
}

function noTagCard(): IProjectCard {
  return fakeCard({tags: []});
}

describe('MarsBot Sagitta Frontier Services (C44)', () => {
  describe('the printed card', () => {
    it('prints two starting tags, no priority plate and two boxes', () => {
      const info = marsBotCorpInfo(SAGITTA);
      expect(info.original).eq(CardName.SAGITTA_FRONTIER_SERVICES);
      expect(info.cardNumber).eq('C44');
      expect(info.startingTags).deep.eq([Tag.POWER, Tag.EVENT]);
      expect(info.draftPriority, 'the corner box carries the tags; no plate is printed').is.undefined;
      expect(info.resource, 'nothing is stored on the card').is.undefined;
      expect(info.trackCubes, 'and nothing is seeded on the mat').is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect']);
    });

    it('is registered and answers only to its own hooks', () => {
      const corp = AutomaCorporations.corpFor(SAGITTA);
      expect(corp).eq(MarsBotSagittaFrontierServices);
      expect(corp.setup, 'the SETUP box pays 8 M€').is.a('function');
      expect(corp.failedActionCompensation, 'the «instead of 5 MC» half').is.a('function');
      expect(corp.onFailedAction, 'and its counters/attribution').is.a('function');
      expect(corp.onProjectCardResolving, 'the «exactly 1 tag» half').is.a('function');
      expect(corp.onTrackCubeTrigger).is.undefined;
      expect(corp.onTagResolved, 'the trigger is the CARD, never a tag').is.undefined;
      expect(corp.beforeActionPhase).is.undefined;
    });

    it('no human Sagitta rule leaks — no 31 M€, no production, no card draw', () => {
      const info = marsBotCorpInfo(SAGITTA);
      const printed = info.sections.flatMap((s) => s.lines).map((l) => l.text).join(' ');
      expect(printed).does.not.match(/31|production|draw/i);
      expect(info.mcBank).is.undefined;
    });
  });

  describe('the SETUP box', () => {
    it('pays the bot 8 M€', () => {
      const [, , bot] = sagittaGame('-c44-setup');
      const [, , plainBot] = sagittaGame('-c44-setup-base', MarsBotCorpId.C01_CREDICOR);
      expect(bot.megaCredits - plainBot.megaCredits).eq(8);
    });
  });

  describe('the EFFECT — a card with NO tags', () => {
    it('pays 10 M€ INSTEAD of the usual compensation, in one line', () => {
      const [game, , bot] = sagittaGame('-c44-dead');
      quietBoard(game);
      const mc = bot.megaCredits;

      resolveProjectCardForBot(game, noTagCard());

      expect(bot.megaCredits - mc, 'ten, not five and then five more').eq(10);
      expect(failedActionLines(game), 'the failure still happened').has.length(1);
      expect(failedActionAmounts(game), 'ONE event, stating the number the card prints').contains('10');
      expect(stat(game, 'sagittaDeadCards')).eq(1);
      expect(stat(game, 'sagittaBonusMc'), 'how much more than the standard 5').eq(5);
      expect(stat(game, 'sagittaThinCards'), 'a dead card is not a thin one').eq(0);
    });

    it('another corporation gets the ordinary 5', () => {
      const [game, , bot] = sagittaGame('-c44-dead-base', MarsBotCorpId.C01_CREDICOR);
      quietBoard(game);
      const mc = bot.megaCredits;

      resolveProjectCardForBot(game, noTagCard());

      expect(bot.megaCredits - mc).eq(5);
      expect(game.automa!.corpStats['sagittaDeadCards']).is.undefined;
    });

    it('EASY does not shrink the printed 10', () => {
      // The card states an absolute number, and so does the Easy rule (a failed
      // action pays 3, not «5 − 2»), so the corporation REPLACES the constant.
      // The other reading — apply Easy's reduction to the corporation's number
      // too, paying 8 — is deliberately rejected; this test is where that lives.
      const [game, human, bot] = testAutomaGame({corporation: SAGITTA, difficulty: 'easy'}, '-c44-easy');
      game.playerIsFinishedWithResearchPhase(human);
      quietBoard(game);
      const mc = bot.megaCredits;

      resolveProjectCardForBot(game, noTagCard());

      expect(bot.megaCredits - mc).eq(10);
    });

    it('EVERY OTHER failure still pays what it always paid', () => {
      const [game, , bot] = sagittaGame('-c44-other-failures');
      const mc = bot.megaCredits;

      failedAction(game, 'temperature-maxed');
      failedAction(game, 'no-tile-space');
      failedAction(game, 'milestones-claimed');

      expect(bot.megaCredits - mc, 'three ordinary failures at 5 each').eq(15);
      expect(stat(game, 'sagittaDeadCards'), 'and none of them is a dead CARD').eq(0);
    });
  });

  describe('the EFFECT — a card with EXACTLY one tag', () => {
    it('pays 1 M€ on top of what the tag itself does', () => {
      const [game, , bot] = sagittaGame('-c44-thin');
      quietBoard(game);
      const mc = bot.megaCredits;

      resolveProjectCardForBot(game, fakeCard({tags: [Tag.BUILDING]}));

      expect(bot.megaCredits - mc).eq(1);
      expect(game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position,
        'the tag still advanced its track').eq(1);
      expect(stat(game, 'sagittaThinCards')).eq(1);
      expect(stat(game, 'sagittaThinMc')).eq(1);
      expect(failedActionLines(game), 'nothing failed here').is.empty;
    });

    it('two tags pay nothing', () => {
      const [game, , bot] = sagittaGame('-c44-fat');
      quietBoard(game);
      const mc = bot.megaCredits;

      resolveProjectCardForBot(game, fakeCard({tags: [Tag.BUILDING, Tag.SCIENCE]}));

      expect(bot.megaCredits).eq(mc);
      expect(stat(game, 'sagittaThinCards')).eq(0);
    });

    it('a WILD tag counts as a tag — the BOT resolves it as a track step', () => {
      // The human twin's own reading EXCLUDES wild tags; the bot's does not,
      // because for the bot a wild tag IS an advance. The printed «(instead of
      // 5MC)» is what settles it: «no tags» has to mean the case that takes the
      // Failed Action, and this card takes none.
      const [game, , bot] = sagittaGame('-c44-wild');
      quietBoard(game);
      const mc = bot.megaCredits;

      resolveProjectCardForBot(game, fakeCard({tags: [Tag.WILD]}));

      expect(bot.megaCredits - mc, 'one tag, one M€').eq(1);
      expect(failedActionLines(game), 'and certainly not a dead card').is.empty;
      expect(game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position,
        'the wild advanced the least-advanced track').eq(1);
    });

    it('an EVENT card with no printed tags is a ONE-tag card, not a dead one', () => {
      const [game, , bot] = sagittaGame('-c44-event');
      quietBoard(game);
      const mc = bot.megaCredits;

      resolveProjectCardForBot(game, fakeCard({type: CardType.EVENT, tags: []}));

      expect(bot.megaCredits - mc).eq(1);
      expect(stat(game, 'sagittaThinCards')).eq(1);
      expect(stat(game, 'sagittaDeadCards')).eq(0);
      expect(game.automa!.board.tracks[THARSIS_TRACK.EVENT].position,
        'and it advanced the event track').eq(11);
    });

    it('an EVENT card that also prints a tag has TWO, so it pays nothing', () => {
      const [game, , bot] = sagittaGame('-c44-event-plus');
      quietBoard(game);
      const mc = bot.megaCredits;

      resolveProjectCardForBot(game, fakeCard({type: CardType.EVENT, tags: [Tag.BUILDING]}));

      expect(bot.megaCredits).eq(mc);
      expect(stat(game, 'sagittaThinCards')).eq(0);
    });

    it('another corporation pays nothing for the same card', () => {
      const [game, , bot] = sagittaGame('-c44-thin-base', MarsBotCorpId.C01_CREDICOR);
      quietBoard(game);
      const mc = bot.megaCredits;

      resolveProjectCardForBot(game, fakeCard({tags: [Tag.BUILDING]}));

      expect(bot.megaCredits).eq(mc);
      expect(game.automa!.corpStats['sagittaThinCards']).is.undefined;
    });
  });

  describe('state', () => {
    it('the counters survive a save/load round trip', () => {
      const [game] = sagittaGame('-c44-serialize');
      quietBoard(game);
      resolveProjectCardForBot(game, noTagCard());
      resolveProjectCardForBot(game, fakeCard({tags: [Tag.BUILDING]}));

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(SAGITTA);
      expect(restored.automa!.corpStats['sagittaDeadCards']).eq(1);
      expect(restored.automa!.corpStats['sagittaBonusMc']).eq(5);
      expect(restored.automa!.corpStats['sagittaThinCards']).eq(1);
    });
  });
});
