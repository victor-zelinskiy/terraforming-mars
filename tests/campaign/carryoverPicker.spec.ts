import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {carryoverAskText, carryoverBandText, carryoverPreludeAskText, carryoverSeats} from '../../src/client/console/campaign/carryoverPicker';
import {buildCampaignMapVm} from '../../src/client/console/campaign/campaignMapModel';

/*
 * «Наследие проектов» — the pure readings of the step (P87): the manifest of seats, the question line and a kept
 * card's band all read the SEAT's limit, never a constant; the map's view-model hands that limit down from the model.
 */
describe('carryoverPicker — the readings of the seat limit (P87)', () => {
  it('the manifest: one place per seat, filled in pick order; an empty seat is its number', () => {
    expect(carryoverSeats(2, [])).deep.eq([{n: 1}, {n: 2}]);
    expect(carryoverSeats(2, [CardName.ANTS])).deep.eq([{n: 1, name: CardName.ANTS}, {n: 2}]);
    expect(carryoverSeats(3, [CardName.ANTS, CardName.BIRDS])).deep.eq([{n: 1, name: CardName.ANTS}, {n: 2, name: CardName.BIRDS}, {n: 3}]);
    expect(carryoverSeats(1, [CardName.ANTS])).deep.eq([{n: 1, name: CardName.ANTS}]);
    expect(carryoverSeats(0, [])).deep.eq([]);
  });

  it('a returned card frees its seat and the next card moves up (the seat IS the order)', () => {
    expect(carryoverSeats(2, [CardName.BIRDS])).deep.eq([{n: 1, name: CardName.BIRDS}, {n: 2}]);
  });

  it('the question line carries the limit and the mission as PARAMETERS', () => {
    expect(carryoverAskText(2, 3)).include('2').include('3');
    expect(carryoverAskText(5, 2)).include('5');
    expect(carryoverAskText(0, 2)).include('2').not.include('${');
  });

  it('«Тендеры»: the LAST seats of the limit are the TENDER seats («Расширенное наследие») — marked, never a second limit', () => {
    expect(carryoverSeats(3, [], 1)).deep.eq([{n: 1}, {n: 2}, {n: 3, tender: true}]);
    expect(carryoverSeats(4, [CardName.ANTS], 2)).deep.eq([{n: 1, name: CardName.ANTS}, {n: 2}, {n: 3, tender: true}, {n: 4, tender: true}]);
    // A kept card fills the tender seat like any other — the mark stays on the place, not on the card.
    expect(carryoverSeats(3, [CardName.ANTS, CardName.BIRDS, CardName.FISH], 1)[2]).deep.eq({n: 3, name: CardName.FISH, tender: true});
    // No tender seats (a titles campaign, the default): the manifest is unchanged.
    expect(carryoverSeats(2, [])).deep.eq([{n: 1}, {n: 2}]);
    expect(carryoverSeats(2, [], 5)).deep.eq([{n: 1, tender: true}, {n: 2, tender: true}]);
  });

  it('the prelude band\'s ask («Продление программы») carries the allowance and the mission as PARAMETERS', () => {
    expect(carryoverPreludeAskText(1, 3)).include('1').include('3').not.include('${');
  });

  it('a kept card\'s band names the mission and its seat', () => {
    const band = carryoverBandText(2, 1);
    expect(band.startsWith('✓ ')).is.true;
    expect(band).include('2').include('1').not.include('${');
  });
});

describe('campaignMapModel — yourCarryLimit is the model\'s number (P87)', () => {
  function vmWith(carryover: unknown) {
    const model = {
      id: 'c', rev: 1, name: 'Camp', createdTimeMs: 0, phase: 'interlude', pointer: 1,
      seats: [{seat: 0, kind: 'human', name: 'Alice', color: 'blue', trBoost: 0}],
      you: {seat: 0},
      missions: [
        {slot: 0, board: 'tharsis', state: 'committed', modifiers: []},
        {slot: 1, board: 'hellas', state: 'ready', modifiers: []},
        {slot: 2, board: 'elysium', state: 'locked', modifiers: []},
        {slot: 3, board: 'utopia planitia', state: 'locked', modifiers: []},
      ],
      progression: {lineages: {}, titles: [], titlePoints: {0: 0}, pendingBonuses: {}},
      carryover,
      canLaunch: false, launchBlockers: [],
    };
    return buildCampaignMapVm(model as never);
  }

  it('reads `yourLimit` off the carryover model', () => {
    expect(vmWith({sourceSlot: 0, bySeat: [{seat: 0, status: 'pending', count: 0, limit: 3}], yourCards: [], yourEligible: [], yourLimit: 3})?.yourCarryLimit).eq(3);
  });

  it('no window, no limit: 0 (the client never invents the default)', () => {
    expect(vmWith(undefined)?.yourCarryLimit).eq(0);
  });

  it('«Тендеры»: the tender seats, the played preludes, the prelude allowance and the selection come off the model; absent → none', () => {
    const vm = vmWith({
      sourceSlot: 0, bySeat: [{seat: 0, status: 'pending', count: 0, limit: 3}], yourCards: [], yourEligible: [], yourLimit: 3,
      yourTenderSeats: 1, yourEligiblePreludes: [CardName.ALLIED_BANK, CardName.BIOFUELS], yourPreludeLimit: 1, yourPreludes: [CardName.BIOFUELS],
    });
    expect(vm?.yourTenderSeats).eq(1);
    expect(vm?.yourEligiblePreludes).deep.eq([CardName.ALLIED_BANK, CardName.BIOFUELS]);
    expect(vm?.yourPreludeLimit).eq(1);
    expect(vm?.yourPreludes).deep.eq([CardName.BIOFUELS]);
    const plain = vmWith({sourceSlot: 0, bySeat: [{seat: 0, status: 'pending', count: 0, limit: 2}], yourCards: [], yourEligible: [], yourLimit: 2});
    expect(plain?.yourTenderSeats).eq(0);
    expect(plain?.yourEligiblePreludes).deep.eq([]);
    expect(plain?.yourPreludeLimit).eq(0);
    expect(plain?.yourPreludes).deep.eq([]);
  });
});
