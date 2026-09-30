/**
 * WHICH E2E SPECS CAN MY CHANGE BREAK? — `npm run e2e:affected [-- <ref>]`
 *
 * The e2e suite takes hours, so nobody runs it whole before a commit — and a
 * spec whose hook or copy the commit changed then rots silently until some
 * other agent meets it red and has to work out whose it is. The liveness guard
 * (`tests/console/e2eLiveness.spec.ts`) catches a hook that DISAPPEARS; this
 * finder covers the rest: a hook that still exists but now behaves differently.
 * It reads the change (the diff against `<ref>`, default HEAD — i.e. your
 * uncommitted work; pass `origin/main` for everything not yet pushed) and lists
 * every e2e file that talks to what changed:
 *
 *   · a changed CLIENT file (`src/client/**`): the hooks (`data-*`, classes) in
 *     the changed LINES — «direct» — and the hooks the file renders anywhere —
 *     «renders» (logic that changes behaviour without touching markup);
 *   · a changed RU LOCALE value: the specs whose text assertions wait for the
 *     old or the new phrase;
 *   · a changed e2e file: itself (a driver: every spec that imports it).
 *
 * Server / engine changes are not mapped (their e2e face is a fixture or a
 * flow, not a string) — the output says so rather than pretending coverage.
 *
 * Prints the files by strength and one command line to run them against a
 * private snapshot (`npm run e2e:snapshot`).
 */
import {execSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {copyRefs, e2eFiles, hookRefs, normPhrase, REPO_ROOT, rel, stripComments} from '../tests/console/e2eContract';

const ref = process.argv[2] ?? 'HEAD';
const git = (args: string) => execSync(`git ${args}`, {cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});

const changed = new Set<string>([
  ...git(`diff --name-only ${ref}`).split('\n'),
  ...git('ls-files --others --exclude-standard').split('\n'),
].map((f) => f.trim()).filter((f) => f !== ''));

/** Hook-like tokens in a text: `data-*` names and BEM-ish class names (`con-x__y--z`, `pcard__x`, …). */
function tokensIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?<![a-zA-Z0-9_-])data-[a-z0-9]+(?:-[a-z0-9]+)*/g)) {
    out.add(m[0]);
  }
  for (const m of text.matchAll(/(?<![a-zA-Z0-9_.-])([a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9-]+|--[a-z0-9-]+)+)/g)) {
    out.add(m[1]);
  }
  for (const m of text.matchAll(/class="([^"]+)"/g)) {
    m[1].split(/\s+/).filter((c) => /^[a-z][a-z0-9_-]*-[a-z0-9_-]+$/.test(c)).forEach((c) => out.add(c));
  }
  return out;
}

