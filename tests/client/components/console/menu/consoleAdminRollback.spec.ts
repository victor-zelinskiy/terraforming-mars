/*
 * ConsoleAdminRollback — the main menu's «Откат партий» tool for LOCAL games: a list of games, then one game's save
 * history as a generation timeline + a save slider, a confirm, the rollback. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). `ConsoleMainMenu` stands it under `ref="admin"` and routes the pad's intents to
 * `handleIntent` THROUGH THAT REF — so it is mounted here the way the menu mounts it, under a host with a string ref,
 * and the spec reads what that ref carries. The server is a stub WITH MEMORY (a rollback truncates the history it
 * answers with afterwards).
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {Phase} from '@/common/Phase';
import {GameId} from '@/common/Types';
import {AdminRollbackGameSummary, AdminRollbackSave} from '@/common/models/AdminRollbackModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {adminRollbackState, clearAdminHistory} from '@/client/components/console/menu/adminRollbackState';
import ConsoleAdminRollback from '@/client/components/console/menu/ConsoleAdminRollback.vue';

/** What the menu reads through its ref — the component's whole contract with its parent. */
type RollbackReach = {handleIntent(intent: GamepadIntent): boolean};

// The badge is the glyph set's own subject; this spec reads the SEMANTIC control the tool asks it for.
// (A render function, not a template string: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

/** The rows the tool asked its scroll area to keep in view — through its `gamesScroll` ref. */
let kept: Array<Element | null> = [];
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

const ALPHA = 'g-alpha' as GameId;
const GAMES: ReadonlyArray<AdminRollbackGameSummary> = [
  {id: ALPHA, name: 'Alpha', phase: Phase.ACTION, generation: 3, players: [{name: 'Alice', color: 'blue'}, {name: 'Bruno', color: 'red'}], createdTimeMs: 2},
  {id: 'g-beta' as GameId, name: 'Beta', phase: Phase.RESEARCH, generation: 1, players: [{name: 'Alice', color: 'green'}], createdTimeMs: 1},
];

let saves: Array<AdminRollbackSave> = [];
let requests: Array<{url: string, method: string}> = [];

function historyOf() {
  const last = saves[saves.length - 1];
  return {id: ALPHA, name: 'Alpha', currentSaveId: last.saveId, currentGeneration: last.generation, saves};
}

function mountUnderHost() {
  const closed = {count: 0};
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleAdminRollback, {
      ref: 'admin',
      name: 'Alice',
      onClose: () => {
        closed.count++;
      },
    })]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub, ConsoleScrollArea: ScrollStub}}});
  return {
    wrapper,
    closed,
    /** Exactly the menu's read: `(this.$refs.admin ?? undefined) as {handleIntent?: …} | undefined`. */
    reach: (): RollbackReach => {
      const admin = (wrapper.vm.$refs.admin ?? undefined) as RollbackReach | undefined;
      if (admin === undefined) {
        throw new Error('the host holds no ref to the rollback tool');
      }
      return admin;
    },
    cursor: () => wrapper.findAll('button.cm-game').map((row) => row.classes().includes('cm-game--cursor')),
    activeGen: () => wrapper.findAll('button.cm-admin__gen').filter((chip) => chip.classes().includes('cm-admin__gen--active')).map((chip) => chip.text()),
  };
}

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};

