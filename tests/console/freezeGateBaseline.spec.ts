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
  const baseline = JSON.parse(fs.readFileSync(FILE, 'utf8')) as {seeds?: Array<string>, walks?: number, classes?: Record<string, Row>};
  const rows = Object.entries(baseline.classes ?? {});

  it('is the union of whole passes — every table, by each of its seeds', () => {
    expect(baseline.seeds, 'the seeds the gate has walked by').to.be.an('array').and.not.empty;
    expect(baseline.seeds, 'the first seed is the gate\'s default').to.include('fz0');
    expect(baseline.walks, 'a slice (`--only`) is never a baseline').to.be.greaterThan(500);
    // Every row names the seed that first found it — one of the seeds the baseline says it walked.
    const strangers = rows.filter(([, row]) => !(baseline.seeds ?? []).some((seed) => (row.first ?? '').startsWith(`${seed}:`))).map(([cls]) => cls);
    expect(strangers).to.deep.eq([]);
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
