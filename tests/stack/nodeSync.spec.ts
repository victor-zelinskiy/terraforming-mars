import {expect} from 'chai';
import {spawnSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE PROJECT'S NODE IS THE NODE ELECTRON CARRIES (docs/claude/stack.md, decision S8).
 *
 * One version of Node runs everything of this project — the desktop app's main process and its embedded server
 * (Electron's own Node), the web server, the tests, the build. So every place that names a Node names THAT one, and a
 * bump of Electron without a bump of Node (or the other way round) is red here:
 *
 *   · `devDependencies.electron` — an EXACT pin, and the installed package is that version;
 *   · the Node of that Electron — `ELECTRON_NODE` below, CHECKED against the binary itself wherever it is unpacked
 *     (`ELECTRON_RUN_AS_NODE=1 electron -p process.versions.node` — the laptop, the box, CI after its unpack step);
 *   · `.nvmrc` (fnm, CI's `node-version-file`), `engines.node`, the Dockerfile's `NODE_VERSION`, `@types/node`'s major;
 *   · CI: every `actions/setup-node` reads `.nvmrc` (no literal `node-version:`), all at ONE version of the action.
 *
 * Bumping Electron: record its Node here (from its release notes or the binary), then `.nvmrc`, `engines`, the
 * Dockerfile — this spec names whatever is still behind.
 */
const ROOT = path.resolve(__dirname, '..', '..');

/** Electron → the Node it ships (releases.electronjs.org). A new Electron is a new row. */
const ELECTRON_NODE: Readonly<Record<string, string>> = {
  '45.3.2': '24.22.2',
  '45.3.3': '24.22.3',
};

const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8');
const pkg = JSON.parse(read('package.json')) as {engines: {node: string}, devDependencies: Record<string, string>};
const electronPin = pkg.devDependencies.electron;
const nodeOfElectron = ELECTRON_NODE[electronPin];

describe('stack — the project\'s Node is the Node Electron carries', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(20_000);

  it('Electron is pinned exactly, installed at that version, and its Node is recorded', () => {
    expect(electronPin, 'an exact pin, never a range').to.match(/^\d+\.\d+\.\d+$/);
    const installed = JSON.parse(read('node_modules/electron/package.json')) as {version: string};
    expect(installed.version, 'node_modules/electron is the pinned version (npm ci)').to.eq(electronPin);
    expect(nodeOfElectron, `ELECTRON_NODE has no row for Electron ${electronPin} — record the Node it carries`).to.be.a('string');
  });

  it('the recorded Node IS the Node of the unpacked binary (where one is unpacked)', function() {
    // The binary's own launch owns this budget, not the logic: on the owner's Windows laptop an EDR agent holds Electron's
    // NODE-mode start for 1–31 s, unpredictably (measured 2026-11-16 over nine launches of 45.3.2 and 45.3.3 — `--version`
    // answers in 0.1 s throughout); the 20 s of the describe went red there with nothing wrong. A launch past the
    // spawn's own bound fails by name below, never as a mocha timeout.
    // eslint-disable-next-line no-invalid-this
    this.timeout(120_000);
    const binary = path.join(ROOT, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
    if (!fs.existsSync(binary)) {
      // npm does not unpack Electron (no postinstall); CI unpacks it before the tests (`main.yml`), so this runs there.
      // eslint-disable-next-line no-invalid-this
      this.skip();
    }
    const run = spawnSync(binary, ['-p', 'process.versions.node'], {env: {...process.env, ELECTRON_RUN_AS_NODE: '1'}, encoding: 'utf8', timeout: 110_000});
    expect(run.error, `the Electron binary did not answer in 110 s: ${String(run.error)}`).to.eq(undefined);
    expect(run.status, run.stderr).to.eq(0);
    expect(run.stdout.trim(), `Electron ${electronPin} carries this Node — fix ELECTRON_NODE`).to.eq(nodeOfElectron);
  });

  it('.nvmrc, engines.node, the Dockerfile and @types/node name that Node', () => {
    expect(read('.nvmrc').trim(), '.nvmrc — exact').to.eq(nodeOfElectron);
    expect(pkg.engines.node, 'package.json engines.node — exact (Heroku installs it)').to.eq(nodeOfElectron);
    const dockerNode = /^ARG NODE_VERSION=(\S+)$/m.exec(read('Dockerfile'))?.[1] ?? '';
    expect(dockerNode.split('-')[0], 'Dockerfile NODE_VERSION').to.eq(nodeOfElectron);
    const typesMajor = /\d+/.exec(pkg.devDependencies['@types/node'] ?? '')?.[0];
    expect(typesMajor, '@types/node — the same major').to.eq(nodeOfElectron.split('.')[0]);
  });

  it('every CI workflow takes its Node from .nvmrc, through one version of actions/setup-node', () => {
    const dir = path.join(ROOT, '.github', 'workflows');
    const versions = new Set<string>();
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.yml'))) {
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(text, `${file}: a literal node-version`).to.not.match(/^\s*node-version:/m);
      for (const match of text.matchAll(/uses:\s*actions\/setup-node@(\S+)/g)) {
        versions.add(match[1]);
        const step = text.slice(match.index, match.index + 300);
        expect(step, `${file}: setup-node without node-version-file`).to.match(/node-version-file:\s*\.nvmrc/);
      }
    }
    expect([...versions], 'one version of actions/setup-node in every workflow').to.have.length(1);
  });
});
