import {expect} from 'chai';
import {decideRebuild, EMPTY_REBUILD_MEMORY, parseRebuildMemory, REBUILD_WINDOW_MAX, REBUILD_WINDOW_MS, RebuildMemory} from '../../src/client/console/session/rebuildBound';
import {initialLivenessState, LAST_LINE_REST, lastLineStep, LIVENESS_REBUILD_AFTER_MS, observeLiveness} from '../../src/client/console/consoleLiveness';

/**
 * THE REBUILD IS BOUNDED (docs/claude/console/freeze-zero/PLAN.md §4 · 6): the last line against a freeze — the
 * console session rebuilt from the server's view — may never become a loop. One rebuild per question; a few per
 * window; past either the page stays and the refusal is said ONCE.
 */
describe('session rebuild — bounded, never a loop', () => {
  const T0 = 1_700_000_000_000;
  const go = (memory: RebuildMemory, question: string, at: number): RebuildMemory => {
    const decision = decideRebuild(memory, question, at);
    expect(decision.verdict, `${question} @ ${at - T0}`).to.eq('rebuild');
    return decision.memory;
  };

  it('a question is rebuilt for ONCE: standing again after its rebuild, it is refused — and the refusal is said once', () => {
    const after = go(EMPTY_REBUILD_MEMORY, 'p1|card#12', T0);
    expect(after.made).to.deep.eq([{q: 'p1|card#12', at: T0}]);
    const again = decideRebuild(after, 'p1|card#12', T0 + 20_000);
    expect(again).to.deep.include({verdict: 'refused', reason: 'again', tell: true});
    const third = decideRebuild(again.memory, 'p1|card#12', T0 + 40_000);
    expect(third, 'a standing refusal is one fact, not a line a second').to.deep.include({verdict: 'refused', reason: 'again', tell: false});
    expect(third.memory, 'nothing to write when nothing is said').to.eq(again.memory);
    // …however long it stands: the bound is the tab's, not a timer's.
    expect(decideRebuild(again.memory, 'p1|card#12', T0 + 3 * REBUILD_WINDOW_MS).verdict).to.eq('refused');
  });

  it('another question — and the same question of another seat — is its own', () => {
    const after = go(EMPTY_REBUILD_MEMORY, 'p1|card#12', T0);
    go(after, 'p1|or#13', T0 + 30_000);
    go(after, 'p2|card#12', T0 + 30_000);
  });

  it('a window holds a few rebuilds, whatever the questions — the next one stays, and says so once per question', () => {
    let memory = EMPTY_REBUILD_MEMORY;
    for (let i = 0; i < REBUILD_WINDOW_MAX; i++) {
      memory = go(memory, `p1|card#${i}`, T0 + i * 30_000);
    }
    const full = decideRebuild(memory, 'p1|card#99', T0 + 120_000);
    expect(full).to.deep.include({verdict: 'refused', reason: 'rate', tell: true});
    expect(decideRebuild(full.memory, 'p1|card#99', T0 + 125_000)).to.deep.include({verdict: 'refused', reason: 'rate', tell: false});
    // The window moves on: once the oldest rebuild is behind it, a NEW question may be rebuilt for.
    go(full.memory, 'p1|card#99', T0 + REBUILD_WINDOW_MS + 1);
  });

  it('«the server asks nothing» has no question to key by: only the window bounds it', () => {
    let memory = EMPTY_REBUILD_MEMORY;
    for (let i = 0; i < REBUILD_WINDOW_MAX; i++) {
      memory = go(memory, '', T0 + i * 20_000);
    }
    expect(decideRebuild(memory, '', T0 + 90_000)).to.deep.include({verdict: 'refused', reason: 'rate'});
  });

  it('the memory survives the document as text — and anything unreadable is «nothing was made»', () => {
    const memory = go(go(EMPTY_REBUILD_MEMORY, 'p1|card#12', T0), 'p1|or#13', T0 + 1);
    expect(parseRebuildMemory(JSON.stringify(memory))).to.deep.eq(memory);
    for (const raw of [null, undefined, '', 'not json', '{"made": 7}', '[]']) {
      expect(parseRebuildMemory(raw), String(raw)).to.deep.eq(EMPTY_REBUILD_MEMORY);
    }
    expect(parseRebuildMemory('{"made":[{"q":"a","at":1},{"q":7,"at":2},{"q":"b"},null],"told":["again:a",3]}')).to.deep.eq({made: [{q: 'a', at: 1}], told: ['again:a']});
  });

  it('the record is bounded: a tab that lived for days keeps the newest', () => {
    let memory = EMPTY_REBUILD_MEMORY;
    for (let i = 0; i < 40; i++) {
      memory = go(memory, `p1|card#${i}`, T0 + i * REBUILD_WINDOW_MS);
    }
    expect(memory.made.length).to.be.lessThan(30);
    expect(memory.made[memory.made.length - 1].q).to.eq('p1|card#39');
  });
});