/** The added and removed lines of one file's diff. */
function diffLines(file: string): string {
  try {
    return git(`diff -U0 ${ref} -- "${file}"`).split('\n')
      .filter((l) => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'))
      .map((l) => l.slice(1)).join('\n');
  } catch {
    return '';
  }
}

type Strength = 'direct' | 'renders' | 'copy' | 'self';
type Hit = {spec: string; strength: Strength; why: Map<Strength, Set<string>>};
const hits = new Map<string, Hit>();
const STRENGTH = {self: 0, direct: 1, copy: 2, renders: 3} as const;
function hit(spec: string, strength: Strength, why: string): void {
  let h = hits.get(spec);
  if (h === undefined) {
    h = {spec, strength, why: new Map()};
    hits.set(spec, h);
  } else if (STRENGTH[strength] < STRENGTH[h.strength]) {
    h.strength = strength;
  }
  if (!h.why.has(strength)) {
    h.why.set(strength, new Set());
  }
  h.why.get(strength)!.add(why);
}
/** A hit's reasons, strongest first. */
function reasons(h: Hit): Array<string> {
  return (['self', 'direct', 'copy', 'renders'] as const).flatMap((s) => [...(h.why.get(s) ?? [])]);
}

const files = e2eFiles();
/** Exact hook → e2e files; a spec's DYNAMIC prefix (`.con-x--${state}` → `con-x--`) is kept apart and matches by prefix. */
const hookIndex = new Map<string, Set<string>>();
const prefixIndex = new Map<string, Set<string>>();
const copyIndex: Array<{phrase: string; file: string}> = [];
for (const file of files) {
  for (const ref of hookRefs(file)) {
    const index = /[-_]$/.test(ref.token) ? prefixIndex : hookIndex;
    if (!index.has(ref.token)) {
      index.set(ref.token, new Set());
    }
    index.get(ref.token)!.add(rel(file));
  }
  for (const ref of copyRefs(file)) {
    copyIndex.push({phrase: ref.phrase, file: rel(file)});
  }
}
/** Specs referencing a product token — exactly, or through a dynamic prefix the token extends. */
function specsFor(token: string): Set<string> {
  const out = new Set<string>(hookIndex.get(token) ?? []);
  for (const [prefix, specs] of prefixIndex) {
    if (prefix.length >= 6 && token.startsWith(prefix) && token.length > prefix.length) {
      specs.forEach((s) => out.add(s));
    }
  }
  return out;
}

const unmapped: Array<string> = [];
const drivers: Array<string> = [];
for (const file of changed) {
  const full = path.join(REPO_ROOT, file);
  if (file.startsWith('tests/e2e/') && file.endsWith('.ts') && !file.includes('/fixtures/')) {
    if (file.endsWith('.spec.ts')) {
      hit(file, 'self', 'the spec itself changed');
    } else {
      // A DRIVER is imported by (nearly) every spec — listing them all says nothing. The canary exercises
      // every load-bearing primitive in ~20 s and goes red first, naming the driver.
      drivers.push(file);
    }
    continue;
  }
  if (file.startsWith('src/client/') && /\.(vue|ts)$/.test(file)) {
    for (const token of tokensIn(stripComments(diffLines(file)))) {
      specsFor(token).forEach((spec) => hit(spec, 'direct', `${token} (changed lines of ${file})`));
    }
    if (fs.existsSync(full)) {
      for (const token of tokensIn(stripComments(fs.readFileSync(full, 'utf8')))) {
        specsFor(token).forEach((spec) => hit(spec, 'renders', `${token} (rendered by ${file})`));
      }
    }
    continue;
  }
  if (file.startsWith('src/locales/ru/') && file.endsWith('.json')) {
    for (const line of diffLines(file).split('\n')) {
      const value = line.match(/:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
      if (value === undefined) {
        continue;
      }
      const phrase = normPhrase(value);
      for (const ref of copyIndex) {
        // One short word («бот», «наград») matches half the locale — only a phrase that could only mean this copy counts.
        if ((ref.phrase.includes(' ') || ref.phrase.length >= 8) && phrase.includes(ref.phrase)) {
          hit(ref.file, 'copy', `«${ref.phrase}» (${file})`);
        }
      }
    }
    continue;
  }
  if (/^src\/(server|common)\//.test(file)) {
    unmapped.push(file);
  }
}

const rows = [...hits.values()].sort((a, b) => STRENGTH[a.strength] - STRENGTH[b.strength] || a.spec.localeCompare(b.spec));
const specs = rows.filter((r) => r.spec.endsWith('.spec.ts'));
console.log(`e2e specs a change against ${ref} can break: ${specs.length} (of ${files.filter((f) => f.endsWith('.spec.ts')).length})`);
for (const strength of ['self', 'direct', 'copy', 'renders'] as const) {
  const group = specs.filter((r) => r.strength === strength);
  if (group.length === 0) {
    continue;
  }
  const label = {self: 'the spec itself changed', direct: 'waits for a hook in the CHANGED lines', copy: 'waits for changed copy', renders: 'waits for a hook the changed file renders'}[strength];
  console.log(`\n${label} (${group.length}):`);
  for (const r of group) {
    const why = reasons(r);
    console.log(`  ${r.spec.replace(/^tests\/e2e\//, '')}  ← ${why.slice(0, 3).join('; ')}${why.length > 3 ? ` (+${why.length - 3})` : ''}`);
  }
}
if (drivers.length > 0) {
  console.log(`
shared driver(s) changed: ${drivers.join(', ')} — every spec imports them; run \`aaa-driver-canary.spec.ts\` first (it exercises every load-bearing primitive)`);
}
if (unmapped.length > 0) {
  console.log(`\nnot mapped (server / engine — their e2e face is a fixture or a flow): ${unmapped.length} file(s), e.g. ${unmapped.slice(0, 3).join(', ')} — run the feature's e2e family by name`);
}
const strong = [...(drivers.length > 0 ? ['tests/e2e/aaa-driver-canary.spec.ts'] : []), ...specs.filter((r) => r.strength !== 'renders').map((r) => r.spec)];
if (strong.length > 0) {
  console.log(`\nrun (direct + copy + self):\n  TM_E2E_ROOT=.e2e-<name> npx playwright test ${strong.map((s) => s.replace(/^tests\/e2e\//, '')).join(' ')}`);
}
