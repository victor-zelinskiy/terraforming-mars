/*
 * ConsoleFriendsEditor — the profile's FRIENDS overlay: the local list of remembered names, a cursor over its rows,
 * the on-screen keyboard for a new name. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no
 * prop; the list is the module's (`friendsState`). `ConsoleMainMenu` stands it under `ref="friends"` and routes the
 * pad's intents to `handleIntent` THROUGH THAT REF — so the editor is mounted here the way the menu mounts it, under
 * an Options host with a string ref, and the spec reads what that ref carries.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {friendsState} from '@/client/components/mainMenu/friendsState';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import ConsoleFriendsEditor from '@/client/components/console/menu/ConsoleFriendsEditor.vue';

/** What the menu reads through its ref — the component's whole contract with its parent. */
type EditorReach = {handleIntent(intent: GamepadIntent): boolean};

// (Render functions, not template strings: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

/** The scroll area's stand-in: its slot, and a record of every element it was asked to keep in view. */
const kept: Array<Element | null> = [];
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  methods: {
    ensureVisible(el: Element | null): void {
      kept.push(el);
    },
  },
  render() {
    return h('div', {class: 'scroll-stub'}, this.$slots.default?.());
  },
});

/** The on-screen keyboard's stand-in: its props, its three emits, and a record of the intents it was handed. */
const typed: Array<GamepadIntent> = [];
const KeyboardStub = defineComponent({
  name: 'ConsoleVirtualKeyboard',
  props: {initial: String, title: String, issue: String},
  emits: ['update', 'commit', 'cancel'],
  methods: {
    handleIntent(intent: GamepadIntent): boolean {
      typed.push(intent);
      return true;
    },
  },
  render: () => h('div', {class: 'vk-stub'}),
});

function mountUnderHost() {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleFriendsEditor, {ref: 'friends'})]),
  });
  const wrapper = mount(Host, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {GamepadGlyph: GlyphStub, ConsoleScrollArea: ScrollStub, ConsoleVirtualKeyboard: KeyboardStub},
    },
  });
  return {
    wrapper,
    /** Exactly the menu's read: `(this.$refs.friends ?? undefined) as {handleIntent?: …} | undefined`. */
    reach: (): EditorReach => {
      const editor = (wrapper.vm.$refs.friends ?? undefined) as EditorReach | undefined;
      if (editor === undefined) {
        throw new Error('the host holds no ref to the editor');
      }
      return editor;
    },
    cursor: () => wrapper.findAll('.cm-friend').map((row) => row.classes().includes('cm-field--cursor')),
    names: () => wrapper.findAll('.cm-friend__name').map((name) => name.text()),
  };
}

const nav = (dir: 'up' | 'down' | 'left'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const X: GamepadIntent = {kind: 'press', button: 'secondary'};

function forgetStoredFriends(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('tm_friends');
    }
  } catch {
    // No storage in this environment — the module's own guard skipped it too.
  }
}

