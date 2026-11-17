#!/usr/bin/env node
/**
 * THE CI-FIX LANE, THE REPOSITORY'S HALF (docs/claude/ci-findings.md § 3b) — the one way a fix of the morning triage
 * agent reaches `main`, with nobody's hand on it.
 *
 * The agent does ONE thing: it pushes a branch `claude/ci-fix-<issue>-<slug>` and opens a pull request whose body
 * says `Fixes #<issue>`. Everything after that is this script, run by `.github/workflows/land-ci-fix.yml` from the
 * checkout of `main`:
 *
 *   node scripts/ci/land.mjs <pr> --open     the pull request appeared or moved: label it, judge WHAT IT IS and WHAT
 *                                            IT TOUCHES, and start the PROOF — the re-run the finding's own issue
 *                                            names (`<!-- ci-proof:… -->`, written by scripts/ci/findings.mjs)
 *   node scripts/ci/land.mjs <pr> [--wait <minutes>]
 *                                            a run of its head commit ended, or the sweep came by: judge everything;
 *                                            a proof that was never started is started; while one still runs wait
 *                                            (`--wait`) or say nothing; when all is green LAND
 *   node scripts/ci/land.mjs <pr> --dry      judge and print, change nothing
 *
 * LANDED = the change squashed onto the tip of `main` as ONE commit carrying its own version bump (every push to
 * `main` is a release; GitHub's merge button would ship a version a release already claimed), pushed, the release
 * and CI of that commit started by name (a push made with a workflow's token starts no workflow), the pull request
 * and the issue closed.
 *
 * REFUSED — in writing, once per head commit: it is not a one-finding fix from a `claude/ci-fix-…` branch of THIS
 * repository; it touches what the lane may never touch or is larger than a simple fix (scripts/ci/landRules.mjs);
 * its proof is red; it no longer applies to `main`.
 *
 * WHY IT WAITS AND WHY THERE IS A SWEEP: a run started with a workflow's own token (the proof; the release and CI of
 * a landed commit) raises NO event when it ends — found on the lane's first live pass, 2026-11-17. So the judgement
 * that `CI` of the pull request wakes waits for the proof itself, and a scheduled sweep judges every open pull
 * request of the lane again: no landing hangs on the order two runs happen to end in.
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
const opening = args.includes('--open');
const waitAt = args.indexOf('--wait');
const waitMinutes = waitAt === -1 ? 0 : Number(args[waitAt + 1] ?? 0) || 0;
const pr = args.find((arg, i) => /^\d+$/.test(arg) && i !== waitAt + 1);
const repo = process.env.GITHUB_REPOSITORY ?? '';
if (pr === undefined || repo === '') {
  console.error('usage: node scripts/ci/land.mjs <pr number> [--open] [--dry]   (needs GH_TOKEN and GITHUB_REPOSITORY)');
  process.exit(2);
}

/** The workflows a proof may be — a marker naming anything else is not a proof. */
const PROOF_WORKFLOWS = ['Playwright E2E', 'Monkey', 'Freeze gate'];
const PROOF_MARK = /<!-- ci-proof:([A-Za-z0-9+/=]+) -->/;

function sh(file, argv, options = {}) {
  return execFileSync(file, argv, {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...options});
}
const gh = (argv, input) => sh('gh', argv, {input});
// (The version is derived HERE, against the remote — a commit hook must not bump it once more.)
const git = (argv) => sh('git', argv, {env: {...process.env, TM_SKIP_VERSION_BUMP: '1'}}).trim();
const firstLine = (err) => String(err.stderr ?? err.message).split('\n')[0];

