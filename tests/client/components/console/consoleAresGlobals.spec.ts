/*
 * ConsoleAresGlobals — «shift the planetary event thresholds»: one row per threshold that has not fired, each moved at
 * most one step up or down, X applies, B sets the question aside. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): the shell's pad router reaches it through the surface registry, so what a holder of
 * its ref gets is ONLY what it exposes — `handleIntent`.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ShiftAresGlobalParametersModel} from '@/common/models/PlayerInputModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {aresResponse, aresThresholdRows} from '@/client/console/compositePrompts';
import {clearPanelCommands, panelCommands} from '@/client/console/consolePanelUi';
import {promptSequenceKey} from '@/client/console/promptSequence';
import {promptIdentityKey} from '@/client/console/turnIntents';
import ConsoleAresGlobals from '@/client/components/console/ConsoleAresGlobals.vue';

// The family's head registers the decision with the press's sequence (its own spec's subject) — this spec reads what
// the surface HANDS it and keeps its default slot. (Render functions: the runtime compiler is not in this build.)
const HeadStub = defineComponent({
  name: 'ConsolePromptHead',
  props: ['tone', 'kicker', 'title', 'trigger', 'promptKey'],
  setup(_props, {slots}) {
    return () => h('header', {class: 'head-stub'}, slots.default?.());
  },
});
const GlyphStub = defineComponent({name: 'GamepadGlyph', props: ['control'], render: () => h('i', {class: 'glyph-stub'})});

const global = {...globalConfig.global, stubs: {ConsolePromptHead: HeadStub, GamepadGlyph: GlyphStub}};

/** The prompt: three thresholds still ahead (oceans 3 and 6, −4 °C), the oxygen one already fired. */
function prompt(erosionOceans = 3): ShiftAresGlobalParametersModel {
  return {
    type: 'aresGlobalParameters', title: 'Adjust Ares global parameters up to 1 step.', buttonLabel: 'Save', promptId: 7,
    aresData: {
      includeHazards: true,
      milestoneResults: [],
      hazardData: {
        erosionOceanCount: {threshold: erosionOceans, available: true},
        removeDustStormsOceanCount: {threshold: 6, available: true},
        severeErosionTemperature: {threshold: -4, available: true},
        severeDustStormOxygen: {threshold: 5, available: false},
      },
    },
  } as unknown as ShiftAresGlobalParametersModel;
}

function viewOf(waitingFor: ShiftAresGlobalParametersModel): PlayerViewModel {
  return {waitingFor} as unknown as PlayerViewModel;
}

function surface(playerView: PlayerViewModel) {
  return mount(ConsoleAresGlobals as any, {...globalConfig, props: {playerView}, global});
}

type AresRef = {handleIntent(intent: GamepadIntent): void};

/** The surface under a HOLDER of its ref — what that ref carries is what the shell's registry hands the pad router. */
function underParent(first: PlayerViewModel) {
  const held = shallowRef<AresRef | null>(null);
  const playerView = shallowRef(first);
  const submitted: Array<unknown> = [];
  const deferred: Array<true> = [];
  const surfaceProps = (): Record<string, unknown> => ({
    playerView: playerView.value,
    onSubmit: (response: unknown): void => {
      submitted.push(response);
    },
    onDefer: (): void => {
      deferred.push(true);
    },
  });
  const Parent = defineComponent({
    name: 'AresGlobalsParent',
    setup: () => () => h('div', {'data-parent': ''}, [h(ConsoleAresGlobals as never, {...surfaceProps(), ref: held})]),
  });
  return {wrapper: mount(Parent, {...globalConfig, global}), held, playerView, submitted, deferred};
}

const DOWN: GamepadIntent = {kind: 'nav', dir: 'down', repeat: false};
const LEFT: GamepadIntent = {kind: 'nav', dir: 'left', repeat: false};
const MINUS: GamepadIntent = {kind: 'press', button: 'bumperL'};
const PLUS: GamepadIntent = {kind: 'press', button: 'bumperR'};
const APPLY: GamepadIntent = {kind: 'press', button: 'secondary'};
const BACK: GamepadIntent = {kind: 'press', button: 'back'};

