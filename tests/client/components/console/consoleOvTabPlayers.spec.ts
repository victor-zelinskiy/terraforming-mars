/*
 * ConsoleOvTabPlayers — «ИГРОКИ», a tab of the endgame overview. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its `vm` over the overview's module state (the player ring, the
 * participant's hero and ITS OWN metric groups — a bar only where there is a real comparison, the bot's honest
 * groups — and the cross-player grid of the nested detail) — and the PANE API its parent reaches through
 * `ref="pane"`: `ConsoleEndgameOverview.handleIntent` calls `nav(dir)` on a d-pad step and `primary()` on A, so a
 * parent's ref must carry exactly those two. The faces, the disc and the VP shield are stubbed by name (each is its
 * own component's subject). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {DOMWrapper, mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {ConsoleOverviewVm, OvMetric, OvPlayerCard, PlayerMetricGroup} from '@/client/console/endgame/consoleOverviewModel';
import {consoleOverviewUi, resetConsoleOverview} from '@/client/console/endgame/consoleOverviewState';
import {DossierGlyph, scoreCategoryGlyph} from '@/client/console/infoDossierModel';
import {maArtPath} from '@/client/console/maArt';
import {getPreferences} from '@/client/utils/PreferencesManager';
import ConsoleOvTabPlayers from '@/client/components/console/ConsoleOvTabPlayers.vue';

/** What the overview reads through its ref — the pane's whole contract with its parent. */
type Pane = {nav(dir: 'up' | 'down' | 'left' | 'right'): void, primary(): void};

const DiscStub = defineComponent({
  name: 'ConsoleScoreDisc',
  props: {glyph: {type: Object as PropType<DossierGlyph>, required: true}},
  render() {
    return h('i', {class: 'disc-stub'});
  },
});
const BadgeStub = defineComponent({
  name: 'ConsoleVpBadge',
  props: {label: {type: String, required: true}},
  render() {
    return h('i', {'class': 'badge-stub', 'data-label': this.label});
  },
});
const CardFaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: String},
  render() {
    return h('i', {'class': 'card-face-stub', 'data-name': this.name});
  },
});
const BotFaceStub = defineComponent({
  name: 'MarsBotCorpFace',
  props: {id: String, resources: Number},
  render() {
    return h('i', {'class': 'bot-face-stub', 'data-id': this.id, 'data-resources': String(this.resources)});
  },
});

const global = {
  ...globalConfig.global,
  stubs: {ConsoleScoreDisc: DiscStub, ConsoleVpBadge: BadgeStub, ConsoleCardFaceLite: CardFaceStub, MarsBotCorpFace: BotFaceStub},
};

const group = (key: string, label: string, comparable: boolean): PlayerMetricGroup => ({key, label, comparable});
const metric = (key: string, label: string, value: number): OvMetric => ({key, label, value});

/** A human wears the economy groups; two humans make them comparable. */
const HUMAN_GROUPS = [
  group('production', 'Production', true), group('stock', 'Resources at the end', true), group('stats', 'Match statistics', true),
  group('tags', 'Tags', false), group('ma', 'Milestones & awards', false), group('categories', 'Score sources', false),
];
/** The bot wears its OWN honest groups — no production, no stock. */
const BOT_GROUPS = [
  group('boteco', 'Bot economy', false), group('stats', 'Match statistics', true), group('bottracks', 'Bot tracks', false),
  group('ma', 'Milestones & awards', false), group('categories', 'Score sources', false),
];

function seat(color: Color, name: string, place: number, total: number, over: Partial<OvPlayerCard>): OvPlayerCard {
  return {
    color, name, corporation: '', face: undefined, maMedals: [], place, total, isBot: false, isWinner: place === 1,
    production: [], stock: [], stats: [], tags: [], milestones: [], awards: [], categories: [], groups: HUMAN_GROUPS, ...over,
  };
}

