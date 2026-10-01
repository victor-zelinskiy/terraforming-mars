import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import ConsoleColonyTile from '@/client/components/console/ConsoleColonyTile.vue';
import {
  finishColonyTrackWave, noteColonyTrackWaveTouched, releaseColonyTracks, requestColonyTrackWave,
} from '@/client/console/colonyTrade/consoleColonyTrade';

const RED: Color = 'red';

function luna(over: Partial<ColonyModel> = {}): ColonyModel {
  return {name: ColonyName.LUNA, isActive: true, trackPosition: 2, visitor: undefined, colonies: [RED], ...over};
}

function mountTile(props: Record<string, unknown>): VueWrapper<any> {
  return mount(ConsoleColonyTile, {
    global: {...globalConfig.global, stubs: {ConsolePlanetDisc: true, PlayerCube: true}},
    props: {colony: luna(), ...props},
  });
}

const cellClasses = (w: VueWrapper<any>) => w.findAll('.con-coltile__track-cell').map((c) => c.classes());

/*
 * THE TILE'S PROJECTION — one cell the tile READS, from one of two sources
 * (TR07 generalized `tradeOffset` → `projectedPosition`): a track-moving pick's
 * server projection (the ghost at the top, «+N»), or — absent — the trade's
 * standing offset exactly as before. And the cells a MOVING marker crosses
 * light up on the touch, before the hold releases.
 */
describe('ConsoleColonyTile — the projected cell', () => {
  afterEach(() => {
    finishColonyTrackWave('spec');
    releaseColonyTracks();
  });

  it('a track-moving pick: the ghost marker on the projected top, «+4», the marker where it stands', () => {
    const w = mountTile({projectedPosition: 6});
    const cells = cellClasses(w);
    expect(cells[2]).to.include('con-coltile__track-cell--marker');
    expect(cells[6]).to.include('con-coltile__track-cell--effective');
    expect(w.find('.con-coltile__cell-offset').text()).to.eq('+4');
  });

  it('no projection: the trade reads its standing offset exactly as before', () => {
    const w = mountTile({tradeOffset: 1});
    const cells = cellClasses(w);
    expect(cells[3]).to.include('con-coltile__track-cell--effective');
    expect(cells[6]).not.to.include('con-coltile__track-cell--effective');
    expect(w.find('.con-coltile__cell-offset').text()).to.eq('+1');
  });

  it('nothing projected and no offset: no ghost, no «+N»', () => {
    const w = mountTile({});
    expect(cellClasses(w).some((c) => c.includes('con-coltile__track-cell--effective'))).to.eq(false);
    expect(w.find('.con-coltile__cell-offset').exists()).to.eq(false);
  });

  it('a moving marker: the crossed cells light up as passed on the touch', async () => {
    void requestColonyTrackWave([{colony: ColonyName.LUNA, before: 2, after: 6}], {anchors: 'stage', rhythm: 'rail', reduced: false});
    const w = mountTile({projectedPosition: 6});
    noteColonyTrackWaveTouched(ColonyName.LUNA, 4);
    await w.vm.$nextTick();
    const cells = cellClasses(w);
    expect(cells[3]).to.include('con-coltile__track-cell--passed');
    expect(cells[4]).to.include('con-coltile__track-cell--passed');
    expect(cells[5]).not.to.include('con-coltile__track-cell--passed');
  });
});
