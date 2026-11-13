import {expect} from 'chai';
import {execFileSync} from 'child_process';
import * as path from 'path';

/*
 * THE CONVERSION AUDIT (docs/claude/vapor/RECIPES.md § R25 · § R12) — what a mechanical Options → `<script setup>`
 * conversion gets SILENTLY wrong, read off every converted component by `scripts/vapor/audit.mjs`:
 *
 *  A. HIDDEN MODULE STATE — a top-level table of a `<script setup>` script that the script writes through. Every
 *     top-level statement there is INSTANCE code: a baseline that was one for the whole client at module level of the
 *     Options form is one per mount now (V3 wave 4: `accentBaseline` of the scale marker, three scene contexts — each
 *     converted without a refusal, because the tools knew only an EMPTY literal as state). It lives in a sibling `.ts`;
 *     a table that is per instance on purpose is an ALLOWED row of the tool, with its reason.
 *  B. A DEFERRED ELEMENT CAST — `(root.value as HTMLElement)` inside a callback that can run after the unmount (a
 *     `nextTick`, a promise, an observer, code after an `await`). `this.$el` was the detached element there; the ref
 *     is `null` and the cast throws (measured: two `TypeError`s per leave of a carry-over picker).
 *
 * Neither fails a type check, a lint or a single mount — this guard is what does.
 */
const ROOT = path.resolve(__dirname, '..', '..');

type Table = {file: string, line: number, name: string, writes: Array<number>, stale?: boolean};
type Cast = {file: string, line: number, code: string, inside: string};

function audit(): {scanned: number, tables: Array<Table>, casts: Array<Cast>} {
  let out: string;
  try {
    out = execFileSync(process.execPath, [path.join('scripts', 'vapor', 'audit.mjs'), '--json'], {cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  } catch (error) {
    // exit 1 = findings: the report is on stdout all the same
    out = String((error as {stdout?: unknown}).stdout ?? '');
  }
  return JSON.parse(out);
}

describe('the conversion audit — what <script setup> changes silently', function() {
  // A parse of every component's script: a tree read, not logic (`.claude/rules/tests.md` § ⑤).
  // eslint-disable-next-line no-invalid-this
  this.timeout(120_000);

  let report: ReturnType<typeof audit>;
  before(() => {
    report = audit();
  });

  it('reads the converted components (anti-vacuous)', () => {
    expect(report.scanned, 'the <script setup> components are found').to.be.greaterThan(400);
  });

  it('A — no top-level table of a <script setup> script is written through (module state lives in a sibling .ts)', () => {
    expect(report.tables.map((t) => (t.stale === true ? `${t.file} «${t.name}» — an allowed row no longer needed` : `${t.file}:${t.line} «${t.name}» written at ${t.writes.join(', ')}`)),
      'move the table to a sibling .ts (R25), or — when it is per instance on purpose — allow it in scripts/vapor/audit.mjs with its reason').to.deep.equal([]);
  });

  it('B — no template ref is cast to an element inside a callback that runs later (R12: the null-safe read, or the guard)', () => {
    expect(report.casts.map((c) => `${c.file}:${c.line} ${c.code} — inside ${c.inside}`),
      'write `root.value?.querySelector(…) ?? null`, or `const rootNow = root.value; if (rootNow === null) return;`').to.deep.equal([]);
  });
});
