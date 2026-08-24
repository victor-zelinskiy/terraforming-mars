import {expect} from 'chai';
import {
  armBonusGainClaim, bonusGainRewardState, bonusGainSourceSelectors, bonusGainSpec,
  consumeBonusGainReward, detectBonusGainAutoResolve, noteBonusGainRows, pendingBonusGainRows,
  resetBonusGainReward, seedBonusGainRewardHold,
} from '@/client/console/startBonusGain';
import {clearPanelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {BonusGainRow} from '@/client/console/bonusAction';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';

/**
 * THE «ФОРА» GAIN REWARD BEAT — the two moments its steel and M€ can arrive,
 * and the arithmetic that has to agree with `Player.bonusGainAmount` exactly.
 */
const STEEL: BonusGainRow = {resource: 'steel', amount: 2, index: 1};
const mcRow = (per: number, amount: number): BonusGainRow =>
  ({resource: 'megacredits', amount, index: 2, perCardInHand: per});

function view(opts: {
  bonus?: number,
  hand?: number,
  gains?: ReadonlyArray<BonusGainRow>,
  marked?: boolean,
  source?: string,
} = {}): PlayerViewModel {
  const marked = opts.marked ?? opts.gains !== undefined;
  return {
    thisPlayer: {
      bonusActions: opts.bonus ?? 0,
      bonusActionSource: opts.source,
    },
    cardsInHand: new Array(opts.hand ?? 0).fill(0).map((_, i) => ({name: `card-${i}`})),
    waitingFor: marked ? {
      type: 'or',
      title: 'Take your next action',
      options: [],
      bonusActionPrompt: {
        source: opts.source ?? CardName.HEAD_START,
        remaining: opts.bonus ?? 1,
        granted: 2,
        gains: opts.gains,
      },
    } : undefined,
  } as unknown as PlayerViewModel;
}

describe('startBonusGain (the «Фора» gain reward beat)', () => {
  afterEach(() => {
    // Module state is BUNDLE-SHARED: a leaked hold would make every later spec
    // read the panel short by N.
    resetBonusGainReward();
    clearPanelRewardHold();
  });

  it('remembers the pending rows ONLY from a view that states them', () => {
    noteBonusGainRows(view({bonus: 2, gains: [STEEL, mcRow(2, 6)]}));
    expect(pendingBonusGainRows()).to.have.length(2);
    // A payment / placement INSIDE a bonus action carries no marker — reading
    // it as «nothing is pending» would forget the set halfway through the very
    // action whose end resolves it.
    noteBonusGainRows(view({bonus: 2, marked: false}));
    expect(pendingBonusGainRows(), 'the unmarked prompt changed nothing').to.have.length(2);
    // …but an EMPTY list on a MARKED prompt is real information.
    noteBonusGainRows(view({bonus: 1, gains: []}));
    expect(pendingBonusGainRows()).to.have.length(0);
  });

  describe('the auto-resolve at the window\'s end', () => {
    it('fires only on the ledger\'s falling edge', () => {
      const pending = {rows: [STEEL], source: CardName.HEAD_START};
      expect(detectBonusGainAutoResolve(view({bonus: 2}), view({bonus: 1, hand: 3}), pending),
        'the window is still open').to.eq(undefined);
      expect(detectBonusGainAutoResolve(undefined, view({hand: 3}), pending),
        'no before-view (a fresh load) is not a falling edge').to.eq(undefined);
      const closed = detectBonusGainAutoResolve(view({bonus: 1}), view({hand: 3}), pending);
      expect(closed?.kind).to.eq('auto');
      expect(closed?.specs).to.deep.eq([{channel: 'stock', resource: 'steel', amount: 2}]);
      expect(closed?.source).to.eq(CardName.HEAD_START);
    });

    it('reads the M€ off the COMMITTED hand — the server\'s own arithmetic', () => {
      // `Player.bonusGainAmount`: perCardInHand × the hand AS IT STANDS. The
      // older prompt said 6 (3 cards); the player then PLAYED one with their
      // last bonus action, so what actually arrives is 4.
      const pending = {rows: [mcRow(2, 6)], source: CardName.HEAD_START};
      const reward = detectBonusGainAutoResolve(view({bonus: 1}), view({hand: 2}), pending);
      expect(reward?.specs).to.deep.eq([{channel: 'stock', resource: 'megacredits', amount: 4}]);
    });

    it('an empty hand grants nothing, so there is nothing to fly', () => {
      const pending = {rows: [mcRow(2, 6)], source: CardName.HEAD_START};
      expect(detectBonusGainAutoResolve(view({bonus: 1}), view({hand: 0}), pending)).to.eq(undefined);
    });

    it('nothing pending → no beat (the player claimed both early)', () => {
      const pending = {rows: [], source: CardName.HEAD_START};
      expect(detectBonusGainAutoResolve(view({bonus: 1}), view({hand: 3}), pending)).to.eq(undefined);
    });
  });

  describe('the commit seed', () => {
    it('a CLAIM holds the panel for exactly its own amount, and owes the flight', () => {
      armBonusGainClaim(STEEL, CardName.HEAD_START, {x: 10, y: 20});
      seedBonusGainRewardHold(view({bonus: 2, gains: [STEEL]}), view({bonus: 2, hand: 3, gains: []}));
      expect(heldStock('steel'), 'the panel shows committed − held until the touchdown').to.eq(2);
      const owed = bonusGainRewardState.owed;
      expect(owed?.kind).to.eq('claim');
      expect(owed?.point, 'the pressed row\'s own centre, captured before it unmounted')
        .to.deep.eq({x: 10, y: 20});
      // …and it is handed over exactly once.
      expect(consumeBonusGainReward()).to.eq(owed);
      expect(bonusGainRewardState.owed).to.eq(undefined);
      expect(consumeBonusGainReward()).to.eq(undefined);
    });

    it('a claim ANSWERED BY THE CLOSING RESPONSE never pays twice', () => {
      // The player claims on the same press that spends the last action: the
      // auto-resolve is what actually pays, and holding the claim's amount as
      // well would leave the panel short by it.
      noteBonusGainRows(view({bonus: 1, gains: [STEEL]}));
      armBonusGainClaim(STEEL, CardName.HEAD_START, {x: 1, y: 1});
      seedBonusGainRewardHold(view({bonus: 1}), view({hand: 1}));
      expect(bonusGainRewardState.owed?.kind).to.eq('auto');
      expect(heldStock('steel')).to.eq(2);
      expect(bonusGainRewardState.owed?.specs).to.have.length(1);
    });

    it('the window\'s end CLEARS the pending set — one payout, once', () => {
      noteBonusGainRows(view({bonus: 1, gains: [STEEL]}));
      seedBonusGainRewardHold(view({bonus: 1}), view({hand: 1}));
      expect(pendingBonusGainRows()).to.have.length(0);
      consumeBonusGainReward();
      // A second commit past the closed window owes nothing.
      seedBonusGainRewardHold(view({bonus: 0}), view({hand: 1}));
      expect(bonusGainRewardState.owed).to.eq(undefined);
    });

    it('an ordinary response owes nothing at all', () => {
      seedBonusGainRewardHold(view({bonus: 0}), view({bonus: 0, hand: 4}));
      expect(bonusGainRewardState.owed).to.eq(undefined);
      expect(heldStock('steel')).to.eq(0);
    });
  });

  it('the auto-resolve emerges from the CARD, in the order it can be standing', () => {
    const sel = bonusGainSourceSelectors(CardName.HEAD_START);
    // The window is over, so the granting card is back in «РАЗЫГРАНО» — the
    // workspace's own shelf leads, the stage seat follows for the case where a
    // panel is still holding the card in its source column.
    expect(sel[0]).to.contain('.con-start__played');
    expect(sel[0]).to.contain(CardName.HEAD_START);
    expect(sel).to.contain('[data-embed-source-slot]');
    // No source named (a reload wiped it): the seat is the only honest guess.
    expect(bonusGainSourceSelectors(undefined)).to.deep.eq(['[data-embed-source-slot]']);
  });

  it('a spec is a whole, positive number of units on the STOCK channel', () => {
    expect(bonusGainSpec('steel', 2)).to.deep.eq({channel: 'stock', resource: 'steel', amount: 2});
    expect(bonusGainSpec('megacredits', -3).amount, 'the framework moves GAINS only').to.eq(0);
    expect(bonusGainSpec('megacredits', 4.6).amount).to.eq(5);
  });
});
