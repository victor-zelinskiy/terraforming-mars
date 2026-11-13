/*
 * HydroTrack — the Hydronetwork's twelve stages as ONE composed track: 0…5 on the top row, 6…9 on the bottom row, the
 * two VP stages in the finish zone, and a measured SVG for the two conduits no row can draw (the serpentine return
 * 5 → 6, the entry 9 → finish). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): one prop in
 * (the stages), one event out (`select`, a cell's own, handed up), nothing exposed.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {globalConfig} from '../getLocalVue';
import HydroTrack from '@/client/components/hydronetwork/HydroTrack.vue';
import {HydroStageVM} from '@/client/components/hydronetwork/hydroNetworkModel';
import {HYDRO_STAGES} from '@/client/components/hydronetwork/hydroStages';

// A stage's own face is `HydroStageCell`'s subject; this spec reads what the track HANDS it and where it stands it.
// The stand-in carries the cell's one hook the track measures by (`data-hydro-pos`).
// (A render function, not a template string: the runtime compiler is not in this build.)
const CellStub = defineComponent({
  name: 'HydroStageCell',
  props: {vm: {type: Object as PropType<HydroStageVM>, required: true}},
  emits: ['select'],
  setup(props) {
    return () => h('i', {'class': 'cell-stub', 'data-hydro-pos': props.vm.position});
  },
});

/** The stage at `position`, as the track's model hands it — nothing planned, nothing visited. */
function at(position: number, state: HydroStageVM['state'] = 'future'): HydroStageVM {
  return {
    stage: HYDRO_STAGES[position],
    position,
    state,
    markers: [],
    occupiedByOther: false,
    isSelected: false,
    rewardedByViewer: false,
    crossedByViewer: false,
    skippedByViewer: false,
    willSkipReward: false,
    routeRewarded: false,
    routeExcluded: false,
    targetLegal: false,
    targetAffordable: false,
    requiredTags: [],
    wildCoveredTags: [],
    missingTags: [],
  };
}

/** The whole track, every stage in the state `stateOf` names for its position. */
function stagesIn(stateOf: (position: number) => HydroStageVM['state'] = () => 'future'): Array<HydroStageVM> {
  return HYDRO_STAGES.map((_, position) => at(position, stateOf(position)));
}

type Box = {left: number, top: number, width: number, height: number};

function rect(box: Box): DOMRect {
  return {x: box.left, y: box.top, ...box, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({})};
}

function track(stages: ReadonlyArray<HydroStageVM>) {
  // No i18n plugin on purpose: the component imports its own `v-i18n`. Leaning on the global registration would be
  // a Vue warning here — and the warn handler fails the spec.
  return mount(HydroTrack, {props: {stages}, global: {config: globalConfig.global.config, stubs: {HydroStageCell: CellStub}}});
}

