import {expect} from 'chai';
import {
  actionCommitState, armActionCommit, markActionCommitSettled, actionCommitHolding,
  consumeActionCommitPlan, releaseActionCommit, abortConsoleActionCommit, resetActionCommit,
  commitKindForBranch, commitRewardSpecs,
} from '@/client/console/consoleActionCommit';
import {CardName} from '@/common/cards/CardName';
import {ActionPreviewBranch, ActionEffect} from '@/common/models/ActionPreviewModel';

function branchWith(over: Partial<ActionPreviewBranch>): ActionPreviewBranch {
  return {
    index: 0, title: '', available: true, renderKeys: [], effects: [], steps: [],
    ...over,
  } as ActionPreviewBranch;
}

function gain(icon: string, amount: number, note?: string, unit?: string): ActionEffect {
  return {direction: 'gain', icon, amount, note, unit};
}

const PLAN = {sourceCard: CardName.BUSINESS_NETWORK, kind: 'generic' as const, specs: [], origins: []};

describe('consoleActionCommit — the universal activation beat', () => {
  afterEach(() => resetActionCommit());

  describe('lifecycle (the min-beat gate a fast server must not cut)', () => {
    it('arms at submit and HOLDS until the motion settles', () => {
      expect(actionCommitHolding()).to.eq(false);
      armActionCommit(PLAN);
      expect(actionCommitHolding()).to.eq(true);
      markActionCommitSettled();
      expect(actionCommitHolding()).to.eq(false);
      expect(actionCommitState.active).to.eq(true); // still active until release
    });

    it('the plan is consumed exactly once (the shell resolution)', () => {
      armActionCommit(PLAN);
      expect(consumeActionCommitPlan()?.sourceCard).to.eq(CardName.BUSINESS_NETWORK);
      expect(consumeActionCommitPlan()).to.eq(undefined);
    });

    it('release drops every hold and the plan', () => {
      armActionCommit(PLAN);
      releaseActionCommit();
      expect(actionCommitHolding()).to.eq(false);
      expect(actionCommitState.active).to.eq(false);
      expect(consumeActionCommitPlan()).to.eq(undefined);
    });

    it('a REJECTED submit aborts: released + abortNonce tells the composer to unlock', () => {
      const nonce = actionCommitState.abortNonce;
      armActionCommit(PLAN);
      abortConsoleActionCommit();
      expect(actionCommitHolding()).to.eq(false);
      expect(actionCommitState.abortNonce).to.eq(nonce + 1);
      expect(consumeActionCommitPlan()).to.eq(undefined);
    });
  });

  describe('commitKindForBranch — structural, never card identity', () => {
    it('a reveal branch is a deck-check', () => {
      expect(commitKindForBranch(branchWith({reveal: {} as never}))).to.eq('deck-check');
    });

    it('a cards gain is a draw (Business Network / Inventors Guild archetype)', () => {
      expect(commitKindForBranch(branchWith({effects: [gain('cards', 1)]}))).to.eq('draw');
    });

    it('a board placement step is a tile', () => {
      expect(commitKindForBranch(branchWith({
        steps: [{kind: 'boardPlacement', placementType: 'land'}],
      }))).to.eq('tile');
    });

    it('a global-parameter gain is global', () => {
      expect(commitKindForBranch(branchWith({effects: [gain('temperature', 1, undefined, '°C')]}))).to.eq('global');
    });

    it('a standard-resource gain is resources; production too; a card resource too', () => {
      expect(commitKindForBranch(branchWith({effects: [gain('plants', 2)]}))).to.eq('resources');
      expect(commitKindForBranch(branchWith({effects: [gain('energy', 1, 'production')]}))).to.eq('resources');
      expect(commitKindForBranch(branchWith({effects: [gain('microbe', 1, 'on this card')]}))).to.eq('resources');
    });

    it('a cost-only / empty branch is generic', () => {
      expect(commitKindForBranch(branchWith({}))).to.eq('generic');
      expect(commitKindForBranch(branchWith({
        effects: [{direction: 'cost', icon: 'megacredits', amount: 1}],
      }))).to.eq('generic');
      expect(commitKindForBranch(undefined)).to.eq('generic');
    });
  });

  describe('commitRewardSpecs — the wave carries the RAIL channels only', () => {
    it('stock + production gains become specs (server-computed amounts, merged)', () => {
      const specs = commitRewardSpecs(CardName.BUSINESS_NETWORK, branchWith({
        effects: [gain('plants', 2), gain('plants', 1), gain('heat', 3, 'production')],
      }), {});
      expect(specs).to.deep.eq([
        {channel: 'stock', resource: 'plants', amount: 3},
        {channel: 'production', resource: 'heat', amount: 3},
      ]);
    });

    it('card-resource / global / draw gains stay OUT of the wave (their own flows own them)', () => {
      const specs = commitRewardSpecs(CardName.BUSINESS_NETWORK, branchWith({
        effects: [
          gain('microbe', 1, 'on this card'),
          gain('temperature', 1, undefined, '°C'),
          gain('cards', 2),
        ],
      }), {});
      expect(specs).to.deep.eq([]);
    });

    it('costs never fly', () => {
      const specs = commitRewardSpecs(CardName.BUSINESS_NETWORK, branchWith({
        effects: [{direction: 'cost', icon: 'plants', amount: 2}],
      }), {});
      expect(specs).to.deep.eq([]);
    });
  });
});
