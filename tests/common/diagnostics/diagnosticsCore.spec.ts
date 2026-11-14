import {expect} from 'chai';
import {classifyLine, DIAG_FAMILIES, lineBody, readLivenessLine, tagOf} from '../../../src/common/diagnostics/classify';
import {debugIdsOf} from '../../../src/common/diagnostics/debugIds';
import {DIAG_COALESCE_MS, DIAG_EPISODE_SILENCE_MS, DIAG_TEXT_MAX} from '../../../src/common/diagnostics/DiagnosticModel';
import {boundText, DiagJournal} from '../../../src/common/diagnostics/journal';
import {fingerprintId, scrubDeep, scrubText} from '../../../src/common/diagnostics/privacy';
import {REPORT_CODE_PATTERN, reportCodeFrom} from '../../../src/common/diagnostics/protocol';
import {frameLocation, normalizeMessage, parseStack, stackFingerprint, stackHead} from '../../../src/common/diagnostics/stackFrames';

/**
 * THE DIAGNOSTICS CORE (docs/claude/diagnostics.md) — the pure layer every runtime shares: a V8 stack parsed, a line
 * classified, lines folded into records and episodes, what never leaves by itself scrubbed, a report code made.
 */
const STACK = [
  'TypeError: Cannot read properties of null (reading \'emitsOptions\')',
  '    at fold (app://bundle/main.js:2:1834)',
  '    at async Object.run (app://bundle/chunks/vendors.js:9:120)',
  '    at app://bundle/main.js:2:99',
  '    at new Scope (node:internal/process/task_queues:105:5)',
  '    at eval (eval at <anonymous> (app://bundle/main.js:7:7), <anonymous>:3:9)',
  '    at Proxy.step [as next] (C:\\Users\\zelin\\app\\resources\\app.asar\\build\\electron\\main.js:12:3)',
].join('\n');

const stallLine = (quiet: number, rung: string) => `[liveness] stall (unserved): ${quiet}s without progress, 0 presses; asked: or; beat: none; stranded: no; ` +
  `last in flight: nothing; claim: none; holds: none — ${rung}`;

describe('diagnostics core — a V8 stack, parsed once for both of its readers', () => {
  it('reads every frame shape, innermost first', () => {
    const frames = parseStack(STACK);
    expect(frames.map((f) => f.fn)).to.deep.eq(['fold', 'async Object.run', '', 'new Scope', 'eval', 'Proxy.step']);
    expect(frames[0]).to.deep.include({file: 'app://bundle/main.js', line: 2, col: 1834, inApp: true});
    expect(frames[1].inApp, 'the vendors chunk is a library').to.eq(false);
    expect(frames[3].inApp, 'the runtime\'s own modules are a library').to.eq(false);
    expect(frames[4], 'an eval frame is located by its OUTER file — the one a map resolves').to.deep.include({file: 'app://bundle/main.js', line: 7, col: 7});
    expect(frames[5], 'a Windows path keeps its drive').to.deep.include({file: 'C:\\Users\\zelin\\app\\resources\\app.asar\\build\\electron\\main.js', line: 12, col: 3, inApp: true});
    expect(frameLocation(frames[0])).to.eq('bundle/main.js:2:1834');
  });

  it('keeps the head apart from the frames, and never throws on a non-stack', () => {
    expect(stackHead(STACK)).to.eq('TypeError: Cannot read properties of null (reading \'emitsOptions\')');
    expect(parseStack(undefined)).to.deep.eq([]);
    expect(parseStack('just a sentence\nand another')).to.deep.eq([]);
  });

  it('two throws of one defect share a fingerprint; what varies is taken out', () => {
    const a = stackFingerprint('Error: card 127 not found in g1a2b3c4d5e6f', parseStack(STACK));
    const b = stackFingerprint('Error: card 9 not found in g0f0e0d0c0b0a', parseStack(STACK));
    expect(a).to.eq(b);
    expect(normalizeMessage('held 12.5s over 3 frames')).to.eq('held Ns over N frames');
  });
});