/** Past the frame the track's measure waits for, the tick after it and the render that follows. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 60));
  await nextTick();
}

describe('HydroTrack — the Hydronetwork\'s composed track', () => {
  it('stands twelve stages as two rows and a finish zone — 0…5, 6…9, [10 · 11] — each cell handed its own stage', () => {
    const stages = stagesIn();
    expect(stages, 'the track is twelve stages long').to.have.length(12);
    const w = track(stages);
    expect(w.classes()).to.deep.eq(['hydro-track', 'hydro-track--composed']);
    expect(w.attributes('role')).to.eq('list');

    const positionsIn = (selector: string) => w.findAll(selector).map((cell) => Number(cell.attributes('data-hydro-pos')));
    expect(positionsIn('.hydro-track__row--top > .hydro-track__cell')).to.deep.eq([0, 1, 2, 3, 4, 5]);
    expect(positionsIn('.hydro-track__row--bottom > .hydro-track__cell')).to.deep.eq([6, 7, 8, 9]);
    expect(positionsIn('.hydro-track__finish-cells > .hydro-track__cell.hydro-track__cell--finish')).to.deep.eq([10, 11]);
    expect(w.findAllComponents(CellStub).map((cell) => cell.props('vm'))).to.deep.eq(stages);

    // A link stands before every cell of a row but its first; the finish zone is reached by the drawn conduit.
    expect(w.findAll('.hydro-track__row--top > .hydro-track__link')).to.have.length(5);
    expect(w.findAll('.hydro-track__row--bottom > .hydro-track__link')).to.have.length(3);
    expect(w.findAll('.hydro-track__finish .hydro-track__link')).to.have.length(0);
    expect(w.find('.hydro-track__finish-head').text()).to.eq('Finish');
    expect(w.find('.hydro-track__return-gap').attributes('aria-hidden')).to.eq('true');
    expect(w.find('svg').exists(), 'nothing is laid out yet — no conduit is drawn').to.eq(false);
  });

  it('a link reads the stage it leads INTO: travelled, planned, or quiet', () => {
    // 0…2 behind the marker (it stands on 2), 3…4 the planned route to the target 4, the rest untouched.
    const w = track(stagesIn((position) => (position < 2 ? 'completed' : position === 2 ? 'current' : position === 3 ? 'route' : position === 4 ? 'target' : 'future')));
    const links = w.findAll('.hydro-track__row--top > .hydro-track__link');
    expect(links.map((link) => link.classes())).to.deep.eq([
      ['hydro-track__link', 'hydro-track__link--done'],
      ['hydro-track__link', 'hydro-track__link--done'],
      ['hydro-track__link', 'hydro-track__link--route'],
      ['hydro-track__link', 'hydro-track__link--route'],
      ['hydro-track__link'],
    ]);
    expect(links.every((link) => link.attributes('aria-hidden') === 'true')).to.eq(true);
    expect(w.findAll('.hydro-track__row--bottom > .hydro-track__link').map((link) => link.classes()))
      .to.deep.eq([['hydro-track__link'], ['hydro-track__link'], ['hydro-track__link']]);
  });

  it('hands a cell\'s `select` up with its payload — from either row and from the finish zone', () => {
    const w = track(stagesIn());
    const cells = w.findAllComponents(CellStub);
    cells[3].vm.$emit('select', 3);
    cells[7].vm.$emit('select', 7);
    cells[11].vm.$emit('select', 11);
    expect(w.emitted('select')).to.deep.eq([[3], [7], [11]]);
  });

  it('once laid out, draws the two conduits from its cells\' measured boxes, in the route language of the stages — and lets the window go when it leaves', async () => {
    // The marker stands on 6 (the return was travelled); 7…9 and the finish stage 10 are the planned route.
    const planned = (position: number): HydroStageVM['state'] => (position < 6 ? 'completed' : position === 6 ? 'current' : position < 10 ? 'route' : position === 10 ? 'target' : 'future');
    const w = track(stagesIn(planned));
    await settle();
    expect(w.find('svg').exists(), 'jsdom lays nothing out').to.eq(false);

    // The page laid the track out: its own box, the three cells the conduits hang on, the finish zone.
    let reads = 0;
    (w.element as HTMLElement).getBoundingClientRect = () => {
      reads++;
      return rect({left: 100, top: 50, width: 700, height: 220});
    };
    const stand = (selector: string, box: Box): void => {
      (w.find(selector).element as HTMLElement).getBoundingClientRect = () => rect(box);
    };
    stand('[data-hydro-pos="5"]', {left: 600, top: 60, width: 80, height: 80});
    stand('[data-hydro-pos="6"]', {left: 110, top: 180, width: 80, height: 80});
    stand('[data-hydro-pos="9"]', {left: 410, top: 180, width: 80, height: 80});
    stand('.hydro-track__finish', {left: 560, top: 170, width: 200, height: 100});
    window.dispatchEvent(new window.Event('resize'));
    await settle();
    expect(reads).to.eq(1);

    const svg = w.find('svg.hydro-track__snake');
    expect([svg.attributes('viewBox'), svg.attributes('width'), svg.attributes('height')]).to.deep.eq(['0 0 700 220', '700', '220']);
    expect(svg.attributes('aria-hidden')).to.eq('true');
    // Out of the right of stage 5, down to the mid line, left along it, down into the top-centre of stage 6 —
    // every corner rounded (13 px, or half the leg where the leg is shorter).
    const returnPath = 'M 580 50 L 590 50 Q 600 50 600 60 L 600 97 Q 600 110 587 110 L 60 110 Q 50 110 50 120 L 50 130';
    // Straight from the right of stage 9 to 2 px short of the finish zone.
    const enterPath = 'M 390 170 L 458 170';
    expect(w.findAll('.hydro-track__snake-base').map((path) => path.attributes('d'))).to.deep.eq([returnPath, enterPath]);
    expect(w.findAll('.hydro-track__snake-flow').map((path) => [path.classes(), path.attributes('d')])).to.deep.eq([
      [['hydro-track__snake-flow', 'hydro-track__snake-flow--established'], returnPath],
      [['hydro-track__snake-flow', 'hydro-track__snake-flow--preview'], enterPath],
    ]);
    expect(w.findAll('.hydro-track__snake-arrow').map((arrow) => [arrow.classes(), arrow.attributes('points')])).to.deep.eq([
      [['hydro-track__snake-arrow', 'hydro-track__snake-arrow--established'], '45.5,123 54.5,123 50,130'],
      [['hydro-track__snake-arrow', 'hydro-track__snake-arrow--preview'], '451,165.5 451,174.5 458,170'],
    ]);

    // New stages re-measure; an untouched track keeps its conduits as quiet base lines — no flow drawn over them.
    await w.setProps({stages: stagesIn()});
    await settle();
    expect(reads, 'the stages changed').to.eq(2);
    expect(w.findAll('.hydro-track__snake-base')).to.have.length(2);
    expect(w.findAll('.hydro-track__snake-flow')).to.have.length(0);
    expect(w.findAll('.hydro-track__snake-arrow').map((arrow) => arrow.classes())).to.deep.eq([
      ['hydro-track__snake-arrow', 'hydro-track__snake-arrow--base'],
      ['hydro-track__snake-arrow', 'hydro-track__snake-arrow--base'],
    ]);

    w.unmount();
    window.dispatchEvent(new window.Event('resize'));
    await settle();
    expect(reads, 'unmounted — nothing listens').to.eq(2);
  });
});
