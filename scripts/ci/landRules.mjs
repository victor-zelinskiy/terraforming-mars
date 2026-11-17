#!/usr/bin/env node
/**
 * WHAT A CI-FIX MAY TOUCH (docs/claude/ci-findings.md § 3a, § 3b) — the rule the landing judges a pull request's
 * files by, as a pure function: `fileRefusals(files)` → the reasons it may NOT land (empty = it may).
 *
 * `files` is GitHub's own list: `[{path, additions, deletions}]`. Guard: tests/ci/landRules.spec.ts
 * (`node scripts/ci/landRules.mjs '<json: a list of file lists>'` prints a list of reason lists — how the spec asks).
 */
import {fileURLToPath} from 'node:url';

/** What a fix of the lane never touches, whatever its size — a working session decides these. */
export const FORBIDDEN = [
  [/^\.github\//, 'a workflow'],
  [/^\.githooks\//, 'a git hook'],
  [/^\.claude\//, 'the agent rules'],
  [/^docs\//, 'the documents (a contract is not changed by the lane it governs)'],
  [/^scripts\//, 'a build or CI script'],
  [/^(package\.json|package-lock\.json|\.nvmrc|CLAUDE\.md)$/, 'the version, a dependency, the toolchain or the project rules'],
  [/^(vite\.config|playwright\.config|eslint\.config|tsconfig)/, 'the toolchain configuration'],
  [/Baseline\.json$/i, 'a baseline (a ratchet row is a decision of a working session)'],
  [/^tests\/client\/bottle\/consoleBottle\.ts$/, 'the bottle harness (LAYOUT_BLIND lives there)'],
  [/^src\/server\//, 'the server (rules are server-authoritative)'],
  [/^src\/common\//, 'the shared models'],
  [/^src\/locales\//, 'the translations'],
  [/^src\/client\/console\/(kernel|transport|waitGraph)\//, 'the flow kernel, the transport or the wait graph'],
  [/^src\/client\/console\/(consoleLiveness|livenessOscillation|consoleSupervisor)/, 'a liveness net'],
  [/^src\/client\/components\/presentation\/animationHold/, 'the hold registry'],
  [/^electron\//, 'the desktop shell'],
];
export const MAX_PRODUCT_FILES = 3;
export const MAX_PRODUCT_LINES = 80;
export const MAX_FILES = 12;
export const MAX_LINES = 600;

const lines = (list) => list.reduce((n, file) => n + (file.additions ?? 0) + (file.deletions ?? 0), 0);

export function fileRefusals(files) {
  const reasons = [];
  for (const file of files) {
    const hit = FORBIDDEN.find(([pattern]) => pattern.test(file.path));
    if (hit !== undefined) {
      reasons.push(`it touches \`${file.path}\` — ${hit[1]}`);
    }
  }
  const product = files.filter((file) => file.path.startsWith('src/'));
  if (files.length === 0) {
    reasons.push('it changes nothing');
  }
  if (files.length > MAX_FILES || lines(files) > MAX_LINES) {
    reasons.push(`it is ${files.length} file(s), ${lines(files)} line(s) — a simple fix is at most ${MAX_FILES} files, ${MAX_LINES} lines`);
  }
  if (product.length > MAX_PRODUCT_FILES || lines(product) > MAX_PRODUCT_LINES) {
    reasons.push(`it changes ${product.length} product file(s), ${lines(product)} line(s) — a trivial bug is at most ${MAX_PRODUCT_FILES} files, ${MAX_PRODUCT_LINES} lines`);
  }
  // A product change with no spec beside it is not a proven fix: «red before, green after» needs the spec in the diff.
  if (product.length > 0 && !files.some((file) => file.path.startsWith('tests/'))) {
    reasons.push('it changes the product with no spec in the same diff');
  }
  return reasons;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // (A list of file lists in, a list of reason lists out — one process for a whole table of cases.)
  process.stdout.write(`${JSON.stringify(JSON.parse(process.argv[2] ?? '[]').map((files) => fileRefusals(files)))}\n`);
}
