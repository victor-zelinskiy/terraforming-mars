import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE PIECES OF A CELL HAVE ONE READING (`common/boards/cellPieces.ts`) —
 * Turmoil Redux TR44 Aquatic Research Station put TWO tiles on one cell (an
 * ordinary city over a plain ocean), and the day it did, every «is there an
 * ocean here» that read the cell's TOP tile directly stopped agreeing with
 * `Board.isOceanSpace`: `capitalAdjacencyVp.ts` had its own
 * `OCEAN_TILES.has(s.tile.tileType)` (its header even promised «the SAME
 * set»), and that was one Capital point lost on the day the first city stood
 * on the water. Two arithmetics of one question drift — so there is one.
 *
 * WHAT THIS GUARD CHECKS, over `src/server` and `src/common` (the client reads
 * the published `under`, never `covers`):
 *   ① no module asks `OCEAN_TILES.has(<cell>.tile…)` — a CELL question goes
 *      through the pieces (`Board.isOceanSpace` / `hasPlainOcean` /
 *      `isPlainOceanTop` / `countsAsOcean`); a TILE TYPE question
 *      (`OCEAN_TILES.has(tile.tileType)` on a tile being placed) is not a cell
 *      question and is left alone;
 *   ② no module reads `tile.covers` as a piece — the ONE writer
 *      (`Game.simpleAddTile`) and the two pieces modules are the only code that
 *      touches the field, plus the Ares survey family, which reads it as «the
 *      cell's printed bonus was not paid» (upstream's own meaning, predating
 *      TR44 — allow-listed by file, and the list may only SHRINK).
 */
const ROOT = path.join(__dirname, '..', '..');
const SCANNED = [path.join('src', 'server'), path.join('src', 'common')];

/** The modules that define the reading, and the one writer. */
const PIECES_MODULES: ReadonlySet<string> = new Set([
  'src/common/boards/cellPieces.ts',
  'src/server/boards/cellPieces.ts',
  'src/server/Game.ts',
]);

/** The Ares survey family: `covers !== undefined` = «the printed bonus was not paid» — a reading older than the pieces. */
const KNOWN_COVERS_READERS: ReadonlySet<string> = new Set([
  'src/server/cards/ares/SurveyCard.ts',
  'src/server/cards/community/CuriosityII.ts',
  'src/server/cards/corporation/MiningGuild.ts',
  'src/server/cards/pathfinders/GeologicalExpedition.ts',
]);

function walk(dir: string, out: Array<string>): void {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

describe('cellPiecesGuard — one reading of what lies on a cell', () => {
  const files: Array<string> = [];
  for (const dir of SCANNED) {
    walk(path.join(ROOT, dir), files);
  }
  const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

  it('no module asks OCEAN_TILES about a CELL directly — a cell question goes through the pieces', () => {
    const offenders: Array<string> = [];
    for (const file of files) {
      const name = rel(file);
      if (PIECES_MODULES.has(name)) {
        continue;
      }
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      const pattern = /(?:BASE_)?OCEAN_TILES\.has\([^)]*\.tile\b/g;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(code)) !== null) {
        if (name === 'src/server/boards/Board.ts' && m[0].startsWith('BASE_')) {
          continue; // `isUncoveredOceanSpace`: «an ocean was PLACED here» is the top tile's own question.
        }
        offenders.push(`${name}: ${m[0]}`);
      }
    }
    expect(offenders, 'use Board.isOceanSpace / hasPlainOcean / isPlainOceanTop (cellPieces.ts)').deep.eq([]);
  });

  it('no module reads `tile.covers` as a piece outside the pieces modules and the survey family', () => {
    const offenders: Array<string> = [];
    const stillReading = new Set<string>();
    for (const file of files) {
      const name = rel(file);
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      if (!/\.covers\b/.test(code)) {
        continue;
      }
      if (PIECES_MODULES.has(name)) {
        continue;
      }
      if (KNOWN_COVERS_READERS.has(name)) {
        stillReading.add(name);
        continue;
      }
      offenders.push(name);
    }
    expect(offenders, 'read the pieces (buriedOceanOf / hasPlainOcean), never `covers`').deep.eq([]);
    const gone = [...KNOWN_COVERS_READERS].filter((name) => !stillReading.has(name));
    expect(gone, 'a known reader no longer reads `covers` — delete its row').deep.eq([]);
  });
});
