import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE FREEZE GATE'S BASELINE SAYS WHY (docs/claude/console/freeze-zero/PLAN.md §5 — `scripts/freeze-gate.mjs`).
 *
 * `npm run gate:freeze` walks every table in the bottle and is red on a DEFECT class the baseline does not hold. The
 * baseline is therefore the one place a freeze class could be WAVED THROUGH: a row added to make the gate green. So
 * a row is never a bare key — it carries the reason it may stand, in words («the bottle has no layout: …», «a real
 * class, open — PLAN §4 row …»), and a row without one is red here, in the unit run, before anybody trusts the gate.
 */
const FILE = path.resolve(__dirname, '..', 'client', 'bottle', 'monkeyBaseline.json');

type Row = {tier?: string, tables?: number, first?: string, why?: string};

describe('the freeze gate — its baseline', () => {
  const baseline = JSON.parse(fs.readFileSync(FILE, 'utf8')) as {seed?: string, walks?: number, classes?: Record<string, Row>};
  const rows = Object.entries(baseline.classes ?? {});

  it('is the pass of every table by one seed', () => {
    expect(baseline.seed, 'the seed the gate walks by').to.be.a('string').and.not.eq('');
    expect(baseline.walks, 'a slice (`--only`) is never a baseline').to.be.greaterThan(500);
  });

  it('every class it lets stand SAYS WHY — a row is never a bare key', () => {
    const silent = rows.filter(([, row]) => (row.why ?? '').trim().length < 24).map(([cls]) => cls);
    expect(silent, 'read the class (node scripts/monkey-report.mjs .e2e-remote/bottle-gate), then close it — or say here why the bottle names it').to.deep.eq([]);
  });

  it('every row is a DEFECT class with the table that first named it', () => {
    const odd = rows.filter(([cls, row]) => row.tier !== 'defect' || (row.first ?? '') === '' || !/^[a-z0-9-]+\/[a-z0-9-]+/.test(cls)).map(([cls]) => cls);
    expect(odd).to.deep.eq([]);
  });
});
