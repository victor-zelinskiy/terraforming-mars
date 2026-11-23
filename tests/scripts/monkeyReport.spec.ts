import {expect} from 'chai';
import * as path from 'path';
import {pathToFileURL} from 'url';

/*
 * THE MONKEY'S REPORT (scripts/monkey-report.mjs — docs/claude/console/freeze-zero/PLAN.md §3.3, §5): a run summed BY
 * CAUSE CLASS from the files every e2e test writes (`tests/e2e/causeHarvest.ts`), compared with an earlier run, and
 * judged by the bar's gate — no episode left uncured, no NEW defect class.
 */
type Episode = {outcome: string, stoodS: number, cure: string, nets: Array<{cls: string, tier: string, n: number}>};
type Rec = {cls: string, shape: string, tier: string, family: string, page: number, count: number, lines: number, atMs: number, title: string, dims: Record<string, string>, episode?: Episode};
type File = {file: string, title: string, retry: number, status?: string, monkey?: {seed: string, presses: number}, records: Array<Rec>};
type ClassRow = {tier: string, shape: string, tests: number, records: number, lines: number, outcomes: Record<string, number>, worstStoodS: number, first?: {file: string, title: string, seed?: string}};
type Report = {
  owner?: {verdicts: Record<string, number>, spans?: Record<string, {n: number, ms: number, max: number, tables: Array<string>}>, walks?: number, looks?: number, rows?: object, open?: object, disagreements?: Array<never>},
  totals: {tests: number, walks: number, presses: number, records: number, defects: number, episodes: number, notCured: number, outcomes: Record<string, number>},
  classes: Record<string, ClassRow>,
  nets: Record<string, {tier: string, records: number, lines: number, tests: number, per1000Presses: number | null}>,
};
type Diff = {newClasses: Array<string>, goneClasses: Array<string>, kept: Array<string>};
type Lib = {
  aggregateCauseFiles: (files: Array<File>) => Report,
  compareReports: (now: Report, before: Report | undefined) => Diff,
  gateVerdict: (report: Report, diff?: Diff) => {pass: boolean, reasons: Array<string>},
  beatLawBroken: (report: Pick<Report, 'owner'>) => Array<[string, number, number, Array<string>]>,
  BEAT_LAW_QUIET_MS: number,
  renderOwner: (owner: Report['owner']) => string,
  renderReport: (report: Report, diff?: Diff) => string,
  shapeOfClass: (cls: string) => string,
};

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
});
