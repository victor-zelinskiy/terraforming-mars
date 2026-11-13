/*
 * ConsoleProfilesEditor — the profile editor's ROSTER overlay: the saved players under a cursor, plus a trailing
 * «＋ New profile» row. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no prop; the roster is
 * the module's (`profilesState`). `ConsoleMainMenu` stands it under `ref="profiles"` and routes the pad's intents to
 * `handleIntent` THROUGH THAT REF — so the editor is mounted here the way the menu mounts it, under an Options host
 * with a string ref, and the spec reads what that ref carries. The cursored row is found through the editor's own
 * ROOT ref (it read `this.$el` before the conversion — RECIPES § R12) and handed to the scroll area.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {normalizePlayerName} from '@/common/utils/playerName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {PlayerProfile, profilesState} from '@/client/components/mainMenu/profilesState';
import {identityState} from '@/client/components/mainMenu/identity/identityState';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import ConsoleProfilesEditor from '@/client/components/console/menu/ConsoleProfilesEditor.vue';

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
    render: () => h('div', [h(ConsoleProfilesEditor, {ref: 'profiles'})]),
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
    /** Exactly the menu's read: `(this.$refs.profiles ?? undefined) as {handleIntent?: …} | undefined`. */
    reach: (): EditorReach => {
      const editor = (wrapper.vm.$refs.profiles ?? undefined) as EditorReach | undefined;
      if (editor === undefined) {
        throw new Error('the host holds no ref to the editor');
      }
      return editor;
    },
    /** One flag per row — the saved profiles, then the «New profile» row. */
    cursor: () => wrapper.findAll('.cm-profile').map((row) => row.classes().includes('cm-field--cursor')),
    names: () => wrapper.findAll('.cm-profile:not(.cm-profile--add) .cm-profile__name').map((name) => name.text()),
    activeNames: () => wrapper.findAll('.cm-profile--active .cm-profile__name').map((name) => name.text()),
    hints: () => wrapper.findAll('.cm-overlay__foot-hint').map((hint) => hint.text()),
  };
}

const nav = (dir: 'up' | 'down' | 'left'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const X: GamepadIntent = {kind: 'press', button: 'secondary'};

function profile(id: string, displayName: string, cubeColor: PlayerProfile['cubeColor']): PlayerProfile {
  return {id, displayName, normalizedName: normalizePlayerName(displayName), cubeColor};
}

function forgetStored(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('tm_player_profiles');
      localStorage.removeItem('tm_player_identity');
    }
  } catch {
    // No storage in this environment — the modules' own guards skipped it too.
  }
}

