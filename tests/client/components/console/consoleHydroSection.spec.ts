/*
 * ConsoleHydroSection — the console's «Гидросеть Марса» workspace: the track that always stands, and the scenes of
 * ONE flow under it. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). Its flows — the bonus
 * zone, a card's entry, the movement bonus, the landing stage's target pick, the terminal ceremony — are the subjects
 * of the five specs beside this one (`consoleHydroBonusZone`, `consoleHydroCardEntry`, `consoleHydroMovementBonus`,
 * `consoleHydroTargetPick`, `consoleHydroTerminalStage`) and of its e2e; this spec pins what the CONVERSION must keep
 * and none of them can see (they read the whole setup state through `wrapper.vm`):
 *  - it mounts in a minimal honest state with no Vue warning (`globalConfig` turns one into a failure): the twelve
 *    stops, the marker's cell under the cursor, the plan scene — and its command contract is published at SETUP
 *    (an `immediate` watcher: the bar never waits for a mount);
 *  - the shell's surface registry reaches EXACTLY what the component exposes (R11) — `handleIntent`, the one member
 *    the pad router calls, and `statusLabel`, which only unit specs read — and each answers through a parent's ref;
 *  - what it raised in setup and on mount it takes back when it leaves.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, reactive} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import {resetHydroFlow} from '@/client/console/hydroFlow/consoleHydroFlow';
import {resetHydroMarker} from '@/client/console/hydroMarker/consoleHydroMarker';
import {hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import ConsoleHydroSection from '@/client/components/console/ConsoleHydroSection.vue';

/** What a parent's ref on the section answers (the component's `defineExpose`). */
type HydroSurface = {
  handleIntent(intent: GamepadIntent): void,
  /** An exposed computed arrives UNWRAPPED. */
  statusLabel: string,
};
const EXPOSED = ['handleIntent', 'statusLabel'];

function viewerPlayer(position: number) {
  return {
    color: 'red',
    name: 'Viewer',
    steel: 1, plants: 2, titanium: 0, energy: 3, heat: 0, megacredits: 10,
    megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0,
    plantProduction: 0, energyProduction: 1, heatProduction: 0,
    tags: {},
    tableau: [],
    deltaProject: {position, stops: []},
  };
}

/** The viewer stands on stop 3; no prompt is on the wire and no preview has been fetched (`id: ''` — none is asked). */
function playerView(): PlayerViewModel {
  const viewer = viewerPlayer(3);
  return {id: '', thisPlayer: viewer, players: [viewer], game: {}, waitingFor: undefined} as unknown as PlayerViewModel;
}

// The children with specs of their own (the same list the five flow specs stub).
const STUBS = {
  ConsoleWsHead: true, ConsoleCardFaceLite: true, ConsoleSourceDock: true, ConsolePlayedTargetStep: true,
  GamepadGlyph: true, HydroReward: true, ConsolePaymentPanel: true,
};
const GLOBAL = {...globalConfig.global, stubs: STUBS};

function stopsOf(wrapper: {findAll(selector: string): Array<{attributes(name: string): string | undefined}>}, selector: string): Array<string | undefined> {
  return wrapper.findAll(selector).map((stop) => stop.attributes('data-hydro-stop'));
}

describe('ConsoleHydroSection — the console\'s Hydronetwork workspace', () => {
  // Module state is BUNDLE-SHARED: the plan, the flow and the marker are modules the section reads and writes.
  function resetModules(): void {
    resetHydroFlow();
    resetHydroMarker();
    resetHydroPlan();
    hydroNetworkState.previewColor = undefined as never;
    hydroNetworkState.preview = undefined;
    consoleHydroUi.repeatResult = undefined;
    consoleHydroUi.commands = [];
  }
  beforeEach(resetModules);
  afterEach(resetModules);

  it('mounts in a minimal honest state with no Vue warning: the track, the marker\'s cell, the plan scene', async () => {
    const wrapper = mount(ConsoleHydroSection, {props: {playerView: playerView()}, global: GLOBAL});
    await nextTick();

    expect(wrapper.element.tagName).to.eq('SECTION');
    expect(wrapper.classes(), 'a workspace surface: the band marker class stands on the root').to.include.members(['con-hydro', 'con-ws']);
    expect(wrapper.attributes('role')).to.eq('region');
    expect(stopsOf(wrapper, '[data-hydro-stop]'), 'the whole track, start included').to.deep.eq(
      ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
    expect(stopsOf(wrapper, '.con-hydro__stop--focused'), 'the cursor opens on the marker\'s own cell').to.deep.eq(['3']);
    expect(wrapper.find('.con-hydro__scene').exists(), 'the scene under the track').to.eq(true);
    expect(wrapper.find('[data-embed-slot="hydro"]').exists(), 'the embed zone belongs to the commit scene').to.eq(false);
    expect(wrapper.emitted(), 'a mount asks nothing of the shell').to.deep.eq({});
    expect(consoleHydroUi.commands.length, 'the command contract is published — the bar never guesses').to.be.greaterThan(0);
  });

  it('the shell\'s surface registry reaches EXACTLY what the section exposes — and each member answers', async () => {
    const closed: Array<true> = [];
    const collapsed: Array<true> = [];
    const state = reactive({actionAvailable: false});
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleHydroSection, {
        ref: 'hydro',
        playerView: playerView(),
        actionAvailable: state.actionAvailable,
        onClose: () => closed.push(true),
        onCollapse: () => collapsed.push(true),
      })]),
    });
    const host = mount(Host, {global: GLOBAL});
    await nextTick();
    const surface = host.vm.$refs.hydro as HydroSurface;
    expect(Object.keys(surface as object).sort(), 'defineExpose: the pad router\'s one member + the specs\' reading').to.deep.eq(EXPOSED);

    // handleIntent — the pad router hands the section every intent while it owns the pad (`handedTo`): the d-pad
    // walks the track…
    surface.handleIntent({kind: 'nav', dir: 'left', repeat: false});
    await nextTick();
    expect(stopsOf(host, '.con-hydro__stop--focused'), 'a passed stage is browsable').to.deep.eq(['2']);
    expect(hydroNetworkState.selectedPosition, 'the cursor is the shared plan\'s').to.eq(2);
    surface.handleIntent({kind: 'nav', dir: 'right', repeat: false});
    await nextTick();
    expect(stopsOf(host, '.con-hydro__stop--focused'), 'and back onto the marker\'s cell').to.deep.eq(['3']);
    // …and B on the browse layer closes the workspace (nothing is owed: it does not collapse).
    surface.handleIntent({kind: 'press', button: 'back'});
    expect(closed, 'B closes').to.have.length(1);
    expect(collapsed, 'B never collapses a browse layer').to.have.length(0);

    // statusLabel — an exposed computed arrives unwrapped, and follows what it reads.
    expect(surface.statusLabel).to.eq('Not your turn');
    state.actionAvailable = true;
    await nextTick();
    expect(surface.statusLabel).to.eq('Reinforcement available');
  });

  it('takes back what it raised when it leaves', async () => {
    const wrapper = mount(ConsoleHydroSection, {props: {playerView: playerView()}, global: GLOBAL});
    await nextTick();
    expect(consoleHydroUi.commands.length).to.be.greaterThan(0);

    wrapper.unmount();
    expect(consoleHydroUi.commands, 'the bar is handed back empty').to.deep.eq([]);
  });
});
