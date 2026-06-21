import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import FinalScoringReveal from '@/client/components/endgame/FinalScoringReveal.vue';
import {buildEndgameModel, EndgamePlayerInput, EndgameModel} from '@/client/components/endgame/endgameModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Color} from '@/common/Color';
import {endgameState, resetEndgameState} from '@/client/components/endgame/endgameState';

function breakdown(p: Partial<VictoryPointsBreakdown>): VictoryPointsBreakdown {
  const b: VictoryPointsBreakdown = {
    terraformRating: 20, terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 0, awards: 0, greenery: 0, city: 0, escapeVelocity: 0,
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0, deltaProject: 0, victoryPoints: 0, total: 20,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [], negativeVP: 0,
  };
  const merged = {...b, ...p};
  const trb = merged.terraformRatingBreakdown;
  merged.terraformRatingBreakdown = {...trb, base: merged.terraformRating - (trb.temperature + trb.oxygen + trb.oceans + trb.venus + trb.cards)};
  if (merged.victoryPoints !== 0 && merged.detailsCards.length === 0) {
    merged.detailsCards = [{cardName: 'TestFixed', victoryPoint: merged.victoryPoints, kind: 'fixed'}];
  }
  if (p.total === undefined) {
    merged.total = merged.terraformRating + merged.milestones + merged.awards + merged.greenery + merged.city + merged.victoryPoints;
  }
  return merged;
}

function input(color: Color, name: string, b: Partial<VictoryPointsBreakdown>): EndgamePlayerInput {
  return {color, name, corporations: ['Helion'], megacredits: 0, breakdown: breakdown(b), vpByGeneration: [], globalSteps: {}};
}

function model(inputs: Array<EndgamePlayerInput>): EndgameModel {
  return buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 9});
}

function mountReveal(m: EndgameModel, order: ReadonlyArray<Color>) {
  return mount(FinalScoringReveal, {...globalConfig, props: {model: m, playerOrder: order}});
}

