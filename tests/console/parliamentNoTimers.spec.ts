import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * NO WALL-CLOCK CHOREOGRAPHY IN THE PARLIAMENT (docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md
 * §13.3): a beat is a GSAP timeline under an animation hold, a stagger is a
 * parliament beat on the motion clock (`parliamentBeat.ts`), a one-shot pulse
 * ends on its own `animationend` — never `setTimeout` / `setInterval`. The
 * results scene that this rule retired paced its whole story on timers
 * (`RECAP_BEAT_MS × N`), fired into unmounted surfaces and ignored the
 * motion scale; the one timer the tree keeps is the section's SUBMIT SAFETY
 * — a net over a server that never answered, which is exactly what a wall
 * clock is for. Static, so a regression fails in seconds and names the line.
 */
const ROOT = path.join(__dirname, '..', '..');
const TREES = [
  path.join('src', 'client', 'console', 'parliament'),
  path.join('src', 'client', 'components', 'console', 'parliament'),
];
const FILES = [
  path.join('src', 'client', 'components', 'console', 'ConsoleParliamentSection.vue'),
];

/** The allowed timers, by file and by the reason written next to them. */
const ALLOWED: ReadonlyArray<{file: string, marker: string, why: string}> = [
  {
    file: path.join('src', 'client', 'components', 'console', 'ConsoleParliamentSection.vue'),
    marker: 'SUBMIT_SAFETY_MS',
    why: 'the submit safety net — a bound over a silent server, not a beat',
  },
  // (v2: the reward ledger keeps NO net of its own — a counter's hold is released by its chip's touchdown, by an
  // explicit end of the stage, or by the hold registry's ceiling with a diagnosis; never by a wall clock.)
];

function sourceFiles(): Array<string> {
  const out: Array<string> = [];
  for (const tree of TREES) {
    const dir = path.join(ROOT, tree);
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.ts') || name.endsWith('.vue')) {
        out.push(path.join(tree, name));
      }
    }
  }
  out.push(...FILES);
  return out.sort();
}

/** Strip line + block comments so the rule never fires on prose about itself. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('parliament — no wall-clock choreography (static guard)', () => {
  it('no setTimeout / setInterval outside the submit safety net', () => {
    const offenders: Array<string> = [];
    for (const rel of sourceFiles()) {
      const lines = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8')).split('\n');
      lines.forEach((line, i) => {
        if (!/\b(setTimeout|setInterval)\s*\(/.test(line)) {
          return;
        }
        const allowed = ALLOWED.some((a) => a.file === rel && line.includes(a.marker));
        if (!allowed) {
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, 'timers in the parliament tree (use parliamentBeat.ts / an animation hold / animationend):\n' + offenders.join('\n')).deep.eq([]);
  });

  it('every allow-list row still names a real line (a stale row hides a regression)', () => {
    for (const a of ALLOWED) {
      const src = stripComments(fs.readFileSync(path.join(ROOT, a.file), 'utf8'));
      const hit = src.split('\n').some((line) => /\b(setTimeout|setInterval)\s*\(/.test(line) && line.includes(a.marker));
      expect(hit, `${a.file}: the allowed timer «${a.marker}» (${a.why}) is gone — drop the row`).is.true;
    }
  });
});
