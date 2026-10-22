import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';

/*
 * THE LAW OF THE FOLD — the source guard (T09 «ПОВЕРХНОСТЬ НЕ СКЛАДЫВАЕТСЯ ПОД СВОИМ ЖЕТОНОМ», ledger BY;
 * `docs/claude/console/resource-transfer.md` §2). The engine's behaviour is pinned in
 * `tests/client/console/transferSurfaceClear.spec.ts`; here, that every piece stands where the law needs it:
 *  · the run registers both ends of every token in its SYNCHRONOUS half (a host asks `surfaceClear` right after
 *    starting it), marks the birth left on the departure, and drops the token on every way out;
 *  · the fold sentinel speaks in every build when a token's surface left under it;
 *  · no host folds on a departure alone — every file that hears `onLeft` asks `surfaceClear` too;
 *  · the action commit's chain and the shell's fold go through it; the chain keeps no clock of its own.
 */
const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');
const ENGINE = 'src/client/console/resourceTransfer/consoleResourceTransfer.ts';

function body(source: string, signature: string): string {
  const at = source.indexOf(signature);
  expect(at, `${signature} is in the source`).gte(0);
  return source.slice(at, source.indexOf('\n}\n', at));
}

describe('the law of the fold — source guard', () => {
  const engine = read(ENGINE);
  const run = body(engine, 'export async function runResourceTransfers(');

  it('the run registers both ends BEFORE its first await — a host asking right after the call sees its tokens', () => {
    const registered = run.indexOf('registerTransferEnds(');
    const firstAwait = run.indexOf('await ');
    expect(registered).gte(0);
    expect(registered, 'registered in the synchronous half of the call').lt(firstAwait);
  });

  it('the birth is let go on the departure (both kinds of flight), and the token on every way out', () => {
    expect(run).to.match(/handles\.launched\.then\(\(\) => markTransferEndLeft\(e\.id\)\)/);
    expect(run).to.match(/detached\.then\(\(\) => markTransferEndLeft\(e\.id\)\)/);
    expect(run, 'a stalled wave holds no surface').to.match(/'stalled'\);\s*\n\s*\/\/[^\n]*\n\s*dropTransferEnds\(e\.id\)/);
    expect(body(engine, 'function removeFlight('), 'a removed flight drops its ends').to.include('dropTransferEnds(id)');
    expect(body(engine, 'export function abortResourceTransfers('), 'an abort forgets them all').to.include('liveEnds.clear()');
  });

  it('the fold sentinel speaks in every build, on a refused birth and on a landing absorbed in the air', () => {
    const report = body(engine, 'function reportEnds(');
    expect(report).to.include('foldSentinel(e.id, \'birth\')');
    expect(report).to.include('foldSentinel(e.id, \'touchdown\')');
    const sentinel = body(engine, 'function foldSentinel(');
    expect(sentinel).to.include('[transfer] surface folded under its token');
    expect(sentinel, 'never gated on a dev build — the e2e serves a production bundle').not.to.include('NODE_ENV');
    expect(read('tests/e2e/consoleTest.ts'), 'the harness turns it red on every spec').to.include('[transfer] surface folded under its token');
  });

  it('no host folds on a departure alone: every client file that hears `onLeft` asks `surfaceClear` too', () => {
    const framework = new Set([
      ENGINE,
      'src/client/console/resourceTransfer/railReward.ts',
      'src/client/console/resourceTransfer/resourceTransferDirector.ts',
    ]);
    const offenders: Array<string> = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const rel = path.posix.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(rel);
        } else if (/\.(ts|vue)$/.test(entry.name) && !framework.has(rel)) {
          const text = fs.readFileSync(rel, 'utf8');
          if (/\bonLeft\b/.test(text) && !/\bsurfaceClear\b/.test(text)) {
            offenders.push(rel);
          }
        }
      }
    };
    walk('src/client');
    expect(offenders, 'a file that folds on `onLeft` without asking the surface').deep.eq([]);
  });

  it('the action commit\'s chain folds through the law and keeps no clock of its own', () => {
    const rail = read('src/client/console/consoleActionCommitRail.ts');
    expect(rail).to.include('void surfaceClear(el).then(() => markFoldable())');
    expect(rail, 'no beat of the animation clock as a fold or a net').not.to.match(/gsap\.delayedCall|TRANSFER_BEAT_MS|TRANSFER_QUICK_ABSORB_MS/);
    expect(rail, 'a seeded half waits under a named hold whose ceiling is the registry\'s').to.include('\'action-commit-rail-owed\'');
  });

  it('the shell folds the workspace through the law, the claimed path settles after it, the commit resolves ONCE', () => {
    const shell = read('src/client/components/console/ConsoleShell.vue');
    expect(shell).to.include('Promise.all([rail.foldable, waveLeft]).then(() => surfaceClear(surfaceEl))');
    expect(shell).to.include('claimedRail.foldable.then(() => surfaceClear(claimedSurface)).then(() => this.reconcileWorkspaceOutcome())');
    expect(shell, 'H5b — the parked dismissal is the commit\'s owed fold from the moment it is parked')
      .to.match(/this\.commitFoldOwed = true;\s*\n\s*this\.pendingCommitDismiss = finishDismiss;/);
  });

  it('a party flow does not conclude on the ANSWER while the commit owns the surface — it ends on the commit\'s release', () => {
    // The Industrialists (parliament-actions / parliament-v2): the answer's `gameAge` watcher concluded the flow a tick
    // after the shell parked the commit's dismissal, and the reward wave was then born off a `.pcard-prod` already gone.
    const actions = read('src/client/components/console/ConsoleCardActions.vue');
    const signature = '    \'playerView.game.gameAge\'(age: number): void {';
    const at = actions.indexOf(signature);
    expect(at, 'the answer\'s watcher is in the source').gte(0);
    const watcher = actions.slice(at, actions.indexOf('\n    },\n', at));
    const asks = watcher.indexOf('if (actionCommitOwnsEnding(surfaceMotionState.awaiting !== undefined)) {');
    expect(asks, 'the answer asks the commit before it concludes').gte(0);
    expect(asks, 'asked BEFORE the conclusion it defers').lt(watcher.lastIndexOf('void this.$nextTick(() => this.concludeFlow());'));
    expect(actions, 'the deferred conclusion runs on the commit\'s release')
      .to.match(/actionCommitLive\(live: boolean\): void \{\s*\n\s*if \(!live && this\.concludeAfterCommit\) \{/);
  });

  it('the play scene\'s stage asks the law before it closes', () => {
    expect(read('src/client/console/played/consolePlayedHero.ts')).to.include('await surfaceClear(');
  });

  it('H5 — the poll / WS road seeds the action commit\'s rail half too', () => {
    expect(read('src/client/components/App.vue')).to.include('seedActionCommitRail(prevView as PlayerViewModel | undefined, model as PlayerViewModel)');
  });
});
