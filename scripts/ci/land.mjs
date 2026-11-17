#!/usr/bin/env node
/**
 * LAND A CI-FIX (docs/claude/ci-findings.md § 3b) — the one way a fix of the morning triage agent reaches `main`.
 *
 * The agent PROPOSES (a `claude/ci-fix-<issue>-…` branch, a pull request labelled `ci-fix`, the test re-run on CI) and
 * ASKS (the label `land`). This script DECIDES — by what it can read, never by what the pull request says about
 * itself — and lands: the change squashed onto the tip of `main` as ONE commit carrying its own version bump (every
 * push to `main` is a release; GitHub's merge button would ship a version a release already claimed).
 *
 *   node scripts/ci/land.mjs <pr number> [--dry]      (GH_TOKEN, GITHUB_REPOSITORY; a full checkout of main)
 *
 * REFUSED — with every reason written on the pull request, the label `land` taken back:
 *   - not an open, non-draft pull request to `main` from a `claude/ci-fix-<issue>-…` branch of THIS repository,
 *     labelled `ci-fix`, whose body says `Fixes #<issue>` for an open `ci-finding` issue;
 *   - it touches what the fix lane may never touch, or is larger than a simple fix (scripts/ci/landRules.mjs);
 *   - its head commit is not PROVEN: `CI` green on the pull request, and — for a finding of the e2e suite, the monkey
 *     or the freeze gate — a green run of THAT workflow on the same head commit;
 *   - it no longer applies to the tip of `main`.
 *
 * Nothing of the pull request is ever EXECUTED here: this script and the version rule are loaded from `main` before
 * the change is applied, and `scripts/**` is itself forbidden ground.
 */
import {execFileSync} from 'node:child_process';
import * as fs from 'node:fs';
import {nextVersion, writeVersion, VERSION_FILES} from '../version.mjs';
import {fileRefusals} from './landRules.mjs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const pr = args.find((arg) => /^\d+$/.test(arg));
const repo = process.env.GITHUB_REPOSITORY ?? '';
if (pr === undefined || repo === '') {
  console.error('usage: node scripts/ci/land.mjs <pr number> [--dry]   (needs GH_TOKEN and GITHUB_REPOSITORY)');
  process.exit(2);
}

/** Which workflow must have re-run green on the head commit, by where the finding came from. */
const PROOF = {'src:e2e': 'Playwright E2E', 'src:monkey': 'Monkey', 'src:freeze-gate': 'Freeze gate'};

function sh(file, argv, options = {}) {
  return execFileSync(file, argv, {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...options});
}
const gh = (argv, input) => sh('gh', argv, {input});
// (The version is derived HERE, against the remote — a commit hook must not bump it once more.)
const git = (argv) => sh('git', argv, {env: {...process.env, TM_SKIP_VERSION_BUMP: '1'}}).trim();

