import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {reactive} from 'vue';
import {globalConfig} from '../getLocalVue';
import Turmoil from '@/client/components/turmoil/Turmoil.vue';
import {APP_ROOT} from '@/client/components/appRoot';
import {PartyName} from '@/common/turmoil/PartyName';
import {TurmoilModel} from '@/common/models/TurmoilModel';
import {fakePoliticalAgendasModel} from '../testHelpers';

function turmoilModel(): TurmoilModel {
  return {
    dominant: PartyName.REDS,
    ruling: PartyName.REDS,
    chairman: undefined,
    parties: [],
    lobby: [],
    reserve: [],
    distant: undefined,
    coming: undefined,
    current: undefined,
    politicalAgendas: fakePoliticalAgendasModel(),
    policyActionUsers: [],
  };
}

/** The slice of the app root's port the board reads: the panels' visibility memory. */
function fakeRoot(open: boolean) {
  const memory = reactive<{[key: string]: boolean}>({turmoil_parties: open});
  return {
    memory,
    port: {
      getVisibilityState: (key: string) => memory[key] === true,
      setVisibilityState: (key: string, visible: boolean) => {
        memory[key] = visible;
      },
    },
  };
}

function mountTurmoil(root?: ReturnType<typeof fakeRoot>) {
  return shallowMount(Turmoil, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      provide: root === undefined ? {} : {[APP_ROOT as symbol]: root.port},
    },
    props: {turmoil: turmoilModel()},
  });
}

describe('Turmoil', () => {
  it('mounts without errors', () => {
    const wrapper = mountTurmoil(fakeRoot(true));
    expect(wrapper.exists()).to.be.true;
  });

  it('names the ruling party by its css key', () => {
    const wrapper = mountTurmoil(fakeRoot(false));
    expect(wrapper.find('.party-name--reds').exists()).to.be.true;
  });

  it('the «Policies» panel reads the app root\'s memory and writes its toggle there', async () => {
    const root = fakeRoot(false);
    const wrapper = mountTurmoil(root);
    const panel = wrapper.find('.policies-global');
    expect(panel.isVisible()).to.be.false;

    await wrapper.find('.policies-clickable').trigger('click');
    expect(root.memory.turmoil_parties).to.be.true;
    expect(wrapper.find('.policies-global').attributes('style') ?? '').to.not.contain('display: none');
  });

  it('stands with no root above it: the panel is closed and the toggle is a no-op', async () => {
    const wrapper = mountTurmoil();
    expect(wrapper.find('.policies-global').attributes('style') ?? '').to.contain('display: none');
    await wrapper.find('.policies-clickable').trigger('click');
    expect(wrapper.find('.policies-global').attributes('style') ?? '').to.contain('display: none');
  });
});
