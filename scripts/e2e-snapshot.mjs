#!/usr/bin/env node
/**
 * A PRIVATE E2E BUILD — `npm run e2e:snapshot <name>`.
 *
 * Several sessions share one clone, and `build/` is the one thing every e2e
 * worker server serves from: a neighbour's `npm run build` (or `webpack
 * --watch`) rewrites the product in the middle of your run, and every red after
 * that moment is a verdict about THEIR build, not your code (2026-09-30: a
 * parliament run lost ~40 tests' worth of meaning this way). A shared
 * `.e2e-frozen/` copy only moved the collision — two sessions froze into the
 * same folder.
 *
 * This copies the CURRENT build/ (minus the compiled tests) to `.e2e-<name>/`,
 * links what the server reads relative to its cwd beside it — `assets/` and
 * the engine-generated `tests/e2e/fixtures/` the «Полигон» live scenarios boot
 * (without it every live scenario read «В этой сборке этого сценария нет») — as
 * a junction on Windows, a symlink elsewhere, refuses a build whose server still
 * carries unrewritten `@/` imports (a bare `tsc --build` without `tsc-alias`
 * boots nothing), and prints the one line that makes the harness serve it:
 *
 *   TM_E2E_ROOT=.e2e-<name> npx playwright test <spec>
 *
 * The folder is private: pick a name nobody else uses (your task's name).
 * Re-running with the same name replaces it.
 */
import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';

const ROOT = process.cwd();
const name = (process.argv[2] ?? '').trim();
if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) {
  console.error('usage: npm run e2e:snapshot <name>   (letters, digits, dashes — your task\'s name)');
  process.exit(2);
}
if (name === 'frozen') {
  console.error('`.e2e-frozen/` is the historical SHARED folder other sessions still serve from — pick a name of your own');
  process.exit(2);
}
const BUILD = path.join(ROOT, 'build');
const serverEntry = path.join(BUILD, 'src', 'server', 'server.js');
if (!fs.existsSync(serverEntry) || !fs.existsSync(path.join(BUILD, 'main.js'))) {
  console.error('no complete build/ (server + client) — run `npm run build` first');
  process.exit(1);
}

function* jsFiles(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* jsFiles(full);
    } else if (entry.name.endsWith('.js')) {
      yield full;
    }
  }
}
const unresolved = [];
for (const file of jsFiles(path.join(BUILD, 'src', 'server'))) {
  if (fs.readFileSync(file, 'utf8').includes('require("@/')) {
    unresolved.push(path.relative(ROOT, file));
    if (unresolved.length >= 3) {
      break;
    }
  }
}
if (unresolved.length > 0) {
  console.error(`the server build still requires "@/…" (a bare tsc without tsc-alias): ${unresolved.join(', ')} — run \`npm run build:server\``);
  process.exit(1);
}

const target = path.join(ROOT, `.e2e-${name}`);
/** Every directory the server reads RELATIVE TO ITS CWD (grep `path.resolve('` under src/server): linked, never copied. */
const LINKS = ['assets', path.join('tests', 'e2e', 'fixtures')];
for (const rel of LINKS) {
  const link = path.join(target, rel);
  if (fs.existsSync(link)) {
    // A junction is removed as a LINK, never recursed into (it would delete the real directory).
    if (process.platform === 'win32') {
      execSync(`cmd /c rmdir "${link}"`);
    } else {
      fs.unlinkSync(link);
    }
  }
}
fs.rmSync(path.join(target, 'build'), {recursive: true, force: true});
fs.mkdirSync(target, {recursive: true});
fs.cpSync(BUILD, path.join(target, 'build'), {
  recursive: true,
  // The build's OWN times travel with it: the harness judges STALE by them, and a copy stamped «now» is never stale.
  preserveTimestamps: true,
  filter: (src) => path.relative(BUILD, src).split(path.sep)[0] !== 'tests',
});
for (const rel of LINKS) {
  const link = path.join(target, rel);
  fs.mkdirSync(path.dirname(link), {recursive: true});
  if (process.platform === 'win32') {
    execSync(`cmd /c mklink /J "${link}" "${path.join(ROOT, rel)}"`, {stdio: 'ignore'});
  } else {
    fs.symlinkSync(path.join(ROOT, rel), link, 'dir');
  }
}

const exclude = path.join(ROOT, '.git', 'info', 'exclude');
if (fs.existsSync(path.dirname(exclude))) {
  const current = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
  if (!current.split(/\r?\n/).includes('.e2e-*/')) {
    fs.appendFileSync(exclude, `${current.endsWith('\n') || current === '' ? '' : '\n'}.e2e-*/\n`);
  }
}

let stamp = '';
try {
  const settings = JSON.parse(fs.readFileSync(path.join(target, 'build', 'src', 'genfiles', 'settings.json'), 'utf8'));
  stamp = ` (build ${settings.head}, ${settings.builtAt})`;
} catch {
  // an old build without a stamp — still servable
}
console.log(`snapshot .e2e-${name}${stamp}`);
console.log(`run:  TM_E2E_ROOT=.e2e-${name} npx playwright test <spec>`);
