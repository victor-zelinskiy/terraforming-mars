import {expect} from 'chai';
import * as crypto from 'crypto';
import * as path from 'path';
import {pathToFileURL} from 'url';
import {fingerprintId} from '../../src/common/diagnostics/privacy';

/*
 * THE AGENTS' DIAGNOSTICS TOOL, ITS PURE HALF (scripts/diag-lib.mjs — `npm run diag`; docs/claude/console/freeze-zero/
 * PLAN.md §2): a Sentry event read as a CASE (the cause, what stood, how it ended), the collector's grouped answers
 * merged into one row per cause class, the session ledgers summed into «are freezes fewer?», the save an episode
 * began on, a save turned into an e2e fixture, and a word of the evidence traced to the line that declares it.
 *
 * (The class keys below are samples made for this spec: `npm run diag -- class` searches `tests/` for a class's
 * reproductions, and a real key here would read as one.)
 */
type Tag = {key: string, value: string};
type SentryEvent = Record<string, unknown> & {tags?: Array<Tag>};
type Case = {
  eventId: string, issueId: string, at: string, release: string, environment: string, title: string, tags: Record<string, string>,
  cause?: {cls: string, shape: string, tier: string, dims: Record<string, string>},
  episode?: {state: string, outcome: string, durationS?: number, lines?: number, steps: Array<string>, curedBy: string, cure: string, changed: Array<string>, nets: Array<string>},
  evidence?: {question: string, holders: Array<string>, input: string, takenAt: string},
  save?: {gameRef: string, saveId: number},
  text: string, flowTree: Array<string>, waits: Array<string>, waitGraph: Array<string>, flowTrace: Array<string>, cut: Array<string>,
};
type Sections = {cause: Array<string>, evidence: Array<string>, episode: Array<string>, lines: Array<string>, lists: Array<string>, save: Array<string>, cut: Array<string>};
type ClassRow = {
  cls: string, tier: string, kind: string, events: number, runs: number, runsExact: boolean, first: string, last: string,
  outcomes: Record<string, number>, releases: Array<{release: string, n: number}>, issues: Array<{shortId: string, id: string}>,
};
type Frames = {n: number, worstMs: number, native: number, pressWaited: number, totalMs: number, scriptMs: number, forcedLayoutMs: number, styleLayoutMs: number, renderMs: number,
  shares: {script: number | null, forcedLayout: number | null, styleLayout: number | null, render: number | null}};
type TrendRelease = {
  release: string, sessions: number, playHours: number, defects: number, defectsPerHour: number | null, defectsPerSession: number | null,
  episodes: number, episodesPerHour: number | null, episodesPerSession: number | null, outcomes: Record<string, number>, outcomeShares: Record<string, number | null>,
  stood: Record<string, number>, rendererStops: number, errors: number, longFrames: Frames & {sections: Array<Frames & {section: string}>},
};
type Trend = {
  sessions: number, skipped: number, playHours: number, releases: Array<TrendRelease>,
  topClasses: Array<{cls: string, tier: string, total: number, lines: number, perRelease: Record<string, number>}>,
  nets: Array<{shape: string, tiers: Array<string>, total: number, lines: number, perRelease: Record<string, {n: number, lines: number}>}>,
};
type Hit = {file: string, line: number, text: string, rank: number, by: string};
type WhereResult = {word: string, kind: string, needle: string, tried: Array<string>, row?: {file: string, line: number, text: string}, rest: Array<string>, hits: Array<Hit>};
type SourceFile = {path: string, text: string};
type Lib = {
  readCase: (event: SentryEvent) => Case,
  hasCause: (c: Case) => boolean,
  renderCase: (c: Case, opts?: {saveHint?: string}) => Sections,
  endingOf: (c: Case) => string,
  extraOf: (event: SentryEvent) => Record<string, unknown>,
  safeClassDir: (cls: string) => string,
  caseFolderName: (index: number, c: Case) => string,
  caseFiles: (c: Case) => Array<[string, Array<string>]>,
  caseSummaryMd: (c: Case, opts?: {index?: number, issue?: Record<string, unknown>, attachments?: Array<{name: string}>}) => string,
  classReadme: (input: {cls: string, cases: Array<{folder: string, case: Case}>, issues?: Array<Record<string, unknown>>, repro?: Array<{file: string, line: number, text: string}>, filters?: string}) => string,
  findReproductions: (files: Array<SourceFile>, cls: string) => Array<{file: string, line: number, text: string}>,
  mergeClassRows: (main: Array<Record<string, unknown>>, outcomes?: Array<Record<string, unknown>>, releases?: Array<Record<string, unknown>>) => Array<ClassRow>,
  renderClasses: (rows: Array<ClassRow>) => string,
  compareReleases: (a: string, b: string) => number,
  aggregateTrend: (ledgers: Array<unknown>) => Trend,
  renderTrend: (agg: Trend, opts?: {releasesMax?: number, classesMax?: number, sectionsMax?: number}) => string,
  fingerprintOf: (id: string) => string,
  historyFileName: (gameId: string, saveId: number) => string,
  parseHistoryListing: (text: string, gameId: string) => Array<number>,
  pickSaveId: (available: Array<number>, wanted: number) => {saveId: number, exact: boolean} | undefined,
  fixtureFromSave: (save: unknown) => {fixture: {players: Array<{name: string}>}, seats: Array<{index: number, color: string, bot: boolean, active: boolean}>, gameId: string, saveId?: number, phase: string},
  fixtureText: (fixture: unknown) => string,
  whereNeedles: (word: string) => Array<string>,
  whereLabelHits: (text: string, needle: string) => Array<Omit<Hit, 'file'>>,
  whereTagHits: (text: string, tag: string, lead?: string) => Array<Omit<Hit, 'file'>>,
  shapeFamilies: (shapesText: string) => Array<string>,
  shapeRowOf: (shapesText: string, shape: string) => {line: number, text: string, lead: string} | undefined,
  whereSearch: (files: Array<SourceFile>, word: string, opts?: {shapesText?: string, shapesPath?: string}) => WhereResult,
  renderWhere: (result: WhereResult, opts?: {max?: number}) => string,
};

