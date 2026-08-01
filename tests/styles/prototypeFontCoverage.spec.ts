import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * PROTOTYPE FONT-COVERAGE GUARD.
 *
 * Prototype is split across three TTFs (latin / ru / pl) selected by the
 * `unicode-range` descriptor on each `@font-face` in common.less. The latin
 * face claims the whole of U+000-5FF, so it OVERLAPS the Cyrillic block: any
 * Cyrillic codepoint the ru face does not explicitly claim is served by
 * Prototype.ttf instead — which has no Cyrillic glyphs at all — and the
 * browser drops that one character to the next family in the stack. On
 * `.pcard` that stack ends in 'Times New Roman', so the letter renders as a
 * serif in the middle of an otherwise-Prototype title.
 *
 * That is exactly how Ё/ё (and the Ukrainian Є І Ї Ґ) broke: all ten glyphs
 * ship inside Prototype-ru.ttf with correct outlines and metrics, they were
 * simply never declared in the range. A range NARROWER than the file it
 * points at is always a bug, so this spec asserts the declaration covers
 * every Cyrillic glyph the file actually contains — and names the missing
 * ones when it doesn't.
 */

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const COMMON_LESS = path.join(__dirname, '..', '..', 'src', 'styles', 'common.less');

// ── minimal TTF cmap reader (format 4 / 12) ────────────────────────────────
function readCodepoints(file: string): Set<number> {
  const buf = fs.readFileSync(file);
  const u16 = (o: number) => buf.readUInt16BE(o);
  const i16 = (o: number) => buf.readInt16BE(o);
  const u32 = (o: number) => buf.readUInt32BE(o);

  let cmapOffset = -1;
  for (let i = 0; i < u16(4); i++) {
    const rec = 12 + i * 16;
    if (buf.toString('ascii', rec, rec + 4) === 'cmap') {
      cmapOffset = u32(rec + 8);
    }
  }
  expect(cmapOffset, `${path.basename(file)} has no cmap table`).to.be.greaterThan(-1);

  // pick the best unicode subtable: (3,10) > (3,1) > (0,*)
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < u16(cmapOffset + 2); i++) {
    const rec = cmapOffset + 4 + i * 8;
    const platform = u16(rec);
    const encoding = u16(rec + 2);
    let score = -1;
    if (platform === 3 && encoding === 10) {
      score = 5;
    } else if (platform === 3 && encoding === 1) {
      score = 4;
    } else if (platform === 0) {
      score = 3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cmapOffset + u32(rec + 4);
    }
  }
  expect(best, `${path.basename(file)} has no unicode cmap subtable`).to.be.greaterThan(-1);

  const out = new Set<number>();
  const format = u16(best);
  if (format === 4) {
    const segX2 = u16(best + 6);
    const endO = best + 14;
    const startO = endO + segX2 + 2;
    const deltaO = startO + segX2;
    const rangeO = deltaO + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = u16(endO + s * 2);
      const start = u16(startO + s * 2);
      const delta = i16(deltaO + s * 2);
      const rangeOffset = u16(rangeO + s * 2);
      if (start === 0xFFFF) {
        continue;
      }
      for (let c = start; c <= end; c++) {
        let gid;
        if (rangeOffset === 0) {
          gid = (c + delta) & 0xFFFF;
        } else {
          gid = u16(rangeO + s * 2 + rangeOffset + (c - start) * 2);
          if (gid !== 0) {
            gid = (gid + delta) & 0xFFFF;
          }
        }
        if (gid !== 0) {
          out.add(c);
        }
      }
    }
  } else if (format === 12) {
    for (let g = 0; g < u32(best + 12); g++) {
      const o = best + 16 + g * 12;
      const startCp = u32(o);
      const endCp = u32(o + 4);
      for (let c = startCp; c <= endCp; c++) {
        out.add(c);
      }
    }
  } else {
    expect.fail(`${path.basename(file)}: unsupported cmap format ${format}`);
  }
  return out;
}

// ── `unicode-range` parsing ────────────────────────────────────────────────
function parseUnicodeRange(decl: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const raw of decl.split(',')) {
    const token = raw.trim().replace(/^[Uu]\+/, '');
    if (token === '') {
      continue;
    }
    const dash = token.split('-');
    if (dash.length === 2) {
      spans.push([parseInt(dash[0], 16), parseInt(dash[1], 16)]);
    } else if (token.includes('?')) {
      spans.push([parseInt(token.replace(/\?/g, '0'), 16), parseInt(token.replace(/\?/g, 'F'), 16)]);
    } else {
      const cp = parseInt(token, 16);
      spans.push([cp, cp]);
    }
  }
  return spans;
}

