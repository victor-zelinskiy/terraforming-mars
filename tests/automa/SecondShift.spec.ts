import {expect} from 'chai';
import {DifficultyLevel, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {SECOND_SHIFT_CAP, SECOND_SHIFT_CAP_LADDER, secondShiftCap, secondShiftMaxCap, secondShiftRuleApplies} from '../../src/common/automa/SecondShift';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {SecondShift} from '../../src/server/automa/SecondShift';
import {Server} from '../../src/server/models/ServerModel';
import {TestPlayer} from '../TestPlayer';
import {AutomaTestOptions, testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

/**
 * «ВТОРАЯ СМЕНА» — the bot's late-game pace rule (`common/automa/SecondShift.ts`,
 * docs/claude/marsbot-second-shift.md): while at least one player is still
 * acting in the generation, a bot whose action deck ran out draws an extra
 * project card instead of passing — up to the difficulty's cap per generation.
 * The option is OFF when absent (every pre-rule save and spec unchanged), and
 * the rule is HIDDEN balance (the owner, 2026-10-28): the extra card is never
 * announced — no journal line of its own, no turn step, no counter in the model.
 */

/** The automa options with the rule set as asked (absent = the engine's default, off). */
function shiftOptions(difficulty: DifficultyLevel, secondShift?: boolean): AutomaTestOptions {
  return {
    difficulty,
    automa: {difficulty, corporation: MarsBotCorpId.C01_CREDICOR, ...(secondShift !== undefined ? {secondShift} : {})},
  };
}

/** A game in its action phase with the bot's deck already SPENT (the human's turn is up). */
function spentDeckGame(options: AutomaTestOptions, idSuffix = '') {
  const [game, human, bot] = testAutomaGame(options, idSuffix);
  game.playerIsFinishedWithResearchPhase(human);
  game.automa!.actionDeck = [];
  return {game, human, bot};
}

/** The human ends a turn WITHOUT passing — the bot's turn follows at once. */
function humanEndsTurn(game: IGame, human: TestPlayer): void {
  human.popWaitingFor();
  game.playerIsFinishedTakingActions();
}

function lastTurnKinds(game: IGame): Array<string> {
  return game.automa!.lastTurn!.steps.map((s) => s.kind);
}

/** The journal never names the extra card — the ONLY line about it is the ordinary «played». */
function expectNothingAnnounced(game: IGame): void {
  expect(lastTurnKinds(game)).not.includes('second-shift');
  expect(game.gameLog.some((m) => /extra card|stays in the round|second shift/i.test(m.message))).is.false;
  expect(Server.getGameModel(game).automa).to.not.have.property('secondShift');
}

describe('SecondShift — «вторая смена», the bot\'s late-game pace rule (hidden balance)', () => {
  it('the cap is a LADDER by difficulty and generation: a base, a step from the 7th, another from the 10th; Brutal stays at 4, Easy starts at the 7th', () => {
    expect(SECOND_SHIFT_CAP_LADDER).deep.eq({easy: [0, 1, 1], normal: [1, 1, 2], hard: [2, 3, 4], brutal: [3, 4, 4]});
    expect(SECOND_SHIFT_CAP).deep.eq({easy: 0, normal: 1, hard: 2, brutal: 3});
    for (const gen of [1, 4, 6]) {
      expect([secondShiftCap('easy', gen), secondShiftCap('normal', gen), secondShiftCap('hard', gen), secondShiftCap('brutal', gen)], `gen ${gen}`).deep.eq([0, 1, 2, 3]);
    }
    for (const gen of [7, 8, 9]) {
      expect([secondShiftCap('easy', gen), secondShiftCap('normal', gen), secondShiftCap('hard', gen), secondShiftCap('brutal', gen)], `gen ${gen}`).deep.eq([1, 1, 3, 4]);
    }
    for (const gen of [10, 11, 14]) {
      expect([secondShiftCap('easy', gen), secondShiftCap('normal', gen), secondShiftCap('hard', gen), secondShiftCap('brutal', gen)], `gen ${gen}`).deep.eq([1, 2, 4, 4]);
    }
    expect(secondShiftRuleApplies('easy')).is.true; // its one card from the 7th generation — the switch means something on Easy too
    expect(secondShiftRuleApplies('normal')).is.true;
    expect([secondShiftMaxCap('easy'), secondShiftMaxCap('normal'), secondShiftMaxCap('hard'), secondShiftMaxCap('brutal')]).deep.eq([1, 2, 4, 4]);
  });

  it('the ladder is read LIVE from the game\'s generation — a game already under way takes it up without any migration', () => {
    const {game} = spentDeckGame(shiftOptions('hard', true));
    expect(SecondShift.cap(game)).eq(2);
    game.generation = 7;
    expect(SecondShift.cap(game)).eq(3);
    expect(SecondShift.offer(game)).deep.eq({index: 1, cap: 3});
    // Two already drawn this generation under the old cap of 2: the new rung offers the third.
    game.automa!.secondShift = {generation: 7, drawn: 2};
    expect(SecondShift.offer(game)).deep.eq({index: 3, cap: 3});
    game.generation = 10;
    expect(SecondShift.cap(game)).eq(4);
    const normal = spentDeckGame(shiftOptions('normal', true), '-n').game;
    normal.generation = 10;
    expect(SecondShift.cap(normal)).eq(2);
    const brutal = spentDeckGame(shiftOptions('brutal', true), '-b').game;
    brutal.generation = 12;
    expect(SecondShift.cap(brutal)).eq(4);
  });

  it('OFF when the option is absent: an empty deck is a pass, as the rulebook says', () => {
    const {game, human} = spentDeckGame(shiftOptions('normal'));
    expect(SecondShift.enabled(game)).is.false;
    expect(SecondShift.offer(game)).is.undefined;
    humanEndsTurn(game, human);
    expect(lastTurnKinds(game)).includes('pass');
    expect(game.automa!.secondShift).is.undefined;
    expect(game.automa!.playedPile).is.empty;
    expectNothingAnnounced(game);
  });

  it('ON, a player still acting, the deck spent: the bot draws an extra card and resolves it as any other — and tells nobody', () => {
    const {game, human} = spentDeckGame(shiftOptions('normal', true));
    expect(SecondShift.offer(game)).deep.eq({index: 1, cap: 1});

    humanEndsTurn(game, human);

    const kinds = lastTurnKinds(game);
    expect(kinds[0]).eq('reveal'); // the ordinary project turn, from its first step
    expect(kinds).not.includes('pass');
    expect(game.automa!.playedPile).has.length(1); // the extra card went the ordinary way
    expect(game.automa!.secondShift).deep.eq({generation: 1, drawn: 1}); // the server's own count — never modelled
    expect(game.gameLog.some((m) => m.message === '${0} played ${1}')).is.true; // the ordinary line is the only one
    expectNothingAnnounced(game);
  });

  it('the cap is PER GENERATION: Normal\'s one card spent, the next empty deck is a pass', () => {
    const {game, human} = spentDeckGame(shiftOptions('normal', true));
    humanEndsTurn(game, human);
    expect(game.automa!.playedPile).has.length(1);
    expect(game.automa!.actionDeck).is.empty;
    expect(SecondShift.offer(game)).is.undefined;

    humanEndsTurn(game, human);
    expect(lastTurnKinds(game)).includes('pass');
    expect(game.automa!.playedPile).has.length(1);
    expect(game.automa!.secondShift).deep.eq({generation: 1, drawn: 1});
  });

  it('Hard draws two extra cards, then passes', () => {
    const {game, human} = spentDeckGame(shiftOptions('hard', true));
    humanEndsTurn(game, human);
    expect(game.automa!.secondShift).deep.eq({generation: 1, drawn: 1});
    humanEndsTurn(game, human);
    expect(game.automa!.secondShift).deep.eq({generation: 1, drawn: 2});
    expect(game.automa!.playedPile).has.length(2);
    humanEndsTurn(game, human);
    expect(lastTurnKinds(game)).includes('pass');
    expect(game.automa!.playedPile).has.length(2);
    expectNothingAnnounced(game);
  });

  it('Brutal caps at three', () => {
    const {game} = spentDeckGame(shiftOptions('brutal', true));
    expect(SecondShift.cap(game)).eq(3);
    expect(SecondShift.offer(game)).deep.eq({index: 1, cap: 3});
  });

  it('Easy: nothing before the 7th generation (a pass), one extra card from the 7th on', () => {
    const {game, human} = spentDeckGame(shiftOptions('easy', true));
    expect(SecondShift.enabled(game)).is.true;
    expect(SecondShift.cap(game)).eq(0);
    expect(SecondShift.offer(game)).is.undefined;
    humanEndsTurn(game, human);
    expect(lastTurnKinds(game)).includes('pass');
    expect(game.automa!.playedPile).is.empty;
    game.generation = 7;
    expect(SecondShift.cap(game)).eq(1);
    expect(SecondShift.offer(game)).deep.eq({index: 1, cap: 1});
  });

  it('nobody still acting: the player passed first, so the bot passes too (the rule is for a generation the players outlast)', () => {
    const {game, human} = spentDeckGame(shiftOptions('normal', true));
    human.popWaitingFor();
    game.playerHasPassed(human);
    expect(SecondShift.playersStillActing(game)).eq(0);
    expect(SecondShift.offer(game)).is.undefined;
    game.playerIsFinishedTakingActions();
    expect(lastTurnKinds(game)).includes('pass');
    expect(game.automa!.secondShift).is.undefined;
    expect(game.automa!.playedPile).is.empty;
  });

  it('a previous generation\'s count does not carry over', () => {
    const {game} = spentDeckGame(shiftOptions('normal', true));
    game.automa!.secondShift = {generation: 0, drawn: 1};
    expect(SecondShift.drawn(game)).eq(0);
    expect(SecondShift.offer(game)).deep.eq({index: 1, cap: 1});
  });

  it('with a deck still holding cards there is no offer', () => {
    const {game} = spentDeckGame(shiftOptions('normal', true));
    game.automa!.actionDeck = [{kind: 'project', name: 'Gene Repair' as never}];
    expect(SecondShift.offer(game)).is.undefined;
  });

  it('multiplayer: ONE player still acting is enough; every player passed is none', () => {
    const [game, humans] = testAutomaMultiplayerGame(2, shiftOptions('normal', true));
    game.automa!.actionDeck = [];
    expect(SecondShift.playersStillActing(game)).eq(2);
    game.playerHasPassed(humans[0]);
    expect(SecondShift.playersStillActing(game)).eq(1);
    expect(SecondShift.offer(game)).deep.eq({index: 1, cap: 1});
    game.playerHasPassed(humans[1]);
    expect(SecondShift.playersStillActing(game)).eq(0);
    expect(SecondShift.offer(game)).is.undefined;
  });

  it('the counter round-trips through the save; a save without it restores as none', () => {
    const [game] = testAutomaGame(shiftOptions('hard', true));
    game.automa!.secondShift = {generation: 3, drawn: 2};
    const restored = Game.deserialize(structuredClone(game.serialize()));
    expect(restored.automa!.secondShift).deep.eq({generation: 3, drawn: 2});
    expect(restored.gameOptions.automa?.secondShift).is.true;

    const serialized = structuredClone(game.serialize()) as any;
    delete serialized.automa.secondShift;
    expect(Game.deserialize(serialized).automa!.secondShift).is.undefined;
  });
});
