import {expect} from 'chai';
import {
  OSCILLATION_LOOKS, OSCILLATION_REST, OscillationSample, OscillationState, OscillationVerdict, observeOscillation,
} from '../../src/client/console/livenessOscillation';

/**
 * A SCREEN THAT MOVES AND GOES NOWHERE (docs/claude/console/freeze-zero/PLAN.md §4 —
 * `src/client/console/livenessOscillation.ts`).
 *
 * The liveness arbiter's progress is «the picture moved» — so a screen that flips between the same few states by
 * itself (a modal that blinks, a frame that opens and folds in a loop) is «progress» every second, for ever: no
 * stall, no rung, no last line, and a player who cannot answer. This is the judge of that loop, look by look.
 */
describe('liveness · a screen that moves and goes nowhere', () => {
  type Look = Partial<OscillationSample> & {signature: string};
  /** Walk the looks; return every verdict. */
  function walk(looks: ReadonlyArray<Look>): Array<OscillationVerdict> {
    let state: OscillationState = OSCILLATION_REST;
    return looks.map((look) => {
      const step = observeOscillation(state, {promptLive: true, question: 'card#12', inputs: 0, ...look});
      state = step.state;
      return step.verdict;
    });
  }
  const blink = (n: number, extra: Partial<OscillationSample> = {}): Array<Look> =>
    Array.from({length: n}, (_, i) => ({signature: i % 2 === 0 ? 'modal' : 'board', ...extra}));
  const firstLoopAt = (verdicts: ReadonlyArray<OscillationVerdict>) => verdicts.findIndex((v) => v.oscillating);

  it('A BLINKING MODAL under a live question, untouched: named once the spell has stood its looks', () => {
    const verdicts = walk(blink(14));
    expect(firstLoopAt(verdicts), 'not before the spell is whole').to.eq(OSCILLATION_LOOKS - 1);
    const named = verdicts[OSCILLATION_LOOKS - 1];
    expect(named).to.deep.include({oscillating: true, first: true, looks: OSCILLATION_LOOKS});
    expect((named as {states: ReadonlyArray<string>}).states, 'the pictures it turns between').to.deep.eq(['modal', 'board']);
    // …and it is ONE fact while it lasts: the next looks confirm, they do not say it again.
    expect(verdicts.slice(OSCILLATION_LOOKS).every((v) => v.oscillating && !v.first)).to.eq(true);
  });

  it('a loop of THREE states is a loop too (a frame opens, commits, folds — and opens again)', () => {
    const turn = ['open', 'committed', 'folded'];
    expect(firstLoopAt(walk(Array.from({length: 12}, (_, i) => ({signature: turn[i % 3]}))))).to.eq(OSCILLATION_LOOKS - 1);
  });

  it('THE PLAYER\'S OWN HAND is never a loop — a thumb walking ← → flips the focus between two pictures', () => {
    // Every look comes after a press: the count of inputs moved each time.
    const verdicts = walk(Array.from({length: 30}, (_, i) => ({signature: i % 2 === 0 ? 'focus:left' : 'focus:right', inputs: i})));
    expect(firstLoopAt(verdicts)).to.eq(-1);
    // …and ONE press in the middle of a real loop starts the spell over: ten untouched looks are owed again.
    const pressed = walk([...blink(8), ...blink(12, {inputs: 1})]);
    expect(firstLoopAt(pressed), 'eight looks before the press do not count').to.eq(8 + OSCILLATION_LOOKS - 1);
  });

  it('a CINEMATIC is not a loop — it passes through its pictures once', () => {
    expect(firstLoopAt(walk(Array.from({length: 20}, (_, i) => ({signature: `beat-${i}`}))))).to.eq(-1);
    // A counter ticking in the bar is a new picture a second, too.
    expect(firstLoopAt(walk(Array.from({length: 20}, (_, i) => ({signature: `wait 0:${String(i).padStart(2, '0')}`}))))).to.eq(-1);
  });

  it('a screen that STANDS is not a loop (that is the stall the arbiter already judges), nor one that settled after a few turns', () => {
    expect(firstLoopAt(walk(Array.from({length: 30}, () => ({signature: 'modal'}))))).to.eq(-1);
    // Four flips while a surface arrives, then it stands: an entrance, not a loop.
    const arrival = [...blink(5), ...Array.from({length: 20}, () => ({signature: 'modal'}))];
    expect(firstLoopAt(walk(arrival))).to.eq(-1);
  });

  it('OFF TURN the screen is other seats\' theatre — a bot\'s cards rising and falling are never judged', () => {
    expect(firstLoopAt(walk(blink(30, {promptLive: false})))).to.eq(-1);
  });

  it('a NEW question is a new story: the spell starts over with it', () => {
    const verdicts = walk([...blink(8), ...blink(8, {question: 'space#13'})]);
    expect(firstLoopAt(verdicts)).to.eq(-1);
  });

  it('a loop that STOPS is forgotten — and one that comes back is named again', () => {
    const verdicts = walk([...blink(12), ...Array.from({length: 12}, () => ({signature: 'board'})), ...blink(12)]);
    const firsts = verdicts.map((v, i) => (v.oscillating && v.first ? i : -1)).filter((i) => i >= 0);
    expect(firsts.length, 'named twice: two spells').to.eq(2);
    expect(firsts[0]).to.eq(OSCILLATION_LOOKS - 1);
  });
});
