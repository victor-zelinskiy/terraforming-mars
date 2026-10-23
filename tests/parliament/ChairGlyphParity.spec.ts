import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE CHAIRMANSHIP HAS ONE MARK — THE CHAIR (`docs/claude/parliament-glossary.md`
 * §4; T10 Public Celebrations, 2026-10-23).
 *
 * The chair is drawn by `PremiumChairGlyph.vue` (an inline path, `currentColor`)
 * wherever a component can host it, and by `assets/misc/chair.svg` wherever a
 * surface prints an icon by URL (the requirement plate's socket, the hand's
 * blocker chip, the render DSL's `b.chairman()` item, the classic Turmoil
 * token). Two files, ONE drawing: the file's path is the component's `PATH`,
 * byte for byte — a redrawn chair in one of them fails here.
 *
 * And upstream's bust (`assets/misc/chairman.png`) is not a second mark of the
 * same concept: nothing in the client or its styles prints it (the owner,
 * 2026-10-23: «заменить креслом везде»).
 */

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Every `.vue` / `.ts` / `.less` file under a directory, repo-relative. */
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

describe('the chair — the ONE mark of the chairmanship', () => {
  it('assets/misc/chair.svg draws PremiumChairGlyph\'s PATH, byte for byte', () => {
    const component = read('src/client/components/premiumCard/PremiumChairGlyph.vue');
    const componentPath = /const PATH = '([^']+)'/.exec(component)?.[1];
    expect(componentPath, 'the component declares its PATH').is.not.undefined;
    const svg = read('assets/misc/chair.svg');
    const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
    expect(paths, 'the file draws ONE path').has.lengthOf(1);
    expect(paths[0]).eq(componentPath);
  });

  it('nothing in the client or its styles prints upstream\'s bust (assets/misc/chairman.png)', () => {
    const offenders = [...sourcesUnder('src/client'), ...sourcesUnder('src/styles')]
      .filter((file) => read(file).includes('chairman.png'));
    expect(offenders, 'print THE CHAIR (PremiumChairGlyph / assets/misc/chair.svg) instead').deep.eq([]);
  });
});
