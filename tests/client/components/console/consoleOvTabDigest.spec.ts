/*
 * ConsoleOvTabDigest — «ОБЗОР», the landing tab of the endgame overview. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its `vm` over the overview's module state (the result strip, the
 * finish verdict and the lead, the headline facts and the observation rail with ONE focus walking both) — and the
 * PANE API its parent reaches through `ref="pane"`: `ConsoleEndgameOverview.handleIntent` calls `nav(dir)` on a d-pad
 * step and `primary()` on A, so a parent's ref must carry exactly those two. The rich-sentence renderer is stubbed by
 * name (it is its own component's subject). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {ConsoleOverviewVm, OvDigest, OvFactCard, OvRankRow, OvSentence} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi, resetConsoleOverview} from '@/client/console/endgame/consoleOverviewState';
import ConsoleOvTabDigest from '@/client/components/console/ConsoleOvTabDigest.vue';

/** What the overview reads through its ref — the pane's whole contract with its parent. */
type Pane = {nav(dir: 'up' | 'down' | 'left' | 'right'): void, primary(): void};

const RichStub = defineComponent({
  name: 'ConsoleOvRich',
  props: {sentence: {type: Object as PropType<OvSentence>, required: true}},
  render() {
    return h('i', {'class': 'rich-stub', 'data-key': this.sentence.key});
  },
});

const global = {...globalConfig.global, stubs: {ConsoleOvRich: RichStub}};

const say = (key: string): OvSentence => ({key, params: []});

function rank(color: Color, name: string, place: number, total: number, over: Partial<OvRankRow> = {}): OvRankRow {
  return {color, name, corporation: '', face: undefined, place, total, gapToWinner: 0, megacredits: 0, isBot: false, isWinner: place === 1, ...over};
}

function fact(id: string, color: Color | undefined, over: Partial<OvFactCard> = {}): OvFactCard {
  return {id, role: 'decisive_driver', badge: 'Decisive', sentence: say('fact ' + id), color, chips: [], generation: undefined, phase: 'late', ...over};
}

/** Three seats (a corporation, a bot with a corporation and a difficulty, a corpless bot), a verdict, two facts, two observations. */
function digest(): OvDigest {
  return {
    verdict: {
      titleKey: 'A close finish', glyph: '≈', line: say('the verdict line'),
      chips: [{t: 'raw', v: '+5', label: 'VP', tone: 'good'}, {t: 'i18n', v: 'Generation'}],
    },
    lead: [say('lead one'), say('lead two')],
    headline: [
      fact('a', 'red', {generation: 5, chips: [{t: 'raw', v: '12', tone: 'metric'}]}),
      fact('b', undefined, {badge: 'Turning point'}),
    ],
    observations: [
      {id: 'o1', badge: 'Economy', sentence: say('observation one'), color: 'blue'},
      {id: 'o2', badge: 'Board', sentence: say('observation two'), color: undefined},
    ],
    ranking: [
      rank('red', 'Ada', 1, 50, {corporation: 'Credicor'}),
      rank('blue', 'Bot', 2, 44, {corporation: 'Helion', difficulty: 'Hard', gapToWinner: 6, isBot: true}),
      rank('green', 'Cy', 3, 20, {difficulty: 'Easy', gapToWinner: 30, isBot: true}),
    ],
  };
}

function overviewVm(d: OvDigest = digest()): ConsoleOverviewVm {
  return {
    generation: 9,
    winner: undefined,
    sharedWin: false,
    digest: d,
    score: {ranking: [], categories: [], maxCategoryValue: 0, decisive: undefined, tieBreak: undefined},
    timeline: {
      gens: 0, series: [], episodes: [], maxVp: 0,
      stats: {generations: 0, leadChanges: undefined, tookLeadGen: undefined, wireToWire: false, finalSurge: undefined},
    },
    cards: {rows: [], byPlayer: []},
    parameters: {parameters: [], gens: 0},
    players: {players: [], maxima: {}, comparable: {}, displayNames: {}},
  };
}

function tab(vm: ConsoleOverviewVm) {
  return mount(ConsoleOvTabDigest, {global, props: {vm}});
}

