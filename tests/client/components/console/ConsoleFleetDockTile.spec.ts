import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import ConsoleFleetDockTile from '@/client/components/console/ConsoleFleetDockTile.vue';
import {FleetDockTileStatus, FleetDockView} from '@/client/console/colonyTrade/fleetDockModel';

/*
 * THE DOCK IS ONE MORE TILE (the owner, 2026-10-25 — docs/TURMOIL_REDUX_WATER_HAULING.md § 8c): the colony tile's
 * chassis, the CARD where the planet stands, the «ТОРГОВАТЬ» cell printing what the trade gives, the colony tile's
 * status line. What this spec owns: the family's classes and hooks; the frames are the e2e probes'.
 */
function mountTile(card: CardName, status: FleetDockTileStatus, dockedColor?: 'blue') {
  const dock: FleetDockView = {card, model: {name: card} as CardModel, dockedColor, offer: undefined};
  return mount(ConsoleFleetDockTile, {
    global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: {template: '<div class="pcard-stub"></div>'}}},
    props: {dock, status, focused: true},
  });
}

describe('ConsoleFleetDockTile — a tile of the colony family', () => {
  it('wears the colony tile\'s chassis and cursor, and keeps the dock\'s own hooks', () => {
    const tile = mountTile(CardName.WATER_HAULING, {kind: 'free', text: 'Dock free'});
    const root = tile.find('.con-coltile');
    expect(root.classes()).to.include.members(['con-coltile--dock', 'con-fleetdock-tile', 'con-coltile--focused', 'con-coltile--ok']);
    expect(root.attributes('data-fleet-dock')).eq(CardName.WATER_HAULING);
    expect(root.attributes('data-fleet-dock-status')).eq('free');
    expect(tile.find('.con-coltile__head .con-coltile__name').text()).to.contain(CardName.WATER_HAULING);
  });

  it('the CARD stands where the planet stands — the FLIP\'s twin and the viewer\'s slot', () => {
    const face = mountTile(CardName.UNMI_LINER, {kind: 'free', text: 'Dock free'}).find('[data-fleet-dock-face]');
    expect(face.exists()).is.true;
    expect(face.attributes('data-zoom-slot')).eq(CardName.UNMI_LINER);
    expect(face.find('.pcard-stub').exists()).is.true;
  });

  it('the «ТОРГОВАТЬ» cell prints what the trade gives, in the card\'s own print', () => {
    const cell = mountTile(CardName.AURORA_STATION, {kind: 'free', text: 'Dock free'}).find('[data-fleet-dock-reward]');
    expect(cell.classes()).to.include.members(['con-coltile__cell', 'con-coltile__cell--trade']);
    expect(cell.find('.con-coltile__cell-label').text()).eq('Trade');
    expect(cell.findAll('.pcard-mi').length, 'two floaters').to.be.at.least(2);
    expect(cell.find('.pcard-prod').exists(), 'and the production plate').is.true;
  });

  it('the status line is the colony tile\'s: free · the fleet on the card · the reason', () => {
    expect(mountTile(CardName.WATER_HAULING, {kind: 'free', text: 'Dock free'}).find('.con-coltile__status').classes()).to.include('con-coltile__status--ok');
    const docked = mountTile(CardName.WATER_HAULING, {kind: 'docked', text: 'long', short: 'Fleet on the card'}, 'blue');
    expect(docked.find('.con-coltile__status').classes()).to.include('con-coltile__status--inactive');
    expect(docked.find('.con-fleetdock-tile__status-text').text(), 'the short form in the tile').eq('Fleet on the card');
    expect(docked.find('.con-fleetdock-tile__status-ship').exists(), 'the ship in its owner\'s livery').is.true;
    const blocked = mountTile(CardName.WATER_HAULING, {kind: 'blocked', text: 'No ocean left'});
    expect(blocked.find('.con-coltile__status').classes()).to.include('con-coltile__status--blocked');
    expect(blocked.find('.con-coltile').classes()).to.include('con-coltile--blocked');
  });
});
