// `node scripts/vapor/template-diff.mjs <base rev> [--allow <path> …]` — «THE TEMPLATE DOES NOT CHANGE», CHECKED.
//
// A conversion (docs/claude/vapor/RECIPES.md § 0) rewrites the SCRIPT of a component; its template is the contract with
// the stylesheet, the e2e hooks and the player's eye, and the book licenses exactly three kinds of edit to it: a
// comment outside a root moves (R24), a root gains a `ref` where the script read `$el` (R12), a branch gains the guard
// vue-tsc asks for (R2). Nothing compares the two templates by itself — vue-tsc reads types, the specs read what they
// assert — so an accidental edit rides a wave unseen (wave 2: a space lost between two attributes of a root).
//
// For every `.vue` under src/client whose script was Options-API at <base> and is `<script setup>` now, this prints
// each template line that differs — COMMENTS ASIDE (they are what R24 moves) and blank lines aside — and exits 1 when
// any file differs that the caller did not name with `--allow`. The wave's lead reads the lines: each is one of the
// three licensed edits and is named in its commit, or it is a mistake to put back.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const base = args[0];
if (base === undefined || base.startsWith('--')) {
  console.error('usage: node scripts/vapor/template-diff.mjs <base rev> [--allow <path> …]');
  process.exit(2);
}
const allowed = new Set(args.flatMap((arg, i) => (arg === '--allow' && args[i + 1] !== undefined ? [args[i + 1].split(path.sep).join('/')] : [])));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith('.vue')) {
      out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  }
  return out;
}

const isSetup = (text) => /<script\b[^>]*\bsetup\b[^>]*>/.test(text);

/** The template's lines, comments and blank lines aside. */
function bare(text) {
  const source = text.replace(/\r\n/g, '\n');
  const open = source.indexOf('<template');
  const close = source.lastIndexOf('</template>');
  if (open === -1 || close === -1) {
    return [];
  }
  return source.slice(source.indexOf('>', open) + 1, close).replace(/<!--[\s\S]*?-->/g, '').split('\n')
    .map((line) => line.trimEnd()).filter((line) => line.trim() !== '');
}

let converted = 0;
const differing = [];
for (const file of walk(path.join(ROOT, 'src', 'client'))) {
  const now = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (!isSetup(now)) {
    continue;
  }
  let was;
  try {
    was = execFileSync('git', ['show', `${base}:${file}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024});
  } catch {
    continue; // a file that did not exist at <base> — a new component, not a conversion
  }
  if (isSetup(was)) {
    continue;
  }
  converted++;
  const a = bare(was);
  const b = bare(now);
  if (a.length === b.length && a.every((line, i) => line === b[i])) {
    continue;
  }
  // the lines of one side the other does not have, in order (a multiset difference — enough to READ an edit)
  const count = (lines) => lines.reduce((map, line) => map.set(line, (map.get(line) ?? 0) + 1), new Map());
  const [inA, inB] = [count(a), count(b)];
  const gone = a.filter((line) => (inB.get(line) ?? 0) < inA.get(line));
  const came = b.filter((line) => (inA.get(line) ?? 0) < inB.get(line));
  differing.push({file, gone, came});
}

for (const {file, gone, came} of differing) {
  console.log(`${allowed.has(file) ? 'allowed' : 'DIFFERS'}  ${file}`);
  for (const line of gone.slice(0, 8)) {
    console.log(`    - ${line.trim().slice(0, 200)}`);
  }
  for (const line of came.slice(0, 8)) {
    console.log(`    + ${line.trim().slice(0, 200)}`);
  }
  if (gone.length === 0 && came.length === 0) {
    console.log('    (the same lines in another ORDER)');
  }
}
const unexplained = differing.filter(({file}) => !allowed.has(file));
console.log(`${converted} component(s) converted since ${base} · ${differing.length} template(s) differ outside their comments · ${unexplained.length} not allowed`);
process.exit(unexplained.length > 0 ? 1 : 0);
