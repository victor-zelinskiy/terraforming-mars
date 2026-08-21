import {expect} from 'chai';
import {HeadStart} from '../../../src/server/cards/promo/HeadStart';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
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
import {SelectProjectCardToPlay} from '../../../src/server/inputs/SelectProjectCardToPlay';

describe('HeadStartProbe', () => {
  let headStart: HeadStart;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    headStart = new HeadStart();
    [game, player, player2] = testGame(2, {preludeExtension: true});
  });

  function findOption(pi: OrOptions, title: string) {
    return pi.options.find((option) => String(option.title) === title);
  }

  /** Drive `p` until they stop being asked anything. Returns the log of prompts. */
  function drive(p: TestPlayer, preludeOrder: Array<string>, opts: {pass?: boolean} = {}) {
    const trace: Array<string> = [];
    let passed = false;
    for (let i = 0; i < 12; i++) {
      const [wf, cb] = p.popWaitingFor2();
      if (wf === undefined) {
        trace.push('(no prompt)');
        break;
      }
      if (wf instanceof SelectCard && String(wf.title) === 'Select prelude card to play') {
        const sel = wf as SelectCard<any>;
        const wanted = preludeOrder.shift();
        const pick = sel.cards.find((c: any) => c.name === wanted) ?? sel.cards[0];
        trace.push(`PRELUDE(${pick.name}) actions=${p.actionsTakenThisRound}`);
        sel.cb([pick]);
        cb?.();
        runAllActions(game);
        continue;
      }
      const or = cast(wf, OrOptions);
      trace.push(`ACTION-MENU actions=${p.actionsTakenThisRound} phase=${game.phase}`);
      if (opts.pass === true && !passed) {
        const pass = findOption(or, 'Pass for this generation');
        expect(pass, 'pass offered').not.eq(undefined);
        passed = true;
        trace.push('  -> PASS');
        pass!.cb(undefined);
        cb?.();
        runAllActions(game);
        continue;
      }
      const sell = findOption(or, 'Sell patents');
      if (sell === undefined) {
        trace.push('  (no sell patents; stopping)');
        break;
      }
      cast(sell, SelectCard).cb([p.cardsInHand[0]]);
      cb?.();
      runAllActions(game);
    }
    return trace;
  }

  it('PROBE B: head start played FIRST -> how many bonus actions?', () => {
    game.phase = Phase.PRELUDES;
    player.preludeCardsInHand = [headStart, new Loan()];
    player.cardsInHand = [new Ants(), new BactoviralResearch()];
    player2.preludeCardsInHand = [new Donation()];

    player.takeAction();
    const trace = drive(player, ['Head Start', 'Loan']);
    console.log('[B first]\n  ' + trace.join('\n  '));
    console.log('[B first] bonus action menus =', trace.filter((t) => t.startsWith('ACTION-MENU')).length, '(card promises 2)');
  });

  it('PROBE C: head start played SECOND -> how many bonus actions?', () => {
    game.phase = Phase.PRELUDES;
    player.preludeCardsInHand = [new Loan(), headStart];
    player.cardsInHand = [new Ants(), new BactoviralResearch()];
    player2.preludeCardsInHand = [new Donation()];

    player.takeAction();
    const trace = drive(player, ['Loan', 'Head Start']);
    console.log('[C second]\n  ' + trace.join('\n  '));
    console.log('[C second] bonus action menus =', trace.filter((t) => t.startsWith('ACTION-MENU')).length, '(card promises 2)');
  });

  it('PROBE D: passing during a head start bonus action corrupts generation 1', () => {
    game.phase = Phase.PRELUDES;
    player.preludeCardsInHand = [headStart, new Loan()];
    player.cardsInHand = [new Ants(), new BactoviralResearch()];
    player2.preludeCardsInHand = [new Donation()];

    player.takeAction();
    const trace = drive(player, ['Head Start', 'Loan'], {pass: true});
    console.log('[D]\n  ' + trace.join('\n  '));
    console.log('[D] passedPlayers after preludes =', JSON.stringify(game.getPassedPlayers()));
    console.log('[D] p1 preludes left =', player.preludeCardsInHand.map((c) => c.name));

    // Now let player 2 finish their prelude and see who gets the action phase.
    let p2trace: Array<string> = [];
    if (game.activePlayer === player2.id) {
      p2trace = drive(player2, ['Donation']);
    }
    console.log('[D] p2 trace:\n  ' + p2trace.join('\n  '));
    console.log('[D] FINAL phase =', game.phase, 'generation =', game.generation,
      'passed =', JSON.stringify(game.getPassedPlayers()),
      'p1 waiting for anything? ', player.getWaitingFor() !== undefined);
    void SelectProjectCardToPlay;
  });
});
