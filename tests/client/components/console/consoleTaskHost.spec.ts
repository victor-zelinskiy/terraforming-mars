import {mount, VueWrapper} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {panelCommands} from '@/client/console/consolePanelUi';
import {resetPromptSequence} from '@/client/console/promptSequence';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

/*
 * THE TASK HOST AS A COMPONENT (`<script setup>`): it stands in a minimal honest state with no warning (the shared
 * config turns a Vue warning into a throw), a parent's ref sees exactly what the shell's pad router calls
 * (`handleIntent` — `padRouterController.ts`), and its own grammar answers the pad. What the host DECIDES is the
 * subject of the stub specs beside this one (`taskHostDecline` · `taskHostResetEpoch` · `taskHostResourcePalette` ·
 * `consoleDeltaStepper` · `consoleBuyPayStage` · `consoleBuyCost` — the functions of `consoleTaskHostLogic.ts`); the
 * mounts below also prove the PORT the component hands those functions: read through it, written through it.
 */

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const RT: GamepadIntent = {kind: 'press', button: 'triggerR'};
const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

const option = (title: string, metadata?: unknown) => ({type: 'option', title, buttonLabel: 'Confirm', metadata});
const choice = (promptId: number, options: ReadonlyArray<unknown>) =>
  ({type: 'or', title: 'Select one option', buttonLabel: 'Confirm', promptId, options} as unknown as PlayerInputModel);

function viewOf(waitingFor: PlayerInputModel): PlayerViewModel {
  const thisPlayer = fakePublicPlayerModel({megacredits: 12});
  return fakePlayerViewModel({thisPlayer, players: [thisPlayer], waitingFor} as Partial<PlayerViewModel>);
}

const CHOICE: ConsoleTask = {kind: 'choice', flavor: 'generic'};

/** What the specs read of the host's own state (`wrapper.vm` reaches the setup state in a test build). */
type HostState = {
  handleIntent(intent: GamepadIntent): void,
  focusIdx: number,
  armed: boolean,
  value: number,
};

function mountHost(waitingFor: PlayerInputModel, task: ConsoleTask = CHOICE): VueWrapper {
  return mount(ConsoleTaskHost, {...globalConfig, props: {playerView: viewOf(waitingFor), task}});
}

const stateOf = (wrapper: VueWrapper): HostState => wrapper.vm as unknown as HostState;

describe('ConsoleTaskHost', () => {
  // A standing plate presents itself to the press's decision sequence (module state) — hand it back clean.
  afterEach(() => resetPromptSequence());

  it('stands a generic choice — the question in the head, one row per answer, its verbs on the command bar', async () => {
    const wrapper = mountHost(choice(1, [option('Gain 3 plants'), option('Gain 2 steel')]));
    await nextTick();
    const root = wrapper.find('.con-task-host');
    expect(root.exists()).is.true;
    expect(root.attributes('role')).to.eq('dialog');
    expect(root.attributes('aria-label')).to.eq('Select one option');
    expect(root.classes(), 'standalone: the workspace-family marker').to.include('con-ws');
    expect(wrapper.find('.con-prompt-head__title').text()).to.eq('Select one option');
    expect(wrapper.text()).to.include('Gain 3 plants').and.to.include('Gain 2 steel');
    // The contract is published to the shell's ONE command bar — and taken back with the host.
    expect((panelCommands('taskHost') ?? []).map((c) => c.control)).to.include('back');
    wrapper.unmount();
    expect(panelCommands('taskHost')).to.eq(undefined);
  });

  it('exposes exactly `handleIntent` — what the shell\'s pad router calls through the surface registry', () => {
    const Host = defineComponent({
      render() {
        return h('div', [h(ConsoleTaskHost, {ref: 'child', playerView: viewOf(choice(2, [option('a'), option('b')])), task: CHOICE})]);
      },
    });
    const host = mount(Host, {...globalConfig});
    const child = host.vm.$refs.child as Record<string, unknown>;
    expect(Object.keys(child)).to.deep.eq(['handleIntent']);
    expect(child.handleIntent).to.be.a('function');
    // …and it IS the input path: a d-pad step through the parent's ref moves the host's cursor.
    (child.handleIntent as (intent: GamepadIntent) => void)(nav('down'));
    expect(stateOf(host.findComponent(ConsoleTaskHost)).focusIdx).to.eq(1);
  });

  it('a generic choice is select → confirm: A arms the focused row, A again answers it — once', () => {
    const wrapper = mountHost(choice(3, [option('Gain 3 plants'), option('Gain 2 steel')]));
    const host = stateOf(wrapper);
    host.handleIntent(nav('down'));
    host.handleIntent(A);
    expect(host.armed, 'the first A only arms').is.true;
    expect(wrapper.emitted('submit')).to.eq(undefined);
    host.handleIntent(A);
    expect(wrapper.emitted('submit')).to.deep.eq([[{type: 'or', index: 1, response: {type: 'option'}}]]);
    // The answer is in flight: another press sends nothing.
    host.handleIntent(A);
    host.handleIntent(A);
    expect(wrapper.emitted('submit')).to.have.length(1);
  });

  it('B sets the question aside — `defer`, nothing answered', () => {
    const wrapper = mountHost(choice(4, [option('a'), option('b')]));
    stateOf(wrapper).handleIntent(B);
    expect(wrapper.emitted('defer')).to.have.length(1);
    expect(wrapper.emitted('submit')).to.eq(undefined);
  });

  it('an optional choice declines on RT and its refusal is no row (the decline, read through the host\'s port)', async () => {
    const wrapper = mountHost(choice(5, [
      option('Remove from red', {player: {color: 'red'}}),
      option('Do not remove', {kind: 'skip'}),
      option('Remove from green', {player: {color: 'green'}}),
    ]));
    await nextTick();
    expect(wrapper.text()).to.include('Remove from red').and.to.include('Remove from green');
    expect(wrapper.find('[data-choice-skip="1"]').exists(), 'the refusal left the rows').is.false;
    // The bar names it on RT, just before the way back.
    const bar = panelCommands('taskHost') ?? [];
    const at = bar.findIndex((c) => c.control === 'triggerR');
    expect(bar[at]?.label).to.eq('Do not remove');
    expect(bar[at + 1]?.control).to.eq('back');
    stateOf(wrapper).handleIntent(RT);
    expect(wrapper.emitted('submit')).to.deep.eq([[{type: 'or', index: 1, response: {type: 'option'}}]]);
  });

  it('the Hydronetwork stepper dials along the server\'s sparse list (the dial writes the host\'s state through the port)', () => {
    const steps = {type: 'deltaProject', title: 'Move the marker', buttonLabel: 'Move', promptId: 6, validSteps: [3, 1]} as unknown as PlayerInputModel;
    const wrapper = mountHost(steps, {kind: 'amount', flavor: 'delta'});
    const host = stateOf(wrapper);
    expect(host.value, 'opens at the safe floor').to.eq(1);
    host.handleIntent(nav('right'));
    expect(host.value, 'up from 1 skips the blocked 2').to.eq(3);
    host.handleIntent(nav('right'));
    expect(host.value, 'clamped at the top').to.eq(3);
    host.handleIntent(nav('left'));
    expect(host.value).to.eq(1);
    host.handleIntent(A);
    expect(wrapper.emitted('submit')).to.deep.eq([[{type: 'deltaProject', amount: 1}]]);
  });
});
