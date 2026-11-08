import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE WAIT GRAPH's LAW (Э4 — docs/claude/console/wait-graph.md): a wait is in the graph BY CONSTRUCTION.
 *
 * A module that exports a reactive FLOW state (a `live:` / `active:` flag — a run that something waits on, the shape
 * every flow-internal freeze of the inventory had: R4 the sitting's run, R5 the walk, R6 the trade) must enter the graph
 * either by its own source (`registerWaitSource`) or by an animation hold (every hold is a node through the registry —
 * `waitGraphSources.holdWaitNodes`, with its ceiling and its owner's `expire`). A module that does neither is listed
 * below WITH ITS REASON (a pick the player drives, a store whose flow's hold lives in its sibling) — a new one fails here
 * until it declares itself or states why it never waits.
 */
const CONSOLE = path.resolve(__dirname, '../../src/client/console');

/** Flow-state modules that declare nothing, and why that is honest. */
const EXEMPT: Readonly<Record<string, string>> = {
  'cardDiscard/cardDiscardState.ts': 'the store of `consoleCardDiscard.ts`, whose transaction holds `card-discard` (in the graph)',
  'colonyTrade/colonyTrackMove.ts': 'a marker glide of the trade — the trade run (`flow:colony-trade`) bounds it',
  'consoleActionCommit.ts': 'the commit motion of a composer — its rail halves hold `action-commit-rail*` (in the graph)',
  'consoleColoniesModel.ts': 'UI state of the colonies section (focus, berth) — no run, nothing ends it',
  'consoleHandPick.ts': 'a pick the PLAYER drives — the wait is the player\'s, honest and unbounded',
  'consolePlayPick.ts': 'a pick the PLAYER drives — the wait is the player\'s',
  'consoleRepeatPick.ts': 'a pick the PLAYER drives — the wait is the player\'s',
  'deckPick/preludePlayChain.ts': 'a chain of the player\'s prelude plays — each play is its own composer / hero (holds in the graph)',
  'finalGreenery/finalGreenerySession.ts': 'the finale SESSION — the server decides its end; each pick is the player\'s',
  'hydroFlow/deltaBlockadeEntry.ts': 'an entry record of the Hydronetwork flow — its ceremony holds `hydro-ceremony` (in the graph)',
  'hydroFlow/deltaEspionageEntry.ts': 'an entry record of the Hydronetwork flow — its ceremony holds `hydro-ceremony` (in the graph)',
  'hydroFlow/deltaRewardEntry.ts': 'an entry record of the Hydronetwork flow — its ceremony holds `hydro-ceremony` (in the graph)',
  'loadingScreenState.ts': 'the boot / loading screen — before any game, no prompt to wait on',
  'played/playedCardReturn.ts': 'a card-return motion of the played hero — the hero holds `played-hero` (in the graph)',
};

function walk(dir: string, out: Array<string> = []): Array<string> {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else if (entry.name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

function flowModules(): Array<{rel: string, declared: boolean}> {
  const out: Array<{rel: string, declared: boolean}> = [];
  for (const file of walk(CONSOLE)) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/export const \w+ = reactive/.test(src) || !/^\s+(live|active):\s*(false|true)/m.test(src)) {
      continue;
    }
    out.push({
      rel: path.relative(CONSOLE, file).split(path.sep).join('/'),
      declared: /registerWaitSource\(|beginAnimationHold\(|registerAnimationHoldSupplier\(|holdAnimationWhile\(/.test(src),
    });
  }
  return out;
}

describe('the wait graph law — a flow is in the graph by construction', () => {
  it('every flow-state module declares itself (a wait source or a hold) or states why it never waits', () => {
    const undeclared = flowModules().filter((m) => !m.declared && EXEMPT[m.rel] === undefined).map((m) => m.rel);
    expect(undeclared, 'declare the run (`registerWaitSource` / a hold with `expire`) or add it to EXEMPT with its reason').to.deep.eq([]);
  });

  it('the exemptions are live — an exempt module that now declares itself (or is gone) leaves the list', () => {
    const modules = new Map(flowModules().map((m) => [m.rel, m.declared]));
    const stale = Object.keys(EXEMPT).filter((rel) => modules.get(rel) !== false);
    expect(stale).to.deep.eq([]);
  });

  it('reads a real corpus (anti-vacuous): the declared flows are found — the rally, the walk, the chairmanship, the trade', () => {
    const declared = flowModules().filter((m) => m.declared).map((m) => m.rel);
    expect(declared).to.include.members(['parliament/neutralRally.ts', 'parliament/agendaWalk.ts', 'parliament/consoleChairmanQuest.ts', 'colonyTrade/consoleColonyTrade.ts']);
    expect(declared.length).to.be.greaterThan(15);
  });

  it('the registries enter by construction — holds, ledger stories and the park are sources of the graph', () => {
    const src = fs.readFileSync(path.join(CONSOLE, 'waitGraph/waitGraphSources.ts'), 'utf8');
    for (const name of ['holds', 'stories', 'park']) {
      expect(src, name).to.contain(`registerWaitSource('${name}'`);
    }
    const shell = fs.readFileSync(path.resolve(__dirname, '../../src/client/components/console/ConsoleShell.vue'), 'utf8');
    expect(shell).to.contain('registerWaitSource(\'shell\'');
    expect(shell).to.contain('...registerConstructionWaitSources()');
  });
});
