import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import ConsoleFleetDockTile from '@/client/components/console/ConsoleFleetDockTile.vue';
import {FleetDockTileStatus, FleetDockView} from '@/client/console/colonyTrade/fleetDockModel';

/*
 * THE DOCK IS ONE MORE CELL OF THE COLONY GRID, IN THE COLONY TILE'S LANGUAGE (the owner, 2026-10-25 + ledger EZ,
 * 2026-11-03 — docs/TURMOIL_REDUX_WATER_HAULING.md § 8c): the colony tile's chassis row for row — the name on one
 * line with the «ПРИЧАЛ» mark and a ROUND art medallion where the planet stands, the STATUS strip where the track
 * stands (a word on a kant, never a dot), «ТОРГОВАТЬ» printing what the trade gives in the colony's own cell, the
 * «БОНУС» place an empty dim «—». What this spec owns: the family's classes and hooks; the frames are the e2e probes'.
 */
function mountTile(card: CardName, status: FleetDockTileStatus, dockedColor?: 'blue') {
  const dock: FleetDockView = {card, model: {name: card} as CardModel, dockedColor, offer: undefined};
  return mount(ConsoleFleetDockTile, {
    ...globalConfig,
    props: {dock, status, focused: true},
  });
}

describe('ConsoleFleetDockTile — a cell of the colony grid, in the colony tile\'s language', () => {
  it('wears the colony tile\'s chassis and cursor, and keeps the dock\'s own hooks', () => {
    const tile = mountTile(CardName.WATER_HAULING, {kind: 'free', text: 'Dock free'});
    const root = tile.find('.con-coltile');
    expect(root.classes()).to.include.members(['con-coltile--dock', 'con-fleetdock-tile', 'con-coltile--focused', 'con-coltile--ok']);
    expect(root.attributes('data-fleet-dock')).eq(CardName.WATER_HAULING);
    expect(root.attributes('data-fleet-dock-status')).eq('free');
    expect(tile.find('.con-coltile__head .con-coltile__name').text()).to.contain(CardName.WATER_HAULING);
    expect(tile.find('.con-coltile__head [data-fleet-dock-kicker]').text(), 'the «ПРИЧАЛ» mark on the name line').eq('Dock');
  });

  it('a ROUND art medallion stands where the planet stands — the FLIP\'s twin, the viewer\'s slot, the fleet\'s berth', () => {
    const tile = mountTile(CardName.UNMI_LINER, {kind: 'free', text: 'Dock free'});
    const face = tile.find('[data-fleet-dock-face]');
    expect(face.exists()).is.true;
    expect(face.classes(), 'the planet medallion\'s own box').to.include('con-coltile__planet-berth');
    expect(face.attributes('data-zoom-slot')).eq(CardName.UNMI_LINER);
    const disc = face.find('.con-planet.con-coltile__planet');
    expect(disc.exists(), 'the planet disc\'s dress').is.true;
    expect(disc.attributes('style') ?? '', 'the card\'s own art, the thumb build').to.contain('card-images/thumb/');
    expect(tile.find('.pcard').exists(), 'no card face on the tile — the card lives in the stage and the viewer').is.false;
    expect(face.find(`[data-fleet-berth="card:${CardName.UNMI_LINER}"]`).exists(), 'the overview\'s landing anchor').is.true;
  });

  it('«ТОРГОВАТЬ» prints what the trade gives in the colony\'s cell; the «БОНУС» place is an empty dim «—»', () => {
    const tile = mountTile(CardName.AURORA_STATION, {kind: 'free', text: 'Dock free'});
    const cells = tile.findAll('.con-coltile__rows > .con-coltile__cell');
    expect(cells.length, 'two cells — the colony tile\'s two columns').eq(2);
    const cell = tile.find('[data-fleet-dock-reward]');
    expect(cell.classes()).to.include.members(['con-coltile__cell', 'con-coltile__cell--trade']);
    expect(cell.find('.con-coltile__cell-label').text()).eq('Trade');
    expect(cell.findAll('.pcard-mi').length, 'two floaters').to.be.at.least(2);
    expect(cell.find('.pcard-prod').exists(), 'and the production plate').is.true;
    expect(cells[1].classes()).to.include.members(['con-coltile__cell--bonus', 'con-coltile__cell--empty']);
    expect(cells[1].text()).eq('—');
  });

  it('the STATUS strip stands in the track\'s place: a WORD on a kant — free · the fleet at the dock · the reason', () => {
    const free = mountTile(CardName.WATER_HAULING, {kind: 'free', text: 'Dock free'});
    const strip = free.find('.con-coltile__mid .con-coltile__state');
    expect(strip.classes()).to.include.members(['con-fleetdock-tile__status', 'con-coltile__state--free']);
    expect(strip.find('.con-fleetdock-tile__status-text').text()).eq('Dock free');
    expect(free.find('.con-coltile__status-dot').exists(), 'never a dot').is.false;
    const docked = mountTile(CardName.WATER_HAULING, {kind: 'docked', text: 'long', short: 'Fleet at the dock'}, 'blue');
    expect(docked.find('.con-coltile__state').classes()).to.include('con-coltile__state--docked');
    expect(docked.find('.con-fleetdock-tile__status-text').text(), 'the short form in the tile').eq('Fleet at the dock');
    expect(docked.find('.con-fleetdock-tile__status-ship').exists(), 'the ship in its owner\'s livery').is.true;
    expect(docked.find('.con-coltile__dock--occupied .colony-fleet-icon').exists(), 'the fleet berthed at the medallion').is.true;
    const blocked = mountTile(CardName.WATER_HAULING, {kind: 'blocked', text: 'No ocean left'});
    expect(blocked.find('.con-coltile__state').classes()).to.include('con-coltile__state--blocked');
    expect(blocked.find('.con-coltile').classes()).to.include('con-coltile--blocked');
    expect(blocked.text(), 'never a «✕»').not.to.contain('✕');
  });
});