const load = (): Promise<Lib> => import(pathToFileURL(path.join(__dirname, '..', '..', 'scripts', 'diag-lib.mjs')).href) as Promise<Lib>;

const HELD = 'liveness/stall/unserved/samplepick/sample:committed/block:sample';
const STRANDED = 'liveness/stall/unserved/samplepick/board/stranded+claim:sample-actions:awaiting';
const CEILING = 'wait-graph/ceiling/sample-placement:watchable-board';
const tags = (record: Record<string, string>): Array<Tag> => Object.entries(record).map(([key, value]) => ({key, value}));

/** An event as the collector's API answers it: the tags as a list, the contexts by name, `extra` under `context`. */
function stallEvent(over: Record<string, unknown> = {}): SentryEvent {
  return {
    eventID: 'a'.repeat(32), groupID: '161', dateCreated: '2026-11-14T13:18:59Z',
    title: '[liveness] the screen stood still (unserved · asked handPick) — cured after 18s by workspace-outcome',
    tags: tags({
      cause: HELD, shape: 'liveness/stall', tier: 'defect', kind: 'stall', family: 'liveness', reason: 'unserved', asked: 'card', task: 'handPick',
      where: 'sample:committed', holder: 'block:sample', source: 'Ganymede Colony', outcome: 'healed', stood: '10-20s', cure: 'workspace-outcome',
      run: 'mwgf1', release: 'terraforming-mars@1.2.3248', environment: 'box',
    }),
    contexts: {
      cause: {type: 'default', class: HELD, shape: 'liveness/stall', tier: 'defect', reason: 'unserved', holder: 'block:sample', section: 'hand/'},
      episode: {
        type: 'default', state: 'healed', outcome: 'healed', duration_s: 18, lines: 4, steps: ['rung 0: presentation-ledger: 2 stories degraded', 'rung 1: workspace-outcome: the claim released'],
        cured_by: 'workspace-outcome', cure: 'workspace-outcome: the claim released', changed: ['ended: claim:hand#7 12.0s awaiting', 'let go: holder: block:sample'],
        nets: ['presentation-ledger/story-degraded-by/sample-park ×1 (info)'],
      },
      evidence: {type: 'default', question: 'asked card#12 · task handPick', holders: ['holder: block:sample', 'hold card-receive [blocking] 11.2s of 35s'], input: 'A/B presses 3', taken_at: '2026-11-14T13:18:59.000Z'},
      save: {type: 'default', game_ref: 'g#6a335cb409', save_id: 17, fetch: 'npm run diag -- save g#6a335cb409 17'},
      screen: {type: 'default', screen: 'player-home', section: 'hand/'},
    },
    context: {
      title: 'stall (unserved): 12s without progress', text: '[liveness] stall (unserved): 12s without progress\n[liveness] recovered after 18s, 2 rung(s) run',
      flow_tree: ['session:game#1 120.0s', '  frame:hand#3 40.1s committed'], waits: ['claim:hand#7 [server] waits «the claimed answer»'],
      wait_graph: ['question:card#12 → admission:host:sample 12.0s'], flow_trace: ['-12.0s state claim:hand#7 awaiting', '-0.1s wait frame:hand#3'],
    },
    _meta: {contexts: null, tags: {}, context: {flow_tree: {'1': {'': {rem: [['!limit', 's', 20, 23]], len: 243}}, '': {len: 90}}}},
    ...over,
  };
}

