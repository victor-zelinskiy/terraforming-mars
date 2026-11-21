import {expect} from 'chai';
import * as path from 'path';
import {pathToFileURL} from 'url';

/*
 * THE KERNEL'S STATE SPACE — WALKED OR DECLARED (FREEZE ZERO, stage 4 — docs/claude/console/freeze-zero/PLAN.md § 8:
 * «machine moves 100 % walked-or-declared; flows 100 %»). Two scripts hold the number: `monkey-report.mjs` counts a
 * machine's moves BY REGION (`regionMoves`), `kernel-walked.mjs` unions several passes and holds what none of them
 * walked against the ledger of declared reasons (`tests/client/bottle/kernelUnwalked.json`).
 */
type Coverage = {
  flows: {never: Array<string>}, frames: {never: Array<string>},
  machines: Record<string, {moves: number, made: number, never: Array<string>, unlisted: Array<string>}>,
};
type Unwalked = {flows: Array<string>, frames: Array<string>, moves: Record<string, Array<string>>};
type Ledger = {flows: Record<string, string>, frames: Record<string, string>, moves: Record<string, Record<string, string>>};
type Report = {
  regionMoves: (edge: string) => Array<string>,
  aggregateCoverage: (files: Array<{coverage: {keys: Array<string>, machines: Record<string, Array<string>>, frames: Array<string>}}>, declared: Record<string, string>) => Coverage,
};
type Walked = {
  unwalkedOf: (coverage: Coverage) => Unwalked,
  judgeWalked: (unwalked: Unwalked, ledger: Ledger) => {missing: Array<string>, stale: Array<string>, undeclared: Array<string>},
};

const script = <T>(name: string): Promise<T> => import(pathToFileURL(path.join(__dirname, '..', '..', 'scripts', name)).href) as Promise<T>;
const live = (stage: string, beat: string, arrival: string, host = 'bound') => JSON.stringify({live: {stage, beat, arrival, host}});

describe('the kernel\'s state space — a machine\'s move is a REGION\'s move, and what no pass walks is declared', () => {
  it('a machine of orthogonal regions: the product of its regions is not its moves', async () => {
    const {regionMoves} = await script<Report>('monkey-report.mjs');
    // One region moved — whatever the other three stand on, it is the same move.
    expect(regionMoves(`${live('awaiting', 'pending', 'closed')} → ${live('awaiting', 'over', 'closed')}`)).to.deep.equal(['live/beat: pending → over']);
    expect(regionMoves(`${live('presenting', 'pending', 'timed')} → ${live('presenting', 'over', 'timed')}`)).to.deep.equal(['live/beat: pending → over']);
    // One event moving two regions is each region's move.
    expect(regionMoves(`${live('awaiting', 'over', 'closed')} → ${live('presenting', 'over', 'timed')}`).sort())
      .to.deep.equal(['live/arrival: closed → timed', 'live/stage: awaiting → presenting']);
    // The machine leaves its regions altogether.
    expect(regionMoves(`${live('awaiting', 'over', 'open')} → released`)).to.deep.equal(['live → released']);
    // A compound state's one child is part of the state's name; a plain machine reads as it always did.
    expect(regionMoves('browse → {"executing":"away"}')).to.deep.equal(['browse → executing.away']);
    expect(regionMoves('{"executing":"away"} → {"executing":"onStage"}')).to.deep.equal(['executing.away → executing.onStage']);
    expect(regionMoves('sending → refused')).to.deep.equal(['sending → refused']);
  });

  it('the report counts moves by region — and reads the move off a key whose LABEL carries spaces', async () => {
    const {aggregateCoverage} = await script<Report>('monkey-report.mjs');
    const coverage = aggregateCoverage([{coverage: {
      keys: [
        'open claim:hand',
        `state claim:hand ${live('awaiting', 'pending', 'closed')} → ${live('awaiting', 'over', 'closed')}`,
        // (An announce's label is its question's title — spaces and all.)
        'state announce:task:card|Select ${N} card(s) to discard (Reds) pending → late',
      ],
      machines: {
        claim: [
          `${live('awaiting', 'pending', 'closed')} → ${live('awaiting', 'over', 'closed')}`,
          `${live('presenting', 'pending', 'closed')} → ${live('presenting', 'over', 'closed')}`,
          `${live('awaiting', 'over', 'closed')} → released`,
        ],
        announce: ['pending → late', 'pending → presented'],
      },
      frames: ['frame:hand'],
    }}], {'claim:hand': 'src/x.ts', 'scene:never-opened': 'src/y.ts'});
    expect(coverage.machines.claim, 'two product edges of ONE region move, and the release').to.include({moves: 2, made: 1});
    expect(coverage.machines.claim.never).to.deep.equal(['live → released']);
    expect(coverage.machines.announce).to.include({moves: 2, made: 1});
    expect(coverage.machines.announce.never).to.deep.equal(['pending → presented']);
    expect(coverage.flows.never).to.deep.equal(['scene:never-opened']);
  });

  it('the union held against the ledger: not on it · declared without a reason · walked since it was written', async () => {
    const {judgeWalked} = await script<Walked>('kernel-walked.mjs');
    const unwalked: Unwalked = {
      flows: ['scene:a', 'scene:b', 'scene:new'], frames: ['frame:x'],
      moves: {submit: ['presenting → abandoned'], claim: ['live → released']},
    };
    const ledger: Ledger = {
      flows: {'scene:a': 'needs a measured rect — the bottle has no layout', 'scene:b': '', 'scene:walked-since': 'was never opened'},
      frames: {'frame:x': 'the desktop\'s'},
      moves: {submit: {'presenting → abandoned': ''}, claim: {}},
    };
    const verdict = judgeWalked(unwalked, ledger);
    expect(verdict.missing.sort(), 'never walked, and nobody wrote it down').to.deep.equal(['flow · scene:new', 'move claim · live → released']);
    expect(verdict.undeclared.sort(), 'the stage\'s debt: on the ledger with no reason').to.deep.equal(['flow · scene:b', 'move submit · presenting → abandoned']);
    expect(verdict.stale, 'a pass walked it: it leaves at the next --write').to.deep.equal(['flow · scene:walked-since']);
  });
});
