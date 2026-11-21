import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {Baseline, BASELINE_FILE, SCAN_KEYS, ScanKey, scanText, scanTree} from './e2eFlakeScan';

/**
 * E2E DRIVER GUARD — the three ways a console e2e spec lies about the product.
 *
 * Playwright never type-checks these files and nothing else reads them, so an
 * anti-pattern here is invisible until it costs a CI run. All three rules below
 * are written from failures that actually shipped and were re-diagnosed from
 * scratch each time, because the SYMPTOM (a 45 s timeout on a selector) is
 * three screens away from the CAUSE.
 *
 * ① A BARE `page.reload()` SWALLOWS KEYS. The session-wide GPU warm-up paints
 *    the real console UNDERNEATH its veil, so the surface a spec is waiting for
 *    is fully visible while `.boot-loader` still owns the top layer — and every
 *    key pressed in that window is lost. 32 of the suite's 35 reload sites had
 *    it; `console-composite-surfaces` reported «the shared picker never opened»
 *    about a picker whose door had been pressed twice.
 *    → `reloadConsole(page)` (`consoleStart.ts`), which waits the veil out.
 *
 * ② A SPEC-LOCAL COPY OF A SHARED PRIMITIVE RE-LEARNS HALF THE LESSON. Every
 *    focus ring in this console CLAMPS, placement is a TWO-PHASE confirm, a
 *    visible toast overrides B — and each of those was learned once, in
 *    `consoleStart.ts`, then re-broken in a private copy that knew a different
 *    half (`tests.md` § «Never hand-roll a focus walk in a spec»). A local
 *    helper may not SHADOW an exported primitive's name: either use the shared
 *    one, or give the local variant a name that says how it differs.
 *
 * ③ A ONE-PRESS PLACEMENT CANNOT COMMIT. `A` on a legal cell LOCKS it; a
 *    second, separately-released press past the dwell commits, and a d-pad step
 *    UNLOCKS. Three specs spelled the commit themselves, all as one press, and
 *    all reported the CONSEQUENCE («the Hydronetwork's bonus layer never
 *    appeared», «the workspace never came back after the placement chain»).
 *    → `placeTile` / `commitFocusedSpace`.
 *
 * The guard is a WORKLIST, like every other guard in this repo: it names the
 * exact file and line, and an intentional exception is a row in the allow-list
 * with the reason it is one — never a silent widening.
 */

const E2E_DIR = path.resolve(__dirname, '..', 'e2e');
const DRIVER = 'consoleStart.ts';

/** Spec files only — the shared helpers ARE the primitives. */
function specFiles(): Array<string> {
  return fs.readdirSync(E2E_DIR)
    .filter((f) => f.endsWith('.spec.ts'))
    .sort();
}

/**
 * ONE READ PER FILE PER RUN. Every rule below walks the whole e2e tree (~500 files); read per rule, the walk is
 * seven full trees, and on a laptop loaded by neighbour builds one rule crossed mocha's 2 s default and went red
 * with nothing wrong in the tree (2026-11-05: 2 of 46 timed out in one run of five). A static check of the source
 * has no clock in its subject — its budget is the read, paid once.
 */
const E2E_SOURCES = new Map<string, string>();
function readE2e(rel: string): string {
  let text = E2E_SOURCES.get(rel);
  if (text === undefined) {
    text = fs.readFileSync(path.join(E2E_DIR, rel), 'utf8');
    E2E_SOURCES.set(rel, text);
  }
  return text;
}

