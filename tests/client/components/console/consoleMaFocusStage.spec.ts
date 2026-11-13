/*
 * ConsoleMaFocusStage — the detail stage of the Milestones / Awards workspace. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its props over the flow's module state (`maFocusState` — the
 * badge, the viewer's standing, the exchange or the sponsorship ladder, the commit's own line), THE COMMIT FREEZE (the
 * view pinned from the press until a refusal), and what it emits — `ceremony-done`, the shell's one signal to close
 * the workspace: the `phase` watcher hands the stage's own ROOT (the template ref that stands where `$el` was) to the
 * ceremony and says its end once. No parent stands a ref on it — it exposes nothing. The hero art, the rail, the
 * payment panel and the waived price are stubbed by name (each is its own component's subject). The unit runner
 * renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {flushPromises, mount} from '@vue/test-utils';
import {gsap} from 'gsap';
import {globalConfig} from '../getLocalVue';
import {ConsoleMaItem} from '@/client/components/console/consoleMaModel';
import {buildMaRail, MaRailView} from '@/client/components/console/consoleMaRail';
import {MaInspectView} from '@/client/components/console/consoleMaInspectModel';
import {MaConfirmView} from '@/client/components/ma/maConfirmModel';
import {beginMaFocusCeremony, beginMaFocusCommit, failMaFocusCommit, openMaFocus, resetMaFocus} from '@/client/console/consoleMaFocus';
import {MaSponsorSlot} from '@/client/console/maPriceReading';
import ConsoleMaFocusStage from '@/client/components/console/ConsoleMaFocusStage.vue';

const RailStub = defineComponent({
  name: 'ConsoleMaRail',
  props: {view: {type: Object as PropType<MaRailView>, required: true}},
  render() {
    return h('i', {'class': 'rail-stub'});
  },
});

const global = {
  ...globalConfig.global,
  stubs: {ConsoleMaRail: RailStub, MaHeroArt: true, ConsolePaymentPanel: true, ConsoleMaWaivedPrice: true},
};

function item(over: Partial<ConsoleMaItem> = {}): ConsoleMaItem {
  return {
    key: 'milestone:Terraformer', name: 'Terraformer', kind: 'milestone', description: 'Have a terraform rating of 35',
    scores: [{color: 'red', score: 35}, {color: 'blue', score: 28}], threshold: 35,
    myColor: 'red', myScore: 35, myReady: true, myLead: false, leaderScore: 35, secondRanked: false, raceTone: 'empty',
    cost: 8, available: true, blocker: '', slotsExhausted: false, ...over,
  };
}

function confirm(over: Partial<MaConfirmView> = {}): MaConfirmView {
  return {
    kind: 'milestone', name: 'Terraformer', displayName: 'Terraformer', description: 'Have a terraform rating of 35',
    cost: 8, free: false, price: {kind: 'paid', price: 8}, mcBefore: 20, mcAfter: 12,
    threshold: 35, myScore: 35, thresholdMet: true, takenCount: 0, maxSlots: 3, openAfter: 2, takenBy: [], race: [],
    leaderScore: 35, raceTone: 'empty', takenByOther: undefined, ...over,
  };
}

function inspect(over: Partial<MaInspectView> = {}): MaInspectView {
  return {
    mode: 'milestone-race', kind: 'milestone', name: 'Terraformer', displayName: 'Terraformer',
    description: 'Have a terraform rating of 35', threshold: 35,
    rows: [
      {color: 'red', name: 'Ada', score: 35, viewer: true, rank: 1, isLeader: true, barPct: 100, canClaim: true},
      {color: 'blue', name: 'Ben', score: 28, viewer: false, rank: 2, isLeader: false, barPct: 80},
    ],
    taken: false, playersCount: 2, vpFirst: 5, vpSecond: 0, summary: {tone: 'can-claim'}, nobodyLeads: false, ...over,
  };
}

function stage(props: {item?: ConsoleMaItem, view?: MaConfirmView, inspect?: MaInspectView, available?: boolean, sponsors?: ReadonlyArray<MaSponsorSlot>} = {}) {
  return mount(ConsoleMaFocusStage, {
    global,
    props: {item: props.item ?? item(), view: props.view ?? confirm(), inspect: props.inspect ?? inspect(), available: props.available ?? true, sponsors: props.sponsors ?? []},
  });
}

/** Seconds of the MOTION clock — past every beat of the ceremony (and, a second time, past the burst it fired). */
function passMotion(seconds: number): void {
  gsap.globalTimeline.time(gsap.globalTimeline.time() + seconds);
}