describe('diagnostics core — every tagged line has a class', () => {
  it('reads the tag, the family and the kind', () => {
    expect(tagOf('[liveness] stall')).to.eq('liveness');
    expect(tagOf('no tag here')).to.eq(undefined);
    expect(classifyLine('[vue-error] X · render: TypeError: y', 'error')).to.deep.eq({family: 'vue-error', kind: 'error', known: true});
    expect(classifyLine('[workspace-stall] beat executing 12s', 'warn').kind).to.eq('stall');
    expect(classifyLine('[transfer] end not painted', 'warn').kind).to.eq('integrity');
    expect(classifyLine('[long-frame] 180ms', 'warn').kind).to.eq('perf');
    expect(classifyLine('[played-hero] the safety fired', 'warn').kind).to.eq('note');
    expect(lineBody('[liveness] recovered after 4s')).to.eq('recovered after 4s');
  });

  it('an untagged line is read by its level; an unknown tag says it is unknown', () => {
    expect(classifyLine('Cannot load ru translations', 'warn')).to.deep.eq({family: 'console', kind: 'note', known: true});
    expect(classifyLine('error updating journal events', 'error')).to.deep.eq({family: 'console', kind: 'error', known: true});
    expect(classifyLine('[brand-new-tag] x', 'warn')).to.deep.eq({family: 'brand-new-tag', kind: 'note', known: false});
  });

  it('every family has exactly one kind', () => {
    expect(DIAG_FAMILIES.size).to.be.greaterThan(100);
    expect(DIAG_FAMILIES.get('liveness')).to.eq('stall');
  });

  it('reads the arbiter\'s three lines', () => {
    expect(readLivenessLine(stallLine(10, 'rung 0: stories degraded'))).to.deep.eq(
      {is: 'stall', reason: 'unserved', quietS: 10, asked: 'or', step: 'rung 0: stories degraded', spent: false});
    expect(readLivenessLine(stallLine(18, 'a · b — the ladder is spent'))).to.deep.include({is: 'stall', spent: true});
    expect(readLivenessLine('[liveness] recovered after 16s, 3 rung(s) run')).to.deep.eq({is: 'recovered', afterS: 16, rungs: 3});
    expect(readLivenessLine('[liveness] still hold — card-receive[blocking]')).to.deep.eq({is: 'other'});
  });
});

describe('diagnostics core — the journal: lines in, records out', () => {
  const journal = () => new DiagJournal({runtime: 'page', session: 's1', build: '1.2.3', max: 5});

  it('ONE THROW — ONE RECORD: a repeat inside the window grows the count, a later one is a new record', () => {
    const j = journal();
    const first = j.ingest({at: 1000, level: 'error', text: `[page-error] uncaught: TypeError: x\n${STACK}`, stack: STACK});
    expect(first.change).to.eq('new');
    expect(first.entry).to.deep.include({id: 'page-s1-1', kind: 'error', family: 'page-error', count: 1, build: '1.2.3'});
    expect(first.entry.title).to.eq('uncaught: TypeError: x');
    const again = j.ingest({at: 1500, level: 'error', text: `[page-error] uncaught: TypeError: x\n${STACK}`, stack: STACK});
    expect(again.change).to.eq('update');
    expect(again.entry.id).to.eq('page-s1-1');
    expect(again.entry.count).to.eq(2);
    const later = j.ingest({at: 1500 + DIAG_COALESCE_MS + 1, level: 'error', text: `[page-error] uncaught: TypeError: x\n${STACK}`, stack: STACK});
    expect(later.change).to.eq('new');
    expect(j.entries()).to.have.length(2);
  });

  it('A LIVENESS STALL IS AN EPISODE: its rungs fold into one record, the cure closes it with its duration', () => {
    const j = journal();
    const open = j.ingest({at: 10_000, level: 'warn', text: stallLine(10, 'rung 0: stories degraded')});
    expect(open.change).to.eq('new');
    expect(open.entry.episode).to.deep.eq({state: 'open', durationMs: 10_000, lines: 1, steps: ['rung 0: stories degraded']});
    const rung = j.ingest({at: 12_000, level: 'warn', text: stallLine(12, 'rung 1: a claim released')});
    expect(rung.change).to.eq('update');
    expect(rung.entry.id).to.eq(open.entry.id);
    expect(rung.entry.episode).to.deep.include({state: 'open', durationMs: 12_000, lines: 2});
    const cured = j.ingest({at: 13_000, level: 'warn', text: '[liveness] recovered after 13s, 2 rung(s) run'});
    expect(cured.change).to.eq('close');
    expect(cured.entry.id).to.eq(open.entry.id);
    expect(cured.entry.episode).to.deep.include({state: 'healed', durationMs: 13_000, lines: 3});
    expect(cured.entry.text.split('\n'), 'the full text is every line of the episode, in order').to.have.length(3);
    expect(j.entries()).to.have.length(1);
    // The next stall is a NEW episode.
    expect(j.ingest({at: 90_000, level: 'warn', text: stallLine(10, 'rung 0: x')}).change).to.eq('new');
  });

  it('an episode nobody cures is closed as unhealed — by silence, or by the page leaving', () => {
    const j = journal();
    const open = j.ingest({at: 0, level: 'warn', text: stallLine(10, 'the ladder is spent')});
    expect(j.tick(DIAG_EPISODE_SILENCE_MS - 1)).to.deep.eq([]);
    const closed = j.tick(DIAG_EPISODE_SILENCE_MS);
    expect(closed.map((e) => e.id)).to.deep.eq([open.entry.id]);
    expect(open.entry.episode?.state).to.eq('unhealed');
    const second = journal();
    second.ingest({at: 0, level: 'warn', text: stallLine(10, 'rung 0: x')});
    expect(second.closeOpenEpisodes()[0].episode?.state).to.eq('unhealed');
  });

  it('a cure this journal never saw begin is still a record', () => {
    const j = journal();
    const cured = j.ingest({at: 5, level: 'warn', text: '[liveness] recovered after 7s, 1 rung(s) run'});
    expect(cured.entry.episode).to.deep.include({state: 'healed', durationMs: 7000});
  });

  it('is bounded: the newest records win, a long text keeps its head and its tail', () => {
    const j = journal();
    for (let i = 0; i < 9; i++) {
      j.ingest({at: i * (DIAG_COALESCE_MS + 1), level: 'warn', text: `[flow] scope ${String.fromCharCode(97 + i)} threw`});
    }
    expect(j.entries()).to.have.length(5);
    expect(j.entries()[4].title).to.eq('scope i threw');
    const long = boundText('HEAD ' + 'x'.repeat(DIAG_TEXT_MAX * 2) + ' TAIL');
    expect(long.length).to.be.at.most(DIAG_TEXT_MAX + 80);
    expect(long.startsWith('HEAD ')).to.eq(true);
    expect(long.endsWith(' TAIL')).to.eq(true);
  });

  it('adopts an earlier session\'s records before its own — an episode open there was never cured', () => {
    const before = journal();
    const open = before.ingest({at: 100, level: 'warn', text: stallLine(10, 'rung 0: x')});
    before.ingest({at: 200, level: 'error', text: '[vue-error] A · render: Error: e'});
    const j = new DiagJournal({runtime: 'page', session: 's2', build: '1.2.3'});
    j.ingest({at: 900, level: 'warn', text: '[flow] later'});
    j.adopt(before.entries());
    expect(j.entries().map((e) => e.id)).to.deep.eq(['page-s1-1', 'page-s1-2', 'page-s2-1']);
    expect(j.find(open.entry.id)?.episode?.state).to.eq('unhealed');
    j.adopt(before.entries());
    expect(j.entries(), 'adopting twice adds nothing').to.have.length(3);
  });
});

