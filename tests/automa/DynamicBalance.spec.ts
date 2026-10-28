import {expect} from 'chai';
import {DifficultyLevel, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {DYNAMIC_BALANCE_WITHHELD, dynamicBalanceOn, withheldProjectCards} from '../../src/common/automa/DynamicBalance';
import {IGame} from '../../src/server/IGame';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {AutomaTestOptions, testAutomaGame} from './AutomaTestGame';

/**
 * «ДИНАМИЧЕСКИЙ БАЛАНС», the EARLY half (`common/automa/DynamicBalance.ts`, the owner
 * 2026-10-29): with the switch on, the bot's base deck fills gradually — 2 project
 * cards fewer in the 1st generation, 1 fewer in the 2nd and the 3rd, the full deck
 * from the 4th. The cards for the preludes, the bonus card and the recurring cards
 * stay. In a draft game the corporation's priority keeps the best of the drafted
 * cards. Off (the option absent): the rulebook's deck, unchanged.
 */

function options(difficulty: DifficultyLevel, on: boolean | undefined, extra: Partial<AutomaTestOptions> = {}): AutomaTestOptions {
  return {
    difficulty,
    automa: {difficulty, corporation: MarsBotCorpId.C01_CREDICOR, ...(on !== undefined ? {secondShift: on} : {})},
    ...extra,
  };
}

const projects = (game: IGame) => game.automa!.actionDeck.filter((e) => e.kind === 'project').length;
const bonuses = (game: IGame) => game.automa!.actionDeck.filter((e) => e.kind === 'bonus').length;

describe('DynamicBalance — the base deck fills gradually (early half)', () => {
  it('withholds 2 / 1 / 1 project cards in the 1st / 2nd / 3rd generation, none after; the switch is the one option', () => {
    expect(DYNAMIC_BALANCE_WITHHELD).deep.eq([2, 1, 1]);
    expect([1, 2, 3, 4, 5, 9].map(withheldProjectCards)).deep.eq([2, 1, 1, 0, 0, 0]);
    expect(dynamicBalanceOn({difficulty: 'hard', secondShift: true})).is.true;
    expect(dynamicBalanceOn({difficulty: 'hard'})).is.false;
    expect(dynamicBalanceOn(undefined)).is.false;
  });

  it('the 1st generation\'s deck: Hard 3 → 1 project card, the preludes\' 3 kept; bonus and recurring cards untouched', () => {
    const [off] = testAutomaGame(options('hard', undefined, {preludeExtension: true}), '-off');
    const [on] = testAutomaGame(options('hard', true, {preludeExtension: true}), '-on');
    expect(projects(off)).eq(6);
    expect(projects(on)).eq(4);
    expect(bonuses(on)).eq(bonuses(off));
    const [plain] = testAutomaGame(options('hard', true), '-plain');
    expect(projects(plain), 'no preludes: one project card').eq(1);
    const [brutal] = testAutomaGame(options('brutal', true), '-brutal');
    expect(projects(brutal), 'Brutal 4 → 2').eq(2);
  });

  it('a rebuilt deck (no draft): 2 in the 2nd and the 3rd generation, the full 3 from the 4th — off keeps 3 throughout', () => {
    for (const [generation, on, off] of [[2, 2, 3], [3, 2, 3], [4, 3, 3], [8, 3, 3]] as const) {
      const [withRule] = testAutomaGame(options('hard', true), `-n${generation}`);
      withRule.generation = generation;
      AutomaResearch.buildActionDeck(withRule);
      expect(projects(withRule), `gen ${generation} on`).eq(on);
      const [without] = testAutomaGame(options('hard', false), `-f${generation}`);
      without.generation = generation;
      AutomaResearch.buildActionDeck(without);
      expect(projects(without), `gen ${generation} off`).eq(off);
    }
  });

  it('a drafted deck: the rulebook\'s discard, then the corporation\'s priority keeps the best — Credicor the dearest', () => {
    const [game] = testAutomaGame(options('hard', true, {draftVariant: true}), '-draft');
    game.generation = 2;
    const drafted = game.projectDeck.drawN(game, 4);
    const dearest = Math.max(...drafted.map((c) => c.cost));
    const discardBefore = game.projectDeck.discardPile.length;
    const logBefore = game.gameLog.length;
    AutomaResearch.finishDraftedActionDeck(game, drafted);
    const kept = game.automa!.actionDeck.filter((e) => e.kind === 'project').map((e) => drafted.find((c) => c.name === (e as {name: string}).name)!);
    expect(kept.length, 'Hard keeps 3 of 4, the 2nd generation one fewer').eq(2);
    expect(Math.max(...kept.map((c) => c.cost)), 'the priority keeps the dearest').eq(dearest);
    expect(game.projectDeck.discardPile.length - discardBefore, 'the rest go to the discard pile').eq(2);
    // The trim itself is silent (hidden balance): it adds no journal line of its own.
    expect(game.gameLog.slice(logBefore).filter((m) => /dynamic|withheld|balance/i.test(m.message))).deep.eq([]);
  });

  it('a drafted deck with the switch OFF keeps the rulebook\'s 3', () => {
    const [game] = testAutomaGame(options('hard', false, {draftVariant: true}), '-draft-off');
    game.generation = 2;
    AutomaResearch.finishDraftedActionDeck(game, game.projectDeck.drawN(game, 4));
    expect(projects(game)).eq(3);
  });
});
