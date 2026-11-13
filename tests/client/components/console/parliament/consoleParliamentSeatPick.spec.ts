/*
 * ConsoleParliamentSeatPick — the chairman SEAT stage: the mandatory pick of the resolution that gives a delegate up
 * for the seat. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md) with THREE roots (head · body ·
 * the commit plate), so every mount here stands under a parent with an element root — the same parent that holds the
 * ref `ConsoleParliamentSection` holds (`$refs.seatPick.handleIntent(intent)`), which sees ONLY what the stage exposes.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import {emptyParliamentView, ParliamentSlotVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentFlow, resetParliamentFlow, setParliamentRootEl} from '@/client/console/parliament/consoleParliamentFlow';
import {ParliamentInspectRequest} from '@/client/console/parliament/parliamentInspect';
import ConsoleParliamentSeatPick from '@/client/components/console/parliament/ConsoleParliamentSeatPick.vue';

// The delegate figure and the controller glyph are their own specs' subjects; this one reads what the stage HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const DelegateStub = defineComponent({
  name: 'PlayerDelegate',
  props: {color: String, size: Number},
  render: () => h('i', {class: 'delegate-stub'}),
});
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

const global = {...globalConfig.global, stubs: {PlayerDelegate: DelegateStub, GamepadGlyph: GlyphStub}};

const RED: Color = 'red';
const BLUE: Color = 'blue';

function slot(instance: string, over: Partial<ParliamentSlotVm> = {}): ParliamentSlotVm {
  return {
    instance, resolutionId: 'RDX_SPEC_' + instance, resolution: undefined, party: PartyName.GREENS,
    votes: [], totalVotes: 0, leader: undefined, leaderVotes: 0, isWinning: false, tiePriority: 1,
    viewerVotes: 0, viewerEffectDelegates: 2, projection: undefined,
    ...over,
  };
}

/** The focused candidate: two of the viewer's delegates on it (the NEWER one is seq 7) and a rival's between them. */
const FOCUSED = slot('a', {
  resolution: {text: {name: 'Spec law'}} as unknown as ParliamentSlotVm['resolution'],
  votes: [{owner: RED, seq: 3}, {owner: BLUE, seq: 9}, {owner: RED, seq: 7}],
  totalVotes: 3, viewerVotes: 2,
});

const VIEW: ParliamentViewVm = {...emptyParliamentView(), slots: [FOCUSED, slot('b'), slot('c'), slot('d')]};

type SeatPickRef = {handleIntent(intent: GamepadIntent): void};

/** The stage under a PARENT that holds a ref to it and hears its two emits — what the section's stage zone does. */
function stage(over: Record<string, unknown> = {}) {
  const held = shallowRef<SeatPickRef | null>(null);
  const submitted: Array<unknown> = [];
  const inspected: Array<ParliamentInspectRequest> = [];
  const Parent = defineComponent({
    name: 'SeatPickParent',
    setup: () => () => h('div', {'data-parent': ''}, [h(ConsoleParliamentSeatPick as never, {
      view: VIEW, slot: FOCUSED, viewerColor: RED, seatCandidates: [0, 2, 3], ...over,
      ref: held,
      onSubmit: (from: unknown) => submitted.push(from),
      onInspect: (request: ParliamentInspectRequest) => inspected.push(request),
    })]),
  });
  return {wrapper: mount(Parent, {...globalConfig, global}), held, submitted, inspected};
}

