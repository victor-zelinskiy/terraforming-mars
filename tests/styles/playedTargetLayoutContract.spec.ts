import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

const LESS = path.join(__dirname, '..', '..', 'src', 'styles', 'console.less');
const MODEL = path.join(__dirname, '..', '..', 'src', 'client', 'console', 'played', 'consolePlayedTargetModel.ts');
const STEP = path.join(__dirname, '..', '..', 'src', 'client', 'components', 'console', 'played', 'ConsolePlayedTargetStep.vue');

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
   * A PHASE MAY NOT RE-ALIGN THE FRAME.
   *
   * `.con-composer--ptsel` is the marker for «the embedded target step is
   * open». It once carried `align-self: stretch; justify-content: flex-start`,
   * which flipped the decision column from the grid's centred default to
   * stretched-and-top the instant the step appeared — card, panel and header all
   * slid about 230px upward, and the descend read as one screen replacing
   * another instead of one surface advancing.
   *
   * Alignment belongs to the LAYOUT, which is the same in every phase. A phase
   * marker may change what is INSIDE the frame; the moment it changes where the
   * frame sits, the seam is visible. Sizing caps (`max-height`) are fine — they
   * bound content, they do not move it.
   */
  it('the target-step phase marker never re-aligns the frame', () => {
    const text = fs.readFileSync(LESS, 'utf8');
    const offenders: Array<string> = [];
    // Every rule whose SELECTOR mentions the phase marker.
    const rule = /(^|\n)([^\n{}]*con-composer--ptsel[^\n{}]*)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null = rule.exec(text);
    while (m !== null) {
      const [, , selector, body] = m;
      const bad = /(align-self|align-items|align-content|justify-content|justify-items)\s*:\s*([^\s;]+)/.exec(body);
      if (bad !== null) {
        offenders.push(`${selector.trim()} → ${bad[1]}: ${bad[2]}`);
      }
      m = rule.exec(text);
    }
    expect(offenders,
      'a phase that re-aligns the frame IS the jump:\n' + offenders.join('\n') +
      '\nPut the alignment on the layout (unconditional), not on the phase marker.',
    ).to.be.empty;
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

  /**
   * THE SELF-TARGET PROXY IS A CELL, NOT A CHIP.
   *
   * `.con-ptsel__cards` is a wrapping flex row bounded by the section's SOLVED
   * span — `cols × cardW + gaps` — which is only a true bound while every cell
   * is at most one card wide. The self-target proxy is the one cell whose
   * content is text rather than a card face, so it is the one cell that can
   * measure anything at all.
   *
   * It measured its CONTENT, and its content depended on STATE: the ✓ badge was
   * an in-flow child, so choosing the self-target grew the chip past a card
   * width, the row broke to a second line, and a horizontal pair of targets
   * became a vertical stack at the exact moment of selection. The direction of
   * the layout must depend on the geometry and on nothing else.
   *
   * Both halves are pinned: the box is bounded by the solved cell, and it is
   * the padding box (a `border-box` proxy with 3.5rem of padding is not
   * bounded by anything).
   */
  it('the self-target proxy is bounded by the solved cell width', () => {
    const less = fs.readFileSync(LESS, 'utf8');
    const self = blockAfter(blockAfter(less, /^\.con-ptsel\s*\{/m), /&__self\s*\{/);
    expect(self, 'the `&__self` block must exist').to.not.eq('');

    const width = /(^|[\s;{])width:\s*([^;]+);/.exec(self);
    expect(width, 'the proxy must declare a WIDTH — an intrinsic box is a state-dependent box').to.not.eq(null);
    expect(width![2],
      'the proxy\'s width must be bounded by the solver\'s own cell width ' +
      '(`--con-ptsel-slot-w`), or the candidate row wraps and the pair stacks',
    ).to.include('--con-ptsel-slot-w');
    expect(self, 'padding outside a border-box would push the proxy past that bound')
      .to.include('box-sizing: border-box');
  });

  /**
   * …and the SIZE IT IS BOUNDED BY has to actually be published. The width is
   * solved, never a CSS constant, so the seam is a custom property — and a
   * `min(var(--x), …)` whose `--x` nobody writes silently falls back to the
   * literal default, which is exactly the un-bounded chip again.
   */
  it('the solved cell width reaches the stylesheet', () => {
    const step = fs.readFileSync(STEP, 'utf8');
    expect(step, 'the step must publish `--con-ptsel-slot-w` from its solved sizing')
      .to.match(/'--con-ptsel-slot-w':/);
  });

  /**
   * …and the COMPACT CAP is the solver's number, not the stylesheet's.
   *
   * The proxy is bounded twice — by the solved cell and by a compact cap, so a
   * LONE self-target (which solves the generous `SOLO_CARD_ZOOM` ceiling) does
   * not render as a stretched card. Both bounds are published by the component;
   * the CSS fallback is what applies for the one unmeasured frame, so a stale
   * fallback is a real, if brief, wrong width. Same seam as `SECTION_RAIL_H`.
   */
  it('the proxy\'s compact cap is the same number in both places', () => {
    const less = fs.readFileSync(LESS, 'utf8');
    const self = blockAfter(blockAfter(less, /^\.con-ptsel\s*\{/m), /&__self\s*\{/);
    const fallback = /--con-ptsel-self-max,\s*([\d.]+)rem/.exec(self);
    expect(fallback, 'the proxy must bound itself with `--con-ptsel-self-max`').to.not.eq(null);

    const model = fs.readFileSync(MODEL, 'utf8');
    const js = /const PLAYED_TARGET_SELF_MAX_W = (\d+)/.exec(model);
    expect(js, 'PLAYED_TARGET_SELF_MAX_W must exist').to.not.eq(null);

    // 1rem = 20 logical px is the console scale model.
    const cssPx = Number(fallback![1]) * 20;
    expect(cssPx, `CSS fallback ${fallback![1]}rem (${cssPx}px) vs PLAYED_TARGET_SELF_MAX_W ${js![1]}`)
      .to.eq(Number(js![1]));
  });

  /**
   * A STATE MARKER MAY NEVER BE A TERM IN THE WIDTH OF THE THING IT MARKS.
   *
   * This is the same rule the card cells already obey (`&__lock` is absolute),
   * generalised: focus, selection and deselection are PAINT on this surface. A
   * marker in flow re-measures the cell, and one re-measured cell re-flows the
   * whole row.
   */
  it('the proxy\'s selection marker is out of flow', () => {
    const less = fs.readFileSync(LESS, 'utf8');
    const check = blockAfter(blockAfter(less, /^\.con-ptsel\s*\{/m), /&__self-check\s*\{/);
    expect(check, 'the `&__self-check` block must exist').to.not.eq('');
    expect(check,
      'the ✓ badge must be absolutely positioned — in flow it widens the proxy ' +
      'on selection, which is precisely the horizontal→vertical reflow bug',
    ).to.match(/position:\s*absolute/);
  });

  /**
   * …and no PROFILE may undo it. A `html.con-profile-tv .con-ptsel__self { width: … }`
   * sits in another block (or another file) and defeats the bound exactly the
   * way the `flex: 1 1 0` above defeated the span — silently, and only on the
   * profile nobody ran the spec at.
   */
  it('no profile override re-sizes the proxy off the solved cell', () => {
    const offenders: Array<string> = [];
    for (const file of fs.readdirSync(path.dirname(LESS)).filter((f) => /^console.*\.less$/.test(f))) {
      const text = fs.readFileSync(path.join(path.dirname(LESS), file), 'utf8');
      // `&__self { … }` / `.con-ptsel__self { … }` — the block ITSELF. The
      // lookahead (not `\b`) is load-bearing: `-` is a non-word character, so
      // `\b` happily matches inside `&__self-check`, and the guard then failed
      // on the very absolute badge the rule above requires.
      const rule = /(^|\n)([^\n{}]*(?:&__self|\.con-ptsel__self)(?![\w-])[^\n{}]*)\{([^{}]*)\}/g;
      let m: RegExpExecArray | null = rule.exec(text);
      while (m !== null) {
        const [, , selector, body] = m;
        const width = /(^|[\s;{])(min-width|max-width|width):\s*([^;]+);/.exec(body);
        if (width !== null && !width[3].includes('--con-ptsel-slot-w')) {
          offenders.push(`${file}: ${selector.trim()} → ${width[2]}: ${width[3].trim()}`);
        }
        m = rule.exec(text);
      }
    }
    expect(offenders,
      'an unbounded width here re-opens the selection reflow:\n' + offenders.join('\n'),
    ).to.be.empty;
  });
});
