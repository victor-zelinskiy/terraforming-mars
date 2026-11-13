/*
 * ConsoleParticipantEditor — the create screen's overlay for ONE crew member: a human seat (name · cube colour ·
 * starting TR bonus · remove) or MarsBot (difficulty · the two switches · remove). A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): the seat is a prop, the FIELD CURSOR is the screen's (a prop the editor
 * asks to move through `cursor`), everything it edits is the module's (`createGameState`). `ConsoleCreateGame` stands
 * it under `ref="editor"` and routes the pad's intents to `handleIntent` THROUGH THAT REF — so the editor is mounted
 * here the way the screen mounts it, under a host with a string ref that follows the `cursor` emit, and the spec reads
 * what that ref carries.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, reactive} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {createGameState, resetCreateGameState} from '@/client/components/create/premium/createGameState';
import {friendsState} from '@/client/components/mainMenu/friendsState';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {EditorTarget} from '@/client/console/menu/consoleCreateModel';
import ConsoleParticipantEditor from '@/client/components/console/menu/ConsoleParticipantEditor.vue';

/** What the create screen reads through its ref — the component's whole contract with its parent. */
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

function mountUnderHost(target: EditorTarget, cursor = 0) {
  // The screen's own wiring: `:cursor="ui.overlay.cursor" @cursor="ui.overlay.cursor = $event"`.
  const ui = reactive({cursor, removeRequests: 0});
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleParticipantEditor, {
      ref: 'editor',
      target,
      cursor: ui.cursor,
      onCursor: (next: number) => {
        ui.cursor = next;
      },
      onRemoveRequest: () => {
        ui.removeRequests++;
      },
    })]),
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
    ui,
    /** Exactly the screen's read: `(… .editor ?? undefined) as {handleIntent?: …} | undefined`. */
    reach: (): EditorReach => {
      const editor = (wrapper.vm.$refs.editor ?? undefined) as EditorReach | undefined;
      if (editor === undefined) {
        throw new Error('the host holds no ref to the editor');
      }
      return editor;
    },
    /** The editor's OWN rows (the friend quick-pick is a nested overlay with rows of the same class). */
    rows: () => wrapper.findAll('.cm-overlay > .cm-overlay__card > .cm-fields > .cm-field'),
    labels: () => wrapper.findAll('.cm-overlay > .cm-overlay__card > .cm-fields > .cm-field > .cm-field__label').map((label) => label.text()),
    friendRows: () => wrapper.findAll('.cm-overlay--nested .cm-field'),
  };
}

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};

function forgetStoredFriends(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('tm_friends');
    }
  } catch {
    // No storage in this environment — the module's own guard skipped it too.
  }
}

