/*
 * ConsoleProfileEditor — the main menu's PLAYER PROFILE overlay: four fields under a screen-state cursor (the active
 * profile · its name · its cube colour · the friends list). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no prop; what it shows is the modules' (`profilesState`, `friendsState`).
 * `ConsoleMainMenu` stands it under `ref="profile"` and routes the pad's intents to `handleIntent` THROUGH THAT REF —
 * so the editor is mounted here the way the menu mounts it, under an Options host with a string ref, and the spec
 * reads what that ref carries.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {PLAYER_COLORS} from '@/common/Color';
import {normalizePlayerName} from '@/common/utils/playerName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {profilesState} from '@/client/components/mainMenu/profilesState';
import {friendsState} from '@/client/components/mainMenu/friendsState';
import {identityState} from '@/client/components/mainMenu/identity/identityState';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import ConsoleProfileEditor from '@/client/components/console/menu/ConsoleProfileEditor.vue';

/** What the menu reads through its ref — the component's whole contract with its parent. */
type EditorReach = {handleIntent(intent: GamepadIntent): boolean};

// (Render functions, not template strings: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
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
  const asked: Array<string> = [];
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleProfileEditor, {
      ref: 'profile',
      onManageProfiles: () => {
        asked.push('manage-profiles');
      },
      onManageFriends: () => {
        asked.push('manage-friends');
      },
    })]),
  });
  const wrapper = mount(Host, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub, ConsoleVirtualKeyboard: KeyboardStub}},
  });
  return {
    wrapper,
    asked,
    /** Exactly the menu's read: `(this.$refs.profile ?? undefined) as {handleIntent?: …} | undefined`. */
    reach: (): EditorReach => {
      const editor = (wrapper.vm.$refs.profile ?? undefined) as EditorReach | undefined;
      if (editor === undefined) {
        throw new Error('the host holds no ref to the editor');
      }
      return editor;
    },
    cursor: () => wrapper.findAll('.cm-field').map((row) => row.classes().includes('cm-field--cursor')),
    /** The active profile's name as the two fields that print it show it (the Profiles stepper, the Name field). */
    shownNames: () => wrapper.findAll('.cm-field').slice(0, 2).map((row) => row.find('.cm-field__value > span:not(.cm-field__hint)').text()),
    selectedCube: () => wrapper.findAll('button.cm-cube').filter((cube) => cube.classes().includes('cm-cube--selected')).map((cube) => cube.attributes('aria-label')),
  };
}

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};

function colourAfter(color: typeof PLAYER_COLORS[number], step: number): string {
  return PLAYER_COLORS[(PLAYER_COLORS.indexOf(color) + step + PLAYER_COLORS.length) % PLAYER_COLORS.length];
}

function forgetStored(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('tm_player_profiles');
      localStorage.removeItem('tm_player_identity');
      localStorage.removeItem('tm_friends');
    }
  } catch {
    // No storage in this environment — the modules' own guards skipped it too.
  }
}

