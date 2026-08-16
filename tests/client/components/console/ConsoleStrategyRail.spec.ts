import {shallowMount, VueWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ConsoleStrategyRail from '@/client/components/console/ConsoleStrategyRail.vue';
import {buildMaHudZone, MaHudZone} from '@/client/console/consoleMaHudModel';
import {ConsoleMaSource} from '@/client/components/console/consoleMaModel';
import type {Color} from '@/common/Color';

/**
 * P30 — the right STRATEGY RAIL (Milestones/Awards premium HUD).
 *
 * Pinned here: the icon-first render contract (medal art + owner enamel +
 * state halo + the duel stack), the LB/RB workspace doors in EVERY state,
 * the completed-pose filter, and the SEAL pipeline's state machine
 * (seed-then-diff, covered deferral, held pre-state, the read beat before
 * the 3/3 recomposition, the undo rollback, the epoch reseed). Timers are
 * driven through a captured `later` queue — no real waits, no flakiness.
 */

const me: Color = 'red';
const rival: Color = 'blue';
const third: Color = 'green';

const source = (over: Partial<ConsoleMaSource>): ConsoleMaSource => ({
  name: 'Mayor',
  playerName: undefined,
  color: undefined,
  scores: [],
  ...over,
});

function zone(kind: 'milestones' | 'awards', models: Array<ConsoleMaSource>, over: Partial<{availableNow: ReadonlySet<string>, cost: number}> = {}): MaHudZone {
  return buildMaHudZone(kind, models, {
    myColor: me,
    availableNow: over.availableNow ?? new Set(),
    maxSlots: 3,
    cost: over.cost ?? 8,
  });
}

const OPEN_MILESTONES = [
  source({name: 'Mayor', threshold: 3, scores: [{color: me, score: 2}, {color: rival, score: 1}]}),
  source({name: 'Gardener', threshold: 3, scores: [{color: me, score: 0}]}),
  source({name: 'Builder', threshold: 8, scores: [{color: me, score: 8, claimable: true}]}),
];
const OPEN_AWARDS = [
  source({name: 'Banker', scores: [{color: me, score: 4}, {color: rival, score: 2}]}),
  source({name: 'Thermalist', scores: [{color: me, score: 0}, {color: rival, score: 0}]}),
];

type RailVm = {
  pending: Array<{key: string}>,
  sealingKeys: Array<string>,
  composed: {milestones: boolean, awards: boolean},
  later: (fn: () => void, ms: number) => void,
};

/** Reroute the component's timers into a manual queue (deterministic beats). */
function captureTimers(wrapper: VueWrapper<InstanceType<typeof ConsoleStrategyRail>>): Array<{fn: () => void, ms: number}> {
  const queue: Array<{fn: () => void, ms: number}> = [];
  (wrapper.vm as unknown as RailVm).later = (fn: () => void, ms: number) => {
    queue.push({fn, ms});
  };
  return queue;
}

function mountRail(props: Partial<{milestones: MaHudZone, awards: MaHudZone, covered: boolean}> = {}) {
  return shallowMount(ConsoleStrategyRail, {
    ...globalConfig,
    props: {
      milestones: props.milestones ?? zone('milestones', OPEN_MILESTONES),
      awards: props.awards ?? zone('awards', OPEN_AWARDS),
      viewerColor: me,
      epoch: 'run-1',
      covered: props.covered ?? false,
    },
  });
}

describe('ConsoleStrategyRail', () => {
  // Vue's CSS-transition machinery reaches for a bare `requestAnimationFrame`
  // on every ELEMENT REMOVAL inside a <transition>/<TransitionGroup> — and the
  // shared jsdom setup deliberately does not provide one (feature detection
  // must keep seeing this environment). The recomposition specs below remove
  // keyed rows, so THIS SUITE polyfills rAF and restores the bare environment
  // when it ends. ⚠️ Suite-scoped hooks on purpose: a top-level before/after
  // is a mocha ROOT hook of the whole shared bundle, and the polyfill then
  // silently moves every later spec onto its non-degraded code path (that
  // shipped as two CardSelectionContent failures before this comment).
  type RafGlobal = {requestAnimationFrame?: (cb: (t: number) => void) => number, cancelAnimationFrame?: (id: number) => void};
  let rafPrev: RafGlobal['requestAnimationFrame'];
  let cafPrev: RafGlobal['cancelAnimationFrame'];
  before(() => {
    const g = globalThis as RafGlobal;
    rafPrev = g.requestAnimationFrame;
    cafPrev = g.cancelAnimationFrame;
    g.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0) as unknown as number;
    g.cancelAnimationFrame = (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
  });
  afterEach(async () => {
    // Drain in-flight transition callbacks while the polyfill (and the
    // wrapper) are still alive — before the shared bundle unmount runs.
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
  after(() => {
    const g = globalThis as RafGlobal;
    g.requestAnimationFrame = rafPrev;
    g.cancelAnimationFrame = cafPrev;
  });

  it('renders both zones: medal per item, LB/RB door caps, slot pips in the head, NO price', () => {
    const wrapper = mountRail();
    const zones = wrapper.findAll('.con-strat__zone');
    expect(zones).to.have.lengthOf(2);
    // One medal row per item, art bound to the shared assets/ma slug.
    expect(zones[0].findAll('.con-strat__item')).to.have.lengthOf(3);
    expect(zones[1].findAll('.con-strat__item')).to.have.lengthOf(2);
    const art = zones[0].find('.con-strat__art');
    expect(art.attributes('style')).to.contain('assets/ma/mayor.png');
    // The doors: one glyph cap per zone head (LB / RB semantics live in the
    // control prop; the stub renders for both states).
    const heads = wrapper.findAll('.con-strat__head');
    expect(heads).to.have.lengthOf(2);
    expect(heads[0].findComponent({name: 'GamepadGlyph'}).props('control')).to.eq('bumperL');
    expect(heads[1].findComponent({name: 'GamepadGlyph'}).props('control')).to.eq('bumperR');
    // ONE compact head line: the 3-slot tray lives INSIDE the door button.
    expect(heads[0].findAll('.con-strat__pip')).to.have.lengthOf(3);
    // The PRICE is deliberately absent from the standing HUD — it belongs to
    // the workspace where the claim/fund decision (and payment) is made.
    expect(wrapper.find('.con-strat__price').exists()).to.be.false;
  });

  it('milestone rows carry MY progress; ready vs offered-now stay distinct states', () => {
    const wrapper = mountRail({
      milestones: zone('milestones', OPEN_MILESTONES, {availableNow: new Set(['Builder'])}),
    });
    const rows = wrapper.findAll('.con-strat__zone--milestones .con-strat__item');
    expect(rows[0].find('.con-strat__cell').text()).to.eq('2/3');
    // Builder: met AND offered → the pulsing now-state.
    expect(rows[2].classes()).to.include('con-strat__item--now');
    // Re-render the same zone WITHOUT the live offer (opponent's turn): the
    // met condition keeps its calm mint presence — never an error state.
    const wrapper2 = mountRail({milestones: zone('milestones', OPEN_MILESTONES)});
    const builder = wrapper2.findAll('.con-strat__zone--milestones .con-strat__item')[2];
    expect(builder.classes()).to.include('con-strat__item--ready');
    expect(builder.classes()).to.not.include('con-strat__item--now');
  });

  it('a taken item shows the owner enamel (plate + gem) and no numbers', () => {
    const wrapper = mountRail({
      milestones: zone('milestones', [
        source({name: 'Mayor', playerName: 'Vika', color: rival, scores: []}),
        ...OPEN_MILESTONES.slice(1),
      ]),
    });
    const row = wrapper.find('.con-strat__zone--milestones .con-strat__item');
    expect(row.classes()).to.include('con-strat__item--taken');
    expect(row.find('.con-strat__plate').classes()).to.include('player_bg_color_blue');
    expect(row.find('.con-strat__gem').classes()).to.include('player_bg_color_blue');
    expect(row.find('.con-strat__cell').exists()).to.be.false;
    // The tray's first pip took the owner colour.
    expect(wrapper.find('.con-strat__zone--milestones .con-strat__pip').classes()).to.include('player_bg_color_blue');
  });

  it('award rows read as a duel: leader unit above, chaser smaller below; my cube rimmed', () => {
    const wrapper = mountRail();
    const banker = wrapper.find('.con-strat__zone--awards .con-strat__item');
    const units = banker.findAll('.con-strat__unitbody');
    expect(units).to.have.lengthOf(2);
    expect(units[0].classes()).to.include('con-strat__unitbody--lead');
    expect(units[0].find('.con-strat__num').text()).to.eq('4');
    expect(units[0].find('.con-strat__cube').classes()).to.include('con-strat__cube--me');
    expect(units[1].classes()).to.not.include('con-strat__unitbody--lead');
    expect(units[1].find('.con-strat__num').text()).to.eq('2');
    // The zero race renders the quiet «—», not a fake leader.
    const thermalist = wrapper.findAll('.con-strat__zone--awards .con-strat__item')[1];
    expect(thermalist.find('.con-strat__none').exists()).to.be.true;
    // Unsponsored awards are the quieter objects.
    expect(banker.classes()).to.include('con-strat__item--quiet');
  });

  it('a 3+-way tie collapses to one cube and «+N» (bounded width, honest count)', () => {
    const wrapper = mountRail({
      awards: zone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 3}, {color: rival, score: 3}, {color: third, score: 3}]}),
      ]),
    });
    const lead = wrapper.find('.con-strat__unitbody--lead');
    expect(lead.findAll('.con-strat__cube')).to.have.lengthOf(1);
    expect(lead.find('.con-strat__morecnt').text()).to.eq('+2');
  });

  it('zone heads and rows are doors: clicks emit open with the zone kind', async () => {
    const wrapper = mountRail();
    await wrapper.findAll('.con-strat__head')[0].trigger('click');
    await wrapper.findAll('.con-strat__head')[1].trigger('click');
    await wrapper.find('.con-strat__zone--awards .con-strat__item').trigger('click');
    expect(wrapper.emitted('open')).to.deep.eq([['milestones'], ['awards'], ['awards']]);
  });

  it('mounting over a completed zone seats the 3/3 pose instantly — no ceremony replay', () => {
    const wrapper = mountRail({
      milestones: zone('milestones', [
        source({name: 'Mayor', playerName: 'A', color: me}),
        source({name: 'Gardener'}),
        source({name: 'Builder', playerName: 'B', color: rival}),
        source({name: 'Terraformer', playerName: 'C', color: third}),
      ]),
    });
    const mz = wrapper.find('.con-strat__zone--milestones');
    expect(mz.classes()).to.include('con-strat__zone--done');
    // Only the sealed three stand; the open row left the composition.
    expect(mz.findAll('.con-strat__item')).to.have.lengthOf(3);
    expect(mz.find('.con-strat__item--sealing').exists()).to.be.false;
    // The completed pose keeps the one-line head: door glyph + full tray.
    expect(mz.find('.con-strat__head').findComponent({name: 'GamepadGlyph'}).exists()).to.be.true;
    expect(mz.find('.con-strat__head').findAll('.con-strat__pip')).to.have.lengthOf(3);
    expect(mz.find('.con-strat__pip--empty').exists()).to.be.false;
  });

  it('a live claim seals: covered → held pre-state; uncovered → seal beat → enamel', async () => {
    const wrapper = mountRail({covered: true});
    const queue = captureTimers(wrapper);
    // The rival claims Mayor while a workspace covers the rail.
    await wrapper.setProps({
      milestones: zone('milestones', [
        source({name: 'Mayor', playerName: 'Vika', color: rival, scores: [{color: me, score: 2}]}),
        ...OPEN_MILESTONES.slice(1),
      ]),
    });
    const vm = wrapper.vm as unknown as RailVm;
    expect(vm.pending).to.have.lengthOf(1);
    // The final pose must NOT appear before its beat: no gem, numbers held.
    const row = () => wrapper.find('.con-strat__zone--milestones .con-strat__item');
    expect(row().find('.con-strat__gem').exists()).to.be.false;
    expect(row().find('.con-strat__cell').text()).to.eq('2/3');
    // The workspace folds — the rail becomes watchable and the seal plays.
    await wrapper.setProps({covered: false});
    expect(queue.length).to.be.greaterThan(0);
    queue.shift()?.fn(); // the seal start
    await wrapper.vm.$nextTick();
    expect(row().classes()).to.include('con-strat__item--sealing');
    expect(row().find('.con-strat__gem').classes()).to.include('player_bg_color_blue');
    queue.shift()?.fn(); // the seal end
    await wrapper.vm.$nextTick();
    expect(row().classes()).to.include('con-strat__item--taken');
    expect(row().find('.con-strat__cell').exists()).to.be.false;
  });

  it('the THIRD seal recomposes only after the read beat (result first, then the pose)', async () => {
    const two = [
      source({name: 'Mayor', playerName: 'A', color: me}),
      source({name: 'Gardener', playerName: 'B', color: rival}),
      source({name: 'Builder', threshold: 8, scores: [{color: third, score: 8}]}),
      source({name: 'Terraformer', threshold: 26, scores: []}),
    ];
    const wrapper = mountRail({milestones: zone('milestones', two)});
    const queue = captureTimers(wrapper);
    await wrapper.setProps({
      milestones: zone('milestones', [
        two[0], two[1],
        source({name: 'Builder', playerName: 'C', color: third}),
        two[3],
      ]),
    });
    const mz = () => wrapper.find('.con-strat__zone--milestones');
    const rows = () => (wrapper.vm as unknown as {zoneViews: Array<{rows: Array<unknown>}>}).zoneViews[0].rows;
    // The uncovered rail flushes at once: run the seal start + end.
    queue.shift()?.fn();
    queue.shift()?.fn();
    await wrapper.vm.$nextTick();
    // Sealed — but the composition HOLDS through the read beat.
    expect(mz().classes()).to.not.include('con-strat__zone--done');
    expect(rows()).to.have.lengthOf(4);
    // The settle timer fires the compose schedule; the read-beat timer lands it.
    queue.shift()?.fn();
    queue.shift()?.fn();
    await wrapper.vm.$nextTick();
    expect(mz().classes()).to.include('con-strat__zone--done');
    // The open row left the COMPOSITION (its DOM node departs on the leave
    // transition's own schedule — the view is the contract here).
    expect(rows()).to.have.lengthOf(3);
  });

  it('an undo rolls the enamel back and re-opens the composition silently', async () => {
    const taken = zone('milestones', [
      source({name: 'Mayor', playerName: 'A', color: me}),
      source({name: 'Gardener'}),
    ]);
    const wrapper = mountRail({milestones: taken, covered: true});
    await wrapper.setProps({
      milestones: zone('milestones', [
        source({name: 'Mayor', scores: [{color: me, score: 2}]}),
        source({name: 'Gardener'}),
      ]),
    });
    const row = wrapper.find('.con-strat__zone--milestones .con-strat__item');
    expect(row.classes()).to.not.include('con-strat__item--taken');
    expect(row.find('.con-strat__gem').exists()).to.be.false;
    const vm = wrapper.vm as unknown as RailVm;
    expect(vm.pending).to.have.lengthOf(0);
  });

  it('a new epoch reseeds silently — nothing pending, poses follow the truth', async () => {
    const wrapper = mountRail({covered: true});
    await wrapper.setProps({
      milestones: zone('milestones', [
        source({name: 'Mayor', playerName: 'Vika', color: rival}),
        ...OPEN_MILESTONES.slice(1),
      ]),
    });
    const vm = wrapper.vm as unknown as RailVm;
    expect(vm.pending).to.have.lengthOf(1);
    await wrapper.setProps({epoch: 'run-2'});
    expect(vm.pending).to.have.lengthOf(0);
    // The reseeded view renders the truth directly (no held pre-state).
    expect(wrapper.find('.con-strat__gem').exists()).to.be.true;
  });

  it('the medal art rides the optical-fit map (normalised size, never bare contain)', () => {
    const wrapper = mountRail();
    const style = wrapper.find('.con-strat__zone--milestones .con-strat__art').attributes('style') ?? '';
    // mayor.png is a measured 512 premium asset — the fit map must resolve
    // to an explicit percentage pair, not the contain fallback.
    expect(style).to.contain('background-size:');
    expect(style).to.contain('%');
    expect(style).to.not.contain('contain');
  });
});