describe('ConsoleProfilesEditor — the profile editor\'s roster overlay', () => {
  beforeEach(() => {
    // Module state is bundle-shared: the roster and the (absent) legacy identity are seeded as LOADED, so the
    // editor's own load reads no storage and adopts nothing an earlier spec left there.
    identityState.identity = undefined;
    identityState.loaded = true;
    profilesState.profiles = [profile('p1', 'Victor', 'blue'), profile('p2', 'Nastya', 'green'), profile('p3', 'Olga', 'red')];
    profilesState.activeId = 'p1';
    profilesState.loaded = true;
    kept.length = 0;
    typed.length = 0;
  });

  afterEach(() => {
    profilesState.profiles = [];
    profilesState.activeId = undefined;
    profilesState.loaded = false;
    identityState.identity = undefined;
    identityState.loaded = false;
    menuPadState.textEntry = false;
    forgetStored();
  });

  it('a dialog of the saved profiles and the «New profile» row — the active one marked, a cube and a delete button per profile, the cursor on the first', () => {
    const {wrapper, cursor, names, activeNames, hints} = mountUnderHost();
    const dialog = wrapper.find('.cm-overlay');
    expect(dialog.classes()).to.include.members(['cm-overlay', 'cm-overlay--nested']);
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-label')).to.eq($t('Profiles'));
    expect(dialog.find('.cm-overlay__card--wide > .cm-overlay__title').text()).to.eq($t('Profiles'));

    expect(wrapper.findComponent(ScrollStub).classes(), 'the rows stand in the scroll area').to.contain('cm-friends-scroll');
    expect(names()).to.deep.eq(['Victor', 'Nastya', 'Olga']);
    expect(wrapper.find('.cm-profile--add .cm-profile__name').text()).to.eq($t('New profile'));
    expect(cursor()).to.deep.eq([true, false, false, false]);
    expect(activeNames()).to.deep.eq(['Victor']);
    expect(wrapper.find('.cm-profile--active .cm-profile__active').text()).to.eq('✓ ' + $t('Active profile'));
    expect(wrapper.findAll('.cm-profile__cube').map((cube) => cube.classes().filter((name) => name.startsWith('player_bg_color_'))))
      .to.deep.eq([['player_bg_color_blue'], ['player_bg_color_green'], ['player_bg_color_red']]);
    expect(wrapper.findAll('button.cm-friend__remove').map((b) => b.attributes('aria-label')))
      .to.deep.eq([$t('Delete profile'), $t('Delete profile'), $t('Delete profile')]);

    expect(wrapper.find('.cm-field__issue').exists(), 'no issue line while nothing was refused').to.eq(false);
    expect(wrapper.findComponent(KeyboardStub).exists(), 'the keyboard stands only during a name entry').to.eq(false);
    expect(hints()).to.deep.eq([$t('Select'), $t('Delete'), $t('Back')]);
    expect(wrapper.findAll('.cm-overlay__foot .glyph-stub')).to.have.length(3);
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', () => {
    const {reach} = mountUnderHost();
    const editor = reach();
    expect(Object.keys(editor), 'exactly what the editor exposes').to.deep.eq(['handleIntent']);
    expect(editor.handleIntent).to.be.a('function');
    // Neither the editor's state nor its other functions are reachable through the ref.
    const leaked = ['cursor', 'entering', 'entryDraft', 'issue', 'profiles', 'activeId', 'useAt', 'removeAt', 'startAdd', 'commitAdd', 'keepCursorVisible']
      .filter((key) => (editor as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the pad THROUGH THE REF: ↑ / ↓ walk the rows between two walls and keep the cursored one in view; A switches the profile; X deletes it; B is the host\'s', async () => {
    const {wrapper, reach, cursor, names, activeNames, hints} = mountUnderHost();
    expect(reach().handleIntent(nav('down'))).to.eq(true);
    await nextTick();
    expect(cursor()).to.deep.eq([false, true, false, false]);
    await nextTick();
    expect(kept, 'the scroll area was handed the cursored row').to.have.length(1);
    expect(kept[0], 'found under the editor\'s own root').to.eq(wrapper.findAll('.cm-profile')[1].element);

    expect(reach().handleIntent(A)).to.eq(true);
    await nextTick();
    expect(profilesState.activeId).to.eq('p2');
    expect(activeNames(), 'the mark moved; the overlay stays open').to.deep.eq(['Nastya']);

    expect(reach().handleIntent(X)).to.eq(true);
    await nextTick();
    expect(names(), 'the cursored profile is gone').to.deep.eq(['Victor', 'Olga']);
    expect(activeNames(), 'and the first one left is the active one').to.deep.eq(['Victor']);
    expect(cursor(), 'the cursor stays on a row').to.deep.eq([false, true, false]);

    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    await nextTick();
    expect(cursor(), 'the «New profile» row is the last wall').to.deep.eq([false, false, true]);
    expect(hints(), 'on it A adds, and there is nothing to delete').to.deep.eq([$t('Add'), $t('Back')]);
    expect(reach().handleIntent(X), 'X is consumed there and deletes nothing').to.eq(true);
    expect(reach().handleIntent(nav('left')), 'a sideways step is consumed and moves nothing').to.eq(true);
    await nextTick();
    expect(names()).to.deep.eq(['Victor', 'Olga']);
    expect(cursor()).to.deep.eq([false, false, true]);

    for (let i = 0; i < 5; i++) {
      reach().handleIntent(nav('up'));
    }
    await nextTick();
    expect(cursor(), 'and the first row is the other wall').to.deep.eq([true, false, false]);
    expect(reach().handleIntent(B), 'B is not consumed — the host returns to the profile editor').to.eq(false);
  });

  it('A on the last row opens the on-screen keyboard, which then owns the pad; a refused name is said, an accepted one becomes the active profile under the cursor', async () => {
    const {wrapper, reach, cursor, names, activeNames} = mountUnderHost();
    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    expect(reach().handleIntent(A)).to.eq(true);
    await nextTick();
    const keyboard = wrapper.findComponent(KeyboardStub);
    expect(keyboard.exists()).to.eq(true);
    expect(keyboard.props('title')).to.eq('New profile');
    expect(keyboard.props('initial')).to.eq('');
    expect(menuPadState.textEntry, 'the console key bridge is silenced for the entry').to.eq(true);

    // Every intent — B included — goes to the keyboard while it stands.
    expect(reach().handleIntent(nav('up'))).to.eq(true);
    expect(reach().handleIntent(B)).to.eq(true);
    expect(typed).to.deep.eq([nav('up'), B]);
    await nextTick();
    expect(cursor(), 'the rows behind the keyboard did not move').to.deep.eq([false, false, false, true]);

    keyboard.vm.$emit('commit', 'victor');
    await nextTick();
    expect(wrapper.find('.cm-field__issue').text(), 'a duplicate is refused in words').to.eq($t('This name is already used by another profile'));
    expect(wrapper.findComponent(KeyboardStub).props('issue')).to.eq('This name is already used by another profile');
    keyboard.vm.$emit('commit', '  ');
    await nextTick();
    expect(wrapper.find('.cm-field__issue').text()).to.eq($t('Fill in the player name'));
    keyboard.vm.$emit('commit', 'D');
    await nextTick();
    expect(wrapper.find('.cm-field__issue').text()).to.eq($t('This name cannot be used'));
    expect(names()).to.deep.eq(['Victor', 'Nastya', 'Olga']);

    kept.length = 0;
    keyboard.vm.$emit('commit', 'Dima');
    await nextTick();
    expect(wrapper.findComponent(KeyboardStub).exists(), 'the entry is over').to.eq(false);
    expect(menuPadState.textEntry).to.eq(false);
    expect(wrapper.find('.cm-field__issue').exists()).to.eq(false);
    expect(names()).to.deep.eq(['Victor', 'Nastya', 'Olga', 'Dima']);
    expect(activeNames(), 'a freshly added profile is the one you play as').to.deep.eq(['Dima']);
    expect(cursor(), 'the cursor stands on it').to.deep.eq([false, false, false, true, false]);
    await nextTick();
    expect(kept, 'and its row is kept in view').to.have.length(1);
    expect(kept[0]).to.eq(wrapper.findAll('.cm-profile')[3].element);
  });

  it('the ONLY profile cannot be deleted: no delete button, no «Delete» verb, and X on it is refused in words', async () => {
    profilesState.profiles = [profile('p1', 'Victor', 'blue')];
    const {wrapper, reach, names, hints} = mountUnderHost();
    expect(wrapper.find('button.cm-friend__remove').exists()).to.eq(false);
    expect(hints()).to.deep.eq([$t('Select'), $t('Back')]);
    expect(reach().handleIntent(X)).to.eq(true);
    await nextTick();
    expect(wrapper.find('.cm-field__issue').text()).to.eq($t('Can\'t delete your only profile'));
    expect(names()).to.deep.eq(['Victor']);
    reach().handleIntent(A);
    await nextTick();
    expect(wrapper.find('.cm-field__issue').exists(), 'the next accepted press clears the refusal').to.eq(false);
  });

  it('a pointer: a row under it takes the cursor, a click selects it, its ✕ deletes it without selecting; a cancelled entry changes nothing', async () => {
    const {wrapper, reach, cursor, names, activeNames} = mountUnderHost();
    const rows = wrapper.findAll('.cm-profile');
    await rows[2].trigger('mousemove');
    expect(cursor(), 'the pointer carries the cursor').to.deep.eq([false, false, true, false]);
    await rows[2].trigger('click');
    expect(activeNames()).to.deep.eq(['Olga']);
    await wrapper.findAll('button.cm-friend__remove')[1].trigger('click');
    expect(names()).to.deep.eq(['Victor', 'Olga']);
    expect(activeNames(), 'the ✕ deleted its row and selected nothing').to.deep.eq(['Olga']);

    await wrapper.find('.cm-profile--add').trigger('click');
    expect(wrapper.findComponent(KeyboardStub).exists(), 'a click on the last row opens the same entry').to.eq(true);
    wrapper.findComponent(KeyboardStub).vm.$emit('cancel');
    await nextTick();
    expect(wrapper.findComponent(KeyboardStub).exists()).to.eq(false);
    expect(menuPadState.textEntry).to.eq(false);
    expect(names()).to.deep.eq(['Victor', 'Olga']);

    reach().handleIntent(A);
    expect(menuPadState.textEntry).to.eq(true);
    wrapper.unmount();
    expect(menuPadState.textEntry, 'an editor that leaves during an entry releases the bridge').to.eq(false);
  });
});
