import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

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

/** Strip line + block comments so a rule never fires on prose about itself. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

describe('e2e driver guard', () => {
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
        const raw = fs.readFileSync(path.join(E2E_DIR, file), 'utf8');
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
    function exportedNames(): Set<string> {
      const src = fs.readFileSync(path.join(E2E_DIR, DRIVER), 'utf8');
      const out = new Set<string>();
      for (const m of src.matchAll(/^export (?:async )?function ([A-Za-z0-9_]+)/gm)) {
        out.add(m[1]);
      }
      for (const m of src.matchAll(/^export const ([A-Za-z0-9_]+)/gm)) {
        out.add(m[1]);
      }
      return out;
    }

    it('the driver still exports the primitives this guard is about', () => {
      const names = exportedNames();
      // An anti-vacuity floor: a rename that emptied the set would silently
      // turn this whole rule into a no-op.
      for (const required of ['press', 'placeTile', 'commitFocusedSpace', 'walkToSpace',
        'walkFocusUntil', 'reloadConsole', 'reloadMenu', 'pressUntil', 'focusedSpaceId',
        'openConsole']) {
        expect(names.has(required), `consoleStart.ts must export ${required}`).to.equal(true);
      }
      expect(names.size).to.be.greaterThan(40);
    });

    it('no spec declares a top-level helper with an exported primitive’s name', () => {
      const shared = exportedNames();
      const offenders: Array<string> = [];
      for (const file of specFiles()) {
        const raw = fs.readFileSync(path.join(E2E_DIR, file), 'utf8');
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
        const raw = fs.readFileSync(path.join(E2E_DIR, file), 'utf8');
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
});
