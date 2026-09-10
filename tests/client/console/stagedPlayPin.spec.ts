import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';
import {
  armStagedPlay,
  armStagedSeal,
  beginStagedPin,
  clearStagedPlay,
  resolveStagedPinDropped,
  resolveStagedPinLanded,
  runStagedSealWave,
  seedStagedPlayRewardHold,
  stagedPinState,
  stagedSealPending,
} from '@/client/console/stagedPlay';
import {panelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';

/**
 * THE PARKED PIN — the client half of the interleaved-placement class.
 *
 * A staged commit's response can come back WITHOUT the tile: a threshold
 * bonus ocean jumped the queue and the server PARKED the addressed cell
 * (`stagedPlacementPending`). Until the pin resolves, the card-seal wave is
 * OWED, not spent: firing it early is exactly the shipped bug — the card's
 * rewards flying out of an EMPTY hex (and, one prompt later, out of the
 * bonus ocean's tile). A dropped pin releases the held counters honestly.
 */
describe('stagedPlay — the parked pin', () => {
  const REWARD = {channel: 'stock' as const, resource: 'megacredits', amount: 3};

  function armWithReward() {
    armStagedPlay({
      flow: 'play',
      cardName: CardName.NUCLEAR_ZONE,
      isEvent: false,
      batch: [],
      placement: {title: '', spaces: [], sourceCard: CardName.NUCLEAR_ZONE, tileType: TileType.NUCLEAR_ZONE},
      rewards: [REWARD],
      draws: 0,
      deckCheck: false,
      yieldedStack: false,
    });
    armStagedSeal('05');
    seedStagedPlayRewardHold();
  }

  afterEach(() => {
    // Module state is bundle-shared: leave nothing armed for later specs.
    stagedPinState.pin = undefined;
    resolveStagedPinDropped();
    clearStagedPlay();
  });

  it('the seal wave is HELD while the pin is parked — never consumed early', async () => {
    armWithReward();
    expect(panelRewardHold.stock['megacredits'], 'the hold is seeded').eq(3);
    beginStagedPin({cardName: CardName.NUCLEAR_ZONE, spaceId: '05', tileType: TileType.NUCLEAR_ZONE});

    await runStagedSealWave();

    expect(stagedSealPending(), 'the wave stays owed').is.true;
    expect(panelRewardHold.stock['megacredits'], 'the hold stands').eq(3);
  });

  it('a DROPPED pin releases the held rewards honestly (counters tick, no flight)', async () => {
    armWithReward();
    beginStagedPin({cardName: CardName.NUCLEAR_ZONE, spaceId: '05', tileType: TileType.NUCLEAR_ZONE});
    await runStagedSealWave();

    resolveStagedPinDropped();

    expect(stagedSealPending()).is.false;
    expect(panelRewardHold.stock['megacredits']).is.undefined;
    expect(stagedPinState.pin).is.undefined;
  });

  it('a LANDED pin frees the wave — it consumes the seal and releases the holds', async () => {
    armWithReward();
    beginStagedPin({cardName: CardName.NUCLEAR_ZONE, spaceId: '05', tileType: TileType.NUCLEAR_ZONE});
    resolveStagedPinLanded();

    // No board in jsdom → the wave degrades to an honest immediate release.
    await runStagedSealWave();

    expect(stagedSealPending()).is.false;
    expect(panelRewardHold.stock['megacredits']).is.undefined;
  });
});
