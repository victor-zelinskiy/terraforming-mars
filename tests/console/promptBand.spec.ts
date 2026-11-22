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

  /*
   * THE ROOTS STAND BY THEIR FRAMES (the whole e2e suite's reading, 2026-11-22: every «fallback» press was «free» →
   * the opening / the draft). Where the function names nobody that stands, the press is the player's where they
   * stand — the topmost workspace root on the stack — and that is the stack's word, not the ladder's order.
   */
  describe('where the function names nobody: the stack\'s topmost root takes the press — no fallback', () => {
    const rooted = (standing: ReadonlyArray<string>, word: string, root: string) => {
      const fellBack: Array<string> = [];
      const stands = Object.fromEntries(['deckPick', 'draft', 'externalDraw', 'start', 'taskHost'].map((rung) => [rung, () => standing.includes(rung)]));
      const band = promptBandOf(stands, () => word, (w, rung) => fellBack.push(`${w}>${rung}`), () => root);
      const took = ['deckPick', 'draft', 'externalDraw', 'start', 'taskHost'].find((rung) => band.takes(rung)) ?? '';
      return {took, fellBack};
    };

    it('nothing is asked and the opening stands: the press is the opening\'s, by the stack', () => {
      expect(rooted(['start'], 'free', 'start')).to.deep.eq({took: 'start', fellBack: []});
      expect(rooted(['start'], 'held:admission', 'start')).to.deep.eq({took: 'start', fellBack: []});
    });

    it('two roots stand: the TOPMOST takes it — the other yields, whatever the ladder\'s order', () => {
      // (The ladder asks the draft before the opening; the stack says the opening is on top.)
      expect(rooted(['draft', 'start'], 'free', 'start')).to.deep.eq({took: 'start', fellBack: []});
      expect(rooted(['draft', 'start'], 'free', 'draft')).to.deep.eq({took: 'draft', fellBack: []});
    });

    it('the function\'s own word comes first: a surface it names and that stands takes the press over any root', () => {
      expect(rooted(['deckPick', 'start'], 'own:deckPick', 'start')).to.deep.eq({took: 'deckPick', fellBack: []});
    });

    it('a root the stack names that does NOT stand (it yielded its pad) is nobody: the ladder\'s order, counted', () => {
      expect(rooted(['taskHost'], 'free', 'start')).to.deep.eq({took: 'taskHost', fellBack: ['free>taskHost']});
      expect(rooted(['draft'], 'free', '')).to.deep.eq({took: 'draft', fellBack: ['free>draft']});
    });

    it('a function that throws never reads the stack: the ladder as it was', () => {
      const fellBack: Array<string> = [];
      const band = promptBandOf({start: () => true}, () => {
        throw new Error('the facts could not be read');
      }, (w, rung) => fellBack.push(`${w}>${rung}`), () => 'start');
      expect(band.takes('start')).to.eq(true);
      expect(fellBack).to.deep.eq(['error>start']);
    });
  });
});
