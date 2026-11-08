import {expect} from 'chai';
import {
  FIELD_HEARTBEATS_MAX, FIELD_LINES_MAX, FIELD_QUIET_POST_S, FieldPost, FieldRecorder, FieldRecorderDeps, FieldStorage, fieldPostWithin,
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

  it('a live batch carries the WHOLE heartbeat ring — the seconds that LED to a warn line (the 2026-11-01 13:50 freeze)', () => {
    const h = harness();
    const r = h.make();
    for (let i = 0; i < FIELD_HEARTBEATS_MAX + 5; i++) {
      r.heartbeat({prompt: `or|first#${i}`, accepting: false, inFlight: ['story'], frames: ['start:browse'], section: 'board/',
        quietS: i, presses: 0, block: 'board-story', start: 'stage'});
      h.tick(1000);
    }
    r.line('[presentation-ledger] story «board-beat-park» degraded after 30s');
    h.runTimers();
    const live = h.posts.find((p) => p.body.kind === 'live');
    expect(live?.body.record.heartbeats, 'every kept second rides the post').length(FIELD_HEARTBEATS_MAX);
    expect(FIELD_HEARTBEATS_MAX, 'the ring outlasts a 30 s safety').to.be.greaterThan(30);
    expect(live?.body.record.heartbeats.at(-1)).to.include({block: 'board-story', start: 'stage'});
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

  it('a screen that STANDS posts its ring once per quiet episode — a freeze with no warn line is evidence too (2026-11-07 01:06)', () => {
    const h = harness();
    const r = h.make();
    const beat = (quietS: number, over: Record<string, unknown> = {}) =>
      r.heartbeat({prompt: 'or:menu#1', accepting: true, inFlight: [], frames: ['parliament:committed'], section: 'parliament/', quietS, presses: 0, ...over});
    for (let q = 1; q < FIELD_QUIET_POST_S; q++) {
      beat(q);
    }
    expect(h.posts, 'not yet').length(0);
    beat(FIELD_QUIET_POST_S);
    expect(h.posts).length(1);
    expect(h.posts[0].body.kind).to.eq('live');
    expect(h.posts[0].body.record.heartbeats.length).to.eq(FIELD_QUIET_POST_S);
    beat(FIELD_QUIET_POST_S + 1);
    beat(FIELD_QUIET_POST_S + 30);
    expect(h.posts, 'once per episode').length(1);
    // The screen moved → the next standing episode posts again.
    beat(1);
    beat(FIELD_QUIET_POST_S);
    expect(h.posts).length(2);
    // A player THINKING at the board home (no frame, accepting) or a screen with something in flight posts nothing.
    beat(1);
    beat(FIELD_QUIET_POST_S + 5, {frames: []});
    beat(FIELD_QUIET_POST_S + 6, {inFlight: ['transport@1s']});
    beat(FIELD_QUIET_POST_S + 7, {prompt: ''});
    expect(h.posts).length(2);
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
  it('a beacon is TRIMMED to its budget — the oldest heartbeats first, then the oldest lines; a post that fits is untouched (the field export of 2026-11-08)', () => {
    const beats = Array.from({length: 45}, (_, i) => ({prompt: `or|Выберите следующее действие#${i}`, accepting: true, inFlight: [], frames: ['hand:committed'], section: 'hand/', quietS: 1, presses: 0, at: i}));
    const body: FieldPost = {kind: 'pagehide', record: {game: 'g', player: 'p', profile: '', build: '', ua: '', startedAt: 0,
      lines: [{at: 1, text: '[wait-graph] old'}, {at: 2, text: '[wait-graph] new'}], heartbeats: beats} as unknown as FieldPost['record']};
    const whole = JSON.stringify(body);
    expect(fieldPostWithin(body, whole.length * 3)).eq(whole);
    const cut = JSON.parse(fieldPostWithin(body, 1_500)) as FieldPost;
    expect(new TextEncoder().encode(JSON.stringify(cut)).length).to.be.at.most(1_500);
    expect(cut.record.heartbeats.length).to.be.below(45);
    expect(cut.record.heartbeats.map((h) => (h as unknown as {at: number}).at).every((at) => at >= 45 - cut.record.heartbeats.length), 'the NEWEST heartbeats kept').eq(true);
    expect(cut.record.lines.map((l) => (l as {text: string}).text)).to.deep.eq(['[wait-graph] old', '[wait-graph] new']);
  });
});
