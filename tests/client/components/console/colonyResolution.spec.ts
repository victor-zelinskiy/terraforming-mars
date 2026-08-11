/*
 * THE COLONY RESOLUTION — the Pluto flow controller's pure derivations.
 *
 * The one lifecycle rule under test: the resolution is LIVE from the trade
 * commit to the last owed input's physical settle, and no single leg's end
 * (an emptied reveal, an answered discard, a finished flight) may read as the
 * flow's end while a later leg is still owed. This is the spec of the close
 * gate that keeps the colony workspace the flow's ONE interaction owner.
 */
import {expect} from 'chai';
import {
  ColonyResolutionSignals,
  armColonyBonusEntry,
  clearColonyBonusEntry,
  colonyBonusEntry,
  colonyBonusEntryArmed,
  colonyResolutionColony,
  colonyResolutionLiveFor,
  colonyResolutionPhaseFor,
  colonyResolutionUi,
  noticeColonyResolutionDiscard,
  remoteColonyBonusPendingFor,
  resetColonyResolutionUi,
  revealColonyOf,
  revealIsOwnerBonus,
} from '@/client/console/colonyTrade/colonyResolution';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Color} from '@/common/Color';

const IDLE: ColonyResolutionSignals = {
  discardMeta: undefined,
  revealSource: undefined,
  tradeActive: false,
  tradeColony: '',
  discardFlightMeta: undefined,
  entryColony: '',
  claimedByColonies: false,
};

const incomeSource: CardDrawRevealSource = {
  type: 'colony', colonyName: ColonyName.PLUTO,
  trade: {tradeId: 'Pluto:g3:a10', role: 'income'},
};
const bonusSource: CardDrawRevealSource = {
  type: 'colony', colonyName: ColonyName.PLUTO,
  trade: {tradeId: 'Pluto:g3:a10', role: 'bonus'},
};
const meta = (index: number, total: number) =>
  ({colonyName: ColonyName.PLUTO, index, total});

