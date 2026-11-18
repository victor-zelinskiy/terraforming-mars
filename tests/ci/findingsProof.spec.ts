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

  /*
   * WHAT A REAL SESSION REPORTED (docs/claude/ci-findings.md § 1a): Sentry's unresolved issues enter the same queue.
   * The repository is public and the sessions are not — a finding carries structure, never a session's data.
   */
  it('a Sentry issue is one finding by its short id — only an unresolved one, its title scrubbed, a return said', () => {
    const issue = (over: Record<string, unknown>) => ({
      shortId: 'TERRAFORMING-MARS-T', status: 'unresolved', substatus: 'new', level: 'warning', count: '2', userCount: 1,
      title: '[wait-graph] cycle (announce:parliament:genn · question:parliamentphase · surface:parliament)',
      firstSeen: '2026-11-18T13:34:56Z', lastSeen: '2026-11-18T13:46:47Z', permalink: 'https://example.sentry.io/issues/1/', ...over,
    });
    const findings = findingsOf('from-sentry', [
      issue({}),
      issue({shortId: 'TERRAFORMING-MARS-U', status: 'resolved'}),
      issue({shortId: 'TERRAFORMING-MARS-V', substatus: 'regressed',
        title: 'HTTP 404 — GET http://192.168.1.20:17325/api/campaign?id=c37200da3a391&name=Somebody from /home/deck/x and C:\\Users\\somebody\\y by a@b.co'}),
      // The diagnostics' own probes and a session's summary are not defects of the game…
      issue({shortId: 'TERRAFORMING-MARS-P1', title: 'Error: the connection check — a test error of the game server (probe)'}),
      issue({shortId: 'TERRAFORMING-MARS-P2', title: 'Отчёт игрока TM-R7C4ND · other — TM_DIAG_PROBE — a probe report, not a player'}),
      issue({shortId: 'TERRAFORMING-MARS-P3', title: 'session — 4 min of play, 1 defect(s), 0 episode(s)'}),
      // …and a real player's report keeps its code and category: the words are the player's.
      issue({shortId: 'TERRAFORMING-MARS-R', title: 'Отчёт игрока TM-K7QW3D · freeze — завис экран после хода Васи'}),
    ], '--since', '26h');
    expect(findings.map((f) => f.key), 'a resolved issue, a probe and a session summary are not findings')
      .to.deep.eq(['sentry|issue|TERRAFORMING-MARS-T', 'sentry|issue|TERRAFORMING-MARS-V', 'sentry|issue|TERRAFORMING-MARS-R']);
    expect(findings[2].title).to.eq('[sentry] Отчёт игрока TM-K7QW3D · freeze — the player\'s words stay in Sentry');
    expect(findings[2].title + findings[2].body, 'a player\'s words never reach a public issue').not.to.contain('Васи');
    expect(findings.every((f) => f.kind === 'field' && f.proof === undefined), 'a field defect names no re-run').to.eq(true);
    expect(findings[0].title).to.eq('[sentry] [wait-graph] cycle (announce:parliament:genn · question:parliamentphase · surface:parliament)');
    expect(findings[0].body).to.contain('npm run diag -- issue TERRAFORMING-MARS-T');
    expect(findings[0].body).not.to.contain('came back');
    const leaked = findings[1].title + findings[1].body;
    expect(leaked, 'it came back after a resolve').to.contain('came back after being resolved');
    for (const secret of ['192.168.1.20', 'Somebody', 'c37200da3a391', '/home/deck', 'somebody', 'a@b.co']) {
      expect(leaked, `«${secret}» must not reach a public issue`).not.to.contain(secret);
    }
  });
});
