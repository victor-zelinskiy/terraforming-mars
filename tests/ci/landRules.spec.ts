import {expect} from 'chai';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

/**
 * WHAT A CI-FIX MAY LAND BY ITSELF (docs/claude/ci-findings.md § 3a, § 3b).
 *
 * The morning triage agent's fixes reach `main` with nobody reading them — so what such a fix may touch is a rule
 * of the REPOSITORY (scripts/ci/landRules.mjs), judged by the landing workflow, never the agent's own opinion of
 * its work. This spec is that rule's floor: a row dropped from it turns red here.
 */
type ChangedFile = {path: string, additions: number, deletions: number};

function refusalsOfEach(cases: Array<Array<ChangedFile>>): Array<Array<string>> {
  return JSON.parse(execFileSync(process.execPath, ['scripts/ci/landRules.mjs', JSON.stringify(cases)], {encoding: 'utf8'}));
}
const refusals = (files: Array<ChangedFile>): Array<string> => refusalsOfEach([files])[0];
const file = (path: string, additions = 5, deletions = 2): ChangedFile => ({path, additions, deletions});

describe('ci-fix landing rules', () => {
  it('an e2e spec fix lands', () => {
    expect(refusals([file('tests/e2e/console-hand.spec.ts', 12, 9)])).to.deep.eq([]);
  });

  it('a trivial product fix lands only with its spec', () => {
    expect(refusals([file('src/client/components/console/ConsoleHand.vue'), file('tests/client/console/hand.spec.ts', 30, 0)])).to.deep.eq([]);
    expect(refusals([file('src/client/components/console/ConsoleHand.vue')]).join('\n')).to.contain('no spec in the same diff');
  });

  it('the ground a working session decides is refused, whatever the size', () => {
    const never = [
      '.github/workflows/release.yml',
      '.githooks/pre-push',
      '.claude/rules/tests.md',
      'CLAUDE.md',
      'docs/claude/ci-findings.md',
      'scripts/ci/land.mjs',
      'scripts/version.mjs',
      'package.json',
      'package-lock.json',
      'playwright.config.ts',
      'tests/e2e/monkeyBaseline.json',
      'tests/client/bottle/monkeyBaseline.json',
      'tests/console/glowRestraintBaseline.json',
      'tests/client/bottle/consoleBottle.ts',
      'src/server/Player.ts',
      'src/common/app/AppErrorId.ts',
      'src/locales/ru/ui.json',
      'src/client/console/kernel/frameWitness.ts',
      'src/client/console/transport/gameTransport.ts',
      'src/client/console/waitGraph/ceilingWait.ts',
      'src/client/console/consoleLiveness.ts',
      'src/client/console/livenessOscillation.ts',
      'src/client/components/presentation/animationHold.ts',
      'electron/main.ts',
    ];
    const verdicts = refusalsOfEach(never.map((path) => [file(path, 1, 1), file('tests/client/x.spec.ts')]));
    never.forEach((path, i) => expect(verdicts[i], path).to.have.length.greaterThan(0));
  });

  it('a large change is not a simple fix', () => {
    expect(refusals([file('src/client/a.ts', 60, 30), file('tests/client/a.spec.ts')]).join('\n')).to.contain('trivial bug');
    expect(refusals([1, 2, 3, 4].map((n) => file(`src/client/a${n}.ts`, 1, 1)).concat(file('tests/client/a.spec.ts'))).join('\n')).to.contain('trivial bug');
    expect(refusals([file('tests/e2e/a.spec.ts', 500, 200)]).join('\n')).to.contain('simple fix');
    expect(refusals([])).to.deep.eq(['it changes nothing']);
  });

  it('the landing never executes the pull request and never skips a hook', () => {
    const land = readFileSync('scripts/ci/land.mjs', 'utf8');
    expect(land).to.contain('fileRefusals(files)');
    expect(land).not.to.contain('--no-verify');
    expect(land).not.to.match(/push[^\n]*--force/);
    const workflow = readFileSync('.github/workflows/land-ci-fix.yml', 'utf8');
    // The base branch's script, on the base branch's checkout — nothing of the pull request is installed or run.
    expect(workflow).to.contain('ref: main');
    expect(workflow).not.to.match(/npm (ci|install|run)/);
    expect(workflow).to.contain('cancel-in-progress: false');
  });
});
