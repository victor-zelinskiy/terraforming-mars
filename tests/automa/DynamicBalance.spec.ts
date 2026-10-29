import {expect} from 'chai';
import {BonusCardId, DifficultyLevel, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {DYNAMIC_BALANCE_BONUS_SIDE, bonusSideCap, dynamicBalanceOn} from '../../src/common/automa/DynamicBalance';
import {IGame} from '../../src/server/IGame';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {AutomaActionCard} from '../../src/server/automa/AutomaState';
import {CardName} from '../../src/common/cards/CardName';
import {AutomaLobbying} from '../../src/server/automa/AutomaLobbying';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {COLONIZATION_FUNDING_ID} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {seatResolution} from '../parliament/parliamentArrange';
import {runAllActions} from '../TestingUtils';
import {AutomaTestOptions, testAutomaGame} from './AutomaTestGame';

/**
 * «ДИНАМИЧЕСКИЙ БАЛАНС», the EARLY half (`common/automa/DynamicBalance.ts`, the owner
 * 2026-10-29): with the switch on, the BONUS side of the bot's deck — the top card
 * of the bonus deck plus the recurring cards — fills gradually: at most 1 / 2 / 3
 * of its cards in the 1st / 2nd / 3rd generation, chosen by a shuffle, the whole
 * side from the 4th. The PROJECT cards — the random tags that make one start unlike
 * another — are never cut. A deferred top card goes back on top of the bonus deck;
 * a deferred recurring card sits the generation out; the corporation's own card is
 * always in. Off (the option absent): the rulebook's deck, unchanged.
 */

function options(difficulty: DifficultyLevel, on: boolean | undefined, extra: Partial<AutomaTestOptions> = {}): AutomaTestOptions {
  return {
    difficulty,
    automa: {difficulty, corporation: MarsBotCorpId.C01_CREDICOR, ...(on !== undefined ? {secondShift: on} : {})},
    ...extra,
  };
}

const projects = (game: IGame) => game.automa!.actionDeck.filter((e) => e.kind === 'project').length;
const bonusIds = (game: IGame) => game.automa!.actionDeck.flatMap((e) => e.kind === 'bonus' ? [e.id] : []);
const idOf = (e: AutomaActionCard | undefined) => e !== undefined && e.kind === 'bonus' ? e.id : undefined;

/** A game set for a rebuild in `generation`: a known bonus deck and recurring cards. */
function rebuildGame(on: boolean, generation: number, recurring: ReadonlyArray<BonusCardId>, seed = 0): IGame {
  const [game] = testAutomaGame({...options('hard', on), seed}, `-g${generation}-${seed}-${on}`);
  game.generation = generation;
  game.automa!.recurringBonusCards = [...recurring];
  game.automa!.setAsideBonusCards = [];
  return game;
}

describe('DynamicBalance — the bonus side of the deck fills gradually (early half)', () => {
  it('the schedule: 1 / 2 / 3 cards of the bonus side in the 1st / 2nd / 3rd generation, all of it from the 4th', () => {
    expect(DYNAMIC_BALANCE_BONUS_SIDE).deep.eq([1, 2, 3]);
    expect([1, 2, 3, 4, 9].map(bonusSideCap)).deep.eq([1, 2, 3, undefined, undefined]);
    expect(dynamicBalanceOn({difficulty: 'hard', secondShift: true})).is.true;
    expect(dynamicBalanceOn({difficulty: 'hard'})).is.false;
  });

  it('the 1st generation: every project card stays (variety), the bonus side is cut to ONE card', () => {
    const [off] = testAutomaGame(options('hard', undefined, {preludeExtension: true, venusNextExtension: true}), '-off');
    const [on] = testAutomaGame(options('hard', true, {preludeExtension: true, venusNextExtension: true}), '-on');
    expect(projects(on), 'the projects are never cut').eq(projects(off));
    expect(projects(on)).eq(6);
    expect(bonusIds(off), 'off: the top card + Government Intervention').has.length(2);
    expect(bonusIds(on), 'on: one of them').has.length(1);
  });

  it('a rebuild: 2 of 3 in the 2nd generation, 3 of 3 in the 3rd, the whole side from the 4th; off takes it all', () => {
    const recurring = [BonusCardId.B16_GOVERNMENT_INTERVENTION, BonusCardId.B19_SHIPPING_LINES];
    for (const [generation, expected] of [[2, 2], [3, 3], [4, 3], [7, 3]] as const) {
      const game = rebuildGame(true, generation, recurring);
      AutomaResearch.buildActionDeck(game);
      expect(bonusIds(game), `gen ${generation}`).has.length(expected);
      expect(projects(game), `gen ${generation}: the projects stay`).eq(3);
    }
    const off = rebuildGame(false, 2, recurring);
    AutomaResearch.buildActionDeck(off);
    expect(bonusIds(off)).has.length(3);
  });

  it('a deferred top card goes back ON TOP of the bonus deck — never discarded; the shuffle varies which card comes in', () => {
    const recurring = [BonusCardId.B16_GOVERNMENT_INTERVENTION, BonusCardId.B19_SHIPPING_LINES];
    let deferredOnce = false;
    let keptOnce = false;
    const firstIn = new Set<BonusCardId>();
    for (let seed = 0; seed < 12; seed++) {
      const game = rebuildGame(true, 1, recurring, seed / 12);
      const top = idOf(game.automa!.bonusDeck[0]);
      const size = game.automa!.bonusDeck.length;
      AutomaResearch.buildActionDeck(game);
      const ids = bonusIds(game);
      expect(ids).has.length(1);
      firstIn.add(ids[0]);
      if (ids.includes(top!)) {
        keptOnce = true;
        expect(game.automa!.bonusDeck.length, 'the top card was taken').eq(size - 1);
      } else {
        deferredOnce = true;
        expect(idOf(game.automa!.bonusDeck[0]), 'the top card waits on top').eq(top);
        expect(game.automa!.bonusDeck.length).eq(size);
        expect(game.automa!.bonusDiscard).not.includes(top);
      }
      expect(game.automa!.recurringBonusCards, 'a recurring card stays recurring').deep.eq(recurring);
    }
    expect(deferredOnce && keptOnce, 'both outcomes occur across seeds').is.true;
    expect(firstIn.size, 'different starts in different games').greaterThan(1);
  });

  it('the corporation\'s own card is always in and outside the count', () => {
    const game = rebuildGame(true, 1, [BonusCardId.B16_GOVERNMENT_INTERVENTION, BonusCardId.B23_RAPID_SPROUTING]);
    AutomaResearch.buildActionDeck(game);
    const ids = bonusIds(game);
    expect(ids).includes(BonusCardId.B23_RAPID_SPROUTING);
    expect(ids.filter((id) => id !== BonusCardId.B23_RAPID_SPROUTING)).has.length(1);
  });

  it('a drafted deck keeps the rulebook\'s project cards under the switch', () => {
    const [game] = testAutomaGame(options('hard', true, {draftVariant: true}), '-draft');
    game.generation = 2;
    AutomaResearch.finishDraftedActionDeck(game, game.projectDeck.drawN(game, 4));
    expect(projects(game)).eq(3);
  });
});

describe('DynamicBalance — Party Politics left out: its vote rides the mandate, the lobby is spent', () => {
  it('the deck builder marks the generation whose deck left Party Politics out — and only that one', () => {
    let deferred = 0;
    let kept = 0;
    for (let seed = 0; seed < 12; seed++) {
      const game = rebuildGame(true, 1, [BonusCardId.B21_PARTY_POLITICS, BonusCardId.B16_GOVERNMENT_INTERVENTION], seed / 12);
      AutomaResearch.buildActionDeck(game);
      if (bonusIds(game).includes(BonusCardId.B21_PARTY_POLITICS)) {
        kept++;
        expect(game.automa!.partyPoliticsDeferred).is.undefined;
      } else {
        deferred++;
        expect(game.automa!.partyPoliticsDeferred).eq(1);
      }
    }
    expect(deferred > 0 && kept > 0, 'both outcomes occur across seeds').is.true;
  });

  /** A Redux table with the bot seated in politics: three resolutions up, no delegate on them. */
  function reduxTable(seed = 0) {
    const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics', seed});
    const parliament = game.parliament!;
    game.playerIsFinishedWithResearchPhase(human);
    seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
    seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
    seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
    parliament.slots.forEach((slot) => (slot.votes = []));
    return {game, human, bot, parliament};
  }

  it('the mandate drawn in that generation carries ONE more delegate — the card\'s vote, not lost', () => {
    const {game} = reduxTable();
    game.automa!.partyPoliticsDeferred = game.generation;
    game.automa!.lobbyMandate = undefined;
    expect(AutomaLobbying.mandateOf(game).carries).eq(1);
    const other = reduxTable(0.5).game;
    other.automa!.partyPoliticsDeferred = other.generation - 1;
    other.automa!.lobbyMandate = undefined;
    expect(AutomaLobbying.mandateOf(other).carries, 'a mark of another generation carries nothing').is.undefined;
  });

  it('an EMPTY mandate that carries the vote still spends the lobby\'s free delegate — without the carry the lobby stays', () => {
    for (const carries of [1, 0]) {
      const {game, human, bot, parliament} = reduxTable(carries === 1 ? 0.1 : 0.2);
      game.automa!.lobbyMandate = {generation: game.generation, card: 0, ...(carries > 0 ? {carries} : {}), sent: 0};
      expect(parliament.lobby.has(bot.id), 'the lobby holds the bot\'s free delegate').is.true;
      // The bot's last card this generation, its cost not divisible by 3 — only the mandate can send a delegate.
      game.automa!.actionDeck = [{kind: 'project', name: CardName.POWER_PLANT}];
      human.popWaitingFor();
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      if (carries === 1) {
        expect(parliament.lobby.has(bot.id), 'the carried vote spends the lobby').is.false;
        expect(game.automa!.lobbyMandate!.sent).eq(1);
      } else {
        expect(parliament.lobby.has(bot.id), 'no vote at all — the very gap the carry closes').is.true;
      }
    }
  });
});
