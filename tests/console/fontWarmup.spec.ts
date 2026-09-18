import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {warmDisplayFonts} from '@/client/utils/fontWarmup';

/**
 * FONTS LOAD AT BOOT (`src/client/utils/fontWarmup.ts`). A self-hosted face is
 * fetched on first use, and its arrival re-lays out the whole document — when
 * that first use is a flight, the relayout lands in the flight (the Parliament
 * take's first card «hung in the air» on exactly that). The warm-up only works
 * while the family it names is the family `common.less` declares, so a rename
 * on either side must fail here rather than silently turn the warm-up into a
 * no-op.
 */

const ROOT = path.join(__dirname, '..', '..');

function fakeDocument(): {doc: Document, loads: Array<string>} {
  const loads: Array<string> = [];
  const doc = {
    fonts: {
      load: (font: string) => {
        loads.push(font);
        return Promise.resolve([]);
      },
    },
  } as unknown as Document;
  return {doc, loads};
}

function familyOf(font: string): string {
  const m = /"([^"]+)"|'([^']+)'|(\S+)$/.exec(font.trim());
  return m?.[1] ?? m?.[2] ?? m?.[3] ?? '';
}

describe('fontWarmup (display faces load at boot, never mid-flight)', () => {
  it('requests Russo One — the face the hand dock\'s «КАРТЫ» delta chip first paints during a take', () => {
    const {doc, loads} = fakeDocument();
    expect(warmDisplayFonts(doc)).to.be.at.least(1);
    expect(loads.map(familyOf)).to.include('Russo One');
  });

  it('every warmed family is a face common.less actually declares', () => {
    const less = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'common.less'), 'utf8');
    const declared = new Set<string>();
    for (const m of less.matchAll(/@font-face\s*\{[^}]*font-family:\s*["']?([^"';]+)["']?\s*;/g)) {
      declared.add(m[1].trim());
    }
    const {doc, loads} = fakeDocument();
    warmDisplayFonts(doc);
    for (const family of loads.map(familyOf)) {
      expect(declared, `«${family}» is warmed but no @font-face declares it`).to.include(family);
    }
  });

  it('is a no-op where the platform has no FontFaceSet', () => {
    expect(warmDisplayFonts({} as Document)).to.eq(0);
    expect(warmDisplayFonts(undefined)).to.eq(0);
  });
});