describe('ConsoleMaFocusStage — the detail stage of the Milestones / Awards workspace', () => {
  // The flow's state is a MODULE (the shell, the bar and the crumb read it): every test starts from — and leaves — a fresh one.
  beforeEach(() => {
    resetMaFocus();
    openMaFocus('milestone', 'Terraformer');
  });
  afterEach(resetMaFocus);

  it('a milestone on offer: the warm stage, the badge, the viewer\'s standing against the threshold, the exchange at its printed price — the rail fed the same transaction', () => {
    const w = stage();
    // The template starts with its root: the wrapper IS the stage.
    expect(w.classes()).to.include.members(['con-mafocus', 'con-mafocus--milestone', 'con-mafocus--avail', 'con-mafocus--go']);
    expect(w.classes().filter((k) => k === 'con-mafocus--committing' || k === 'con-mafocus--cere')).to.deep.eq([]);
    expect(w.find('.con-mafocus__name').text()).to.eq('Terraformer');

    const chip = w.find('.con-mafocus__state-chip');
    expect([chip.classes().includes('con-mafocus__state-chip--go'), chip.text()]).to.deep.eq([true, 'Can be claimed']);
    const mine = w.find('.con-mafocus__you-value');
    expect([mine.text(), mine.classes().includes('con-mafocus__you-value--met')]).to.deep.eq(['35/35', true]);
    expect((w.find('.con-mafocus__meter > i').element as HTMLElement).style.width).to.eq('100%');
    expect(w.find('.con-mafocus__you-note').exists(), 'a milestone\'s number carries its own target — no race line').to.eq(false);

    // THE EXCHANGE: the price cell is the printed price the press charges (the flight's target), +5 VP beside it.
    const price = w.find('[data-ma-exchange] .con-mafocus__xcell--price');
    expect([price.attributes('data-ma-price-target'), price.attributes('data-ma-price-kind'), price.find('.con-mafocus__xvalue').text()])
      .to.deep.eq(['', 'paid', '8']);
    expect(w.find('[data-ma-ladder]').exists(), 'the ladder is an award\'s').to.eq(false);

    // The race: the viewer's row reads «You»; the commit's line is silent while the decision is the player's.
    expect(w.findAll('.con-mafocus__row').map((r) => [r.find('.con-mafocus__row-name').text(), r.classes().includes('con-mafocus__row--viewer')]))
      .to.deep.eq([['You', true], ['Ben', false]]);
    const rail = w.findComponent(RailStub);
    expect(rail.props('view')).to.deep.eq(buildMaRail({item: item(), kind: 'milestones', cost: 8, free: false, myMegacredits: 20, takenCount: 0, maxSlots: 3, billAsks: false}));
    expect(rail.classes(), 'the rail\'s face stands').to.not.include('con-mafocus__face--off');
    expect(w.find('.con-mafocus__status').attributes('aria-hidden')).to.eq('true');

    // Not on offer and not met: one word for the state, and the stage cools.
    const cold = stage({item: item({available: false, myReady: false, myScore: 20}), view: confirm({myScore: 20, thresholdMet: false}), available: false});
    expect(cold.classes().filter((k) => k === 'con-mafocus--avail' || k === 'con-mafocus--go')).to.deep.eq([]);
    expect(cold.find('.con-mafocus__state-chip').text()).to.eq('Not met yet');
    expect((cold.find('.con-mafocus__meter > i').element as HTMLElement).style.width).to.eq('57%');
  });

  it('an award: the sponsorship ladder — a funded step in its sponsor\'s seat, the next step the one the press charges, the rest at the table\'s price — and the standing names the leader', () => {
    const w = stage({
      item: item({key: 'award:Banker', name: 'Banker', kind: 'award', threshold: undefined, raceTone: 'behind', leaderScore: 7, cost: 14}),
      view: confirm({kind: 'award', name: 'Banker', displayName: 'Banker', cost: 14, price: {kind: 'paid', price: 14}, threshold: undefined,
        myScore: 4, thresholdMet: false, takenCount: 1, leaderScore: 7, raceTone: 'behind'}),
      inspect: inspect({mode: 'award-standings', kind: 'award', name: 'Banker', displayName: 'Banker', threshold: undefined}),
      sponsors: [{color: 'red', paid: 8}],
    });
    expect(w.classes()).to.include('con-mafocus--award');
    expect(w.classes().filter((k) => k === 'con-mafocus--avail' || k === 'con-mafocus--go'), 'the loud «offered» state is a milestone\'s').to.deep.eq([]);
    expect(w.find('[data-ma-exchange]').exists(), 'an award pays nothing now').to.eq(false);
    expect(w.find('.con-mafocus__truth-note').text()).to.eq('At game end: 5 VP for 1st place.');

    const steps = w.findAll('[data-ma-ladder] > .con-mafocus__ladder-step');
    expect(steps.map((s) => s.find('b').text()), 'what it went for · the price · the table\'s rule').to.deep.eq(['8', '14', '20']);
    expect(steps.map((s) => s.classes().includes('con-mafocus__ladder-step--funded'))).to.deep.eq([true, false, false]);
    expect(steps.map((s) => s.classes().includes('con-mafocus__ladder-step--next'))).to.deep.eq([false, true, false]);
    expect(steps.map((s) => s.attributes('data-ma-price-target')), 'only the next step is the flight\'s target').to.deep.eq([undefined, '', undefined]);
    expect(steps[0].find('.con-mafocus__dot').classes()).to.include('player_bg_color_red');

    expect(w.find('.con-mafocus__you-value').text(), 'an award has no threshold to read against').to.eq('4');
    expect(w.find('.con-mafocus__you-note').text()).to.eq('Leader: 7');
    expect(w.find('.con-mafocus__state-chip').text()).to.eq('Can be sponsored');
  });

  it('THE COMMIT FREEZE: from the press the stage states what was pressed — a live rebuild repaints nothing — and a refusal releases the pin with its reason on the commit\'s line', async () => {
    const w = stage();
    const priced = () => w.find('[data-ma-exchange] .con-mafocus__xvalue').text();
    const status = () => w.find('.con-mafocus__status');

    beginMaFocusCommit({gameAge: 1, undoCount: 0});
    await nextTick();
    expect(w.classes()).to.include('con-mafocus--committing');
    expect([status().text(), status().classes().includes('con-mafocus__status--wait'), status().attributes('aria-hidden')])
      .to.deep.eq(['Confirming…', true, undefined]);
    expect(w.findComponent(RailStub).classes(), 'the commit\'s line replaces the rail while it speaks').to.include('con-mafocus__face--off');

    // The answer's view arrives mid-beat (the next price, the consumed offer): the pinned presentation does not move.
    await w.setProps({view: confirm({cost: 99, price: {kind: 'paid', price: 99}}), item: item({takenBy: {color: 'red', name: 'Ada'}}), available: false});
    expect(priced()).to.eq('8');
    expect(w.findComponent(RailStub).props('view').tone, 'the rail states the transaction AS PRESSED').to.eq('projected');
    expect(w.classes(), 'the warm ground is latched past the press').to.include('con-mafocus--go');

    // A refusal restores the reversible detail — live values again, the reason in the commit's own line.
    failMaFocusCommit('Not your turn');
    await nextTick();
    expect(w.classes()).to.not.include('con-mafocus--committing');
    expect(priced()).to.eq('99');
    expect(w.findComponent(RailStub).props('view').tone).to.eq('owner');
    expect([status().text(), status().classes().includes('con-mafocus__status--blocked')]).to.deep.eq(['✕ Not your turn', true]);
  });

  it('the ceremony plays on the stage\'s own root and its end is said ONCE — `ceremony-done`; a stage torn down mid-ceremony says nothing', async () => {
    const w = stage();
    beginMaFocusCommit({gameAge: 1, undoCount: 0});
    await nextTick();
    expect(w.find('.con-mafocus__cere').exists(), 'the scene mounts past the commit boundary only').to.eq(false);
    beginMaFocusCeremony();
    await flushPromises();
    expect(w.classes()).to.include('con-mafocus--cere');
    expect(w.find('.con-mafocus__cere-kicker').text()).to.eq('Milestone claimed');
    // The ceremony was handed THIS stage's DOM: its dressing is hidden before the first paint of the scene.
    const dress = w.findAll('[data-ma-cere-dress]').map((d) => (d.element as HTMLElement).style.opacity);
    expect(dress).to.deep.eq(['0', '0']);
    expect(w.emitted('ceremony-done'), 'nothing is said before the dwell').to.eq(undefined);

    passMotion(30);
    expect(w.emitted('ceremony-done')).to.have.length(1);
    passMotion(30);
    expect(w.emitted('ceremony-done'), 'once').to.have.length(1);
    w.unmount();

    // A torn-down stage never fires a late completion into the shell.
    resetMaFocus();
    openMaFocus('milestone', 'Terraformer');
    const gone = stage();
    beginMaFocusCommit({gameAge: 2, undoCount: 0});
    await nextTick();
    beginMaFocusCeremony();
    await flushPromises();
    gone.unmount();
    passMotion(30);
    expect(gone.emitted('ceremony-done')).to.eq(undefined);
  });
});