describe('FinalScoringReveal', () => {
  afterEach(() => resetEndgameState());

  it('renders one lane per player in neutral order and exactly two controls (no Speed up)', () => {
    const m = model([input('red', 'A', {terraformRating: 30, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    expect(wrapper.findAll('.fsr__lane')).to.have.length(2);
    // Skip animation + Open results now — the "Speed up" control was removed.
    expect(wrapper.findAll('.fsr__ctl')).to.have.length(2);
    expect(wrapper.text()).to.not.contain('Speed up');
    // Winner banner not shown yet.
    expect(wrapper.find('.fsr__finale').exists()).is.false;
  });

  it('does not leak the final total into the DOM before the winner step', () => {
    // A has 41 final; while revealing, the lane must never show 41 yet.
    const m = model([input('red', 'A', {terraformRating: 30, milestones: 5, awards: 6}), input('blue', 'B', {terraformRating: 20})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    expect(wrapper.text()).to.not.contain('41');
  });

  it('skip jumps to the winner with the correct final totals + CTA', async () => {
    const m = model([input('red', 'A', {terraformRating: 35, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    (wrapper.vm as unknown as {skipAnimation: () => void}).skipAnimation();
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as unknown as {phase: string}).phase).to.eq('winner');
    expect(wrapper.find('.fsr__finale').exists()).is.true;
    // 'A' winning lane shows 40 (35 + 5).
    const winnerLane = wrapper.find('.fsr__lane--winner');
    expect(winnerLane.exists()).is.true;
    expect(winnerLane.find('.fsr__lane-total-num').text()).to.eq('40');
  });

  it('the CTA opens the detailed results', async () => {
    const m = model([input('red', 'A', {terraformRating: 35}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    (wrapper.vm as unknown as {skipAnimation: () => void}).skipAnimation();
    await wrapper.vm.$nextTick();
    await wrapper.find('.fsr__cta').trigger('click');
    expect(endgameState.resultsOpen).is.true;
    expect(endgameState.revealActive).is.false;
  });

  it('starts with no chips and zero totals (nothing revealed yet)', () => {
    const m = model([input('red', 'A', {terraformRating: 30, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    expect(wrapper.findAll('.fsr__chip')).to.have.length(0);
    expect(wrapper.find('.fsr__lane-total-num').text()).to.eq('0');
    // No segment is revealed at intro.
    expect(wrapper.findAll('.fsr__seg--revealed')).to.have.length(0);
  });

  it('renders stacked bar segments and group chips after the reveal', async () => {
    const m = model([input('red', 'A', {terraformRating: 30, greenery: 4, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    (wrapper.vm as unknown as {skipAnimation: () => void}).skipAnimation();
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.fsr__seg--revealed').length).to.be.greaterThan(0);
    // A chip per started group, in both lanes.
    expect(wrapper.findAll('.fsr__chip').length).to.be.greaterThan(0);
  });

  it('updates the stage number as later groups become active (not stuck at 1)', async () => {
    const m = model([input('red', 'A', {terraformRating: 30, greenery: 4, city: 3, victoryPoints: 8, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    const vm = wrapper.vm as unknown as {
      activeSegment: number; reveal: {segments: Array<{group: string}>; groups: Array<{key: string}>};
      activeStage: {index: number; groupLabel: string} | undefined; stageStepText: string;
    };
    // Drive the active segment to the 'cards' group and check the stage index.
    const cardsSeg = vm.reveal.segments.findIndex((s) => s.group === 'cards');
    const cardsGroupPos = vm.reveal.groups.findIndex((g) => g.key === 'cards');
    expect(cardsSeg).to.be.greaterThan(0);
    vm.activeSegment = cardsSeg;
    await wrapper.vm.$nextTick();
    expect(vm.activeStage?.index).to.eq(cardsGroupPos + 1);
    expect(vm.activeStage?.index).to.be.greaterThan(1);
    expect(vm.stageStepText).to.contain(String(cardsGroupPos + 1));
  });

  it('builds a rich per-player card breakdown (families + sorted card list)', () => {
    const m = model([
      input('red', 'A', {terraformRating: 20, victoryPoints: 12, detailsCards: [
        {cardName: 'Lichen', victoryPoint: 4, kind: 'fixed'},
        {cardName: 'Search For Life', victoryPoint: 3, kind: 'conditional'},
        {cardName: 'Tardigrades', victoryPoint: 5, kind: 'resource'},
      ]}),
      input('blue', 'B', {terraformRating: 20}),
    ]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    const vm = wrapper.vm as unknown as {buildInspectorContent: (g: string, sub: string | null, c: string | null) => {playerName: string; total: number; subRows: Array<{key: string}>; cards: Array<{vp: number}>; hint: string}};
    const c = vm.buildInspectorContent('cards', null, 'red');
    expect(c.playerName).to.eq('A');
    expect(c.total).to.eq(12);
    expect(c.subRows.map((r) => r.key)).to.deep.eq(['cards-fixed', 'cards-conditional', 'cards-resource']);
    expect(c.cards.length).to.eq(3);
    expect(c.cards[0].vp).to.eq(5); // sorted by VP desc

    // Scoped to a single subcategory → only that family's cards, no sub-rows.
    const scoped = vm.buildInspectorContent('cards', 'cards-conditional', 'red');
    expect(scoped.subRows.length).to.eq(0);
    expect(scoped.cards.length).to.eq(1);
    expect(scoped.cards[0].vp).to.eq(3);
  });

  it('builds a penalty breakdown (card penalties + escape velocity) and compares on a pill', () => {
    const m = model([
      input('red', 'A', {terraformRating: 20, victoryPoints: -2, escapeVelocity: -3, detailsCards: [
        {cardName: 'Vermin', victoryPoint: -2, kind: 'penalty'},
      ]}),
      input('blue', 'B', {terraformRating: 20}),
    ]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    const vm = wrapper.vm as unknown as {buildInspectorContent: (g: string, sub: string | null, c: string | null) => {playerName: string; cards: Array<{vp: number}>; sources: Array<{vp: number}>; compare: Array<unknown>}};
    const player = vm.buildInspectorContent('penalty', null, 'red');
    expect(player.cards.length).to.eq(1); // the -2 card penalty
    // Pill hover (no player) → cross-player comparison.
    const compare = vm.buildInspectorContent('penalty', null, null);
    expect(compare.playerName).to.eq('');
    expect(compare.compare.length).to.eq(2);
    // Scoped to escape velocity → only that source.
    const ev = vm.buildInspectorContent('penalty', 'penalty-ev', 'red');
    expect(ev.sources.length).to.eq(1);
    expect(ev.sources[0].vp).to.eq(-3);
  });

  it('renders the timeline as one row with the Winner node + connectors', () => {
    const m = model([input('red', 'A', {terraformRating: 30, greenery: 4, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    // Winner node lives in the SAME timeline list (not a separate row/button).
    expect(wrapper.find('.fsr__timeline .fsr__tl-node--final').exists()).is.true;
    // Connectors between nodes.
    expect(wrapper.findAll('.fsr__tl-link').length).to.be.greaterThan(0);
  });

  it('shows the current leader during reveal and locks the winner only at the end', async () => {
    const m = model([input('red', 'A', {terraformRating: 35, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    // Before the winner step, no gold winner lane yet.
    expect(wrapper.find('.fsr__lane--winner').exists()).is.false;
    const vm = wrapper.vm as unknown as {skipAnimation: () => void; leader: {colors: Array<string>; total: number; margin: number}};
    (wrapper.vm as unknown as {skipAnimation: () => void}).skipAnimation();
    await wrapper.vm.$nextTick();
    // Leader is computed from the (now fully) revealed categories.
    expect(vm.leader.colors).to.deep.eq(['red']);
    expect(vm.leader.total).to.eq(40);
    expect(vm.leader.margin).to.eq(18);
    expect(wrapper.find('.fsr__lane--winner').exists()).is.true;
  });

  it('reserves PERMANENT TR + Cards breakdown rows; a top-level row-backed chip only highlights', () => {
    const m = model([
      input('red', 'A', {terraformRating: 20, victoryPoints: 9, detailsCards: [
        {cardName: 'F', victoryPoint: 5, kind: 'fixed'},
        {cardName: 'C', victoryPoint: 4, kind: 'conditional'},
      ]}),
      input('blue', 'B', {terraformRating: 20, greenery: 3}),
    ]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    const vm = wrapper.vm as unknown as {
      breakdownRows: Array<{group: string; subs: Array<unknown>}>; hasBreakdownRow: (g: string) => boolean;
      onChipHover: (g: string, c: string, e: Event) => void; inspector: unknown;
    };
    // Both rows ALWAYS exist (per lane), regardless of reveal/hover state.
    expect(vm.breakdownRows.map((r) => r.group)).to.deep.eq(['tr', 'cards']);
    expect(vm.breakdownRows.find((r) => r.group === 'cards')?.subs.length).to.eq(2); // fixed + conditional
    expect(wrapper.findAll('.fsr__brow--tr').length).to.eq(2); // one per lane
    expect(wrapper.findAll('.fsr__brow--cards').length).to.eq(2);
    expect(vm.hasBreakdownRow('tr')).is.true;
    expect(vm.hasBreakdownRow('cards')).is.true;
    expect(vm.hasBreakdownRow('greenery')).is.false;
    // A row-backed top-level chip (Cards) only HIGHLIGHTS — never opens a popup.
    (wrapper.vm as unknown as {skipAnimation: () => void}).skipAnimation();
    const fakeEvt = {currentTarget: {getBoundingClientRect: () => ({left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0})}} as unknown as Event;
    vm.onChipHover('cards', 'red', fakeEvt);
    expect((wrapper.vm as unknown as {hoverGroup: string | null}).hoverGroup).to.eq('cards');
    expect(vm.inspector).to.eq(undefined); // row-backed top-level → no popup
  });

  it('does not reveal a future subchip value (ghost "?") before its reveal step', () => {
    const m = model([input('red', 'A', {terraformRating: 30, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    // At intro nothing is revealed → the TR sub-chips are ghosts ("?"), no values.
    const ghosts = wrapper.findAll('.fsr__subchip--ghost');
    expect(ghosts.length).to.be.greaterThan(0);
    expect(ghosts[0].text()).to.contain('?');
  });

  it('builds the Cards & effects (tr-cards) popup from the TR source entries', () => {
    const m = model([
      input('red', 'A', {
        terraformRating: 23,
        terraformRatingBreakdown: {
          base: 20, baseRating: 20, handicap: 0, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 3,
          cardEntries: [
            {sourceType: 'card', sourceName: 'Ganymede Colony', sourceCardId: 'Ganymede Colony', amount: 2},
            {sourceType: 'venusTrackBonus', sourceName: 'Venus track bonus', amount: 1},
          ],
        },
      }),
      input('blue', 'B', {terraformRating: 20}),
    ]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    const vm = wrapper.vm as unknown as {buildInspectorContent: (g: string, sub: string | null, c: string | null) => {cards: Array<{name: string; vp: number}>; sources: Array<{vp: number}>; total: number}};
    const c = vm.buildInspectorContent('tr', 'tr-cards', 'red');
    expect(c.total).to.eq(3);
    expect(c.cards.length).to.eq(1); // the card source (with preview)
    expect(c.cards[0].name).to.eq('Ganymede Colony');
    expect(c.sources.length).to.eq(1); // the Venus track bonus (no card)
    expect(c.sources[0].vp).to.eq(1);
  });

  it('a row-backed group highlights (no popup); a leaf group opens a scoped popup', async () => {
    const m = model([input('red', 'A', {terraformRating: 35, milestones: 5}), input('blue', 'B', {terraformRating: 22})]);
    const wrapper = mountReveal(m, ['red', 'blue']);
    (wrapper.vm as unknown as {skipAnimation: () => void}).skipAnimation();
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as unknown as {
      onPillHover: (g: string, e: Event) => void; hoverGroup: string | null; inspector: unknown; clearHover: () => void;
    };
    const fakeEvt = {currentTarget: {getBoundingClientRect: () => ({left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0})}} as unknown as Event;
    // TR is row-backed → highlight only, NO popup.
    vm.onPillHover('tr', fakeEvt);
    expect(vm.hoverGroup).to.eq('tr');
    expect(vm.inspector).to.eq(undefined);
    // Milestones is a leaf → opens a scoped popup.
    vm.onPillHover('milestones', fakeEvt);
    expect(vm.hoverGroup).to.eq('milestones');
    expect(vm.inspector).to.not.eq(undefined);
    vm.clearHover();
    expect(vm.hoverGroup).to.eq(null);
    expect(vm.inspector).to.eq(undefined);
  });
});
