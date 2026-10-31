import {expect} from 'chai';
import {
  FIELD_HEARTBEATS_MAX, FIELD_LINES_MAX, FieldPost, FieldRecorder, FieldRecorderDeps, FieldStorage,
} from '../../src/client/console/fieldRecorder';

/**
 * THE FIELD FLIGHT RECORDER (phase 2 of the start director, 2026-10-31): the console's tagged lines and the
 * arbiter's heartbeats, bounded, batched, kept across a reload and handed over on the next boot — pure of the browser
 * (storage · clock · poster · scheduler injected).
 */
function memoryStorage(initial: string | null = null): FieldStorage & {value: string | null} {
  const box = {
    value: initial,
    read: () => box.value,
    write: (v: string) => {
      box.value = v;
    },
    clear: () => {
      box.value = null;
    },
  };
  return box;
}

function harness(opts: {initial?: string | null, page?: Partial<FieldRecorderDeps['page']>} = {}) {
  const posts: Array<{body: FieldPost, final: boolean}> = [];
  const timers: Array<{fn: () => void, ms: number}> = [];
  let now = 1_000_000;
  const storage = memoryStorage(opts.initial ?? null);
  const deps: FieldRecorderDeps = {
    storage,
    post: (body, final) => posts.push({body, final}),
    now: () => now,
    page: {game: 'g1', player: 'p1', profile: 'tv', build: 'abc', ua: 'test', navigation: 'navigate', ...opts.page},
    schedule: (fn, ms) => {
      timers.push({fn, ms});
      return timers.length;
    },
  };
  const runTimers = () => {
    const due = timers.splice(0, timers.length);
    due.forEach((t) => t.fn());
  };
  return {
    storage, posts, timers, runTimers, deps,
    tick: (ms: number) => {
      now += ms;
    },
    make: () => new FieldRecorder(deps),
  };
}

describe('fieldRecorder — the console\'s flight recorder', () => {
  it('keeps only TAGGED lines, bounded, newest kept', () => {
    const h = harness();
    const r = h.make();
    expect(r.line('plain text the console printed')).to.eq(false);
    expect(r.line('[liveness] stall (unserved): 10s without progress')).to.eq(true);
    for (let i = 0; i < FIELD_LINES_MAX + 10; i++) {
      r.line(`[start-shadow] disagree #${i}`);
    }
    const snap = r.snapshot();
    expect(snap.lines).length(FIELD_LINES_MAX);
    expect(snap.lines[snap.lines.length - 1].text).to.eq(`[start-shadow] disagree #${FIELD_LINES_MAX + 9}`);
    expect(snap.lines.some((l) => l.text.startsWith('[liveness]')), 'the oldest line fell off the ring').to.eq(false);
  });

  it('a long line is cut, never dropped', () => {
    const h = harness();
    const r = h.make();
    r.line('[transport] ' + 'x'.repeat(5000));
    expect(r.snapshot().lines[0].text.length).to.be.lessThan(1300);
  });

  it('lines go out in ONE live batch after the debounce; nothing pending → nothing posted', () => {
    const h = harness();
    const r = h.make();
    r.line('[liveness] one');
    r.line('[liveness] two');
    expect(h.posts).length(0);
    h.runTimers(); // the persist + the batch
    expect(h.posts).length(1);
    expect(h.posts[0].body.kind).to.eq('live');
    expect(h.posts[0].body.record.lines.map((l) => l.text)).to.deep.eq(['[liveness] one', '[liveness] two']);
    expect(h.posts[0].final).to.eq(false);
    r.flush(false);
    expect(h.posts, 'an empty flush posts nothing').length(1);
  });

  it('the heartbeat is kept — the last FIELD_HEARTBEATS_MAX — and names the game the URL does not carry', () => {
    const h = harness({page: {game: ''}});
    const r = h.make();
    for (let i = 0; i < FIELD_HEARTBEATS_MAX + 5; i++) {
      r.heartbeat({game: 'g777', prompt: `or:menu#${i}`, accepting: true, inFlight: [], frames: ['hand:browse'], section: 'hand/', quietS: i, presses: 0});
      h.tick(1000);
    }
    const snap = r.snapshot();
    expect(snap.heartbeats).length(FIELD_HEARTBEATS_MAX);
    expect(snap.heartbeats[0].quietS).to.eq(5);
    expect(snap.game).to.eq('g777');
  });

  it('the record is PERSISTED (debounced) so a reload does not erase it', () => {
    const h = harness();
    const r = h.make();
    r.line('[start-stranded] confirmed');
    r.heartbeat({prompt: 'or:corporationInitialAction#4', accepting: false, inFlight: [], frames: ['start:browse'], section: 'board/', quietS: 7, presses: 2});
    h.runTimers();
    const stored = JSON.parse(h.storage.value ?? '{}') as {lines: Array<unknown>, heartbeats: Array<unknown>, session: string};
    expect(stored.lines).length(1);
    expect(stored.heartbeats).length(1);
    expect(stored.session).to.eq(r.snapshot().session);
  });

  it('THE HAND-OVER: the next boot of the page posts the previous session as it was left, with how the player came back, then clears it', () => {
    const first = harness();
    const r1 = first.make();
    r1.line('[liveness] stall (unserved): 12s without progress');
    r1.heartbeat({prompt: 'or:corporationInitialAction#4', accepting: false, inFlight: [], frames: ['start:browse'], section: 'board/', quietS: 12, presses: 3});
    first.runTimers();
    const left = first.storage.value;
    expect(left).to.not.eq(null);

    const second = harness({initial: left, page: {navigation: 'reload'}});
    second.make();
    expect(second.posts).length(1);
    expect(second.posts[0].body.kind).to.eq('previous-session');
    expect(second.posts[0].body.navigation).to.eq('reload');
    expect(second.posts[0].body.record.session).to.eq(r1.snapshot().session);
    expect(second.posts[0].body.record.heartbeats[0].accepting).to.eq(false);
    expect(second.posts[0].body.record.lines[0].text).to.contain('[liveness] stall');
    // The storage now belongs to the NEW session (nothing of the old is posted twice on a third boot).
    second.runTimers();
    const third = harness({initial: second.storage.value});
    third.make();
    expect(third.posts, 'an EMPTY previous session (no line, no heartbeat) says nothing').length(0);
  });

  it('a previous session with nothing in it is not posted; a corrupt record is dropped quietly', () => {
    const empty = harness({initial: JSON.stringify({session: 'old', startedAt: 1, game: 'g1', player: 'p1', profile: '', build: '', ua: '', lines: [], heartbeats: []})});
    empty.make();
    expect(empty.posts).length(0);
    const corrupt = harness({initial: '{not json'});
    corrupt.make();
    expect(corrupt.posts).length(0);
    expect(corrupt.storage.value, 'the corrupt record is replaced by the new session\'s').to.not.eq('{not json');
  });

  it('pagehide persists NOW and posts what is pending as the final beacon (the latest heartbeats riding along)', () => {
    const h = harness();
    const r = h.make();
    r.line('[workspace-stall] beat «hydro:executing»');
    r.heartbeat({prompt: 'x#1', accepting: false, inFlight: ['transport@3s'], frames: [], section: 'board/', quietS: 3, presses: 0});
    r.pagehide();
    const last = h.posts[h.posts.length - 1];
    expect(last.final).to.eq(true);
    expect(last.body.kind).to.eq('pagehide');
    expect(last.body.record.lines).length(1);
    expect(last.body.record.heartbeats).length(1);
    expect(h.storage.value, 'persisted synchronously — the debounce cannot be relied on while the page leaves').to.contain('workspace-stall');
  });
});