describe('ConsoleProfileEditor — the main menu\'s player profile overlay', () => {
  beforeEach(() => {
    // Module state is bundle-shared: the roster, the friends and the (absent) legacy identity are seeded as LOADED, so
    // the editor's own load reads no storage and adopts nothing an earlier spec left there.
    identityState.identity = undefined;
    identityState.loaded = true;
    profilesState.profiles = [
      {id: 'p1', displayName: 'Victor', normalizedName: normalizePlayerName('Victor'), cubeColor: 'blue'},
      {id: 'p2', displayName: 'Nastya', normalizedName: normalizePlayerName('Nastya'), cubeColor: 'green'},
    ];
    profilesState.activeId = 'p1';
    profilesState.loaded = true;
    friendsState.friends = ['Olga', 'Dima'];
    friendsState.loaded = true;
    typed.length = 0;
  });

  afterEach(() => {
    profilesState.profiles = [];
    profilesState.activeId = undefined;
    profilesState.loaded = false;
    friendsState.friends = [];
    friendsState.loaded = false;
    identityState.identity = undefined;
    identityState.loaded = false;
    menuPadState.textEntry = false;
    forgetStored();
  });

  it('a dialog of four fields for the ACTIVE profile — its name twice, its cube marked, the friends counted; the cursor on the first', () => {
    const {wrapper, cursor, shownNames, selectedCube} = mountUnderHost();
    const dialog = wrapper.find('.cm-overlay');
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-label')).to.eq($t('Player profile'));
    expect(dialog.find('.cm-overlay__card > .cm-overlay__title').text()).to.eq($t('Player profile'));

    expect(wrapper.findAll('.cm-field__label').map((label) => label.text()))
      .to.deep.eq([$t('Profiles'), $t('Player name'), $t('Player color'), $t('Friends')]);
    expect(cursor()).to.deep.eq([true, false, false, false]);
    expect(shownNames()).to.deep.eq(['Victor', 'Victor']);
    expect(wrapper.find('.cm-field__missing').exists(), 'nothing is missing').to.eq(false);
    expect(wrapper.findAll('button.cm-field__arrow').map((arrow) => arrow.text()), 'two saved profiles — the stepper has its arrows').to.deep.eq(['◄', '►']);

    const cubes = wrapper.findAll('button.cm-cube');
    expect(cubes.map((cube) => cube.attributes('aria-label'))).to.deep.eq([...PLAYER_COLORS]);
    expect(cubes.every((cube) => cube.classes().includes('player_bg_color_' + cube.attributes('aria-label')))).to.eq(true);
    expect(selectedCube()).to.deep.eq(['blue']);
    expect(wrapper.findAll('.cm-field')[3].find('.cm-field__value > span').text(), 'the friends are counted').to.eq('2');

    expect(wrapper.find('.cm-field__issue').exists(), 'no issue line while nothing was refused').to.eq(false);
    expect(wrapper.findComponent(KeyboardStub).exists(), 'the keyboard stands only during a name entry').to.eq(false);
    expect(wrapper.findAllComponents(GlyphStub).map((glyph) => glyph.props('control'))).to.deep.eq(['confirm', 'confirm', 'confirm', 'back']);
    expect(wrapper.find('.cm-overlay__foot-hint').text()).to.eq($t('Close'));
  });

  it('with NO profile and no friend it asks for a name: both name fields read «Set your name», no arrows, a dash for the friends', () => {
    profilesState.profiles = [];
    profilesState.activeId = undefined;
    friendsState.friends = [];
    const {wrapper, shownNames, selectedCube} = mountUnderHost();
    expect(shownNames()).to.deep.eq([$t('Set your name'), $t('Set your name')]);
    expect(wrapper.findAll('.cm-field__missing')).to.have.length(3);
    expect(wrapper.find('button.cm-field__arrow').exists()).to.eq(false);
    expect(selectedCube(), 'the default cube is offered').to.deep.eq([PLAYER_COLORS[0]]);
    expect(wrapper.findAll('.cm-field')[3].find('.cm-field__value > span').text()).to.eq('—');
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', () => {
    const {reach} = mountUnderHost();
    const editor = reach();
    expect(Object.keys(editor), 'exactly what the editor exposes').to.deep.eq(['handleIntent']);
    expect(editor.handleIntent).to.be.a('function');
    // Neither the editor's state nor its other functions are reachable through the ref.
    const leaked = ['cursor', 'entering', 'entryDraft', 'nameIssue', 'colors', 'activeName', 'cycleActive', 'startNameEntry', 'commitNameEntry', 'pickColor']
      .filter((key) => (editor as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the pad THROUGH THE REF: ↑ / ↓ walk four fields between two walls; ◄ ► switch the profile and turn the colour; A asks the host; B is the host\'s', async () => {
    const {reach, asked, cursor, shownNames, selectedCube} = mountUnderHost();
    // Profiles: ◄ ► switch the active profile — and every field follows it.
    expect(reach().handleIntent(nav('right'))).to.eq(true);
    await nextTick();
    expect(profilesState.activeId).to.eq('p2');
    expect(shownNames()).to.deep.eq(['Nastya', 'Nastya']);
    expect(selectedCube()).to.deep.eq(['green']);
    reach().handleIntent(nav('left'));
    await nextTick();
    expect(profilesState.activeId).to.eq('p1');
    expect(reach().handleIntent(A)).to.eq(true);
    expect(asked, 'A on the profiles field asks the host for the roster').to.deep.eq(['manage-profiles']);

    // Name: a sideways step is consumed and moves nothing.
    reach().handleIntent(nav('down'));
    await nextTick();
    expect(cursor()).to.deep.eq([false, true, false, false]);
    expect(reach().handleIntent(nav('right'))).to.eq(true);
    expect(profilesState.activeId).to.eq('p1');
    expect(profilesState.profiles[0].cubeColor).to.eq('blue');

    // Colour: ◄ ► and A turn the ring.
    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('right'));
    await nextTick();
    expect(cursor()).to.deep.eq([false, false, true, false]);
    expect(selectedCube()).to.deep.eq([colourAfter('blue', 1)]);
    reach().handleIntent(nav('left'));
    reach().handleIntent(nav('left'));
    await nextTick();
    expect(selectedCube()).to.deep.eq([colourAfter('blue', -1)]);
    reach().handleIntent(A);
    await nextTick();
    expect(selectedCube(), 'A is one step forward').to.deep.eq(['blue']);

    // Friends: the last field is a wall; A asks the host for the list.
    reach().handleIntent(nav('down'));
    reach().handleIntent(nav('down'));
    await nextTick();
    expect(cursor(), 'the last field is a wall, never a wrap').to.deep.eq([false, false, false, true]);
    reach().handleIntent(A);
    expect(asked).to.deep.eq(['manage-profiles', 'manage-friends']);
    for (let i = 0; i < 5; i++) {
      reach().handleIntent(nav('up'));
    }
    await nextTick();
    expect(cursor(), 'and so is the first').to.deep.eq([true, false, false, false]);

    expect(reach().handleIntent(B), 'B is not consumed — the host closes the overlay').to.eq(false);
  });

  it('A on the name opens the on-screen keyboard, which then owns the pad; a refused name is said, an accepted one renames the profile', async () => {
    const {wrapper, reach, cursor, shownNames} = mountUnderHost();
    reach().handleIntent(nav('down'));
    expect(reach().handleIntent(A)).to.eq(true);
    await nextTick();
    const keyboard = wrapper.findComponent(KeyboardStub);
    expect(keyboard.exists()).to.eq(true);
    expect(keyboard.props('title')).to.eq('Player name');
    expect(keyboard.props('initial'), 'the entry starts from the name in use').to.eq('Victor');
    expect(menuPadState.textEntry, 'the console key bridge is silenced for the entry').to.eq(true);

    // Every intent — B included — goes to the keyboard while it stands.
    expect(reach().handleIntent(nav('down'))).to.eq(true);
    expect(reach().handleIntent(B)).to.eq(true);
    expect(typed).to.deep.eq([nav('down'), B]);
    await nextTick();
    expect(cursor(), 'the fields behind the keyboard did not move').to.deep.eq([false, true, false, false]);

    keyboard.vm.$emit('commit', '   ');
    await nextTick();
    expect(wrapper.find('.cm-field__issue').text(), 'an empty name is refused in words').to.eq($t('Fill in the player name'));
    expect(wrapper.findComponent(KeyboardStub).props('issue')).to.eq('Fill in the player name');
    keyboard.vm.$emit('commit', 'nastya');
    await nextTick();
    expect(wrapper.find('.cm-field__issue').text(), 'another profile\'s name too').to.eq($t('This name is already used by another profile'));
    expect(shownNames()).to.deep.eq(['Victor', 'Victor']);

    keyboard.vm.$emit('commit', 'Viktor');
    await nextTick();
    expect(wrapper.findComponent(KeyboardStub).exists(), 'the entry is over').to.eq(false);
    expect(menuPadState.textEntry).to.eq(false);
    expect(wrapper.find('.cm-field__issue').exists()).to.eq(false);
    expect(profilesState.profiles.map((p) => p.displayName)).to.deep.eq(['Viktor', 'Nastya']);
    expect(shownNames()).to.deep.eq(['Viktor', 'Viktor']);
  });

  it('a pointer: a field under it takes the cursor, a cube picks the colour, the two doors ask the host; leaving mid-entry gives the key bridge back', async () => {
    const {wrapper, asked, cursor, selectedCube} = mountUnderHost();
    const fields = wrapper.findAll('.cm-field');
    await fields[2].trigger('mousemove');
    expect(cursor(), 'the pointer carries the cursor').to.deep.eq([false, false, true, false]);
    await wrapper.findAll('button.cm-cube')[PLAYER_COLORS.indexOf('pink')].trigger('click');
    expect(selectedCube()).to.deep.eq(['pink']);
    expect(profilesState.profiles[0].cubeColor).to.eq('pink');

    await fields[3].trigger('click');
    await fields[0].trigger('click');
    expect(asked, 'the template\'s own emits reach the host').to.deep.eq(['manage-friends', 'manage-profiles']);
    await wrapper.findAll('button.cm-field__arrow')[1].trigger('click');
    expect(profilesState.activeId, '► switches the profile and opens nothing').to.eq('p2');
    expect(asked).to.have.length(2);

    await fields[1].trigger('click');
    expect(wrapper.findComponent(KeyboardStub).exists(), 'a click on the name opens the same entry').to.eq(true);
    wrapper.findComponent(KeyboardStub).vm.$emit('cancel');
    await nextTick();
    expect(wrapper.findComponent(KeyboardStub).exists()).to.eq(false);
    expect(menuPadState.textEntry).to.eq(false);
    expect(profilesState.profiles.map((p) => p.displayName), 'a cancelled entry changes nothing').to.deep.eq(['Victor', 'Nastya']);

    await fields[1].trigger('click');
    expect(menuPadState.textEntry).to.eq(true);
    wrapper.unmount();
    expect(menuPadState.textEntry, 'an editor that leaves during an entry releases the bridge').to.eq(false);
  });
});
