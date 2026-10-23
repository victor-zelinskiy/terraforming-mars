import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * T05 · CG — THE TOP STRIP'S PAINT MAY CHANGE, ITS BOXES MAY NOT (CF's law on the second always-visible edge).
 *
 * The strip is one height token (`--con-hud-h`, the architectural invariant shared with the command bar — 2.2 / TV 2.3 /
 * handheld 1.7 rem), and its anchors are flight ends and probes: a rival's payout lands on the seat intake's number,
 * a city payout on the chip, the scale swing reads a parameter cell, the deck deals from its pile. The material
 * (`console_status_material.less`) is PAINT ONLY — pinned here statically; the e2e twin (`console-status-material`)
 * measures the anchors themselves on three profiles against `tests/e2e/statusAnchorsBaseline.json`, ±1 px.
 */
const STYLES = path.resolve(__dirname, '../../src/styles');
const read = (file: string) => fs.readFileSync(path.join(STYLES, file), 'utf8');

describe('statusGeometryParity — the strip\'s boxes are a contract, its paint is free', () => {
  it('the strip is ONE height token per profile: 2.2rem · TV 2.3rem · handheld 1.7rem', () => {
    const found = ['console.less', 'console_tv.less'].flatMap((file) =>
      Array.from(read(file).matchAll(/--con-hud-h: *([^;]+);/g)).map((m) => `${file} ${m[1].trim()}`));
    expect(found).deep.eq(['console.less 2.2rem', 'console.less 1.7rem', 'console_tv.less 2.3rem']);
  });

  it('the material sheet moves no box: no padding / margin / border / gap / size / font / transform / filter outside a pseudo-element', () => {
    // Strip comments and the pseudo-element blocks (absolute decoration — their own box is theirs to draw).
    const source = read('console_status_material.less').replace(/\/\*[\s\S]*?\*\//g, '');
    const withoutPseudo = source.replace(/&::after\s*\{[^}]*\}/g, '');
    for (const banned of [
      /(^|[\s;{])padding[a-z-]*\s*:/, /(^|[\s;{])margin[a-z-]*\s*:/, /(^|[\s;{])border(-(top|right|bottom|left|width|style))?\s*:/,
      /(^|[\s;{])gap\s*:/, /(^|[\s;{])(min-|max-)?(width|height)\s*:/, /(^|[\s;{])font(-size|-family|-weight)?\s*:/,
      /(^|[\s;{])letter-spacing\s*:/, /(^|[\s;{])transform\s*:/, /(^|[\s;{])filter\s*:/, /(^|[\s;{])will-change\s*:/,
      /(^|[\s;{])display\s*:/, /(^|[\s;{])inset\s*:/,
    ]) {
      expect(withoutPseudo, `${banned} in the strip's material`).not.to.match(banned);
    }
  });

  it('the material is imported right after the strip rules it re-paints, before the TV sizes', () => {
    const common = read('common.less');
    const base = common.indexOf('@import "./console.less";');
    const material = common.indexOf('@import "./console_status_material.less";');
    const tv = common.indexOf('@import "./console_tv.less";');
    expect(base).greaterThan(-1);
    expect(material).greaterThan(base);
    expect(tv).greaterThan(material);
    expect(common.slice(base, material).split('@import').length, 'nothing between them').eq(2);
  });
});
