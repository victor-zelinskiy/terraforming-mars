import {expect} from 'chai';
import {HeadStart, HEAD_START_BONUS_ACTIONS} from '../../../src/server/cards/promo/HeadStart';
import {TestPlayer} from '../../TestPlayer';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {testGame} from '../../TestGame';
import {Units} from '../../../src/common/Units';
import {IGame} from '../../../src/server/IGame';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {Phase} from '../../../src/common/Phase';
import {Ants} from '../../../src/server/cards/base/Ants';
import {BactoviralResearch} from '../../../src/server/cards/promo/BactoviralResearch';
import {Loan} from '../../../src/server/cards/prelude/Loan';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {Donation} from '../../../src/server/cards/prelude/Donation';
import {Player} from '../../../src/server/Player';
import {CardName} from '../../../src/common/cards/CardName';

describe('HeadStart', () => {
  let headStart: HeadStart;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    headStart = new HeadStart();
    [game, player, player2] = testGame(2, {preludeExtension: true});
  });

  function optionTitles(pi: OrOptions): Array<string> {
    return pi.options.map((o) => String(typeof o.title === 'string' ? o.title : o.title.message));
  }

  function findOption(pi: OrOptions, title: string) {
    return pi.options.find((o) => optionTitles(pi)[pi.options.indexOf(o)] === title);
  }

  /**
   * Drive the viewer's prelude turn to completion, taking `Sell patents` for
   * every ACTION MENU it is offered. Returns the ordered trace of prompts, so
   * a spec asserts on the SHAPE of the turn rather than on one snapshot.
   */
  function driveTurn(preludeOrder: Array<CardName>): Array<string> {
    const trace: Array<string> = [];
    for (let i = 0; i < 12; i++) {
      const [waitingFor, cb] = player.popWaitingFor2();
      if (waitingFor === undefined) {
        break;
      }
      if (waitingFor instanceof SelectCard && String(waitingFor.title) === 'Select prelude card to play') {
        const select = waitingFor as SelectCard<any>;
        const wanted = preludeOrder.shift();
        const pick = select.cards.find((c: any) => c.name === wanted) ?? select.cards[0];
        trace.push(`prelude:${pick.name}`);
        select.cb([pick]);
        cb?.();
        runAllActions(game);
        continue;
      }
      const menu = cast(waitingFor, OrOptions);
      trace.push(`action:${player.bonusActions}`);
      const sell = findOption(menu, 'Sell patents');
      expect(sell, `sell patents offered (${optionTitles(menu).join(' | ')})`).not.eq(undefined);
      cast(sell, SelectCard).cb([player.cardsInHand[0]]);
      cb?.();
      runAllActions(game);
    }
    return trace;
  }

  /** Seat the viewer with `preludes` in hand and two project cards. */
  function seat(preludes: Array<any>) {
    game.phase = Phase.PRELUDES;
    player.preludeCardsInHand = preludes;
    player.cardsInHand = [new Ants(), new BactoviralResearch()];
    player2.preludeCardsInHand = [new Donation()];
  }

  it('Gain resources', () => {
    player.cardsInHand.push(fakeCard(), fakeCard(), fakeCard());
    headStart.play(player);
    expect(player.stock.asUnits()).deep.eq(Units.of({megacredits: 6, steel: 2}));
  });

  it('Grants exactly 2 bonus actions, attributed to the card', () => {
    headStart.play(player);
    expect(player.bonusActions).eq(HEAD_START_BONUS_ACTIONS);
    expect(player.bonusActionsGranted).eq(HEAD_START_BONUS_ACTIONS);
    expect(player.bonusActionSource).eq(CardName.HEAD_START);
    expect(player.hasBonusAction()).is.true;
  });

  it('Take 2 actions, as FIRST prelude', () => {
    seat([headStart, new Loan()]);
    expect(player.actionsTakenThisRound).eq(0);

    player.takeAction();
    const trace = driveTurn([CardName.HEAD_START, CardName.LOAN]);

    // Head Start, both bonus actions (2 owed, then 1 owed), the other prelude.
    expect(trace).deep.eq(['prelude:Head Start', 'action:2', 'action:1', 'prelude:Loan']);
    expect(player.bonusActions).eq(0);
    expect(game.activePlayer.id).eq(player2.id);
  });

  it('Take 2 actions, as SECOND prelude', () => {
    seat([new Loan(), headStart]);

    player.takeAction();
    const trace = driveTurn([CardName.LOAN, CardName.HEAD_START]);

    expect(trace).deep.eq(['prelude:Loan', 'prelude:Head Start', 'action:2', 'action:1']);
    expect(player.bonusActions).eq(0);
    expect(game.activePlayer.id).eq(player2.id);
  });

  it('Bonus actions never spend the turn\'s own action slots', () => {
    seat([headStart, new Loan()]);
    player.takeAction();

    // The prelude itself counted (this engine counts prelude plays), the two
    // bonus actions must not.
    const [prelude, preludeCb] = player.popWaitingFor2();
    cast(prelude, SelectCard).cb([headStart]);
    preludeCb?.();
    runAllActions(game);
    const afterPrelude = player.actionsTakenThisRound;

    const [menu, menuCb] = player.popWaitingFor2();
    const sell = findOption(cast(menu, OrOptions), 'Sell patents');
    cast(sell, SelectCard).cb([player.cardsInHand[0]]);
    menuCb?.();
    runAllActions(game);

    expect(player.actionsTakenThisRound).eq(afterPrelude);
    expect(player.bonusActions).eq(1);
  });

  it('The bonus action menu offers neither Pass nor End Turn, and says so structurally', () => {
    seat([headStart, new Loan()]);
    player.takeAction();

    const [prelude, preludeCb] = player.popWaitingFor2();
    cast(prelude, SelectCard).cb([headStart]);
    preludeCb?.();
    runAllActions(game);

    const menu = cast(player.getWaitingFor(), OrOptions);
    const titles = optionTitles(menu);
    expect(titles, titles.join(' | ')).to.not.include('Pass for this generation');
    expect(titles, titles.join(' | ')).to.not.include('End Turn');
    // …and the client is told WHY, structurally — never by reading the title.
    expect(menu.bonusActionPrompt).deep.eq({
      source: CardName.HEAD_START,
      remaining: 2,
      granted: 2,
    });
    // The menu keeps the normal action-menu title so every client surface that
    // classifies an action menu keeps classifying it as one.
    expect(String(menu.title)).eq('Take your first action');
  });

  it('The player can no longer pass out of the prelude phase (issue #5852)', () => {
    seat([headStart, new Loan()]);
    player.takeAction();
    driveTurn([CardName.HEAD_START, CardName.LOAN]);

    expect(game.getPassedPlayers()).deep.eq([]);
    expect(player.preludeCardsInHand).deep.eq([]);
    expect(game.phase).eq(Phase.PRELUDES);
  });

  it('Bonus actions survive a save / load', () => {
    headStart.play(player);
    player.bonusActions = 1;

    const revived = Player.deserialize(player.serialize());

    expect(revived.bonusActions).eq(1);
    expect(revived.bonusActionsGranted).eq(HEAD_START_BONUS_ACTIONS);
    expect(revived.bonusActionSource).eq(CardName.HEAD_START);
  });

  it('A save made before bonus actions existed loads with none owed', () => {
    const serialized = player.serialize();
    delete (serialized as Partial<typeof serialized>).bonusActions;
    delete (serialized as Partial<typeof serialized>).bonusActionsGranted;
    delete (serialized as Partial<typeof serialized>).bonusActionSource;

    const revived = Player.deserialize(serialized);

    expect(revived.bonusActions).eq(0);
    expect(revived.hasBonusAction()).is.false;
  });

  it('A normal action menu is untouched — Pass is still offered', () => {
    game.phase = Phase.ACTION;
    const menu = player.getActions();
    expect(optionTitles(menu)).to.include('Pass for this generation');
  });
});