describe('ConsoleAdminRollback — the main menu\'s game-rollback tool', () => {
  let savedFetch: unknown;

  function resetStore(): void {
    clearAdminHistory();
    adminRollbackState.games = [];
    adminRollbackState.loadingGames = false;
    adminRollbackState.loadedGamesOnce = false;
    adminRollbackState.gamesError = false;
    adminRollbackState.loadingHistory = false;
    adminRollbackState.submitting = false;
  }

  beforeEach(() => {
    savedFetch = (globalThis as {fetch?: unknown}).fetch;
    kept = [];
    requests = [];
    saves = [
      {saveId: 0, generation: 1, phase: Phase.RESEARCH},
      {saveId: 1, generation: 1, phase: Phase.ACTION},
      {saveId: 2, generation: 2, phase: Phase.ACTION},
      {saveId: 3, generation: 3, phase: Phase.ACTION},
    ];
    (globalThis as {fetch?: unknown}).fetch = async (url: string, init?: {method?: string}) => {
      const u = String(url);
      requests.push({url: u, method: init?.method ?? 'GET'});
      const answer = (body: unknown) => ({ok: true, status: 200, json: async () => body, text: async () => ''});
      if (u.includes('api/admin/rollback/games')) {
        return answer(GAMES);
      }
      if (u.includes('api/admin/rollback/history')) {
        return answer(historyOf());
      }
      // The rollback itself: every save ahead of the chosen one is gone from now on.
      const saveId = Number(new URL(u, 'http://x').searchParams.get('saveId'));
      const before = saves.length;
      saves = saves.filter((save) => save.saveId <= saveId);
      const now = saves[saves.length - 1];
      return answer({id: ALPHA, saveId, generation: now.generation, phase: now.phase, currentSaveId: saveId, deletedSaves: before - saves.length});
    };
    resetStore();
  });

  afterEach(() => {
    (globalThis as {fetch?: unknown}).fetch = savedFetch;
    resetStore();
  });

  it('the LIST: every game with its fresh generation, phase and crew — asked by the player\'s name; the cursor on the first row', async () => {
    const {wrapper, cursor} = mountUnderHost();
    await flushPromises();
    expect(requests.map((r) => r.url), 'opening the tool is one refresh, carrying the name').to.deep.eq(['api/admin/rollback/games?name=Alice']);

    const dialog = wrapper.find('.cm-overlay');
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-label')).to.eq($t('Game rollback'));
    expect(dialog.find('.cm-overlay__title').text()).to.eq($t('Game rollback'));

    const rows = wrapper.findAll('.cm-gamelist > button.cm-game');
    expect(rows.map((row) => row.find('.cm-game__name').text())).to.deep.eq(['Alpha', 'Beta']);
    expect(rows.map((row) => row.find('.cm-admin__gen-pill').text())).to.deep.eq([`${$t('Gen')} 3`, `${$t('Gen')} 1`]);
    expect(rows.map((row) => row.find('.cm-admin__phase').text())).to.deep.eq([$t('Action'), $t('Research')]);
    expect(rows[0].find('.cm-admin__phase').classes()).to.include.members(['cm-admin__phase', 'cm-admin__phase--action']);
    expect(rows.map((row) => row.findAll('.cm-game__pname').map((name) => name.text()))).to.deep.eq([['Alice', 'Bruno'], ['Alice']]);
    expect(rows[0].findAll('.cm-game__pcube').map((cube) => cube.classes().includes('player_bg_color_blue'))).to.deep.eq([true, false]);
    expect(cursor()).to.deep.eq([true, false]);

    expect(wrapper.findAllComponents(GlyphStub).map((glyph) => glyph.props('control'))).to.deep.eq(['confirm', 'back']);
    expect(wrapper.findAll('.cm-overlay__foot-hint').map((hint) => hint.text())).to.deep.eq([$t('Open'), $t('Back')]);
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else; the pad THROUGH THE REF walks the list, keeps the cursored row in view, B closes', async () => {
    const {wrapper, reach, closed, cursor} = mountUnderHost();
    await flushPromises();
    const admin = reach();
    expect(Object.keys(admin), 'exactly what the tool exposes').to.deep.eq(['handleIntent']);
    expect(admin.handleIntent).to.be.a('function');
    const leaked = ['state', 'view', 'listCursor', 'games', 'openGameAt', 'doRollback', 'backToList', 'root', 'gamesScroll']
      .filter((key) => (admin as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);

    expect(admin.handleIntent(nav('down'))).to.eq(true);
    await nextTick();
    await nextTick();
    expect(cursor()).to.deep.eq([false, true]);
    // The scroll area (its own ref) is handed the row that wears the cursor — found inside the tool's own root.
    expect(kept).to.have.length(1);
    expect(kept[0], 'the cursored row').to.eq(wrapper.findAll('button.cm-game')[1].element);
    admin.handleIntent(nav('down'));
    await nextTick();
    expect(cursor(), 'the last row is a wall, never a wrap').to.deep.eq([false, true]);

    expect(admin.handleIntent(B)).to.eq(true);
    expect(closed.count, 'B on the list closes the tool').to.eq(1);
  });

  it('A opens a game at its LATEST save; ◀ picks an earlier point; A asks, A rolls back — the saves ahead are gone, B returns to a refreshed list', async () => {
    const {wrapper, reach, closed, cursor, activeGen} = mountUnderHost();
    await flushPromises();
    const admin = reach();
    admin.handleIntent(A);
    await flushPromises();
    expect(requests[1].url, 'the history of the game under the cursor').to.eq('api/admin/rollback/history?id=g-alpha&name=Alice');
    expect(wrapper.find('.cm-admin__detailname').text()).to.eq('Alpha');
    expect(wrapper.findAll('button.cm-admin__gen').map((chip) => chip.text()), 'one chip per generation').to.deep.eq(['1', '2', '3']);
    expect(activeGen(), 'the target starts on the latest save').to.deep.eq(['3']);
    expect(wrapper.find('.cm-admin__target--noop').text()).to.eq($t('This is already the latest state.'));
    admin.handleIntent(A);
    await nextTick();
    expect(wrapper.find('.cm-admin__confirm').exists(), 'nothing to roll back — A asks nothing').to.eq(false);

    // ◀ on the generation row: the FIRST save of the generation before.
    admin.handleIntent(nav('left'));
    await nextTick();
    expect(activeGen()).to.deep.eq(['2']);
    expect(wrapper.find('.cm-admin__target').text()).to.contain(translateTextWithParams('deletes ${0} save(s)', ['1']));
    // ▼ moves the focus to the save slider; ◀ there steps ONE save.
    admin.handleIntent(nav('down'));
    admin.handleIntent(nav('left'));
    await nextTick();
    expect(wrapper.findAll('.cm-admin__section').map((section) => section.classes().includes('cm-admin__section--focus'))).to.deep.eq([false, true]);
    expect(activeGen()).to.deep.eq(['1']);
    expect(wrapper.find('.cm-admin__target').text()).to.contain(translateTextWithParams('deletes ${0} save(s)', ['2']));

    // A asks; B takes the question back; A, A rolls back.
    admin.handleIntent(A);
    await nextTick();
    expect(wrapper.find('.cm-admin__confirm-q').text()).to.eq(translateTextWithParams('Delete ${0} save(s) and roll back? This cannot be undone.', ['2']));
    admin.handleIntent(B);
    await nextTick();
    expect(wrapper.find('.cm-admin__confirm').exists()).to.eq(false);
    expect(closed.count, 'B inside the detail never closes the tool').to.eq(0);
    admin.handleIntent(A);
    admin.handleIntent(A);
    await flushPromises();
    expect(requests.filter((r) => r.method === 'POST').map((r) => r.url), 'ONE rollback, to the chosen save').to.deep.eq(['api/admin/rollback?id=g-alpha&saveId=1&name=Alice']);
    expect(saves.map((save) => save.saveId), 'the saves ahead are deleted').to.deep.eq([0, 1]);
    expect(wrapper.find('.cm-admin__result').text()).to.contain($t('Rolled back to'));
    expect(wrapper.find('.cm-admin__confirm').exists(), 'the banner replaced the question').to.eq(false);

    // Any confirm / back on the banner returns to the list — which is asked again, because a rollback happened.
    admin.handleIntent(B);
    await flushPromises();
    expect(cursor(), 'the list again, the cursor where it was').to.deep.eq([true, false]);
    expect(requests.filter((r) => r.url.includes('rollback/games'))).to.have.length(2);
    expect(closed.count).to.eq(0);
  });
});