describe('colonyResolution', () => {
  beforeEach(() => {
    clearColonyBonusEntry();
    resetColonyResolutionUi();
  });

  it('is idle with no signals', () => {
    expect(colonyResolutionLiveFor(IDLE)).to.eq(false);
    expect(colonyResolutionColony(IDLE)).to.eq('');
    expect(colonyResolutionPhaseFor(IDLE)).to.eq('idle');
  });

  it('spans the whole own-trade chain: every leg keeps it live', () => {
    // 1 · commit → income reveal on the table.
    const reveal = {...IDLE, tradeActive: true, tradeColony: 'Pluto', revealSource: incomeSource};
    expect(colonyResolutionLiveFor(reveal)).to.eq(true);
    expect(colonyResolutionPhaseFor(reveal)).to.eq('trade-reveal');
    // 2 · the batch was fully taken, the discard prompt stands — the gap that
    //     used to close the workspace («reveal empty» read as «flow over»).
    const discard = {...IDLE, tradeActive: true, tradeColony: 'Pluto', discardMeta: meta(1, 2)};
    expect(colonyResolutionLiveFor(discard)).to.eq(true);
    expect(colonyResolutionPhaseFor(discard)).to.eq('discard');
    // 3 · the answer is in, the card is physically leaving.
    const flight = {...IDLE, tradeActive: true, tradeColony: 'Pluto', discardFlightMeta: meta(1, 2)};
    expect(colonyResolutionLiveFor(flight)).to.eq(true);
    expect(colonyResolutionPhaseFor(flight)).to.eq('discard-flight');
    // 4 · the second cube's bonus batch.
    const bonus = {...IDLE, tradeActive: true, tradeColony: 'Pluto', revealSource: bonusSource};
    expect(colonyResolutionPhaseFor(bonus)).to.eq('owner-bonus');
    // 5 · everything answered; the track reset is still travelling.
    const tail = {...IDLE, tradeActive: true, tradeColony: 'Pluto'};
    expect(colonyResolutionLiveFor(tail)).to.eq(true);
    expect(colonyResolutionPhaseFor(tail)).to.eq('concluding');
    // 6 · the transaction concluded — only now the resolution ends.
    expect(colonyResolutionLiveFor(IDLE)).to.eq(false);
  });

  it('names its colony from the strongest live signal', () => {
    expect(colonyResolutionColony({...IDLE, tradeActive: true, tradeColony: 'Pluto'})).to.eq('Pluto');
    expect(colonyResolutionColony({...IDLE, discardMeta: meta(1, 1)})).to.eq('Pluto');
    expect(colonyResolutionColony({...IDLE, discardFlightMeta: meta(1, 1)})).to.eq('Pluto');
    expect(colonyResolutionColony({...IDLE, entryColony: 'Pluto'})).to.eq('Pluto');
    expect(colonyResolutionColony({...IDLE, revealSource: bonusSource})).to.eq('Pluto');
  });

  it('classifies the reveal source', () => {
    expect(revealColonyOf(incomeSource)).to.eq('Pluto');
    expect(revealColonyOf({type: 'card', cardName: 'AI Central'} as CardDrawRevealSource)).to.eq('');
    expect(revealIsOwnerBonus(bonusSource)).to.eq(true);
    expect(revealIsOwnerBonus(incomeSource)).to.eq(false);
  });

  describe('remote owner bonus (a foreign trade)', () => {
    it('waits for its entry while the viewer has not entered', () => {
      // The discard marker is the proof; no own transaction, no entry yet.
      const s = {...IDLE, discardMeta: meta(1, 1)};
      expect(remoteColonyBonusPendingFor(s)?.colonyName).to.eq('Pluto');
      // …with or without the batch beside it (they ride one response).
      const withBatch = {...IDLE, discardMeta: meta(1, 1), revealSource: bonusSource};
      expect(remoteColonyBonusPendingFor(withBatch)?.colonyName).to.eq('Pluto');
    });

    it('a bonus batch with NO discard marker is the auto-discard edge — never held', () => {
      // The owner's hand was too small for a choice: the server discarded
      // silently, no mandatory action exists, and no beat could ever open a
      // door — a hold here would park the batch forever.
      expect(remoteColonyBonusPendingFor({...IDLE, revealSource: bonusSource})).to.eq(undefined);
    });

    it('never holds the viewer\'s own trade, and releases on entry', () => {
      const own = {...IDLE, tradeActive: true, tradeColony: 'Pluto', discardMeta: meta(1, 1)};
      expect(remoteColonyBonusPendingFor(own)).to.eq(undefined);
      const entered = {...IDLE, discardMeta: meta(1, 1), entryColony: 'Pluto'};
      expect(remoteColonyBonusPendingFor(entered)).to.eq(undefined);
      // …and the entry keeps the resolution live between its legs.
      expect(colonyResolutionLiveFor({...IDLE, entryColony: 'Pluto'})).to.eq(true);
      expect(colonyResolutionPhaseFor({...IDLE, entryColony: 'Pluto'})).to.eq('owner-bonus');
    });

    it('the workspace\'s live CLAIM is ownership even after the transaction concluded', () => {
      // A trade whose track never moves (one colony, position 1 — built then
      // traded) concludes its transaction right after the chip/reveal beats,
      // BEFORE the mandatory discard. The claim the workspace keeps for the
      // resolution's whole span is what says «this flow already has an owner»
      // — classifying it as remote parked the batch and announced the
      // player's own flow to them (the caught e2e regression).
      const ownClaimed = {...IDLE, discardMeta: meta(1, 1), claimedByColonies: true};
      expect(remoteColonyBonusPendingFor(ownClaimed)).to.eq(undefined);
      // …while the resolution itself is still live for the workspace.
      expect(colonyResolutionLiveFor(ownClaimed)).to.eq(true);
    });

    it('a foreign INCOME batch is never an entry case', () => {
      // Another player's trade income reveal is not the viewer's business —
      // it would not even be on the viewer's view model; a bonus-role batch
      // is the only foreign colony batch that opens an entry.
      expect(remoteColonyBonusPendingFor({...IDLE, revealSource: incomeSource})).to.eq(undefined);
    });
  });

  it('the entry context arms and clears', () => {
    armColonyBonusEntry('Pluto' as ColonyName, {color: 'red' as Color, name: 'admin'});
    expect(colonyBonusEntryArmed()).to.eq(true);
    expect(colonyBonusEntry.traderName).to.eq('admin');
    clearColonyBonusEntry();
    expect(colonyBonusEntryArmed()).to.eq(false);
    expect(colonyBonusEntry.traderColor).to.eq('');
  });

  it('the discard receipt counts and resets', () => {
    noticeColonyResolutionDiscard();
    noticeColonyResolutionDiscard();
    expect(colonyResolutionUi.discarded).to.eq(2);
    resetColonyResolutionUi();
    expect(colonyResolutionUi.discarded).to.eq(0);
  });
});
