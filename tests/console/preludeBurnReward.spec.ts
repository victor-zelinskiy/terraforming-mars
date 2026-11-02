import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  armPreludeBurn, PRELUDE_BURN_MEGACREDITS, preludeBurnOwed, releasePreludeBurn, seedPreludeBurnRewardHold,
} from '@/client/console/deckPick/preludeBurnReward';
import {resetRailRewards} from '@/client/console/resourceTransfer/railReward';
import {clearPanelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {activeAnimationHoldLabels} from '@/client/components/presentation/animationHold';
import {CardName} from '@/common/cards/CardName';

/*
 * PL-1469 · THE BURN PAYS FROM THE CARD THAT BURNT (P91 WG Project): the 15 M€ of a fizzled prelude wait on the rail
 * for a token off the burnt card's face — armed at the press, seeded on the answer that paid them, released if nobody
 * flies. Never a guess: the two views decide.
 */
describe('preludeBurnReward', () => {
  const view = (mc: number) => ({
    id: 'p-viewer',
    thisPlayer: {color: 'blue', terraformRating: 20, megacredits: mc, energy: 0, steel: 0, titanium: 0, plants: 0, heat: 0,
      megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0, plantProduction: 0, energyProduction: 0, heatProduction: 0},
  } as unknown as PlayerViewModel);

  beforeEach(() => {
    resetRailRewards();
    clearPanelRewardHold();
    releasePreludeBurn('test-reset');
  });
  after(() => {
    releasePreludeBurn('test-end');
    resetRailRewards();
    clearPanelRewardHold();
  });

  it('nothing armed, nothing held — an ordinary 15 M€ gain is never taken for a burn', () => {
    seedPreludeBurnRewardHold(view(0), view(15));
    expect(preludeBurnOwed()).is.false;
    expect(heldStock('megacredits')).eq(0);
  });

  it('armed: a frame that paid nothing yet keeps the promise OWED; the answer that paid 15 holds the row for the token', () => {
    armPreludeBurn('Huge Asteroid' as CardName);
    seedPreludeBurnRewardHold(view(0), view(0));
    expect(preludeBurnOwed(), 'a poll ahead of the answer holds nothing').is.false;
    seedPreludeBurnRewardHold(view(0), view(PRELUDE_BURN_MEGACREDITS));
    expect(preludeBurnOwed()).is.true;
    expect(heldStock('megacredits'), 'the row keeps its pre-burn value until the touchdown').eq(PRELUDE_BURN_MEGACREDITS);
    expect(activeAnimationHoldLabels().some((label) => label.startsWith('rail-reward'))).is.true;
  });

  it('a row that moved otherwise is not held (the views decide); the arm is spent either way', () => {
    armPreludeBurn('Huge Asteroid' as CardName);
    seedPreludeBurnRewardHold(view(0), view(7));
    expect(preludeBurnOwed()).is.false;
    expect(heldStock('megacredits')).eq(0);
    seedPreludeBurnRewardHold(view(7), view(22));
    expect(preludeBurnOwed(), 'the spent arm takes no later gain').is.false;
  });

  it('the flyer leaving releases the hold — the row ticks now, the blocking hold falls', () => {
    armPreludeBurn('Huge Asteroid' as CardName);
    seedPreludeBurnRewardHold(view(0), view(PRELUDE_BURN_MEGACREDITS));
    releasePreludeBurn('deck-pick-unmounted');
    expect(preludeBurnOwed()).is.false;
    expect(heldStock('megacredits')).eq(0);
    expect(activeAnimationHoldLabels().some((label) => label.startsWith('rail-reward'))).is.false;
  });
});