describe('ConsoleFriendsEditor — the profile\'s friends overlay', () => {
  beforeEach(() => {
    // Module state is bundle-shared: the list is seeded as LOADED, so the editor's own load reads no storage.
    friendsState.friends = ['Nastya', 'Victor', 'Olga'];
    friendsState.loaded = true;
    kept.length = 0;
    typed.length = 0;
  });

  afterEach(() => {
    friendsState.friends = [];
    friendsState.loaded = false;
    menuPadState.textEntry = false;
    forgetStoredFriends();
  });

  it('a dialog of the remembered names — the cursor on the first row, a remove button per row, three verbs in the foot', () => {
    const {wrapper, cursor, names} = mountUnderHost();
    const dialog = wrapper.find('.cm-overlay');
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-label')).to.eq($t('Friends'));
    expect(dialog.find('.cm-overlay__title').text()).to.eq($t('Friends'));
    expect(names()).to.deep.eq(['Nastya', 'Victor', 'Olga']);
    expect(cursor()).to.deep.eq([true, false, false]);
    expect(wrapper.findAll('.cm-friend__remove').map((b) => b.attributes('aria-label'))).to.deep.eq([$t('Remove'), $t('Remove'), $t('Remove')]);
    expect(wrapper.find('.cm-friends__empty').exists()).to.eq(false);
    expect(wrapper.find('.cm-field__issue').exists(), 'no issue line while nothing was refused').to.eq(false);
    expect(wrapper.findAll('.cm-overlay__foot-hint').map((hint) => hint.text())).to.deep.eq([$t('Add friend'), $t('Remove'), $t('Close')]);
    expect(wrapper.findComponent(KeyboardStub).exists(), 'the keyboard stands only during a name entry').to.eq(false);
  });

  it('an EMPTY list says so: no rows, no scroll area, no «Remove» verb', () => {
    friendsState.friends = [];
    const {wrapper, names} = mountUnderHost();
    expect(wrapper.find('.cm-friends__empty').text()).to.eq($t('You have no friends yet.'));
    expect(names()).to.deep.eq([]);
    expect(wrapper.findComponent(ScrollStub).exists()).to.eq(false);
    expect(wrapper.findAll('.cm-overlay__foot-hint').map((hint) => hint.text())).to.deep.eq([$t('Add friend'), $t('Close')]);
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', () => {
    const {reach} = mountUnderHost();
    const editor = reach();
    expect(Object.keys(editor), 'exactly what the editor exposes').to.deep.eq(['handleIntent']);
    expect(editor.handleIntent).to.be.a('function');
    // Neither the editor's state nor its other functions are reachable through the ref.
    const leaked = ['cursor', 'entering', 'entryDraft', 'issue', 'friends', 'startAdd', 'commitAdd', 'removeAt']
      .filter((key) => (editor as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the pad THROUGH THE REF: ↑ / ↓ walk the cursor between two walls and keep its row in view; X removes it; B is the host\'s', async () => {
    const {wrapper, reach, cursor, names} = mountUnderHost();
    expect(reach().handleIntent(nav('down'))).to.eq(true);
    await nextTick();
    expect(cursor()).to.deep.eq([false, true, false]);
    await nextTick();
    expect(kept, 'the scroll area was handed the cursored row').to.have.length(1);
    expect(kept[0]).to.eq(wrapper.findAll('.cm-friend')[1].element);

    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    await nextTick();
    expect(cursor(), 'the last row is a wall').to.deep.eq([false, false, true]);
    expect(reach().handleIntent(nav('left')), 'a sideways step is consumed and moves nothing').to.eq(true);
    await nextTick();
    expect(cursor()).to.deep.eq([false, false, true]);

    expect(reach().handleIntent(X)).to.eq(true);
    await nextTick();
    expect(names(), 'the cursored friend is gone').to.deep.eq(['Nastya', 'Victor']);
    expect(friendsState.friends).to.deep.eq(['Nastya', 'Victor']);
    expect(cursor(), 'the cursor stays inside the shorter list').to.deep.eq([false, true]);

    expect(reach().handleIntent(B), 'B is not consumed — the host closes the overlay').to.eq(false);
  });

  it('A opens the on-screen keyboard, which then owns the pad; a refused name is said, an accepted one lands under the cursor', async () => {
    const {wrapper, reach, cursor, names} = mountUnderHost();
    expect(reach().handleIntent(A)).to.eq(true);
    await nextTick();
    const keyboard = wrapper.findComponent(KeyboardStub);
    expect(keyboard.exists()).to.eq(true);
    expect(keyboard.props('title')).to.eq('Friend name');
    expect(keyboard.props('initial')).to.eq('');
    expect(menuPadState.textEntry, 'the console key bridge is silenced for the entry').to.eq(true);

    // Every intent — B included — goes to the keyboard while it stands.
    expect(reach().handleIntent(nav('down'))).to.eq(true);
    expect(reach().handleIntent(B)).to.eq(true);
    expect(typed).to.deep.eq([nav('down'), B]);
    await nextTick();
    expect(cursor(), 'the list behind the keyboard did not move').to.deep.eq([true, false, false]);

    keyboard.vm.$emit('commit', 'victor');
    await nextTick();
    expect(wrapper.find('.cm-field__issue').text(), 'a duplicate is refused in words').to.eq($t('This name is already in your friends'));
    expect(wrapper.findComponent(KeyboardStub).props('issue')).to.eq('This name is already in your friends');
    expect(names()).to.deep.eq(['Nastya', 'Victor', 'Olga']);

    keyboard.vm.$emit('commit', 'Dima');
    await nextTick();
    expect(wrapper.findComponent(KeyboardStub).exists(), 'the entry is over').to.eq(false);
    expect(menuPadState.textEntry).to.eq(false);
    expect(names()).to.deep.eq(['Nastya', 'Victor', 'Olga', 'Dima']);
    expect(cursor(), 'the cursor stands on the new friend').to.deep.eq([false, false, false, true]);
    expect(wrapper.find('.cm-field__issue').exists()).to.eq(false);
  });

  it('a cancelled entry changes nothing, and leaving mid-entry gives the key bridge back', async () => {
    const {wrapper, reach, names} = mountUnderHost();
    await wrapper.find('.cm-friends__foot .cm-confirm__btn').trigger('click');
    expect(wrapper.findComponent(KeyboardStub).exists(), 'the button opens the same entry').to.eq(true);
    wrapper.findComponent(KeyboardStub).vm.$emit('cancel');
    await nextTick();
    expect(wrapper.findComponent(KeyboardStub).exists()).to.eq(false);
    expect(menuPadState.textEntry).to.eq(false);
    expect(names()).to.deep.eq(['Nastya', 'Victor', 'Olga']);

    reach().handleIntent(A);
    expect(menuPadState.textEntry).to.eq(true);
    wrapper.unmount();
    expect(menuPadState.textEntry, 'an editor that leaves during an entry releases the bridge').to.eq(false);
  });
});
