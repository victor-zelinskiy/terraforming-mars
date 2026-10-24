import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * INFLUENCE HAS ITS OWN MARK (the owner, 2026-10-24): a violet star seal with the gold RINGS OF REACH
 * (`assets/misc/influence.svg`) — never the old black star with a DELEGATE inside it, which read as one more
 * delegate. The bust PNG is gone and nothing prints it; the seal draws no delegate silhouette.
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

describe('influence — its own mark, never a delegate', () => {
  it('the PNG is gone and nothing in the client or its styles prints it', () => {
    expect(fs.existsSync(path.join(ROOT, 'assets/misc/influence.png'))).is.false;
    const offenders = [...sourcesUnder('src/client'), ...sourcesUnder('src/styles')].filter((f) => read(f).includes('influence.png'));
    expect(offenders, 'print assets/misc/influence.svg').deep.eq([]);
  });

  it('the seal draws no delegate silhouette', () => {
    const svg = read('assets/misc/influence.svg');
    const delegatePath = /export const DELEGATE_PATH = '([^']+)'/.exec(read('src/client/components/playerToken/delegateGlyph.ts'))?.[1];
    expect(delegatePath).is.not.undefined;
    expect(svg.includes(delegatePath as string)).is.false;
    expect(svg).contains('influence-seal');
  });
});
