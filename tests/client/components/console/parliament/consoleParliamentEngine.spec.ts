/*
 * ConsoleParliamentEngine — the chairman's CHAIR with its QUEST at the head of the career track («Зал» v7). The plate
 * IS the quest (`[data-parl-quest]`), so its states are the classes and attributes the directors and the probes read.
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): it emits and exposes nothing — its contract is
 * what it renders for its view and the display holds, the one-shot pulse it raises and clears by the animation's own
 * end, and the fit it solves on its ROOT (a template ref since the conversion — R12; it used to be `this.$el`).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {STARTER_QUEST} from '@/common/parliament/ParliamentTypes';
import {parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {emptyParliamentView, ParliamentQuestVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import ConsoleParliamentEngine from '@/client/components/console/parliament/ConsoleParliamentEngine.vue';

// The delegate figure, the chair's glyph and the mechanics panel are their own specs' subjects; this one reads what the
// plate HANDS them. (Render functions, not template strings: the runtime compiler is not in this build.)
const DelegateStub = defineComponent({name: 'PlayerDelegate', props: {color: String}, render: () => h('i', {class: 'delegate-stub'})});
const ChairStub = defineComponent({name: 'PremiumChairGlyph', render: () => h('i', {class: 'chair-stub'})});
const MechanicsStub = defineComponent({name: 'PremiumMechanicsPanel', props: ['mechanics'], render: () => h('i', {class: 'mechanics-stub'})});

const BLUE: Color = 'blue';
const RED: Color = 'red';
const GREEN: Color = 'green';

const PLAYERS = [{color: BLUE, name: 'Blue'}, {color: RED, name: 'Red'}, {color: GREEN, name: 'Green'}] as unknown as ReadonlyArray<PublicPlayerModel>;

function quest(over: Partial<ParliamentQuestVm> = {}): ParliamentQuestVm {
  return {
    definition: STARTER_QUEST,
    text: 'Raise your heat production 3 times',
    renderData: undefined,
    source: 'starter',
    generation: 1,
    progress: [
      {color: BLUE, value: 2, participates: true, bot: false},
      {color: RED, value: 0, participates: true, bot: false},
      {color: GREEN, value: 1, participates: false, bot: false},
    ],
    completedBy: undefined,
    ...over,
  };
}

function view(over: Partial<ParliamentViewVm> = {}): ParliamentViewVm {
  return {...emptyParliamentView(), quest: quest(), ...over};
}

function engine(props: Record<string, unknown>) {
  return mount(ConsoleParliamentEngine as any, {
    ...globalConfig,
    props: {players: PLAYERS, viewerColor: BLUE, ...props},
    global: {...globalConfig.global, stubs: {PlayerDelegate: DelegateStub, PremiumChairGlyph: ChairStub, PremiumMechanicsPanel: MechanicsStub}},
  });
}

/** A ResizeObserver that records what it was pointed at (jsdom has none — the plate then solves its fit once, at mount). */
class RecordingObserver {
  public static made: Array<RecordingObserver> = [];
  public observed: Array<Element> = [];
  public disconnected = false;
  constructor(public readonly resolve: () => void) {
    RecordingObserver.made.push(this);
  }
  public observe(el: Element): void {
    this.observed.push(el);
  }
  public unobserve(): void {}
  public disconnect(): void {
    this.disconnected = true;
  }
}

