import {expect} from 'chai';
import {
  OSCILLATION_LAST_LINE_LOOKS, OSCILLATION_LOOKS, OSCILLATION_REST, OscillationSample, OscillationState, OscillationVerdict, observeOscillation, oscillationTurns,
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

  it('a loop that has STOPPED is over at once — a screen that settled is not judged by what it did before', () => {
    // Twelve looks of blinking, then the surface stands: the window still holds six flips for a few looks more.
    const verdicts = walk([...blink(12), ...Array.from({length: 8}, () => ({signature: 'board'}))]);
    const looping = verdicts.map((v) => v.oscillating);
    expect(looping.slice(OSCILLATION_LOOKS - 1, 12).every(Boolean), 'a loop while it turns').to.eq(true);
    // The last flip is the settle itself (look 12); three looks later nothing has changed — the loop is over.
    expect(looping.slice(12 + 3), 'over within three looks of standing still').to.deep.eq([false, false, false, false, false]);
  });

  it('a loop that STANDS as long again is DUE for the last line — said at exactly one look, never before, never twice', () => {
    const verdicts = walk(blink(OSCILLATION_LOOKS + OSCILLATION_LAST_LINE_LOOKS + 8));
    const due = verdicts.map((v, i) => (v.oscillating && v.due ? i : -1)).filter((i) => i >= 0);
    expect(due, 'ten looks to be named, ten more to be due').to.deep.eq([OSCILLATION_LOOKS - 1 + OSCILLATION_LAST_LINE_LOOKS]);
    // A press before it is due starts the spell over — the player is trying something: nothing is taken from them.
    const pressed = walk([...blink(OSCILLATION_LOOKS + 6), ...blink(OSCILLATION_LOOKS + 6, {inputs: 1})]);
    expect(pressed.some((v) => v.oscillating && v.due)).to.eq(false);
    // …and a loop that stopped and came back owes its whole second half again.
    // (Stood still for a whole window: the second spell starts from nothing.)
    const twice = walk([...blink(OSCILLATION_LOOKS + 6), ...Array.from({length: OSCILLATION_LOOKS + 2}, () => ({signature: 'board'})), ...blink(OSCILLATION_LOOKS + 4)]);
    expect(twice.some((v) => v.oscillating && v.due)).to.eq(false);
  });

  it('WHAT TURNS is named — the fields of the picture that differ, read from the end (the key of the question may hold the separator)', () => {
    const sig = (surfaces: string, focus: string) => ['or|Select one option#3', 'parliament:committed', 'board/', surfaces, 'Board', focus, 'false'].join('|');
    expect(oscillationTurns([sig('0,0,0,0,0,1,0,0,0', ''), sig('0,0,1,0,0,1,0,0,0', 'con-cards__slot:Algae')]))
      .to.eq('surfaces: «0,0,0,0,0,1,0,0,0» ⇄ «0,0,1,0,0,1,0,0,0» · focus: «» ⇄ «con-cards__slot:Algae»');
    expect(oscillationTurns([sig('0', ''), sig('0', '')])).to.eq('nothing the signature names');
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

  /*
   * A LOOK IS A SAMPLE, AND A SAMPLE HAS A PHASE (stage 1, 2026-11-17). The reveal band of the blinking deck draw was
   * up for a quarter of a second of every second or two: the same loop stood a day on a green gate and turned it red
   * the next, on the same code — seen or missed by WHEN the look fell. The picture's own edges (every mount and
   * unmount of a surface, counted as it happens) say what no look can.
   */
  describe('counted on the picture\'s own edges — no phase hides a loop, none invents one', () => {
    /** A band that mounts and leaves between two looks: the picture is the same at both, two edges fell between. */
    const hiddenBlink = (n: number, perLook = 2): Array<Look> => Array.from({length: n}, (_, i) => ({signature: 'board', edges: i * perLook}));

    it('a band that comes and goes BETWEEN the looks is a loop — every look found the same picture', () => {
      const verdicts = walk(hiddenBlink(14));
      expect(firstLoopAt(verdicts)).to.eq(OSCILLATION_LOOKS - 1);
      const named = verdicts[OSCILLATION_LOOKS - 1] as Extract<OscillationVerdict, {oscillating: true}>;
      expect(named.states, 'one picture — the sampler alone would call it a still screen').to.deep.eq(['board']);
      expect(named.roundTrips, 'every flip was a round trip').to.eq(named.flips);
    });

    it('whatever the phase: looks that catch the band and looks that miss it are ONE loop', () => {
      // The band up at looks 0, 3, 4, 8 only — by the sampler: 6 changes among 12 looks, never 6 inside one window.
      const up = new Set([0, 3, 4, 8]);
      const looks: Array<Look> = Array.from({length: 14}, (_, i) => ({signature: up.has(i) ? 'band' : 'board', edges: i * 2}));
      expect(firstLoopAt(walk(looks)), 'named as soon as the spell is whole').to.eq(OSCILLATION_LOOKS - 1);
      // …and with the edges not counted the same looks are judged by the sampler alone: not a loop inside any window.
      expect(firstLoopAt(walk(looks.map(({signature}) => ({signature})))), 'the sampler alone misses it').to.eq(-1);
    });

    it('ONE re-home is not a loop — a surface moved once (two edges), then stood', () => {
      const looks: Array<Look> = Array.from({length: 16}, (_, i) => ({signature: 'board', edges: i >= 3 ? 2 : 0}));
      expect(firstLoopAt(walk(looks))).to.eq(-1);
    });

    it('a single edge between two looks is the change the looks already see — never counted twice', () => {
      // A modal that mounts at one look and leaves at the next: one edge a look, the pictures differ.
      const looks: Array<Look> = Array.from({length: 14}, (_, i) => ({signature: i % 2 === 0 ? 'modal' : 'board', edges: i}));
      const named = walk(looks)[OSCILLATION_LOOKS - 1] as Extract<OscillationVerdict, {oscillating: true}>;
      expect(named.oscillating).to.eq(true);
      expect(named.roundTrips).to.eq(0);
      expect(named.flips).to.eq(OSCILLATION_LOOKS - 1);
    });

    it('the player\'s own hand starts the spell over, edges or not — and a hidden loop that stopped is over at once', () => {
      const pressed = walk(Array.from({length: 14}, (_, i) => ({signature: 'board', edges: i * 2, inputs: i})));
      expect(firstLoopAt(pressed)).to.eq(-1);
      const stopped = walk([...hiddenBlink(12), ...Array.from({length: 6}, () => ({signature: 'board', edges: 22}))]);
      expect(stopped[11].oscillating, 'named while it turns').to.eq(true);
      expect(stopped.slice(15).some((v) => v.oscillating), 'three still looks later it is over').to.eq(false);
    });
  });
});
