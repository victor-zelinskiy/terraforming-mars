import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  absorbersStillActive, activeInputAbsorbers, beginInputDispatch, endInputDispatch, inputAbsorbSnapshot,
  lastDispatchAbsorbedBy, noteInputAbsorbed, registerInputAbsorber, resetInputAbsorbForTest,
} from '../../src/client/console/inputAbsorb';
import {inputEchoSnapshot, recordInputEcho, resetInputEchoForTest} from '../../src/client/console/inputEcho';

/**
 * THE INPUT-ABSORB LEDGER (the e2e flake architecture, CLASS 1): a deliberate swallow is a NAMED fact — the gate says so
 * at the swallow, the echo reports the press as `absorbed` by name, and the gate's live predicate tells a driver when
 * to press again.
 */
describe('inputAbsorb — the console names its deliberate swallows', () => {
  beforeEach(() => {
    resetInputAbsorbForTest();
    resetInputEchoForTest();
  });

  it('a gate claims its scope of presses only while its predicate holds', () => {
    let busy = true;
    registerInputAbsorber('stage', () => busy, {scope: 'deciding'});
    expect(activeInputAbsorbers('confirm')).to.deep.equal(['stage']);
    expect(activeInputAbsorbers('back'), 'a deciding gate never holds B').to.deep.equal([]);
    expect(activeInputAbsorbers('nav')).to.deep.equal([]);
    busy = false;
    expect(activeInputAbsorbers('confirm')).to.deep.equal([]);
  });

  it('`verbs` adds B, `all` takes the d-pad too', () => {
    registerInputAbsorber('beat', () => true, {scope: 'verbs'});
    registerInputAbsorber('curtain', () => true, {scope: 'all'});
    expect(activeInputAbsorbers('back')).to.have.members(['beat', 'curtain']);
    expect(activeInputAbsorbers('nav')).to.deep.equal(['curtain']);
  });

  it('only a GLOBAL gate is waited out before a press is sent', () => {
    registerInputAbsorber('instance', () => true);
    registerInputAbsorber('settle', () => true, {global: true});
    expect(activeInputAbsorbers('confirm', true)).to.deep.equal(['settle']);
    expect(inputAbsorbSnapshot('confirm').activeGlobal).to.deep.equal(['settle']);
    expect(inputAbsorbSnapshot('confirm').active).to.have.members(['instance', 'settle']);
  });

  it('an unregistered gate (its surface gone) is open; a throwing predicate is open', () => {
    const off = registerInputAbsorber('stage', () => true);
    registerInputAbsorber('broken', () => {
      throw new Error('torn down');
    });
    expect(absorbersStillActive(['stage', 'broken'], 'confirm')).to.deep.equal(['stage']);
    off();
    expect(absorbersStillActive(['stage'], 'confirm')).to.deep.equal([]);
    expect(inputAbsorbSnapshot().registered).to.deep.equal(['broken']);
  });

  it('a swallow noted DURING a dispatch is that dispatch\'s answer — nested dispatches share the bracket', () => {
    beginInputDispatch();
    beginInputDispatch();
    noteInputAbsorbed('reveal-busy');
    noteInputAbsorbed('reveal-busy');
    endInputDispatch();
    noteInputAbsorbed('prompt-settle');
    expect(endInputDispatch()).to.deep.equal(['reveal-busy', 'prompt-settle']);
    expect(lastDispatchAbsorbedBy()).to.deep.equal(['reveal-busy', 'prompt-settle']);
    beginInputDispatch();
    expect(endInputDispatch(), 'the next dispatch starts clean').to.deep.equal([]);
  });

  it('a swallow outside any dispatch is counted but never attached to a press', () => {
    noteInputAbsorbed('stray');
    beginInputDispatch();
    expect(endInputDispatch()).to.deep.equal([]);
    expect(inputAbsorbSnapshot().absorbed).to.equal(1);
    expect(inputAbsorbSnapshot().recent.map((r) => r.name)).to.deep.equal(['stray']);
  });

  it('the echo reports an absorbed press by name, on the PRESS edge (the release does not overwrite it)', () => {
    recordInputEcho('Enter', 'press', 'absorbed', ['task-host-arrival']);
    recordInputEcho('Enter', 'release', 'consumed');
    const echo = inputEchoSnapshot();
    expect(echo.absorbed).to.equal(1);
    expect(echo.last?.kind).to.equal('release');
    expect(echo.lastPress?.outcome).to.equal('absorbed');
    expect(echo.lastPress?.absorbedBy).to.deep.equal(['task-host-arrival']);
  });
});

/**
 * THE WIRING: every gate that NOTES a swallow also REGISTERS the predicate a driver waits on — a name noted with no
 * live predicate would make the driver re-send into a gate it cannot see open.
 */
describe('inputAbsorb — every noted gate has a live predicate', () => {
  function walk(dir: string, out: Array<string>): Array<string> {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p, out);
      } else if (/\.(ts|vue)$/.test(entry.name)) {
        out.push(p);
      }
    }
    return out;
  }
  const files = walk(path.resolve(__dirname, '../../src/client'), []);

  it('a file that notes a gate registers that gate (by the same constant)', () => {
    const problems: Array<string> = [];
    let sites = 0;
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      if (file.endsWith('inputAbsorb.ts')) {
        continue;
      }
      for (const m of text.matchAll(/noteInputAbsorbed\(([A-Z_]+)\)/g)) {
        sites++;
        if (!new RegExp(`registerInputAbsorber\\(${m[1]}\\b`).test(text)) {
          problems.push(`${path.relative(process.cwd(), file)}: notes ${m[1]} but never registers it`);
        }
      }
    }
    expect(problems).to.deep.equal([]);
    expect(sites, 'the gates are wired (a positive control — the ledger is not empty)').to.be.greaterThanOrEqual(9);
  });

  it('the known deliberate gates are on the ledger', () => {
    const all = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    for (const gate of ['prompt-settle', 'commit-arrival', 'scene-curtain', 'task-host-arrival', 'reveal-busy',
      'start-press-refusal', 'external-draw-beat']) {
      expect(all.includes(`'${gate}'`), `the gate «${gate}» is declared`).to.equal(true);
    }
  });
});
