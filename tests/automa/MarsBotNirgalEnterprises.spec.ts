import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AwardScorer} from '../../src/server/awards/AwardScorer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {MarsBotNirgalEnterprises} from '../../src/server/automa/corps/MarsBotNirgalEnterprises';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaMilestonesAwards} from '../../src/server/automa/AutomaMilestonesAwards';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B04 = BonusCardId.B04_OVERACHIEVEMENT;
const NIRGAL = MarsBotCorpId.C42_NIRGAL_ENTERPRISES;

/**
 * A live Nirgal game. ⚠️ The Before-Action-Phase box has ALREADY been offered
 * once by the first action phase (RB-B resolves those boxes right after setup
 * too), so every counter here is read as a DELTA — and generation 1 is in
 * NEITHER printed range, which is exactly why that first offer changes nothing.
 */
function nirgalGame(suffix: string, corporation: MarsBotCorpId = NIRGAL): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function runBox(game: IGame, corporation: MarsBotCorpId = NIRGAL) {
  AutomaCorporations.corpFor(corporation).beforeActionPhase?.(game);
}

function setGeneration(game: IGame, generation: number) {
  (game as unknown as {generation: number}).generation = generation;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function award(game: IGame, name: string) {
  const a = game.awards.find((a) => a.name === name);
  expect(a, `award ${name} in game`).is.not.undefined;
  return a!;
}

function failedActions(game: IGame): number {
  return game.gameLog.filter((m) => m.message.includes('Failed Action')).length;
}

/**
 * Park every track at 0. Two games seated with DIFFERENT corporations do not
 * start from the same board — the starting tags each card prints advance their
 * own tracks — so a comparison of award scores has to flatten that first, or
 * it measures the tags and not the effect.
 */
function zeroTracks(game: IGame) {
  for (const track of game.automa!.board.tracks) {
    track.position = 0;
  }
}

/** Make the Builder milestone claimable for the bot (space 8 on the building track). */
function armMilestone(game: IGame) {
  game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 8;
}

describe('MarsBot Nirgal Enterprises (C42)', () => {
  describe('the printed card', () => {
    it('prints three starting tags, no priority plate, and all three boxes', () => {
      const info = marsBotCorpInfo(NIRGAL);
      expect(info.original).eq(CardName.NIRGAL_ENTERPRISES);
      expect(info.cardNumber).eq('C42');
      expect(info.startingTags).deep.eq([Tag.BUILDING, Tag.POWER, Tag.PLANT]);
      expect(info.draftPriority, 'the corner box carries the tags; no plate is printed').is.undefined;
      expect(info.resource, 'nothing is stored on the card').is.undefined;
      expect(info.corpBonusCards, 'it destroys a bonus card, it brings none').is.empty;
      expect(info.trackCubes).is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect', 'beforeActionPhase']);
    });

    it('its SETUP sentence is the shared destroy phrasing — only the card name differs', () => {
      const setupLine = (id: MarsBotCorpId) => marsBotCorpInfo(id).sections
        .find((s) => s.kind === 'setup')!.lines
        .find((l) => l.text.includes('is destroyed'))!.text;
      const template = (text: string) => text.replace(/^.*? is destroyed/, '<card> is destroyed');
      expect(setupLine(NIRGAL)).contains('Overachievement');
      // C21 Pharmacy Union destroys Meteor Shower with the very same sentence.
      expect(template(setupLine(NIRGAL))).eq(template(setupLine(MarsBotCorpId.C21_PHARMACY_UNION)));
    });

    it('is registered and answers only to its own three hooks', () => {
      const corp = AutomaCorporations.corpFor(NIRGAL);
      expect(corp).eq(MarsBotNirgalEnterprises);
      expect(corp.setup, 'the SETUP box').is.a('function');
      expect(corp.awardScoreBonus, 'the EFFECT box').is.a('function');
      expect(corp.beforeActionPhase, 'the BEFORE ACTION PHASE box').is.a('function');
      expect(corp.onTagResolved).is.undefined;
      expect(corp.onTrackAdvance).is.undefined;
      expect(corp.resolveBonusCard).is.undefined;
      expect(corp.endgameVictoryPoints, 'the +2 is not a scoring TERM of its own').is.undefined;
    });

    it('no human Nirgal rule leaks — its card prints no starting M€ and no discount', () => {
      const info = marsBotCorpInfo(NIRGAL);
      const printed = info.sections.flatMap((s) => s.lines).map((l) => l.text).join(' ');
      // The human card starts on 30 M€ with three productions and «awards and
      // milestones always cost 0 M€ for you». None of that is on this one.
      expect(printed).does.not.match(/30|production|cost/i);
      expect(info.mcBank, 'no M€ on the card').is.undefined;
    });
  });

  describe('the SETUP box', () => {
    it('destroys Overachievement everywhere it could be', () => {
      const [game] = nirgalGame('-c42-destroy');
      expect(game.automa!.destroyedBonusCards).contains(B04);
      expect(game.automa!.bonusDeck.filter((e) => e.kind === 'bonus' && e.id === B04)).is.empty;
      expect(game.automa!.bonusDiscard).not.contains(B04);
      expect(game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === B04)).is.empty;
    });

    it('another corporation leaves it in the game', () => {
      const [game] = nirgalGame('-c42-other-deck', MarsBotCorpId.C01_CREDICOR);
      expect(game.automa!.destroyedBonusCards).not.contains(B04);
    });
  });

  describe('the EFFECT — +2 on every award', () => {
    it('the corporation answers the number; another one answers nothing', () => {
      const [nirgal] = nirgalGame('-c42-bonus');
      const [credicor] = nirgalGame('-c42-bonus-other', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.awardScoreBonus(nirgal)).eq(2);
      expect(AutomaCorporations.awardScoreBonus(credicor)).eq(0);
      expect(AutomaCorporations.corpFor(MarsBotCorpId.C01_CREDICOR).awardScoreBonus).is.undefined;
    });

    it('EVERY award is worth 2 more than the same board under another corporation', () => {
      const [nirgal] = nirgalGame('-c42-every');
      const [plain] = nirgalGame('-c42-every-base', MarsBotCorpId.C01_CREDICOR);
      zeroTracks(nirgal);
      zeroTracks(plain);
      expect(nirgal.awards.map((a) => a.name), 'the two games offer the same awards')
        .deep.eq(plain.awards.map((a) => a.name));
      for (const [index, a] of nirgal.awards.entries()) {
        const delta = AutomaMAEvaluation.botAwardScore(a, nirgal) -
          AutomaMAEvaluation.botAwardScore(plain.awards[index], plain);
        expect(delta, `award ${a.name}`).eq(2);
      }
    });

    it('the FUNDING decision sees it — an award the bot was tied on becomes one it leads', () => {
      const [game, human, bot] = nirgalGame('-c42-fund');
      // The exact state in which a plain bot is «not strictly ahead anywhere»:
      // Thermalist and Miner lost to the human, everything else tied at 0.
      zeroTracks(game);
      human.heat = 10;
      human.steel = 10;
      const [plainGame, plainHuman] = nirgalGame('-c42-fund-base', MarsBotCorpId.C01_CREDICOR);
      zeroTracks(plainGame);
      plainHuman.heat = 10;
      plainHuman.steel = 10;
      expect(AutomaMilestonesAwards.selectAwardToFund(plainGame), 'without the corporation: nothing to fund').is.undefined;

      const led = game.awards.filter((a) => {
        const scorer = new AwardScorer(game, a);
        return scorer.get(bot) - scorer.get(human) === 2;
      });
      expect(led, 'the +2 alone put it ahead on the untouched awards').is.not.empty;

      expect(AutomaMilestonesAwards.tryFundAward(game)).is.true;
      expect(game.fundedAwards).has.length(1);
      expect(game.fundedAwards[0].player.id).eq(bot.id);
      expect(game.fundedAwards[0].award.name, 'leftmost among the ones it now leads').eq(led[0].name);
    });

    it('the SCORING sees the same +2 — one derivation, read through AwardScorer', () => {
      const [game, human, bot] = nirgalGame('-c42-score');
      game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position = 3;
      human.heat = 4;
      const scorer = new AwardScorer(game, award(game, 'Thermalist'));
      expect(scorer.get(bot), 'track 3 + the printed 5 + the corporation 2').eq(10);
      expect(scorer.get(human), 'the human is untouched by it').eq(4);
    });

    it('and it stacks with the Easy adjustment rather than replacing it', () => {
      const [game, human] = testAutomaGame({corporation: NIRGAL, difficulty: 'easy'}, '-c42-easy');
      game.playerIsFinishedWithResearchPhase(human); // Seats the corporation.
      game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].position = 6;
      expect(AutomaMAEvaluation.botAwardScore(award(game, 'Scientist'), game), '6 − 5 + 2').eq(3);
    });

    it('it is an AWARD rule only — milestones are untouched', () => {
      const [game] = nirgalGame('-c42-not-milestones');
      game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 6;
      const builder = game.milestones.find((m) => m.name === 'Builder');
      expect(builder, 'Builder is on the Tharsis row').is.not.undefined;
      // Builder wants space 8; +2 on awards must not creep into that reading.
      expect(AutomaMAEvaluation.botMilestoneMet(builder!, game)).is.false;
      expect(AutomaMAEvaluation.botMilestoneScore(builder!, game)).eq(6);
    });
  });

  describe('the BEFORE ACTION PHASE box — a schedule', () => {
    it('generation 1 is in NEITHER printed range, so the first offer does nothing', () => {
      const [game] = nirgalGame('-c42-gen1');
      expect(game.generation).eq(1);
      expect(game.claimedMilestones, 'nothing was claimed on the way in').is.empty;
      expect(game.fundedAwards).is.empty;
      expect(stat(game, 'nirgalMilestones')).eq(0);
      expect(stat(game, 'nirgalAwards')).eq(0);
      expect(stat(game, 'nirgalSkipped'), 'and it is not an idle generation either').eq(0);
    });

    it('generations 2-5 claim a milestone, free of charge', () => {
      const [game, , bot] = nirgalGame('-c42-early');
      armMilestone(game);
      setGeneration(game, 3);
      const mc = bot.megaCredits;

      runBox(game);

      expect(game.claimedMilestones).has.length(1);
      expect(game.claimedMilestones[0].player.id).eq(bot.id);
      expect(game.claimedMilestones[0].milestone.name).eq('Builder');
      expect(bot.megaCredits, 'nothing was paid for it').eq(mc);
      expect(stat(game, 'nirgalMilestones')).eq(1);
      expect(stat(game, 'nirgalAwards')).eq(0);
    });

    it('generations 6-9 fund an award instead', () => {
      const [game, , bot] = nirgalGame('-c42-mid');
      armMilestone(game); // Claimable — and deliberately NOT claimed in this range.
      setGeneration(game, 7);
      const mc = bot.megaCredits;

      runBox(game);

      expect(game.claimedMilestones, 'the milestone half is asleep').is.empty;
      expect(game.fundedAwards).has.length(1);
      expect(game.fundedAwards[0].player.id).eq(bot.id);
      expect(bot.megaCredits, 'free of charge').eq(mc);
      expect(stat(game, 'nirgalAwards')).eq(1);
      expect(stat(game, 'nirgalMilestones')).eq(0);
    });

    it('generation 10+ goes back to milestones', () => {
      const [game] = nirgalGame('-c42-late');
      armMilestone(game);
      setGeneration(game, 11);

      runBox(game);

      expect(game.claimedMilestones).has.length(1);
      expect(game.fundedAwards).is.empty;
      expect(stat(game, 'nirgalMilestones')).eq(1);
    });

    it('the printed boundaries fall exactly where the card prints them', () => {
      const table: Array<[number, 'milestone' | 'award' | 'nothing']> = [
        [1, 'nothing'], [2, 'milestone'], [5, 'milestone'],
        [6, 'award'], [9, 'award'], [10, 'milestone'], [14, 'milestone'],
      ];
      for (const [generation, expected] of table) {
        const [game] = nirgalGame(`-c42-bound-${generation}`);
        armMilestone(game);
        setGeneration(game, generation);

        runBox(game);

        const actual = game.claimedMilestones.length > 0 ? 'milestone' :
          game.fundedAwards.length > 0 ? 'award' : 'nothing';
        expect(actual, `generation ${generation}`).eq(expected);
      }
    });
  });

  describe('«Skip Failed Action if unable»', () => {
    it('no claimable milestone: nothing happens, and NO compensation is paid', () => {
      const [game, , bot] = nirgalGame('-c42-skip-milestone');
      setGeneration(game, 3); // Nothing is met on a fresh board.
      const mc = bot.megaCredits;

      runBox(game);

      expect(game.claimedMilestones).is.empty;
      expect(failedActions(game), 'the box overrides the general rule').eq(0);
      expect(bot.megaCredits, 'and no M€ arrives with it').eq(mc);
      expect(stat(game, 'nirgalSkipped')).eq(1);

      // The contrast: the ordinary Claim Milestone TRACK action pays the
      // official compensation in exactly this state.
      AutomaMilestonesAwards.claimMilestoneAction(game);
      expect(failedActions(game)).eq(1);
      expect(bot.megaCredits).eq(mc + 5);
    });

    it('three awards already funded: the box declines quietly', () => {
      const [game, human, bot] = nirgalGame('-c42-skip-award');
      for (const name of ['Landlord', 'Banker', 'Scientist']) {
        game.fundedAwards.push({award: award(game, name), player: human});
      }
      setGeneration(game, 7);
      const mc = bot.megaCredits;

      runBox(game);

      expect(game.fundedAwards, 'nothing was added').has.length(3);
      expect(failedActions(game)).eq(0);
      expect(bot.megaCredits).eq(mc);
      expect(stat(game, 'nirgalSkipped')).eq(1);

      // The contrast again, on the award half.
      AutomaMilestonesAwards.fundAwardAction(game);
      expect(failedActions(game)).eq(1);
      expect(bot.megaCredits).eq(mc + 5);
    });

    it('three milestones already claimed: same silence', () => {
      const [game, human, bot] = nirgalGame('-c42-maxed');
      armMilestone(game);
      for (const milestone of game.milestones.slice(0, 3)) {
        game.claimedMilestones.push({milestone, player: human});
      }
      setGeneration(game, 4);
      const mc = bot.megaCredits;

      runBox(game);

      expect(game.claimedMilestones).has.length(3);
      expect(failedActions(game)).eq(0);
      expect(bot.megaCredits).eq(mc);
      expect(stat(game, 'nirgalSkipped')).eq(1);
    });

    it('another corporation runs no box of this kind at all', () => {
      const [game] = nirgalGame('-c42-other-box', MarsBotCorpId.C01_CREDICOR);
      armMilestone(game);
      setGeneration(game, 3);

      runBox(game, MarsBotCorpId.C01_CREDICOR);

      expect(game.claimedMilestones).is.empty;
      expect(game.automa!.corpStats['nirgalMilestones']).is.undefined;
    });
  });

  describe('state', () => {
    it('the counters and the destroyed card survive a save/load round trip', () => {
      const [game] = nirgalGame('-c42-serialize');
      armMilestone(game);
      setGeneration(game, 3);
      runBox(game);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(NIRGAL);
      expect(restored.automa!.corpStats['nirgalMilestones']).eq(1);
      expect(restored.automa!.destroyedBonusCards).contains(B04);
      // The effect is a property of the SEATED corporation, so it comes back
      // WITH it rather than being stored anywhere of its own.
      expect(AutomaCorporations.awardScoreBonus(restored)).eq(2);
    });
  });
});
