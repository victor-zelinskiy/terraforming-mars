import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Resource} from '@/common/Resource';
import {CardModel} from '@/common/models/CardModel';
import {ColonyTradeManifestModel} from '@/common/models/ColonyTradeManifestModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {TradeReceiptBase, tradeReceiptBaseOf} from '@/client/console/colonyTrade/colonyTradeReceipt';
import {
  abortColonyTrade, armColonyTrade, colonyTradeReceiptBase, detectColonyTrade,
  noteColonyTradeReceiptBase, resetColonyTrade,
} from '@/client/console/colonyTrade/consoleColonyTrade';

/**
 * THE TRADE RECEIPT'S BASE. Past the commit the colony stage is a receipt of
 * the move that was made, and every `current → resulting` in it («ВАШ ИТОГ»,
 * «ОПЛАТА», the card-target lines) must be measured from the state AS THE
 * PLAYER PRESSED — the live model already holds the paid fee and the credited
 * income once the answer lands (Callisto's «+2 энергии, 4 → 6» read «6 → 8»).
 */

function player(over: Partial<Record<string, unknown>> = {}): PublicPlayerModel {
  return {
    color: 'red',
    megacredits: 20, steel: 1, titanium: 2, plants: 3, energy: 4, heat: 5,
    megacreditProduction: 6, steelProduction: 7, titaniumProduction: 8,
    plantProduction: 9, energyProduction: 10, heatProduction: 11,
    tableau: [],
    ...over,
  } as unknown as PublicPlayerModel;
}

function card(name: string, resources?: number): CardModel {
  return {name: name as CardName, resources} as CardModel;
}

function manifest(): ColonyTradeManifestModel {
  return {
    tradeId: 'Callisto:g1:a7',
    colonyName: ColonyName.CALLISTO,
    trader: 'red',
    generation: 1,
    preTradeTrackPosition: 1,
    postTradeTrackPosition: 0,
    tradeIncome: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 2, resource: Resource.ENERGY},
    colonyBonus: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 3, resource: Resource.ENERGY},
    bonusRecipients: [],
  };
}

function view(m: ColonyTradeManifestModel): PlayerViewModel {
  return {colonyTradeManifest: m} as unknown as PlayerViewModel;
}

const BASE: TradeReceiptBase = {stocks: {energy: 4}, production: {}, cardResources: {}};

describe('colonyTradeReceipt', () => {
  beforeEach(() => resetColonyTrade());
  afterEach(() => resetColonyTrade());

  describe('tradeReceiptBaseOf — the base read off the live models', () => {
    it('takes the viewer\'s six stocks and six productions', () => {
      const base = tradeReceiptBaseOf(player(), []);
      expect(base.stocks).deep.eq({megacredits: 20, steel: 1, titanium: 2, plants: 3, energy: 4, heat: 5});
      expect(base.production).deep.eq({megacredits: 6, steel: 7, titanium: 8, plants: 9, energy: 10, heat: 11});
    });

    it('takes every seat\'s card resources by name — the first holder wins, a bare card reads 0', () => {
      const red = player({tableau: [card('Jovian Lanterns', 2), card('Birds')]});
      const blue = player({color: 'blue', tableau: [card('Jovian Lanterns', 9), card('Fish', 4)]});
      const base = tradeReceiptBaseOf(red, [red, blue]);
      expect(base.cardResources).deep.eq({'Jovian Lanterns': 2, 'Birds': 0, 'Fish': 4});
    });

    it('no viewer → no stocks to measure, the cards still known', () => {
      const red = player({tableau: [card('Birds', 1)]});
      expect(tradeReceiptBaseOf(undefined, [red])).deep.eq({stocks: {}, production: {}, cardResources: {'Birds': 1}});
    });
  });

  describe('the transaction remembers the base for a stage that mounts mid-resolution', () => {
    it('is noted BEFORE the arm (the shell pins the stage, then arms) and the arm keeps it', () => {
      noteColonyTradeReceiptBase(ColonyName.CALLISTO, BASE);
      armColonyTrade(ColonyName.CALLISTO, 'red');
      // Not claimed yet: the live view IS the pre-trade view — the caller reads it.
      expect(colonyTradeReceiptBase(ColonyName.CALLISTO)).eq(undefined);
      expect(detectColonyTrade(view(manifest()))).not.eq(undefined);
      // The answer is claimed: the live view now holds the payout, the memory is the truth.
      expect(colonyTradeReceiptBase(ColonyName.CALLISTO)).eq(BASE);
    });

    it('answers only for the colony being traded', () => {
      noteColonyTradeReceiptBase(ColonyName.CALLISTO, BASE);
      armColonyTrade(ColonyName.CALLISTO, 'red');
      detectColonyTrade(view(manifest()));
      expect(colonyTradeReceiptBase(ColonyName.LUNA)).eq(undefined);
    });

    it('a base noted for another colony is never handed to this trade', () => {
      noteColonyTradeReceiptBase(ColonyName.LUNA, BASE);
      armColonyTrade(ColonyName.CALLISTO, 'red');
      detectColonyTrade(view(manifest()));
      expect(colonyTradeReceiptBase(ColonyName.CALLISTO)).eq(undefined);
    });

    it('nothing is remembered without a live transaction, and an abort forgets it', () => {
      noteColonyTradeReceiptBase(ColonyName.CALLISTO, BASE);
      expect(colonyTradeReceiptBase(ColonyName.CALLISTO), 'no transaction').eq(undefined);
      armColonyTrade(ColonyName.CALLISTO, 'red');
      detectColonyTrade(view(manifest()));
      abortColonyTrade();
      // A NEXT trade on the same colony, with no fresh note, must not inherit
      // it — asked past ITS OWN claimed answer, where a memory would be read.
      armColonyTrade(ColonyName.CALLISTO, 'red');
      expect(detectColonyTrade(view({...manifest(), tradeId: 'Callisto:g1:a8'}))).not.eq(undefined);
      expect(colonyTradeReceiptBase(ColonyName.CALLISTO)).eq(undefined);
    });
  });
});
