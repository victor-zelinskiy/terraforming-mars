#!/usr/bin/env node
/*
 * THE TYPESCRIPT 7.1 PREVIEW — a NON-BLOCKING check (docs/claude/stack.md § 5): the project's own type checks run
 * once with the TypeScript it is on (6.x — `tsc`, and `vue-tsc` for the client) and once with TypeScript 7.1 (the
 * native `tsc`, and `@vue/content-mapper` for the `.vue` files), and the DIFFERENCE is printed: what 7.1 says that 6
 * does not, and the other way round, per checked tree, with the time each took.
 *
 *   node scripts/stack/ts7-check.mjs                 every tree (server · electron · tests · e2e · client)
 *   node scripts/stack/ts7-check.mjs client server   some of them
 *   node scripts/stack/ts7-check.mjs --checkers 8    TS 7.1 with eight checkers per project (the mapper's speed)
 *   node scripts/stack/ts7-check.mjs --strict        exit 1 when 7.1 reports anything 6 does not
 *
 * The 7.1 toolchain lives in `.local/ts7/` (an isolated `npm install` of the two pinned packages below — never the
 * project's `node_modules`), installed on the first run and whenever a pin changes. It never changes the repository:
 * the client's 7.1 config is generated there (the project's `tsconfig.vue-tsc.json` + the mapper's `contentMappers`).
 *
 * The move to 7.1 itself is a version bump (`typescript`, `vue-tsc` → the mapper) once its blockers fall — § 5 lists them.
 */
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOOLCHAIN = path.join(ROOT, '.local', 'ts7');
const PINS = {'typescript': '7.1.0-beta', '@vue/content-mapper': '4.0.0-alpha.3'};

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const checkersAt = args.indexOf('--checkers');
const checkers = checkersAt === -1 ? undefined : args[checkersAt + 1];
const TREES = {
  server: {config: 'src/tsconfig.json'},
  electron: {config: 'electron/tsconfig.json'},
  tests: {config: 'tests/tsconfig.json'},
  e2e: {config: 'tests/e2e/tsconfig.json'},
  client: {config: 'tsconfig.vue-tsc.json', vue: true},
};
const asked = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--checkers');
const trees = asked.length > 0 ? asked : Object.keys(TREES);
for (const name of trees) {
  if (TREES[name] === undefined) {
    console.error(`ts7-check: no tree «${name}» — ${Object.keys(TREES).join(' · ')}`);
    process.exit(2);
  }
}

/** The isolated 7.1 toolchain, (re)installed when a pin moved. */
function toolchain() {
  const manifest = path.join(TOOLCHAIN, 'package.json');
  const wanted = JSON.stringify({name: 'tm-ts7-preview', private: true, dependencies: PINS}, null, 2);
  if (!fs.existsSync(manifest) || fs.readFileSync(manifest, 'utf8') !== wanted || !fs.existsSync(path.join(TOOLCHAIN, 'node_modules'))) {
    fs.mkdirSync(TOOLCHAIN, {recursive: true});
    fs.writeFileSync(manifest, wanted);
    console.log(`[ts7] installing ${Object.entries(PINS).map(([name, version]) => `${name}@${version}`).join(' ')} into .local/ts7 …`);
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund', '--no-package-lock'], {cwd: TOOLCHAIN, stdio: 'inherit', shell: process.platform === 'win32'});
  }
  return {tsc7: path.join(TOOLCHAIN, 'node_modules', 'typescript', 'bin', 'tsc')};
}

/** One checker run → its diagnostics as `file(line,col): error TSxxxx` lines, and its time. */
function run(command, commandArgs) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [command, ...commandArgs], {cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
  const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /error TS\d+/.test(line))
    .map((line) => line.replace(/\\/g, '/'));
  return {lines: [...new Set(lines)].sort(), ms: Date.now() - started, status: result.status};
}

/** The client's 7.1 config: the project's own, plus the mapper for `.vue` (generated beside the toolchain). */
function clientConfig7() {
  const file = path.join(TOOLCHAIN, 'tsconfig.client.json');
  fs.writeFileSync(file, JSON.stringify({
    extends: path.relative(TOOLCHAIN, path.join(ROOT, 'tsconfig.vue-tsc.json')).split(path.sep).join('/'),
    compilerOptions: {noEmit: true, incremental: false},
    // `dataAttributes`: what vue-tsc accepts by default (a `data-*` attribute on any element) — without it the mapper
    // reports every one of them (~1 900 of the first run's 2 026).
    contentMappers: [{package: '@vue/content-mapper', extensions: ['.vue'], options: {languageFeatures: false, dataAttributes: ['data-*'], htmlAttributes: ['aria-*']}}],
  }, null, 2));
  return file;
}

const {tsc7} = toolchain();
const tsc6 = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const vueTsc = path.join(ROOT, 'node_modules', 'vue-tsc', 'bin', 'vue-tsc.js');
const extra = checkers === undefined ? [] : ['--checkers', checkers];

let newIn7 = 0;
const rows = [];
for (const name of trees) {
  const tree = TREES[name];
  const six = tree.vue ? run(vueTsc, ['--noEmit', '-p', tree.config]) : run(tsc6, ['--noEmit', '-p', tree.config]);
  const seven = tree.vue ? run(tsc7, ['--noEmit', '--runExternalCode', '-p', clientConfig7(), ...extra]) : run(tsc7, ['--noEmit', '-p', tree.config, ...extra]);
  const only7 = seven.lines.filter((line) => !six.lines.includes(line));
  const only6 = six.lines.filter((line) => !seven.lines.includes(line));
  newIn7 += only7.length;
  rows.push(`${name.padEnd(8)}  TS 6: ${String(six.lines.length).padStart(4)} errors ${(six.ms / 1000).toFixed(1).padStart(6)} s   TS 7.1: ${String(seven.lines.length).padStart(4)} errors ${(seven.ms / 1000).toFixed(1).padStart(6)} s   only in 7.1: ${only7.length}   only in 6: ${only6.length}`);
  for (const line of only7.slice(0, 40)) {
    console.log(`[ts7] ${name} · only in 7.1 · ${line}`);
  }
  if (only7.length > 40) {
    console.log(`[ts7] ${name} · … and ${only7.length - 40} more`);
  }
  for (const line of only6.slice(0, 10)) {
    console.log(`[ts7] ${name} · only in 6   · ${line}`);
  }
}
console.log('\n' + rows.join('\n'));
console.log(`\n[ts7] ${newIn7 === 0 ? 'clean: TypeScript 7.1 says nothing the project\'s TypeScript does not' : `${newIn7} diagnostic(s) only TypeScript 7.1 reports`}${checkers === undefined ? '' : ` (--checkers ${checkers})`}`);
process.exit(strict && newIn7 > 0 ? 1 : 0);
