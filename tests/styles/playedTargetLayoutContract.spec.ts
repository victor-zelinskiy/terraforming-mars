import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

const LESS = path.join(__dirname, '..', '..', 'src', 'styles', 'console.less');
const MODEL = path.join(__dirname, '..', '..', 'src', 'client', 'console', 'played', 'consolePlayedTargetModel.ts');

/** Extract the body of the first block whose selector line matches `head`. */
function blockAfter(text: string, head: RegExp): string {
  const m = head.exec(text);
  if (m === null) {
    return '';
  }
  let depth = 0;
  let i = text.indexOf('{', m.index);
  const start = i + 1;
  for (; i < text.length; i++) {
    if (text[i] === '{') {
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i);
      }
    }
  }
  return text.slice(start);
}

/**
 * THE PLAYED-TARGET LAYOUT CONTRACT — the two numbers the CSS and the solver
 * must agree on, guarded at the source.
 *
 * The solver (`planPlayedTargetSizing`) decides a card size and hands each
 * category an inline SPAN width. Both halves have already been silently
 * defeated by the stylesheet once, and neither failure was visible to a unit
 * test on the solver — the arithmetic stayed right while the screen stayed
 * wrong. These pin the seam itself.
 */
describe('played-target layout contract (LESS ⇄ solver)', () => {
  /**
   * A flex item whose `flex-basis` is anything but `auto` IGNORES its `width`.
   * `.con-ptsel__section` used to carry `flex: 1 1 0`, so every category was
   * handed an equal share of the band and the computed span was discarded —
   * the exact equal-columns model this layout was rewritten to remove. It cost
   * a full iteration, because the solver's own tests all passed.
   */
  it('a category block never takes a flex-basis (it would override its span)', () => {
    const offenders: Array<string> = [];

    // Scan EVERY console stylesheet, not just the one the rule lives in today:
    // a profile override (`html.con-profile-tv .con-ptsel__section { … }`) sits
    // in another file and would defeat the span exactly the same way, silently.
    for (const file of fs.readdirSync(path.dirname(LESS)).filter((f) => /^console.*\.less$/.test(f))) {
      const text = fs.readFileSync(path.join(path.dirname(LESS), file), 'utf8');
      // `&__section` (nested form) or `.con-ptsel__section` (full form) — the
      // block itself, never `__sections` / `__section-title`, which `\b` excludes.
      const rule = /(^|\n)([^\n{}]*(?:&__section|\.con-ptsel__section)\b[^\n{}]*)\{([^{}]*)\}/g;
      let m: RegExpExecArray | null = rule.exec(text);
      while (m !== null) {
        const [, , selector, body] = m;
        const shorthand = /flex:\s*[\d.]+\s+[\d.]+\s+(?!auto)([^\s;]+)/.exec(body);
        const longhand = /flex-basis:\s*(?!auto)([^\s;]+)/.exec(body);
        if (shorthand !== null) {
          offenders.push(`${file}: ${selector.trim()} → flex basis ${shorthand[1]}`);
        }
        if (longhand !== null) {
          offenders.push(`${file}: ${selector.trim()} → flex-basis ${longhand[1]}`);
        }
        m = rule.exec(text);
      }
    }
    expect(offenders, 'a basis here silently discards the solved span:\n' + offenders.join('\n')).to.be.empty;
  });

  /**
   * The category rail is subtracted from the HEIGHT BUDGET the solver fits the
   * cards into. If the stylesheet's rail grows and `SECTION_RAIL_H` does not,
   * the solver over-estimates the room and the bottom row is cropped — which
   * is precisely the symptom this surface keeps being reported for.
   */
  it('the category rail height is the same number in both places', () => {
    const less = fs.readFileSync(LESS, 'utf8');
    const scope = blockAfter(less, /^\.con-ptsel\s*\{/m);
    const rail = blockAfter(scope, /&__catrail\s*\{/);
    const cssRem = /height:\s*([\d.]+)rem/.exec(rail);
    expect(cssRem, 'the rail must declare a fixed height — the budget depends on it').to.not.eq(null);

    const model = fs.readFileSync(MODEL, 'utf8');
    const js = /const SECTION_RAIL_H = (\d+)/.exec(model);
    expect(js, 'SECTION_RAIL_H must exist').to.not.eq(null);

    // 1rem = 20 logical px is the console scale model.
    const cssPx = Number(cssRem![1]) * 20;
    expect(cssPx, `CSS rail ${cssRem![1]}rem (${cssPx}px) vs SECTION_RAIL_H ${js![1]}`).to.eq(Number(js![1]));
  });
});
