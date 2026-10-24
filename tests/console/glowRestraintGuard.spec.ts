import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE PREMIUM-RESTRAINT LAW — the static guard (`.claude/rules/console-ui.md` § VISUAL RESTRAINT).
 *
 * The owner, 2026-10-24, on a 4K frame of the Parliament: «перебор с эффектами свечения — UI потерял премиальный
 * стиль: левая панель, верхний бар, зона парламента — везде добавлен эффект свечения». Every surface had grown its own
 * coloured halo (a `box-shadow` with no offset, a blur and a light colour) for a STANDING state — the active seat, the
 * viewer's chip, a party with access, a seated chairman, the reached career step, a convertible rail row (which also
 * BREATHED, forever). Each was added «to make the state visible»; together they turned the screen into a lit panel
 * where nothing is louder than anything else.
 *
 * The law: a standing state is drawn by MATERIAL — a crisp kant (inset hairline), a fill, weight, form, an icon —
 * never by light. A halo is legitimate only (a) on the CURSOR, through the one grammar (`.con-cursor()` — its layers
 * are scaled by `--con-cursor-on`, and this guard skips them), and (b) inside a ONE-SHOT `@keyframes` that marks an
 * event the player must not miss (a landing, a gained access) and ends on its own. This spec holds it:
 *  1. THE CLEANED SURFACES STAY CLEAN — the left rail (`.con-res*`, `.con-score`, `.con-tagmx`), the top strip
 *     (`.con-status*`) and the Parliament's stylesheets carry ZERO standing halos;
 *  2. THE RATCHET — every other console stylesheet's standing halos are DEBT, counted per file in
 *     `glowRestraintBaseline.json`: growth fails (a new glow — draw the state with a kant), and a fall fails until it
 *     is locked in (lower the number in the same diff) — an improvement cannot erode.
 */

const STYLES = path.resolve(__dirname, '..', '..', 'src', 'styles');
const BASELINE = path.resolve(__dirname, 'glowRestraintBaseline.json');

/** Stylesheets cleaned to zero (2026-10-24) — a standing halo here fails outright. */
const ZERO_FILES: ReadonlyArray<string> = [
  'console_status_material.less',
  'console_parliament.less',
  'console_parliament_chamber.less',
  'console_parliament_sitting.less',
  'console_parliament_vote.less',
  'console_party_plaque.less',
  'console_influence_yield.less',
];
/** …and the always-visible HUD blocks inside `console.less`, by the top-level selector they live under. */
const ZERO_BLOCKS = /^\.(con-res|con-score|con-status|con-tagmx)\b/;
/** A TRANSIENT OBJECT made of light — never a state: it exists for one flight and is gone. Each row says why. */
const TRANSIENT_LIGHT: ReadonlyMap<string, string> = new Map([
  ['.con-parl__flight--spark', 'the alliance impulse (TR62) — one bead of light flown partner → ally by GSAP, unmounted on arrival'],
]);

type Halo = {file: string, line: number, block: string, layer: string};

/** Comments blanked (newlines kept — the guard reports line numbers). */
function stripComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/.*$/gm, (match, lead: string) => lead + blank(match.slice(lead.length)));
}

/** Split on top-level commas (never inside parentheses). */
function splitTop(text: string): Array<string> {
  const out: Array<string> = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
    }
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** A dark colour is a drop shadow's ink, never light. */
function isDark(colour: string): boolean {
  const rgb = colour.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb !== null) {
    return Number(rgb[1]) + Number(rgb[2]) + Number(rgb[3]) < 120;
  }
  return /#000\b|\bblack\b/i.test(colour);
}

/** A HALO: an outer layer with no real offset, a blur and a light colour — and not the cursor's own layer. */
function isHalo(layer: string): boolean {
  const t = layer.trim().replace(/\s+/g, ' ');
  if (t.startsWith('inset') || t.includes('--con-cursor-on')) {
    return false;
  }
  const m = t.match(/^(-?[\d.]+(?:rem|px)?) (-?[\d.]+(?:rem|px)?) ([\d.]+(?:rem|px))(?: (-?[\d.]+(?:rem|px)))? (.+)$/);
  if (m === null || Number.parseFloat(m[3]) === 0) {
    return false;
  }
  if (Math.abs(Number.parseFloat(m[1])) > 0.05 || Math.abs(Number.parseFloat(m[2])) > 0.3) {
    return false;
  }
  return !isDark(m[5]);
}