/** The tab the way the overview mounts it: under an Options host with the string ref `pane`. */
function underOverview(vm: ConsoleOverviewVm) {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleOvTabDigest, {ref: 'pane', vm})]),
  });
  const wrapper = mount(Host, {global});
  return {
    wrapper,
    /** Exactly the overview's read: `(this.$refs.pane ?? undefined) as Pane | undefined`. */
    pane: () => (wrapper.vm.$refs.pane ?? undefined) as Pane | undefined,
  };
}

describe('ConsoleOvTabDigest — the landing tab', () => {
  // The overview's state is a MODULE (it outlives the scene): every test starts from — and leaves — a fresh one.
  beforeEach(resetConsoleOverview);
  afterEach(resetConsoleOverview);

  it('the result strip: a row per place — the winner marked, the corporation with the bot\'s difficulty beside it (or the difficulty alone), the gap and the total; the entrance is LATCHED at mount', async () => {
    consoleOverviewUi.phase = 'entering';
    const w = tab(overviewVm());
    // The template starts with its root: the wrapper IS the tab.
    expect(w.classes()).to.include.members(['con-ovd', 'con-ovd--enter']);
    expect((w.find('.con-ovd__rank').element as HTMLElement).style.getPropertyValue('--ov-n'), 'a row per seat').to.eq('3');

    const rows = w.findAll('.con-ovd__rank > .con-ovd__rrow');
    expect(rows.map((r) => r.classes().includes('con-ovd__rrow--winner'))).to.deep.eq([true, false, false]);
    expect(rows.map((r) => (r.element as HTMLElement).style.getPropertyValue('--ov-i'))).to.deep.eq(['0', '1', '2']);
    expect(rows.map((r) => [r.find('.con-ovd__rplace').text(), r.find('.con-ovd__rname').text(), r.find('.con-ovd__rgap').text(), r.find('.con-ovd__rtotal').text()]))
      .to.deep.eq([['1', 'Ada', '', '50VP'], ['2', 'Bot', '−6', '44VP'], ['3', 'Cy', '−30', '20VP']]);
    expect(rows.map((r) => r.find('.con-ovd__rdot').classes().filter((k) => k.startsWith('player_bg_color_'))))
      .to.deep.eq([['player_bg_color_red'], ['player_bg_color_blue'], ['player_bg_color_green']]);
    // The corporation is the primary identity, the difficulty the secondary voice; a corpless bot: the difficulty alone.
    expect(rows.map((r) => r.find('.con-ovd__rcorp').text())).to.deep.eq(['Credicor', 'Helion · Hard', 'Easy']);
    expect(rows.map((r) => r.find('.con-ovd__rcorp').classes().includes('con-ovd__rdiff'))).to.deep.eq([false, false, true]);

    // A latch never cancels a running animation: the scene landing does not take the class back…
    consoleOverviewUi.phase = 'open';
    await nextTick();
    expect(w.classes()).to.include('con-ovd--enter');
    // …and a later tab-swap remount (the scene already open) lands settled.
    expect(tab(overviewVm()).classes()).to.not.include('con-ovd--enter');
  });

  it('the verdict and the lead, then the facts and the observation rail: each sentence handed to the rich renderer, the chips in their tone, a fact in its seat\'s colour', () => {
    const w = tab(overviewVm());
    const verdict = w.find('.con-ovd__story > .con-ovd__verdict');
    expect([verdict.find('.con-ovd__verdict-glyph').text(), verdict.find('.con-ovd__verdict-title').text()]).to.deep.eq(['≈', 'A close finish']);
    expect(verdict.find('.con-ovd__verdict-line > .rich-stub').attributes('data-key')).to.eq('the verdict line');
    // A chip: a raw value or a translated key, its unit after it; no tone is the neutral one.
    const chips = verdict.findAll('.con-ovd__chips > .con-ovd__chip');
    expect(chips.map((c) => c.text())).to.deep.eq(['+5 VP', 'Generation']);
    expect(chips.map((c) => c.classes().filter((k) => k.startsWith('con-ovd__chip--')))).to.deep.eq([['con-ovd__chip--good'], ['con-ovd__chip--neutral']]);
    expect(w.findAll('.con-ovd__lead > .rich-stub').map((s) => s.attributes('data-key'))).to.deep.eq(['lead one', 'lead two']);

    const facts = w.findAll('.con-ovd__facts > .con-ovd__fact');
    expect(facts.map((f) => f.find('.con-ovd__fact-badge').text())).to.deep.eq(['Decisive', 'Turning point']);
    expect(facts.map((f) => f.find('.con-ovd__fact-text > .rich-stub').attributes('data-key'))).to.deep.eq(['fact a', 'fact b']);
    expect(facts[0].find('.con-ovd__fact-gen').text()).to.eq('Generation 5');
    expect(facts[1].find('.con-ovd__fact-gen').exists(), 'no generation — no stamp').to.eq(false);
    expect(facts[0].findAll('.con-ovd__chip').map((c) => [c.text(), c.classes().includes('con-ovd__chip--metric')])).to.deep.eq([['12', true]]);
    expect(facts[1].find('.con-ovd__chips').exists(), 'no evidence — no chip row').to.eq(false);
    const vars = (el: Element) => [(el as HTMLElement).style.getPropertyValue('--ov-i'), (el as HTMLElement).style.getPropertyValue('--ov-pc')];
    expect(facts.map((f) => vars(f.element))).to.deep.eq([['0', endgamePlayerHex('red')], ['1', '']]);

    const obs = w.findAll('.con-ovd__obs > .con-ovd__obs-row');
    expect(obs.map((o) => [o.find('.con-ovd__obs-badge').text(), o.find('.con-ovd__obs-text > .rich-stub').attributes('data-key')]))
      .to.deep.eq([['Economy', 'observation one'], ['Board', 'observation two']]);
    expect(obs.map((o) => (o.element as HTMLElement).style.getPropertyValue('--ov-pc'))).to.deep.eq([endgamePlayerHex('blue'), '']);

    // A digest with no verdict, no lead and nothing to list draws the strip and an empty story zone — no dead blocks.
    const bare = tab(overviewVm({...digest(), verdict: undefined, lead: [], headline: [], observations: []}));
    expect(['.con-ovd__verdict', '.con-ovd__lead', '.con-ovd__facts-obs'].filter((sel) => bare.find(sel).exists())).to.deep.eq([]);
    expect(bare.find('.con-ovd__story').exists()).to.eq(true);
  });

  it('the overview\'s ref sees the pane API — `nav` and `primary` — and nothing else', () => {
    const {pane} = underOverview(overviewVm());
    expect(pane(), 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(pane()!).sort(), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['nav', 'primary']);
    const leaked = ['vm', 'enterFx', 'ui', 'focusCount', 'hex', 'isFocused', 'factStyle', 'chipText']
      .filter((key) => (pane() as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('`nav` walks ONE focus over the facts and then the observations — clamped at both ends, never a ring; `primary` opens nothing (the digest is a reading surface)', async () => {
    const {wrapper, pane} = underOverview(overviewVm());
    const focused = () => [
      ...wrapper.findAll('.con-ovd__fact').map((f) => f.classes().includes('con-ovd__fact--focused')),
      ...wrapper.findAll('.con-ovd__obs-row').map((o) => o.classes().includes('con-ovd__obs-row--focused')),
    ];
    expect(focused()).to.deep.eq([true, false, false, false]);

    pane()!.nav('up');
    pane()!.nav('left');
    expect(consoleOverviewUi.digestFocus, 'clamped at the first fact').to.eq(0);
    pane()!.nav('down');
    pane()!.nav('right');
    expect(consoleOverviewUi.digestFocus).to.eq(2);
    await nextTick();
    expect(focused(), 'past the facts the same focus stands on the observation rail').to.deep.eq([false, false, true, false]);
    pane()!.nav('down');
    pane()!.nav('down');
    expect(consoleOverviewUi.digestFocus, 'clamped at the last observation').to.eq(3);

    pane()!.primary();
    expect([consoleOverviewUi.digestFocus, consoleOverviewUi.detail, consoleOverviewUi.tab]).to.deep.eq([3, undefined, 'digest']);

    // Nothing to focus: the d-pad moves nothing and no row reads as focused.
    resetConsoleOverview();
    const empty = underOverview(overviewVm({...digest(), headline: [], observations: []}));
    empty.pane()!.nav('down');
    expect(consoleOverviewUi.digestFocus).to.eq(0);
  });
});