describe('ConsoleParticipantEditor — one crew member of the create screen', () => {
  beforeEach(() => {
    // Module state is bundle-shared: a fresh party of two (red · green), and the friends list seeded as LOADED so
    // the editor's own `ensureFriendsLoaded()` reads no storage.
    resetCreateGameState();
    createGameState.config.players[0].name = 'Victor';
    createGameState.config.players[1].name = 'Nastya';
    friendsState.friends = [];
    friendsState.loaded = true;
    kept.length = 0;
    typed.length = 0;
  });

  afterEach(() => {
    resetCreateGameState();
    friendsState.friends = [];
    friendsState.loaded = false;
    menuPadState.textEntry = false;
    forgetStoredFriends();
  });

  it('a HUMAN seat: its cube and name in the head, the creator\'s tag on seat 0, name · colour — and no «remove» for the creator', () => {
    const {wrapper, rows, labels} = mountUnderHost({kind: 'human', index: 0});
    const dialog = wrapper.find('.cm-overlay');
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-label')).to.eq($t('Participant'));
    const head = dialog.find('.cm-editor__head');
    expect(head.find('.cm-editor__cube').classes()).to.include('player_bg_color_red');
    expect(head.text()).to.contain('Victor');
    expect(head.find('.cm-row__tag--creator').text()).to.eq($t('Creator'));

    expect(labels()).to.deep.eq([$t('Player name'), $t('Player color')]);
    expect(rows().map((row) => row.classes().includes('cm-field--cursor')), 'the cursor is the screen\'s prop').to.deep.eq([true, false]);
    expect(rows()[0].find('.cm-field__value > span').text()).to.eq('Victor');

    const cubes = wrapper.findAll('.cm-cube');
    expect(cubes.map((cube) => cube.attributes('aria-label'))).to.deep.eq(['red', 'green', 'yellow', 'blue', 'black', 'purple', 'orange', 'pink']);
    expect(cubes.map((cube) => cube.classes().includes('cm-cube--selected')), 'the seat\'s own colour').to.deep.eq([true, false, false, false, false, false, false, false]);
    expect(cubes.map((cube) => cube.classes().includes('cm-cube--taken')), 'the other seat\'s colour').to.deep.eq([false, true, false, false, false, false, false, false]);

    expect(wrapper.find('.cm-editor__note').exists(), 'the bot\'s notes belong to the bot').to.eq(false);
    expect(wrapper.find('.cm-field__issue').exists()).to.eq(false);
    expect(wrapper.findComponent(KeyboardStub).exists(), 'the keyboard stands only during a name entry').to.eq(false);
    expect(wrapper.find('.cm-overlay--nested').exists(), 'the friend quick-pick stands only while picking').to.eq(false);
  });

  it('a seat with no name says so; another seat gains «remove», and the TR bonus row only while the rule is on', async () => {
    createGameState.config.players[1].name = '';
    const {wrapper, rows, labels} = mountUnderHost({kind: 'human', index: 1});
    expect(wrapper.find('.cm-editor__head').text(), 'the head falls back to the dialog\'s own word').to.contain($t('Participant'));
    expect(wrapper.find('.cm-row__tag--creator').exists()).to.eq(false);
    expect(rows()[0].find('.cm-field__missing').text()).to.eq($t('Name not set'));
    expect(labels()).to.deep.eq([$t('Player name'), $t('Player color'), $t('Remove participant')]);
    expect(rows()[2].classes()).to.include('cm-field--danger');

    createGameState.config.rules.trBoostEnabled = true;
    createGameState.config.players[1].trBoost = 3;
    await nextTick();
    expect(labels()).to.deep.eq([$t('Player name'), $t('Player color'), $t('Starting TR bonus'), $t('Remove participant')]);
    expect(rows()[2].find('.cm-field__stepval').text()).to.eq('+3');
    expect(rows()[2].findAll('.cm-field__gauge-seg--on'), 'the gauge lights one segment per point').to.have.length(3);
  });

  it('MARSBOT: its own head, difficulty and the two switches, and every note reads the state it stands on', async () => {
    const {wrapper, labels} = mountUnderHost({kind: 'bot'});
    const head = wrapper.find('.cm-editor__head');
    expect(head.find('.cm-editor__cube--bot').exists()).to.eq(true);
    expect(head.text()).to.contain($t('MarsBot'));
    expect(head.find('.cm-row__tag--bot').text()).to.eq($t('Automa'));
    expect(labels()).to.deep.eq([$t('Difficulty'), $t('Dynamic balance'), $t('Extra MarsBot corporations'), $t('Remove MarsBot')]);
    expect(wrapper.find('[data-field="secondShift"] .cm-field__stepval').text()).to.eq($t('On'));
    expect(wrapper.find('[data-field="extraCorporations"] .cm-field__stepval').text()).to.eq($t('Off'));

    const notes = () => wrapper.findAll('.cm-editor__note').map((note) => note.text());
    expect(notes()).to.have.length(4);
    expect(notes()[0]).to.eq($t('The standard MarsBot experience — the official Automa rules as printed.'));
    expect(wrapper.find('[data-second-shift-note]').text()).to.eq($t('Dynamic balance: MarsBot stays in the round longer when a long game drags on. How much depends on the difficulty.'));
    expect(wrapper.find('[data-extra-corporations-note]').text()).to.eq($t('Extra corporations off: MarsBot gets only corporations from the official Automa set.'));

    createGameState.config.botSecondShift = false;
    createGameState.config.botExtraCorporations = true;
    await nextTick();
    expect(wrapper.find('[data-field="secondShift"] .cm-field__stepval').text()).to.eq($t('Off'));
    expect(wrapper.find('[data-second-shift-note]').text()).to.eq($t('Dynamic balance off: MarsBot keeps the same pace all game, as the Automa rules say.'));
    expect(wrapper.find('[data-extra-corporations-note]').text()).to.eq($t('Extra corporations on: besides the official ones, MarsBot may get one of the corporations made for this edition.'));
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else', () => {
    const {reach} = mountUnderHost({kind: 'human', index: 0});
    const editor = reach();
    expect(Object.keys(editor), 'exactly what the editor exposes').to.deep.eq(['handleIntent']);
    expect(editor.handleIntent).to.be.a('function');
    // Neither the editor's state nor its other functions are reachable through the ref.
    const leaked = ['entering', 'entryDraft', 'nameIssue', 'pickingFriend', 'friendCursor', 'fields', 'activateField', 'startNameEntry', 'chooseFriendRow']
      .filter((key) => (editor as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('the pad THROUGH THE REF: ↑ / ↓ ASK the screen to move the cursor between two walls; ◄ ► turn the field; A on «remove» asks the screen; B is the screen\'s', async () => {
    const {reach, ui, rows} = mountUnderHost({kind: 'human', index: 1});
    expect(reach().handleIntent(nav('up')), 'the first row is a wall — consumed, nothing asked').to.eq(true);
    expect(ui.cursor).to.eq(0);
    expect(reach().handleIntent(nav('down'))).to.eq(true);
    expect(ui.cursor, 'the editor emitted `cursor`, the screen moved it').to.eq(1);
    await nextTick();
    expect(rows().map((row) => row.classes().includes('cm-field--cursor'))).to.deep.eq([false, true, false]);

    // ► on the colour steps the ring; a colour another seat holds is SWAPPED, never doubled.
    expect(reach().handleIntent(nav('left'))).to.eq(true);
    expect(createGameState.config.players.map((p) => p.color), 'green ◄ red: the two seats swap').to.deep.eq(['green', 'red']);
    reach().handleIntent(nav('right'));
    reach().handleIntent(nav('right'));
    expect(createGameState.config.players.map((p) => p.color)).to.deep.eq(['red', 'yellow']);
    // A on the same field is one step forward.
    expect(reach().handleIntent(A)).to.eq(true);
    expect(createGameState.config.players[1].color).to.eq('blue');

    reach().handleIntent(nav('down'));
    await nextTick();
    expect(ui.cursor).to.eq(2);
    expect(reach().handleIntent(nav('down')), 'the last row is a wall').to.eq(true);
    expect(ui.cursor).to.eq(2);
    expect(ui.removeRequests).to.eq(0);
    expect(reach().handleIntent(A)).to.eq(true);
    expect(ui.removeRequests, 'the danger row is routed to the screen\'s confirm').to.eq(1);

    expect(reach().handleIntent(B), 'B is not consumed — the screen closes the overlay').to.eq(false);
  });

  it('a click on a row moves the cursor there and activates it; a click on a cube takes that colour', async () => {
    const {wrapper, ui, rows} = mountUnderHost({kind: 'bot'});
    await rows()[1].trigger('click');
    expect(ui.cursor).to.eq(1);
    expect(createGameState.config.botSecondShift, 'the switch under the click flipped').to.eq(false);
    await rows()[3].trigger('mousemove');
    expect(ui.cursor, 'the pointer carries the cursor').to.eq(3);
    wrapper.unmount();

    const human = mountUnderHost({kind: 'human', index: 0});
    await human.wrapper.findAll('.cm-cube')[3].trigger('click');
    expect(createGameState.config.players[0].color).to.eq('blue');
    expect(human.ui.cursor, 'a cube\'s click stops at the cube').to.eq(0);
  });

  it('A on the name with NO saved friends opens the on-screen keyboard, which then owns the pad; a refused name is said, an accepted one lands on the seat', async () => {
    const {wrapper, reach} = mountUnderHost({kind: 'human', index: 1});
    expect(reach().handleIntent(A)).to.eq(true);
    await nextTick();
    const keyboard = wrapper.findComponent(KeyboardStub);
    expect(keyboard.exists()).to.eq(true);
    expect(keyboard.props('title')).to.eq('Player name');
    expect(keyboard.props('initial'), 'the entry starts from the seat\'s name').to.eq('Nastya');
    expect(menuPadState.textEntry, 'the console key bridge is silenced for the entry').to.eq(true);

    // Every intent — B included — goes to the keyboard while it stands.
    expect(reach().handleIntent(nav('down'))).to.eq(true);
    expect(reach().handleIntent(B)).to.eq(true);
    expect(typed).to.deep.eq([nav('down'), B]);

    keyboard.vm.$emit('commit', '   ');
    await nextTick();
    expect(wrapper.find('.cm-field__issue').text(), 'an empty name is refused in words').to.eq($t('Fill in the player name'));
    expect(wrapper.findComponent(KeyboardStub).props('issue')).to.eq('Fill in the player name');
    expect(createGameState.config.players[1].name).to.eq('Nastya');

    keyboard.vm.$emit('commit', 'Dima');
    await nextTick();
    expect(wrapper.findComponent(KeyboardStub).exists(), 'the entry is over').to.eq(false);
    expect(menuPadState.textEntry).to.eq(false);
    expect(createGameState.config.players[1].name).to.eq('Dima');
    expect(wrapper.find('.cm-field__issue').exists()).to.eq(false);
    expect(wrapper.find('.cm-editor__head').text()).to.contain('Dima');
  });

  it('with saved friends A opens the QUICK-PICK first: a friend seated elsewhere is disabled, ↓ keeps the cursored row in view, A seats the friend', async () => {
    friendsState.friends = ['Victor', 'Olga', 'Dima'];
    const {wrapper, reach, ui, friendRows} = mountUnderHost({kind: 'human', index: 1});
    expect(reach().handleIntent(A)).to.eq(true);
    await nextTick();
    const pick = wrapper.find('.cm-overlay--nested');
    expect(pick.attributes('aria-label')).to.eq($t('Choose a friend'));
    expect(wrapper.findComponent(KeyboardStub).exists(), 'the keyboard is the pick\'s last row, not its first screen').to.eq(false);
    expect(pick.findAll('.cm-friend__name').map((name) => name.text())).to.deep.eq(['Victor', 'Olga', 'Dima', $t('Type a new name')]);
    expect(friendRows().map((row) => row.classes().includes('cm-field--disabled')), 'Victor sits on seat 0').to.deep.eq([true, false, false, false]);
    expect(friendRows()[0].find('.cm-field__missing').text()).to.eq($t('Already in the party'));
    expect(friendRows().map((row) => row.classes().includes('cm-field--cursor'))).to.deep.eq([true, false, false, false]);

    // A on a seated friend chooses nothing; the pick stays.
    expect(reach().handleIntent(A)).to.eq(true);
    await nextTick();
    expect(createGameState.config.players[1].name).to.eq('Nastya');
    expect(wrapper.find('.cm-overlay--nested').exists()).to.eq(true);

    // ↓ moves the PICK's cursor (never the editor's) and hands the cursored row to the scroll area — found from the
    // editor's own root.
    expect(reach().handleIntent(nav('down'))).to.eq(true);
    expect(ui.cursor, 'the editor\'s cursor did not move behind the pick').to.eq(0);
    await nextTick();
    await nextTick();
    expect(friendRows().map((row) => row.classes().includes('cm-field--cursor'))).to.deep.eq([false, true, false, false]);
    expect(kept, 'the scroll area was handed the cursored row').to.have.length(1);
    expect(kept[0]).to.eq(friendRows()[1].element);
    expect(reach().handleIntent(nav('left')), 'the pick swallows the rest').to.eq(true);

    expect(reach().handleIntent(A)).to.eq(true);
    await nextTick();
    expect(createGameState.config.players[1].name, 'the friend took the seat').to.eq('Olga');
    expect(wrapper.find('.cm-overlay--nested').exists(), 'the pick closed').to.eq(false);
    expect(menuPadState.textEntry, 'no entry was ever opened').to.eq(false);
  });

  it('the pick\'s last row falls back to typing; B closes the pick alone; leaving mid-entry gives the key bridge back', async () => {
    friendsState.friends = ['Olga'];
    const {wrapper, reach, friendRows} = mountUnderHost({kind: 'human', index: 1});
    reach().handleIntent(A);
    await nextTick();
    expect(reach().handleIntent(B), 'B is the pick\'s while it stands').to.eq(true);
    await nextTick();
    expect(wrapper.find('.cm-overlay--nested').exists()).to.eq(false);
    expect(wrapper.find('.cm-overlay').exists(), 'the editor itself stays').to.eq(true);

    reach().handleIntent(A);
    await nextTick();
    await friendRows()[1].trigger('click');
    expect(wrapper.find('.cm-overlay--nested').exists(), '«type a new name» leaves the pick').to.eq(false);
    expect(wrapper.findComponent(KeyboardStub).exists()).to.eq(true);
    expect(menuPadState.textEntry).to.eq(true);

    wrapper.findComponent(KeyboardStub).vm.$emit('cancel');
    await nextTick();
    expect(wrapper.findComponent(KeyboardStub).exists()).to.eq(false);
    expect(menuPadState.textEntry).to.eq(false);
    expect(createGameState.config.players[1].name, 'a cancelled entry changes nothing').to.eq('Nastya');

    reach().handleIntent(A);
    await nextTick();
    await friendRows()[1].trigger('click');
    expect(menuPadState.textEntry).to.eq(true);
    wrapper.unmount();
    expect(menuPadState.textEntry, 'an editor that leaves during an entry releases the bridge').to.eq(false);
  });
});