/** The `unicode-range` of the @font-face block whose `src` names `fileName`. */
function declaredRangeFor(less: string, fileName: string): Array<[number, number]> {
  const blocks = less.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  const block = blocks.find((b) => b.includes(fileName));
  expect(block, `no @font-face block references ${fileName}`).to.not.be.undefined;
  // strip comments so a codepoint mentioned in prose can't widen the range
  const clean = (block as string).replace(/\/\*[\s\S]*?\*\//g, '');
  const m = clean.match(/unicode-range:\s*([^;]+);/);
  expect(m, `${fileName}'s @font-face declares no unicode-range`).to.not.be.null;
  return parseUnicodeRange((m as RegExpMatchArray)[1]);
}

const covers = (spans: Array<[number, number]>, cp: number) =>
  spans.some(([lo, hi]) => cp >= lo && cp <= hi);

const name = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${String.fromCodePoint(cp)}`;

const CYRILLIC_LO = 0x0400;
const CYRILLIC_HI = 0x04FF;

describe('Prototype font coverage', () => {
  const less = fs.readFileSync(COMMON_LESS, 'utf8');

  it('declares every Cyrillic glyph that Prototype-ru.ttf actually contains', () => {
    const present = [...readCodepoints(path.join(ASSETS, 'Prototype-ru.ttf'))]
      .filter((cp) => cp >= CYRILLIC_LO && cp <= CYRILLIC_HI)
      .sort((a, b) => a - b);
    expect(present.length, 'Prototype-ru.ttf unexpectedly has no Cyrillic glyphs').to.be.greaterThan(60);

    const declared = declaredRangeFor(less, 'Prototype-ru.ttf');
    const undeclared = present.filter((cp) => !covers(declared, cp));

    expect(
      undeclared,
      'Prototype-ru.ttf ships these Cyrillic glyphs but common.less does not declare them, ' +
      'so each falls through to the serif fallback mid-word — widen the unicode-range:\n  ' +
      undeclared.map(name).join('  '),
    ).to.be.empty;
  });

  it('renders Ё and ё from Prototype-ru, not from a fallback face', () => {
    const ru = readCodepoints(path.join(ASSETS, 'Prototype-ru.ttf'));
    const declared = declaredRangeFor(less, 'Prototype-ru.ttf');
    for (const cp of [0x0401, 0x0451]) {
      expect(ru.has(cp), `Prototype-ru.ttf is missing ${name(cp)}`).to.be.true;
      expect(covers(declared, cp), `common.less does not declare ${name(cp)} for Prototype-ru.ttf`).to.be.true;
    }
  });

  it('keeps the Ukrainian Є І Ї Ґ pairs on the Cyrillic face', () => {
    const ru = readCodepoints(path.join(ASSETS, 'Prototype-ru.ttf'));
    const declared = declaredRangeFor(less, 'Prototype-ru.ttf');
    for (const cp of [0x0404, 0x0406, 0x0407, 0x0454, 0x0456, 0x0457, 0x0490, 0x0491]) {
      expect(ru.has(cp), `Prototype-ru.ttf is missing ${name(cp)}`).to.be.true;
      expect(covers(declared, cp), `common.less does not declare ${name(cp)} for Prototype-ru.ttf`).to.be.true;
    }
  });

  it('never lets the Latin face be the only one claiming a Cyrillic codepoint', () => {
    // The latin face's U+000-5FF overlaps the Cyrillic block. Any Cyrillic
    // codepoint it claims MUST also be claimed by the ru face (declared later,
    // so it wins the overlap) — otherwise it resolves to a glyphless file.
    const latinDeclared = declaredRangeFor(less, 'Prototype.ttf');
    const ruDeclared = declaredRangeFor(less, 'Prototype-ru.ttf');
    const latinFile = readCodepoints(path.join(ASSETS, 'Prototype.ttf'));

    const orphans: Array<number> = [];
    for (let cp = CYRILLIC_LO; cp <= CYRILLIC_HI; cp++) {
      if (covers(latinDeclared, cp) && !covers(ruDeclared, cp) && !latinFile.has(cp)) {
        orphans.push(cp);
      }
    }
    // Only flag the ones we can actually render — an undeclared codepoint with
    // no glyph anywhere would fall back regardless, which is not this bug.
    const ruFile = readCodepoints(path.join(ASSETS, 'Prototype-ru.ttf'));
    const renderable = orphans.filter((cp) => ruFile.has(cp));

    expect(
      renderable,
      'these Cyrillic codepoints are claimed by the LATIN face (which has no Cyrillic glyphs) ' +
      'while Prototype-ru.ttf can render them — they will paint in the fallback serif:\n  ' +
      renderable.map(name).join('  '),
    ).to.be.empty;
  });
});
