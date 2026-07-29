import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GLYPH LITERAL GUARD — no console-native surface may name a controller button
 * in text (CLAUDE.md cross-cutting invariant «one glyph layer»).
 *
 * `glyphSets.ts` is the ONE place a button is allowed to have a name. Everything
 * else speaks semantics ('confirm' / 'triggerL' / …) and renders through
 * `GamepadGlyph.vue`, or — where the DOM isn't ours — through the CSS bridge
 * (`glyphCssBridge.ts` → `content: var(--gp-label-<control>)`).
 *
 * A literal «LT» / «RB» / «L3» freezes that one spot to the Xbox set and lies to
 * every PlayStation / Steam player, silently: it looks right to whoever wrote it
 * and only breaks for a player with different hardware. That is exactly how the
 * virtual keyboard shipped an Xbox «Y» badge sitting 8 px above a correctly
 * rendered PlayStation «△», and how the Russian «колесе LT/RT» subtitle got in
 * where the English key was perfectly clean.
 *
 * SCOPE NOTE — this guard checks the unambiguous shoulder/trigger/stick tokens
 * plus CSS-painted face letters. Face letters in prose (A / B / X / Y) are too
 * common to grep for; keep them out by review.
 */

/** Shoulder / trigger / stick names across every set we ship or might ship. */
const BUTTON_TOKENS = /\b(LT|RT|LB|RB|L1|L2|L3|R1|R2|R3|ZL|ZR)\b/;
/** A button badge painted from CSS (`content: 'Y'`). */
const CSS_FACE_LETTER = /content:\s*['"][ABXY]['"]/;
/** The sanctioned CSS form — a line using it is compliant BY CONSTRUCTION. */
const CSS_BRIDGE = 'var(--gp-label-';

/** Trees whose user-facing text must never name a button. */
const SCANNED: ReadonlyArray<{dir: ReadonlyArray<string>, match: RegExp}> = [
  {dir: ['src', 'client', 'components', 'console'], match: /\.vue$/},
  {dir: ['src', 'client', 'components', 'gamepad'], match: /\.vue$/},
  {dir: ['src', 'client', 'console'], match: /\.ts$/},
  {dir: ['src', 'client', 'gamepad'], match: /\.ts$/},
  {dir: ['src', 'styles'], match: /^(console.*|gamepad)\.less$/},
  {dir: ['src', 'locales'], match: /^console\.json$/},
];

/**
 * The ONLY files allowed to name buttons — the glyph vocabulary itself and the
 * guard's own fixtures. Adding to this list means adding a second source of
 * truth: don't, unless you are extending the vocabulary.
 */
const ALLOWED = new Set([
  path.join('src', 'client', 'gamepad', 'glyphSets.ts'),
]);

const ROOT = path.join(__dirname, '..', '..');

function walk(dir: string, match: RegExp, out: Array<string>): void {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, match, out);
    } else if (match.test(entry.name)) {
      out.push(full);
    }
  }
}

/**
 * Blank out comments so PROSE about buttons stays legal (the console source
 * documents its own mapping heavily — ~310 such lines). Block comments and
 * HTML comments are stripped across lines; `//` only when it isn't a URL's.
 */
function stripComments(text: string, json: boolean): string {
  if (json) {
    return text;
  }
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('gamepad glyph literals', () => {
  it('no console-native surface hardcodes a controller button name', () => {
    const files: Array<string> = [];
    for (const scan of SCANNED) {
      walk(path.join(ROOT, ...scan.dir), scan.match, files);
    }
    expect(files.length, 'the scanned trees moved — fix SCANNED').to.be.greaterThan(100);

    const offenders: Array<string> = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      if (ALLOWED.has(rel)) {
        continue;
      }
      const code = stripComments(fs.readFileSync(file, 'utf8'), file.endsWith('.json'));
      code.split('\n').forEach((line, i) => {
        if (line.includes(CSS_BRIDGE)) {
          return;
        }
        if (BUTTON_TOKENS.test(line) || CSS_FACE_LETTER.test(line)) {
          offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }

    expect(
      offenders,
      'Hardcoded controller button names — render them with <GamepadGlyph control="…"/>, ' +
      'interpolate the label from activeGlyphSet(), or (CSS-painted badges only) read ' +
      'content: var(--gp-label-<control>) from the glyph CSS bridge:\n' + offenders.join('\n'),
    ).to.be.empty;
  });
});
