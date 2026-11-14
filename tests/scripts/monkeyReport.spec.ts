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
  totals: {tests: number, walks: number, presses: number, records: number, defects: number, episodes: number, notCured: number, outcomes: Record<string, number>},
  classes: Record<string, ClassRow>,
  nets: Record<string, {tier: string, records: number, lines: number, tests: number, per1000Presses: number | null}>,
};
type Diff = {newClasses: Array<string>, goneClasses: Array<string>, kept: Array<string>};
type Lib = {
  aggregateCauseFiles: (files: Array<File>) => Report,
  compareReports: (now: Report, before: Report | undefined) => Diff,
  gateVerdict: (report: Report, diff?: Diff) => {pass: boolean, reasons: Array<string>},
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
});