describe('ConsoleAresGlobals — the planetary event thresholds', () => {
  // The surface publishes its command contract into module state — it may not leak into the next spec.
  afterEach(() => clearPanelCommands('aresGlobals'));

  it('one row per threshold still ahead — its consequence, its value, the cursor on the first; nothing changed yet', () => {
    const model = prompt();
    const w = surface(viewOf(model));
    // The template STARTS WITH ITS ROOT.
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-ares', 'con-ws']);
    expect(w.attributes('data-motion-surface')).to.eq('ares-globals');
    expect(w.attributes('aria-label')).to.eq($t('Shift the planetary event thresholds'));
    const head = w.findComponent(HeadStub);
    expect(head.props('tone')).to.eq('neutral');
    expect(head.props('kicker')).to.eq($t('Planetary events'));
    expect(head.props('title')).to.eq($t('Shift the planetary event thresholds'));
    expect(head.props('promptKey'), 'the decision\'s identity in the press\'s sequence').to.eq(promptSequenceKey(model, promptIdentityKey(model)));

    const expected = aresThresholdRows(model);
    const rows = w.findAll('.con-ares__row');
    expect(rows.map((r) => r.find('.con-ares__name').text())).to.deep.eq(expected.map((r) => $t(r.label)));
    expect(rows.map((r) => r.find('.con-ares__effect').text())).to.deep.eq(expected.map((r) => $t(r.effectKey)));
    expect(rows.map((r) => r.find('.con-ares__cur').text()), 'a fired threshold is history, not a row').to.deep.eq(['3', '6', '-4°C']);
    expect(rows.map((r) => r.classes().includes('con-ares__row--focused'))).to.deep.eq([true, false, false]);
    expect(w.find('.con-ares__row--changed').exists()).to.eq(false);
    expect(rows[0].findAll('.con-ares__seg-cell').map((c) => c.text())).to.deep.eq(['−1', '0', '+1']);
    expect(rows.map((r) => r.find('.con-ares__seg-cell--on').text())).to.deep.eq(['0', '0', '0']);
    expect(w.findAllComponents(GlyphStub).map((g) => g.props('control')), 'the shoulder glyphs stand on the focused row only')
      .to.deep.eq(['bumperL', 'bumperR']);
    const count = w.find('.con-ares__count');
    expect(count.text()).to.eq($t('No changes'));
    expect(count.classes()).to.include('con-ares__count--idle');

    // Its command contract stands while it does, and leaves with it.
    expect(panelCommands('aresGlobals')?.map((c) => c.control)).to.deep.eq(['dpad', 'bumperL', 'bumperR', 'secondary', 'back']);
    w.unmount();
    expect(panelCommands('aresGlobals')).to.eq(undefined);
  });

  it('a HOLDER of its ref sees `handleIntent` and nothing else — and the pad drives the surface through it', async () => {
    const {wrapper, held, submitted, deferred} = underParent(viewOf(prompt()));
    expect(held.value, 'the holder\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'exactly what the surface exposes').to.deep.eq(['handleIntent']);
    const pad = held.value!;
    const rows = () => wrapper.findAll('.con-ares__row');

    // ▼ moves the cursor; a shoulder moves the focused threshold ONE step, however often it is pressed.
    pad.handleIntent(DOWN);
    pad.handleIntent(PLUS);
    pad.handleIntent(PLUS);
    await nextTick();
    expect(rows().map((r) => r.classes().includes('con-ares__row--focused'))).to.deep.eq([false, true, false]);
    expect(rows().map((r) => r.classes().includes('con-ares__row--changed'))).to.deep.eq([false, true, false]);
    expect(rows()[1].find('.con-ares__next').text(), 'current → resulting').to.eq('7');
    expect(rows()[1].find('.con-ares__seg-cell--on').text()).to.eq('+1');
    const count = wrapper.find('.con-ares__count');
    expect(count.text()).to.eq(translateTextWithParams('Shifted: ${0}', ['1']));
    expect(count.classes()).to.not.include('con-ares__count--idle');

    // ◀ nudges it too (the segmented control looks horizontal): back to 0, then −1.
    pad.handleIntent(LEFT);
    await nextTick();
    expect(wrapper.find('.con-ares__row--changed').exists()).to.eq(false);
    pad.handleIntent(LEFT);
    pad.handleIntent(DOWN);
    pad.handleIntent(MINUS);
    await nextTick();
    expect(rows()[1].find('.con-ares__next').text()).to.eq('5');
    expect(rows()[2].find('.con-ares__next').text(), '°C moves two per step').to.eq('-6°C');

    // X applies — ONCE; B sets the question aside.
    expect(submitted).to.deep.eq([]);
    pad.handleIntent(APPLY);
    pad.handleIntent(APPLY);
    expect(submitted).to.deep.eq([aresResponse({highOceanDelta: -1, temperatureDelta: -1})]);
    pad.handleIntent(BACK);
    expect(deferred.length).to.eq(1);
  });

  it('a new view of the SAME prompt re-arms the apply and keeps the draft; a NEW prompt resets the draft and the cursor', async () => {
    const {wrapper, held, playerView, submitted} = underParent(viewOf(prompt()));
    const pad = held.value!;
    const changed = () => wrapper.findAll('.con-ares__row').map((r) => r.classes().includes('con-ares__row--changed'));
    const focused = () => wrapper.findAll('.con-ares__row').map((r) => r.classes().includes('con-ares__row--focused'));
    pad.handleIntent(DOWN);
    pad.handleIntent(PLUS);
    pad.handleIntent(APPLY);
    expect(submitted.length).to.eq(1);

    playerView.value = viewOf(prompt());
    await nextTick();
    expect(changed(), 'the same thresholds — the draft stands').to.deep.eq([false, true, false]);
    pad.handleIntent(APPLY);
    expect(submitted.length, 'the view answered: the apply is live again').to.eq(2);

    playerView.value = viewOf(prompt(4));
    await nextTick();
    expect(changed(), 'a threshold moved — it is another decision').to.deep.eq([false, false, false]);
    expect(focused()).to.deep.eq([true, false, false]);
    expect(wrapper.find('.con-ares__count').text()).to.eq($t('No changes'));
    expect(wrapper.findAll('.con-ares__cur').map((c) => c.text())).to.deep.eq(['4', '6', '-4°C']);
  });
});
