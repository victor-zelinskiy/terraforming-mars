/*
 * ConsoleJournalPanel — the console-native journal surface. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): the shell stands it in its surface registry and reads exactly ONE member off that
 * ref — `handleIntent`, the panel's whole controller grammar (padRouterController hands the pad to it). Mounted here
 * the way a parent holds it — under a host with a string ref — over a stubbed feed endpoint: what it renders while
 * the feed loads and once it answered, what a parent's ref sees, and the grammar's own verbs (the d-pad's focus walk
 * kept in view through the scroll area, R3's player filter, the detail mode, the generation step, a press with
 * nothing to inspect) with the command bar's mirror following and reset on the way out.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleJournalPanel from '@/client/components/console/ConsoleJournalPanel.vue';
import {consoleJournalUi} from '@/client/console/consoleJournalState';
import {journalState} from '@/client/components/journal/journalState';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {paths} from '@/common/app/paths';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/** What the shell reads through its ref — the component's whole contract with its parent. */
type JournalPanelReach = {handleIntent(intent: GamepadIntent): void};

/** What the panel asked of the scroll area its feed stands in, in order. */
type ScrollCalls = {toEnd: number, ensured: Array<Element | null | undefined>};

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);
const line = (message: string, color: string, at: number): LogMessage =>
  ({message, data: [{type: LogMessageDataType.PLAYER, value: color}], timestamp: T0 + at}) as unknown as LogMessage;
/** One generation's log: its divider (never focusable), then a line of each seat. */
const LOGS: ReadonlyArray<LogMessage> = [
  {type: LogMessageType.NEW_GENERATION, message: 'Generation ${0}', data: [], timestamp: T0} as unknown as LogMessage,
  line('Ada acts', 'red', 60_000),
  line('Bo acts', 'blue', 120_000),
];

function view(players: ReadonlyArray<{name: string, color: string}>, generation: number = 3): PlayerViewModel {
  return {id: 'p-viewer', game: {generation}, players, thisPlayer: {color: 'red'}} as unknown as PlayerViewModel;
}
const TWO_SEATS = [{name: 'Ada', color: 'red'}, {name: 'Bo', color: 'blue'}];

// The rows are the shared journal renderers (specs of their own); this spec is about the PANEL — which rows it
// renders, which one carries the cursor. (Render functions, not template strings: no runtime compiler in this build.)
const EntryStub = defineComponent({
  name: 'JournalEntry',
  props: {message: {type: Object as PropType<LogMessage>, required: true}, timeShown: Boolean, players: Array},
  render() {
    return h('li', {class: 'entry-stub'}, this.message.message);
  },
});

// The scroll area is a primitive with a spec of its own; the stand-in renders the slot and exposes the two functions
// the panel reads through its `ref="scroll"`.
function scrollAreaStub(calls: ScrollCalls) {
  return defineComponent({
    name: 'ConsoleScrollArea',
    props: {contentClass: {type: String, default: ''}},
    setup(props, {slots, expose}) {
      expose({
        scrollToEnd: () => {
          calls.toEnd++;
        },
        ensureVisible: (el: Element | null | undefined) => {
          calls.ensured.push(el);
        },
      });
      return () => h('div', {class: 'scroll-stub'}, [h('div', {class: props.contentClass}, slots.default?.())]);
    },
  });
}

