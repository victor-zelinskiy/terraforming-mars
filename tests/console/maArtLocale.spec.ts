import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {LOCALIZED_MA_ART, maArtFileSlug, maArtPath} from '@/client/console/maArt';

/**
 * AN EMBLEM WITH WORDS HAS A FILE PER LANGUAGE — Urbanist's VP token reads «ПО» in Russian. The default
 * `<slug>.png` is the English one (every language without its own file reads it); a listed variant must
 * exist on disk, or that language's players see a broken image.
 */
describe('MA art · per-language variants', () => {
  it('every listed variant and its default exist on disk', () => {
    for (const [slug, langs] of Object.entries(LOCALIZED_MA_ART)) {
      expect(fs.existsSync(path.resolve(`assets/ma/${slug}.png`)), `${slug}.png`).is.true;
      for (const lang of langs) {
        expect(fs.existsSync(path.resolve(maArtPath(slug, lang))), `${slug}-${lang}.png`).is.true;
      }
    }
  });

  it('Russian reads its own Urbanist; every other language the default', () => {
    expect(maArtPath('urbanist', 'ru')).eq('assets/ma/urbanist-ru.png');
    expect(maArtPath('urbanist', 'en')).eq('assets/ma/urbanist.png');
    expect(maArtPath('urbanist', 'de')).eq('assets/ma/urbanist.png');
  });

  it('an emblem without words has one file for everybody', () => {
    expect(maArtFileSlug('landscaper', 'ru')).eq('landscaper');
    expect(maArtPath('t-politician', 'ru')).eq('assets/ma/t-politician.png');
  });

  // The Constructor award (Amazonis Planitia's printed set): its slug is a key of Object.prototype — a plain-table
  // lookup returned a FUNCTION and threw, emptying the whole awards rail (phase 1, 2026-11-06).
  it('a slug that names an Object.prototype key is an ordinary slug', () => {
    for (const slug of ['constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(maArtFileSlug(slug, 'ru'), slug).eq(slug);
    }
  });
});
