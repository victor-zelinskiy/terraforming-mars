import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {declaredPressUnwinds, onPressUnlanded, unwindUnlandedPress} from '@/client/console/transport/pressUnwind';

/**
 * A PRESS THAT DID NOT LAND UNWINDS WHAT WAS ARMED FOR IT (architecture v2 — PLAN §5 · L1;
 * `console/transport/pressUnwind.ts`). The unwind is DECLARED by the module that arms (beside the arm), and the
 * transport runs one ordered pass — the battery of twenty-five calls it used to keep is gone, so a scene module can no
 * longer be «not on the transport's list».
 */
describe('press unwind — what was armed for a press that did not land', () => {
  const ROOT = path.resolve(__dirname, '..', '..');

  it('declared in any order, run in ONE ordered pass; an unwind that throws is said and the pass goes on', () => {
    const ran: Array<string> = [];
    const said: Array<string> = [];
    const warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      said.push(String(args[0]));
    };
    try {
      onPressUnlanded('spec:c', () => ran.push('c'), 9_000_030);
      onPressUnlanded('spec:a', () => ran.push('a'), 9_000_010);
      onPressUnlanded('spec:boom', () => {
        throw new Error('boom');
      }, 9_000_020);
      const places = declaredPressUnwinds().map((entry) => entry.at);
      expect(places, 'the pass is sorted').to.deep.equal([...places].sort((x, y) => x - y));
      unwindUnlandedPress();
      expect(ran).to.deep.equal(['a', 'c']);
      expect(said.filter((line) => line.includes('the unwind «spec:boom» threw'))).to.have.length(1);
      // A module evaluated again: its newest declaration stands.
      onPressUnlanded('spec:a', () => ran.push('a2'), 9_000_040);
      ran.length = 0;
      unwindUnlandedPress();
      expect(ran).to.deep.equal(['c', 'a2']);
    } finally {
      console.warn = warn;
      for (const label of ['spec:a', 'spec:boom', 'spec:c']) {
        onPressUnlanded(label, () => {}, 9_000_000);
      }
    }
  });

  it('the transport keeps NO list of modules: its refusal path lowers its own holds and runs the pass', () => {
    const transport = fs.readFileSync(path.join(ROOT, 'src/client/console/transport/gameTransport.ts'), 'utf8');
    const from = transport.indexOf('function abortAllConsoleTransactions(): void {');
    const body = transport.slice(from, transport.indexOf('\n}\n', from)).split('\n').slice(1).map((line) => line.trim()).filter((line) => line !== '');
    expect(body.length, 'the body is read').to.be.greaterThan(5);
    expect(body.filter((line) => !/^transportHolds\.\w+ = false;$/.test(line)), 'a module that arms for a press declares its unwind beside the arm ' +
      '(`onPressUnlanded(label, unwind, at)`) — never a call here').to.deep.equal(['unwindUnlandedPress();']);
  });

  it('the pass is a TOTAL ORDER: no two declared unwinds share a label or a place (read off the source)', () => {
    const seen = new Map<string, string>();
    const clashes: Array<string> = [];
    let declared = 0;
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          walk(p);
        } else if (e.name.endsWith('.ts')) {
          for (const m of fs.readFileSync(p, 'utf8').matchAll(/^onPressUnlanded\('([^']+)',[^\n]*?, (\d+)\);/gm)) {
            declared++;
            for (const key of [`label «${m[1]}»`, `place ${m[2]}`]) {
              const other = seen.get(key);
              if (other !== undefined) {
                clashes.push(`${key}: ${other} and ${p}`);
              }
              seen.set(key, p);
            }
          }
        }
      }
    };
    walk(path.join(ROOT, 'src', 'client'));
    expect(declared, 'the modules declare their unwinds (anti-vacuous)').to.be.at.least(25);
    expect(clashes).to.deep.equal([]);
  });
});
