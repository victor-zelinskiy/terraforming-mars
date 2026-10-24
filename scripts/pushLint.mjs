// THE LINT OF WHAT IS BEING PUSHED (the owner, 2026-10-24 — three CI runs in one day died on `lint:server` over commits
// nobody had linted). Read by the pre-push guard (scripts/check-push.mjs).
//
// Lints the COMMITTED content of every src/ / tests/ file (what `lint:server` lints) the pushed range changes — read with
// `git show <sha>:<path>`, never the working tree, where other sessions' uncommitted work sits — through ESLint's own
// API with the repo's flat config (it has no typed rules, so a text lint is the whole lint). One ESLint instance;
// seconds for a normal push.
//
// Fail-open on anything it cannot determine (no merge base, ESLint unloadable): returns no problems.
//
// Usage (by hand): node scripts/pushLint.mjs <base-sha> <local-sha>

import {execFileSync} from 'node:child_process';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** `path:line:col  message  (rule)` for every lint ERROR in the files `base..local` changes; [] when clean or unknown. */
export async function lintPushedRange(base, localSha, remoteName = 'origin') {
  let files;
  try {
    const from = base ?? execFileSync('git', ['merge-base', localSha, `${remoteName}/main`], {cwd: root, encoding: 'utf8'}).trim();
    files = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', from, localSha], {cwd: root, encoding: 'utf8'})
      .split('\n').map((f) => f.trim())
      .filter((f) => /^(src|tests)\//.test(f) && /\.(ts|vue|m?js)$/.test(f));
  } catch {
    return []; // cannot tell what is pushed → cannot judge it
  }
  if (files.length === 0) {
    return [];
  }
  let ESLint;
  try {
    ({ESLint} = await import('eslint'));
  } catch {
    return [];
  }
  const eslint = new ESLint({cwd: root});
  const problems = [];
  for (const file of files) {
    const text = execFileSync('git', ['show', `${localSha}:${file}`], {cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
    const [result] = await eslint.lintText(text, {filePath: path.join(root, file), warnIgnored: false});
    for (const m of result?.messages ?? []) {
      if (m.severity === 2) {
        problems.push(`${file}:${m.line}:${m.column}  ${m.message}  (${m.ruleId ?? 'parse'})`);
      }
    }
  }
  return problems;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [base, local] = process.argv.slice(2);
  const problems = await lintPushedRange(base, local ?? 'HEAD');
  console.log(problems.length === 0 ? 'push lint: clean' : problems.join('\n'));
  process.exit(problems.length === 0 ? 0 : 1);
}
