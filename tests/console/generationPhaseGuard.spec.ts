import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {Phase} from '../../src/common/Phase';
import {generationPhaseOf} from '../../src/common/game/generationPhase';

/**
 * THE GENERATION'S PHASE IS READ THROUGH ONE HELPER (P67 World Government Advisor · ledger GL).
 *
 * `GameModel.phase` is SOLAR while a card's action makes the player the World Government in the middle of the action
 * phase (`worldGovernmentAct`). A client comparison of the raw phase with `Phase.ACTION` / `Phase.SOLAR` therefore
 * reads that borrowed SOLAR as the end of the generation — the active seat's label went dark, the turn hand-off lost
 * its owner. Every such comparison goes through `generationPhaseOf` (on the same line), or stands below with the reason
 * it reads the ENGINE's flag or a save's phase instead. A static guard, written as the code is (the owner's law of
 * 2026-11-04: flakes and drifts are prevented by construction).
 */
const ROOT = path.resolve(__dirname, '../../src/client');

/** file (relative to src/client) → why its raw read is right. */
const ALLOWED: Readonly<Record<string, string>> = {
  'console/scaleStepReward/scaleStepRatingBeat.ts': 'reads the ENGINE\'s suppression flag: in SOLAR a scale step pays no rating, so the beat stays silent — true of the World Government\'s act too',
  'components/console/menu/ConsoleAdminRollback.vue': 'labels a SAVE\'s phase — no save is ever taken inside the borrowed SOLAR (WorldGovernmentAdvisor.spec § A10)',
};

function walk(dir: string, out: Array<string>): void {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
}

describe('generationPhaseGuard — the generation\'s phase through ONE helper', () => {
  it('generationPhaseOf: the World Government\'s act is the ACTION phase; otherwise the phase as it is', () => {
    expect(generationPhaseOf({phase: Phase.SOLAR, worldGovernmentAct: {player: 'red', asker: {source: 'card', card: 'World Government Advisor' as never}}})).eq(Phase.ACTION);
    expect(generationPhaseOf({phase: Phase.SOLAR})).eq(Phase.SOLAR);
    expect(generationPhaseOf({phase: Phase.ACTION})).eq(Phase.ACTION);
  });

  it('no client file compares the raw phase with Phase.ACTION / Phase.SOLAR outside the helper or a reasoned row', () => {
    const files: Array<string> = [];
    walk(ROOT, files);
    const offenders: Array<string> = [];
    const used = new Set<string>();
    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
      lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (!/Phase\.(ACTION|SOLAR)\b/.test(code) || /^\s*\*/.test(line)) {
          return;
        }
        if (code.includes('generationPhaseOf(')) {
          return;
        }
        if (ALLOWED[rel] !== undefined) {
          used.add(rel);
          return;
        }
        offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, 'read the generation\'s phase through generationPhaseOf (src/common/game/generationPhase.ts), or add a row with its reason').deep.eq([]);
    expect(Object.keys(ALLOWED).filter((k) => !used.has(k)), 'an allow-list row that no longer reads the raw phase must go').deep.eq([]);
  });
});