const press = (button: 'confirm' | 'secondary' | 'back'): GamepadIntent => ({kind: 'press', button});
const nav = (dir: 'left' | 'right' | 'up' | 'down'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

/** A stand-in for the section's root: the focused card with its three cubes, each at a rect of its own. */
function sectionRoot(): HTMLElement {
  const root = document.createElement('div');
  const card = document.createElement('div');
  card.className = 'con-parl__slot';
  card.setAttribute('data-instance', 'a');
  const face = document.createElement('div');
  face.className = 'con-parl__card';
  card.appendChild(face);
  for (const seq of [3, 9, 7]) {
    const cube = document.createElement('i');
    cube.setAttribute('data-seq', String(seq));
    cube.getBoundingClientRect = () => ({left: seq * 10, top: seq, width: 12, height: 14}) as DOMRect;
    card.appendChild(cube);
  }
  root.appendChild(card);
  return root;
}

describe('ConsoleParliamentSeatPick — the chairman seat stage', () => {
  beforeEach(() => {
    resetParliamentFlow();
    parliamentFlow.stage = 'seat';
  });
  afterEach(() => {
    setParliamentRootEl(undefined);
    resetParliamentFlow();
  });

  it('three roots, in order: the head, the transaction for the focused card, the commit plate', () => {
    const {wrapper} = stage();
    const roots = Array.from((wrapper.element as Element).children).map((el) => el.className);
    expect(roots).to.deep.eq(['con-parl__stage-head', 'con-parl__stage-body', 'con-parl__cta con-parl__cta--ready']);
    expect(wrapper.find('.con-parl__stage-title').text()).to.eq($t('You completed the chairman quest'));

    const rows = wrapper.findAll('.con-parl__txn-row');
    expect(rows.map((r) => r.find('.con-parl__chip-dim').text())).to.deep.eq([$t('Resolution'), $t('Your delegates there'), $t('Chairman seat')]);
    expect(rows[0].find('b').text(), 'the focused card by its printed name').to.eq($t('Spec law'));
    expect(rows[1].find('b').text(), 'the card gives ONE delegate up').to.eq('2 → 1');
    expect(rows[2].find('b').text()).to.eq($t('yours'));
    // The seat's figure is the viewer's own, at the transaction's scale.
    const figure = wrapper.findComponent(DelegateStub);
    expect(figure.props('color')).to.eq(RED);
    expect(figure.props('size')).to.eq(delegateFigurePx(18));
    expect(wrapper.findComponent(GlyphStub).props('control')).to.eq('confirm');
  });

  it('a spectator has no figure for the seat; the plate follows the flow\'s stage — ready, then busy with its own word', async () => {
    const {wrapper} = stage({viewerColor: undefined});
    expect(wrapper.find('.delegate-stub').exists()).to.eq(false);

    const cta = wrapper.find('[data-parl-cta]');
    expect(cta.classes()).to.include('con-parl__cta--ready');
    expect(cta.classes()).to.not.include('con-parl__cta--busy');
    expect(cta.find('.con-parl__cta-label').text()).to.eq($t('Take the delegate'));

    parliamentFlow.stage = 'submitting';
    await nextTick();
    expect(cta.classes()).to.include('con-parl__cta--busy');
    expect(cta.classes()).to.not.include('con-parl__cta--ready');
    expect(cta.find('.con-parl__cta-label').text()).to.eq($t('Performing…'));
  });

  it('A and a click on the plate emit `submit` with the rect of the viewer\'s NEWEST cube on the card — `undefined` where no cube stands', async () => {
    const {wrapper, held, submitted} = stage();
    // No section root on screen: nothing to measure, the submit still goes.
    await wrapper.find('[data-parl-cta]').trigger('click');
    expect(submitted).to.deep.eq([undefined]);

    setParliamentRootEl(sectionRoot());
    held.value!.handleIntent(press('confirm'));
    expect(submitted.length).to.eq(2);
    expect(submitted[1], 'seq 7 — the viewer\'s newest, never the rival\'s seq 9').to.deep.eq({left: 70, top: 7, width: 12, height: 14});
  });

  it('X emits `inspect` for the focused resolution, lifted out of its own card; B is not the stage\'s verb', () => {
    const {held, submitted, inspected} = stage();
    const root = sectionRoot();
    setParliamentRootEl(root);
    held.value!.handleIntent(press('secondary'));
    expect(inspected.length).to.eq(1);
    const request = inspected[0];
    expect(request.kind).to.eq('resolution');
    if (request.kind !== 'resolution') {
      return;
    }
    expect(request.ids).to.deep.eq(['RDX_SPEC_a']);
    expect(request.index).to.eq(0);
    expect(request.origin?.(0), 'the card\'s own face').to.eq(root.querySelector('.con-parl__card'));

    held.value!.handleIntent(press('back'));
    expect(inspected.length).to.eq(1);
    expect(submitted).to.deep.eq([]);
  });

  it('a PARENT\'s ref sees `handleIntent` and nothing else — ◀ ▶ walk the server\'s candidates on the flow\'s cursor, clamped at both ends', () => {
    const {held} = stage();
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'exactly what the stage exposes').to.deep.eq(['handleIntent']);
    const leaked = ['view', 'slot', 'viewerColor', 'seatCandidates', 'flow', 'submit', 'inspect', 'figurePx', 'resolutionTitle']
      .filter((key) => (held.value as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);

    const walk = (dir: 'left' | 'right' | 'up' | 'down'): number => {
      held.value!.handleIntent(nav(dir));
      return parliamentFlow.slotIndex;
    };
    parliamentFlow.slotIndex = 2;
    expect([walk('right'), walk('right'), walk('left'), walk('left'), walk('left')], 'candidates 0 · 2 · 3').to.deep.eq([3, 3, 2, 0, 0]);
    expect(walk('up'), 'a vertical step moves nothing').to.eq(0);
    // A cursor standing on a card the server does not offer lands on the first candidate.
    parliamentFlow.slotIndex = 1;
    expect(walk('down')).to.eq(0);
  });

  it('with no candidate on offer a direction moves nothing', () => {
    const {held} = stage({seatCandidates: []});
    parliamentFlow.slotIndex = 2;
    held.value!.handleIntent(nav('right'));
    expect(parliamentFlow.slotIndex).to.eq(2);
  });
});
