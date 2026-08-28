import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {gameStateVersion} from '@/client/console/gameStateVersion';

/**
 * SERVER-DERIVED CACHE GUARD — a console surface that keeps a server's answer
 * must key it by the game-state version.
 *
 * THE BUG CLASS. A value the SERVER computed (an action preview, a play
 * preview, a usage aggregate) is a verdict about the server's whole live state.
 * The client cannot enumerate that state's relevant parts, and every attempt
 * has rotted the same way: the cache key lists the inputs whoever wrote it
 * thought of, a card reads something else, and the entry then SURVIVES a change
 * to its own input. Shipped twice —
 *
 *   - «Фактотум»: branch 1 is available iff `player.energy === 0`. The player
 *     spent their energy and came back a turn later; no term of the hand-rolled
 *     fingerprint had moved, so the same cached preview was served and the
 *     activation stayed refused for the rest of the game.
 *   - «Штормовой барьер»: the preview carries a whole Hydronetwork route, and
 *     an ordinary advance moved no term either — the card's door opened on a
 *     spent route. Patched at the time by bolting on one more term, which is
 *     the symptom, not the fix.
 *
 * THE RULE. `gameStateVersion(view)` (`src/client/console/gameStateVersion.ts`)
 * = viewer + `gameAge` + `undoCount` — the server's own change counters, the
 * same pair `/api/waitingFor` polls on and `routes/overlayStatsCache.ts`
 * invalidates on. The state cannot move without moving one of them, so a
 * version-keyed cache is complete by construction. Structural terms may be
 * ADDED on top; they may never be used instead.
 *
 * WHAT THIS GUARD CHECKS. Every console file that talks to the server names the
 * version — or is listed below as not holding a verdict at all. A new fetch
 * site therefore cannot be added without deciding which it is.
 */

const ROOT = path.join(__dirname, '..', '..');

/** Trees where every server round-trip must answer the question. */
const SCANNED: ReadonlyArray<ReadonlyArray<string>> = [
  ['src', 'client', 'console'],
  ['src', 'client', 'components', 'console'],
];

/**
 * The sanctioned ways to be version-keyed: name the stamp, or go through a
 * cache that already does (the hand-play prewarm store).
 */
const VERSIONED = [
  'gameStateVersion',
  'handPlayVersionOf',
  'takeHandPlayPreview',
  'storeHandPlayPreview',
];

/**
 * Files that fetch but hold NO server verdict. Each entry states why — adding
 * one is a claim that nothing here is cached across a state change, not a way
 * to silence the guard.
 */
const NOT_A_CACHE = new Map<string, string>([
  [path.join('src', 'client', 'console', 'transport', 'gameTransport.ts'),
    'the transport FETCHES the state; it caches no verdict derived from it'],
  [path.join('src', 'client', 'components', 'console', 'menu', 'adminRollbackState.ts'),
    'admin save history — about the game RECORD, not about what the viewer may do'],
  [path.join('src', 'client', 'components', 'console', 'menu', 'ConsoleMainMenu.vue'),
    'a one-shot delete POST outside any game view'],
]);

function walk(dir: string, out: Array<string>): void {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      out.push(full);
    }
  }
}

describe('server-derived caches are keyed by the game-state version', () => {
  const offenders: Array<string> = [];
  const covered: Array<string> = [];

  before(() => {
    for (const dir of SCANNED) {
      const abs = path.join(ROOT, ...dir);
      const files: Array<string> = [];
      walk(abs, files);
      for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        if (!source.includes('fetch(')) {
          continue;
        }
        const rel = path.relative(ROOT, file);
        if (NOT_A_CACHE.has(rel)) {
          continue;
        }
        if (VERSIONED.some((marker) => source.includes(marker))) {
          covered.push(rel);
        } else {
          offenders.push(rel);
        }
      }
    }
  });

  it('every console fetch site is version-keyed or declared cache-free', () => {
    expect(
      offenders,
      'These console files fetch from the server but never name `gameStateVersion`. ' +
      'Either key what they keep by it, or add them to NOT_A_CACHE with the reason ' +
      'nothing survives a state change there.',
    ).deep.eq([]);
  });

  it('the guard is not vacuous — it sees the known versioned caches', () => {
    // If the scan stops finding files (a tree moves, a glob breaks), the first
    // spec passes for the wrong reason. These two ARE the bug class's home.
    expect(covered).to.include(path.join('src', 'client', 'console', 'actionPreviewStore.ts'));
    expect(covered).to.include(path.join('src', 'client', 'console', 'consoleHandPlayPrewarm.ts'));
  });

  it('every NOT_A_CACHE entry still exists and still fetches', () => {
    const stale: Array<string> = [];
    for (const rel of NOT_A_CACHE.keys()) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs) || !fs.readFileSync(abs, 'utf8').includes('fetch(')) {
        stale.push(rel);
      }
    }
    expect(stale, 'these exemptions no longer describe anything — delete them').deep.eq([]);
  });
});

describe('gameStateVersion', () => {
  it('changes when the server counts a state change, and only then', () => {
    const at = (gameAge: number, undoCount = 0, id = 'p1') =>
      gameStateVersion({id, game: {gameAge, undoCount}});

    expect(at(7), 'a poll replay of the same state is the same version').eq(at(7));
    expect(at(7)).not.eq(at(8));           // a logged event / a resolved action
    expect(at(7)).not.eq(at(7, 1));        // an undo
    expect(at(7)).not.eq(at(7, 0, 'p2'));  // a different seat asks a different question
  });

  it('degrades instead of throwing on a partial view', () => {
    // Fixtures and degraded models exist; a stamp that throws would take a
    // whole surface down for a cache miss. It collapses to a constant instead
    // — which is exactly why a cache keeps its structural terms as a net.
    expect(() => gameStateVersion({})).not.to.throw();
    expect(gameStateVersion({})).eq(gameStateVersion({}));
  });
});
