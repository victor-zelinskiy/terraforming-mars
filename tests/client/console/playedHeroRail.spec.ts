import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {Payment} from '@/common/inputs/Payment';
import {blockingAnimationHoldCount} from '@/client/components/presentation/animationHold';
import {playRailReward} from '@/client/console/consoleActionCommit';
import {
  abortPlayedHero, armPlayedHero, playedHeroState, seedPlayedHeroRewardHold,
} from '@/client/console/played/consolePlayedHero';
import {clearPanelRewardHold, heldProduction, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {RATING_RAIL_KEY} from '@/client/console/resourceTransfer/resourceTransferModel';
import {railRewardState, resetRailRewards} from '@/client/console/resourceTransfer/railReward';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';

/*
 * PL-001 FOR PLAYS — the landing scene's RAIL HALF (`consolePlayedHero.ts`):
 * the play's direct TR and the table's answer to it, promised at the arm,
 * checked against the two views in the apply block (`seedPlayedHeroRewardHold`
 * → `railReward.seedRailReward`), held until the reward beat flies them — and
 * released by every ending that does not. The flight itself is the reward
 * beat's (DOM — pinned end to end by `console-play-tr-reward`).
 */
const BRIBED = CardName.BRIBED_COMMITTEE;
const DOME = CardName.MAGNETIC_FIELD_DOME;

function view(p: {tr: number, mc: number, plantProd?: number, energyProd?: number}): PlayerViewModel {
  return {
    id: 'p-viewer',
    thisPlayer: {
      color: 'blue',
      terraformRating: p.tr,
      megacredits: p.mc,
      energy: 0, steel: 0, titanium: 0, plants: 0, heat: 0,
      megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0,
      plantProduction: p.plantProd ?? 0, energyProduction: p.energyProd ?? 0, heatProduction: 0,
      tableau: [],
    },
  } as unknown as PlayerViewModel;
}

const pay = (megacredits: number): Payment => ({megacredits} as Payment);

/** The server's chips of Bribed Committee («Raise your TR 2 steps»). */
function bribedBranch(): ActionPreviewBranch {
  return {
    index: -1, title: '', available: true, renderKeys: [], steps: [],
    effects: [{direction: 'gain', icon: 'tr', amount: 2, current: 20, resulting: 22}],
  } as ActionPreviewBranch;
}

/** Magnetic Field Dome: −2 energy production, +1 plant production, +1 TR. */
function domeBranch(): ActionPreviewBranch {
  return {
    index: -1, title: '', available: true, renderKeys: [], steps: [],
    effects: [
      {direction: 'cost', icon: 'energy', amount: 2, current: 2, resulting: 0, note: 'production'},
      {direction: 'gain', icon: 'plants', amount: 1, current: 0, resulting: 1, note: 'production'},
      {direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21},
    ],
  } as ActionPreviewBranch;
}

const greens = (amount: number) => [{channel: 'stock' as const, resource: 'megacredits', amount}];

describe('the played-card scene\'s rail half — PL-001 for plays', () => {
  afterEach(() => {
    reduceMotionOverrideState.enabled = false;
    abortPlayedHero();
    resetRailRewards();
    clearPanelRewardHold();
  });

  describe('the PLAN (pure)', () => {
    it('a direct TR is the cause; the play\'s price and the branch\'s own moves are KNOWN', () => {
      const rail = playRailReward(domeBranch(), domeBranch().effects, {}, pay(5), greens(2));
      expect(rail?.cause).deep.eq([{channel: 'stock', resource: RATING_RAIL_KEY, amount: 1}]);
      expect(rail?.reactions).deep.eq(greens(2));
      expect(rail?.known).deep.eq({'production:energy': -2, 'production:plants': 1, 'stock:megacredits': -5});
    });

    it('no direct TR, no rail half', () => {
      const noTr = {...domeBranch(), effects: domeBranch().effects.filter((e) => e.icon !== 'tr')};
      expect(playRailReward(noTr, noTr.effects, {}, pay(5), greens(2))).is.undefined;
    });

    it('a DRAW does not own a play\'s TR (UNMI Contractor) — an action\'s draw still does', () => {
      const branch = {...bribedBranch(), effects: [...bribedBranch().effects, {direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}]} as ActionPreviewBranch;
      expect(playRailReward(branch, branch.effects, {}, undefined, [])?.cause).deep.eq([{channel: 'stock', resource: RATING_RAIL_KEY, amount: 2}]);
    });

    it('a scale or a placement owns the TR — nothing for the rail', () => {
      const scale = {...bribedBranch(), effects: [{direction: 'gain', icon: 'temperature', amount: 2, unit: '°C'}, ...bribedBranch().effects]} as ActionPreviewBranch;
      expect(playRailReward(scale, scale.effects, {}, undefined, [])).is.undefined;
      const tile = {...bribedBranch(), steps: [{kind: 'boardPlacement'}]} as unknown as ActionPreviewBranch;
      expect(playRailReward(tile, tile.effects, {}, undefined, [])).is.undefined;
    });
  });

  describe('SEED — in the apply block, against the two views', () => {
    it('Bribed Committee: the rating held (+2), the Greens\' answer held, the price ticks with the commit', () => {
      armPlayedHero(BRIBED, true, {manualTableOpen: false, rail: playRailReward(bribedBranch(), bribedBranch().effects, {}, pay(7), greens(4))});
      // 60 − 7 (the price, known) + 4 (the Greens' answer): the row moved by −3.
      seedPlayedHeroRewardHold(view({tr: 20, mc: 60}), view({tr: 22, mc: 57}));
      expect(heldStock(RATING_RAIL_KEY)).eq(2);
      expect(heldStock('megacredits'), 'the answer is held; the price is not').eq(4);
      expect(railRewardState.entries.map((e) => e.key)).deep.eq([`played-hero:${BRIBED}`]);
      expect(blockingAnimationHoldCount(), 'a held reward holds the foreground').greaterThan(0);
    });

    it('the card\'s own gains and its TR are held side by side (the Dome: the production wave, then the TR)', () => {
      armPlayedHero(DOME, false, {
        manualTableOpen: false,
        rewards: [{channel: 'production', resource: 'plants', amount: 1}],
        rail: playRailReward(domeBranch(), domeBranch().effects, {}, pay(5), greens(2)),
      });
      seedPlayedHeroRewardHold(view({tr: 20, mc: 60, energyProd: 2}), view({tr: 21, mc: 57, plantProd: 1}));
      expect(heldProduction('plants')).eq(1);
      expect(heldStock(RATING_RAIL_KEY)).eq(1);
      expect(heldStock('megacredits')).eq(2);
    });

    it('a rating that moved by anything else holds NOTHING and names itself', () => {
      armPlayedHero(BRIBED, true, {manualTableOpen: false, rail: playRailReward(bribedBranch(), bribedBranch().effects, {}, pay(7), greens(4))});
      seedPlayedHeroRewardHold(view({tr: 20, mc: 60}), view({tr: 23, mc: 57}));
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(heldStock('megacredits')).eq(0);
      expect(railRewardState.degraded?.why).eq('mismatch');
    });

    it('an answer that disagrees is dropped alone — the TR stays held', () => {
      armPlayedHero(BRIBED, true, {manualTableOpen: false, rail: playRailReward(bribedBranch(), bribedBranch().effects, {}, pay(7), greens(4))});
      seedPlayedHeroRewardHold(view({tr: 20, mc: 60}), view({tr: 22, mc: 53}));
      expect(heldStock(RATING_RAIL_KEY)).eq(2);
      expect(heldStock('megacredits')).eq(0);
    });

    it('seeded ONCE per transaction', () => {
      armPlayedHero(BRIBED, true, {manualTableOpen: false, rail: playRailReward(bribedBranch(), bribedBranch().effects, {}, pay(7), [])});
      seedPlayedHeroRewardHold(view({tr: 20, mc: 60}), view({tr: 22, mc: 53}));
      seedPlayedHeroRewardHold(view({tr: 22, mc: 53}), view({tr: 22, mc: 53}));
      expect(heldStock(RATING_RAIL_KEY)).eq(2);
    });

    it('reduced motion holds nothing', () => {
      reduceMotionOverrideState.enabled = true;
      armPlayedHero(BRIBED, true, {manualTableOpen: false, rail: playRailReward(bribedBranch(), bribedBranch().effects, {}, pay(7), greens(4))});
      seedPlayedHeroRewardHold(view({tr: 20, mc: 60}), view({tr: 22, mc: 57}));
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(railRewardState.entries).is.empty;
    });

    it('no transaction, no hold', () => {
      seedPlayedHeroRewardHold(view({tr: 20, mc: 60}), view({tr: 22, mc: 57}));
      expect(playedHeroState.active).is.false;
      expect(railRewardState.entries).is.empty;
    });
  });

  describe('RELEASE — every ending lets go of what it seeded', () => {
    it('an abort ticks the held rows now', () => {
      armPlayedHero(BRIBED, true, {manualTableOpen: false, rail: playRailReward(bribedBranch(), bribedBranch().effects, {}, pay(7), greens(4))});
      seedPlayedHeroRewardHold(view({tr: 20, mc: 60}), view({tr: 22, mc: 57}));
      abortPlayedHero();
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(heldStock('megacredits')).eq(0);
      expect(railRewardState.entries).is.empty;
      expect(blockingAnimationHoldCount()).eq(0);
    });

    it('a new arm never inherits the last transaction\'s promise', () => {
      armPlayedHero(BRIBED, true, {manualTableOpen: false, rail: playRailReward(bribedBranch(), bribedBranch().effects, {}, pay(7), [])});
      armPlayedHero(DOME, false, {manualTableOpen: false});
      seedPlayedHeroRewardHold(view({tr: 20, mc: 60}), view({tr: 22, mc: 53}));
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(railRewardState.entries).is.empty;
    });
  });
});