describe('npm run diag — an event read as a case', () => {
  it('reads the cause, what stood, how it ended, the lists and the save — `extra` from where the collector puts it', async () => {
    const {readCase, extraOf, hasCause, endingOf} = await load();
    const event = stallEvent();
    expect(extraOf(event).title, 'the API answers `extra` under `context`').to.eq('stall (unserved): 12s without progress');
    const c = readCase(event);
    expect(hasCause(c)).to.eq(true);
    expect(c.cause).to.deep.include({cls: HELD, shape: 'liveness/stall', tier: 'defect'});
    expect(c.cause?.dims, 'the tags that are dimensions, and what only the context holds').to.deep.include({reason: 'unserved', source: 'Ganymede Colony', cure: 'workspace-outcome', section: 'hand/'});
    expect(c.evidence?.holders[0]).to.eq('holder: block:sample');
    expect(c.episode).to.deep.include({state: 'healed', outcome: 'healed', durationS: 18, curedBy: 'workspace-outcome'});
    expect(c.episode?.changed).to.have.length(2);
    expect(c.save).to.deep.eq({gameRef: 'g#6a335cb409', saveId: 17});
    expect(c.flowTree).to.have.length(2);
    expect(c.text.split('\n')).to.have.length(2);
    expect(c.release).to.eq('terraforming-mars@1.2.3248');
    expect(endingOf(c)).to.eq('healed after 18 s — cured by workspace-outcome');
    expect(c.cut, 'what the collector cut is NAMED: the list that lost its end, the line that lost its tail').to.deep.eq(['extra.flow_tree: 2 of 90 arrived', 'extra.flow_tree.1 (!limit)']);
  });

  it('a list that left in PARTS (the collector keeps ~16 KB of one value) is read back as one, in order', async () => {
    const {readCase} = await load();
    const event = stallEvent();
    const extra = event.context as Record<string, unknown>;
    extra.flow_tree_2 = ['    claim:hand#7 12.0s awaiting'];
    extra.flow_tree_3 = ['  transport#2 120.0s'];
    extra.flow_trace_2 = ['-0.0s end claim:hand#7 released'];
    extra.ending = 'cured after 18s by workspace-outcome';
    const c = readCase(event);
    expect(c.flowTree).to.deep.eq(['session:game#1 120.0s', '  frame:hand#3 40.1s committed', '    claim:hand#7 12.0s awaiting', '  transport#2 120.0s']);
    expect(c.flowTrace).to.have.length(3);
    expect(c.waits).to.have.length(1);
  });

  it('prints it in READING ORDER: the cause → what stood → the episode → the lines → the lists → the save', async () => {
    const {readCase, renderCase} = await load();
    const parts = renderCase(readCase(stallEvent()));
    expect(parts.cause[1]).to.eq(`  class  ${HELD}`);
    expect(parts.cause[3], 'the dimensions in the order a reader asks them').to.match(/^ {2}reason=unserved · asked=card · task=handPick · where=sample:committed · holder=block:sample · source=Ganymede Colony/);
    expect(parts.evidence.join('\n')).to.contain('  holders:\n    holder: block:sample\n    hold card-receive [blocking] 11.2s of 35s');
    const episode = parts.episode.join('\n');
    expect(episode).to.contain('state healed · outcome healed · stood 18 s · 4 line(s)');
    expect(episode).to.contain('cured by  workspace-outcome — workspace-outcome: the claim released');
    expect(episode).to.contain('    let go: holder: block:sample');
    expect(episode).to.contain('    presentation-ledger/story-degraded-by/sample-park ×1 (info)');
    expect(parts.lists.filter((l) => /^[A-Z]/.test(l))).to.deep.eq(['Flow tree (2):', 'Waits (1):', 'Wait graph (1):', 'Flow trace (2):']);
    expect(parts.save.join('\n')).to.contain('npm run diag -- save g#6a335cb409 17');
    expect(parts.cut[0]).to.contain('the collector CUT 2 value(s)');
  });

  it('an event with none of it (an exception, an event of an older build) has no cause to print', async () => {
    const {readCase, renderCase, hasCause} = await load();
    const old = readCase({eventID: 'b'.repeat(32), tags: tags({kind: 'stall', family: 'liveness'}), contexts: {episode: {type: 'default', state: 'healed', duration_s: 13, lines: 2, steps: ['rung 0']}}, context: {text: 'x'}});
    expect(hasCause(old)).to.eq(false);
    const parts = renderCase(old);
    expect([parts.cause, parts.evidence, parts.episode, parts.lines, parts.save]).to.deep.eq([[], [], [], [], []]);
  });

  it('a case is a folder in reading order, a class a README: the cases, the issue, the save, where it is reproduced', async () => {
    const {readCase, caseFolderName, caseFiles, caseSummaryMd, classReadme, safeClassDir} = await load();
    const healed = readCase(stallEvent());
    const reloaded = readCase(stallEvent({
      eventID: 'c'.repeat(32), dateCreated: '2026-11-14T13:19:21Z',
      tags: tags({cause: HELD, tier: 'defect', outcome: 'reload', stood: '20-40s', holder: 'block:sample', run: 'mwgf1', release: 'terraforming-mars@1.2.3248', environment: 'box'}),
      contexts: {
        cause: {type: 'default', class: HELD, shape: 'liveness/stall', tier: 'defect'},
        episode: {type: 'default', state: 'unhealed', outcome: 'reload', duration_s: 27, lines: 2, steps: []},
      },
    }));
    expect(caseFolderName(0, reloaded)).to.match(/^01-\d{8}-\d{6}-reload$/);
    expect(caseFolderName(1, healed)).to.match(/^02-\d{8}-\d{6}-healed$/);
    expect(caseFiles(healed).map(([name, lines]) => `${name}:${lines.length}`)).to.deep.eq(['01-lines.txt:2', '02-flow-tree.txt:2', '03-waits.txt:1', '04-wait-graph.txt:1', '05-flow-trace.txt:2']);
    expect(safeClassDir(HELD)).to.match(/^liveness__stall__unserved__samplepick__sample_committed__block_sample-[0-9a-f]{6}$/);
    expect(safeClassDir('a/b:c'), 'two classes that differ in a refused character never share a folder').to.not.eq(safeClassDir('a/b_c'));

    const summary = caseSummaryMd(healed, {index: 1, issue: {shortId: 'TM-J', permalink: 'https://x/issues/161/'}, attachments: [{name: 'hang_trace.json'}]});
    expect(summary).to.contain(`# ${HELD} — case 02`);
    expect(summary).to.contain('- **How it ended:** healed after 18 s — cured by workspace-outcome');
    expect(summary).to.contain('- holder: block:sample');
    expect(summary).to.contain('- cured by: **workspace-outcome** — workspace-outcome: the claim released');
    expect(summary).to.contain('  - let go: holder: block:sample');
    expect(summary).to.contain('`npm run diag -- save g#6a335cb409 17`');
    expect(summary).to.contain('- `hang_trace.json` — attached to the event');

    const issue = {shortId: 'TM-J', status: 'resolved', statusDetails: {inRelease: 'terraforming-mars@1.2.3250'}, count: '2', permalink: 'https://x/issues/161/'};
    const readme = classReadme({
      cls: HELD, issues: [issue], filters: 'the last 5',
      cases: [{folder: caseFolderName(0, reloaded), case: reloaded}, {folder: caseFolderName(1, healed), case: healed}],
      repro: [{file: 'tests/e2e/console-stall-cause.spec.ts', line: 40, text: `expect(cls).toBe('${HELD}');`}, {file: 'tests/server/diagnostics/diagnosticsHub.spec.ts', line: 631, text: `'${HELD}'`}],
    });
    expect(readme).to.contain('- issue: TM-J — resolved in 1.2.3250 · seen 2×');
    expect(readme).to.match(/\| 01 \| [^|]+ \| 1\.2\.3248 \| box \| reload \| 27 s \| — \|/);
    expect(readme).to.match(/\| 02 \| [^|]+ \| 1\.2\.3248 \| box \| healed \| 18 s \| workspace-outcome \| block:sample \| Ganymede Colony \| mwgf1 \|/);
    expect(readme).to.contain('`npm run diag -- save g#6a335cb409 17`');
    const [replays, samples] = readme.split('Also named by unit specs');
    expect(replays, 'what DRIVES the console is a reproduction').to.contain('`tests/e2e/console-stall-cause.spec.ts:40`');
    expect(samples, 'a unit spec that holds the key is a sample, said apart').to.contain('`tests/server/diagnostics/diagnosticsHub.spec.ts:631`');
    expect(classReadme({cls: HELD, cases: [], issues: [issue, {...issue, shortId: 'TM-K'}]}), 'a class the fingerprint did not group says so')
      .to.contain('ONE CLASS IS FILED UNDER 2 ISSUES').and.to.contain('a field case with no reproducing spec yet');
  });

  it('a class is found in the repo by its EXACT key — a longer class that starts with it is another class', async () => {
    const {findReproductions} = await load();
    const files = [
      {path: 'tests/e2e/a.spec.ts', text: `const a = '${HELD}';\nconst longer = '${HELD}/more';\n// the class ${HELD}.\nconst dotted = '${HELD}.journal';`},
      {path: 'tests/e2e/b.spec.ts', text: 'nothing of it'},
    ];
    expect(findReproductions(files, HELD).map((h) => `${h.file}:${h.line}`)).to.deep.eq(['tests/e2e/a.spec.ts:1', 'tests/e2e/a.spec.ts:3']);
  });
});

