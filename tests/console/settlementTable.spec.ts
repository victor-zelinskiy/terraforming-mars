import {expect} from 'chai';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {
  armSettlementTable, clearSettlementTable, noteSettlementDealt, noteSettlementPresented, noteSettlementTaken,
  oweSettlementTurn, sealedPlaceReading, sealedPlacesOf, sealOpensAfter, settlementArrival, settlementClaimsBatch,
  settlementOwnsBatch, settlementPlacePaint, settlementPlacesToDeal, settlementStageReading, settlementTable,
} from '../../src/client/console/colonyTrade/settlementTable';
import {resolveCardArrivalMode, sealedRevealPlan, cardArrivalTimings, reducedCardArrivalTimings} from '../../src/client/console/consoleCardArrival';
import {bonusZones} from '../../src/client/console/colonyTrade/colonyBonusDiscardStep';
import {colonyBonusFreshFor, discardStageStrandedFor} from '../../src/client/console/colonyTrade/colonyResolution';
import {tradeCoverPlan, tradeIncomeLine} from '../../src/client/console/colonyTrade/colonyTradeModel';
import {ALL_COLONIES_TILES} from '../../src/server/colonies/ColonyManifest';
import {ColonyMetadata} from '../../src/common/colonies/ColonyMetadata';

function getColonyMetadata(name: ColonyName): ColonyMetadata {
  const entry = ALL_COLONIES_TILES.find((e) => e.colonyName === name);
  if (entry === undefined) {
    throw new Error('no colony ' + name);
  }
  return new entry.Factory().metadata;
}

/*
 * THE SETTLEMENT TABLE (colony polish 1) — several settlements on Pluto, «draw 1, then discard 1» per settlement,
 * shown as ONE table of k places: the later places' cards are dealt face-down under a seal with the first payout,
 * never fly again, and turn over IN PLACE when the server's marker reaches them.
 */