/** Strip line + block comments so a rule never fires on prose about itself. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

describe('e2e driver guard', function() {
  // A tree walk, not a timing: the first rule pays the reads (the cache above), the budget is that walk on a busy box.
  // eslint-disable-next-line no-invalid-this
  this.timeout(30_000);
  describe('① every reload goes through reloadConsole', () => {
    /**
     * The ONE sanctioned exception: the driver's own implementation, which is
     * where the veil wait lives. (It is not a spec file, so it is not scanned —
     * this list exists for a spec that genuinely must reload without the
     * console, e.g. one that asserts the boot itself.)
     */
    const ALLOWED: ReadonlyArray<string> = [];

    it('no spec calls page.reload() directly', () => {
      const offenders: Array<string> = [];
      for (const file of specFiles()) {
        if (ALLOWED.includes(file)) {
          continue;
        }
        const raw = readE2e(file);
        const text = stripComments(raw);
        for (const m of text.matchAll(/\bpage\.reload\s*\(/g)) {
          offenders.push(`${file}:${lineOf(text, m.index ?? 0)}`);
        }
      }
      expect(offenders,
        'use reloadConsole(page) — or reloadMenu(page) for the main menu / campaign ' +
        `map, which share the veil but have no console root:\n  ${offenders.join('\n  ')}`)
        .to.deep.equal([]);
    });
  });

  describe('② no spec shadows a shared primitive', () => {
    /** The driver and the observation primitives (FLAKE ZERO Ф1) — a spec-local copy of any of them is the same lie. */
    const PRIMITIVE_MODULES = [DRIVER, 'settledRead.ts', 'witness.ts', 'transientRecorder.ts'];
    function exportedNames(): Set<string> {
      const out = new Set<string>();
      for (const file of PRIMITIVE_MODULES) {
        const src = readE2e(file);
        for (const m of src.matchAll(/^export (?:async )?function ([A-Za-z0-9_]+)/gm)) {
          out.add(m[1]);
        }
        for (const m of src.matchAll(/^export const ([A-Za-z0-9_]+)/gm)) {
          out.add(m[1]);
        }
      }
      return out;
    }

    it('the driver still exports the primitives this guard is about', () => {
      const names = exportedNames();
      // An anti-vacuity floor: a rename that emptied the set would silently
      // turn this whole rule into a no-op.
      for (const required of ['press', 'placeTile', 'commitFocusedSpace', 'walkToSpace',
        'walkFocusUntil', 'reloadConsole', 'reloadMenu', 'pressUntil', 'focusedSpaceId',
        'openConsole', 'settle', 'cinematicBeat', 'specSeed', 'readiness',
        'bootFixture', 'workspaceOpen', 'crumbText', 'placementState',
        'readSettled', 'armWitness', 'witnessOf', 'recordTransient', 'readTransient']) {
        expect(names.has(required), `consoleStart.ts must export ${required}`).to.equal(true);
      }
      expect(names.size).to.be.greaterThan(40);
    });

    it('no spec declares a top-level helper with an exported primitive’s name', () => {
      const shared = exportedNames();
      const offenders: Array<string> = [];
      for (const file of specFiles()) {
        const raw = readE2e(file);
        const text = stripComments(raw);
        for (const m of text.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)/gm)) {
          if (shared.has(m[1])) {
            offenders.push(`${file}:${lineOf(text, m.index ?? 0)} — function ${m[1]}`);
          }
        }
        for (const m of text.matchAll(/^const ([A-Za-z0-9_]+) = (?:async )?\(/gm)) {
          if (shared.has(m[1])) {
            offenders.push(`${file}:${lineOf(text, m.index ?? 0)} — const ${m[1]}`);
          }
        }
      }
      expect(offenders,
        'a local copy re-learns half the lesson — use the shared primitive, or ' +
        `name the local variant for how it differs:\n  ${offenders.join('\n  ')}`)
        .to.deep.equal([]);
    });
  });

  describe('④ the RATCHET — frozen flake-class counts may only fall (the target in every spec is ZERO)', () => {
    /**
     * The baseline (`tests/console/e2eRatchetBaseline.json`, written by `npm run e2e:baseline` from the ONE scan,
     * `e2eFlakeScan.ts`) freezes the per-file counts of every flake class a static read can see — FLAKE ZERO,
     * `docs/claude/e2e-flake-zero.md` § 3:
     *
     *  · `waitForTimeout(` (G) — a fixed sleep is a GUESS about state. Wait on STATE (`settle`, `pressUntil*`,
     *    `expect.poll`, a locator assertion); the honest mid-cinematic pause is `cinematicBeat(page, ms, why)`.
     *  · `requestAnimationFrame` · `setInterval(` (B) — a SAMPLER sleeps through a short transient on the starved 4K
     *    software runner. A transient is RECORDED off the product's own writes: `armWitness` (`witness.ts`) /
     *    `recordTransient` — armed before the press, asked after.
     *  · `oneShotRead` (A) — `expect(await x.count() | .isVisible() | .textContent() | …)` reads a live state once,
     *    wherever the machine had got to. → a locator assertion (`toHaveCount`, `toBeVisible`, `toHaveText`) or
     *    `expect.poll` — a poll that already holds returns at once.
     *  · `driverClock` (H) — a value from the DRIVER's `Date.now()` asserted in a FUNCTIONAL spec measures how long
     *    the driver waited (protocol round-trips, a starved worker), not the product. A duration is a TIMING spec's,
     *    on the PAGE's clock (a recorder's `t`, the product's own `data-*-at`).
     *  · `looseGeometry` (C) — a box / position read outside `readSettled` (`settledRead.ts`) or a recorder's reader
     *    is a sample of a motion in flight. → `readSettled(page, () => rect(page))`; two compared reads BOTH through it.
     *  · `goneAsDone` (E) — «the kicker left / the play sheet left» taken for «the server moved on». → the server's
     *    truth (`promptId`, `syncClient`, `wireOf`, `placementState`) beside the wait.
     *  · `msOrder` (I) — a STRICT order of two `.t` stamps (`expect(a.t…).toBeGreaterThan(b.t)`): two callbacks of one
     *    300 ms frame share a whole-millisecond `t` (the hunt 44905320939). → the record's INDEX / a witness's ids.
     *
     * GROWTH fails (new debt in an old file, any debt in a new file — a new spec starts at ZERO in every class). A
     * FALL fails too, with the friendlier message — lock the improvement in (`npm run e2e:baseline`) in the same diff.
     */
    const ADVICE: Record<ScanKey, string> = {
      waitForTimeout: 'wait on STATE (settle / pressUntil / expect.poll / a locator assertion), or name the honest ' +
        'mid-cinematic pause with cinematicBeat(page, ms, why)',
      requestAnimationFrame: 'record the transient — armWitness (witness.ts) / recordTransient, never a frame clock in a spec',
      setInterval: 'record the transient — armWitness (witness.ts) / recordTransient, armed before the press',
      oneShotRead: 'assert a live state with a locator assertion (toHaveCount / toBeVisible / toHaveText) or expect.poll',
      driverClock: 'a functional spec asserts STATE; a duration is a timing spec\'s, on the page\'s clock',
      looseGeometry: 'read geometry through readSettled (settledRead.ts) or inside a recorder\'s reader',
      goneAsDone: 'a step is done when the SERVER moved on — promptId / syncClient / wireOf beside the wait',
      msOrder: 'an order of two states of ONE record is its INDEX (samples.indexOf, a witness\'s ids), never a.t > b.t — ' +
        'two callbacks of one frame share a whole-millisecond t (tests.md law 14)',
    };

    it('no file grows past its frozen count, and every fall is locked in', () => {
      const nl = String.fromCharCode(10);
      const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline;
      const grew: Array<string> = [];
      const fell: Array<string> = [];
      const scan = scanTree();
      for (const [rel, counts] of scan) {
        for (const key of SCAN_KEYS) {
          const count = counts[key] ?? 0;
          const frozen = baseline.files[rel]?.[key] ?? 0;
          if (count > frozen) {
            grew.push(`${rel} — ${key}: ${frozen} → ${count}   (${ADVICE[key]})`);
          } else if (count < frozen) {
            fell.push(`${rel} — ${key}: ${frozen} → ${count}`);
          }
        }
      }
      const stale = Object.keys(baseline.files).filter((rel) => !scan.has(rel));
      expect(grew, 'the ratchet only turns one way:' + grew.map((g) => nl + '  ' + g).join('')).to.deep.equal([]);
      expect(fell.concat(stale.map((rel) => `${rel} — file gone`)),
        'an improvement (or a deleted file) must be LOCKED IN so it cannot erode — run `npm run e2e:baseline` and ' +
        'commit the baseline in the same diff:' + fell.map((g) => nl + '  ' + g).join('')).to.deep.equal([]);
    });

    it('the baseline file carries every class the scan counts (a key it lacks would freeze nothing)', () => {
      const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline;
      for (const key of SCAN_KEYS) {
        expect(baseline.totals[key], `totals.${key}`).to.be.a('number');
      }
    });

    it('a SPEC has no row at all — every *.spec.ts is at ZERO in every class, and the baseline cannot freeze new debt in one', () => {
      // FLAKE ZERO closed the specs (2026-11-16: 571 of 571 at zero). From here the zero is a LAW, not a frozen count:
      // `npm run e2e:baseline` would happily write a spec's new sleep into the baseline and the growth check above
      // would then call it «frozen». A spec row is refused here, whoever wrote it — the debt that may stand lives in
      // the shared helpers (⑧, each with its reason), never in a spec.
      const specRowsOf = (b: Baseline) => Object.keys(b.files).filter((rel) => rel.endsWith('.spec.ts'));
      // The negative control: a baseline that froze a spec's sleep is SEEN (a check that finds nothing proves nothing).
      expect(specRowsOf({totals: {}, files: {'console-x.spec.ts': {waitForTimeout: 1}, 'consoleStart.ts': {waitForTimeout: 2}}} as unknown as Baseline))
        .to.deep.equal(['console-x.spec.ts']);
      const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline;
      const specRows = specRowsOf(baseline);
      expect(specRows, 'a spec carries no flake debt — fix the spec (tests.md § КАК ПИСАТЬ E2E-ПРОВЕРКУ), never ' +
        'write it into the baseline: ' + specRows.join(', ')).to.deep.equal([]);
    });
  });

  describe('⑧ only a NAMED PRIMITIVE may sample or sleep — a helper that does carries its reason', () => {
    /**
     * In a spec the target is zero (④). A shared helper is where the honest exceptions LIVE — a poll's tick inside a
     * driver loop (`pollPause`), the one named cinematic pause (`cinematicBeat`), the recorder's frame tick — and each
     * such file is a row here with WHY it may. A helper that grows a sampler or a sleep with no row is a spec in
     * disguise. The witnesses still on a page-side sampler are rows too, marked as the worklist they are.
     */
    const PRIMITIVES: Readonly<Record<string, string>> = {
      'consoleStart.ts': 'the driver — exactly three: pollPause (a poll loop\'s tick, `settle`\'s own included), cinematicBeat ' +
        '(the named pause) and the TIMING class\'s fixed press settle (its contract — `timingSpecs.ts`); every other wait is on state',
      'transientRecorder.ts': 'the recorder: a frame tick beside the MutationObserver catches what only a computed style moves; ' +
        'an opt-in TIMER tick (`tickMs`) lets a TIMING witness tell a still screen from a stalled main thread',
      'settledRead.ts': 'readSettled: the gap between two reads is two frames (or 100 ms of a still page)',
      'pageAway.ts': 'awayFromConsole: the monkey\'s `hidden` perturbation HOLDS the page\'s frame queue (it is the perturbation — never a sampler, never a wait)',
      // (FLAKE ZERO, 2026-11-16: the WORKLIST is EMPTY — the campaign / trade-door / endgame / parliament-v2 helpers
      // and the beat / focus / reaction witnesses all record on the replace-proof recorder now. A new row here is a
      // PRIMITIVE with its reason, never a worklist.)
    };
    const SAMPLES_OR_SLEEPS: ReadonlyArray<ScanKey> = ['waitForTimeout', 'requestAnimationFrame', 'setInterval'];

    it('every helper that samples or sleeps is a named primitive with its reason', () => {
      const offenders: Array<string> = [];
      for (const [rel, counts] of scanTree()) {
        if (rel.endsWith('.spec.ts') || rel.endsWith('.d.ts')) {
          continue;
        }
        const n = SAMPLES_OR_SLEEPS.reduce((a, k) => a + (counts[k] ?? 0), 0);
        if (n > 0 && PRIMITIVES[rel] === undefined) {
          offenders.push(`${rel} — ${SAMPLES_OR_SLEEPS.map((k) => `${k} ${counts[k] ?? 0}`).join(' · ')}`);
        }
      }
      expect(offenders, 'a helper that samples or sleeps is a spec in disguise — wait on state, record with ' +
        'armWitness, or add the file to PRIMITIVES with the reason it may:' +
        offenders.map((o) => String.fromCharCode(10) + '  ' + o).join('')).to.deep.equal([]);
    });

    it('a PRIMITIVES row that no longer samples or sleeps is gone too (a reason with no subject proves nothing)', () => {
      const scan = scanTree();
      const idle = Object.keys(PRIMITIVES).filter((rel) => {
        const counts = scan.get(rel);
        return counts === undefined || SAMPLES_OR_SLEEPS.every((k) => (counts[k] ?? 0) === 0);
      });
      expect(idle, 'drop these rows').to.deep.equal([]);
    });
  });

  describe('⑨–⑬ the scan SEES each class (negative controls — a guard that finds nothing proves nothing)', () => {
    const scanOf = (body: string, file = 'console-guard-fixture.spec.ts') => scanText(file, body);

    it('⑨ A — a one-shot read of a live state is counted; a locator assertion and a poll are not', () => {
      expect(scanOf('expect(await page.locator(\'.x\').count()).toBe(1);').oneShotRead).to.equal(1);
      expect(scanOf('expect(await page.locator(\'.x\').isVisible(), \'why\').toBe(true);').oneShotRead).to.equal(1);
      expect(scanOf('expect(await bar.textContent()).toContain(\'A\');').oneShotRead).to.equal(1);
      expect(scanOf('await expect(page.locator(\'.x\')).toHaveCount(1);').oneShotRead).to.equal(undefined);
      expect(scanOf('await expect.poll(() => page.locator(\'.x\').count()).toBe(1);').oneShotRead).to.equal(undefined);
    });

    it('⑩ G / ⑧ B — a pause and a sampler are counted wherever they stand', () => {
      const c = scanOf('await page.waitForTimeout(500); window.setInterval(f, 16); requestAnimationFrame(g);');
      expect([c.waitForTimeout, c.setInterval, c.requestAnimationFrame]).to.deep.equal([1, 1, 1]);
    });

    it('⑪ H — the driver\'s clock asserted counts; the page\'s clock, a message and loop bookkeeping do not', () => {
      expect(scanOf('const t0 = Date.now();\nawait press(page, \'A\');\nconst ms = Date.now() - t0;\nexpect(ms).toBeLessThan(900);').driverClock)
        .to.equal(1);
      expect(scanOf('expect(Date.now() - asked, \'rises\').toBeLessThan(15_000);').driverClock).to.equal(1);
      expect(scanOf('const t0 = Date.now();\nexpect(ok, `after ${Date.now() - t0} ms`).toBe(true);').driverClock).to.equal(undefined);
      expect(scanOf('const r = await page.evaluate(() => { const t0 = Date.now(); return Date.now() - t0; });\nexpect(r).toBeLessThan(5);').driverClock)
        .to.equal(undefined);
      expect(scanOf('const deadline = Date.now() + 5000;\nwhile (Date.now() < deadline) { await settle(page); }\nexpect(done).toBe(true);').driverClock)
        .to.equal(undefined);
      // A TIMING spec measures time by definition — the class is the functional specs'.
      expect(scanText('console-tenders-storyboard.spec.ts', 'const t0 = Date.now();\nexpect(Date.now() - t0).toBeLessThan(9);').driverClock)
        .to.equal(undefined);
    });

    it('⑫ C — geometry outside a settled home counts; inside readSettled / a recorder (or a reader named there) does not', () => {
      expect(scanOf('const r = await page.evaluate(() => document.body.getBoundingClientRect().top);').looseGeometry).to.equal(1);
      expect(scanOf('const b = await loc.boundingBox();').looseGeometry).to.equal(1);
      expect(scanOf('const r = await readSettled(page, () => page.evaluate(() => el().getBoundingClientRect().top));').looseGeometry)
        .to.equal(undefined);
      expect(scanOf('const rect = (page) => page.evaluate(() => el().getBoundingClientRect().top);\n' +
        'test(\'x\', async () => { await readSettled(page, () => rect(page)); });').looseGeometry).to.equal(undefined);
      expect(scanOf('await armWitness(page, \'k\', () => q().getBoundingClientRect().left);').looseGeometry).to.equal(undefined);
    });

    it('⑬ E — «the play sheet left» as the end of a step counts unless the server is asked beside it', () => {
      expect(scanOf('await pressUntilGone(page, \'Enter\', \'.con-composer--play\');\nawait press(page, \'B\');').goneAsDone).to.equal(1);
      expect(scanOf('await pressUntilGone(page, \'Enter\', \'.con-composer--play\');\nawait syncClient(page, request, id);').goneAsDone)
        .to.equal(undefined);
      // A surface the list does not name is a different question (does the overlay close on B?) — not this class.
      expect(scanOf('await pressUntilGone(page, \'Escape\', \'.con-sys\');').goneAsDone).to.equal(undefined);
    });
  });

  describe('⑤ every spec runs on the worker-isolated test object', () => {
    /**
     * `tests/e2e/consoleTest.ts` is what gives each worker its OWN server +
     * throwaway DB (phase 3). A spec importing `test` straight from
     * '@playwright/test' would silently run against a server that is not
     * there (no webServer since phase 3) — a 60 s connect timeout that looks
     * like a product bug. Helpers may keep the bare import (they take a Page,
     * they declare no tests).
     */
    it("no spec imports from '@playwright/test' directly", () => {
      const offenders: Array<string> = [];
      for (const file of specFiles()) {
        const raw = readE2e(file);
        const text = stripComments(raw);
        for (const m of text.matchAll(/from\s+'@playwright\/test'/g)) {
          offenders.push(`${file}:${lineOf(text, m.index ?? 0)}`);
        }
      }
      expect(offenders,
        "import {test, expect, …} from './consoleTest' — the star re-export carries " +
        'every type, and `test` carries the per-worker server:' +
        offenders.map((o) => String.fromCharCode(10) + '  ' + o).join('')).to.deep.equal([]);
    });
  });

  describe('③ a board placement is committed through a primitive', () => {
    /**
     * Specs whose SUBJECT is the placement flow itself, so they legitimately
     * press the two phases by hand — each one asserts the lock/commit split.
     */
    const ALLOWED: ReadonlyArray<string> = [
      'console-board-placement.spec.ts',
      'console-placement-navigation.spec.ts',
      'console-placement-relations.spec.ts',
      'console-tile-placement.spec.ts',
      // A READ-ONLY cursor walk: it sweeps cells to assert what the DOSSIER
      // says about each one and never commits a tile at all, so there is no
      // placement for a primitive to drive.
      'console-placement-dossier.spec.ts',
    ];

    it('a spec that AIMS at a specific cell commits through a primitive', () => {
      const offenders: Array<string> = [];
      for (const file of specFiles()) {
        if (ALLOWED.includes(file)) {
          continue;
        }
        const raw = readE2e(file);
        const text = stripComments(raw);
        // THE SIGNATURE OF «I WALKED TO A CELL AND WILL NOW PRESS A» is reading
        // the board CURSOR — `.con-cell-sel`, which nothing else in the console
        // carries. Merely COUNTING `board-space--available` is a different
        // question (is the highlight painted at all?) and is deliberately not
        // caught: those specs commit nothing.
        if (!/con-cell-sel/.test(text)) {
          continue;
        }
        const commits = /placeTile\s*\(|commitFocusedSpace\s*\(|forceSwiftPlacement\s*\(/.test(text);
        if (!commits) {
          offenders.push(file);
        }
      }
      expect(offenders,
        'one Enter is a LOCK, not a commit — drive the placement through ' +
        `placeTile / commitFocusedSpace (or opt into forceSwiftPlacement):\n  ${offenders.join('\n  ')}`)
        .to.deep.equal([]);
    });
  });

  describe('⑥ a sitting\'s confirmation is answered through closeSitting', () => {
    /**
     * THE HAND-ROLLED ANSWER re-presses A whenever the server has not answered within its settle, and the SECOND A
     * lands on whatever the first one opened (a loaded 4K runner: the distribution layout the sitting teleports in,
     * then found «not empty» — console-parliament-gallery § DISTRIBUTION). `closeSitting` (parliamentDrive.ts) waits
     * for the seat's confirmation to STAND and re-presses only while it provably still stands 10 s later. The soft
     * gates retired the two barrier gates (2026-10-24) and the migration took every hand-rolled site with them: the
     * frozen list is EMPTY and may stay so — a new spec gets 0.
     */
    const FROZEN: Readonly<Record<string, number>> = {};
    const HAND_ROLLED = /pressUntil\(\s*page,\s*'Enter',[^;]*?parliamentPhasePrompt\s*===\s*undefined/gs;

    it('no spec grows a hand-rolled gate answer, and every migration is locked in', () => {
      const grown: Array<string> = [];
      const fell: Array<string> = [];
      for (const file of specFiles()) {
        const count = (stripComments(readE2e(file)).match(HAND_ROLLED) ?? []).length;
        const frozen = FROZEN[file] ?? 0;
        if (count > frozen) {
          grown.push(`${file}: ${frozen} → ${count}`);
        } else if (count < frozen) {
          fell.push(`${file}: ${frozen} → ${count}`);
        }
      }
      for (const file of Object.keys(FROZEN)) {
        if (!specFiles().includes(file)) {
          fell.push(`${file}: deleted`);
        }
      }
      expect(grown, 'answer a sitting\'s confirmation with closeSitting (parliamentDrive.ts), never a hand-rolled ' +
        `pressUntil(Enter) — its retry lands a second A on what the first one opened:\n  ${grown.join('\n  ')}`).to.deep.equal([]);
      expect(fell, `a migrated site must be LOCKED IN — lower its FROZEN count in this guard:\n  ${fell.join('\n  ')}`).to.deep.equal([]);
    });
  });

  describe('⑦ a live chrome string is asserted by POLLING, never by one read', () => {
    /**
     * A ONE-SHOT READ OF A LIVE STRING IS A RACE. The command bar, the crumb and the bar's hot verb are republished a
     * frame (or, on a starved 4K SwiftShader runner, several) AFTER the press that changes them, so
     * `expect(await bar(page)).toMatch(…)` right after a key reads whatever stood a moment earlier — CI 2026-11-01,
     * `console-played-table` B: «LB/RB «Листать» inside the album» received «АвтоматическиеBНазад», the album already
     * open; green on the retry. 57 such sites stood in 28 specs. → `await expect.poll(() => bar(page), {message,
     * timeout}).toMatch(…)` — a poll that already holds returns at once, so it costs nothing when the bar is ready.
     *
     * The READERS are named and DERIVED: the shared ones (`crumbText` — consoleStart.ts, `hotVerb` — parliamentDrive.ts)
     * plus every helper a spec declares whose body reads the bar or the crumb (`.con-cmdbar`, `.con-wshead`, a crumb).
     */
    const SHARED_READERS = ['crumbText', 'hotVerb'];
    const LIVE_CHROME = /con-cmdbar|con-wshead/;
    /** A reader assertion that deliberately snapshots ONE frame (an ORDER claim), with its reason. */
    const ALLOWED: ReadonlyArray<string> = [
      // «A stands in the SAME place on the step» compares the hot verb's BOX against the one read before the press —
      // a no-shift claim about the settled step, read after `settle` and after the step's own surface is asserted.
      'console-parliament-payout-details.spec.ts:86',
    ];

    function readersOf(text: string): Array<string> {
      // TOP-LEVEL declarations only (column 0): a nested `const x = (…)` inside a test body is not a reader.
      const decls = [...text.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\()/g)];
      const names = new Set(SHARED_READERS);
      decls.forEach((m, i) => {
        const name = m[1] ?? m[2];
        const end = Math.min(i + 1 < decls.length ? (decls[i + 1].index ?? text.length) : text.length, (m.index ?? 0) + 600);
        if (name !== undefined && LIVE_CHROME.test(text.slice(m.index ?? 0, end))) {
          names.add(name);
        }
      });
      return [...names];
    }

    it('the reader derivation still SEES the spec-local readers (a guard that finds none proves nothing)', () => {
      const readers = (file: string) => readersOf(stripComments(readE2e(file)));
      expect(readers('console-played-table.spec.ts')).to.include.members(['bar', 'crumb']);
      expect(readers('console-ma-workspace.spec.ts')).to.include('barText');
      expect(readers('console-strategic-shift.spec.ts')).to.include('bar');
    });

    it('no spec asserts the bar / the crumb / the hot verb with a one-shot read', () => {
      const offenders: Array<string> = [];
      for (const file of specFiles()) {
        const text = stripComments(readE2e(file));
        for (const name of readersOf(text)) {
          for (const m of text.matchAll(new RegExp(`expect\\(\\s*await\\s+${name}\\(`, 'g'))) {
            const site = `${file}:${lineOf(text, m.index ?? 0)}`;
            if (!ALLOWED.includes(site)) {
              offenders.push(`${site} (${name})`);
            }
          }
        }
      }
      expect(offenders, 'a live string is republished frames AFTER the press — assert it with ' +
        '`await expect.poll(() => reader(page), {message, timeout}).toMatch(…)`, never `expect(await reader(page))`:' +
        offenders.map((o) => String.fromCharCode(10) + '  ' + o).join('')).to.deep.equal([]);
    });
  });
});
