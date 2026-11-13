import {expect} from 'chai';
import {execFileSync} from 'child_process';
import * as path from 'path';

/*
 * THE SELECTOR AUDIT (docs/claude/vapor/RECIPES.md § R27 · scripts/vapor/selector-audit.mjs).
 *
 * A `v-for` row compared with an OUTER value (`:class="{hot: row.id === tip.id}"`) is lifted by the Vapor compiler
 * into a SELECTOR whose source is watched synchronously — it runs INSIDE the assignment that changes the outer value,
 * before a `v-if` around the list has had its turn. A source that dereferences what that `v-if` guards (`tip.id` under
 * `v-if="tip !== null"`) therefore throws out of the very line that closes the guard (`tip.value = null`) — in an
 * event handler, in the middle of a controller's step. The virtual DOM never did (it re-renders top-down), so the
 * defect arrives with the component's `vapor` attribute and no type error or mount-only unit spec sees it
 * (measured 2026-11-13: `EndgameScoreTab`'s hover-out threw on the flipped client with its spec green).
 *
 * The tool compiles every component as Vapor and reads each selector's source: none may be able to throw. A source
 * the rule misjudges is an ALLOWED row of the tool with its reason; a row with no selector behind it fails too.
 * The runtime fact itself is a row of tests/client/vapor/vaporCapability.spec.ts.
 */
const ROOT = path.resolve(__dirname, '..', '..');

type Selector = {file: string, source: string};

describe('the selector audit — a row compared with a guarded outer value never dereferences it', function() {
  // One compile of every component, not a timing: the budget is that pass on a busy box.
  // eslint-disable-next-line no-invalid-this
  this.timeout(180_000);

  it('no selector source of the client can throw inside an assignment', () => {
    let out: string;
    try {
      out = execFileSync(process.execPath, [path.join('scripts', 'vapor', 'selector-audit.mjs'), '--json'], {cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
    } catch (error) {
      // exit 1 = findings: the report is on stdout all the same
      out = String((error as {stdout?: string}).stdout ?? '');
    }
    const report = JSON.parse(out) as {scanned: number, findings: Array<Selector>, safe: Array<Selector>, stale: Array<string>};
    expect(report.scanned, 'the audit read the client').to.be.greaterThan(400);
    expect(report.findings.map((f) => `${f.file} — ${f.source}`),
      'make the outer side null-safe in the template (`tip?.color`) or name it in the script (a computed)').to.deep.equal([]);
    expect(report.stale, 'an allowed row of the tool with no selector behind it').to.deep.equal([]);
    expect(report.safe.length, 'the client has selectors (a compiler that stopped emitting them would empty this check)').to.be.greaterThan(5);
  });
});