describe('ConsoleJournalPanel — the console\'s journal surface', () => {
  /** Every request the feed made, and the answers still owed to them. */
  let requests: Array<string> = [];
  /** The LOG requests among them, each as the route's own query (whatever base the runtime puts before the path). */
  const logQueries = () => requests.filter((url) => url.includes(paths.API_GAME_LOGS)).map((url) => url.slice(url.indexOf('?')));
  let pending: Array<{url: string, resolve: (response: unknown) => void}> = [];
  let realFetch: typeof globalThis.fetch;

  /** Answer every open request the way the two routes do: the generation's log, and no structured events. */
  async function answerFeed(logs: ReadonlyArray<LogMessage> = LOGS): Promise<void> {
    for (const {url, resolve} of pending.splice(0)) {
      const body = url.includes(paths.API_GAME_JOURNAL_EVENTS) ? [] : logs;
      resolve({ok: true, status: 200, json: () => Promise.resolve(body)});
    }
    await flushPromises();
  }

  function mountUnderHost(playerView: PlayerViewModel) {
    const calls: ScrollCalls = {toEnd: 0, ensured: []};
    const notices: Array<string> = [];
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleJournalPanel, {ref: 'journalPanel', playerView, onNotice: (text: string) => notices.push(text)})]),
    });
    const wrapper = mount(Host, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: {ConsoleScrollArea: scrollAreaStub(calls), JournalEntry: EntryStub, JournalGroup: true, GamepadGlyph: true, BarButtonIcon: true},
      },
    });
    return {
      wrapper,
      calls,
      notices,
      /** Exactly the shell's read: the surface standing under its ref. */
      reach: () => (wrapper.vm.$refs.journalPanel ?? undefined) as JournalPanelReach | undefined,
      rows: () => wrapper.findAll('.con-journal__list > .entry-stub'),
    };
  }

  beforeEach(() => {
    requests = [];
    pending = [];
    realFetch = globalThis.fetch;
    globalThis.fetch = ((url: unknown) => {
      requests.push(String(url));
      return new Promise((resolve) => {
        pending.push({url: String(url), resolve});
      });
    }) as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    // The detail mode is a MODULE (it outlives the panel by design): the LB/RB test leaves it as it found it.
    journalState.detail = 'detailed';
  });

  it('mounts over a loading feed, then renders the generation\'s rows — the cursor on the tail, the list sent to its end', async () => {
    const {wrapper, calls, rows} = mountUnderHost(view(TWO_SEATS));
    await nextTick();

    const panel = wrapper.find('aside.con-journal');
    expect(panel.attributes('role')).to.eq('complementary');
    expect(panel.attributes('aria-label')).to.eq('Journal');
    expect(panel.find('.con-journal__title').text()).to.eq('Journal');
    expect(panel.find('.con-journal__gen-label b').text(), 'the live generation').to.eq('3');
    expect(panel.find('.con-journal__live-dot').classes(), 'following the latest').to.not.contain('con-journal__live-dot--off');
    expect(panel.find('.con-journal__mode-seg--active').text()).to.eq('Detailed');
    expect(panel.find('.con-journal__placeholder').text(), 'the feed is asked, not empty').to.contain('Loading');
    expect(logQueries(), 'the viewer\'s log of this generation, asked once').to.deep.eq(['?id=p-viewer&generation=3']);

    await answerFeed();

    expect(panel.find('.con-journal__placeholder').exists()).to.eq(false);
    expect(rows().map((r) => r.text())).to.deep.eq(['Generation ${0}', 'Ada acts', 'Bo acts']);
    expect(rows().every((r) => r.classes().includes('con-journal__node'))).to.eq(true);
    expect(rows().map((r) => r.classes().includes('con-journal__node--focused')), 'a fresh list lands at its tail').to.deep.eq([false, false, true]);
    expect(calls.toEnd, 'through the scroll area\'s own API').to.eq(1);
  });

  it('a PARENT\'s ref sees exactly `handleIntent` — the grammar, and nothing else of the script', async () => {
    const {reach} = mountUnderHost(view(TWO_SEATS));
    await answerFeed();

    const panel = reach();
    expect(panel, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(panel!), 'the exposed list is the contract').to.deep.eq(['handleIntent']);
    for (const inner of ['source', 'filter', 'focusIndex', 'openFilter', 'moveFocus', 'props']) {
      expect((panel as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }
    expect(panel!.handleIntent).to.be.a('function');
  });

  it('the d-pad walks the focus over the rows — the generation divider skipped — and hands the cursor\'s row to the scroll area', async () => {
    const {reach, calls, rows} = mountUnderHost(view(TWO_SEATS));
    await answerFeed();

    reach()!.handleIntent({kind: 'nav', dir: 'up', repeat: false});
    await flushPromises();
    expect(rows().map((r) => r.classes().includes('con-journal__node--focused'))).to.deep.eq([false, true, false]);
    expect(calls.ensured.length).to.eq(1);
    expect(calls.ensured[0], 'the row\'s own node, read off the list after the re-render').to.eq(rows()[1].element);

    // Above it stands only the divider: the walk has nowhere to go and asks for nothing.
    reach()!.handleIntent({kind: 'nav', dir: 'up', repeat: false});
    await flushPromises();
    expect(rows().map((r) => r.classes().includes('con-journal__node--focused'))).to.deep.eq([false, true, false]);
    expect(calls.ensured.length).to.eq(1);
  });

  it('R3 opens the player filter; the d-pad and A choose a seat — the chip names it, the feed is theirs, the bar\'s mirror follows', async () => {
    const {wrapper, reach, rows} = mountUnderHost(view(TWO_SEATS));
    await answerFeed();
    expect(consoleJournalUi.filterAvailable, 'two seats: the filter is meaningful').to.eq(true);
    expect(wrapper.find('.con-journal__filter').classes()).to.not.contain('con-journal__filter--active');

    reach()!.handleIntent({kind: 'press', button: 'stickR'});
    await nextTick();
    const options = () => wrapper.findAll('.con-journal__filterpop-row');
    expect(options().map((o) => o.find('.con-journal__filterpop-label').text())).to.deep.eq(['All', 'Ada', 'Bo', 'Opponents only']);
    expect(options().map((o) => o.classes().includes('con-journal__filterpop-row--focused')), 'the cursor opens on the filter in force')
      .to.deep.eq([true, false, false, false]);
    expect(consoleJournalUi.filterOpen, 'the command bar reads the mirror').to.eq(true);

    reach()!.handleIntent({kind: 'nav', dir: 'down', repeat: false});
    reach()!.handleIntent({kind: 'nav', dir: 'down', repeat: false});
    reach()!.handleIntent({kind: 'press', button: 'confirm'});
    await flushPromises();

    expect(wrapper.find('.con-journal__filterpop').exists(), 'A applies and closes').to.eq(false);
    expect(consoleJournalUi.filterOpen).to.eq(false);
    expect(wrapper.find('.con-journal__filter').classes()).to.contain('con-journal__filter--active');
    expect(wrapper.find('.con-journal__filter-label').text()).to.eq('Bo');
    expect(wrapper.find('.con-journal__filter .con-status__dot').classes()).to.contain('player_bg_color_blue');
    expect(rows().map((r) => r.text()), 'only the rows that name the seat').to.deep.eq(['Bo acts']);
    expect(rows()[0].classes(), 'a re-keyed list lands at its tail').to.contain('con-journal__node--focused');

    // Reopened, the cursor stands on the filter in force; B is a LOCAL back.
    reach()!.handleIntent({kind: 'press', button: 'stickR'});
    await nextTick();
    expect(options().map((o) => o.classes().includes('con-journal__filterpop-row--selected'))).to.deep.eq([false, false, true, false]);
    expect(options().map((o) => o.classes().includes('con-journal__filterpop-row--focused'))).to.deep.eq([false, false, true, false]);
    reach()!.handleIntent({kind: 'press', button: 'back'});
    await nextTick();
    expect(wrapper.find('.con-journal__filterpop').exists()).to.eq(false);
    expect(wrapper.find('.con-journal__filter-label').text(), 'a back changes nothing').to.eq('Bo');
  });

  it('with one seat there is no filter: R3 says so through `notice`; X on a row with nothing to inspect says that', async () => {
    const {wrapper, reach, notices} = mountUnderHost(view([{name: 'Ada', color: 'red'}]));
    await answerFeed();
    expect(wrapper.find('.con-journal__filter').exists()).to.eq(false);
    expect(consoleJournalUi.filterAvailable).to.eq(false);

    reach()!.handleIntent({kind: 'press', button: 'stickR'});
    await nextTick();
    expect(wrapper.find('.con-journal__filterpop').exists()).to.eq(false);
    expect(notices).to.deep.eq(['Unavailable right now']);

    reach()!.handleIntent({kind: 'press', button: 'secondary'});
    await nextTick();
    expect(notices).to.deep.eq(['Unavailable right now', 'Nothing to inspect in this entry']);
    expect(wrapper.find('.con-journal__inspect').exists()).to.eq(false);
  });

  it('the bumpers set the detail mode; the left trigger steps a generation back — a new request, no longer live', async () => {
    const {wrapper, reach} = mountUnderHost(view(TWO_SEATS));
    await answerFeed();
    expect(consoleJournalUi.canPrevGen, 'generation 3 has a past').to.eq(true);
    expect(consoleJournalUi.canNextGen, 'and no future').to.eq(false);

    reach()!.handleIntent({kind: 'press', button: 'bumperR'});
    await nextTick();
    expect(journalState.detail).to.eq('summary');
    expect(wrapper.find('.con-journal__mode-seg--active').text()).to.eq('Summary');

    requests.length = 0;
    reach()!.handleIntent({kind: 'press', button: 'triggerL'});
    await nextTick();
    expect(logQueries()).to.deep.eq(['?id=p-viewer&generation=2']);
    expect(wrapper.find('.con-journal__gen-label b').text()).to.eq('2');
    expect(wrapper.find('.con-journal__live-dot').classes(), 'history is not live').to.contain('con-journal__live-dot--off');
    expect(consoleJournalUi.canNextGen, 'the mirror: RT has somewhere to go').to.eq(true);
  });

  it('leaving resets the command bar\'s mirror — nothing of a closed journal stays lit', async () => {
    const {wrapper, reach} = mountUnderHost(view(TWO_SEATS));
    await answerFeed();
    reach()!.handleIntent({kind: 'press', button: 'stickR'});
    await nextTick();
    expect(consoleJournalUi.filterOpen).to.eq(true);
    expect(consoleJournalUi.filterAvailable).to.eq(true);

    wrapper.unmount();

    expect({...consoleJournalUi}).to.deep.eq({
      filterOpen: false, inspectOpen: false, peekActive: false, focusIsGroup: false, focusExpanded: false,
      focusInspectable: false, focusHasSpace: false, canPrevGen: false, canNextGen: false, filterAvailable: false,
    });
  });
});
