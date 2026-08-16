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
  activatingKeys: Array<string>,
  repulseKeys: Array<string>,
  pendingActivations: Array<{key: string}>,
  crownMoveKeys: Array<string>,
  tickKeys: Array<string>,
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
    // The finished body: ONE display case + ONE spine (the right border and
    // terminators live inside the viewport — never a cropped glass plane).
    expect(wrapper.findAll('.con-strat__case')).to.have.lengthOf(1);
    expect(wrapper.findAll('.con-strat__spine')).to.have.lengthOf(1);
    // One medal row per item, art bound to the shared assets/ma slug.
    expect(zones[0].findAll('.con-strat__item')).to.have.lengthOf(3);
    expect(zones[1].findAll('.con-strat__item')).to.have.lengthOf(2);
    const art = zones[0].find('.con-strat__art');
    expect(art.attributes('style')).to.contain('assets/ma/mayor.png');
    // Every medallion stands on its display puck (the state's rim carrier).
    expect(zones[0].findAll('.con-strat__pedestal')).to.have.lengthOf(3);
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

  it('an open milestone prints the CURRENT value with a hairline meter (never a bare pair)', () => {
    const wrapper = mountRail();
    const row = wrapper.findAll('.con-strat__zone--milestones .con-strat__item')[0];
    expect(row.find('.con-strat__cell').text()).to.eq('2/3');
    const fill = row.find('.con-strat__meter-fill');
    expect(fill.exists()).to.be.true;
    expect(fill.attributes('style')).to.contain('width: 67%');
    // Ready adds the mark beside the value (readability without colour).
    const ready = wrapper.findAll('.con-strat__zone--milestones .con-strat__item')[2];
    expect(ready.find('.con-strat__readymark').exists()).to.be.true;
    expect(row.find('.con-strat__readymark').exists()).to.be.false;
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

  it('a taken milestone installs the calm OWNER SEAL and keeps the emblem CLEAN (no cube on it)', () => {
    const wrapper = mountRail({
      milestones: zone('milestones', [
        source({name: 'Mayor', playerName: 'Vika', color: rival, scores: []}),
        ...OPEN_MILESTONES.slice(1),
      ]),
    });
    const row = wrapper.find('.con-strat__zone--milestones .con-strat__item');
    expect(row.classes()).to.include('con-strat__item--taken');
    expect(row.find('.con-strat__plate').classes()).to.include('player_bg_color_blue');
    expect(row.find('.con-strat__cell').exists()).to.be.false;
    // POLISH 2: the owner is NOT doubled on the emblem — no floating cube;
    // the seal and the tray slot carry it.
    expect(row.find('.con-strat__gem').exists()).to.be.false;
    // The right zone carries the seal: one horizontal line — the owner's
    // CUBE (who), the word, the neutral tick (done) — never colour alone,
    // and never a big CTA-looking plaque.
    const seal = row.find('.con-strat__ownseal');
    expect(seal.exists()).to.be.true;
    expect(seal.find('.con-strat__ownseal-cube').classes()).to.include('player_bg_color_blue');
    expect(seal.find('.con-strat__ownseal-word').text()).to.not.eq('');
    expect(seal.find('.con-strat__ownseal-tick').text()).to.eq('✓');
    expect(seal.classes()).to.not.include('con-strat__ownseal--mine');
    // The tray's first pip took the owner colour.
    expect(wrapper.find('.con-strat__zone--milestones .con-strat__pip').classes()).to.include('player_bg_color_blue');
  });

  it('my own claimed milestone marks the seal as mine (white-rimmed crystal)', () => {
    const wrapper = mountRail({
      milestones: zone('milestones', [
        source({name: 'Mayor', playerName: 'Me', color: me, scores: []}),
        ...OPEN_MILESTONES.slice(1),
      ]),
    });
    const row = wrapper.find('.con-strat__zone--milestones .con-strat__item');
    expect(row.classes()).to.include('con-strat__item--mine');
    expect(row.find('.con-strat__ownseal').classes()).to.include('con-strat__ownseal--mine');
  });

  it('award rows read as a RANKING CASSETTE: crown-cap over the leader cube; a DUEL chaser is unranked', () => {
    const wrapper = mountRail();
    const banker = wrapper.find('.con-strat__zone--awards .con-strat__item');
    // ONE physical module — the cassette — never two floating rows.
    expect(banker.findAll('.con-strat__cassette')).to.have.lengthOf(1);
    const units = banker.findAll('.con-strat__unitbody');
    expect(units).to.have.lengthOf(2);
    expect(units[0].classes()).to.include('con-strat__unitbody--lead');
    // The crown is a CAP inside the PLAYER ZONE (an overlay over the cube),
    // never a flow member beside it — and no roman numerals anywhere.
    expect(units[0].find('.con-strat__pz .con-strat__crown').exists()).to.be.true;
    expect(banker.find('.con-strat__rank').exists()).to.be.false;
    // Both levels' cubes live in the SAME fixed player zone; the values in
    // the same fixed score zone (the axes are structural).
    expect(units[0].find('.con-strat__pz .con-strat__cube').exists()).to.be.true;
    expect(units[1].find('.con-strat__pz .con-strat__cube').exists()).to.be.true;
    expect(units[0].find('.con-strat__num').text()).to.eq('4');
    expect(units[0].find('.con-strat__cube').classes()).to.include('con-strat__cube--me');
    expect(units[1].classes()).to.not.include('con-strat__unitbody--lead');
    expect(units[1].find('.con-strat__num').text()).to.eq('2');
    // Two players: only 1st place scores — the chaser stays visible but
    // wears NO rank language at all (no crown, no silver).
    expect(units[1].classes()).to.include('con-strat__unitbody--chase');
    expect(units[1].find('.con-strat__crown').exists()).to.be.false;
    // The zero race renders ONE calm centred «—» inside a same-size
    // cassette — no empty player slots, no stray edge dash.
    const thermalist = wrapper.findAll('.con-strat__zone--awards .con-strat__item')[1];
    expect(thermalist.find('.con-strat__cassette .con-strat__none').exists()).to.be.true;
    expect(thermalist.findAll('.con-strat__unit')).to.have.lengthOf(0);
    // Unsponsored awards are the quieter objects.
    expect(banker.classes()).to.include('con-strat__item--quiet');
  });

  it('a funded award pins the SPONSOR cube to the emblem socket (apart from the leader cubes)', () => {
    const wrapper = mountRail({
      awards: zone('awards', [
        source({name: 'Banker', playerName: 'Vika', color: rival,
          scores: [{color: me, score: 5}, {color: rival, score: 2}]}),
      ]),
    });
    const row = wrapper.find('.con-strat__zone--awards .con-strat__item');
    // The sponsor cube lives ON the medal (the value zone belongs to the
    // race), in the metal socket — and it is the only place the funder
    // shows on the row.
    const gem = row.find('.con-strat__medal .con-strat__gem');
    expect(gem.exists()).to.be.true;
    expect(gem.classes()).to.include('player_bg_color_blue');
    // The race keeps running: leader cubes stay in the podium untouched.
    expect(row.find('.con-strat__unitbody--lead .con-strat__cube').classes()).to.include('player_bg_color_red');
  });

  it('a REAL second place (single leader, 3+ players) is the quiet silver second line', () => {
    const wrapper = mountRail({
      awards: zone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 7}, {color: rival, score: 3}, {color: third, score: 1}]}),
      ]),
    });
    const units = wrapper.findAll('.con-strat__unitbody');
    expect(units[0].find('.con-strat__crown').exists()).to.be.true;
    expect(units[1].classes()).to.include('con-strat__unitbody--ii');
    expect(units[1].find('.con-strat__crown').exists()).to.be.false;
    expect(wrapper.find('.con-strat__rank').exists()).to.be.false;
  });

  it('a tie shows EVERY player: full equal cubes under ONE crown + arch, one value, no «+N»', () => {
    const wrapper = mountRail({
      awards: zone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 3}, {color: rival, score: 3}, {color: third, score: 3}]}),
      ]),
    });
    const lead = wrapper.find('.con-strat__unitbody--lead');
    // ALL tied players stand as full cubes — never a cut, never a «+N»;
    // the cluster-count class steps the size down instead.
    expect(lead.findAll('.con-strat__cube')).to.have.lengthOf(3);
    expect(lead.find('.con-strat__morecnt').exists()).to.be.false;
    expect(lead.find('.con-strat__chips').classes()).to.include('con-strat__chips--n3');
    // ONE crown for the whole group, capping the gold ARCH that spans it.
    expect(lead.findAll('.con-strat__crown')).to.have.lengthOf(1);
    expect(lead.findAll('.con-strat__arch')).to.have.lengthOf(1);
    expect(lead.findAll('.con-strat__num')).to.have.lengthOf(1);
    // A SINGLE leader carries the cap alone — no group arch.
    const solo = mountRail().find('.con-strat__unitbody--lead');
    expect(solo.find('.con-strat__crown').exists()).to.be.true;
    expect(solo.find('.con-strat__arch').exists()).to.be.false;
  });

  it('a LIVE leader change plays the crown hand-over once — never on mount or a plain re-render', async () => {
    const wrapper = mountRail();
    const queue = captureTimers(wrapper);
    const vm = wrapper.vm as unknown as RailVm;
    expect(vm.crownMoveKeys).to.have.lengthOf(0);
    // The rival overtakes: red 4 → blue 6 (a real hand-over).
    await wrapper.setProps({
      awards: zone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 4}, {color: rival, score: 6}]}),
        OPEN_AWARDS[1],
      ]),
    });
    expect(vm.crownMoveKeys).to.deep.eq(['a:Banker']);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-strat__zone--awards .con-strat__item').classes())
      .to.include('con-strat__item--crownmove');
    // A poll re-render with the SAME leader adds nothing.
    await wrapper.setProps({
      awards: zone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 4}, {color: rival, score: 6}]}),
        OPEN_AWARDS[1],
      ]),
    });
    expect(vm.crownMoveKeys).to.deep.eq(['a:Banker']);
    // Drain every queued beat (the value roll's clear rides the same queue).
    while (queue.length > 0) {
      queue.shift()?.fn();
    }
    expect(vm.crownMoveKeys).to.have.lengthOf(0);
  });

  it('a value change ROLLS along its direction (up on a gain, down on a loss)', async () => {
    const wrapper = mountRail();
    captureTimers(wrapper);
    const vm = wrapper.vm as unknown as RailVm;
    await wrapper.setProps({
      awards: zone('awards', [
        source({name: 'Banker', scores: [{color: me, score: 7}, {color: rival, score: 2}]}),
        OPEN_AWARDS[1],
      ]),
    });
    expect(vm.tickKeys.some((k) => k.endsWith('#up'))).to.be.true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-strat__num--tick-up').exists()).to.be.true;
  });

  it('award availability is DOOR-level: the head arms, the next slot pip golds, rows stay calm', () => {
    const wrapper = mountRail({
      awards: zone('awards', OPEN_AWARDS, {availableNow: new Set(['Banker', 'Thermalist'])}),
    });
    const az = wrapper.find('.con-strat__zone--awards');
    expect(az.find('.con-strat__head').classes()).to.include('con-strat__head--armed');
    // The FIRST open slot names where the next seal lands…
    expect(az.find('.con-strat__pip').classes()).to.include('con-strat__pip--next');
    // …and NO award row glows (a fundable column would all be lit — noise).
    expect(az.findAll('.con-strat__item--now')).to.have.lengthOf(0);
    expect(az.findAll('.con-strat__item--ready')).to.have.lengthOf(0);
    // Milestones keep the row-level language and never arm their head.
    const wrapper2 = mountRail({
      milestones: zone('milestones', OPEN_MILESTONES, {availableNow: new Set(['Builder'])}),
    });
    const mz = wrapper2.find('.con-strat__zone--milestones');
    expect(mz.find('.con-strat__head').classes()).to.not.include('con-strat__head--armed');
    expect(mz.find('.con-strat__pip').classes()).to.include('con-strat__pip--next');
    expect(mz.findAll('.con-strat__item--now')).to.have.lengthOf(1);
  });

  it('no offer → no gold: the tray reads neutral when nothing is actionable', () => {
    const wrapper = mountRail();
    expect(wrapper.find('.con-strat__pip--next').exists()).to.be.false;
    expect(wrapper.find('.con-strat__head--armed').exists()).to.be.false;
  });

  it('the value FOOT swaps honestly: «ДОСТУПНО» only while offered, the meter otherwise', () => {
    // Builder is met AND offered → the word replaces the meter.
    const wrapper = mountRail({
      milestones: zone('milestones', OPEN_MILESTONES, {availableNow: new Set(['Builder'])}),
    });
    const rows = wrapper.findAll('.con-strat__zone--milestones .con-strat__item');
    expect(rows[2].find('.con-strat__avail').text()).to.not.eq('');
    expect(rows[2].find('.con-strat__meter').exists()).to.be.false;
    // Met but NOT offered (State B): the full meter, and NO availability word.
    const wrapper2 = mountRail({milestones: zone('milestones', OPEN_MILESTONES)});
    const builder = wrapper2.findAll('.con-strat__zone--milestones .con-strat__item')[2];
    expect(builder.find('.con-strat__avail').exists()).to.be.false;
    expect(builder.find('.con-strat__meter-fill').attributes('style')).to.contain('width: 100%');
    // …and an ordinary open row keeps its calm meter.
    expect(rows[0].find('.con-strat__meter').exists()).to.be.true;
    expect(rows[0].find('.con-strat__avail').exists()).to.be.false;
  });

  describe('the ACTIVATION machine (became claimable NOW)', () => {
    const withOffer = (names: Array<string>) =>
      zone('milestones', OPEN_MILESTONES, {availableNow: new Set(names)});

    it('an already-offered claim on MOUNT seeds silently — final state, no ceremony', () => {
      const wrapper = mountRail({milestones: withOffer(['Builder'])});
      const vm = wrapper.vm as unknown as RailVm;
      expect(vm.activatingKeys).to.have.lengthOf(0);
      expect(vm.repulseKeys).to.have.lengthOf(0);
      expect(wrapper.find('.con-strat__item--activating').exists()).to.be.false;
      expect(wrapper.find('.con-strat__item--now .con-strat__avail').exists()).to.be.true;
    });

    it('the FIRST live rising edge plays the full ceremony, once', async () => {
      const wrapper = mountRail();
      const queue = captureTimers(wrapper);
      const vm = wrapper.vm as unknown as RailVm;
      await wrapper.setProps({milestones: withOffer(['Builder'])});
      expect(vm.activatingKeys).to.deep.eq(['m:Builder']);
      await wrapper.vm.$nextTick();
      const builder = wrapper.findAll('.con-strat__zone--milestones .con-strat__item')[2];
      expect(builder.classes()).to.include('con-strat__item--activating');
      // A poll re-render with the SAME offer must not restart the phrase.
      await wrapper.setProps({milestones: withOffer(['Builder'])});
      expect(vm.activatingKeys).to.deep.eq(['m:Builder']);
      queue.shift()?.fn(); // the ceremony's own end
      expect(vm.activatingKeys).to.have.lengthOf(0);
    });

    it('a RE-gained offer (the turn came back) pulses — never the full ceremony again', async () => {
      const wrapper = mountRail();
      const queue = captureTimers(wrapper);
      const vm = wrapper.vm as unknown as RailVm;
      await wrapper.setProps({milestones: withOffer(['Builder'])});
      queue.shift()?.fn(); // ceremony ends
      await wrapper.setProps({milestones: withOffer([])}); // the turn moved on
      await wrapper.setProps({milestones: withOffer(['Builder'])}); // …and returned
      expect(vm.activatingKeys).to.have.lengthOf(0);
      expect(vm.repulseKeys).to.deep.eq(['m:Builder']);
      queue.shift()?.fn();
      expect(vm.repulseKeys).to.have.lengthOf(0);
    });

    it('a flip under COVER queues and plays on the uncover (the watched moment)', async () => {
      const wrapper = mountRail({covered: true});
      const queue = captureTimers(wrapper);
      const vm = wrapper.vm as unknown as RailVm;
      await wrapper.setProps({milestones: withOffer(['Builder'])});
      expect(vm.activatingKeys).to.have.lengthOf(0);
      expect(vm.pendingActivations).to.have.lengthOf(1);
      await wrapper.setProps({covered: false});
      expect(vm.activatingKeys).to.deep.eq(['m:Builder']);
      expect(vm.pendingActivations).to.have.lengthOf(0);
      queue.shift()?.fn();
      expect(vm.activatingKeys).to.have.lengthOf(0);
    });

    it('a claim consumes any live or queued activation for the row', async () => {
      const wrapper = mountRail();
      captureTimers(wrapper);
      const vm = wrapper.vm as unknown as RailVm;
      await wrapper.setProps({milestones: withOffer(['Builder'])});
      expect(vm.activatingKeys).to.deep.eq(['m:Builder']);
      await wrapper.setProps({
        milestones: zone('milestones', [
          OPEN_MILESTONES[0], OPEN_MILESTONES[1],
          source({name: 'Builder', playerName: 'Me', color: me, scores: []}),
        ]),
      });
      expect(vm.activatingKeys).to.have.lengthOf(0);
      expect(vm.pendingActivations).to.have.lengthOf(0);
    });
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
    // The beat's two layers share the value zone: the held numbers dissolve
    // while the owner seal stamps in over them. The emblem stays clean —
    // the seal's CUBE is the owner marker.
    expect(row().find('.con-strat__cell').exists()).to.be.true;
    expect(row().find('.con-strat__ownseal-cube').classes()).to.include('player_bg_color_blue');
    expect(row().find('.con-strat__gem').exists()).to.be.false;
    queue.shift()?.fn(); // the seal end
    await wrapper.vm.$nextTick();
    expect(row().classes()).to.include('con-strat__item--taken');
    expect(row().find('.con-strat__cell').exists()).to.be.false;
    expect(row().find('.con-strat__ownseal-cube').classes()).to.include('player_bg_color_blue');
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
    expect(wrapper.find('.con-strat__ownseal').exists()).to.be.true;
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
