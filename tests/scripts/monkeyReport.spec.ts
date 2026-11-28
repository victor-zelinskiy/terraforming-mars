import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {pathToFileURL} from 'url';

/*
 * THE MONKEY'S REPORT (scripts/monkey-report.mjs — docs/claude/console/freeze-zero/PLAN.md §3.3, §5): a run summed BY
 * CAUSE CLASS from the files every e2e test writes (`tests/e2e/causeHarvest.ts`), compared with an earlier run, and
 * judged by the bar's gate — no episode left uncured, no NEW defect class.
 */
type Episode = {outcome: string, stoodS: number, cure: string, nets: Array<{cls: string, tier: string, n: number}>};
type Rec = {cls: string, shape: string, tier: string, family: string, page: number, count: number, lines: number, atMs: number, title: string, dims: Record<string, string>, episode?: Episode};
type File = {file: string, title: string, retry: number, status?: string, monkey?: {seed: string, presses: number}, records: Array<Rec>, autopilot?: Pilot};
type ClassRow = {tier: string, shape: string, tests: number, records: number, lines: number, outcomes: Record<string, number>, worstStoodS: number, first?: {file: string, title: string, seed?: string}};
type Report = {
  owner?: {verdicts: Record<string, number>, spans?: Record<string, {n: number, ms: number, max: number, tables: Array<string>}>, walks?: number, looks?: number, rows?: object, open?: object, disagreements?: Array<never>},
  autopilot?: Whole,
  totals: {tests: number, walks: number, presses: number, records: number, defects: number, episodes: number, notCured: number, outcomes: Record<string, number>},
  classes: Record<string, ClassRow>,
  nets: Record<string, {tier: string, records: number, lines: number, tests: number, per1000Presses: number | null}>,
};
type Diff = {newClasses: Array<string>, goneClasses: Array<string>, kept: Array<string>};
type Lib = {
  aggregateCauseFiles: (files: Array<File>) => Report,
  compareReports: (now: Report, before: Report | undefined) => Diff,
  gateVerdict: (report: Report, diff?: Diff, opts?: {zero?: boolean, expect?: number}) => {pass: boolean, reasons: Array<string>},
  beatLawBroken: (report: Pick<Report, 'owner'>) => Array<[string, number, number, Array<string>]>,
  BEAT_LAW_QUIET_MS: number,
  renderOwner: (owner: Report['owner']) => string,
  renderReport: (report: Report, diff?: Diff) => string,
  shapeOfClass: (cls: string) => string,
  aggregateAutopilot: (files: Array<File>) => Whole | undefined,
  renderAutopilot: (whole: Whole | undefined) => string,
  inputTypesReach: (declared: Array<string>, sources: Array<{file: string, text: string}>, replaced: Array<string>) =>
    {reachable: Array<string>, excluded: Array<{type: string, why: string}>},
};
type Pilot = {end: string, generation: number, phase: string, presses: number, byUi: Record<string, number>, byApi: Record<string, number>, passes: {ui: number, api: number}, tookMs: number, rebuilds?: number, doors?: Array<string>};
type Whole = {games: number, finished: number, capped: Array<string>, stuck: Array<string>, rebuilds: number, presses: number, byUi: number, byApi: number, passes: {ui: number, api: number}, playMin: number, doors: Array<{where: string, n: number, games: number}>};

const load = (): Promise<Lib> => import(pathToFileURL(path.join(__dirname, '..', '..', 'scripts', 'monkey-report.mjs')).href) as Promise<Lib>;

const rec = (cls: string, tier: string, episode?: Episode): Rec => ({
  cls, shape: cls.split('/').slice(0, 2).join('/'), tier, family: cls.split('/')[0], page: 0, count: 1, lines: episode === undefined ? 1 : 3,
  atMs: 1_000, title: 'a line', dims: {}, ...(episode !== undefined ? {episode} : {}),
});
const STALL = 'liveness/stall/unserved/handpick/hand:committed/block:reveal';
const CEILING = 'wait-graph/ceiling/remote-placement:watchable-board';
const walk = (fixture: string, records: Array<Rec>, retry = 0): File => ({
  file: 'console-monkey.spec.ts', title: `monkey · ${fixture}`, retry, monkey: {seed: `s:${fixture}`, presses: 100}, records,
});

