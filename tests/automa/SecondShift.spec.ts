import {expect} from 'chai';
import {DifficultyLevel, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {SECOND_SHIFT_CAP_LADDER, SECOND_SHIFT_LONG_MAP_BONUS, secondShiftCap, secondShiftLongMapBonus, secondShiftMaxCap, secondShiftRuleApplies} from '../../src/common/automa/SecondShift';
import {isLongMapForBot} from '../../src/common/automa/botPace';
import {BoardName} from '../../src/common/boards/BoardName';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {SecondShift} from '../../src/server/automa/SecondShift';
import {Server} from '../../src/server/models/ServerModel';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
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

/** The generation the scenario runs in — the ladder's 7–8 band (Easy 1 · Normal 1 · Hard 2 · Brutal 3). */
const GEN = 7;

/** A game in its action phase with the bot's deck already SPENT (the human's turn is up), in generation `GEN`. */
function spentDeckGame(options: AutomaTestOptions, idSuffix = '') {
  const [game, human, bot] = testAutomaGame(options, idSuffix);
  game.playerIsFinishedWithResearchPhase(human);
  game.generation = GEN;
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
  it('the cap is a LADDER of seven generation bands (1–4 · 5–6 · 7–8 · 9 · 10–12 · 13–15 · 16+): nothing early, Hard 1 / 2 / 3 / 4 / 4 / 5 after', () => {
    expect(SECOND_SHIFT_CAP_LADDER).deep.eq({easy: [0, 0, 1, 1, 2, 2, 3], normal: [0, 1, 1, 2, 3, 3, 4], hard: [0, 1, 2, 3, 4, 4, 5], brutal: [0, 2, 3, 4, 4, 4, 4]});
    const row = (gen: number) => [secondShiftCap('easy', gen), secondShiftCap('normal', gen), secondShiftCap('hard', gen), secondShiftCap('brutal', gen)];
    for (const gen of [1, 2, 3, 4]) {
      expect(row(gen), `gen ${gen} — the bot outlasts these anyway`).deep.eq([0, 0, 0, 0]);
    }
    for (const gen of [5, 6]) {
      expect(row(gen), `gen ${gen}`).deep.eq([0, 1, 1, 2]);
    }
    for (const gen of [7, 8]) {
      expect(row(gen), `gen ${gen}`).deep.eq([1, 1, 2, 3]);
    }
    expect(row(9), 'gen 9').deep.eq([1, 2, 3, 4]);
    for (const gen of [10, 11, 12]) {
      expect(row(gen), `gen ${gen}`).deep.eq([2, 3, 4, 4]);
    }
    // THE LONG GAME (2026-11-07, with Amazonis Planitia's longer parameters): two more bands — the bot that earned four
    // extra cards in the 10th generation earns no fewer in the 16th; Brutal stays at 4 (its +1 VP a card compounds).
    for (const gen of [13, 14, 15]) {
      expect(row(gen), `gen ${gen}`).deep.eq([2, 3, 4, 4]);
    }
    for (const gen of [16, 17, 22]) {
      expect(row(gen), `gen ${gen}`).deep.eq([3, 4, 5, 4]);
    }
    expect(secondShiftRuleApplies('easy')).is.true;
    expect([secondShiftMaxCap('easy'), secondShiftMaxCap('normal'), secondShiftMaxCap('hard'), secondShiftMaxCap('brutal')]).deep.eq([3, 4, 5, 4]);
  });

  it('a LONG map (a bot pace offset — Amazonis Planitia): Easy / Normal +1 in every active band, Hard / Brutal +1 in the 5th–6th and +2 from the 7th; the sleeping first band stays asleep (the owner, 2026-11-08)', () => {
    expect(SECOND_SHIFT_LONG_MAP_BONUS).deep.eq({easy: {first: 1, later: 1}, normal: {first: 1, later: 1}, hard: {first: 1, later: 2}, brutal: {first: 1, later: 2}});
    expect([0, 1, 2, 6].map((band) => secondShiftLongMapBonus('hard', band))).deep.eq([0, 1, 2, 2]);
    expect([0, 1, 2, 6].map((band) => secondShiftLongMapBonus('normal', band))).deep.eq([0, 1, 1, 1]);
    expect(isLongMapForBot(BoardName.AMAZONIS_PLANITIA)).is.true;
    expect(isLongMapForBot(BoardName.THARSIS)).is.false;
    expect(isLongMapForBot(BoardName.AMAZONIS), 'the FAN Amazonis is a standard-length map').is.false;
    const row = (gen: number) => [secondShiftCap('easy', gen, true), secondShiftCap('normal', gen, true), secondShiftCap('hard', gen, true), secondShiftCap('brutal', gen, true)];
    for (const gen of [1, 2, 3, 4]) {
      expect(row(gen), `gen ${gen} — still nothing early`).deep.eq([0, 0, 0, 0]);
    }
    for (const gen of [5, 6]) {
      expect(row(gen), `gen ${gen} — Easy's rung is 0 and stays 0`).deep.eq([0, 2, 2, 3]);
    }
    for (const gen of [7, 8]) {
      expect(row(gen), `gen ${gen} — Hard / Brutal +2 from here`).deep.eq([2, 2, 4, 5]);
    }
    expect(row(9)).deep.eq([2, 3, 5, 6]);
    expect(row(16)).deep.eq([4, 5, 7, 6]);
    expect([secondShiftMaxCap('easy', true), secondShiftMaxCap('normal', true), secondShiftMaxCap('hard', true), secondShiftMaxCap('brutal', true)]).deep.eq([4, 5, 7, 6]);
  });

  it('…read LIVE in the game: Hard on Amazonis Planitia offers two extra cards in the 5th generation and four in the 7th; Tharsis keeps one and two', () => {
    const amazonis = spentDeckGame({...shiftOptions('hard', true), boardName: BoardName.AMAZONIS_PLANITIA}, '-long-map');
    amazonis.game.generation = 4;
    expect(SecondShift.cap(amazonis.game), 'the sleeping band').eq(0);
    amazonis.game.generation = 5;
    expect(SecondShift.cap(amazonis.game)).eq(2);
    expect(SecondShift.offer(amazonis.game)).deep.eq({index: 1, cap: 2});
    amazonis.game.generation = 7;
    expect(SecondShift.cap(amazonis.game)).eq(4);
    amazonis.game.automa!.secondShift = {generation: 7, drawn: 2};
    expect(SecondShift.offer(amazonis.game), 'the third card the printed ladder would not have offered').deep.eq({index: 3, cap: 4});
    amazonis.game.automa!.secondShift = {generation: 7, drawn: 4};
    expect(SecondShift.offer(amazonis.game), 'the cap holds').is.undefined;
    const tharsis = spentDeckGame(shiftOptions('hard', true), '-standard-map');
    tharsis.game.generation = 5;
    expect(SecondShift.cap(tharsis.game)).eq(1);
    tharsis.game.generation = 7;
    expect(SecondShift.cap(tharsis.game)).eq(2);
  });

  it('the ladder is read LIVE from the game\'s generation — a game already under way takes it up without any migration', () => {
    const {game} = spentDeckGame(shiftOptions('hard', true));
    game.generation = 4;
    expect(SecondShift.cap(game)).eq(0);
    expect(SecondShift.offer(game), 'no extra card in the first four generations').is.undefined;
    game.generation = 5;
    expect(SecondShift.offer(game)).deep.eq({index: 1, cap: 1});
    game.generation = 9;
    // Two already drawn this generation: the 9th's rung of 3 offers the third.
    game.automa!.secondShift = {generation: 9, drawn: 2};
    expect(SecondShift.offer(game)).deep.eq({index: 3, cap: 3});
    game.generation = 10;
    expect(SecondShift.cap(game)).eq(4);
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
    expect(game.automa!.secondShift).deep.eq({generation: GEN, drawn: 1}); // the server's own count — never modelled
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
    expect(game.automa!.secondShift).deep.eq({generation: GEN, drawn: 1});
  });

  it('Hard draws two extra cards, then passes', () => {
    const {game, human} = spentDeckGame(shiftOptions('hard', true));
    humanEndsTurn(game, human);
    expect(game.automa!.secondShift).deep.eq({generation: GEN, drawn: 1});
    humanEndsTurn(game, human);
    expect(game.automa!.secondShift).deep.eq({generation: GEN, drawn: 2});
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
    game.generation = 6;
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
    game.generation = GEN;
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

  describe('the corporation\'s choice — two cards looked at, one kept, the other back ON TOP', () => {
    /** A cheap and a dear card off the real deck, laid as the pile's top two (`top` is the END of the pile). */
    function cheapAndDear(game: IGame): {cheap: IProjectCard, dear: IProjectCard} {
      const pile = game.projectDeck.drawPile;
      const cheap = pile.find((c) => c.cost <= 6)!;
      const dear = pile.find((c) => c.cost >= 25)!;
      expect(cheap, 'a cheap card in the deck').is.not.undefined;
      expect(dear, 'a dear card in the deck').is.not.undefined;
      pile.splice(pile.indexOf(cheap), 1);
      pile.splice(pile.indexOf(dear), 1);
      return {cheap, dear};
    }

    for (const order of ['cheap on top', 'dear on top'] as const) {
      it(`Credicor (most expensive) keeps the dear card — ${order}; the cheap one goes back on top; the deck shrinks by ONE`, () => {
        const {game} = spentDeckGame(shiftOptions('normal', true), order === 'cheap on top' ? '-c' : '-d');
        const {cheap, dear} = cheapAndDear(game);
        const pile = game.projectDeck.drawPile;
        if (order === 'cheap on top') {
          pile.push(dear, cheap);
        } else {
          pile.push(cheap, dear);
        }
        const before = pile.length;
        const discardBefore = game.projectDeck.discardPile.length;
        const stats = JSON.stringify(game.automa!.corpStats);
        const logLength = game.gameLog.length;

        expect(SecondShift.take(game)).is.true;

        expect(game.automa!.actionDeck).deep.eq([{kind: 'project', name: dear.name}]);
        expect(pile[pile.length - 1], 'the card the bot let go lies on top again').eq(cheap);
        expect(pile.length, 'one card left the deck, as with any draw').eq(before - 1);
        expect(game.projectDeck.discardPile.length, 'nothing discarded').eq(discardBefore);
        // Silent: no corp stat, no line — the table never learns the bot looked at two.
        expect(JSON.stringify(game.automa!.corpStats)).eq(stats);
        expect(game.gameLog.length).eq(logLength);
      });
    }

    it('the pick happens in the real turn too: the kept card is the one played', () => {
      const {game, human} = spentDeckGame(shiftOptions('normal', true));
      const {cheap, dear} = cheapAndDear(game);
      game.projectDeck.drawPile.push(dear, cheap);
      humanEndsTurn(game, human);
      expect(game.automa!.playedPile).deep.eq([dear.name]);
      expect(game.automa!.playedPile).not.includes(cheap.name);
    });

    it('the second card is never the pile\'s last — then the bot takes the top card as it lies (no reshuffle a one-card draw would not cause)', () => {
      const {game} = spentDeckGame(shiftOptions('normal', true));
      const deck = game.projectDeck;
      const {cheap, dear} = cheapAndDear(game);
      deck.discardPile.push(...deck.drawPile.splice(0));
      deck.drawPile.push(dear, cheap); // two cards: the second would be the last
      const discardBefore = deck.discardPile.length;

      expect(SecondShift.take(game)).is.true;

      expect(game.automa!.actionDeck).deep.eq([{kind: 'project', name: cheap.name}]);
      expect(deck.drawPile).deep.eq([dear]);
      expect(deck.discardPile.length, 'the discard was not reshuffled').eq(discardBefore);
    });
  });
});