describe('npm run diag classes — one row per cause class', () => {
  it('merges the three grouped answers: events, runs, outcomes, the trend by release, the issue — the most events first', async () => {
    const {mergeClassRows, renderClasses} = await load();
    const rows = mergeClassRows(
      [
        {cause: STRANDED, tier: 'defect', kind: 'stall', issue: 'TM-N', issueId: 5, count: 1, runs: 1, first: '2026-11-14T13:19:26+00:00', last: '2026-11-14T13:19:26+00:00'},
        {cause: HELD, tier: 'defect', kind: 'stall', issue: 'TM-J', issueId: 3, count: 4, runs: 2, first: '2026-11-10T10:00:00+00:00', last: '2026-11-14T13:19:21+00:00'},
        {cause: '', count: 12},
      ],
      [{cause: HELD, outcome: 'healed', count: 3}, {cause: HELD, outcome: 'reload', count: 1}, {cause: STRANDED, outcome: '', count: 1}],
      [{cause: HELD, release: 'terraforming-mars@1.2.3251', count: 1}, {cause: HELD, release: 'terraforming-mars@1.2.3250', count: 3}, {cause: STRANDED, release: 'terraforming-mars@1.2.3251', count: 1}],
    );
    expect(rows.map((r) => r.cls), 'an event with no cause is not a class').to.deep.eq([HELD, STRANDED]);
    expect(rows[0]).to.deep.include({events: 4, runs: 2, runsExact: true, tier: 'defect', first: '2026-11-10T10:00:00+00:00', last: '2026-11-14T13:19:21+00:00'});
    expect(rows[0].outcomes).to.deep.eq({healed: 3, reload: 1});
    expect(rows[0].releases, 'left to right as time goes').to.deep.eq([{release: 'terraforming-mars@1.2.3250', n: 3}, {release: 'terraforming-mars@1.2.3251', n: 1}]);
    expect(rows[1].outcomes, 'a single line is not an episode').to.deep.eq({'no-episode': 1});
    const text = renderClasses(rows);
    expect(text.split('\n')[1]).to.match(/^4 +2 +defect +healed 3 · reload 1 .* TM-J +1\.2\.3250:3 1\.2\.3251:1 +liveness\/stall/);
  });

  it('a class the fingerprint split over two issues is ONE row that names both', async () => {
    const {mergeClassRows, renderClasses} = await load();
    const rows = mergeClassRows([
      {cause: HELD, tier: 'defect', issue: 'TM-J', issueId: 3, count: 2, runs: 2},
      {cause: HELD, tier: 'defect', issue: 'TM-Q', issueId: 9, count: 1, runs: 1},
    ]);
    expect(rows).to.have.length(1);
    expect(rows[0]).to.deep.include({events: 3, runs: 2, runsExact: false});
    expect(rows[0].issues.map((i) => i.shortId)).to.deep.eq(['TM-J', 'TM-Q']);
    expect(renderClasses(rows)).to.contain('TM-J+TM-Q ⚠SPLIT').and.to.contain('≥2');
  });
});

