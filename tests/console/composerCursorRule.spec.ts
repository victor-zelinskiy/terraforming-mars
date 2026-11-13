import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE ONE CURSOR RULE HAS ONE WRITER (T14 «ОДИН КУРСОР ПОСЛЕ ОТВЕТА», ledger CC — `docs/claude/console/
 * composer-preselect.md`).
 *
 * Three composers had three landing rules, and «smart focus works in some cases» was exactly that: the action composer
 * jumped to its commit row by hand in four bridge callbacks (one of them stood the cursor past the last row while
 * another question still waited) and left it on the answered row after its seven sub-pickers; the party composer
 * counted its own rows. Every landing now goes through `nextCursorAfterAnswer` (`consoleCommitGate.ts`) via each host's
 * `landCursor` — so the defect class is the hand-written landing itself, and this guard refuses it: no composer assigns
 * its cursor to the commit row by hand, and each one routes its landings through the rule.
 */
const ROOT = path.resolve(__dirname, '..', '..', 'src', 'client', 'components', 'console');
/**
 * A composer is read MEMBER-NEUTRALLY: `this.focusIdx = this.ctaIndex` (the Options API form) and
 * `focusIdx.value = ctaIndex.value` (`<script setup>` — the cursor a ref, the commit row a computed) are the SAME
 * hand-written landing, so a conversion of a composer can neither turn this guard red nor leave it blind.
 */
function memberNeutral(code: string): string {
  return code.replace(/\bthis\./g, '').replace(/\.value\b/g, '');
}
const HAND_WRITTEN = /\bfocusIdx\s*=\s*ctaIndex\b/g;
/** The cursor's own write (an assignment, never a comparison) — what proves the guard reads the file's spelling. */
const CURSOR_WRITE = /\bfocusIdx\s*=(?!=)/;
const COMPOSERS = [
  {file: 'ConsolePlayCardConfirm.vue', handWritten: HAND_WRITTEN},
  {file: 'ConsoleActionComposer.vue', handWritten: HAND_WRITTEN},
] as const;

describe('the ONE cursor rule of the composers (T14 · CC)', () => {
  for (const c of COMPOSERS) {
    const source = fs.readFileSync(path.join(ROOT, c.file), 'utf8');
    // Comments may name the old shape (the history of the class); code may not.
    const code = memberNeutral(source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, ''));

    it(`${c.file}: no hand-written landing on the commit row`, () => {
      // Anti-vacuous: the composer DOES write its cursor in the spelling this guard reads — a negative check over a
      // spelling the file no longer uses would pass forever and prove nothing.
      expect(code, 'the cursor is written somewhere (the guard reads this file\'s own spelling)').to.match(CURSOR_WRITE);
      const hits = code.match(c.handWritten) ?? [];
      expect(hits, `land through \`landCursor()\` (nextCursorAfterAnswer), never by hand: ${hits.join(' · ')}`).to.deep.eq([]);
    });

    it(`${c.file}: lands through the rule and arrives on the commit through \`commitArrival\``, () => {
      expect(code, 'the ONE rule').to.match(/nextCursorAfterAnswer\(/);
      expect(code, 'the landing every answer ends with').to.match(/landCursor\(/);
      expect(code, 'the commit ARRIVES').to.match(/arriveAtCommit\(/);
      expect(code, 'a press inside the arrival window is the arrival').to.match(/commitArrivalAbsorbs\(/);
      expect(code, 'the breath is bound on the commit row').to.match(/:data-composer-armed=/);
    });
  }
});