/** Ada (the winner, a corporation card), Cy (a human with no face on the save) and the bot (its difficulty alone). */
function overviewVm(): ConsoleOverviewVm {
  return {
    generation: 9,
    winner: undefined,
    sharedWin: false,
    digest: {verdict: undefined, lead: [], headline: [], observations: [], ranking: []},
    score: {ranking: [], categories: [], maxCategoryValue: 1, decisive: undefined, tieBreak: undefined},
    timeline: {
      gens: 0, series: [], episodes: [], maxVp: 0,
      stats: {generations: 0, leadChanges: undefined, tookLeadGen: undefined, wireToWire: false, finalSurge: undefined},
    },
    cards: {rows: [], byPlayer: []},
    parameters: {parameters: [], gens: 0},
    players: {
      players: [
        seat('red', 'Ada', 1, 80, {
          corporation: 'Credicor',
          face: {kind: 'card', name: CardName.CREDICOR},
          production: [metric('prod:megacredits', 'M€ production', 12), metric('prod:steel', 'Steel production', 2)],
          stock: [metric('stock:plants', 'Plants', 6)],
          stats: [metric('cardsPlayed', 'Cards played', 30)],
          tags: [{tag: Tag.BUILDING, count: 7}, {tag: Tag.SPACE, count: 3}],
          maMedals: [{kind: 'milestone', name: 'Terraformer', slug: 'terraformer', vp: 5}],
          categories: [
            {key: 'tr', label: 'Terraform rating', accent: 'tr', value: 40},
            {key: 'cards', label: 'Cards', accent: 'cards', value: -2},
          ],
        }),
        seat('green', 'Cy', 2, 60, {
          production: [metric('prod:megacredits', 'M€ production', 6)],
          stock: [metric('stock:plants', 'Plants', 8)],
          stats: [metric('cardsPlayed', 'Cards played', 15)],
        }),
        seat('blue', 'Bot', 3, 50, {
          isBot: true,
          difficulty: 'Hard',
          face: {kind: 'bot', id: MarsBotCorpId.C01_CREDICOR},
          stats: [metric('cardsPlayed', 'Cards played', 20)],
          botEconomy: {stock: 14, rate: 5, vp: 2, playedCount: 20},
          botTracks: [{tag: Tag.BUILDING, position: 3, max: 6}],
          groups: BOT_GROUPS,
        }),
      ],
      maxima: {'prod:megacredits': 12, 'prod:steel': 2, 'stock:plants': 8, 'cardsPlayed': 30},
      // Steel production is carried by ONE participant: a value, never a bar against nobody.
      comparable: {'prod:megacredits': 2, 'prod:steel': 1, 'stock:plants': 2, 'cardsPlayed': 3},
      displayNames: {},
    },
  };
}

function tab(vm: ConsoleOverviewVm) {
  return mount(ConsoleOvTabPlayers, {global, props: {vm}});
}

/** The tab the way the overview mounts it: under an Options host with the string ref `pane`. */
function underOverview(vm: ConsoleOverviewVm) {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleOvTabPlayers, {ref: 'pane', vm})]),
  });
  const wrapper = mount(Host, {global});
  return {
    wrapper,
    /** Exactly the overview's read of its pane. */
    pane: () => (wrapper.vm.$refs.pane ?? undefined) as Pane | undefined,
  };
}

const widthOf = (fill: DOMWrapper<Element>): number => Math.round(parseFloat((fill.element as HTMLElement).style.width));