describe('npm run diag trend — «are freezes fewer?» from the session ledgers', () => {
  const frames = (n: number, worstMs: number, native: number, pressWaited: number, totalMs: number, scriptMs: number, forcedLayoutMs: number, styleLayoutMs: number, renderMs: number) =>
    ({n, worstMs, native, pressWaited, totalMs, scriptMs, forcedLayoutMs, styleLayoutMs, renderMs});
  const ledger = (run: string, release: string, over: Record<string, unknown> = {}) => ({
    run, release: `terraforming-mars@${release}`, environment: 'box', appMode: 'host', startedAt: 1_000, lastAt: 2_000, playMs: 3_600_000, games: 1, pages: 1,
    classes: {}, kinds: {}, episodes: [], stood: {}, outcomes: {}, longFrames: {}, rendererStops: 0, ...over,
  });
  const OLD = '1.2.9';
  const NEW = '1.2.10';
  const ledgers = [
    ledger('r1', OLD, {
      playMs: 2 * 3_600_000,
      classes: {[HELD]: {tier: 'defect', n: 4, lines: 11, sent: 2}, [CEILING]: {tier: 'planned', n: 6, lines: 6, sent: 0}, 'animation-hold/ceiling/sample-receive': {tier: 'defect', n: 1, lines: 1, sent: 1}},
      kinds: {error: 2, perf: 5}, outcomes: {healed: 3, reload: 1}, stood: {'10-20s': 3, 'over-40s': 1}, rendererStops: 1,
      episodes: [{cls: HELD, outcome: 'healed', stoodS: 14, cure: 'presentation-ledger', atPlayS: 60}],
      // (A ledger of a build before the split of a long frame existed: only the three first fields.)
      longFrames: {'hand/': {n: 2, worstMs: 700, native: 1}},
    }),
    ledger('r2', NEW, {
      classes: {[HELD]: {tier: 'defect', n: 1, lines: 3, sent: 1}, [CEILING]: {tier: 'planned', n: 2, lines: 2, sent: 0}},
      outcomes: {healed: 1}, stood: {'5-10s': 1},
      longFrames: {'hand/': frames(3, 812, 2, 1, 2000, 600, 200, 400, 1000), 'parliament/': frames(1, 640, 0, 0, 640, 480, 60, 100, 60)},
    }),
    ledger('r3', NEW, {playMs: 3 * 3_600_000}),
    // The same run counted twice (an outbox flushed twice): taken once, the fuller one.
    ledger('r2', NEW, {lastAt: 1_500, classes: {[HELD]: {tier: 'defect', n: 9, lines: 9, sent: 2}}}),
    undefined, {extra: 'not a ledger'},
  ];

  it('sums by release, the newest first — sessions and hours are the denominator of every rate', async () => {
    const {aggregateTrend, compareReleases} = await load();
    expect(['terraforming-mars@1.2.9', 'terraforming-mars@1.2.10', 'dev'].sort(compareReleases), 'versions compare as numbers, not as text').to.deep.eq(['terraforming-mars@1.2.10', 'terraforming-mars@1.2.9', 'dev']);
    const agg = aggregateTrend(ledgers);
    expect(agg).to.deep.include({sessions: 3, skipped: 2, playHours: 6});
    expect(agg.releases.map((r) => r.release)).to.deep.eq([`terraforming-mars@${NEW}`, `terraforming-mars@${OLD}`]);
    const [now, before] = agg.releases;
    expect(before).to.deep.include({sessions: 1, playHours: 2, defects: 5, defectsPerHour: 2.5, defectsPerSession: 5, episodes: 4, episodesPerHour: 2, rendererStops: 1, errors: 2});
    expect(before.outcomeShares).to.deep.eq({healed: 75, reload: 25});
    expect(before.stood).to.deep.eq({'10-20s': 3, 'over-40s': 1});
    expect(now, 'a planned wait is not a defect; a session with nothing in it still counts as a session').to.deep.include(
      {sessions: 2, playHours: 4, defects: 1, defectsPerHour: 0.25, defectsPerSession: 0.5, episodes: 1, episodesPerHour: 0.25, episodesPerSession: 0.5});
  });

  it('long frames say where their time went — and a ledger without the split counts as frames with none', async () => {
    const {aggregateTrend} = await load();
    const [now, before] = aggregateTrend(ledgers).releases;
    expect(now.longFrames).to.deep.include({n: 4, worstMs: 812, native: 2, pressWaited: 1, totalMs: 2640});
    expect(now.longFrames.shares).to.deep.eq({script: 40.9, forcedLayout: 9.8, styleLayout: 18.9, render: 40.2});
    expect(now.longFrames.sections.map((s) => s.section), 'the section that cost the most first').to.deep.eq(['hand/', 'parliament/']);
    expect(now.longFrames.sections[1].shares.script).to.eq(75);
    expect(before.longFrames).to.deep.include({n: 2, worstMs: 700, native: 1, pressWaited: 0, totalMs: 0});
    expect(before.longFrames.shares.script, 'no total — no share').to.eq(null);
  });

  it('the top classes carry their count per release, and EVERY net has a row — a zero is the evidence a retirement needs', async () => {
    const {aggregateTrend} = await load();
    const agg = aggregateTrend(ledgers);
    expect(agg.topClasses.map((c) => c.cls), 'defect classes only').to.deep.eq([HELD, 'animation-hold/ceiling/sample-receive']);
    expect(agg.topClasses[0]).to.deep.include({total: 5, lines: 14, sent: 3});
    expect(agg.topClasses[0].perRelease).to.deep.eq({[`terraforming-mars@${NEW}`]: 1, [`terraforming-mars@${OLD}`]: 4});
    const net = (shape: string) => agg.nets.find((n) => n.shape === shape);
    expect(net('wait-graph/ceiling')).to.deep.include({total: 8, lines: 8, tiers: ['planned']});
    expect(net('animation-hold/ceiling')?.perRelease, 'a net that fired in the old release and not in the new one: its zero is there')
      .to.deep.eq({[`terraforming-mars@${NEW}`]: {n: 0, lines: 0}, [`terraforming-mars@${OLD}`]: {n: 1, lines: 1}});
    expect(net('liveness/stall')?.perRelease[`terraforming-mars@${NEW}`]).to.deep.eq({n: 1, lines: 3});
  });

  it('prints the answer: the table by release, each release\'s endings, the classes and the nets as matrices', async () => {
    const {aggregateTrend, renderTrend} = await load();
    const text = renderTrend(aggregateTrend(ledgers));
    expect(text).to.contain('3 session(s), 6 h of play');
    expect(text).to.match(/\n1\.2\.10 +2 +4 +1 +0\.25 +0\.5 +1 +0\.25 +0\.5 +0 +0 +4\n1\.2\.9 +1 +2 +5 +2\.5 +5 +4 +2 +4 +1 +2 +2\n/);
    expect(text).to.contain('how the episodes ended: healed 3 (75 %) · reload 1 (25 %)');
    expect(text).to.contain('how long they stood:    10-20s 3 · over-40s 1');
    expect(text).to.contain('script 40.9 % (of it forced layout 9.8 %) · style+layout 18.9 % · render 40.2 %');
    expect(text).to.contain('where the time went: not recorded');
    expect(text).to.match(/\n5 +1 \(0\.25\/h\) +4 \(2\/h\) +liveness\/stall\/unserved\/samplepick/);
    expect(text, 'the net that did not fire in the new release has its zero').to.match(/\n1 +1 +defect +0 +1\/1 +animation-hold\/ceiling$/);
    expect(renderTrend(aggregateTrend([]))).to.contain('No session ledger to read');
  });
});