describe('ConsoleParliamentEngine — the chair and its quest at the head of the career', () => {
  // The flow and the display holds are module state the whole bundle shares: every test starts from, and leaves, the clean one.
  beforeEach(() => {
    resetParliamentFlow();
    resetParliamentHolds();
  });
  afterEach(() => {
    resetParliamentFlow();
    resetParliamentHolds();
  });

  it('an OPEN quest under a vacant chair: the quest\'s identity on the plate, its words, the step it pays, the race of the seats that take part', () => {
    const w = engine({view: view()});
    expect(w.classes()).to.deep.eq(['con-parl__engine']);
    expect(w.attributes('data-parl-quest')).to.not.eq(undefined);
    expect(w.attributes('data-parl-engine')).to.not.eq(undefined);
    expect(w.attributes('data-parl-quest-text'), 'WHICH quest the plate shows — its printed text\'s English key').to.eq('Raise your heat production 3 times');
    expect(w.attributes('data-parl-quest-closed')).to.eq(undefined);

    expect(w.find('.con-parl__engine-kicker').classes()).to.not.include('con-parl__engine-kicker--done');
    expect(w.find('.con-parl__engine-kicker-word').text()).to.eq($t('Chairman quest'));
    expect(w.find('[data-parl-quest-done-word]').attributes('aria-hidden'), 'the «completed» word waits in the same cell, unread').to.eq('true');

    // The chair is empty: the throne alone, no cube, no palette — and the name's line keeps its height.
    expect(w.find('[data-parl-chair]').classes()).to.deep.eq(['con-parl__chair']);
    expect(w.find('.con-parl__chair .chair-stub').classes()).to.include('con-parl__chair-glyph');
    expect(w.find('[data-parl-seat-chair]').exists()).to.eq(false);
    expect(w.find('.con-parl__throne').attributes('style')).to.eq(undefined);
    const name = w.find('[data-parl-chair-name]');
    expect(name.classes()).to.include('con-parl__chair-name--empty');
    expect((name.element as Element).textContent).to.eq(' ');

    // No graphic to draw — the condition keeps its words (an empty block would be a silent quest).
    expect(w.find('.mechanics-stub').exists()).to.eq(false);
    expect(w.find('.con-parl__engine-cond .con-parl__engine-text').text()).to.eq($t('Raise your heat production 3 times'));
    const reward = w.find('[data-parl-quest-reward]');
    expect(reward.classes()).to.deep.eq(['con-parl__engine-step']);
    expect(reward.find('[data-parl-quest-seal]').attributes('data-parl-quest-seal-by')).to.eq(undefined);

    const rows = w.findAll('[data-parl-quest-progress] [data-parl-quest-row]');
    expect(rows.map((r) => r.attributes('data-parl-quest-row')), 'a seat that holds no delegates runs no race').to.deep.eq([BLUE, RED]);
    expect(rows.map((r) => r.attributes('data-parl-quest-value'))).to.deep.eq(['2', '0']);
    expect(rows.map((r) => r.classes().includes('con-parl__quest-row--me'))).to.deep.eq([true, false]);
    expect(rows.map((r) => r.classes().includes('con-parl__quest-row--close')), 'one step from the chair').to.deep.eq([true, false]);
    expect(rows.map((r) => r.classes().includes('con-parl__quest-row--lead')), 'the ONE seat strictly ahead').to.deep.eq([true, false]);
    expect(rows.map((r) => r.find('.con-parl__seat-dot').classes().includes('player_bg_color_' + r.attributes('data-parl-quest-row')))).to.deep.eq([true, true]);
    expect(rows[0].findAll('.con-parl__engine-pip').map((p) => p.classes().includes('con-parl__engine-pip--on')), 'the pips ARE the count').to.deep.eq([true, true, false]);
    expect(rows[1].findAll('.con-parl__engine-pip--on').length).to.eq(0);
    expect(w.find('.con-parl__tick').exists(), 'a short race prints no digits').to.eq(false);
  });

  it('a TAKEN quest under a seated chairman: the plate\'s own parts change form — the seal, the winner\'s row, the bot\'s struck row; a long race reads in digits', () => {
    const taken = quest({
      definition: {...STARTER_QUEST, count: 7},
      completedBy: RED,
      botReachable: false,
      progress: [
        {color: BLUE, value: 4, participates: true, bot: false},
        {color: RED, value: 7, participates: true, bot: false},
        {color: GREEN, value: 0, participates: true, bot: true},
      ],
    });
    const w = engine({view: view({quest: taken, chairman: RED})});
    expect(w.classes()).to.include.members(['con-parl__engine--done', 'con-parl__quest--done']);
    expect(w.classes()).to.not.include('con-parl__engine--closed');
    expect(w.find('.con-parl__engine-kicker').classes()).to.include('con-parl__engine-kicker--done');
    expect(w.find('[data-parl-quest-done-word]').attributes('aria-hidden')).to.eq(undefined);

    // The chairman SEATED in the chair: the cube in the holder's colour, the throne in its palette, the name under it.
    expect(w.find('[data-parl-chair]').classes()).to.include.members(['con-parl__chair--seated', 'con-parl__chair--won']);
    expect(w.find('[data-parl-seat-chair]').attributes('data-parl-seat-chair')).to.eq(RED);
    expect(w.findComponent(DelegateStub).props('color')).to.eq(RED);
    expect(w.find('.con-parl__throne').attributes('style')).to.contain('--pt-');
    const name = w.find('[data-parl-chair-name]');
    expect(name.classes()).to.not.include('con-parl__chair-name--empty');
    expect(name.text()).to.eq('Red');

    // The reward it paid is SEALED by the completer; nobody leads a race that is over.
    const reward = w.find('[data-parl-quest-reward]');
    expect(reward.classes()).to.include('con-parl__engine-step--taken');
    expect(reward.classes()).to.not.include('con-parl__engine-step--kept');
    expect(reward.find('[data-parl-quest-seal]').attributes('data-parl-quest-seal-by')).to.eq(RED);
    expect(reward.find('.con-parl__engine-step-dot').classes()).to.include('player_bg_color_red');
    const rows = w.findAll('[data-parl-quest-row]');
    expect(rows.map((r) => r.classes().includes('con-parl__quest-row--won'))).to.deep.eq([false, true, false]);
    expect(rows.map((r) => r.classes().includes('con-parl__quest-row--behind'))).to.deep.eq([true, false, true]);
    expect(rows.some((r) => r.classes().includes('con-parl__quest-row--lead'))).to.eq(false);

    // MarsBot's row on a quest its play cannot reach: a struck mark, never a race that cannot happen.
    expect(rows.map((r) => r.attributes('data-parl-quest-unreachable'))).to.deep.eq([undefined, undefined, '']);
    expect(rows[2].classes()).to.include('con-parl__quest-row--unreachable');
    expect(rows[2].find('.con-parl__quest-unreachable').text()).to.eq('✕');
    expect(rows[2].find('.con-parl__tick').exists()).to.eq(false);

    // Seven is past the pips: the count as digits over the quest's own total.
    expect(w.find('.con-parl__engine-pips').exists()).to.eq(false);
    expect(rows[0].find('.con-parl__tick').text()).to.eq('4');
    expect(rows[0].find('.con-parl__quest-of').text()).to.eq('/7');
  });

  it('follows its props and the DISPLAY HOLDS: the verdict closes the race, the cursor marks the plate, a held quest and chairman stand until they are turned over', async () => {
    const w = engine({view: view({chairman: BLUE})});
    expect(w.find('[data-parl-quest-reward]').classes(), 'the viewer holds the chair of an open quest').to.include('con-parl__engine-step--kept');
    expect(w.find('[data-parl-quest-row="blue"]').classes()).to.include('con-parl__quest-row--lead');

    await w.setProps({sittingStage: 'verdict', focused: true});
    expect(w.classes()).to.include.members(['con-parl__engine--closed', 'con-parl__engine--focus']);
    expect(w.attributes('data-parl-quest-closed')).to.eq('');
    expect(w.find('[data-parl-quest-row="blue"]').classes(), 'a closed race has no leader').to.not.include('con-parl__quest-row--lead');

    await w.setProps({sittingStage: '', focused: false});
    expect(w.classes()).to.deep.eq(['con-parl__engine']);

    // The sitting's enactment has changed the quest and the office on the server; the plate reads the OLD ones, closed.
    parliamentHolds.questBefore = {quest: quest({text: 'Place 2 cities', completedBy: RED}), chairman: RED};
    await nextTick();
    expect(w.attributes('data-parl-quest-text')).to.eq('Place 2 cities');
    expect(w.classes()).to.include.members(['con-parl__engine--closed', 'con-parl__engine--done']);
    expect(w.find('[data-parl-seat-chair]').attributes('data-parl-seat-chair')).to.eq(RED);
    expect(w.find('[data-parl-chair-name]').text()).to.eq('Red');

    // «ПРЕДСЕДАТЕЛЬСТВО»: the office moved and the new cube has not landed — the chair keeps the previous holder.
    parliamentHolds.questBefore = undefined;
    parliamentHolds.chairAwaits = {from: GREEN, to: BLUE};
    await nextTick();
    expect(w.attributes('data-parl-quest-text')).to.eq('Raise your heat production 3 times');
    expect(w.find('[data-parl-seat-chair]').attributes('data-parl-seat-chair')).to.eq(GREEN);
  });

  it('the quest\'s ONE-SHOT pulse: raised when the live quest is completed outside the sitting, cleared by its own animation\'s end — the chair\'s flash the same way', async () => {
    const w = engine({view: view()});
    const pulsing = () => w.classes().includes('con-parl__quest--pulse');
    expect(pulsing()).to.eq(false);

    await w.setProps({view: view({quest: quest({completedBy: BLUE})})});
    expect(pulsing(), 'the completion is an event the player must not miss').to.eq(true);
    await w.trigger('animationend', {animationName: 'con-parl-land-flash'});
    expect(pulsing(), 'another animation\'s end is not this one\'s').to.eq(true);
    await w.trigger('animationend', {animationName: 'con-parl-quest-pulse'});
    expect(pulsing()).to.eq(false);

    // The flow's own pulse (the quest block answering a reading beat) rides the same class and the same end.
    parliamentFlow.questPulse = true;
    await nextTick();
    expect(pulsing()).to.eq(true);
    await w.trigger('animationend', {animationName: 'con-parl-quest-pulse'});
    expect(parliamentFlow.questPulse).to.eq(false);
    expect(pulsing()).to.eq(false);

    // The chair's landing flash is settled by the chair's own animation end.
    parliamentFlow.chairPulse = true;
    await nextTick();
    const chair = w.find('[data-parl-chair]');
    expect(chair.classes()).to.include('con-parl__chair--pulse');
    await chair.trigger('animationend', {animationName: 'con-parl-land-flash'});
    expect(parliamentFlow.chairPulse).to.eq(false);
    expect(chair.classes()).to.not.include('con-parl__chair--pulse');

    // INSIDE the sitting the completion is the sitting's own beat: no pulse of the plate's.
    parliamentFlow.stage = 'sitting';
    await w.setProps({view: view()});
    await w.setProps({view: view({quest: quest({completedBy: RED})})});
    expect(pulsing()).to.eq(false);
  });

  it('the condition\'s fit is solved on the plate\'s ROOT: the observer watches the root and the fixed members beside the condition, and lets go on unmount', () => {
    const host = globalThis as unknown as {ResizeObserver?: unknown};
    const native = host.ResizeObserver;
    RecordingObserver.made = [];
    host.ResizeObserver = RecordingObserver;
    try {
      const w = engine({view: view()});
      expect(RecordingObserver.made.length).to.eq(1);
      const observer = RecordingObserver.made[0];
      const root = w.element as HTMLElement;
      expect(observer.observed.length).to.eq(3);
      expect(observer.observed[0], 'the plate\'s own box first').to.eq(root);
      expect(observer.observed[1]).to.eq(root.querySelector('.con-parl__throne'));
      expect(observer.observed[2]).to.eq(root.querySelector('[data-parl-quest-reward]'));

      // Nothing is laid out here and this quest prints words, not a graphic: a re-solve CLEARS the fit — on that root.
      root.style.setProperty('--con-parl-engine-fit', '0.7');
      expect(root.style.getPropertyValue('--con-parl-engine-fit')).to.eq('0.7');
      observer.resolve();
      expect(root.style.getPropertyValue('--con-parl-engine-fit')).to.eq('');

      w.unmount();
      expect(observer.disconnected).to.eq(true);
    } finally {
      if (native === undefined) {
        delete host.ResizeObserver;
      } else {
        host.ResizeObserver = native;
      }
    }
  });
});
