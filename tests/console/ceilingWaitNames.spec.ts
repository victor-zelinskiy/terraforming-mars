import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * NO CEILING LINE MAY SAY ONLY «DID NOT COME» (FREEZE ZERO — the night of 2026-11-22).
 *
 * Two mutual waits of twelve and fifteen seconds stood under GREEN tests of the whole suite, each ended only by a
 * ceiling whose line read «every blocking animation hold released did not come in 12000 ms» / «the console quiet did
 * not come in 15000 ms». Neither named a single thing it waited for, and both took a repeat on CI per link of the ring
 * to read (the holds; who covers the board; what the park holds; where its drain stands; which member is busy).
 * A wait that names its target by a COUNT or by a LOOK at the screen is an edge the wait graph cannot draw — the only
 * place its other end is ever written down is the wait's own node.
 *
 * So a ceiling wait says WHAT STANDS IN ITS WAY: `detail` in its spec (what it began under), `planned` (whose time its
 * bound is), or an `update(…)` of its node while it waits. The sites that say nothing are FROZEN per file and may
 * only fall; a new wait starts named. (A wait for ONE named thing — «the touchdown of this transfer» — may honestly
 * need no more: its row stays in the baseline until somebody reads its line under a test and names it.)
 */
describe('a ceiling wait names what stands in its way — the bare ones only fall', () => {
  const root = path.resolve(__dirname, '../../src/client');
  const baselineFile = path.resolve(__dirname, 'ceilingWaitNamesBaseline.json');

  function scan(): Record<string, number> {
    const out: Record<string, number> = {};
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(file);
          continue;
        }
        if (!/\.(ts|vue)$/.test(entry.name)) {
          continue;
        }
        const source = fs.readFileSync(file, 'utf8');
        let at = 0;
        let bare = 0;
        while ((at = source.indexOf('beginCeilingWait({', at)) !== -1) {
          let depth = 0;
          let end = at + 'beginCeilingWait('.length;
          for (; end < source.length; end++) {
            if (source[end] === '{') {
              depth++;
            } else if (source[end] === '}' && --depth === 0) {
              break;
            }
          }
          const spec = source.slice(at, end + 1);
          // The node's name, when the call is assigned: an `update(` of it anywhere in the file names the wait too.
          const before = source.slice(Math.max(0, at - 80), at);
          const name = (/(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*$/.exec(before) ?? /(\w+)\s*\?\?=\s*$/.exec(before) ?? /(\w+)\s*=\s*$/.exec(before))?.[1];
          const updated = name !== undefined && new RegExp('\\b' + name + '\\??\\.update\\(').test(source);
          if (!/\bdetail:/.test(spec) && !/\bplanned:/.test(spec) && !updated) {
            bare++;
          }
          at = end;
        }
        if (bare > 0) {
          out[path.relative(root, file).replace(/\\/g, '/')] = bare;
        }
      }
    };
    walk(root);
    return out;
  }

  it('the scan reads the product (a count that fell to nothing would freeze nothing)', () => {
    const waits = fs.readFileSync(path.resolve(root, 'console/waitGraph/ceilingWait.ts'), 'utf8');
    expect(waits).to.contain('export function beginCeilingWait(');
    expect(waits, 'the spec carries the words the scan looks for').to.match(/detail\?: string/).and.to.match(/planned\?: string/);
  });

  it('no file gains a bare ceiling wait, and a file that named one leaves the baseline', () => {
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8')) as Record<string, number>;
    const now = scan();
    const grown = Object.entries(now).filter(([file, count]) => count > (baseline[file] ?? 0))
      .map(([file, count]) => `${file}: ${count} (frozen at ${baseline[file] ?? 0}) — say what the wait stands on: \`detail\`, \`planned\`, or \`update(…)\` of its node`);
    expect(grown, 'a ceiling wait that names nothing').to.deep.equal([]);
    const stale = Object.entries(baseline).filter(([file, count]) => (now[file] ?? 0) < count)
      .map(([file, count]) => `${file}: ${now[file] ?? 0} now, the baseline still says ${count} — lower it (the ratchet only falls)`);
    expect(stale, 'the baseline is behind the code').to.deep.equal([]);
  });
});