describe('the monkey\'s report — a run summed by cause class', () => {
  it('counts classes by tier, walks and presses — and what spoke inside an episode under its own class', async () => {
    const {aggregateCauseFiles} = await load();
    const report = aggregateCauseFiles([
      walk('a', [rec(STALL, 'defect', {outcome: 'healed', stoodS: 14, cure: 'presentation-ledger', nets: [{cls: 'presentation-ledger/story-degraded-by/board-beat-park', tier: 'info', n: 2}]}), rec(CEILING, 'planned')]),
      walk('b', [rec(CEILING, 'planned'), rec(CEILING, 'planned')]),
      walk('c', []),
    ]);
    expect(report.totals).to.deep.include({tests: 3, walks: 3, presses: 300, records: 4, defects: 1, episodes: 1, notCured: 0});
    expect(report.classes[STALL]).to.deep.include({tier: 'defect', tests: 1, records: 1, worstStoodS: 14});
    expect(report.classes[STALL].outcomes).to.deep.eq({healed: 1});
    expect(report.classes[STALL].first).to.deep.include({title: 'monkey · a', seed: 's:a'});
    expect(report.classes[CEILING]).to.deep.include({tier: 'planned', tests: 2, records: 3});
    expect(report.classes['presentation-ledger/story-degraded-by/board-beat-park'], 'the echo inside the episode fired too').to.deep.include({tier: 'info', records: 1, lines: 2});
    expect(report.nets['wait-graph/ceiling']).to.deep.include({records: 3, per1000Presses: 10});
    expect(report.nets['liveness/stall'].per1000Presses).to.eq(3.33);
  });

  it('A CLASS IS AS BAD AS ITS WORST RECORD: a defect behind a planned record of the same class is named, gated and re-runnable', async () => {
    const {aggregateCauseFiles, compareReports, gateVerdict, renderReport} = await load();
    // One class, read at two tiers by who owned the wait (`shapes.ts` story-due) — the planned one is met FIRST.
    const PARK = 'presentation-ledger/story-due/board-beat-park';
    const report = aggregateCauseFiles([
      walk('a-covered-by-the-player', [rec(PARK, 'planned')]),
      walk('b-seen-and-not-told', [rec(PARK, 'defect')]),
      walk('c-covered-again', [rec(PARK, 'planned')]),
    ]);
    expect(report.totals.defects).to.eq(1);
    expect(report.classes[PARK]).to.deep.include({tier: 'defect', tests: 3, records: 3});
    expect((report.classes[PARK] as unknown as {tiers: Record<string, number>}).tiers).to.deep.eq({planned: 2, defect: 1});
    expect(report.classes[PARK].first, 'the record to re-run is the DEFECT, never the first one met').to.deep.include({title: 'monkey · b-seen-and-not-told', seed: 's:b-seen-and-not-told'});
    expect(report.nets['presentation-ledger/story-due'].tier).to.eq('defect');
    const before = aggregateCauseFiles([walk('a-covered-by-the-player', [rec(PARK, 'planned')])]);
    const diff = compareReports(report, before);
    expect(diff.newClasses, 'the earlier run held it as a planned wait only').to.deep.eq([PARK]);
    expect(gateVerdict(report, diff).pass).to.eq(false);
    const text = renderReport(report, diff);
    expect(text).to.contain('── DEFECT classes (1) ──');
    expect(text).to.contain(`${PARK}   {planned 2, defect 1}`);
    expect(text).to.contain('seed s:b-seen-and-not-told');
    // …and an episode's inner net raises a class the same way.
    const inner = aggregateCauseFiles([
      walk('a', [rec(CEILING, 'planned')]),
      walk('b', [rec(STALL, 'defect', {outcome: 'healed', stoodS: 9, cure: 'x', nets: [{cls: CEILING, tier: 'defect', n: 1}]})]),
    ]);
    expect(inner.classes[CEILING].tier).to.eq('defect');
  });

  it('a retried test counts by its LAST run', async () => {
    const {aggregateCauseFiles} = await load();
    const report = aggregateCauseFiles([
      walk('a', [rec(STALL, 'defect', {outcome: 'test-ended', stoodS: 30, cure: '', nets: []})], 0),
      walk('a', [], 1),
    ]);
    expect(report.totals).to.deep.include({tests: 1, walks: 1, presses: 100, records: 0, notCured: 0});
  });

  it('THE GATE: an episode never cured fails it; a NEW defect class against the earlier run fails it; a planned wait never does', async () => {
    const {aggregateCauseFiles, compareReports, gateVerdict, renderReport} = await load();
    const before = aggregateCauseFiles([walk('a', [rec(STALL, 'defect', {outcome: 'healed', stoodS: 12, cure: 'x', nets: []})])]);
    const same = aggregateCauseFiles([walk('a', [rec(STALL, 'defect', {outcome: 'healed', stoodS: 11, cure: 'x', nets: []}), rec(CEILING, 'planned')])]);
    const diffSame = compareReports(same, before);
    expect(diffSame).to.deep.eq({newClasses: [], goneClasses: [], kept: [STALL]});
    expect(gateVerdict(same, diffSame).pass, 'the same defect class, healed, and a new PLANNED wait').to.eq(true);

    const fresh = aggregateCauseFiles([walk('a', [rec('wait-graph/dead-end/question:card', 'defect')])]);
    const diffFresh = compareReports(fresh, before);
    expect(diffFresh.newClasses).to.deep.eq(['wait-graph/dead-end/question:card']);
    expect(diffFresh.goneClasses).to.deep.eq([STALL]);
    expect(gateVerdict(fresh, diffFresh)).to.deep.include({pass: false});

    const stuck = aggregateCauseFiles([walk('a', [rec(STALL, 'defect', {outcome: 'reload', stoodS: 40, cure: '', nets: []})])]);
    const verdict = gateVerdict(stuck, compareReports(stuck, before));
    expect(verdict.pass).to.eq(false);
    expect(verdict.reasons[0]).to.eq('1 episode(s) were never cured');
    const text = renderReport(stuck, compareReports(stuck, before));
    expect(text).to.contain('NEVER CURED 1');
    expect(text).to.contain(STALL);
    expect(text).to.contain('seed s:a');
  });

  it('THE GATE holds the ONE-OWNER LAW at zero: a press on another rung, a surface beside the answer, a latch — each fails it by name', async () => {
    const {aggregateCauseFiles, gateVerdict} = await load();
    const clean = aggregateCauseFiles([walk('a', [])]);
    // (No walk carried the measure: nothing to hold.)
    expect(gateVerdict(clean).pass).to.eq(true);
    // The measure at zero where it counts — agreement, holds, the player's own looks and beats are no breach.
    expect(gateVerdict({...clean, owner: {verdicts: {'agree': 40, 'held': 60, 'pad-agree': 9, 'pad-held': 30, 'pad-look': 4, 'band-agree': 9, 'band-above': 5, 'band-fallback': 2, 'bar-agree': 40, 'bar-look': 3, 'bar-beat': 1, 'flag-agree': 40, 'edge-agree': 100, 'unsettled': 1}}}).pass).to.eq(true);
    const broken = gateVerdict({...clean, owner: {verdicts: {'agree': 40, 'bar-APART': 3, 'flag-EXTRA': 1, 'edge-LATCH': 2}}});
    expect(broken.pass).to.eq(false);
    expect(broken.reasons.map((r) => r.split(':')[0])).to.deep.eq([
      'the one-owner law — bar-APART ×3', 'the one-owner law — flag-EXTRA ×1', 'the one-owner law — edge-LATCH ×2',
    ]);
  });

  /*
   * THE BEAT LAW (FREEZE ZERO, stage 3): a transient beat with nothing in flight under it, past the doors' own bar, is
   * a stall or a pause nobody declared — three stood on healthy tables when the track first read honestly. A beat that
   * is BUSY however long, and a quiet hand-off of a few frames, are no breach.
   */
  it('THE GATE holds the BEAT LAW at zero: a beat that stood quiet past the bar fails it by name — a busy beat and a hand-off never do', async () => {
    const {aggregateCauseFiles, gateVerdict, beatLawBroken, renderOwner, BEAT_LAW_QUIET_MS} = await load();
    const clean = aggregateCauseFiles([walk('a', [])]);
    const span = (n: number, max: number, tables: Array<string>) => ({n, ms: n * max, max, tables});
    const measured = {verdicts: {agree: 40}, walks: 2, looks: 40, rows: {}, open: {}, disagreements: []};
    const healthy = {...clean, owner: {...measured, spans: {
      'beat|hand:executing · busy[hold:hold:played-hero] → moved': span(162, 1504, ['a']),
      'beat|standard-projects:completing · busy[kernel:surface:std-projects-controller] → gone': span(72, 304, ['b']),
      // A hand-off between two flights: one ends, the next rises a frame later.
      'beat|hand:executing · QUIET{game·N} → moved': span(3, 32, ['a']),
      // Another track's quiet is that track's own business.
      'conclude|hand · dismiss · QUIET → left': span(4, 900, ['a']),
    }}};
    expect(beatLawBroken(healthy)).to.deep.eq([]);
    expect(gateVerdict(healthy).pass).to.eq(true);
    expect(renderOwner(healthy.owner)).to.contain('THE BEAT LAW — 237 span(s) of a transient beat: QUIET 3 (longest 32 ms; the bar is 250 ms)');
    const broken = {...clean, owner: {...measured, spans: {
      ...healthy.owner.spans,
      'beat|standard-projects:completing · QUIET{game·N} → gone': span(72, 304, ['sp-greenery', 'sp-city']),
      'beat|hydro:completing · reveal · QUIET{game·N} → gone': span(11, 1230, ['hydro']),
      'beat|hydro:completing · QUIET{game·N · flow·N} → moved': span(2, 1070, ['hydro', 'hydro-two']),
    }}};
    expect(beatLawBroken(broken), 'by beat, the longest first, the tables named once').to.deep.eq([
      ['hydro:completing', 13, 1230, ['hydro', 'hydro-two']],
      ['standard-projects:completing', 72, 304, ['sp-greenery', 'sp-city']],
    ]);
    const verdict = gateVerdict(broken);
    expect(verdict.pass).to.eq(false);
    expect(verdict.reasons.map((r) => r.split(' with nothing')[0])).to.deep.eq([
      'the beat law — «hydro:completing» stood 1230 ms', 'the beat law — «standard-projects:completing» stood 304 ms',
    ]);
    expect(renderOwner(broken.owner)).to.contain('  BROKEN: «hydro:completing» stood 1230 ms with nothing in flight under it ×13  [hydro, hydro-two]');
    // The bar is the doors' own: past a hand-off, never seconds.
    expect(BEAT_LAW_QUIET_MS).to.be.at.least(200).and.at.most(500);
  });
  it('the autopilot\'s baselines: the bottle\'s rows are defect classes that say WHY they may stand; the real browser\'s holds none', () => {
    const read = (file: string) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8')) as {classes: Record<string, {tier: string, why?: string}>};
    const bottle = read('tests/client/bottle/autopilotBaseline.json');
    for (const [cls, row] of Object.entries(bottle.classes)) {
      expect(row.tier, cls).to.eq('defect');
      expect(row.why ?? '', `${cls} says why — and that a real browser did not name it`).to.match(/browser/i);
    }
    expect(Object.keys(read('tests/e2e/autopilotBaseline.json').classes), 'a real page sees everything: a class named there is closed, never written down').to.deep.eq([]);
  });

  it('THE WHOLE GAMES (stage 6): a game to its final scoring, a capped one said, a STUCK one and a rebuild each fail the gate by name', async () => {
    const {aggregateAutopilot, aggregateCauseFiles, gateVerdict, renderAutopilot} = await load();
    const game = (n: number, pilot: Partial<Pilot>, retry = 0): File => ({
      file: 'autopilot.bottle.ts', title: `autopilot · game ${n}`, retry, monkey: {seed: `ap0:${n}`, presses: pilot.presses ?? 900}, records: [],
      autopilot: {end: 'finished', generation: 14, phase: 'end', presses: 900, byUi: {card: 20, option: 4}, byApi: {card: 2}, passes: {ui: 13, api: 0}, tookMs: 600_000, rebuilds: 0, ...pilot},
    });
    // (A run with no whole game has no such section — the monkey's pass, the e2e suite.)
    expect(aggregateAutopilot([walk('a', [])])).to.eq(undefined);
    expect(renderAutopilot(undefined)).to.eq('');

    const sitting = 'option · gen 10 · frames parliament:committed>colonies:browse · bar «Trading A Select B To the board»';
    const clean = [
      game(1, {doors: [sitting, 'card · gen 4 · frames none · bar «RT Actions B Close»']}),
      game(2, {doors: [sitting.replace('gen 10', 'gen 12')]}),
      game(3, {end: 'capped', generation: 44, phase: 'action', presses: 4000}), walk('a', []),
    ];
    const whole = aggregateAutopilot(clean) as Whole;
    expect(whole).to.deep.include({games: 3, finished: 2, rebuilds: 0, presses: 5800, byUi: 72, byApi: 6, playMin: 30});
    expect(whole.capped).to.deep.eq(['autopilot · game 3 (ap0:3) — generation 44, action, 4000 presses']);
    expect(whole.stuck).to.deep.eq([]);
    expect(renderAutopilot(whole)).to.contain('THE WHOLE GAMES — 3 game(s): 2 to the final scoring · 1 capped · 0 STUCK · rebuilds 0');
    expect(renderAutopilot(whole), 'the share the screen did not serve is said').to.contain('through the door 6 (7.7 % of the answers)');
    // WHERE the door answered — by place, the generation taken out: the same place in two games is ONE row, the worst first.
    expect(whole.doors).to.deep.eq([
      {where: 'option · frames parliament:committed>colonies:browse · bar «Trading A Select B To the board»', n: 2, games: 2},
      {where: 'card · frames none · bar «RT Actions B Close»', n: 1, games: 1},
    ]);
    expect(renderAutopilot(whole)).to.contain('   2× in  2 game(s)  option · frames parliament:committed>colonies:browse');
    // A door's answer is the zero bar's (a place seen once or twice in a game); the games that reached their scoring pass…
    const finished = clean.filter((f) => f.autopilot?.end !== 'capped');
    expect(gateVerdict({...aggregateCauseFiles(finished), autopilot: aggregateAutopilot(finished) as Whole}).pass).to.eq(true);
    // …and A CAPPED GAME IS NOT A GAME THAT WAS PLAYED (stage M — CI's browser game 632 stood on one bar for four
    // generations, was booked «1 capped» and passed): it fails by name.
    expect(gateVerdict({...aggregateCauseFiles(clean), autopilot: whole}).reasons).to.deep.eq([
      '1 whole game(s) ended on the pilot\'s cap, not on the final scoring: autopilot · game 3 (ap0:3) — generation 44, action, 4000 presses',
    ]);

    // A game counts by its LAST run; a stuck game and a rebuild are the freeze and the last line — each fails by name.
    const bad = [game(1, {end: 'stuck', generation: 6, phase: 'action', presses: 410}, 0), game(1, {end: 'stuck', generation: 7, phase: 'research', presses: 480}, 1), game(2, {rebuilds: 2})];
    const broken = aggregateAutopilot(bad) as Whole;
    expect(broken).to.deep.include({games: 2, finished: 1, rebuilds: 2});
    expect(broken.stuck).to.deep.eq(['autopilot · game 1 (ap0:1) — generation 7, research, 480 presses']);
    const verdict = gateVerdict({...aggregateCauseFiles(bad), autopilot: broken});
    expect(verdict.pass).to.eq(false);
    expect(verdict.reasons).to.deep.eq([
      '1 whole game(s) STUCK: autopilot · game 1 (ap0:1) — generation 7, research, 480 presses',
      '2 rebuild(s) in whole games — the last line was taken',
    ]);
  });

  /*
   * STAGE M — THE MEASURE IS HONEST (the fresh look's audit, 2026-11-28 — AUDIT-2026-11-28.md A1, A6, A7). Every way
   * the report read «pass» over a pass that was not one, as a spec: the verdict of a whole game is read off what its
   * PAGE said (never off a field one driver writes and the other does not), and a pass has a DENOMINATOR.
   */
  describe('STAGE M — a pass has a denominator, and a whole game is judged by what its page said', () => {
    const game = (n: number, pilot: Record<string, unknown> | undefined, records: Array<Rec> = [], extra: Record<string, unknown> = {}): File => ({
      file: 'console-autopilot.spec.ts', title: `autopilot · game ${n}`, retry: 0, monkey: {seed: `ap0:${n}`, presses: 900}, records,
      ...(pilot === undefined ? {} : {autopilot: {end: 'finished', generation: 14, phase: 'end', presses: 900, byUi: {card: 20}, byApi: {}, passes: {ui: 13, api: 0}, tookMs: 600_000, ...pilot}}),
      ...extra,
    } as File);
    const judged = async (files: Array<File>, opts: {zero?: boolean, expect?: number} = {}, report: Record<string, unknown> = {}) => {
      const {aggregateAutopilot, aggregateCauseFiles, gateVerdict} = await load();
      const whole = aggregateAutopilot(files);
      return gateVerdict({...aggregateCauseFiles(files), ...(whole !== undefined ? {autopilot: whole} : {}), ...report} as Report, undefined, opts);
    };

    it('A REBUILD IS READ OFF THE PAGE: the real browser\'s driver files no `rebuilds` field — its `session-rebuild` record counts', async () => {
      const {aggregateAutopilot, renderAutopilot} = await load();
      // (Run 46144276012: «episodes 2 (rebuilt 2)» two lines above «rebuilds 0» — the browser never wrote the field.)
      const rebuilt = [game(621, {}, [rec('session-rebuild/page/choice', 'defect')]), game(622, {})];
      const whole = aggregateAutopilot(rebuilt) as Whole;
      expect(whole.rebuilds, 'the page said it was rebuilt').to.eq(1);
      expect(renderAutopilot(whole)).to.contain('rebuilds 1');
      expect((await judged(rebuilt)).reasons).to.include('1 rebuild(s) in whole games — the last line was taken');
      // The bottle's driver counts them itself — the larger of the two words is the game's, never their sum.
      const both = [game(1, {rebuilds: 2}, [rec('session-rebuild/page/choice', 'defect')])];
      expect((aggregateAutopilot(both) as Whole).rebuilds).to.eq(2);
      // THE SHAPE THE REAL PAGE FILES: the rebuild is the END of a stall's episode — its outcome, and a line that spoke
      // inside it — never a record of its own (the first reading of this law counted the record alone, and CI's two
      // rebuilt games still summed to zero).
      const episode = [game(630, {}, [rec(STALL, 'defect', {outcome: 'rebuilt', stoodS: 10, cure: 'session-rebuild', nets: [{cls: 'session-rebuild/page/choice', tier: 'defect', n: 1}]})])];
      expect((aggregateAutopilot(episode) as Whole).rebuilds, 'an episode that ended in a rebuild is a rebuild').to.eq(1);
    });

    it('THE DOOR UNDER ONE SCREEN: three answers through the door at one unchanged screen are a screen that cannot be answered', async () => {
      const {aggregateAutopilot} = await load();
      const bar = 'frames parliament:browse · bar «ПарламентAВыполняется…» · grey Enter';
      const frozen = game(632, {end: 'finished', byApi: {option: 2}, passes: {ui: 3, api: 1}, doors: [
        `option «You completed the chairman quest» [chairmanQuestPrompt] · gen 4 · ${bar} · owner «parliament — frames [parliament] · serving parliament»`,
        `pass · gen 4 · ${bar} → after the gesture: ${bar} · owner «free»`,
        `card «Take \${0} card(s) drawn by \${1}» [externalDrawPrompt] · gen 5 · ${bar} · owner «parliament — frames [parliament] · serving parliament»`,
      ]});
      const whole = aggregateAutopilot([frozen]) as Whole & {doorStuck: Array<string>};
      expect(whole.doorStuck).to.deep.eq([`autopilot · game 632 (ap0:632) — the door answered 3× under «${bar}»`]);
      const verdict = await judged([frozen]);
      expect(verdict.pass, 'a game that «finished» behind the door is not a game the screen played').to.eq(false);
      expect(verdict.reasons).to.deep.eq([`the door answered three times or more under ONE screen in 1 game(s) — a screen that could not be answered: autopilot · game 632 (ap0:632) — the door answered 3× under «${bar}»`]);
      // Twice at one place, or three times at three places, is the zero bar's — not a freeze.
      const twice = game(7, {byApi: {card: 3}, doors: [
        `card · gen 3 · ${bar} · owner «x»`, `card · gen 9 · ${bar} · owner «x»`, 'card · gen 4 · frames none · bar «RT Actions B Close» · owner «free»',
      ]});
      expect((aggregateAutopilot([twice]) as Whole & {doorStuck: Array<string>}).doorStuck).to.deep.eq([]);
      expect((await judged([twice])).pass).to.eq(true);
      expect((await judged([twice], {zero: true})).pass).to.eq(false);
    });

    it('A GAME THAT DID NOT PLAY IS NOT A GAME THAT PASSED: a thrown harness fails the gate by name, whatever tier its line was filed at', async () => {
      const {aggregateCauseFiles} = await load();
      // (The bottle's driver: `status: 'harness'`, the error filed `bottle/harness-error` at INFO, no game block at all.)
      const thrown = [game(1, {}), game(2, undefined, [rec('bottle/harness-error', 'info')], {file: 'autopilot.bottle.ts', status: 'harness'})];
      expect((aggregateCauseFiles(thrown).totals as Report['totals'] & {thrown: Array<string>}).thrown).to.deep.eq(['autopilot · game 2']);
      expect((await judged(thrown)).reasons).to.deep.eq(['the harness threw in 1 test(s) — nothing of them was measured: autopilot · game 2']);
    });

    it('THE DENOMINATOR: fewer files than the pass asked for, no file at all and a file that cannot be read each fail the gate by name', async () => {
      const three = [game(1, {}), game(2, {}), game(3, {})];
      expect((await judged(three, {expect: 3})).pass).to.eq(true);
      expect((await judged(three, {expect: 48})).reasons).to.deep.eq(['the pass is not whole — 3 of the 48 test(s) it asked for left a file: a shard that died is not a shard that passed']);
      expect((await judged([])).reasons).to.deep.eq(['no test left a file — nothing was measured']);
      expect((await judged(three, {}, {unreadable: ['cause-classes/game-9-r0.json']})).reasons)
        .to.deep.eq(['1 file(s) of the pass could not be read (cut short, or not a report): cause-classes/game-9-r0.json']);
    });
  });

  /*
   * THE ZERO BAR (`--zero` — the owner, 2026-11-25: «0 % ошибок, зависаний и даже ворнингов — чтобы лог был чист … на
   * ЛЮБЫХ запусках автопилота»). The gate lets a «planned» fire of a net and a door's answer through; the zero bar
   * lets NOTHING through — and a game's LOG (every class of line its page said) is part of the report.
   */
  it('THE ZERO BAR: a planned record, a door, a line of the log and a routed press each fail it by name — a clean pass passes', async () => {
    const {aggregateAutopilot, aggregateCauseFiles, gateVerdict, renderAutopilot} = await load();
    const game = (n: number, pilot: Record<string, unknown>, records: Array<Rec> = []): File => ({
      file: 'console-autopilot.spec.ts', title: `autopilot · game ${n}`, retry: 0, monkey: {seed: `ap0:${n}`, presses: 900}, records,
      autopilot: {end: 'finished', generation: 14, phase: 'end', presses: 900, byUi: {card: 20}, byApi: {}, passes: {ui: 13, api: 0}, tookMs: 600_000, rebuilds: 0, ...pilot},
    } as File);
    const clean = [game(1, {}), game(2, {})];
    const cleanReport = {...aggregateCauseFiles(clean), autopilot: aggregateAutopilot(clean) as Whole};
    expect(gateVerdict(cleanReport, undefined, {zero: true}), 'nothing said, nothing through the door').to.deep.eq({pass: true, reasons: []});

    const line = (key: string, n: number) => ({key, type: 'warning', n, atMs: 61_000, stood: 'hand:browse|card#5|…'});
    const dirty = [
      game(1, {byApi: {card: 1}, doors: ['card 1..1 of 4 «Select a card» · gen 3 · frames hand:browse · bar «…» · owner «draft»'],
        log: [line('warning [console play] no computable preview for Insulation — showing fallback result', 2), line('http N GET /assets/x.png', 5)]}),
      game(2, {log: [line('http N GET /assets/x.png', 1)]}),
    ];
    const whole = aggregateAutopilot(dirty) as Whole & {log: Array<{key: string, n: number, games: number, first: string}>};
    // The log is summed by class: how often, in how many games, the first game that said it — the widest first.
    expect(whole.log.map((row) => [row.key, row.n, row.games])).to.deep.eq([
      ['http N GET /assets/x.png', 6, 2],
      ['warning [console play] no computable preview for Insulation — showing fallback result', 2, 1],
    ]);
    expect(whole.log[0].first).to.eq('autopilot · game 1 at 61 s · hand:browse|card#5|…');
    expect(renderAutopilot(whole)).to.contain('THE LOG — 2 class(es) of line the pages said');
    const report = {...aggregateCauseFiles(dirty), autopilot: whole, owner: {verdicts: {}, rows: {'band:actionMenu': {'band-agree': 40, 'band-fallback:free>deckPick': 2}}}};
    // The plain gate has nothing against any of it…
    expect(gateVerdict(report).pass).to.eq(true);
    // …the zero bar names each.
    const verdict = gateVerdict(report, undefined, {zero: true});
    expect(verdict.pass).to.eq(false);
    expect(verdict.reasons.join(' | ')).to.match(/1 answer\(s\) and 0 pass\(es\) went through the door/);
    expect(verdict.reasons.join(' | ')).to.match(/the log is not clean — 2 class\(es\)/);
    expect(verdict.reasons.join(' | ')).to.match(/band:actionMenu band-fallback:free>deckPick ×2/);
  });

  it("THE INPUT TYPES' denominator is the code's: a type is in the bar when an input that sends it is built in the scope", async () => {
    const lib = await load();
    const src = (file: string, text: string) => ({file, text});
    const sources = [
      // The inputs: one plain, one abstract with a concrete child, one only an out-of-scope card builds, one only a
      // classic the Redux set replaces builds, one only an out-of-scope ENGINE builds.
      src('src/server/inputs/SelectA.ts', "export class SelectA extends BasePlayerInput { toModel() { return {type: 'a'}; } }"),
      src('src/server/inputs/SelectB.ts', "export abstract class SelectB<T> extends BasePlayerInput<T> { toModel() { return {type: 'b'}; } } " +
        'export class SelectBChild extends SelectB<IProjectCard> {}'),
      src('src/server/inputs/SelectC.ts', "export class SelectC extends BasePlayerInput { toModel() { return {type: 'c'}; } }"),
      src('src/server/inputs/SelectD.ts', "export class SelectD extends BasePlayerInput { toModel() { return {type: 'd'}; } }"),
      src('src/server/inputs/SelectE.ts', "export class SelectE extends BasePlayerInput { toModel() { return {type: 'e'}; } }"),
      src('src/server/cards/base/Uses.ts', 'name: CardName.USES · new SelectA(1); new SelectBChild(2);'),
      src('src/server/cards/community/Other.ts', 'name: CardName.OTHER · new SelectC(3);'),
      src('src/server/cards/turmoil/Classic.ts', 'name: CardName.CLASSIC · new SelectD(4);'),
      src('src/server/underworld/Engine.ts', 'new SelectE(5);'),
    ];
    const reach = lib.inputTypesReach(['a', 'b', 'c', 'd', 'e', 'f'], sources, ['CLASSIC']);
    expect(reach.reachable, 'built in the scope — plainly, and through an abstract parent').to.deep.equal(['a', 'b']);
    expect(reach.excluded.map((x) => `${x.type}: ${x.why}`)).to.deep.equal([
      'c: only the community cards',
      'd: only the classic CLASSIC (the Redux set replaces it)',
      'e: only the underworld engine',
      'f: no server input sends it',
    ]);
  });
});