/**
 * WHEN THE LAST LINE IS DUE (`consoleLiveness.lastLineStep`) — one look of the arbiter past its ladder.
 */
describe('the last line — when it is due', () => {
  const T0 = 1_700_000_000_000;
  const look = (reason: 'unserved' | 'presses-no-effect', presses: number, at: number, spent = true) =>
    ({spent, unserved: reason === 'unserved', presses, now: T0 + at});

  it('UNSERVED — the player cannot act: due once the screen has stood past the spent ladder, never at the first look', () => {
    const first = lastLineStep(LAST_LINE_REST, look('unserved', 0, 0));
    expect(first).to.deep.eq({state: {spentSince: T0, pressesAtSpent: 0}, due: false});
    const early = lastLineStep(first.state, look('unserved', 0, 2_000));
    expect(early.due, 'two more looks: a screen about to come back by itself has come back').to.eq(false);
    expect(lastLineStep(early.state, look('unserved', 0, LIVENESS_REBUILD_AFTER_MS)).due).to.eq(true);
  });

  it('A DEAF SCREEN — it says it accepts: time alone never makes it due; the player\'s NEXT dead press does', () => {
    const first = lastLineStep(LAST_LINE_REST, look('presses-no-effect', 3, 0));
    expect(first.state).to.deep.eq({spentSince: T0, pressesAtSpent: 3});
    // The player rests on the screen: however long, nothing is taken away from them.
    expect(lastLineStep(first.state, look('presses-no-effect', 3, 60_000)).due, 'no press since the ladder was spent').to.eq(false);
    // They press again, and it is dropped again — but the ladder was spent a moment ago: not yet.
    expect(lastLineStep(first.state, look('presses-no-effect', 4, 2_000)).due).to.eq(false);
    // …and past the wait: their own hand says the screen is dead.
    expect(lastLineStep(first.state, look('presses-no-effect', 4, LIVENESS_REBUILD_AFTER_MS)).due).to.eq(true);
  });

  it('A PLAYER HAMMERING a screen that takes nothing is filed by the presses — and is still due by time alone', () => {
    // The arbiter's own verdicts for that screen, a look a second: the server asks, nothing accepts, and the player
    // pressed A six times in the first three seconds — then let go of the pad.
    let state = initialLivenessState(T0);
    let line = LAST_LINE_REST;
    const seen: Array<string> = [];
    let dueAt = 0;
    for (let at = 0; at <= 30_000 && dueAt === 0; at += 1_000) {
      const step = observeLiveness(state, {now: T0 + at, promptLive: true, accepting: false, inFlight: [], presses: Math.min(6, at / 500), signature: 's'});
      state = step.state;
      const verdict = step.verdict;
      if (!verdict.stalled || verdict.rung === undefined) {
        continue; // the supervisor's own cadence: it looks past the ladder once a rung gap
      }
      seen.push(`${at / 1_000}s ${verdict.reason}${verdict.unserved ? ' · unserved' : ''}`);
      // The ladder has nothing to release on this screen: spent from the stall's first look.
      const last = lastLineStep(line, {spent: true, unserved: verdict.unserved, presses: verdict.presses, now: T0 + at});
      line = last.state;
      if (last.due) {
        dueAt = at;
      }
    }
    // The presses bring the JUDGEMENT forward (5 s, not 10) and win the stall's NAME for good — the fact joins at its
    // own grace, and from then on no further press is asked of a player who cannot act.
    expect(seen).to.deep.eq(['5s presses-no-effect', '7s presses-no-effect', '9s presses-no-effect', '11s presses-no-effect · unserved']);
    expect(dueAt, 'due by TIME — the player never pressed again').to.eq(11_000);
  });

  it('a rung that still ACTS, or a stall that is over, puts the clock back to rest', () => {
    const standing = lastLineStep(LAST_LINE_REST, look('unserved', 0, 0)).state;
    expect(lastLineStep(standing, look('unserved', 0, 3_000, false))).to.deep.eq({state: LAST_LINE_REST, due: false});
    // The next spent look starts the wait anew — the earlier seconds do not count.
    const again = lastLineStep(LAST_LINE_REST, look('unserved', 0, 5_000));
    expect(again.due).to.eq(false);
    expect(again.state.spentSince).to.eq(T0 + 5_000);
  });
});
