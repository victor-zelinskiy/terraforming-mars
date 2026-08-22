import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ConsoleBoardInput from '@/client/components/console/ConsoleBoardInput.vue';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/*
 * The console board-input binder (the successor of the upstream
 * SelectSpace.vue). The DOM wiring itself (highlight / illegal marks /
 * per-cell onclick / hover popovers) runs against the always-mounted board
 * and is covered end-to-end by the placement e2e suites
 * (console-placement-dossier / -navigation / auto-tile-landing); this spec
 * pins the mount contract on an empty board.
 */
describe('ConsoleBoardInput', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
  });

  afterEach(() => {
    FakeLocalStorage.deregister(localStorage);
  });

  it('mounts without errors (headless: no title, no warning strip)', () => {
    const wrapper = shallowMount(ConsoleBoardInput, {
      ...globalConfig,
      props: {
        playerView: {} as PlayerViewModel,
        playerinput: {
          title: 'Select a space',
          buttonLabel: 'Save',
          type: 'space',
          spaces: [],
        },
        onsave: () => {},
      },
    });
    expect(wrapper.exists()).to.be.true;
    expect(wrapper.find('.con-board-input').exists()).to.be.true;
  });
});
