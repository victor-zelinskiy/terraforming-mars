import {expect} from 'chai';
import {HeadStart, HEAD_START_BONUS_ACTIONS} from '../../../src/server/cards/promo/HeadStart';
import {TestPlayer} from '../../TestPlayer';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {testGame} from '../../TestGame';
import {IGame} from '../../../src/server/IGame';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {Phase} from '../../../src/common/Phase';
import {Ants} from '../../../src/server/cards/base/Ants';
import {BactoviralResearch} from '../../../src/server/cards/promo/BactoviralResearch';
import {Loan} from '../../../src/server/cards/prelude/Loan';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {Donation} from '../../../src/server/cards/prelude/Donation';
import {Inventrix} from '../../../src/server/cards/corporation/Inventrix';
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

  it('The play grants everything and executes NOTHING (the order is the player\'s)', () => {
    player.cardsInHand.push(fakeCard(), fakeCard(), fakeCard());
    headStart.play(player);
    // No resources moved: the official text lets the player take the actions
    // BEFORE the gains, so the gains wait as claims.
    expect(player.steel).eq(0);
    expect(player.megaCredits).eq(0);
    expect(player.bonusActions).eq(HEAD_START_BONUS_ACTIONS);
    expect(player.bonusActionsGranted).eq(HEAD_START_BONUS_ACTIONS);
    expect(player.bonusActionSource).eq(CardName.HEAD_START);
    expect(player.pendingBonusGains).deep.eq([{steel: 2}, {megacreditsPerCardInHand: 2}]);
  });

  it('The bonus menu carries CLAIM options, and the marker maps them structurally', () => {
    seat([headStart, new Loan()]);
    player.takeAction();

    const [prelude, preludeCb] = player.popWaitingFor2();
    cast(prelude, SelectCard).cb([headStart]);
    preludeCb?.();
    runAllActions(game);

    const menu = cast(player.getWaitingFor(), OrOptions);
    const titles = optionTitles(menu);
    expect(titles).to.include('Gain ${0} steel now');
    expect(titles).to.include('Gain ${0} M€ now');
    const gains = menu.bonusActionPrompt?.gains ?? [];
    expect(gains.map((g) => g.resource)).deep.eq(['steel', 'megacredits']);
    // 2 project cards in hand → 4 M€ at THIS moment.
    expect(gains.find((g) => g.resource === 'megacredits')?.amount).eq(4);
    // Every marker row points at the REAL option.
    for (const g of gains) {
      expect(titles[g.index]).to.match(/^Gain /);
    }
  });

  it('Claiming a gain costs NO action and re-presents the menu', () => {
    seat([headStart, new Loan()]);
    player.takeAction();

    const [prelude, preludeCb] = player.popWaitingFor2();
    cast(prelude, SelectCard).cb([headStart]);
    preludeCb?.();
    runAllActions(game);

    const [menu, menuCb] = player.popWaitingFor2();
    const or = cast(menu, OrOptions);
    const steelIndex = (or.bonusActionPrompt?.gains ?? []).find((g) => g.resource === 'steel')!.index;
    or.options[steelIndex].cb(undefined);
    menuCb?.();
    runAllActions(game);

    expect(player.steel, 'the steel arrived').eq(2);
    expect(player.bonusActions, 'no action was spent').eq(2);
    const next = cast(player.getWaitingFor(), OrOptions);
    // The claimed gain is gone; the other still stands.
    const gains = next.bonusActionPrompt?.gains ?? [];
    expect(gains.map((g) => g.resource)).deep.eq(['megacredits']);
  });

  it('The M€ gain is computed at CLAIM time, not at play time', () => {
    seat([headStart, new Loan()]);
    player.takeAction();

    const [prelude, preludeCb] = player.popWaitingFor2();
    cast(prelude, SelectCard).cb([headStart]);
    preludeCb?.();
    runAllActions(game);

    // Spend a bonus action on Sell patents — the hand shrinks by one.
    const [menu, menuCb] = player.popWaitingFor2();
    const sell = findOption(cast(menu, OrOptions), 'Sell patents');
    cast(sell, SelectCard).cb([player.cardsInHand[0]]);
    menuCb?.();
    runAllActions(game);

    // Claim the M€ NOW — one card left in hand → 2 M€, not the 4 of play time.
    const [menu2, menu2Cb] = player.popWaitingFor2();
    const or = cast(menu2, OrOptions);
    const mc = (or.bonusActionPrompt?.gains ?? []).find((g) => g.resource === 'megacredits')!;
    expect(mc.amount, 'the marker already shows the live value').eq(2);
    const before = player.megaCredits;
    or.options[mc.index].cb(undefined);
    menu2Cb?.();
    runAllActions(game);
    expect(player.megaCredits - before).eq(2);
  });

  it('Unclaimed gains AUTO-RESOLVE when the last bonus action is spent', () => {
    seat([headStart, new Loan()]);
    player.takeAction();
    const trace = driveTurn([CardName.HEAD_START, CardName.LOAN]);

    expect(trace).deep.eq(['prelude:Head Start', 'action:2', 'action:1', 'prelude:Loan']);
    // Both sells shrank the hand to 0 by the window's end → the M€ gain
    // resolves against THAT hand («claiming after» means after).
    expect(player.steel).eq(2);
    expect(player.pendingBonusGains).deep.eq([]);
    expect(player.bonusActions).eq(0);
  });

  it('THE CORP\'S MANDATORY FIRST ACTION NESTS AS BONUS ACTION 1 — and the gains ride its prompt too', () => {
    const corp = new Inventrix();
    seat([headStart, new Loan()]);
    player.pendingInitialActions.push(corp);

    player.takeAction();
    const [prelude, preludeCb] = player.popWaitingFor2();
    cast(prelude, SelectCard).cb([headStart]);
    preludeCb?.();
    runAllActions(game);

    // The FIRST prompt of the window is the corp's mandatory action…
    const corpPrompt = cast(player.getWaitingFor(), OrOptions);
    const titles = optionTitles(corpPrompt);
    expect(titles[0]).to.include('Take first action of');
    // …with no Pass, WITH the window's marker, WITH the claimable gains.
    expect(titles).to.not.include('Pass for this generation');
    expect(corpPrompt.bonusActionPrompt?.remaining).eq(2);
    expect((corpPrompt.bonusActionPrompt?.gains ?? []).length).eq(2);

    // Claiming a gain on the corp prompt costs nothing — the same prompt
    // returns, the mandatory action still owed.
    const [p1, cb1] = player.popWaitingFor2();
    const or1 = cast(p1, OrOptions);
    const steel = (or1.bonusActionPrompt?.gains ?? []).find((g) => g.resource === 'steel')!;
    or1.options[steel.index].cb(undefined);
    cb1?.();
    runAllActions(game);
    expect(player.steel).eq(2);
    expect(player.bonusActions).eq(2);
    expect(player.pendingInitialActions.length).eq(1);

    // Taking the corp action spends bonus 1 of 2.
    const [p2, cb2] = player.popWaitingFor2();
    const or2 = cast(p2, OrOptions);
    or2.options[0].cb(undefined);
    cb2?.();
    runAllActions(game);
    expect(player.bonusActions).eq(1);
    expect(player.pendingInitialActions.length).eq(0);

    // What stands now is the FREE bonus menu (2/2), still carrying the M€ claim.
    const menu = cast(player.getWaitingFor(), OrOptions);
    expect(menu.bonusActionPrompt?.remaining).eq(1);
    expect((menu.bonusActionPrompt?.gains ?? []).map((g) => g.resource)).deep.eq(['megacredits']);
  });

  it('Take 2 actions, as FIRST prelude', () => {
    seat([headStart, new Loan()]);
    expect(player.actionsTakenThisRound).eq(0);

    player.takeAction();
    const trace = driveTurn([CardName.HEAD_START, CardName.LOAN]);

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
    expect(menu.bonusActionPrompt?.source).eq(CardName.HEAD_START);
    expect(menu.bonusActionPrompt?.remaining).eq(2);
    expect(menu.bonusActionPrompt?.granted).eq(2);
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

  it('Bonus actions AND pending gains survive a save / load', () => {
    headStart.play(player);
    player.bonusActions = 1;

    const revived = Player.deserialize(player.serialize());

    expect(revived.bonusActions).eq(1);
    expect(revived.bonusActionsGranted).eq(HEAD_START_BONUS_ACTIONS);
    expect(revived.bonusActionSource).eq(CardName.HEAD_START);
    expect(revived.pendingBonusGains).deep.eq([{steel: 2}, {megacreditsPerCardInHand: 2}]);
  });

  it('A save made before bonus actions existed loads with none owed', () => {
    const serialized = player.serialize();
    delete (serialized as Partial<typeof serialized>).bonusActions;
    delete (serialized as Partial<typeof serialized>).bonusActionsGranted;
    delete (serialized as Partial<typeof serialized>).bonusActionSource;
    delete (serialized as Partial<typeof serialized>).pendingBonusGains;

    const revived = Player.deserialize(serialized);

    expect(revived.bonusActions).eq(0);
    expect(revived.hasBonusAction()).is.false;
    expect(revived.pendingBonusGains).deep.eq([]);
  });

  it('A normal action menu is untouched — Pass is still offered, no gain options', () => {
    game.phase = Phase.ACTION;
    const menu = player.getActions();
    expect(optionTitles(menu)).to.include('Pass for this generation');
    expect(optionTitles(menu).some((t) => t.startsWith('Gain '))).is.false;
  });

  it('Declares its bonus grant for the client (the start flow\'s chapter)', () => {
    expect(headStart.grantsBonusActions).eq(HEAD_START_BONUS_ACTIONS);
  });
});
