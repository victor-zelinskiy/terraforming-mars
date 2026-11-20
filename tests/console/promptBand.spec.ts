import {expect} from 'chai';
import {promptBandOf} from '../../src/client/console/promptBand';

/*
 * THE PAD's PROMPT BAND READS THE ONE FUNCTION (FREEZE ZERO, stage 2 ②): the surface the function names takes the
 * press and the others yield; where it names none that stands, the ladder's own order routes the press — and says so.
 */
describe('promptBand — who of the pad\'s prompt band takes a press', () => {
  // (The ladder asks its rungs in this order.)
  const LADDER = ['deckPick', 'start', 'effectDecision', 'taskHost'];

  function press(standing: ReadonlyArray<string>, word: string | (() => string)): {took: string, fellBack: Array<string>, asked: number} {
    const fellBack: Array<string> = [];
    let asked = 0;
    const stands = Object.fromEntries(LADDER.map((rung) => [rung, () => standing.includes(rung)]));
    const band = promptBandOf(stands, () => {
      asked++;
      return typeof word === 'function' ? word() : word;
    }, (w, rung) => fellBack.push(`${w}>${rung}`));
    const took = LADDER.find((rung) => band.takes(rung)) ?? '';
    return {took, fellBack, asked};
  }

  it('the surface the function names takes the press — whatever the ladder\'s order', () => {
    expect(press(['taskHost'], 'own:taskHost')).to.deep.eq({took: 'taskHost', fellBack: [], asked: 1});
    // TWO prompt surfaces stand: the order used to give it to the first; the function's word decides.
    expect(press(['start', 'taskHost'], 'own:taskHost')).to.deep.eq({took: 'taskHost', fellBack: [], asked: 1});
    expect(press(['start', 'taskHost'], 'own:start')).to.deep.eq({took: 'start', fellBack: [], asked: 1});
    expect(press(['deckPick', 'effectDecision', 'taskHost'], 'own:effectDecision').took).to.eq('effectDecision');
  });

  it('nothing of the band stands: nobody takes it, and the function is not even asked', () => {
    expect(press([], 'own:taskHost')).to.deep.eq({took: '', fellBack: [], asked: 0});
  });

  it('the function names no standing surface: the ladder\'s order routes the press, and says so', () => {
    // The owner waits / a workspace serves / nothing is asked — and a prompt surface stands all the same.
    expect(press(['start', 'taskHost'], 'held:admission')).to.deep.eq({took: 'start', fellBack: ['held:admission>start'], asked: 1});
    expect(press(['taskHost'], 'ws')).to.deep.eq({took: 'taskHost', fellBack: ['ws>taskHost'], asked: 1});
    expect(press(['taskHost'], 'free').fellBack).to.deep.eq(['free>taskHost']);
    // It names a surface that does NOT stand (or a rung that is not the band's): never a press into nothing.
    expect(press(['start'], 'own:taskHost')).to.deep.eq({took: 'start', fellBack: ['own:taskHost>start'], asked: 1});
    expect(press(['taskHost'], 'own:corpFirst')).to.deep.eq({took: 'taskHost', fellBack: ['own:corpFirst>taskHost'], asked: 1});
  });

  it('a function that throws never takes the pad away: the ladder routes, counted', () => {
    expect(press(['taskHost'], () => {
      throw new Error('a fact that could not be read');
    })).to.deep.eq({took: 'taskHost', fellBack: ['error>taskHost'], asked: 1});
  });

  it('one intent asks the function once, however many rungs stand', () => {
    const fellBack: Array<string> = [];
    let asked = 0;
    const band = promptBandOf({a: () => true, b: () => true, c: () => true}, () => {
      asked++;
      return 'own:c';
    }, (w, rung) => fellBack.push(`${w}>${rung}`));
    expect([band.takes('a'), band.takes('b'), band.takes('c')]).to.deep.eq([false, false, true]);
    expect(asked).to.eq(1);
    expect(fellBack).to.deep.eq([]);
  });
});