describe('ConsoleOvTabPlayers — how the strategies differed', () => {
  // The overview's state is a MODULE (it outlives the scene): every test starts from — and leaves — a fresh one.
  beforeEach(resetConsoleOverview);
  afterEach(resetConsoleOverview);

  it('the player ring and the participant\'s hero: the corporation\'s face, the place, the identity line, the total', () => {
    const w = tab(overviewVm());
    // The template starts with its root: the wrapper IS the tab.
    expect(w.classes()).to.include('con-ovpl');
    const chips = w.findAll('.con-ovpl__ring > .con-ovpl__chip');
    expect(chips.map((c) => [c.find('.con-ovpl__chip-name').text(), c.find('.con-ovpl__chip-vp').text()])).to.deep.eq([['Ada', '80'], ['Cy', '60'], ['Bot', '50']]);
    expect(chips.map((c) => c.classes().includes('con-ovpl__chip--on'))).to.deep.eq([true, false, false]);
    expect(chips.map((c) => c.classes().includes('con-ovpl__chip--winner'))).to.deep.eq([true, false, false]);

    expect((w.find('.con-ovpl__sheet').element as HTMLElement).style.getPropertyValue('--ov-pc'), 'the sheet wears the participant\'s colour').to.eq(endgamePlayerHex('red'));
    const hero = w.find('.con-ovpl__hero');
    expect(hero.attributes('data-ovpl-hero')).to.eq('red');
    expect(hero.classes()).to.include('con-ovpl__hero--winner');
    expect(hero.find('.con-ovpl__crown').text()).to.eq('Winner');
    expect(hero.find('.con-ovpl__face-zoom > .card-face-stub').attributes('data-name')).to.eq(CardName.CREDICOR);
    expect([hero.find('.con-ovpl__place').text(), hero.find('.con-ovpl__name').text(), hero.find('.con-ovpl__corp').text(), hero.find('.con-ovpl__total-vp').text()])
      .to.deep.eq(['1', 'Ada', 'Credicor', '80']);
    expect(hero.find('.badge-stub').attributes('data-label'), 'the shield is handed the translated «VP»').to.eq('VP');
  });

  it('the participant\'s OWN groups: a bar only where two carry the metric, an icon for a resource, tags, medallions and the score sources', () => {
    const w = tab(overviewVm());
    const groups = w.findAll('.con-ovpl__groups > .con-ovpl__group');
    expect(groups.map((g) => g.find('.con-ovpl__ghead').text()))
      .to.deep.eq(['Production', 'Resources at the end', 'Match statistics', 'Tags', 'Milestones & awards', 'Score sources']);
    expect(groups.map((g) => g.classes().includes('con-ovpl__group--focused'))).to.deep.eq([true, false, false, false, false, false]);

    // Production: M€ is compared (two carry it) — steel is Ada's alone, a plain value.
    const production = groups[0].findAll('.con-ovpl__metric');
    expect(production.map((m) => m.find('.con-ovpl__micon').classes().find((c) => c.startsWith('resource_icon--'))))
      .to.deep.eq(['resource_icon--megacredits', 'resource_icon--steel']);
    expect(production.map((m) => [m.classes().includes('con-ovpl__metric--labeled'), m.classes().includes('con-ovpl__metric--solo')]))
      .to.deep.eq([[false, false], [false, true]]);
    expect(production.map((m) => m.find('.con-ovpl__mtrack').exists()), 'a bar exists only behind a real comparison').to.deep.eq([true, false]);
    expect(production.map((m) => m.find('.con-ovpl__mval').text())).to.deep.eq(['12', '2']);
    expect(widthOf(production[0].find('.con-ovpl__mfill'))).to.eq(100);
    expect(widthOf(groups[1].find('.con-ovpl__mfill')), '6 plants against the table\'s 8').to.eq(75);
    // A statistic has no resource icon: its label stands in words.
    const stat = groups[2].find('.con-ovpl__metric');
    expect(stat.classes()).to.include('con-ovpl__metric--labeled');
    expect([stat.find('.con-ovpl__mlabel-only').text(), stat.find('.con-ovpl__mval').text()]).to.deep.eq(['Cards played', '30']);

    expect(groups[3].findAll('.con-ovpl__tag').map((t) => [t.find('.con-ovpl__tag-icon').classes().find((c) => c.startsWith('tag-') && c !== 'tag-count'), t.find('b').text()]))
      .to.deep.eq([['tag-building', '7'], ['tag-space', '3']]);
    const medal = groups[4].find('.con-ovpl__medal');
    expect([medal.attributes('data-ovpl-ma'), medal.find('.con-ovpl__medal-name').text(), medal.find('.con-ovpl__medal-vp').text()]).to.deep.eq(['milestone', 'Terraformer', '+5']);
    expect(medal.classes()).to.include('con-ovpl__medal--milestone');
    expect(medal.find('.con-ovpl__medal-art').attributes('src')).to.eq(maArtPath('terraformer', getPreferences().lang));
    const cats = groups[5].findAll('.con-ovpl__cat');
    expect(cats.map((c) => [c.find('.con-ovpl__cat-val').text(), c.find('.con-ovpl__cat-name').text()]), 'the value and the ceremony\'s SHORT name')
      .to.deep.eq([['40', 'TR'], ['−2', 'Cards']]);
    expect(cats.map((c) => c.classes().find((name) => name.startsWith('con-eg-cat--')))).to.deep.eq(['con-eg-cat--tr', 'con-eg-cat--cards']);
    expect(w.findAllComponents(DiscStub).map((d) => d.props('glyph'))).to.deep.eq([scoreCategoryGlyph('tr'), scoreCategoryGlyph('cards')]);
  });

  it('follows the module\'s ring: a human with nothing to show says so, and the bot wears its own honest groups', async () => {
    const w = tab(overviewVm());
    const heads = () => w.findAll('.con-ovpl__ghead').map((head) => head.text());

    consoleOverviewUi.playerIdx = 1;
    await nextTick();
    expect(w.findAll('.con-ovpl__chip').map((c) => c.classes().includes('con-ovpl__chip--on'))).to.deep.eq([false, true, false]);
    const cy = w.find('.con-ovpl__hero');
    expect(cy.find('.con-ovpl__crown').exists()).to.eq(false);
    expect(cy.find('.con-ovpl__face-zoom').exists(), 'no face on the save — the seat\'s colour').to.eq(false);
    expect(cy.find('.con-ovpl__face-empty').classes()).to.include('player_bg_color_green');
    expect(cy.find('.con-ovpl__corp').exists(), 'no corporation, no difficulty — no identity line').to.eq(false);
    expect(w.findAll('.con-ovpl__quiet').map((q) => q.text())).to.deep.eq(['No tags played', 'No milestones or awards']);

    consoleOverviewUi.playerIdx = 2;
    consoleOverviewUi.playerGroup = 2;
    await nextTick();
    const bot = w.find('.con-ovpl__hero');
    expect(bot.find('.bot-face-stub').attributes('data-id')).to.eq(MarsBotCorpId.C01_CREDICOR);
    expect(bot.find('.con-ovpl__corp').classes(), 'a corpless bot: the difficulty IS the identity line').to.include('con-ovpl__diff');
    expect(bot.find('.con-ovpl__corp').text()).to.eq('Hard');
    expect(heads()).to.deep.eq(['Bot economy', 'Match statistics', 'Bot tracks', 'Milestones & awards', 'Score sources']);
    const groups = w.findAll('.con-ovpl__group');
    expect(groups.map((g) => g.classes().includes('con-ovpl__group--focused'))).to.deep.eq([false, false, true, false, false]);
    expect(groups[0].findAll('.con-ovpl__metric').map((m) => [m.find('.con-ovpl__mlabel-only').text(), m.find('.con-ovpl__mval').text()])).to.deep.eq([
      ['M€ left at scoring', '14'], ['Conversion rate', '5 M€ → 1 VP'], ['M€ converted to VP', '2 VP'], ['Cards in the played pile', '20'],
    ]);
    expect(groups[2].find('.con-ovpl__tag-icon').classes()).to.include('tag-building');
    expect(groups[2].find('.con-ovpl__track-pos').text()).to.eq('3/6');
  });

  it('the nested detail opens from the module\'s `detail`: the group across every participant that CARRIES it, on one scale', async () => {
    const w = tab(overviewVm());
    expect(w.find('.con-egov-detail').exists()).to.eq(false);

    consoleOverviewUi.detail = {kind: 'players-metric', group: 'production'};
    await nextTick();
    expect([w.find('.con-egov-detail__title').text(), w.find('.con-egov-detail__sub').text()]).to.deep.eq(['Production', 'All players']);
    const grid = w.find('.con-ovpl__cmp');
    expect((grid.element as HTMLElement).style.getPropertyValue('--ov-cols'), 'the bot keeps no production — two columns').to.eq('2');
    expect(grid.findAll('.con-ovpl__cmp-name').map((n) => n.text())).to.deep.eq(['Ada', 'Cy']);
    expect(grid.findAll('.con-ovpl__cmp-cell--label .con-ovpl__micon').map((i) => i.classes().find((c) => c.startsWith('resource_icon--'))))
      .to.deep.eq(['resource_icon--megacredits', 'resource_icon--steel']);
    const cells = grid.findAll('.con-ovpl__cmp-cell').filter((c) => c.find('.con-ovpl__mtrack--cmp').exists());
    expect(cells.map((c) => c.find('.con-ovpl__mval').text()), 'a participant without the metric reads 0').to.deep.eq(['12', '6', '2', '0']);
    expect(cells.map((c) => widthOf(c.find('.con-ovpl__mfill')))).to.deep.eq([100, 50, 100, 0]);

    // A statistic is labelled in words, and the bot carries it too.
    consoleOverviewUi.detail = {kind: 'players-metric', group: 'stats'};
    await nextTick();
    expect(w.findAll('.con-ovpl__cmp-name').map((n) => n.text())).to.deep.eq(['Ada', 'Cy', 'Bot']);
    expect(w.find('.con-ovpl__cmp-cell--label').text()).to.eq('Cards played');

    // Another tab's detail is not this tab's.
    consoleOverviewUi.detail = {kind: 'generation', gen: 2};
    await nextTick();
    expect(w.find('.con-egov-detail').exists()).to.eq(false);
  });

  it('the overview\'s ref sees the pane API — `nav` and `primary` — and nothing else', () => {
    const {pane} = underOverview(overviewVm());
    expect(pane(), 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(pane()!).sort(), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['nav', 'primary']);
    const leaked = ['vm', 'ui', 'playerIdx', 'player', 'groups', 'groupIdx', 'detailGroup', 'hex', 'maArt', 'resIcon', 'metricsOf', 'cmpValue', 'legendOf']
      .filter((key) => (pane() as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
  });

  it('`nav` walks the players on ←/→ (a ring, the group kept inside the new list) and the groups on ↑/↓ (a ring); `primary` opens a COMPARABLE group — under which both rest', async () => {
    const {wrapper, pane} = underOverview(overviewVm());
    pane()!.nav('up');
    expect(consoleOverviewUi.playerGroup, '↑ from the first group wraps to the last').to.eq(5);
    pane()!.primary();
    expect(consoleOverviewUi.detail, 'the score sources are one participant\'s — nothing to compare').to.eq(undefined);

    pane()!.nav('right');
    expect([consoleOverviewUi.playerIdx, consoleOverviewUi.playerGroup]).to.deep.eq([1, 5]);
    pane()!.nav('right');
    expect([consoleOverviewUi.playerIdx, consoleOverviewUi.playerGroup], 'the bot carries five groups — the focus stays inside its list').to.deep.eq([2, 4]);
    pane()!.nav('right');
    expect(consoleOverviewUi.playerIdx, '→ past the last participant wraps to the first').to.eq(0);
    pane()!.nav('left');
    expect(consoleOverviewUi.playerIdx, '← from the first wraps to the last').to.eq(2);

    pane()!.nav('down');
    expect(consoleOverviewUi.playerGroup, '↓ from the last group wraps to the first').to.eq(0);
    pane()!.nav('down');
    pane()!.primary();
    expect(consoleOverviewUi.detail).to.deep.eq({kind: 'players-metric', group: 'stats'});
    await nextTick();
    expect(wrapper.find('.con-egov-detail__title').text()).to.eq('Match statistics');
    expect(wrapper.findAll('.con-ovpl__cmp-cell .con-ovpl__mval').map((v) => v.text())).to.deep.eq(['30', '15', '20']);

    // The detail is a static read: the d-pad moves nothing under it, A opens nothing over it.
    pane()!.nav('left');
    pane()!.nav('down');
    expect([consoleOverviewUi.playerIdx, consoleOverviewUi.playerGroup]).to.deep.eq([2, 1]);
    consoleOverviewUi.playerGroup = 0;
    pane()!.primary();
    expect(consoleOverviewUi.detail, 'the open detail stays the one that was opened').to.deep.eq({kind: 'players-metric', group: 'stats'});
  });
});
