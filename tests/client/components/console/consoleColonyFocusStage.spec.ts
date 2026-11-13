import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectOptionModel} from '@/common/models/PlayerInputModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import ConsoleColonyFocusStage from '@/client/components/console/ConsoleColonyFocusStage.vue';
import {colonyFocusState, consoleColoniesUi, openColonyFocus, resetColonyFocus, resetConsoleColoniesUi} from '@/client/console/consoleColoniesModel';
import {resetColonyTrade} from '@/client/console/colonyTrade/consoleColonyTrade';
import {resetOutcomeOrigin} from '@/client/console/consoleActionOutcomeMotion';

/*
 * THE COLONY FOCUS STAGE — the ONE detail surface behind every colony verb (`docs/claude/console/colony-focus-stage.md`).
 *
 * What this spec owns (the stage is `<script setup>` — docs/claude/vapor/RECIPES.md § 3, a LARGE surface): it mounts
 * in its minimal honest state without a warning, its setup runs in the order the Options API created things (the
 * `immediate` watchers fire during setup and read only what stands above them), its parent's ref reaches exactly
 * what the section reads, and the verbs of its own that need no server — the act's confirm, the cancel, the commit
 * boundary's pin and its release. The scene itself (the fleet, the marker's glide, the rewards, the build cube) is
 * the e2e probes' (`console-colony-*`).
 */
const RED: Color = 'red';
const BLUE: Color = 'blue';

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const X: GamepadIntent = {kind: 'press', button: 'secondary'};

const energyPath = {type: 'option', title: 'Pay 3 energy', buttonLabel: 'Pay', metadata: {icon: 'energy', amount: 3, resource: {current: 6, resulting: 3}}} as unknown as SelectOptionModel;

function luna(over: Partial<ColonyModel> = {}): ColonyModel {
  return {name: ColonyName.LUNA, isActive: true, trackPosition: 2, visitor: undefined, colonies: [RED, BLUE], ...over};
}

function players(): Array<PublicPlayerModel> {
  return [
    {color: RED, name: 'Ada', megacredits: 20, energy: 6, steel: 0, titanium: 0, heat: 0, plants: 0, terraformRating: 20, tableau: []} as unknown as PublicPlayerModel,
    {color: BLUE, name: 'Bo', tableau: []} as unknown as PublicPlayerModel,
  ];
}

/** A trade the server offers on Luna: one usable path, nothing to decide (no preview is on the wire yet). */
function tradeProps(): Record<string, unknown> {
  const seats = players();
  return {colony: luna(), intent: 'trade', actionAvailable: true, options: [energyPath], players: seats, thisPlayer: seats[0], viewerColor: RED};
}

function mountStage(props: Record<string, unknown> = {}): VueWrapper<any> {
  return mount(ConsoleColonyFocusStage, {
    global: {...globalConfig.global},
    props: {colony: luna(), ...props},
  });
}

