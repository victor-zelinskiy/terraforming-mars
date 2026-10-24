import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE DELEGATE HAS ONE SILHOUETTE (`src/client/components/playerToken/delegateGlyph.ts`).
 *
 * The card's printed mark (`assets/misc/delegate.svg` — white,
 * `assets/misc/delegate-neutral.svg` — the dark neutral print) and the piece
 * on the table (`PlayerDelegate.vue` — the standee in the player's colour or
 * steel) draw the SAME path, byte for byte: the eye recognises on the
 * resolution's ribbon what it read on the card. A redrawn figure in one of
 * them fails here.
 *
 * And the old bust PNGs are not a second path to the same concept: the files
 * are gone and nothing in the client or its styles prints them.
 */

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function sourcesUnder(rel: string): Array<string> {
  const out: Array<string> = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), {withFileTypes: true})) {
      const child = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(child);
      } else if (/\.(vue|ts|less)$/.test(entry.name)) {
        out.push(child);
      }
    }
  };
  walk(rel);
  return out;
}

const GLYPH = 'src/client/components/playerToken/delegateGlyph.ts';

function delegatePath(): string {
  const found = /export const DELEGATE_PATH = '([^']+)'/.exec(read(GLYPH))?.[1];
  expect(found, `${GLYPH} declares DELEGATE_PATH`).is.not.undefined;
  return found as string;
}

describe('the delegate — ONE silhouette on the card and on the table', () => {
  for (const file of ['assets/misc/delegate.svg', 'assets/misc/delegate-neutral.svg']) {
    it(`${file} prints DELEGATE_PATH, byte for byte`, () => {
      const paths = [...read(file).matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
      expect(paths, 'the file draws ONE path').has.lengthOf(1);
      expect(paths[0]).eq(delegatePath());
    });
  }

  it('the piece (PlayerDelegate.vue) stands the same silhouette — never a path of its own', () => {
    const component = read('src/client/components/playerToken/PlayerDelegate.vue');
    expect(component).contains('import {DELEGATE_PATH} from \'@/client/components/playerToken/delegateGlyph\'');
    // Every figure layer draws `:d="path"` (= DELEGATE_PATH); the only literal
    // path is the disc's side, which is not the silhouette.
    const literal = [...component.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
    expect(literal, 'the disc side is the only literal path').deep.eq(['M3 43.4V45.6A17 4.2 0 0 0 37 45.6V43.4Z']);
    expect((component.match(/:d="path"/g) ?? []).length, 'every figure layer draws the one silhouette').is.greaterThan(3);
  });

  it('the old bust PNGs are gone, and nothing prints them', () => {
    for (const png of ['assets/misc/delegate.png', 'assets/misc/neutral-delegate.png', 'assets/underworld/neutral-delegate.png']) {
      expect(fs.existsSync(path.join(ROOT, png)), png).is.false;
    }
    const offenders = [...sourcesUnder('src/client'), ...sourcesUnder('src/styles')]
      .filter((file) => /(?:^|[/'"(])(?:neutral-)?delegate\.png/.test(read(file)));
    expect(offenders, 'print the ONE silhouette (assets/misc/delegate.svg / delegate-neutral.svg)').deep.eq([]);
  });
});
