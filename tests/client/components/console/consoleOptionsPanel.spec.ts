import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleOptionsPanel from '@/client/components/console/menu/ConsoleOptionsPanel.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {privateScoreState, setPrivateScore} from '@/client/components/overview/privateScoreState';
import {buttonLayoutState, setButtonLayout} from '@/client/gamepad/buttonLayout';

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const DOWN: GamepadIntent = {kind: 'nav', dir: 'down', repeat: false};

function mountWith(context: 'menu' | 'game') {
  return mount(ConsoleOptionsPanel, {
    global: {...globalConfig.global, stubs: {GamepadGlyph: true}},
    props: {context},
  });
}

describe('ConsoleOptionsPanel (in-game settings)', () => {
  // Module state is bundle-shared across specs — restore the defaults.
  afterEach(() => {
    setPrivateScore(false);
    setButtonLayout('standard');
  });

  it('game context hides Interface, shows Display / Controller / Button layout / Private score', () => {
    const ids = (mountWith('game').vm as any).rows.map((r: any) => r.id);
    expect(ids).to.not.include('interface');
    expect(ids).to.deep.eq(['display', 'controller', 'buttons', 'privateScore']);
  });

  it('menu context keeps Interface but HIDES the per-game Private score row', () => {
    const ids = (mountWith('menu').vm as any).rows.map((r: any) => r.id);
    expect(ids[0]).to.eq('interface');
    expect(ids).to.not.include('privateScore'); // per-game → in-game only
    expect(ids).to.include('buttons'); // the device pref stays available everywhere
  });

  it('activating the Private score row toggles the local mask pref', () => {
    const w = mountWith('game');
    expect(privateScoreState.enabled).to.eq(false);
    // Cursor to the privateScore row (last) and confirm.
    const rows = (w.vm as any).rows;
    const idx = rows.findIndex((r: any) => r.id === 'privateScore');
    for (let i = 0; i < idx; i++) {
      (w.vm as any).handleIntent(DOWN);
    }
    (w.vm as any).handleIntent(A);
    expect(privateScoreState.enabled).to.eq(true);
    // Its value reflects the state (English keys under the test i18n).
    expect((w.vm as any).rows.find((r: any) => r.id === 'privateScore').value).to.eq('Hidden');
  });

  it('activating the Button layout row cycles the gamepad remap', () => {
    const w = mountWith('game');
    expect(buttonLayoutState.layout).to.eq('standard');
    const idx = (w.vm as any).rows.findIndex((r: any) => r.id === 'buttons');
    for (let i = 0; i < idx; i++) {
      (w.vm as any).handleIntent(DOWN);
    }
    (w.vm as any).handleIntent(A);
    expect(buttonLayoutState.layout).to.eq('swap-ab');
  });

  it('B emits close (returns to the system menu list)', () => {
    const w = mountWith('game');
    (w.vm as any).handleIntent(B);
    expect(w.emitted('close')).to.have.length(1);
  });
});