describe('npm run diag save — the game as it stood when an episode began', () => {
  it('a fingerprint is the print the game\'s own scrub makes; a history file is named as the server names it', async () => {
    const {fingerprintOf, historyFileName, parseHistoryListing, pickSaveId} = await load();
    const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
    for (const id of ['gce2206994265', 'p1a2b3c4d5e6f', 's0f0f0f0f0f0f']) {
      expect(fingerprintOf(id), 'the same function as src/common/diagnostics/privacy.ts').to.eq(fingerprintId(id, sha256));
    }
    expect(historyFileName('gce2206994265', 17), 'LocalFilesystem.historyFilename: five digits').to.eq('gce2206994265-00017.json');
    expect(historyFileName('gce2206994265', 123456)).to.eq('gce2206994265-123456.json');
    const listing = 'gce2206994265-00000.json\n/home/deck/x/history/gce2206994265-00130.json\ngce2206994265-00016.json\ngce22069942650-00017.json\ngce2206994265-00017.tmp\nnotes.txt\n';
    const available = parseHistoryListing(listing, 'gce2206994265');
    expect(available, 'another game whose id merely starts with this one is not this game').to.deep.eq([0, 16, 130]);
    expect(pickSaveId(available, 16)).to.deep.eq({saveId: 16, exact: true});
    expect(pickSaveId(available, 17), 'the save is gone: the nearest BELOW').to.deep.eq({saveId: 16, exact: false});
    expect(pickSaveId([5, 9], 3), 'nothing at or below').to.eq(undefined);
  });

  it('a save becomes a fixture AS SAVED, its names anonymized — the bot keeps its own, the save itself is not touched', async () => {
    const {fixtureFromSave, fixtureText} = await load();
    const save = {
      id: 'gce2206994265', lastSaveId: 130, phase: 'action', generation: 4, activePlayer: 'p2',
      players: [{id: 'p1', name: 'Owner', color: 'blue'}, {id: 'p2', name: 'Guest', color: 'pink'}, {id: 'p3', name: 'MarsBot', color: 'red', isMarsBot: true}],
    };
    const made = fixtureFromSave(save);
    expect(made.fixture.players.map((p) => p.name)).to.deep.eq(['seat1', 'seat2', 'MarsBot']);
    expect(save.players[0].name, 'the source is left as it was').to.eq('Owner');
    expect(made).to.deep.include({gameId: 'gce2206994265', saveId: 130, phase: 'action'});
    expect(made.seats).to.deep.eq([
      {index: 0, color: 'blue', bot: false, active: false}, {index: 1, color: 'pink', bot: false, active: true}, {index: 2, color: 'red', bot: true, active: false},
    ]);
    const text = fixtureText(made.fixture);
    expect(text.endsWith('}\n'), 'written the way the generator writes a fixture').to.eq(true);
    expect(text).to.not.contain('Owner');
    expect(() => fixtureFromSave({players: []}), 'what the loader would refuse is refused here').to.throw('not a SerializedGame');
  });
});