/** Say it on the pull request ONCE per head commit and per kind — a run that ends twice must not say it twice. */
function say(kind, head, body) {
  const mark = `<!-- ci-fix-lane:${kind}:${head} -->`;
  console.log(`[land] ${kind}:\n${body}`);
  if (dry) {
    return;
  }
  const comments = JSON.parse(gh(['pr', 'view', pr, '--repo', repo, '--json', 'comments'])).comments ?? [];
  if (comments.some((comment) => String(comment.body ?? '').includes(mark))) {
    return;
  }
  gh(['pr', 'comment', pr, '--repo', repo, '--body-file', '-'], `${body}\n\n${mark}`);
}

function refuse(head, reasons, stage = 'refused') {
  say(stage, head, ['**Not landed.** The ci-fix lane (`scripts/ci/land.mjs`) refuses this pull request:', '',
    ...reasons.map((reason) => `- ${reason}`), '',
    'A new commit on the branch is judged again from the start; otherwise this is for a working session (`docs/claude/ci-findings.md` § 3b).'].join('\n'));
  process.exit(dry ? 1 : 0);
}

/** WHAT IT IS and WHAT IT TOUCHES — decidable the moment the pull request appears. */
function judgeShape() {
  const reasons = [];
  const view = JSON.parse(gh(['pr', 'view', pr, '--repo', repo, '--json',
    'number,title,state,isDraft,baseRefName,headRefName,headRefOid,isCrossRepository,body,files']));
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

  // THE FINDING IT FIXES — one, named the same by the branch and by the body.
  const fixes = [...new Set([...String(view.body ?? '').matchAll(/\bFixes #(\d+)\b/gi)].map((m) => m[1]))];
  const issueNumber = branch?.[1];
  let issueLabels = [];
  let proof;
  if (fixes.length !== 1 || fixes[0] !== issueNumber) {
    reasons.push(`its body must say \`Fixes #${issueNumber ?? '<issue>'}\` — the one issue its branch names (found: ${fixes.map((n) => `#${n}`).join(', ') || 'none'})`);
  } else {
    try {
      const issue = JSON.parse(gh(['issue', 'view', issueNumber, '--repo', repo, '--json', 'state,labels,body']));
      issueLabels = (issue.labels ?? []).map((label) => label.name);
      if (issue.state !== 'OPEN') {
        reasons.push(`issue #${issueNumber} is ${issue.state}, not open`);
      }
      if (!issueLabels.includes('ci-finding')) {
        reasons.push(`issue #${issueNumber} is not a \`ci-finding\``);
      }
      const mark = PROOF_MARK.exec(issue.body ?? '');
      if (mark !== null) {
        proof = JSON.parse(Buffer.from(mark[1], 'base64').toString('utf8'));
      }
    } catch {
      reasons.push(`issue #${issueNumber} could not be read`);
    }
  }
  // WHAT PROVES IT: a red job of a push is proven by `CI` on the pull request; everything else by the re-run its
  // issue names. A finding with no re-run to make (a flood, a run with no verdict) is not for the lane to land.
  if (proof !== undefined && !PROOF_WORKFLOWS.includes(proof.workflow)) {
    reasons.push(`its finding names \`${proof.workflow}\` as its proof — not a workflow the lane re-runs`);
    proof = undefined;
  } else if (proof === undefined && issueNumber !== undefined && issueLabels.includes('ci-finding') && !issueLabels.includes('src:ci')) {
    reasons.push(`issue #${issueNumber} names no proof run (a finding with no test to re-run is landed by a working session)`);
  }

  const files = view.files ?? [];
  reasons.push(...fileRefusals(files));
  return {view, reasons, issueNumber, head: view.headRefOid, proof, files: files.map((file) => file.path)};
}

/** The runs of the head commit itself: `CI` of the pull request and the proof — `pending` while one is not over. */
function judgeProof(shape) {
  const reasons = [];
  const pending = [];
  const proofs = [];
  const runs = JSON.parse(gh(['api', `repos/${repo}/actions/runs?head_sha=${shape.head}&per_page=100`])).workflow_runs ?? [];
  const latest = (name, event) => runs.filter((run) => run.name === name && run.event === event)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  let proofMissing = false;
  const check = (name, event) => {
    const run = latest(name, event);
    if (run === undefined || run.status !== 'completed') {
      pending.push(name);
      proofMissing ||= run === undefined && event === 'workflow_dispatch';
    } else if (run.conclusion !== 'success') {
      reasons.push(`\`${name}\` on its head commit is \`${run.conclusion}\` — ${run.html_url}`);
    } else {
      proofs.push(`${name}: ${run.html_url}`);
    }
  };
  check('CI', 'pull_request');
  if (shape.proof !== undefined) {
    check(shape.proof.workflow, 'workflow_dispatch');
  }
  return {reasons, pending, proofs, proofMissing};
}

function startProof(shape) {
  const inputs = Object.entries(shape.proof.inputs ?? {}).flatMap(([name, value]) => ['-f', `${name}=${value}`]);
  if (!dry) {
    gh(['workflow', 'run', shape.proof.workflow, '--repo', repo, '--ref', shape.view.headRefName, ...inputs]);
  }
}

/** `--open`: label it, refuse what can be refused at sight, start the proof on its branch. */
function open(shape) {
  if (!dry) {
    try {
      gh(['pr', 'edit', pr, '--repo', repo, '--add-label', 'ci-fix']);
    } catch (err) {
      console.error(`[land] label: ${firstLine(err)}`);
    }
  }
  if (shape.reasons.length > 0) {
    refuse(shape.head, shape.reasons);
  }
  if (shape.proof === undefined) {
    say('proof', shape.head, 'The ci-fix lane took this pull request: its finding is a red job of a push, so `CI` on this pull request is the proof. Green → it lands by itself.');
    return;
  }
  startProof(shape);
  say('proof', shape.head, [`The ci-fix lane took this pull request and started its proof on this branch: \`${shape.proof.workflow}\``,
    `(${Object.entries(shape.proof.inputs ?? {}).map(([name, value]) => `\`${name}=${value}\``).join(' · ')}).`,
    'That run and `CI` green on this head commit → it lands by itself.'].join(' '));
}

function land(shape, proofs) {
  const {view, issueNumber, head} = shape;
  git(['fetch', '--quiet', 'origin', head]);
  const original = git(['log', '-1', '--format=%an <%ae>', head]);
  // (Several commits on the branch are one fix: the message is then the pull request's own.)
  const count = Number(git(['rev-list', '--count', `origin/main..${head}`]));
  const message = count === 1 ? git(['log', '-1', '--format=%B', head]) : `${view.title}\n\n${String(view.body ?? '').replace(/\r/g, '')}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    git(['fetch', '--quiet', 'origin', 'main']);
    git(['checkout', '--quiet', '--force', '-B', 'ci-fix-landing', 'origin/main']);
    try {
      git(['merge', '--squash', '--quiet', head]);
    } catch (err) {
      git(['reset', '--quiet', '--hard', 'origin/main']);
      refuse(head, [`it no longer applies to the tip of \`main\` (${firstLine(err)}) — rebase the branch`], 'refused-landing');
    }
    const staged = git(['diff', '--cached', '--name-only']).split('\n').filter((line) => line !== '').sort();
    if (JSON.stringify(staged) !== JSON.stringify([...shape.files].sort())) {
      git(['reset', '--quiet', '--hard', 'origin/main']);
      refuse(head, [`squashed onto \`main\` it changes ${staged.length} file(s), not the ${shape.files.length} it was judged by — rebase the branch`], 'refused-landing');
    }
    // THE VERSION: one above everything already claimed — origin/main and the release tags of the remote.
    const version = nextVersion({useNetwork: true});
    if (version === undefined || !writeVersion(version)) {
      refuse(head, ['the next version could not be derived'], 'refused-landing');
    }
    git(['add', ...VERSION_FILES]);
    const text = `${message.trim().replace(/\n*Fixes #\d+\s*$/i, '')}\n\nFixes #${issueNumber}\nLanded from #${view.number} by the ci-fix lane (scripts/ci/land.mjs).\n`;
    fs.writeFileSync('.git/CI_FIX_MSG', text);
    if (dry) {
      console.log(`[land] DRY — would push ${staged.length} file(s) as version ${version}:\n${text}`);
      git(['reset', '--quiet', '--hard', 'origin/main']);
      return;
    }
    git(['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit', '--quiet', `--author=${original}`, '-F', '.git/CI_FIX_MSG']);
    const sha = git(['rev-parse', 'HEAD']);
    try {
      git(['push', '--quiet', 'origin', `${sha}:refs/heads/main`]);
    } catch (err) {
      // main moved between the fetch and the push — the landing is made again on the new tip.
      console.error(`[land] push refused (attempt ${attempt}): ${firstLine(err)}`);
      continue;
    }
    console.log(`[land] pushed ${sha.slice(0, 10)} to main as version ${version}`);
    // A push made with the workflow's own token starts NO workflow — the release and CI of this commit are asked for.
    for (const workflow of ['Release Electron App', 'CI']) {
      try {
        gh(['workflow', 'run', workflow, '--repo', repo, '--ref', 'main']);
      } catch (err) {
        console.error(`[land] could not start «${workflow}»: ${firstLine(err)}`);
      }
    }
    say('landed', head, [`**Landed** as \`${sha.slice(0, 10)}\` — version \`${version}\`. The release and \`CI\` of that commit were started.`, '',
      ...proofs.map((proof) => `- proven by ${proof}`)].join('\n'));
    gh(['pr', 'close', pr, '--repo', repo, '--delete-branch']);
    try {
      gh(['issue', 'close', issueNumber, '--repo', repo, '--comment',
        `Fixed by \`${sha.slice(0, 10)}\` (version \`${version}\`), landed from #${view.number}. Seen again → this issue reopens as a regression.`]);
      gh(['issue', 'edit', issueNumber, '--repo', repo, '--remove-label', 'triage:needed']);
    } catch {
      // (the commit's own «Fixes #» closes it; a missing label is not a failure)
    }
    return;
  }
  refuse(head, ['`main` kept moving: three landings in a row were refused by the push'], 'refused-landing');
}

const shape = judgeShape();
if (opening) {
  open(shape);
} else {
  if (shape.reasons.length > 0) {
    refuse(shape.head, shape.reasons);
  }
  const deadline = Date.now() + waitMinutes * 60_000;
  let restarted = false;
  for (;;) {
    const proof = judgeProof(shape);
    if (proof.reasons.length > 0) {
      refuse(shape.head, proof.reasons, 'refused-proof');
    }
    if (proof.pending.length === 0) {
      console.log(`[land] #${pr} judged: ${shape.files.length} file(s), proven by ${proof.proofs.length} run(s)`);
      land(shape, proof.proofs);
      break;
    }
    // A PROOF NOBODY STARTED (the dispatch was lost, the issue gained its marker later) is started here, once.
    if (proof.proofMissing && !restarted && !dry) {
      console.log(`[land] #${pr}: no run of «${shape.proof.workflow}» on its head commit — starting it`);
      startProof(shape);
      restarted = true;
    }
    if (Date.now() >= deadline) {
      // NOT YET: said by nobody — the next run that ends, or the sweep, asks again.
      console.log(`[land] #${pr} waits for: ${proof.pending.join(', ')}`);
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30_000);
    // A new commit while we waited is another judgement — its own event has it.
    const now = JSON.parse(gh(['pr', 'view', pr, '--repo', repo, '--json', 'headRefOid,state']));
    if (now.headRefOid !== shape.head || now.state !== 'OPEN') {
      console.log(`[land] #${pr} moved while it was waited for — left to its own event`);
      break;
    }
  }
}