describe('ConsoleColonyFocusStage', () => {
  let originalTranslations: unknown;

  beforeEach(() => {
    originalTranslations = (window as any)._translations;
    (window as any)._translations = {};
  });

  afterEach(() => {
    (window as any)._translations = originalTranslations;
    resetColonyFocus();
    resetConsoleColoniesUi();
    resetColonyTrade();
    resetOutcomeOrigin();
  });

  it('mounts in its minimal honest state — a colony and nothing else — without a warning', () => {
    const warnings: Array<string> = [];
    const warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warnings.push(args.map(String).join(' '));
    };
    let stage: VueWrapper<any>;
    try {
      openColonyFocus(ColonyName.LUNA, 'inspect');
      stage = mountStage();
    } finally {
      console.warn = warn;
    }
    expect(warnings, 'no Vue warning: every ref, directive and child resolves').to.deep.eq([]);
    const root = stage.find('.con-colfocus');
    expect(root.exists(), 'the template starts with its root').to.eq(true);
    expect(stage.element, 'ONE root — the comment that opened the template lives in the script').to.eq(root.element);
    expect(root.classes()).to.include('con-colfocus--inspect');
    expect(root.attributes('data-colony-intent')).to.eq('inspect');
    expect(stage.find('[data-fleet-berth]').attributes('data-fleet-berth'), 'the hero planet carries the live berth').to.eq(ColonyName.LUNA);
    expect(stage.find('.con-colfocus__main').exists(), 'the track instrument\'s column stands').to.eq(true);
    expect(stage.find('.con-colfocus__payrow').exists(), 'an inspection has no payment skeleton').to.eq(false);
    expect(stage.find('.con-colfocus__verdict').text(), 'nothing is offered: the honest verdict').to.contain('Trade unavailable');
    expect(colonyFocusState.stage, 'the stage names the crumb\'s tail — it never titles itself').to.eq('Inspection');
  });

  it('setup runs in the Options order: the `immediate` watchers fire before the mount and read what stands above them', () => {
    // A bar left by somebody else: the stage's own (empty) one must replace it at creation.
    (consoleColoniesUi as {composerVenusBar: ReadonlyArray<unknown>}).composerVenusBar = ['stale'];
    const stage = mountStage(tradeProps());
    // `chosenPathOffset` — immediate: the path's reach is named before the first preview is fetched.
    expect(stage.emitted('path-offset'), 'one emit, at creation').to.deep.eq([[0]]);
    // `venusBar` — immediate: the bar's mirror is written at creation (no inner step stands).
    expect(consoleColoniesUi.composerVenusBar).to.deep.eq([]);
    // `mounted`: the mirror the shell's bar reads.
    expect(consoleColoniesUi.composerReady, 'one path, nothing to decide — the trade is confirmable').to.eq(true);
    expect(consoleColoniesUi.composerSub).to.eq('');
    stage.unmount();
    expect(consoleColoniesUi.composerReady, 'a stage that is gone claims nothing of the bar').to.eq(false);
  });

  it('a TRADE: the usable path is a row, X is the one final confirm with ONE payload, B cancels', async () => {
    openColonyFocus(ColonyName.LUNA, 'trade');
    const stage = mountStage(tradeProps());
    expect(stage.find('.con-colfocus').classes()).to.include('con-colfocus--trade');
    expect(colonyFocusState.stage).to.eq('Trading');
    expect(stage.findAll('.con-colfocus__payrow'), 'the server\'s one path').to.have.lengthOf(1);
    expect(stage.find('.con-colfocus__payrow-title').text()).to.eq('Pay 3 energy');
    expect(stage.find('.con-colfocus__verdict').text()).to.contain('Trade available');

    stage.vm.handleIntent(A);
    expect(stage.emitted('confirm'), 'A selects the focused path — it never commits a trade').to.eq(undefined);
    stage.vm.handleIntent(X);
    const confirms = stage.emitted('confirm');
    expect(confirms, 'X trades').to.have.lengthOf(1);
    expect(confirms![0][0]).to.deep.eq({paymentIndex: 0, steps: [], captures: {}, targets: {}});

    stage.vm.handleIntent(B);
    expect(stage.emitted('cancel'), 'B folds back').to.have.lengthOf(1);
  });

  it('a PICK and a BUILD with nothing to compose: A IS the confirm — and only when the server offers the act', () => {
    const pick = mountStage({colony: luna(), intent: 'pick', actionAvailable: true, pickLabel: 'Remove colony'});
    expect(pick.find('.con-colfocus__verdict').text(), 'the server\'s verb').to.contain('Remove colony');
    pick.vm.handleIntent(A);
    expect(pick.emitted('pick-confirm')).to.have.lengthOf(1);

    const build = mountStage({colony: luna(), intent: 'build', actionAvailable: true, viewerColor: RED});
    expect(build.find('.con-colfocus').classes()).to.include('con-colfocus--build');
    build.vm.handleIntent(A);
    expect(build.emitted('build-confirm')).to.have.lengthOf(1);

    const refused = mountStage({colony: luna(), intent: 'build', actionAvailable: false, blockReason: 'No free berth', viewerColor: RED});
    expect(refused.find('.con-colfocus').classes(), 'an act the server refuses is an inspection').to.include('con-colfocus--inspect');
    expect(refused.find('.con-colfocus__verdict').text()).to.contain('No free berth');
    refused.vm.handleIntent(A);
    expect(refused.emitted('build-confirm'), 'a disabled act is never committed').to.eq(undefined);
  });

  it('the COMMIT BOUNDARY pins what the stage shows; a refused commit gives the door back', async () => {
    const stage = mountStage(tradeProps());
    stage.vm.holdPresentation();
    // The server's answer flips the props under the resolution: the trade is spent, the options are gone.
    await stage.setProps({actionAvailable: false, options: [], blockReason: 'Your trade fleet is already here'});
    const root = stage.find('.con-colfocus');
    expect(root.classes(), 'the mode as it stood at the press').to.include('con-colfocus--trade');
    expect(stage.find('.con-colfocus__verdict').classes(), 'the verdict\'s box stays, unpainted').to.include('con-colfocus__verdict--reserved');
    expect(stage.find('.con-colfocus__verdict').text(), '…with the words it had at the press').to.contain('Trade available');
    expect(stage.findAll('.con-colfocus__payrow'), 'the chosen path alone stands, as the receipt').to.have.lengthOf(1);
    expect(stage.find('.con-colfocus__payrow').classes()).to.include('con-colfocus__payrow--locked');
    expect(consoleColoniesUi.composerReady, 'a committed move is not confirmable').to.eq(false);
    stage.vm.handleIntent(X);
    stage.vm.handleIntent(B);
    expect(stage.emitted('confirm'), 'past the press the pad is absorbed — no double submit').to.eq(undefined);
    expect(stage.emitted('cancel')).to.eq(undefined);

    stage.vm.releasePresentation();
    await stage.vm.$nextTick();
    expect(root.classes(), 'the live props again').to.include('con-colfocus--inspect');
    expect(stage.find('.con-colfocus__verdict').classes()).to.not.include('con-colfocus__verdict--reserved');
    expect(stage.find('.con-colfocus__verdict').text()).to.contain('Your trade fleet is already here');
    stage.vm.handleIntent(B);
    expect(stage.emitted('cancel'), 'the stage is a door again').to.have.lengthOf(1);
  });

  it('a new colony under the same stage starts clean: nothing of the previous one is carried over', async () => {
    const stage = mountStage(tradeProps());
    stage.vm.holdPresentation();
    await stage.setProps({colony: {name: ColonyName.EUROPA, isActive: true, trackPosition: 1, visitor: undefined, colonies: []}});
    expect(stage.find('.con-colfocus__verdict').classes(), 'the commit latch is the old colony\'s').to.not.include('con-colfocus__verdict--reserved');
    expect(stage.find('[data-fleet-berth]').attributes('data-fleet-berth')).to.eq(ColonyName.EUROPA);
    stage.vm.handleIntent(X);
    expect(stage.emitted('confirm'), 'the new colony\'s trade is live').to.have.lengthOf(1);
  });

  // The stage is `<script setup>` (docs/claude/vapor/RECIPES.md R11): its parent's ref reaches ONLY what it exposes.
  // Asserted the way the colonies section mounts it — under a host that holds `ref="focusStage"` — because
  // `wrapper.vm` sees the whole setup state and would stay green with the list missing.
  it('a PARENT\'s ref sees exactly `handleIntent`, `releasePresentation` and `holdPresentation` — the section\'s three reads', async () => {
    type StageReach = {handleIntent(intent: GamepadIntent): void, releasePresentation(): void, holdPresentation(): void};
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleColonyFocusStage, {ref: 'focusStage', ...tradeProps()})]),
    });
    const host = mount(Host, {global: {...globalConfig.global}});
    const stage = (host.vm.$refs.focusStage ?? undefined) as StageReach | undefined;
    expect(stage, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(stage!), 'the exposed list is the contract — nothing else of the script')
      .to.deep.eq(['handleIntent', 'releasePresentation', 'holdPresentation']);
    for (const inner of ['emitConfirm', 'pinConfig', 'targetPicked', 'sub', 'heldView', 'canConfirm', 'props']) {
      expect((stage as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    // Each member, called as the section calls it.
    const inner = host.findComponent(ConsoleColonyFocusStage);
    stage!.holdPresentation();
    await host.vm.$nextTick();
    expect(inner.find('.con-colfocus__verdict').classes(), 'the commit boundary').to.include('con-colfocus__verdict--reserved');
    stage!.handleIntent(X);
    expect(inner.emitted('confirm'), 'absorbed past the press').to.eq(undefined);
    stage!.releasePresentation();
    await host.vm.$nextTick();
    expect(inner.find('.con-colfocus__verdict').classes(), 'a refused commit').to.not.include('con-colfocus__verdict--reserved');
    stage!.handleIntent(X);
    expect(inner.emitted('confirm'), 'X trades — through the ref').to.have.lengthOf(1);
  });
});
