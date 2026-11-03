import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE HYDRONETWORK SPEAKS MATERIAL, NEVER A GLYPH (P52 · ledger FI — EG-5, layers 2–6).
 *
 * The workspace once carried its states as emoji and arrow glyphs — ✓ for «chosen», ✕ for «missing», ✱ for «wild»,
 * 🛡 for «reserved», ⚠ / ⚑ for a warning, ⌸ for the blockade, ↷ ⟳ ⤵ for «skipped / repeated / drawn», ○ for «open».
 * A glyph is a font accident (it renders as colour emoji on one platform and a tofu box on another), it reads as
 * noise at 4K, and the console's law is that a state is drawn by MATERIAL (a pip, a ring, a bar, a fill) or said in a
 * WORD. This guard reads every Hydronetwork template (comments stripped) and fails on any of those glyphs.
 *
 * `→` is NOT on the list: it is the console-wide `current → resulting` reading (the chips print it too) — a value's
 * grammar, never a state's mark.
 */
const ROOT = path.resolve(__dirname, '../../src/client/components/console');
const FILES = [
  path.join(ROOT, 'ConsoleHydroSection.vue'),
  ...fs.readdirSync(path.join(ROOT, 'hydroFlow')).filter((f) => f.endsWith('.vue')).map((f) => path.join(ROOT, 'hydroFlow', f)),
  ...fs.readdirSync(path.join(ROOT, 'hydroMarker')).filter((f) => f.endsWith('.vue')).map((f) => path.join(ROOT, 'hydroMarker', f)),
];
const STATE_GLYPHS = /[\u{1F6E1}⛔✓✔✕✖✱⚠⌸↷⟳⤵⤴⚑○✦↻]/u;

function templateOf(source: string): string {
  const start = source.indexOf('<template>');
  const end = source.lastIndexOf('</template>');
  if (start < 0 || end < 0) {
    return '';
  }
  return source.slice(start, end).replace(/<!--[\s\S]*?-->/g, '');
}

describe('the Hydronetwork speaks material, never a glyph (FI · EG-5)', () => {
  it('no state glyph in any Hydronetwork template', () => {
    const offenders: Array<string> = [];
    for (const file of FILES) {
      templateOf(fs.readFileSync(file, 'utf8')).split('\n').forEach((line) => {
        if (STATE_GLYPHS.test(line)) {
          offenders.push(`${path.basename(file)}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, `draw the state with a pip / ring / bar or say it in a word:\n  ${offenders.join('\n  ')}`).deep.eq([]);
  });

  it('reads at least the section and its sibling layers (the guard is not vacuous)', () => {
    expect(FILES.length).to.be.greaterThan(4);
    expect(templateOf(fs.readFileSync(FILES[0], 'utf8')).length).to.be.greaterThan(10000);
  });
});
