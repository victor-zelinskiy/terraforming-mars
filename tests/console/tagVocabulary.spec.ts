import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {Tag} from '../../src/common/cards/Tag';
import {tagCountKey, tagNameKey, tagsWithCountKey} from '../../src/common/cards/tagNames';

/**
 * ONE WORD PER TAG in the console's own vocabulary (PL-031 class, PL-096).
 *
 * The console names a tag in two shapes: its NAME (`tagNameKey` → «Здание»,
 * «Марс» — reasons, the reveal verdict's medallion) and the subject of a COUNT
 * (`tagCountKey` → «ваши метки Марса» — the score explorer's «VP per tag»
 * formula). Both come from ONE module; this guard reads the RU locale and
 * fails when a count stops being its name declined — «Здание» beside «метки
 * Строительства» is exactly the «two words for one concept» the ledger
 * recorded (PL-031). The card TEXTS (the corpus) are not the console's
 * vocabulary and are not read here: which word the corpus uses for Building
 * is an owner's decision.
 */
const RU_DIR = path.resolve(__dirname, '..', '..', 'src', 'locales', 'ru');

function ruDictionary(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (node: unknown) => {
    if (node === null || typeof node !== 'object') {
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (typeof value === 'string') {
        out.set(key, value);
      } else {
        walk(value);
      }
    }
  };
  for (const file of fs.readdirSync(RU_DIR).filter((f) => f.endsWith('.json'))) {
    walk(JSON.parse(fs.readFileSync(path.join(RU_DIR, file), 'utf8')));
  }
  return out;
}

/** The stem a declined form must keep: the name's first letters, its ending dropped (min 3). */
function stemOf(name: string): string {
  const lower = name.toLocaleLowerCase('ru');
  return lower.slice(0, Math.max(3, Math.min(4, lower.length - 1)));
}

function agrees(name: string, count: string): boolean {
  return count.toLocaleLowerCase('ru').includes(stemOf(name));
}

describe('tag vocabulary — one word per tag (the name and the count agree)', () => {
  const ru = ruDictionary();

  it('the agreement test bites: «Здание» vs «метки Строительства» is two words, «Марс» vs «метки Марса» is one', () => {
    expect(agrees('Здание', 'ваши метки Строительства')).is.false;
    expect(agrees('Марс', 'ваши метки Марса')).is.true;
    expect(agrees('Луна', 'ваши метки Луны')).is.true;
  });

  it('every tag a card can score by has a count noun (the generic «matching tags» is only for the meta tags)', () => {
    const scored = [Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN, Tag.VENUS,
      Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.MOON, Tag.MARS];
    expect(scored.filter((tag) => tagCountKey(tag) === undefined)).deep.eq([]);
    expect(tagCountKey(Tag.WILD)).is.undefined;
    expect(tagCountKey(Tag.EVENT)).is.undefined;
  });

  it('every count noun has a name, both are translated, and the RU count is the RU name declined', () => {
    const problems: Array<string> = [];
    for (const tag of tagsWithCountKey()) {
      const nameKey = tagNameKey(tag);
      const countKey = tagCountKey(tag)!;
      if (nameKey === undefined) {
        problems.push(`${tag}: a count noun with no name`);
        continue;
      }
      const name = ru.get(nameKey);
      const count = ru.get(countKey);
      if (name === undefined || count === undefined) {
        problems.push(`${tag}: untranslated (${name === undefined ? nameKey : countKey})`);
        continue;
      }
      if (!agrees(name, count)) {
        problems.push(`${tag}: name «${name}» vs count «${count}» — two words for one tag`);
      }
    }
    expect(problems, problems.join('\n')).deep.eq([]);
  });
});
