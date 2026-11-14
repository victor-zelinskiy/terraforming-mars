import {expect} from 'chai';
import {decideRebuild, EMPTY_REBUILD_MEMORY, parseRebuildMemory, REBUILD_WINDOW_MAX, REBUILD_WINDOW_MS, RebuildMemory} from '../../src/client/console/session/rebuildBound';

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
