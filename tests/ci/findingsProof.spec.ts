import {expect} from 'chai';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

/**
 * A FINDING NAMES ITS OWN PROOF (docs/claude/ci-findings.md § 2, § 3b).
 *
 * The ci-fix lane lands a fix when the re-run its ISSUE names is green — so the run that FOUND a defect must say
 * which re-run would prove a fix (scripts/ci/findings.mjs `proof`), and must say it safely: the e2e workflow puts
 * the test's title inside a shell word. A finding that lost its proof would be un-landable; a title that reached the
 * shell raw would be a command.
 */
type Finding = {key: string, kind: string, title: string, body: string, proof?: {workflow: string, inputs: Record<string, string>}};

const dir = mkdtempSync(join(tmpdir(), 'ci-findings-'));

function findingsOf(command: string, report: unknown, ...flags: Array<string>): Array<Finding> {
  const file = join(dir, `${command}.json`);
  writeFileSync(file, JSON.stringify(report));
  return JSON.parse(execFileSync(process.execPath, ['scripts/ci/findings.mjs', command, file, ...flags], {encoding: 'utf8'})).findings;
}

describe('ci findings: a finding names its proof', function() {
  // Each case starts one node process — a budget for that, never a timing.
  // eslint-disable-next-line no-invalid-this
  this.timeout(20_000);

  const monkeyReport = {
    totals: {notCured: 0},
    classes: {'wait-graph/ceiling/x': {tier: 'defect', tests: 1, records: 1, first: {title: 'monkey · hydro-terminal-surge', seed: 'fz0:hydro-terminal-surge', line: 'a line'}}},
    diff: {newClasses: ['wait-graph/ceiling/x']},
  };

  it('a class of the freeze gate is proven by the gate on its table and seed', () => {
    const [finding] = findingsOf('from-monkey', monkeyReport, '--source', 'freeze-gate', '--context', 'seed fz0');
    expect(finding.key).to.eq('freeze-gate|class|wait-graph/ceiling/x');
    expect(finding.proof).to.deep.eq({workflow: 'Freeze gate', inputs: {seeds: 'fz0', only: '^hydro-terminal-surge$'}});
  });

  it('a class of the monkey is proven by the monkey on its table, seed and perturbation', () => {
    const [finding] = findingsOf('from-monkey', monkeyReport, '--source', 'monkey', '--context', 'seed fz0', '--perturb', 'cpu4');
    expect(finding.proof).to.deep.eq({workflow: 'Monkey', inputs: {seed: 'fz0', only: '^hydro-terminal-surge$', shards: '1', perturb: 'cpu4'}});
  });

  it('a table or a seed that is not a plain name carries no proof', () => {
    const report = {...monkeyReport, classes: {'wait-graph/ceiling/x': {first: {title: 'monkey · a b; rm', seed: 'fz0:x'}}}};
    const [finding] = findingsOf('from-monkey', report, '--source', 'monkey');
    expect(finding.proof).to.eq(undefined);
  });

  it('an e2e test is proven by itself on one shard, its title never reaching a shell raw', () => {
    const title = 'pays "the price" of $5 (twice) [x] `now` \\ · карта › ok?';
    const report = {suites: [{title: 'console-x.spec.ts', file: 'console-x.spec.ts', specs: [{
      title, file: 'console-x.spec.ts', line: 5,
      tests: [{status: 'flaky', projectName: 'chromium', results: [{status: 'failed', error: {message: 'boom'}}, {status: 'passed'}]}],
    }]}]};
    const [finding] = findingsOf('from-playwright', report, '--source', 'e2e', '--context', 'nightly');
    expect(finding.kind).to.eq('flaky');
    expect(finding.proof?.workflow).to.eq('Playwright E2E');
    expect(finding.proof?.inputs.shards).to.eq('1');
    const grep = finding.proof?.inputs.grep ?? '';
    // Nothing a double-quoted shell word would read…
    expect(grep).not.to.match(/["`$]/);
    expect(grep.replace(/\\[.*+?^{}()|[\]]/g, '')).not.to.contain('\\');
    // …and still a pattern that matches the title it was made from.
    expect(new RegExp(grep).test(title)).to.eq(true);
  });
});