describe('settlementTable', () => {
  const meta = (index: number, total: number) => ({colonyName: ColonyName.PLUTO, index, total});
  const pluto = (tradeRole: 'bonus' | 'income' = 'bonus') =>
    ({type: 'colony' as const, colonyName: ColonyName.PLUTO, trade: {tradeId: 't', role: tradeRole}});

  afterEach(() => clearSettlementTable());

  describe('the table lifecycle (one instance per resolution)', () => {
    it('arms only for SEVERAL settlements, keeps its instance across cycles, and starts fresh for another colony', () => {
      armSettlementTable(ColonyName.PLUTO, 1, 1);
      expect(settlementTable.nonce, 'a single settlement keeps the old words — no table').to.eq(0);
      armSettlementTable(ColonyName.PLUTO, 2, 1);
      const first = settlementTable.nonce;
      expect(first).to.be.greaterThan(0);
      armSettlementTable(ColonyName.PLUTO, 2, 2);
      expect(settlementTable.nonce, 'the next cycle is accepted INTO the same table').to.eq(first);
      expect(settlementTable.index).to.eq(2);
      armSettlementTable(ColonyName.MIRANDA, 2, 1);
      expect(settlementTable.nonce, 'another colony is another table').to.not.eq(first);
      expect(settlementTable.dealt).to.deep.eq([]);
    });

    it('clamps a degenerate ordinal into the table', () => {
      armSettlementTable(ColonyName.PLUTO, 3, 9);
      expect(settlementTable.index).to.eq(3);
    });

    it('the first payout deals the later places — and only them, once', () => {
      armSettlementTable(ColonyName.PLUTO, 3, 1);
      expect(settlementPlacesToDeal(ColonyName.PLUTO)).to.deep.eq([2, 3]);
      noteSettlementDealt([2, 3]);
      expect(settlementPlacesToDeal(ColonyName.PLUTO), 'never dealt twice').to.deep.eq([]);
      armSettlementTable(ColonyName.PLUTO, 3, 2);
      expect(settlementPlacesToDeal(ColonyName.PLUTO), 'a later cycle deals nothing').to.deep.eq([]);
      expect(settlementPlacesToDeal(ColonyName.LUNA), 'another colony deals nothing').to.deep.eq([]);
    });
  });

  describe('who owns the arrival of a batch (one object, one turn)', () => {
    it('the FIRST payout is the deal itself — never the table\'s', () => {
      expect(settlementOwnsBatch(meta(1, 2), pluto())).to.eq(false);
      expect(settlementArrival(meta(1, 2), pluto(), {colony: ColonyName.PLUTO, dealt: [2]})).to.eq('door');
    });

    it('a later place the table dealt TURNS in place; one it never laid is simply SHOWN', () => {
      expect(settlementArrival(meta(2, 2), pluto(), {colony: ColonyName.PLUTO, dealt: [2]})).to.eq('turn');
      expect(settlementArrival(meta(2, 2), pluto(), {colony: ColonyName.PLUTO, dealt: []}), 'a reload: no deal, no turn').to.eq('shown');
    });

    it('never claims a single settlement, another colony or a CARD\'s payout (`via` — the ledger\'s)', () => {
      expect(settlementOwnsBatch(meta(1, 1), pluto())).to.eq(false);
      expect(settlementOwnsBatch(meta(2, 2), {type: 'colony', colonyName: ColonyName.LUNA})).to.eq(false);
      expect(settlementOwnsBatch(meta(2, 2), {type: 'colony', colonyName: ColonyName.PLUTO, via: 'Habitat Science' as never})).to.eq(false);
      expect(settlementOwnsBatch(meta(2, 2), {type: 'card', cardName: 'Research' as never})).to.eq(false);
    });

    it('the scenes ask the SAME question of the module (armed from the marker before they run)', () => {
      armSettlementTable(ColonyName.PLUTO, 2, 1);
      expect(settlementClaimsBatch(pluto()), 'cycle 1 is the trade\'s deal').to.eq(false);
      armSettlementTable(ColonyName.PLUTO, 2, 2);
      expect(settlementClaimsBatch(pluto()), 'cycle 2 is the table\'s').to.eq(true);
      expect(settlementClaimsBatch({type: 'colony', colonyName: ColonyName.LUNA})).to.eq(false);
    });

    it('the fourth arrival mode is chosen by the SEQUENCE, never by the clock', () => {
      expect(resolveCardArrivalMode({kinds: ['draw'], dataReady: true, sealedPlace: true})).to.eq('sealed-reveal');
      expect(resolveCardArrivalMode({kinds: ['draw'], dataReady: false, sealedPlace: true})).to.eq('sealed-reveal');
      expect(resolveCardArrivalMode({kinds: ['draw'], dataReady: false}), 'a late answer stays a late answer').to.eq('awaiting-data');
      const plan = sealedRevealPlan(cardArrivalTimings());
      expect(plan.dwellMs).to.be.greaterThan(0);
      expect(plan.turnMs).to.be.greaterThan(cardArrivalTimings().turnMs - 1);
      const reduced = sealedRevealPlan(reducedCardArrivalTimings());
      expect(reduced.turnMs, 'reduced motion still TURNS (a swap is the artefact)').to.be.greaterThan(0);
      expect(reduced.totalMs).to.be.lessThan(plan.totalMs);
    });
  });

  describe('what each place paints', () => {
    const t = (dealt: Array<number>, turnPlace = 0, turnPhase: 'none' | 'owed' | 'turning' | 'done' = 'none') =>
      ({dealt, turnPlace, turnPhase});

    it('cycle 1: the current place is open, the later ones lie sealed once dealt (pending while their cover flies)', () => {
      expect(settlementPlacePaint(1, 1, 'present', t([]))).to.eq('open');
      expect(settlementPlacePaint(2, 1, 'absent', t([])), 'cover still in the air').to.eq('pending');
      expect(settlementPlacePaint(2, 1, 'absent', t([2]))).to.eq('sealed');
    });

    it('cycle 1 taken: the socket keeps a ✓ through the park (the discard is owed)', () => {
      expect(settlementPlacePaint(1, 1, 'taken', t([2]))).to.eq('taken');
    });

    it('cycle 2: the earlier place is done, the current one turns before it opens', () => {
      expect(settlementPlacePaint(1, 2, 'absent', t([2]))).to.eq('done');
      expect(settlementPlacePaint(2, 2, 'absent', t([2])), 'its card not on screen yet: still lying face-down').to.eq('sealed');
      expect(settlementPlacePaint(2, 2, 'present', t([2], 2, 'owed'))).to.eq('turning');
      expect(settlementPlacePaint(2, 2, 'present', t([2], 2, 'turning'))).to.eq('turning');
      expect(settlementPlacePaint(2, 2, 'present', t([2], 2, 'done'))).to.eq('open');
    });

    it('a place the table never laid is an empty socket while its card is absent — never a ✓', () => {
      expect(settlementPlacePaint(2, 2, 'absent', t([]))).to.eq('empty');
    });
  });

  describe('the words the table speaks', () => {
    it('the seal names the bonus before it', () => {
      expect(sealOpensAfter(2)).to.eq(1);
      expect(sealOpensAfter(3)).to.eq(2);
      expect(sealedPlaceReading(3, 3)).to.deep.eq({
        label: 'Colony bonus ${0} of ${1} · opens after the discard for bonus ${2}', params: ['3', '3', '2'],
      });
    });

    it('the crumb carries the ordinal for several settlements and keeps the old words for one', () => {
      expect(settlementStageReading('bonus', meta(1, 2))).to.deep.eq({label: 'Bonus ${0} of ${1}', params: ['1', '2']});
      expect(settlementStageReading('discard', meta(2, 2))).to.deep.eq({label: 'Discard ${0} of ${1}', params: ['2', '2']});
      expect(settlementStageReading('bonus', meta(1, 1))).to.eq(undefined);
    });

    it('the sealed places of a marker', () => {
      expect(sealedPlacesOf(meta(1, 3))).to.deep.eq([2, 3]);
      expect(sealedPlacesOf(meta(3, 3))).to.deep.eq([]);
      expect(sealedPlacesOf(meta(1, 1))).to.deep.eq([]);
    });

    it('the zones call a later place SEALED', () => {
      expect(bonusZones(meta(1, 3)).map((z) => z.state)).to.deep.eq(['active', 'sealed', 'sealed']);
    });
  });

  describe('memory across the park', () => {
    it('remembers what the screen showed — taken, presented, the owed turn — and forgets it with the resolution', () => {
      armSettlementTable(ColonyName.PLUTO, 2, 1);
      noteSettlementPresented();
      noteSettlementTaken(1);
      oweSettlementTurn(2);
      expect(settlementTable.presented).to.eq(true);
      expect(settlementTable.taken).to.deep.eq([1]);
      expect([settlementTable.turnPlace, settlementTable.turnPhase]).to.deep.eq([2, 'owed']);
      clearSettlementTable();
      expect(settlementTable.nonce).to.eq(0);
      expect(settlementTable.taken).to.deep.eq([]);
      expect(settlementTable.presented).to.eq(false);
    });
  });

  describe('the cover plan deals the later places with the first payout', () => {
    it('one cover per settlement: the real bonus card first, the sealed places after it, in ONE bonus fan', () => {
      const plan = tradeCoverPlan(3, [{role: 'income', count: 2}, {role: 'bonus', count: 1}], [2, 3]);
      expect(plan.map((p) => [p.role, p.index, p.sealedPlace ?? 0])).to.deep.eq([
        ['income', 0, 0], ['income', 1, 0], ['bonus', 2, 0], ['bonus', -1, 2], ['bonus', -1, 3],
      ]);
      const bonus = plan.filter((p) => p.role === 'bonus');
      expect(bonus.map((p) => p.fanCount), 'the printed «×3» peels into three').to.deep.eq([3, 3, 3]);
      expect(bonus.map((p) => p.fanIndex)).to.deep.eq([0, 1, 2]);
      for (let i = 1; i < plan.length; i++) {
        expect(plan[i].delayMs, 'one continuous deal — every cover departs after the one before').to.be.greaterThan(plan[i - 1].delayMs);
      }
    });

    it('without sealed places the plan is byte-identical to before', () => {
      const segments = [{role: 'income' as const, count: 2}, {role: 'bonus' as const, count: 1}];
      expect(tradeCoverPlan(3, segments, [])).to.deep.eq(tradeCoverPlan(3, segments));
      expect(tradeCoverPlan(3, segments).some((p) => p.sealedPlace !== undefined)).to.eq(false);
    });
  });

  describe('discardStageStrandedFor — the net knows WHICH cycle the discard stage serves', () => {
    const base = {discardStage: true, stageIndex: 1, restorePending: false, handStands: false, marker: undefined, flight: false};

    it('a stage the server no longer asks for at all is stranded', () => {
      expect(discardStageStrandedFor(base)).to.eq(true);
    });

    it('…and so is one whose cycle was answered while the NEXT cycle\'s marker already stands (the fixme: 10 of 10)', () => {
      expect(discardStageStrandedFor({...base, marker: meta(2, 2)})).to.eq(true);
    });

    it('a stage still serving its own cycle, a standing hand, a flight or a return in flight is not stranded', () => {
      expect(discardStageStrandedFor({...base, marker: meta(1, 2)})).to.eq(false);
      expect(discardStageStrandedFor({...base, handStands: true})).to.eq(false);
      expect(discardStageStrandedFor({...base, flight: true})).to.eq(false);
      expect(discardStageStrandedFor({...base, restorePending: true})).to.eq(false);
      expect(discardStageStrandedFor({...base, discardStage: false})).to.eq(false);
    });

    it('an older caller with no index keeps the old reading (a marker of any cycle holds it)', () => {
      expect(discardStageStrandedFor({...base, stageIndex: 0, marker: meta(2, 2)})).to.eq(false);
    });
  });

  describe('К-2 · the trade line AT THE MARKER (never the tile\'s variable)', () => {
    const DRAW = 'Draw ${0} card(s)';

    it('a card draw reads its number at the marker', () => {
      const pluto = getColonyMetadata(ColonyName.PLUTO);
      expect(tradeIncomeLine(pluto, 1)).to.deep.eq({label: DRAW, params: ['1']});
      expect(tradeIncomeLine(pluto, 4)).to.deep.eq({label: DRAW, params: ['3']});
      expect(tradeIncomeLine(pluto, 99), 'clamped to the printed track').to.deep.eq({label: DRAW, params: ['4']});
    });

    it('…the Redux Pluto reads its number only on the cells that DRAW, and every other income keeps its printed line', () => {
      const redux = getColonyMetadata(ColonyName.PLUTO_REDUX);
      expect(tradeIncomeLine(redux, 0).label).to.eq(redux.trade.description);
      expect(tradeIncomeLine(redux, redux.trade.quantity.length - 1).label).to.eq(DRAW);
      const luna = getColonyMetadata(ColonyName.LUNA);
      expect(tradeIncomeLine(luna, 3)).to.deep.eq({label: luna.trade.description, params: []});
    });
  });

  describe('К-4 · the card the bonus just brought in is marked in the hand for THAT cycle only', () => {
    const fresh = {colony: ColonyName.PLUTO as string, index: 1, names: ['Algae']};

    it('marks it while its own cycle\'s discard is asked', () => {
      expect(colonyBonusFreshFor(fresh, {colonyName: ColonyName.PLUTO, index: 1}, 'Algae')).to.eq(true);
    });

    it('never in the next cycle, on another colony, for another card or with no discard', () => {
      expect(colonyBonusFreshFor(fresh, {colonyName: ColonyName.PLUTO, index: 2}, 'Algae')).to.eq(false);
      expect(colonyBonusFreshFor(fresh, {colonyName: ColonyName.MIRANDA, index: 1}, 'Algae')).to.eq(false);
      expect(colonyBonusFreshFor(fresh, {colonyName: ColonyName.PLUTO, index: 1}, 'Birds')).to.eq(false);
      expect(colonyBonusFreshFor(fresh, undefined, 'Algae')).to.eq(false);
    });
  });
});
