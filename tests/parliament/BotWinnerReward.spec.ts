import {expect} from 'chai';
import {Phase} from '../../src/common/Phase';
import {TileType} from '../../src/common/TileType';
import {ResolutionId} from '../../src/common/parliament/ParliamentTypes';
import {TILE_GRANT_NO_DESTINATION_REASON, tileGrantStepKey} from '../../src/common/parliament/tileGrant';
import {winnerParameterStepKey} from '../../src/common/parliament/winnerReward';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {Parliament} from '../../src/server/parliament/Parliament';
import {botWinnerRewardKind, botWinnerRewardPlan, declaresWinnerPart, NO_BOT_EXECUTOR_REASON} from '../../src/server/automa/BotWinnerReward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {ResolutionDefinition} from '../../src/server/parliament/resolutions/IResolution';
import {WINNER_STEP_AT_MAXIMUM_REASON} from '../../src/server/parliament/resolutions/WinnerParameterStep';
import {AQUIFER_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {BIODOME_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/BiodomeContest';
import {MOHOLE_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/MoholeContest';
import {COLONY_CONTEST_ID, NO_COLONY_AVAILABLE} from '../../src/server/parliament/resolutions/unity/ColonyContest';
import {COLONIZATION_FUNDING_ID} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {SKYSCRAPERS_ID} from '../../src/server/parliament/resolutions/marsFirst/Skyscrapers';
import {SerializedEnactOutcome} from '../../src/server/parliament/SerializedParliament';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {TestPlayer} from '../TestPlayer';
import {addCity, maxOutOceans, runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {answerGate, gatePromptOf, REDS_STAND_IN, seatResolution} from './parliamentArrange';

/**
 * THE BOT AS THE WINNING PLAYER (docs/TURMOIL_REDUX_MARSBOT.md §4, stage Э2):
 * the Agenda step as a human's (a card = 1 M€, RB-A p.11), the winner's
 * part by the card's DECLARATION through the bot's own primitives, every
 * impossibility a NAMED skip, never a prompt for the bot — and the GUARD:
 * every catalogued card with a winner's part has a kind the bot executes.
 */
function label(definition: ResolutionDefinition): string {
  return `${definition.code ?? '—'} ${definition.id}`;
}

type Table = {game: IGame; human: TestPlayer; bot: IPlayer; parliament: Parliament};

function seated(id: ResolutionId, arrange?: (t: Table) => void): Table {
  const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
  const parliament = game.parliament!;
  game.playerIsFinishedWithResearchPhase(human);
  seatResolution(parliament, 0, id);
  parliament.slots.forEach((slot) => (slot.votes = []));
  const table = {game, human, bot, parliament};
  arrange?.(table);
  return table;
}

/** The bot's free delegate alone on slot 0 makes it the winning player; the bot's deck is emptied so it passes at once. */
function botWinsTheVote(t: Table): void {
  t.parliament.placeVote(t.bot, t.parliament.slots[0], 'lobby');
  t.game.automa!.actionDeck = [];
  t.human.popWaitingFor();
  t.game.playerHasPassed(t.human);
  t.game.playerIsFinishedTakingActions();
  expect(t.game.phase).eq(Phase.PARLIAMENT);
  expect(t.parliament.phase?.step).eq('assembly');
  expect(t.parliament.phase?.summary?.winner.player).eq(t.bot.id);
}

/** Walk the sitting to its end, answering the human's own asks; the bot must never hold a prompt. */
function throughTheSitting(t: Table): void {
  for (let guard = 0; guard < 12 && t.game.phase === Phase.PARLIAMENT; guard++) {
    expect(t.bot.getWaitingFor(), 'the bot is never asked').is.undefined;
    const wf = t.human.getWaitingFor();
    if (gatePromptOf(t.human) !== undefined) {
      answerGate(t.human);
    } else if (wf instanceof SelectSpace) {
      t.human.process({type: 'space', spaceId: wf.spaces[0].id});
    } else if (wf instanceof SelectCard) {
      t.human.process({type: 'card', cards: wf.externalDrawPrompt !== undefined ? wf.cards.map((c) => c.name) : [wf.cards[0].name]});
    } else if (wf instanceof SelectColony) {
      t.human.process({type: 'colony', colonyName: wf.colonies[0].name});
    } else {
      break;
    }
    runAllActions(t.game);
  }
  expect(t.parliament.phase, 'the sitting ended').is.undefined;
}

function botRecords(t: Table): Array<SerializedEnactOutcome> {
  return (t.parliament.lastPhase?.outcomes ?? []).filter((o) => o.player === t.bot.id);
}

describe('BotWinnerReward — the bot as the winning player', () => {
  describe('the GUARD (the worklist): every winner\'s part of the catalog has a kind the bot executes', () => {
    it('lists the cards whose winner\'s part the bot has no executor for', () => {
      const failures: Array<string> = [];
      // The DEALT catalog (`copies > 0`): the never-dealt development examples (`RDX_DEV_*`) are stand-ins
      // of parties with no real card and print rules of their own — a bot winner there is a NAMED skip, pinned below.
      for (const definition of REDUX_RESOLUTION_CATALOG.all().filter((d) => d.copies > 0)) {
        if (!declaresWinnerPart(definition)) {
          expect(botWinnerRewardKind(definition), label(definition)).is.undefined;
          continue;
        }
        const plan = botWinnerRewardPlan(definition);
        if (plan === undefined) {
          failures.push(`${label(definition)}: winner steps [${(definition.winnerSteps ?? []).map((s) => s.key).join(', ')}] with no declaration the bot executes (winnerReward / tileGrant)`);
          continue;
        }
        // The record wears the card's OWN step key — the readers find the bot's reward where they find a human's.
        const own = plan.part === 'winner' ? definition.winnerSteps?.[0]?.key : (definition.tileGrant === undefined ? undefined : tileGrantStepKey(definition.tileGrant));
        if (own !== plan.key) {
          failures.push(`${label(definition)}: the bot's record key '${plan.key}' is not the card's step key '${own}'`);
        }
        if ((definition.winnerSteps?.length ?? 0) > 1) {
          failures.push(`${label(definition)}: ${definition.winnerSteps?.length} winner steps — the bot pass pays ONE declared kind`);
        }
      }
      expect(failures, `\n${failures.join('\n')}\n`).deep.eq([]);
    });

    it('a winner\'s part the bot has no executor for (the dev example) is a NAMED skip at the table, never silence, never a crash', () => {
      const t = seated(REDS_STAND_IN);
      expect(declaresWinnerPart(REDUX_RESOLUTION_CATALOG.getOrThrow(REDS_STAND_IN))).is.true;
      expect(botWinnerRewardPlan(REDUX_RESOLUTION_CATALOG.getOrThrow(REDS_STAND_IN))).is.undefined;
      botWinsTheVote(t);
      throughTheSitting(t);
      const [record] = botRecords(t);
      expect(record).deep.include({part: 'winner', kind: 'skipped', reason: NO_BOT_EXECUTOR_REASON});
      expect(t.game.gameLog.some((m) => m.message === '${0} has no way to take the winner\'s reward of ${1} — it is skipped')).is.true;
    });

    it('the plan of every shipped kind', () => {
      const plan = (id: ResolutionId) => botWinnerRewardPlan(REDUX_RESOLUTION_CATALOG.getOrThrow(id));
      expect(plan(AQUIFER_CONTEST_ID)).deep.eq({kind: 'ocean', key: 'ocean', part: 'winner'});
      expect(plan(BIODOME_CONTEST_ID)).deep.eq({kind: 'greenery', key: 'greenery', part: 'winner'});
      expect(plan(COLONY_CONTEST_ID)).deep.eq({kind: 'colony', key: 'colony', part: 'winner'});
      const mohole = REDUX_RESOLUTION_CATALOG.getOrThrow(MOHOLE_CONTEST_ID);
      expect(plan(MOHOLE_CONTEST_ID)).deep.eq({kind: 'parameter', key: winnerParameterStepKey(mohole.winnerReward as never), part: 'winner'});
      const skyscrapers = REDUX_RESOLUTION_CATALOG.getOrThrow(SKYSCRAPERS_ID);
      expect(plan(SKYSCRAPERS_ID)).deep.eq({kind: 'city', key: tileGrantStepKey(skyscrapers.tileGrant as never), part: 'effect'});
      expect(plan(COLONIZATION_FUNDING_ID)).is.undefined;
    });
  });

  describe('the Agenda step of a bot winner', () => {
    it('the marker moves; a TR step pays a TR; the bot is never asked', () => {
      const t = seated(COLONIZATION_FUNDING_ID);
      t.parliament.agenda.set(t.bot.id, 1); // the next step (2) is a TR step
      botWinsTheVote(t);
      const tr = t.bot.terraformRating;
      throughTheSitting(t);
      expect(t.parliament.agendaOf(t.bot)).eq(2);
      expect(t.bot.terraformRating).eq(tr + 1);
      expect(t.parliament.lastPhase?.agenda).deep.include({player: t.bot.id, from: 1, to: 2, bonus: 'tr'});
      expect(t.parliament.lastAdvance).deep.include({player: t.bot.id, reason: 'phase'});
    });

    it('a CARD step pays 1 M€ instead (RB-A p.11) — the bot has no hand', () => {
      const t = seated(COLONIZATION_FUNDING_ID);
      t.parliament.agenda.set(t.bot.id, 6); // the next step (7) is a card
      botWinsTheVote(t);
      const mc = t.bot.megaCredits;
      const hand = t.bot.cardsInHand.length;
      throughTheSitting(t);
      expect(t.parliament.agendaOf(t.bot)).eq(7);
      expect(t.bot.megaCredits).eq(mc + 1);
      expect(t.bot.cardsInHand.length).eq(hand);
      expect(t.game.gameLog.some((m) => m.message === '${0} gains 1 M€ from the Agenda track instead of a card')).is.true;
      expect(t.parliament.lastPhase?.agenda?.bonus).eq('card');
    });

    it('a law that pays every seat (Colonization Funding): the human is paid, the bot is not, the bot\'s Agenda still moved', () => {
      // The human's share is per influence (+ per space city): one step of the Agenda gives it influence 1.
      const t = seated(COLONIZATION_FUNDING_ID, ({parliament, human}) => parliament.agenda.set(human.id, 1));
      botWinsTheVote(t);
      const humanProduction = t.human.production.megacredits;
      throughTheSitting(t);
      expect(t.parliament.agendaOf(t.bot)).eq(1);
      expect(t.parliament.agendaOf(t.human)).eq(1);
      expect(t.bot.production.megacredits).eq(0);
      expect(t.human.production.megacredits).greaterThan(humanProduction);
      const outcomes = t.parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.some((o) => o.player === t.human.id && o.kind === 'production')).is.true;
      expect(botRecords(t)).deep.eq([]);
    });

    it('a NEUTRAL winner is as it always was: no Agenda, no reward, no bot pass', () => {
      const t = seated(AQUIFER_CONTEST_ID);
      t.game.automa!.actionDeck = [];
      t.human.popWaitingFor();
      t.game.playerHasPassed(t.human);
      t.game.playerIsFinishedTakingActions();
      expect(t.parliament.phase?.summary?.winner.player).eq('NEUTRAL');
      const oceans = t.game.board.getOceanSpaces().length;
      throughTheSitting(t);
      expect(t.game.board.getOceanSpaces().length).eq(oceans);
      expect(t.parliament.agendaOf(t.bot)).eq(0);
      expect(botRecords(t)).deep.eq([]);
    });
  });

  describe('RX01 Aquifer Contest — an ocean by the bot\'s own placement', () => {
    it('the bot places the ocean (its TR, the record under the card\'s key, part winner); the human\'s share is its own', () => {
      const t = seated(AQUIFER_CONTEST_ID);
      botWinsTheVote(t);
      const tr = t.bot.terraformRating;
      const oceans = t.game.board.getOceanSpaces().length;
      throughTheSitting(t);
      expect(t.game.board.getOceanSpaces().length).eq(oceans + 1);
      // The ocean's TR (+1) and the Agenda's first step (influence — no bonus).
      expect(t.bot.terraformRating).eq(tr + 1);
      const records = botRecords(t);
      expect(records).has.length(1);
      expect(records[0]).deep.include({step: 'ocean', part: 'winner', kind: 'ocean', parameter: {id: 'oceans', before: oceans, after: oceans + 1}});
      expect(records[0].space).is.not.undefined;
      expect(t.game.board.getSpaceOrThrow(records[0].space!).tile?.tileType).eq(TileType.OCEAN);
      expect(t.game.gameLog.some((m) => m.message === '${0} receives the winner\'s reward of ${1}')).is.true;
      // The human's own part (animals) recorded for the human, as ever; nothing of the human's on the bot.
      expect((t.parliament.lastPhase?.outcomes ?? []).some((o) => o.player === t.human.id && o.step === 'animals')).is.true;
      // The cell's own placement bonus may pay the bot (as any placement does); a FAILED ACTION never fires in the sitting.
      expect(t.game.gameLog.some((m) => m.message.includes('Failed Action')), 'no Failed Action in the sitting').is.false;
    });

    it('no ocean tile left → «ПРОПУЩЕНО · океан» with the reason, nothing else', () => {
      const t = seated(AQUIFER_CONTEST_ID, ({human}) => maxOutOceans(human));
      botWinsTheVote(t);
      const tr = t.bot.terraformRating;
      throughTheSitting(t);
      expect(t.bot.terraformRating).eq(tr);
      expect(t.bot.megaCredits).eq(0);
      expect(botRecords(t)).deep.eq([{player: t.bot.id, step: 'ocean', part: 'winner', kind: 'skipped', reason: 'No ocean tile is left'}]);
    });
  });

  describe('RX03 Biodome Contest — a greenery by the bot\'s own placement', () => {
    it('the greenery lands (the bot\'s), oxygen +1, TR +2 (the oxygen and the tile itself)', () => {
      const t = seated(BIODOME_CONTEST_ID);
      botWinsTheVote(t);
      const tr = t.bot.terraformRating;
      const oxygen = t.game.getOxygenLevel();
      throughTheSitting(t);
      expect(t.game.getOxygenLevel()).eq(oxygen + 1);
      expect(t.bot.terraformRating).eq(tr + 2);
      const [record] = botRecords(t);
      expect(record).deep.include({step: 'greenery', part: 'winner', kind: 'greenery', parameter: {id: 'oxygen', before: oxygen, after: oxygen + 1}});
      const space = t.game.board.getSpaceOrThrow(record.space!);
      expect(space.tile?.tileType).eq(TileType.GREENERY);
      expect(space.player?.id).eq(t.bot.id);
    });

    it('at the oxygen maximum the tile still lands and still pays its own TR', () => {
      const t = seated(BIODOME_CONTEST_ID, ({game}) => setOxygenLevel(game, 14));
      botWinsTheVote(t);
      const tr = t.bot.terraformRating;
      throughTheSitting(t);
      expect(t.game.getOxygenLevel()).eq(14);
      expect(t.bot.terraformRating).eq(tr + 1);
      expect(botRecords(t)[0]).deep.include({kind: 'greenery', parameter: {id: 'oxygen', before: 14, after: 14}});
    });
  });

  describe('RX09 Colony Contest — a colony by the bot\'s own build', () => {
    it('the bot builds a colony (flip-to-pick, two storage resources, no M€) and the record names the tile', () => {
      const t = seated(COLONY_CONTEST_ID);
      botWinsTheVote(t);
      const cubes = () => t.game.colonies.reduce((sum, colony) => sum + colony.colonies.filter((id) => id === t.bot.id).length, 0);
      expect(cubes()).eq(0);
      throughTheSitting(t);
      expect(cubes()).eq(1);
      const [record] = botRecords(t);
      expect(record).deep.include({step: 'colony', part: 'winner', kind: 'colony'});
      const built = t.game.colonies.find((colony) => colony.colonies.includes(t.bot.id))!;
      expect(record.colony).eq(built.name);
      expect(t.bot.megaCredits).eq(0);
    });

    it('no tile to build on (every tile inactive) → a named skip', () => {
      const t = seated(COLONY_CONTEST_ID, ({game}) => game.colonies.forEach((colony) => (colony.isActive = false)));
      botWinsTheVote(t);
      throughTheSitting(t);
      expect(botRecords(t)).deep.eq([{player: t.bot.id, step: 'colony', part: 'winner', kind: 'skipped', reason: NO_COLONY_AVAILABLE}]);
    });
  });

  describe('RX23 Mohole Contest — two steps of temperature, rewarded', () => {
    it('the temperature rises 2 steps, the bot gains 2 TR, the record measures the rating', () => {
      const t = seated(MOHOLE_CONTEST_ID, ({game}) => setTemperature(game, -10));
      botWinsTheVote(t);
      const tr = t.bot.terraformRating;
      throughTheSitting(t);
      expect(t.game.getTemperature()).eq(-6);
      expect(t.bot.terraformRating).eq(tr + 2);
      const [record] = botRecords(t);
      expect(record).deep.include({part: 'winner', kind: 'globalParameter', amount: 2, parameter: {id: 'temperature', before: -10, after: -6}, tr: 2});
      expect(record.step).eq(winnerParameterStepKey({kind: 'parameter', parameter: 'temperature', steps: 2}));
    });

    it('one step from the maximum → one step; at the maximum → the named ceiling', () => {
      const one = seated(MOHOLE_CONTEST_ID, ({game}) => setTemperature(game, 6));
      botWinsTheVote(one);
      throughTheSitting(one);
      expect(one.game.getTemperature()).eq(8);
      expect(botRecords(one)[0]).deep.include({kind: 'globalParameter', amount: 1, tr: 1});
      const full = seated(MOHOLE_CONTEST_ID, ({game}) => setTemperature(game, 8));
      botWinsTheVote(full);
      const tr = full.bot.terraformRating;
      throughTheSitting(full);
      expect(full.bot.terraformRating).eq(tr);
      expect(botRecords(full)[0]).deep.include({kind: 'skipped', amount: 0, reason: WINNER_STEP_AT_MAXIMUM_REASON.temperature});
    });
  });

  describe('RX20 Skyscrapers — a tier on the bot\'s OWN city', () => {
    it('with a city on Mars the bot stacks a tier on it (the effect\'s record, a stack of 2); the human below the line gets nothing', () => {
      const t = seated(SKYSCRAPERS_ID, ({bot}) => addCity(bot));
      botWinsTheVote(t);
      throughTheSitting(t);
      const [record] = botRecords(t);
      expect(record).deep.include({part: 'effect', kind: 'city', stackHeight: 2});
      expect(record.step).eq(tileGrantStepKey(REDUX_RESOLUTION_CATALOG.getOrThrow(SKYSCRAPERS_ID).tileGrant as never));
      expect(t.game.board.getSpaceOrThrow(record.space!).player?.id).eq(t.bot.id);
      const humanRecord = (t.parliament.lastPhase?.outcomes ?? []).find((o) => o.player === t.human.id);
      expect(humanRecord?.kind).eq('skipped');
    });

    it('no city of its own → a named skip', () => {
      const t = seated(SKYSCRAPERS_ID);
      botWinsTheVote(t);
      throughTheSitting(t);
      expect(botRecords(t)[0]).deep.include({part: 'effect', kind: 'skipped', reason: TILE_GRANT_NO_DESTINATION_REASON});
    });
  });

  describe('recovery', () => {
    it('a save at the ASSEMBLY gate resumes and pays the bot once; a save resumed INTO the effects again pays nothing twice', () => {
      const t = seated(AQUIFER_CONTEST_ID);
      botWinsTheVote(t);
      const oceans = t.game.board.getOceanSpaces().length;
      // Reload at the gate: the pass has not run.
      const live = Game.deserialize(structuredClone(t.game.serialize()));
      const parliament = live.parliament!;
      const human = live.getPlayerById(t.human.id) as TestPlayer;
      const bot = live.getPlayerById(t.bot.id);
      const resumed: Table = {game: live, human, bot, parliament};
      throughTheSitting(resumed);
      expect(live.board.getOceanSpaces().length).eq(oceans + 1);
      expect(botRecords(resumed)).has.length(1);
      // …and a second entry into the effects (a save whose cursor points there) finds the bot's key and pays nothing again.
      const serialized = structuredClone(live.serialize());
      const summary = parliament.lastPhase!;
      serialized.parliament!.phase = {
        generation: summary.generation, final: false, step: 'effects', applied: [`enact:${summary.generation}:${summary.enacted}`],
        appliedBySeat: {[bot.id]: [`effect:${summary.generation}:${summary.enacted}:ocean`], [human.id]: [`effect:${summary.generation}:${summary.enacted}:animals`]},
        summary, effects: {playerIndex: 0},
      };
      const again = Game.deserialize(serialized);
      expect(again.board.getOceanSpaces().length).eq(oceans + 1);
      const againBot = again.getPlayerById(bot.id);
      expect(againBot.terraformRating).eq(bot.terraformRating);
    });
  });

  describe('the final generation', () => {
    it('a bot winner in the FINAL sitting is paid its reward before the final greeneries', () => {
      const t = seated(BIODOME_CONTEST_ID, ({game, human}) => {
        setTemperature(game, 8);
        setOxygenLevel(game, 14);
        maxOutOceans(human);
        expect(game.gameIsOver()).is.true;
      });
      botWinsTheVote(t);
      const tr = t.bot.terraformRating;
      throughTheSitting(t);
      expect(t.parliament.lastPhase?.final).is.true;
      // The greenery lands at the oxygen maximum and pays its own TR — the reward is paid before the final greeneries.
      expect(t.bot.terraformRating).eq(tr + 1);
      expect(botRecords(t)[0]).deep.include({kind: 'greenery', part: 'winner', parameter: {id: 'oxygen', before: 14, after: 14}});
      expect(t.parliament.agendaOf(t.bot)).eq(1);
    });
  });
});