describe('npm run diag where — from a word of the evidence to its source', () => {
  const HERO = [
    'const heroRun = createFlowRun(\'played-hero\', {orphaned: () => abort()});',
    ' * registerAnimationHoldSupplier(\'played-hero\', holding);   (a comment never declares)',
    'registerAnimationHoldSupplier(\'played-hero\', holding, {',
    '  await raceCeiling({',
    '    id: \'played-hero:payback\', owner: \'playedHero\', what: \'the answer\',',
    '  });',
    'const wait = beginCeilingWait({id: \'played-hero:flight\', owner: \'playedHero\', maxMs: 1});',
    'if (owner === \'played-hero\') {',
    'registerWaitRecovery(',
    '  \'question-open\', () => reopen(),',
    ');',
    'const scope = session.open(\'scene\', \'deck-draw-layer\');',
  ].join('\n');
  const ADMISSION = [
    'export type AdmissionBlock =',
    '  /** A reveal overlay is up. */',
    '  | \'reveal\'',
    '  /** The played-card hero scene. */',
    '  | \'played-hero\';',
    'const ORDER = [',
    '  \'reveal\', \'played-hero\',',
    '];',
    'registerLivenessRelease({',
    '  rank: 20,',
    '  name: \'workspace-outcome\',',
    '});',
    'const row = {kind: \'reveal\', label: \'x\'};',
    'export type FocusPhase = \'setup\' | \'reveal\' | \'draw\';',
  ].join('\n');
  const SUPERVISOR = [
    '      console.warn(`[workspace-stale] concluded «${top.kind}» — it stood committed`);',
    '   * (`[workspace-stale] concluded`, red in every e2e spec)',
    '      console.warn(',
    '        `[wait-graph] ceiling ${spec.id} (${spec.owner}) — «${spec.what}» did not come in ${ms} ms`);',
    '      console.warn(`[wait-graph] ${finding.kind} ${members} — standing`);',
    '      console.warn(`[wait-graph] cure ${kind} at ${id} through «${door}» — ${did}`);',
  ].join('\n');
  const SHAPES = [
    'export const DIAG_SHAPES = {',
    '  \'workspace-stale\': [',
    '    {name: \'concluded\', re: /^concluded «([^»]*)» — /, tier: \'defect\', parts: [1]},',
    '  ],',
    '  \'wait-graph\': [',
    '    {',
    '      name: \'ceiling\', re: /^ceiling (\\S+) \\(([^:)]*)(?:: [^)]*)?\\) — «(.*)» did not come in /, tier: \'defect\', parts: [1],',
    '    },',
    '    {name: \'cure\', re: /^cure (\\S+) at (\\S+) through «([^»]*)» — /, tier: \'info\', parts: [1, 3]},',
    '    {',
    '      name: \'finding\', re: /^(cycle|dangling|dead-end|overdue|unbounded) (.*?) — /, tier: \'defect\',',
    '    },',
    '  ],',
    '};',
  ].join('\n');
  const files = [
    {path: 'src/client/console/played/hero.ts', text: HERO},
    {path: 'src/client/console/admission.ts', text: ADMISSION},
    {path: 'src/client/console/supervisor.ts', text: SUPERVISOR},
  ];

  it('strips the run number and the kinds: the whole word first, then what is left of it', async () => {
    const {whereNeedles} = await load();
    expect(whereNeedles('frame:hand#3')).to.deep.eq(['frame:hand', 'hand']);
    expect(whereNeedles('scene:hold:played-hero#12')).to.deep.eq(['scene:hold:played-hero', 'hold:played-hero', 'played-hero']);
    expect(whereNeedles('played-hero:payback'), 'a wait\'s id is a name with a colon of its own').to.deep.eq(['played-hero:payback', 'payback', 'played-hero']);
    expect(whereNeedles('stranded+claim:card-actions:awaiting'), 'the kinds alone are never a name').to.deep.eq(
      ['stranded+claim:card-actions:awaiting', 'card-actions:awaiting', 'card-actions', 'stranded+claim']);
    expect(whereNeedles('«card-receive»')).to.deep.eq(['card-receive']);
    expect(whereNeedles('beat'), 'a word that is only a kind is searched as it is').to.deep.eq(['beat']);
  });

  it('a declaration is a scope\'s / a hold\'s / a wait\'s / a door\'s own call, a union\'s member, a property — in that order; a comment never is', async () => {
    const {whereLabelHits} = await load();
    const hero = whereLabelHits(HERO, 'played-hero');
    expect(hero.map((h) => `${h.line}:${h.rank}:${h.by}`)).to.deep.eq(['1:0:createFlowRun', '2:3:', '3:0:registerAnimationHoldSupplier', '8:3:']);
    expect(whereLabelHits(HERO, 'played-hero:payback').map((h) => `${h.line}:${h.rank}:${h.by}`), 'the id on the line under its call').to.deep.eq(['5:0:raceCeiling']);
    expect(whereLabelHits(HERO, 'played-hero:flight')[0]).to.deep.include({rank: 0, by: 'beginCeilingWait'});
    expect(whereLabelHits(HERO, 'question-open')[0], 'the first argument on the next line').to.deep.include({line: 10, rank: 0, by: 'registerWaitRecovery'});
    expect(whereLabelHits(HERO, 'deck-draw-layer')[0]).to.deep.include({rank: 0, by: '.open'});
    const reveal = whereLabelHits(ADMISSION, 'reveal');
    expect(reveal.map((h) => `${h.line}:${h.rank}:${h.by}`), 'a member of a union, a list\'s element, a property, a one-line union').to.deep.eq(
      ['3:1:type AdmissionBlock', '7:3:', '13:2:kind:', '14:1:type FocusPhase']);
    expect(whereLabelHits(ADMISSION, 'workspace-outcome')[0]).to.deep.include({line: 11, rank: 0, by: 'registerLivenessRelease'});
    expect(whereLabelHits(HERO, 'nothing-of-the-kind')).to.deep.eq([]);
  });

  it('finds the name: the kind it was printed with says which declaration is meant, and the declarations stand first', async () => {
    const {whereSearch, renderWhere} = await load();
    const hero = whereSearch(files, 'scene:hold:played-hero#12');
    expect(hero).to.deep.include({kind: 'label', needle: 'played-hero'});
    expect(hero.hits.map((h) => `${h.file.split('/').pop()}:${h.line}:${h.rank}`), 'the HOLD first — the word said `hold`')
      .to.deep.eq(['hero.ts:3:0', 'hero.ts:1:0', 'admission.ts:5:1', 'admission.ts:7:3', 'hero.ts:2:3', 'hero.ts:8:3']);
    const block = whereSearch(files, 'block:reveal');
    expect(block.hits[0], 'the AdmissionBlock — not another union with a `reveal`').to.deep.include({by: 'type AdmissionBlock', line: 3});
    const text = renderWhere(hero);
    expect(text).to.contain('«scene:hold:played-hero#12» → \'played-hero\'   (no declaration of \'scene:hold:played-hero\', \'hold:played-hero\')');
    expect(text.indexOf('DECLARED (3):')).to.be.lessThan(text.indexOf('OTHER MENTIONS (3):'));
    expect(text).to.contain('  src/client/console/played/hero.ts:3  [registerAnimationHoldSupplier] registerAnimationHoldSupplier(\'played-hero\', holding, {');
    const nothing = whereSearch(files, 'frame:no-such-thing#1');
    expect(nothing).to.deep.include({needle: '', kind: 'label'});
    expect(renderWhere(nothing)).to.contain('no string literal of the client or the Electron lane names it (tried: \'frame:no-such-thing\', \'no-such-thing\')');
  });

  it('a tag leads to its prints; a shape to its row of the table and to the prints of ITS line — a class to its shape', async () => {
    const {whereSearch, whereTagHits, shapeFamilies, shapeRowOf, renderWhere} = await load();
    expect(whereTagHits(SUPERVISOR, 'workspace-stale').map((h) => `${h.line}:${h.rank}`), 'a comment mentions, a console call prints').to.deep.eq(['1:0', '2:3']);
    const electron = 'say(\'renderer-hang\', `[renderer-hang] the page stopped answering — the last screen (${last})`);\nconst TAG = \'[renderer-hang]\';';
    expect(whereTagHits(electron, 'renderer-hang').map((h) => `${h.line}:${h.rank}`), 'the Electron lane prints through its own `say`: an argument of a call is a print, a constant is a mention')
      .to.deep.eq(['1:0', '2:3']);
    const tag = whereSearch(files, '[workspace-stale]', {shapesText: SHAPES});
    expect(tag).to.deep.include({kind: 'tag', needle: '[workspace-stale]'});
    expect(tag.hits[0]).to.deep.include({file: 'src/client/console/supervisor.ts', line: 1, rank: 0, by: 'prints'});

    expect(shapeFamilies(SHAPES)).to.deep.eq(['workspace-stale', 'wait-graph']);
    expect(shapeRowOf(SHAPES, 'wait-graph/ceiling')).to.deep.include({line: 7, lead: 'ceiling '});
    expect(shapeRowOf(SHAPES, 'wait-graph/dead-end'), 'a finding is named by its row\'s alternation: the row, and no fixed words').to.deep.include({line: 11, lead: ''});
    expect(shapeRowOf(SHAPES, 'wait-graph/no-such-shape')).to.eq(undefined);

    const shape = whereSearch(files, 'wait-graph/ceiling', {shapesText: SHAPES, shapesPath: 'src/common/diagnostics/shapes.ts'});
    expect(shape).to.deep.include({kind: 'shape', needle: '[wait-graph] ceiling'});
    expect(shape.row).to.deep.include({file: 'src/common/diagnostics/shapes.ts', line: 7});
    expect(shape.hits.map((h) => `${h.line}:${h.rank}`), 'only the line of THIS shape (its string stands under the console call)').to.deep.eq(['4:0']);

    const cls = whereSearch(files, 'wait-graph/dead-end/question:card', {shapesText: SHAPES});
    expect(cls).to.deep.include({kind: 'class', needle: '[wait-graph]'});
    expect(cls.rest).to.deep.eq(['question:card']);
    expect(cls.hits.filter((h) => h.rank === 0).map((h) => h.line), 'a line built from parts: every print of the tag').to.deep.eq([4, 5, 6]);
    const text = renderWhere(cls);
    expect(text).to.contain('THE SHAPE\'S ROW');
    expect(text).to.contain('The class\'s own words: question:card');
    expect(whereSearch(files, 'hand/Ganymede Colony', {shapesText: SHAPES}).kind, 'a word with a slash whose head is no family is a label').to.eq('label');
  });

  it('prints about thirty lines whatever was found — the declarations keep their place', async () => {
    const {whereSearch, renderWhere} = await load();
    const many = {path: 'src/client/many.ts', text: Array.from({length: 80}, (_, i) => `if (x${i} === 'played-hero') {`).join('\n')};
    const text = renderWhere(whereSearch([...files, many], 'played-hero'), {max: 30});
    expect(text).to.contain('DECLARED (3):').and.to.contain('OTHER MENTIONS (83):').and.to.contain('… +56 more');
    expect(text.split('\n').length).to.be.lessThan(40);
  });
});
