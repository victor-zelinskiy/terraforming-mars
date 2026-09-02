/*
 * THE PREVIEW BRANCH IS ADDRESSED BY `index`, NEVER BY ARRAY POSITION.
 *
 * `ActionPreviewBranch.index` is the server's RUNTIME OrOptions index over the
 * FILTERED behavior list: `-1` for a single-action card, and shifted off the
 * array position whenever an unavailable earlier branch is filtered out. A
 * `branches[branchIndex]` subscript therefore reads `[-1]` (nothing) for every
 * single-action card — which is how the Hydronetwork's stage-7 copy of
 * «Центр ИИ» armed NO outcome claim and its drawn cards escaped to the
 * standalone «Получены карты» band over the track — and reads the WRONG branch
 * for a multi-branch card with a dead variant.
 *
 * Two halves: the unit spec pins `previewBranchByIndex` /
 * `branchOutcomeClaimPlan` (the one lookup + the one claim derivation every
 * site now uses), and the source guard fails the moment any of the historical
 * offenders grows a subscript again.
 */
import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {branchOutcomeClaimPlan, previewBranchByIndex} from '@/client/console/actionPreviewStore';
import type {ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';

function branch(partial: Partial<ActionPreviewBranch> & {index: number}): ActionPreviewBranch {
  return {
    title: '',
    available: true,
    renderKeys: [],
    effects: [],
    steps: [],
    ...partial,
  } as ActionPreviewBranch;
}

function preview(branches: Array<ActionPreviewBranch>): ActionPreview {
  return {branches} as unknown as ActionPreview;
}

describe('previewBranchByIndex — the runtime OR-index is a KEY', () => {
  it('resolves -1 (a single-action card) to its only branch', () => {
    const p = preview([branch({index: -1, effects: [{direction: 'gain', icon: 'cards', amount: 2}] as ActionPreviewBranch['effects']})]);
    expect(previewBranchByIndex(p, -1)?.index).to.eq(-1);
  });

  it('resolves a SHIFTED index (a filtered-out earlier branch) to the right branch', () => {
    // Runtime indices 0/1 over the filtered list; array positions do not match
    // once the preview also carries a disabled branch (index -1 by contract).
    const p = preview([
      branch({index: -1, available: false}),
      branch({index: 0}),
      branch({index: 1, reveal: {} as ActionPreviewBranch['reveal']}),
    ]);
    expect(previewBranchByIndex(p, 1)?.reveal).to.not.eq(undefined);
    expect(previewBranchByIndex(p, 0)?.reveal).to.eq(undefined);
  });

  it('answers undefined for a missing preview and a missing index', () => {
    expect(previewBranchByIndex(undefined, -1)).to.eq(undefined);
    expect(previewBranchByIndex(preview([branch({index: 0})]), 3)).to.eq(undefined);
  });
});

describe('branchOutcomeClaimPlan — the ONE structural claim derivation', () => {
  it('a cards GAIN promises draw+pick with the summed amount («Центр ИИ»)', () => {
    const p = preview([branch({
      index: -1,
      effects: [{direction: 'gain', icon: 'cards', amount: 2}] as ActionPreviewBranch['effects'],
    })]);
    expect(branchOutcomeClaimPlan(p, -1)).to.deep.eq({kinds: ['draw', 'pick'], expectedCards: 2});
  });

  it('a reveal promises the deck-check verdict («Поиски жизни»)', () => {
    const p = preview([branch({index: -1, reveal: {} as ActionPreviewBranch['reveal']})]);
    expect(branchOutcomeClaimPlan(p, -1)).to.deep.eq({kinds: ['deck-check'], expectedCards: 0});
  });

  it('a cache miss degrades to an EMPTY plan (the adoption net catches the batch)', () => {
    expect(branchOutcomeClaimPlan(undefined, -1)).to.deep.eq({kinds: [], expectedCards: 0});
  });

  it('a COST of cards is not a promise of cards', () => {
    const p = preview([branch({
      index: -1,
      effects: [{direction: 'cost', icon: 'cards', amount: 1}] as ActionPreviewBranch['effects'],
    })]);
    expect(branchOutcomeClaimPlan(p, -1).kinds).to.deep.eq([]);
  });
});

/**
 * THE SOURCE GUARD. These files each carried the subscript once; the resolver
 * exists so they cannot drift back one by one. `.branches[` in any of them —
 * outside the resolver's own home — is the defect returning.
 */
describe('previewBranchLookupGuard — no `.branches[` subscript at the claim sites', () => {
  const root = path.join(__dirname, '..', '..');
  const files = [
    'src/client/components/console/ConsoleShell.vue',
    'src/client/components/console/ConsoleCardActions.vue',
    'src/client/components/console/ConsoleHydroSection.vue',
    'src/client/console/hydroFlow/deltaRewardEntry.ts',
  ];
  for (const file of files) {
    it(`${file} addresses preview branches only through previewBranchByIndex`, () => {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      const offenders = text.split('\n')
        .map((line, i) => ({line, n: i + 1}))
        .filter(({line}) => line.includes('.branches['));
      expect(offenders, offenders.map(({n, line}) => `${file}:${n}: ${line.trim()}`).join('\n')).to.deep.eq([]);
    });
  }
});
