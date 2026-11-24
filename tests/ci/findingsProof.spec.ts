import {expect} from 'chai';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
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

/** Several input files of one command (`from-sentry`: a file per environment). */
function findingsOfFiles(command: string, reports: ReadonlyArray<unknown>, ...flags: Array<string>): Array<Finding> {
  const files = reports.map((report, i) => {
    const file = join(dir, `${command}-${i}.json`);
    writeFileSync(file, JSON.stringify(report));
    return file;
  });
  return JSON.parse(execFileSync(process.execPath, ['scripts/ci/findings.mjs', command, ...files, ...flags], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']})).findings;
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

  /*
   * THE ONE-OWNER LAW, BROKEN, IS NAMED (issue #84): the gate's red by the law carried no cause class, so the night
   * it first failed was filed as «red with nothing named». The finding is the verdict, its tables and its proof.
   */
  it('the gate red by the one-owner law files the verdict with its tables — never «nothing named»', () => {
    const lawReport = {
      totals: {notCured: 0},
      classes: {},
      diff: {newClasses: []},
      owner: {
        verdicts: {'pad-MISS': 1, 'band-APART': 1, 'pad-agree': 40},
        disagreements: [
          {what: 'pad:startSequence — pad-MISS:section:board: says «start», painted «section:board»', walks: 1, tables: ['venus-l1-shade-start'], facts: 'frames [start] · host start'},
          {what: 'band:startSequence — band-APART:own:start>section:board: says «start», painted «section:board»', walks: 1, tables: ['venus-l1-shade-start'], facts: ''},
        ],
      },
    };
    const findings = findingsOf('from-monkey', lawReport, '--source', 'freeze-gate', '--context', 'seed fz1', '--gate-red',
      '--repro', 'npm run gate:freeze -- --seed <seed> --only \'^<table>$\' --skip-replays');
    expect(findings.map((finding) => finding.key)).to.deep.eq(['freeze-gate|owner-law|pad-MISS', 'freeze-gate|owner-law|band-APART']);
    expect(findings.every((finding) => finding.kind === 'owner-law'), 'never a broken run').to.eq(true);
    expect(findings[0].title).to.eq('[freeze-gate] the one-owner law: pad-MISS (venus-l1-shade-start)');
    expect(findings[0].proof).to.deep.eq({workflow: 'Freeze gate', inputs: {seeds: 'fz1', only: '^venus-l1-shade-start$'}});
    expect(findings[0].body).to.include('frames [start] · host start');
    expect(findings[0].body).to.include('npm run gate:freeze -- --seed fz1 --only \'^venus-l1-shade-start$\' --skip-replays');
  });

  it('…and a law at zero adds nothing: a red with no class and no law is still «nothing named»', () => {
    const quiet = {totals: {notCured: 0}, classes: {}, diff: {newClasses: []}, owner: {verdicts: {'pad-agree': 12, 'pad-MISS': 0}, disagreements: []}};
    const findings = findingsOf('from-monkey', quiet, '--source', 'freeze-gate', '--context', 'seed fz1', '--gate-red');
    expect(findings.map((finding) => finding.kind)).to.deep.eq(['broken-run']);
  });

  /*
   * THE ENGINE FUZZ FILES BY SEED (FREEZE ZERO, stage 5): a class the baseline does not hold is one finding, proven by
   * that very seed played again — with the reload check on when it was the reload's.
   */
  it('a class of the engine fuzz is a finding by its seed — replayable, and proven by the same game', () => {
    const fuzzReport = {
      games: 381, firstSeed: 90000,
      classes: [
        {key: 'R|solar|seat|(nothing)|or «Take your first action»', invariant: 'R', count: 1, games: 1, firstSeed: 90013, first: {step: 309, what: 'the save, loaded, asks the seat something else'}},
        {key: 'I3|known|row', invariant: 'I3', count: 2, games: 2, firstSeed: 90001, first: {step: 4, what: 'by design'}},
        {key: 'I4|or|x|TypeError: boom', invariant: 'I4', count: 1, games: 1, firstSeed: 90077, first: {step: 12, what: 'an answer made the engine throw', error: 'TypeError: boom'}},
      ],
    };
    const baseline = join(dir, 'fuzz-baseline.json');
    writeFileSync(baseline, JSON.stringify({classes: {'I3|known|row': {why: 'by design', firstSeed: 6}}}));
    const findings = findingsOf('from-fuzz', fuzzReport, '--baseline', baseline, '--context', 'seed 90000');
    expect(findings.map((finding) => finding.key), 'the baseline\'s row is no finding').to.deep.eq([
      'engine-fuzz|class|R|solar|seat|(nothing)|or «Take your first action»', 'engine-fuzz|class|I4|or|x|TypeError: boom']);
    expect(findings[0].proof).to.deep.eq({workflow: 'Engine fuzz', inputs: {seed: '90013', games: '1', minutes: '0', reload: '1'}});
    expect(findings[0].body).to.include('TM_FUZZ_RELOAD=1 TM_FUZZ_REPLAY=90013 npm run fuzz:engine');
    expect(findings[1].proof?.inputs.reload).to.eq('0');
    expect(findings[1].body).to.include('TM_FUZZ_REPLAY=90077 npm run fuzz:engine');
    expect(findings[1].body).to.include('TypeError: boom');
  });

  /*
   * THE WHOLE GAMES (FREEZE ZERO, stage 6 — the autopilot's pass speaks the monkey's report): a class is repeated by
   * its GAME, and what fails a whole game without being a cause class — a table nobody could move, the last line
   * taken — is filed by name.
   */
  it('a class of the autopilot is repeated by its game; a STUCK game and a rebuild are findings by name', () => {
    const report = {
      totals: {notCured: 0},
      classes: {'wait-graph/ceiling/x': {tier: 'defect', tests: 1, records: 1, first: {title: 'autopilot · game 12', seed: 'ap0:12', line: 'a line'}}},
      diff: {newClasses: ['wait-graph/ceiling/x']},
      autopilot: {games: 3, finished: 2, capped: [], rebuilds: 2, stuck: ['autopilot · game 7 (ap0:7) — generation 6, research, 480 presses']},
    };
    const findings = findingsOf('from-monkey', report, '--source', 'autopilot', '--context', 'bottle · ap0 · games 1+24',
      '--repro', 'gh workflow run Autopilot -f from=<game> -f games=1');
    expect(findings.map((finding) => [finding.key, finding.kind])).to.deep.eq([
      ['autopilot|class|wait-graph/ceiling/x', 'new-class'],
      ['autopilot|stuck|autopilot · game 7 (ap0:7)', 'failed'],
      ['autopilot|rebuilds', 'failed'],
    ]);
    expect(findings[0].proof, 'a game is no table of the monkey — no proof of another workflow is named').to.eq(undefined);
    expect(findings[0].body).to.contain('gh workflow run Autopilot -f from=12 -f games=1');
    expect(findings[1].body).to.contain('gh workflow run Autopilot -f from=7 -f games=1');
    expect(findings[2].title).to.eq('[autopilot] the last line was taken in a whole game (2 rebuild(s))');
    // …and a clean pass of whole games files nothing.
    expect(findingsOf('from-monkey', {totals: {notCured: 0}, classes: {}, diff: {newClasses: []}, autopilot: {games: 3, finished: 3, capped: [], stuck: [], rebuilds: 0}},
      '--source', 'autopilot')).to.deep.eq([]);
  });

  it('a class of the monkey is proven by the monkey on its table, seed and perturbation', () => {
    const [finding] = findingsOf('from-monkey', monkeyReport, '--source', 'monkey', '--context', 'seed fz0', '--perturb', 'cpu4');
    expect(finding.proof).to.deep.eq({workflow: 'Monkey', inputs: {seed: 'fz0', only: '^hydro-terminal-surge$', shards: '1', perturb: 'cpu4'}});
  });

  /*
   * A FINDING SAYS WHERE ITS CLASS LIVES IN THE CODE (the owner, 2026-11-19: findings must be quick to work with for
   * an agent that has no collector access and no memory of yesterday) — read off the checkout, the same search as
   * `npm run diag -- where <class>`.
   */
  it('a finding of a cause class says where to start: the shape\'s row, the print site, where its words are declared', () => {
    const report = {
      totals: {notCured: 0},
      classes: {
        'wait-graph/ceiling/remote-placement:watchable-board': {tier: 'defect', tests: 1, records: 1, first: {title: 'monkey · a', seed: 'fz0:a', line: 'x'}},
        'invariant/broken/start-flight:no-rise-end': {tier: 'defect', tests: 1, records: 1, first: {title: 'monkey · b', seed: 'fz0:b', line: 'x'}},
      },
      diff: {newClasses: ['wait-graph/ceiling/remote-placement:watchable-board', 'invariant/broken/start-flight:no-rise-end']},
    };
    const [wait, invariant] = findingsOf('from-monkey', report, '--source', 'monkey');
    expect(wait.body).to.contain('**Where to start**');
    expect(wait.body).to.match(/- the shape's row \(what the line is, its tier\): `src\/common\/diagnostics\/shapes\.ts:\d+`/);
    expect(wait.body).to.match(/- printed at: `src\/client\/console\/waitGraph\/ceilingWait\.ts:\d+`/);
    expect(wait.body, 'the wait\'s own id is a name of the code').to.match(/- `remote-placement:watchable-board` is declared at: `src\/client\/console\/tilePlacement\/consoleRemotePlacement\.ts:\d+`/);
    expect(wait.body).to.match(/- named in the tests: `tests\//);
    // An invariant is found by the call that checks it — its id is often built from parts.
    expect(invariant.body).to.match(/- the invariant is checked at: `src\/client\/console\/startDockMotion\.ts:\d+`/);
    // A class this checkout knows nothing of files without the block — never with a guess.
    const [unknown] = findingsOf('from-monkey', {...report, classes: {'nonsense/shape/x': {first: {title: 'monkey · c', seed: 'fz0:c'}}}, diff: {newClasses: ['nonsense/shape/x']}}, '--source', 'monkey');
    expect(unknown.body).not.to.contain('printed at');
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
    // A flake is proven by RATE — the hunt: twenty runs, no retry (tests.md law 10).
    expect(finding.proof?.inputs.repeat_each).to.eq('20');
    expect(finding.proof?.inputs.retries).to.eq('0');
    const grep = finding.proof?.inputs.grep ?? '';
    // Nothing a double-quoted shell word would read…
    expect(grep).not.to.match(/["`$]/);
    expect(grep.replace(/\\[.*+?^{}()|[\]]/g, '')).not.to.contain('\\');
    // …and still a pattern that matches the title it was made from.
    expect(new RegExp(grep).test(title)).to.eq(true);
  });

  it('a HUNT (each test N times, no retry) files a test ONCE — a FLAKE when any repeat passed, said with its rate', () => {
    // The JSON reporter writes every repeat as a spec of its own, under the same title and file.
    const repeat = (status: string) => ({
      title: 'the deal turns', file: 'console-x.spec.ts', line: 7,
      tests: [{status, projectName: 'chromium', results: [{status: status === 'expected' ? 'passed' : 'failed', error: {message: 'boom'}}]}],
    });
    const flaky = findingsOf('from-playwright', {suites: [{title: 'console-x.spec.ts', file: 'console-x.spec.ts',
      specs: [repeat('expected'), repeat('unexpected'), repeat('expected'), repeat('unexpected')]}]}, '--source', 'e2e');
    expect(flaky.length, 'one finding for the test, however many repeats were red').to.eq(1);
    expect(flaky[0].kind).to.eq('flaky');
    expect(flaky[0].title).to.match(/\] flaky: /);
    expect(flaky[0].body).to.contain('2 of 4 repeats red');
    expect(flaky[0].proof?.inputs.repeat_each, 'a flake is proven by rate').to.eq('20');
    // …and a test red in EVERY repeat is a failure, as before.
    const failed = findingsOf('from-playwright', {suites: [{title: 'console-x.spec.ts', file: 'console-x.spec.ts',
      specs: [repeat('unexpected'), repeat('unexpected')]}]}, '--source', 'e2e');
    expect(failed.length).to.eq(1);
    expect(failed[0].kind).to.eq('failed');
    expect(failed[0].proof?.inputs.repeat_each, 'a failure is proven by one green run').to.eq(undefined);
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
    // A FILE PER ENVIRONMENT (the box, the players'): an issue seen in both is one finding.
    const two = findingsOfFiles('from-sentry', [[issue({}), issue({shortId: 'TERRAFORMING-MARS-B'})], [issue({}), issue({shortId: 'TERRAFORMING-MARS-C'})]], '--since', '26h');
    expect(two.map((f) => f.key)).to.deep.eq(['sentry|issue|TERRAFORMING-MARS-T', 'sentry|issue|TERRAFORMING-MARS-B', 'sentry|issue|TERRAFORMING-MARS-C']);
    expect(findings.every((f) => f.kind === 'field' && f.proof === undefined), 'a field defect names no re-run').to.eq(true);
    expect(findings[0].title).to.eq('[sentry] [wait-graph] cycle (announce:parliament:genn · question:parliamentphase · surface:parliament)');
    expect(findings[0].body).to.contain('npm run diag -- issue TERRAFORMING-MARS-T');
    expect(findings[0].body).not.to.contain('came back');
    expect(findings[0].body, 'no structure was attached: no block').not.to.contain('said of itself');
    // THE EVENT'S STRUCTURAL TAGS ride the issue for a reader with no Sentry access.
    const [told] = findingsOf('from-sentry', [issue({structure: {cause: 'wait-graph/cycle/x', release: 'terraforming-mars@1.2.3327', head: '6e0cab3', screen: 'player-home'}})], '--since', '26h');
    expect(told.body).to.contain('- `cause`: `wait-graph/cycle/x`');
    expect(told.body).to.contain('- `head`: `6e0cab3`');
    expect(told.body, 'a white-listed tag is printed as it is — a release is not an address').to.contain('- `release`: `terraforming-mars@1.2.3327`');
    const leaked = findings[1].title + findings[1].body;
    expect(leaked, 'it came back after a resolve').to.contain('came back after being resolved');
    for (const secret of ['192.168.1.20', 'Somebody', 'c37200da3a391', '/home/deck', 'somebody', 'a@b.co']) {
      expect(leaked, `«${secret}» must not reach a public issue`).not.to.contain(secret);
    }
  });

  /*
   * CLOSING GOES BOTH WAYS (docs/claude/ci-findings.md § 1b). Nobody closed an issue in Sentry, and nobody closed here
   * what Sentry had let go of: both are the repository's own now — and the repository is public, so whose Sentry issue
   * a GitHub issue is, is read only from what the filer itself wrote.
   */
  const marked = (key: string) => `the body\n\n<!-- ci-finding:${Buffer.from(key).toString('base64')} -->`;
  const ghIssue = (number: number, key: string, over: Record<string, unknown> = {}) => ({
    number, state: 'OPEN', body: marked(key), author: {login: 'app/github-actions', is_bot: true},
    labels: [{name: 'ci-finding'}, {name: 'src:sentry'}, {name: 'kind:field'}], ...over,
  });
  const queue = [
    ghIssue(1, 'sentry|issue|TERRAFORMING-MARS-A'),
    ghIssue(2, 'sentry|issue|TERRAFORMING-MARS-B'),
    ghIssue(3, 'sentry|issue|TERRAFORMING-MARS-C'),
    ghIssue(4, 'sentry|issue|TERRAFORMING-MARS-D'),
    ghIssue(5, 'sentry|issue|TERRAFORMING-MARS-E'),
    // A broken night of the source itself is not an issue of a Sentry issue…
    ghIssue(6, 'sentry|broken-run|the nightly asking'),
    // …a stranger's issue with the filer's marker in it is nobody's (anybody may write an issue here)…
    ghIssue(7, 'sentry|issue|TERRAFORMING-MARS-F', {author: {login: 'somebody', is_bot: false}}),
    // …nor is one without the source's label, or with a «short id» that is not one (it becomes an argument).
    ghIssue(8, 'sentry|issue|TERRAFORMING-MARS-G', {labels: [{name: 'ci-finding'}]}),
    ghIssue(9, 'sentry|issue|X; rm -rf .'),
    ghIssue(10, 'sentry|issue|TERRAFORMING-MARS-H', {state: 'CLOSED'}),
  ];
  const run = (...args: Array<string>): string => {
    const issues = join(dir, 'gh-issues.json');
    writeFileSync(issues, JSON.stringify(queue));
    return execFileSync(process.execPath, ['scripts/ci/findings.mjs', ...args, '--issues', issues], {encoding: 'utf8'});
  };

  it('whose Sentry issue an issue is, is read only from what the filer wrote', () => {
    expect(run('sentry-open').trim().split('\n'), 'the open ones the Actions bot filed under src:sentry — a line each')
      .to.deep.eq(['TERRAFORMING-MARS-A', 'TERRAFORMING-MARS-B', 'TERRAFORMING-MARS-C', 'TERRAFORMING-MARS-D', 'TERRAFORMING-MARS-E']);
    expect(run('sentry-id-of', '2').trim()).to.eq('TERRAFORMING-MARS-B');
    expect(run('sentry-id-of', '10').trim(), 'a closed one is still whose it is — the workflow asks AFTER the close').to.eq('TERRAFORMING-MARS-H');
    for (const number of ['6', '7', '8', '9', '404']) {
      expect(run('sentry-id-of', number), `#${number} names no Sentry issue`).to.eq('');
    }
  });

  it('what Sentry no longer holds open is closed here — by how it was let go; what it still holds stays', () => {
    const statuses = join(dir, 'sentry-status.json');
    writeFileSync(statuses, JSON.stringify([
      {shortId: 'TERRAFORMING-MARS-A', status: 'unresolved', substatus: 'ongoing'},
      {shortId: 'TERRAFORMING-MARS-B', status: 'resolved', inRelease: 'terraforming-mars@1.2.3341'},
      {shortId: 'TERRAFORMING-MARS-C', status: 'resolved', auto: true},
      {shortId: 'TERRAFORMING-MARS-D', status: 'ignored', substatus: 'archived_until_escalating'},
      {shortId: 'TERRAFORMING-MARS-E', status: 'missing'},
      // (Statuses nobody here has an open issue for change nothing.)
      {shortId: 'TERRAFORMING-MARS-F', status: 'resolved'},
      {shortId: 'TERRAFORMING-MARS-H', status: 'resolved'},
    ]));
    const said = run('sentry-settled', statuses, '--dry').trim().split('\n').map((line) => line.trim());
    expect(said).to.deep.eq([
      'CLOSE  #2 as completed — TERRAFORMING-MARS-B: resolved in `terraforming-mars@1.2.3341`',
      'CLOSE  #3 as not planned — TERRAFORMING-MARS-C: unseen — resolved by the collector',
      'CLOSE  #4 as not planned — TERRAFORMING-MARS-D: archived',
      'CLOSE  #5 as not planned — TERRAFORMING-MARS-E: gone',
      '[findings] sentry: 4 open issue(s) the collector no longer holds open (--dry: nothing was closed)',
    ]);
  });

  it('the one workflow that may write to Sentry prints none of the tool\'s own words — the log is public', () => {
    const workflow = readFileSync('.github/workflows/sentry-housekeeping.yml', 'utf8');
    const writes = workflow.split('\n').filter((line) => /node scripts\/diag\.mjs (resolve|archive|tidy)\b/.test(line));
    expect(writes.length, 'the resolve, the archive and the tidy').to.eq(3);
    for (const line of writes) {
      expect(line, 'its output goes to a file (a title is in it — a player\'s report carries the player\'s words)').to.match(/ > \w+\.txt 2> err\.txt /);
    }
    expect(workflow, 'and the file is never printed whole').not.to.match(/\bcat\s+(done|err|tidy)\.txt/);
    // Nothing of the event reaches a command but a number: the short id is the filer's own, asked by that number.
    expect(workflow).not.to.match(/\$\{\{\s*github\.event\.issue\.(title|body)/);
    expect(workflow, 'the write token has ONE holder').to.contain('secrets.SENTRY_WRITE_TOKEN');
    expect(readFileSync('.github/workflows/sentry-findings.yml', 'utf8'), 'the filing reads, and only reads').not.to.contain('SENTRY_WRITE_TOKEN');
  });
});