describe('diagnostics core — what never leaves by itself', () => {
  const hash = (v: string) => `h${v.length}${v.charCodeAt(1)}`.padEnd(12, '0');
  const context = {ids: ['p1a2b3c4d5e6f', 'gdeadbeef0001'], names: ['Виктор', 'Zelin', 'Я']};

  it('a key becomes a fingerprint, a name a placeholder', () => {
    const out = scrubText('seat p1a2b3c4d5e6f of gdeadbeef0001 — Виктор took a card; Zelin waits; another p0f0e0d0c0b0a1', context, hash);
    expect(out).to.not.match(/p1a2b3c4d5e6f|gdeadbeef0001|p0f0e0d0c0b0a1|Виктор|Zelin/);
    expect(out).to.contain(fingerprintId('p1a2b3c4d5e6f', hash));
    expect(out).to.contain('<player> took a card');
    expect(scrubText('Я', context, hash), 'a one-letter name would eat ordinary text').to.eq('Я');
  });

  it('an address, an e-mail and the OS account inside a path are taken out; loopback stays', () => {
    const out = scrubText('192.168.1.44 / 127.0.0.1 · a.b@mail.com · C:\\Users\\zelin\\AppData\\x.js · /home/deck/.config/y', {ids: [], names: []}, hash);
    expect(out).to.eq('<ip> / 127.0.0.1 · <email> · C:\\Users\\<user>\\AppData\\x.js · /home/<user>/.config/y');
  });

  it('scrubs every string of a value — keys too — and leaves ordinary words alone', () => {
    const out = scrubDeep({p1a2b3c4d5e6f: {note: 'gdeadbeef0001', n: 3, list: ['Zelin', 'selected seeded passed']}}, context, hash);
    expect(JSON.stringify(out)).to.not.match(/p1a2b3c4d5e6f|gdeadbeef0001|Zelin/);
    expect(JSON.stringify(out)).to.contain('selected seeded passed');
    expect(JSON.stringify(out)).to.contain('"n":3');
  });
});

describe('diagnostics core — a report code and the debug ids', () => {
  it('a code is TM- and six characters with no look-alikes', () => {
    expect(reportCodeFrom([0, 0.2, 0.4, 0.6, 0.8, 0.999])).to.match(REPORT_CODE_PATTERN);
    expect(reportCodeFrom([1, 1, 1, 1, 1, 1]), 'a random of exactly 1 still lands in the alphabet').to.match(REPORT_CODE_PATTERN);
    expect(reportCodeFrom([0, 0, 0, 0, 0, 0])).to.eq('TM-AAAAAA');
  });

  it('reads file → debug id off the registry a stamped build fills', () => {
    const registry = {_sentryDebugIds: {
      'Error\n    at app://bundle/main.js:1:1\n    at x (app://bundle/other.js:2:2)': 'id-main',
      'Error\n    at Object.<anonymous> (C:\\app\\build\\electron\\main.js:1:9)': 'id-electron',
    }};
    expect(debugIdsOf(registry)).to.deep.eq({'app://bundle/main.js': 'id-main', 'C:\\app\\build\\electron\\main.js': 'id-electron'});
    expect(debugIdsOf({})).to.deep.eq({});
    expect(debugIdsOf(undefined)).to.deep.eq({});
  });
});
