import {expect} from 'chai';
import {readdirSync, readFileSync, statSync} from 'fs';
import * as path from 'path';

/**
 * THE DOCKER BUILD SEES NO `tests/` — and the client build TYPE-CHECKS THE
 * WHOLE REPO.
 *
 * `.dockerignore` drops `tests`, while webpack's ForkTsChecker runs against
 * the root `tsconfig.json`, whose `include` is `**\/*.ts`. So any TS file
 * OUTSIDE `tests/` that imports FROM `tests/` compiles locally (the tree is
 * there) and fails the release build with TS2307 / TS2882 — a failure mode
 * no local command reproduces. It shipped once, from a perf seed script
 * parked in `scripts/` that legitimately used `tests/TestGame`; such a
 * script belongs in `tests/` (it is test infrastructure), never beside the
 * build tooling.
 *
 * This guard states the invariant directly: nothing Docker copies may import
 * the test tree.
 */
const ROOT = path.resolve(__dirname, '..');
/** Directories the Docker build context contains and TS may type-check. */
const SCANNED = ['src', 'scripts', 'electron'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.vue', '.mts', '.cts']);
/** `import … from 'tests/…'`, `require('../tests/…')`, `import '…/tests/…'`. */
const TEST_IMPORT = /(?:from|import|require\s*\()\s*['"]([^'"]*\btests\/[^'"]*)['"]/g;

function walk(dir: string, out: Array<string>): Array<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules' && entry !== 'genfiles') {
        walk(full, out);
      }
    } else if (EXTENSIONS.has(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

describe('Docker-buildable sources', () => {
  it('nothing outside tests/ imports the test tree (the release build has no tests/)', () => {
    const offenders: Array<string> = [];
    for (const dir of SCANNED) {
      const abs = path.join(ROOT, dir);
      try {
        statSync(abs);
      } catch {
        continue; // an optional tree (electron/) may be absent
      }
      for (const file of walk(abs, [])) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(TEST_IMPORT)) {
          offenders.push(`${path.relative(ROOT, file)} → ${match[1]}`);
        }
      }
    }
    expect(offenders, `these files import tests/ but ship in the Docker context:\n${offenders.join('\n')}`)
      .to.deep.equal([]);
    // This guard is I/O-bound, not logic-bound: it stats and READS every
    // .ts/.vue under src/ + scripts/ + electron/ (~2.7k files, ~2s). Mocha's
    // 2000ms default left it a coin flip - it failed ~1 run in 5 on an IDLE
    // machine and reliably under load, naming a random victim each time. The
    // budget is generous on purpose: a real regression here is a MATCH in the
    // scanned sources, never a slow walk.
  }).timeout(30_000);
});