/** Every standing halo of one stylesheet: `@keyframes` bodies are events, not states, and are skipped. */
function halosOf(file: string): Array<Halo> {
  const source = stripComments(fs.readFileSync(path.join(STYLES, file), 'utf8'));
  const out: Array<Halo> = [];
  const stack: Array<string> = [];
  let segment = '';
  let segmentStart = 0;
  let line = 1;
  const flushDecl = () => {
    const m = segment.match(/^\s*box-shadow\s*:([\s\S]*)$/);
    if (m !== null && !stack.some((h) => h.startsWith('@keyframes'))) {
      const declLine = segmentStart + (segment.match(/^\s*/)?.[0].split('\n').length ?? 1) - 1;
      for (const layer of splitTop(m[1])) {
        if (isHalo(layer)) {
          out.push({file, line: declLine, block: stack[0] ?? '', layer: layer.trim().replace(/\s+/g, ' ')});
        }
      }
    }
  };
  for (const ch of source) {
    if (ch === '{') {
      stack.push(segment.trim());
      segment = '';
      segmentStart = line;
    } else if (ch === '}') {
      flushDecl();
      stack.pop();
      segment = '';
      segmentStart = line;
    } else if (ch === ';') {
      flushDecl();
      segment = '';
      segmentStart = line;
    } else {
      segment += ch;
    }
    if (ch === '\n') {
      line++;
    }
  }
  return out;
}

function consoleSheets(): Array<string> {
  return fs.readdirSync(STYLES).filter((f) => /^console.*\.less$/.test(f)).sort();
}

describe('glowRestraintGuard — a standing state is a kant, never a glow', () => {
  it('the detector sees a halo, and only a halo', () => {
    expect(isHalo('0 0 .9rem fade(@con-mint, 26%)')).is.true;
    expect(isHalo('0 0 1.1rem color-mix(in srgb, var(--x) 45%, transparent)')).is.true;
    expect(isHalo('0 0 .8rem .2rem rgba(95, 227, 180, 0.5)')).is.true;
    expect(isHalo('inset 0 0 0 .06rem @con-amber')).is.false;
    expect(isHalo('0 .6rem 1.4rem rgba(0, 0, 0, 0.55)')).is.false;
    expect(isHalo('0 0 0 .06rem fade(@con-cyan, 70%)')).is.false;
    expect(isHalo('0 0 calc(var(--con-glow-r) * var(--con-cursor-on)) rgba(1, 2, 3, .25)')).is.false;
  });

  it('THE CLEANED SURFACES: the rail, the top strip and the Parliament carry no standing halo', () => {
    const offenders: Array<string> = [];
    for (const file of ZERO_FILES) {
      for (const h of halosOf(file).filter((x) => !TRANSIENT_LIGHT.has(x.block))) {
        offenders.push(`  ${h.file}:${h.line} ${h.block} → ${h.layer}`);
      }
    }
    for (const h of halosOf('console.less')) {
      if (ZERO_BLOCKS.test(h.block)) {
        offenders.push(`  ${h.file}:${h.line} ${h.block} → ${h.layer}`);
      }
    }
    expect(offenders, `a standing glow on a surface cleaned to zero — draw the state with a kant / fill / weight (\`console-ui.md\` § VISUAL RESTRAINT):\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('THE RATCHET: standing halos per stylesheet never grow, and a fall is locked in', () => {
    const counts: Record<string, number> = {};
    const all: Array<Halo> = [];
    for (const file of consoleSheets()) {
      const halos = halosOf(file);
      all.push(...halos);
      if (halos.length > 0) {
        counts[file] = halos.length;
      }
    }
    if (process.env.GLOW_RESTRAINT_BASELINE === 'write') {
      fs.writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + String.fromCharCode(10));
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, number>;
    const grew: Array<string> = [];
    const fell: Array<string> = [];
    for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
      const now = counts[file] ?? 0;
      const was = baseline[file] ?? 0;
      if (now > was) {
        const list = all.filter((h) => h.file === file).map((h) => `  ${h.file}:${h.line} ${h.block} → ${h.layer}`).join('\n');
        grew.push(`${file}: ${was} → ${now} — a new standing glow; draw the state with a kant / fill / weight, or make it a one-shot @keyframes event:\n${list}`);
      } else if (now < was) {
        fell.push(`${file}: ${was} → ${now}`);
      }
    }
    expect(grew, grew.join('\n')).to.deep.eq([]);
    expect(fell, `the glow debt FELL — lock it in: set these in tests/console/glowRestraintBaseline.json (or run with GLOW_RESTRAINT_BASELINE=write)\n${fell.join('\n')}`).to.deep.eq([]);
  });
});
