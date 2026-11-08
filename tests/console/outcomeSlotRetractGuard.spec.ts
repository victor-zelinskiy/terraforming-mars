import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * A HOST RETRACTS ONLY ITS OWN OUTCOME ZONE (ledger HC — the lent-node class of game-pdb19bfa, 2026-11-07).
 *
 * The outcome slot is ONE published selector. A host whose zone switches off or unmounts and writes a BLIND
 * `setWorkspaceOutcomeSlot('')` wipes the zone ANOTHER host published meanwhile — and that host has no edge left to
 * republish on, so the claimed artifact renders nowhere. Every retract goes through `retractWorkspaceOutcomeSlot(own)`,
 * which clears the slot only while it still names the caller's selector. A blind empty write fails here with its file.
 */
const SRC = path.resolve(__dirname, '../../src/client');

function walk(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (entry.name.endsWith('.vue') || entry.name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

describe('outcome slot retract guard', () => {
  it('no blind `setWorkspaceOutcomeSlot(\'\')` — a host retracts only the zone it published', () => {
    const offenders: Array<string> = [];
    let calls = 0;
    for (const file of walk(SRC)) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
        if (/setWorkspaceOutcomeSlot\(/.test(code)) {
          calls++;
        }
        if (/setWorkspaceOutcomeSlot\(\s*(''|"")\s*\)/.test(code)) {
          offenders.push(`${path.relative(SRC, file)}:${i + 1}`);
        }
      });
    }
    expect(calls, 'anti-vacuous: the corpus publishes outcome zones').to.be.greaterThan(5);
    expect(offenders, 'use retractWorkspaceOutcomeSlot(<your selector>)').to.deep.equal([]);
  });
});
