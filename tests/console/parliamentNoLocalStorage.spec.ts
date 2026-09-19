import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * NO CLIENT MEMORY OF «ALREADY SEEN» IN THE PARLIAMENT (docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md
 * §0, §13.3): the results scene used to gate itself on a `localStorage` mark
 * (`tm_parliament_recap_seen`) — half of the political phase was game state
 * and half was the browser's memory, so two devices of one player saw two
 * different games. The sitting is a SERVER flow (the phase's step, its two
 * gates, the seat's own prompt); the client re-derives its stage from the
 * server on every mount and remembers nothing. Static, so a regression fails
 * in seconds and names the line.
 */
const ROOT = path.join(__dirname, '..', '..');
const TREES = [
  path.join('src', 'client', 'console', 'parliament'),
  path.join('src', 'client', 'components', 'console', 'parliament'),
];
const FILES = [
  path.join('src', 'client', 'components', 'console', 'ConsoleParliamentSection.vue'),
];

function sourceFiles(): Array<string> {
  const out: Array<string> = [];
  for (const tree of TREES) {
    const dir = path.join(ROOT, tree);
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.ts') || name.endsWith('.vue')) {
        out.push(path.join(tree, name));
      }
    }
  }
  out.push(...FILES);
  return out.sort();
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('parliament — no device memory (static guard)', () => {
  it('no localStorage / sessionStorage in the parliament tree', () => {
    const offenders: Array<string> = [];
    for (const rel of sourceFiles()) {
      const lines = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8')).split('\n');
      lines.forEach((line, i) => {
        if (/\b(localStorage|sessionStorage)\b/.test(line)) {
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, 'device memory in the parliament tree (the server\'s phase record is the only witness):\n' + offenders.join('\n')).deep.eq([]);
  });

  it('the retired recap memory is gone by name', () => {
    for (const rel of sourceFiles()) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(src.includes('tm_parliament_recap_seen'), `${rel} names the retired recap mark`).is.false;
      expect(src.includes('recapSeen'), `${rel} names the retired recap latch`).is.false;
    }
  });
});
