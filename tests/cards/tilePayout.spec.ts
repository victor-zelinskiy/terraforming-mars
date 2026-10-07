import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * «A TILE PAYS A CARD» HAS ONE WRITER (`cards/tilePayout.ts` — TR21 Arboretum,
 * TR30 Red Museum). The scene plays the record, so a second writer is a second
 * meaning of «what this tile paid»: one that skips the measured answer of the
 * table, or the `before`, or the cause. Only the ring's own definition
 * (`Game.publishCardAdjacencyPayout`, its interface line) and the one writer
 * may name it.
 */
const ROOT = path.resolve(__dirname, '../../src/server');
const ALLOWED = new Set(['Game.ts', 'IGame.ts', path.join('cards', 'tilePayout.ts')]);

function* tsFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* tsFiles(full);
    } else if (entry.name.endsWith('.ts')) {
      yield full;
    }
  }
}

describe('tilePayout — the one writer of the «tile pays a card» record', () => {
  it('nothing but `cards/tilePayout.ts` publishes a payout', () => {
    const offenders: Array<string> = [];
    let writers = 0;
    for (const file of tsFiles(ROOT)) {
      const rel = path.relative(ROOT, file);
      if (!fs.readFileSync(file, 'utf8').includes('publishCardAdjacencyPayout(')) {
        continue;
      }
      if (ALLOWED.has(rel)) {
        writers++;
      } else {
        offenders.push(rel);
      }
    }
    expect(offenders, 'publish through `payTileToCard` (cards/tilePayout.ts) — the one writer').deep.eq([]);
    expect(writers, 'the definition, its interface line and the one writer were found (the scan is not vacuous)').eq(3);
  });
});
