import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ModernShiftAresGlobalParameters from '@/client/components/modalInputs/ModernShiftAresGlobalParameters.vue';
import {ShiftAresGlobalParametersModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';

function model(over: Partial<{lowAvail: boolean, highAvail: boolean, tempAvail: boolean, oxyAvail: boolean}> = {}): ShiftAresGlobalParametersModel {
  return {
    title: 'Adjust Ares global parameters up to 1 step.',
    buttonLabel: 'Save',
    type: 'aresGlobalParameters',
    aresData: {
      includeHazards: true,
      hazardData: {
        erosionOceanCount: {threshold: 3, available: over.lowAvail ?? true},
        removeDustStormsOceanCount: {threshold: 6, available: over.highAvail ?? true},
        severeErosionTemperature: {threshold: -4, available: over.tempAvail ?? true},
        severeDustStormOxygen: {threshold: 5, available: over.oxyAvail ?? true},
      },
      milestoneResults: [],
    },
  };
}

function mountWith(playerinput: ShiftAresGlobalParametersModel, onsave: (out: unknown) => void = () => {}, controlled = false) {
  return mount(ModernShiftAresGlobalParameters, {
    ...globalConfig,
    props: {playerView: {} as PlayerViewModel, playerinput, onsave, controlled},
  });
}

describe('ModernShiftAresGlobalParameters', () => {
  it('renders one row per AVAILABLE threshold', () => {
    const w = mountWith(model());
    expect(w.find('[data-test="ares-row-lowOceanDelta"]').exists()).to.be.true;
    expect(w.find('[data-test="ares-row-highOceanDelta"]').exists()).to.be.true;
    expect(w.find('[data-test="ares-row-temperatureDelta"]').exists()).to.be.true;
    expect(w.find('[data-test="ares-row-oxygenDelta"]').exists()).to.be.true;
  });

  it('hides an UNAVAILABLE (consumed) threshold', () => {
    const w = mountWith(model({oxyAvail: false}));
    expect(w.find('[data-test="ares-row-oxygenDelta"]').exists()).to.be.false;
    expect(w.find('[data-test="ares-row-lowOceanDelta"]').exists()).to.be.true;
  });

  it('temperature shifts in 2°C steps; the preview updates live', async () => {
    const w = mountWith(model());
    await w.find('[data-test="ares-seg-temperatureDelta-1"]').trigger('click');
    // -4 + 1*2 = -2
    expect(w.find('[data-test="ares-row-temperatureDelta"] .modal-input__ares-to').text()).to.contain('-2');
  });

  it('confirm submits the byte-identical response with all four deltas', async () => {
    let saved: any;
    const w = mountWith(model(), (out) => {
      saved = out;
    });
    await w.find('[data-test="ares-seg-lowOceanDelta--1"]').trigger('click');
    await w.find('[data-test="ares-seg-temperatureDelta-1"]').trigger('click');
    await w.find('[data-test="ares-shift-confirm"]').trigger('click');
    expect(saved).to.deep.eq({
      type: 'aresGlobalParameters',
      response: {lowOceanDelta: -1, highOceanDelta: 0, temperatureDelta: 1, oxygenDelta: 0},
    });
  });

  it('controlled mode emits @change instead of showing the confirm button', async () => {
    const w = mountWith(model(), () => {}, true);
    expect(w.find('[data-test="ares-shift-confirm"]').exists()).to.be.false;
    await w.find('[data-test="ares-seg-oxygenDelta-1"]').trigger('click');
    const events = w.emitted('change');
    expect(events, 'change emitted').to.not.be.undefined;
    expect(events![events!.length - 1][0]).to.deep.eq({
      type: 'aresGlobalParameters',
      response: {lowOceanDelta: 0, highOceanDelta: 0, temperatureDelta: 0, oxygenDelta: 1},
    });
  });
});
