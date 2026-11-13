/*
 * ConsoleSystemMenu — the in-game SYSTEM overlay (the controller's Menu button). A `<script setup>` component (step A
 * of docs/claude/vapor/RECIPES.md): presentation over its props, so this spec reads what it RENDERS for them (the
 * fixed-shape list of plates, the cursor, the exit confirmation as a stage in place, the version tag), what it EMITS
 * (the mouse speaks the pad's intents) and what it EXPOSES — nothing: `GamepadLayer` owns the input and drives the
 * menu by props alone.
 *
 * The list itself is `consoleSystemMenuModel.SYSTEM_MENU_ITEMS` — the very array `GamepadLayer` walks; the spec reads
 * the plates against it, never against a copy.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleSystemMenu from '@/client/components/console/ConsoleSystemMenu.vue';
import {SYSTEM_MENU_ITEMS} from '@/client/components/console/consoleSystemMenuModel';

const STUBS = {GamepadGlyph: true};

function mountMenu(props: Partial<{index: number, confirmExit: boolean, inGame: boolean}> = {}) {
  return mount(ConsoleSystemMenu, {
    global: {...globalConfig.global, stubs: STUBS},
    props: {index: props.index ?? 0, confirmExit: props.confirmExit, inGame: props.inGame},
  });
}

type BridgeWindow = {desktopBridge?: unknown};

describe('ConsoleSystemMenu — the system overlay, a fixed-shape list of actions', () => {
  let bridgeBefore: unknown;
  beforeEach(() => {
    bridgeBefore = (window as unknown as BridgeWindow).desktopBridge;
  });
  afterEach(() => {
    (window as unknown as BridgeWindow).desktopBridge = bridgeBefore;
  });

  it('the list: one plate per item of the model, in its order; the cursor on `index`; the exit plate marked', () => {
    const wrapper = mountMenu({index: 2});
    expect(wrapper.classes()).to.deep.eq(['con-sys', 'con-sys--menu']);
    expect(wrapper.attributes('role')).to.eq('dialog');

    const plates = wrapper.findAll('.con-sysact__plate');
    expect(plates).to.have.lengthOf(SYSTEM_MENU_ITEMS.length);
    expect(plates.map((p) => p.find('.con-sysact__label').text())).to.deep.eq(SYSTEM_MENU_ITEMS.map((i) => i.label));
    expect(plates.map((p) => p.find('.con-sysact__sub').text())).to.deep.eq(SYSTEM_MENU_ITEMS.map((i) => i.sub));
    expect(plates.map((p) => p.find('.con-sysact__glyph').text())).to.deep.eq(SYSTEM_MENU_ITEMS.map((i) => i.glyph));

    expect(plates.map((p) => p.classes().includes('con-sysact__plate--cursor')), 'ONE cursor, on `index`')
      .to.deep.eq(SYSTEM_MENU_ITEMS.map((_, i) => i === 2));
    expect(plates.map((p) => p.classes().includes('con-sysact__plate--exit')))
      .to.deep.eq(SYSTEM_MENU_ITEMS.map((i) => i.id === 'exit'));

    // No stage past the list: the crumb is its root alone, the foot offers the list's verbs.
    expect(wrapper.find('.con-sys__crumb-root').text()).to.eq('System');
    expect(wrapper.find('.con-sys__crumb-tail').exists()).to.eq(false);
    expect(wrapper.find('.con-sysconfirm').exists()).to.eq(false);
    expect(wrapper.findAll('.con-sys__hint')).to.have.lengthOf(3);
    expect(wrapper.find('.con-sys__hint--danger').exists()).to.eq(false);
  });

  it('outside the game the «return» plate reads «Close» — the same shape, one label swapped, the model untouched', () => {
    const wrapper = mountMenu({inGame: false});
    const plates = wrapper.findAll('.con-sysact__plate');
    expect(plates).to.have.lengthOf(SYSTEM_MENU_ITEMS.length);
    const labels = plates.map((p) => p.find('.con-sysact__label').text());
    expect(labels.slice(0, -1)).to.deep.eq(SYSTEM_MENU_ITEMS.slice(0, -1).map((i) => i.label));
    expect(labels[labels.length - 1]).to.eq('Close');
    expect(plates[plates.length - 1].find('.con-sysact__sub').text()).to.eq('Close this menu');
    expect(SYSTEM_MENU_ITEMS[SYSTEM_MENU_ITEMS.length - 1].label, 'the shared list is never written').to.eq('Return to game');
  });

  it('the exit confirmation is a STAGE of the same surface: the crumb gains its tail, the plates give way, the foot swaps its verbs — and back', async () => {
    const wrapper = mountMenu({index: 3, confirmExit: true});
    expect(wrapper.find('.con-sys__crumb-root').text(), 'the root never restarts').to.eq('System');
    expect(wrapper.find('.con-sys__crumb-tail .con-sys__crumb-stage--commit').text()).to.eq('Exit');
    expect(wrapper.find('.con-sysconfirm__body').text()).to.eq('Leave the game and return to the main menu?');
    expect(wrapper.find('.con-sysconfirm__note').text()).to.eq('The game is saved and can be resumed later.');
    expect(wrapper.find('.con-sysact').exists(), 'no plate under the question').to.eq(false);
    expect(wrapper.findAll('.con-sys__hint')).to.have.lengthOf(2);
    expect(wrapper.find('.con-sys__hint--danger').text()).to.eq('Confirm');

    await wrapper.setProps({confirmExit: false});
    expect(wrapper.find('.con-sysconfirm').exists()).to.eq(false);
    expect(wrapper.find('.con-sys__crumb-tail').exists()).to.eq(false);
    const plates = wrapper.findAll('.con-sysact__plate');
    expect(plates).to.have.lengthOf(SYSTEM_MENU_ITEMS.length);
    expect(plates[3].classes(), 'the cursor stands where the host left it').to.include('con-sysact__plate--cursor');
  });

  it('the mouse speaks the pad\'s intents: a click activates the plate\'s index, a hover moves the host\'s cursor', async () => {
    const wrapper = mountMenu();
    const plates = wrapper.findAll('.con-sysact__plate');
    await plates[3].trigger('click');
    await plates[1].trigger('mousemove');
    await plates[4].trigger('click');
    expect(wrapper.emitted('activate')).to.deep.eq([[3], [4]]);
    expect(wrapper.emitted('cursor')).to.deep.eq([[1]]);
  });

  it('a PARENT\'s ref sees nothing: the overlay\'s owner drives it by props alone', () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleSystemMenu, {ref: 'menu', index: 0})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs: STUBS}});
    expect(host.vm.$refs.menu, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys((host.vm.$refs.menu ?? {}) as object), 'no `defineExpose` — nothing of the script leaves it').to.deep.eq([]);
  });

  it('the head tag: the build\'s own version with no desktop shell; the shell\'s baked version once its bridge answers', async () => {
    (window as unknown as BridgeWindow).desktopBridge = undefined;
    const bare = mountMenu();
    await flushPromises();
    const tag = () => bare.find('.con-sys__tag b');
    const own = tag().exists() ? tag().text() : '';

    // A bridge that answers something that is no version changes nothing…
    (window as unknown as BridgeWindow).desktopBridge = {getVersion: () => Promise.resolve(undefined)};
    const odd = mountMenu();
    await flushPromises();
    expect(odd.find('.con-sys__tag b').exists() ? odd.find('.con-sys__tag b').text() : '').to.eq(own);

    // …a baked version takes the tag — after the mount, when the promise lands.
    (window as unknown as BridgeWindow).desktopBridge = {getVersion: () => Promise.resolve('9.9.9-shell')};
    const shell = mountMenu();
    expect(shell.find('.con-sys__tag b').exists() ? shell.find('.con-sys__tag b').text() : '', 'not before the bridge answers').to.eq(own);
    await flushPromises();
    expect(shell.find('.con-sys__tag b').text()).to.eq('9.9.9-shell');

    // A bridge that fails is swallowed: the tag keeps the build's own version, nothing is thrown.
    (window as unknown as BridgeWindow).desktopBridge = {getVersion: () => Promise.reject(new Error('no shell'))};
    const failed = mountMenu();
    await flushPromises();
    expect(failed.find('.con-sys__tag b').exists() ? failed.find('.con-sys__tag b').text() : '').to.eq(own);
  });
});