function judge() {
  const reasons = [];
  const view = JSON.parse(gh(['pr', 'view', pr, '--repo', repo, '--json',
    'number,title,state,isDraft,baseRefName,headRefName,headRefOid,isCrossRepository,labels,body,files,commits']));
  const labels = (view.labels ?? []).map((label) => label.name);
  const branch = /^claude\/ci-fix-(\d+)-[a-z0-9][a-z0-9-]*$/.exec(view.headRefName ?? '');
  if (view.state !== 'OPEN') {
    reasons.push(`the pull request is ${view.state}, not open`);
  }
  if (view.isDraft) {
    reasons.push('the pull request is a draft');
  }
  if (view.baseRefName !== 'main') {
    reasons.push(`its base is \`${view.baseRefName}\`, not \`main\``);
  }
  if (view.isCrossRepository) {
    reasons.push('its branch lives in another repository');
  }
  if (branch === null) {
    reasons.push(`its branch \`${view.headRefName}\` is not \`claude/ci-fix-<issue>-<slug>\``);
  }
  if (!labels.includes('ci-fix')) {
    reasons.push('it is not labelled `ci-fix`');
  }

  // THE FINDING IT FIXES — one, named the same by the branch and by the body.
  const fixes = [...String(view.body ?? '').matchAll(/\bFixes #(\d+)\b/g)].map((m) => m[1]);
  const issueNumber = branch?.[1];
  let issueLabels = [];
  if (fixes.length !== 1 || fixes[0] !== issueNumber) {
    reasons.push(`its body must say \`Fixes #${issueNumber ?? '<issue>'}\` once — the issue its branch names (found: ${fixes.map((n) => `#${n}`).join(', ') || 'none'})`);
  } else {
    try {
      const issue = JSON.parse(gh(['issue', 'view', issueNumber, '--repo', repo, '--json', 'state,labels']));
      issueLabels = (issue.labels ?? []).map((label) => label.name);
      if (issue.state !== 'OPEN') {
        reasons.push(`issue #${issueNumber} is ${issue.state}, not open`);
      }
      if (!issueLabels.includes('ci-finding')) {
        reasons.push(`issue #${issueNumber} is not a \`ci-finding\``);
      }
    } catch {
      reasons.push(`issue #${issueNumber} could not be read`);
    }
  }

  // WHAT IT TOUCHES.
  const files = view.files ?? [];
  reasons.push(...fileRefusals(files));
  if ((view.commits ?? []).length !== 1) {
    reasons.push(`it is ${(view.commits ?? []).length} commits — a fix is ONE commit`);
  }

  // THE PROOF — runs of the head commit itself.
  const head = view.headRefOid;
  const runs = JSON.parse(gh(['api', `repos/${repo}/actions/runs?head_sha=${head}&per_page=100`])).workflow_runs ?? [];
  const latest = (name, event) => runs.filter((run) => run.name === name && (event === undefined || run.event === event))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const ci = latest('CI', 'pull_request');
  if (ci === undefined) {
    reasons.push('`CI` has not run on its head commit');
  } else if (ci.conclusion !== 'success') {
    reasons.push(`\`CI\` on its head commit is \`${ci.conclusion ?? ci.status}\` — ${ci.html_url}`);
  }
  const proofs = [];
  for (const [label, workflow] of Object.entries(PROOF)) {
    if (!issueLabels.includes(label)) {
      continue;
    }
    const run = latest(workflow, 'workflow_dispatch');
    if (run === undefined) {
      reasons.push(`the finding is \`${label}\`, and \`${workflow}\` was not re-run on the head commit`);
    } else if (run.conclusion !== 'success') {
      reasons.push(`the re-run of \`${workflow}\` on the head commit is \`${run.conclusion ?? run.status}\` — ${run.html_url}`);
    } else {
      proofs.push(`${workflow}: ${run.html_url}`);
    }
  }
  if (ci?.conclusion === 'success') {
    proofs.unshift(`CI: ${ci.html_url}`);
  }
  return {view, reasons, issueNumber, head, proofs, files: files.map((file) => file.path)};
}

function refuse(reasons) {
  const body = [`**Not landed.** \`scripts/ci/land.mjs\` refuses this pull request:`, '', ...reasons.map((reason) => `- ${reason}`), '',
    'Fix what is named and label it `land` again — or leave it to a working session (`docs/claude/ci-findings.md` § 3b).'].join('\n');
  console.error(body);
  if (!dry) {
    gh(['pr', 'comment', pr, '--repo', repo, '--body-file', '-'], body);
    try {
      gh(['pr', 'edit', pr, '--repo', repo, '--remove-label', 'land']);
    } catch {
      // (the label may not be there on a dispatch by hand)
    }
  }
  process.exit(1);
}

function land(verdict) {
  const {view, issueNumber, head, proofs} = verdict;
  git(['fetch', '--quiet', 'origin', head]);
  const original = git(['log', '-1', '--format=%an <%ae>', head]);
  const message = git(['log', '-1', '--format=%B', head]);
  for (let attempt = 1; attempt <= 3; attempt++) {
    git(['fetch', '--quiet', 'origin', 'main']);
    git(['checkout', '--quiet', '--force', '-B', 'ci-fix-landing', 'origin/main']);
    try {
      git(['merge', '--squash', '--quiet', head]);
    } catch (err) {
      git(['reset', '--quiet', '--hard', 'origin/main']);
      refuse([`it no longer applies to the tip of \`main\` (${String(err.stderr ?? err.message).split('\n')[0]}) — rebase the branch and prove it again`]);
    }
    const staged = git(['diff', '--cached', '--name-only']).split('\n').filter((line) => line !== '').sort();
    if (JSON.stringify(staged) !== JSON.stringify([...verdict.files].sort())) {
      refuse([`squashed onto \`main\` it changes ${staged.length} file(s), not the ${verdict.files.length} it was judged by — rebase the branch and prove it again`]);
    }
    // THE VERSION: one above everything already claimed — origin/main and the release tags of the remote.
    const version = nextVersion({useNetwork: true});
    if (version === undefined || !writeVersion(version)) {
      refuse(['the next version could not be derived']);
    }
    git(['add', ...VERSION_FILES]);
    const text = `${message.trim()}\n\nFixes #${issueNumber}\nLanded from #${view.number} by the ci-fix lane (scripts/ci/land.mjs).\n`;
    fs.writeFileSync('.git/CI_FIX_MSG', text);
    if (dry) {
      console.log(`[land] DRY — would push ${staged.length} file(s) as version ${version}:\n${text}`);
      return;
    }
    git(['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit', '--quiet', `--author=${original}`, '-F', '.git/CI_FIX_MSG']);
    const sha = git(['rev-parse', 'HEAD']);
    try {
      git(['push', '--quiet', 'origin', `${sha}:refs/heads/main`]);
    } catch (err) {
      // main moved between the fetch and the push — the landing is made again on the new tip.
      console.error(`[land] push refused (attempt ${attempt}): ${String(err.stderr ?? err.message).split('\n')[0]}`);
      continue;
    }
    console.log(`[land] pushed ${sha.slice(0, 10)} to main as version ${version}`);
    // A push made with the workflow's own token starts NO workflow — the release and CI of this commit are asked for.
    for (const workflow of ['Release Electron App', 'CI']) {
      try {
        gh(['workflow', 'run', workflow, '--repo', repo, '--ref', 'main']);
      } catch (err) {
        console.error(`[land] could not start «${workflow}»: ${String(err.stderr ?? err.message).split('\n')[0]}`);
      }
    }
    const done = [`**Landed** as \`${sha.slice(0, 10)}\` — version \`${version}\`. The release and \`CI\` of that commit were started.`, '',
      ...proofs.map((proof) => `- proven by ${proof}`)].join('\n');
    gh(['pr', 'comment', pr, '--repo', repo, '--body-file', '-'], done);
    gh(['pr', 'close', pr, '--repo', repo, '--delete-branch']);
    try {
      gh(['issue', 'close', issueNumber, '--repo', repo, '--comment', `Fixed by \`${sha.slice(0, 10)}\` (version \`${version}\`), landed from #${view.number}. Seen again → this issue reopens as a regression.`]);
      gh(['issue', 'edit', issueNumber, '--repo', repo, '--remove-label', 'fix:proposed', '--remove-label', 'triage:needed']);
    } catch {
      // (the commit's own «Fixes #» closes it; a missing label is not a failure)
    }
    return;
  }
  refuse(['`main` kept moving: three landings in a row were refused by the push — label it `land` again']);
}

const verdict = judge();
if (verdict.reasons.length > 0) {
  refuse(verdict.reasons);
}
console.log(`[land] #${pr} judged: ${verdict.files.length} file(s), proven by ${verdict.proofs.length} run(s)`);
land(verdict);
