/*
 * ConsoleScoreExplorer — THE SCORE EXPLORER (the vp subtree of the Information workspace: overview → a category →
 * a card family's table, the three as LAYERS of one surface). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). `ConsoleInfoMode` stands a ref on it and forwards the pad through that ref — so it is
 * mounted here the way the workspace mounts it, under a host that holds a ref, and the spec reads what that ref
 * carries: `handleIntent` (every intent while a vp route is up) and `consumeScoreBack` (B asks the explorer first).
 *
 * A surface of this size is covered by its e2e (`console-info-*`, `console-score-*`), and what its levels COUNT by
 * `scoreExplorerModel.spec.ts`. Under test here is the surface's own life: it mounts on an honest base-game view
 * without a warning (`globalConfig` turns every Vue warning into a throw), it publishes its command contract on
 * `scoreExplorerUi` and takes it back, a hidden score is the sealed cell and a resting pad, the levels park instead of
 * unmounting, the laurel's inspection is folded by ONE B and dropped by a seat switch, and a list that shrinks under
 * the cursor clamps it.
 *
 * Reduced motion is ON for the whole suite: every level change then takes its instant branch — the descend phrase
 * itself (GSAP, measured rects) is the e2e's subject, and no timeline or safety timer outlives a test.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleScoreExplorer from '@/client/components/console/ConsoleScoreExplorer.vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {infoModeState} from '@/client/console/infoModeState';
import {resetScoreExplorer, scoreExplorerUi} from '@/client/console/consoleScoreExplorer';
import {buildLiveScoreModel} from '@/client/console/liveScoreModel';
import {buildScoreOverview} from '@/client/console/scoreExplorerModel';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';

/** What the workspace's ref of the explorer carries. */
type ExplorerReach = {handleIntent(intent: GamepadIntent): void, consumeScoreBack(): boolean};

const BASE: VictoryPointsBreakdown = {
  terraformRating: 20,
  terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
  milestones: 0,
  awards: 0,
  greenery: 0,
  city: 0,
  escapeVelocity: 0,
  moonHabitats: 0,
  moonMines: 0,
  moonRoads: 0,
  planetaryTracks: 0,
  deltaProject: 0,
  victoryPoints: 0,
  total: 20,
  detailsCards: [],
  detailsMilestones: [],
  detailsAwards: [],
  detailsPlanetaryTracks: [],
  negativeVP: 0,
};

/** The viewer: rating 23 (two temperature steps, one oxygen), TWO claimed milestones, a greenery, two city points. */
const MINE: VictoryPointsBreakdown = {
  ...BASE,
  terraformRating: 23,
  terraformRatingBreakdown: {base: 20, temperature: 2, oxygen: 1, oceans: 0, venus: 0, cards: 0},
  milestones: 10,
  detailsMilestones: [
    {message: 'Claimed ${0} milestone', messageArgs: ['Terraformer'], victoryPoint: 5},
    {message: 'Claimed ${0} milestone', messageArgs: ['Mayor'], victoryPoint: 5},
  ],
  greenery: 1,
  city: 2,
  total: 36,
};

/** The rival: the starting rating and ONE claimed milestone. */
const THEIRS: VictoryPointsBreakdown = {
  ...BASE,
  milestones: 5,
  detailsMilestones: [{message: 'Claimed ${0} milestone', messageArgs: ['Gardener'], victoryPoint: 5}],
  total: 25,
};

function seat(color: string, name: string, breakdown: VictoryPointsBreakdown): PublicPlayerModel {
  return {
    color, name,
    tableau: [],
    victoryPointsBreakdown: breakdown,
    terraformRating: breakdown.terraformRating,
    megacredits: 30,
  } as unknown as PublicPlayerModel;
}
const ME = seat('blue', 'Ada', MINE);
const RIVAL = seat('red', 'Bruno', THEIRS);

/** A base game: no bot, no parliament, no hydronetwork, no campaign. */
function view(showOtherPlayersVP: boolean): PlayerViewModel {
  return {
    players: [ME, RIVAL],
    thisPlayer: ME,
    game: {
      moon: undefined,
      pathfinders: undefined,
      parliament: undefined,
      colonies: [],
      milestones: [
        {name: 'Terraformer', playerName: 'Ada', color: 'blue', threshold: 35, scores: [{color: 'blue', score: 35}, {color: 'red', score: 20}]},
        {name: 'Mayor', playerName: 'Ada', color: 'blue', threshold: 3, scores: [{color: 'blue', score: 3}, {color: 'red', score: 0}]},
        {name: 'Gardener', playerName: 'Bruno', color: 'red', threshold: 3, scores: [{color: 'blue', score: 1}, {color: 'red', score: 3}]},
      ],
      awards: [],
      gameOptions: {expansions: {}, showOtherPlayersVP, campaign: undefined},
    },
  } as unknown as PlayerViewModel;
}

/** The viewer's overview by the REAL builders — the spec reads the order and the numbers off them, never a guess. */
const OVERVIEW = buildScoreOverview(
  buildLiveScoreModel(MINE, {isBot: false, hasMoon: false, hasPathfinders: false, hasDelta: false, hasTitles: false, hasParliament: false}),
  MINE,
  {isBot: false});
const KEYS = OVERVIEW.tiles.map((tile) => tile.key);

function mountUnderHost(showOtherPlayersVP = false) {
  const playerView = view(showOtherPlayersVP);
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleScoreExplorer, {ref: 'scoreView', playerView})]),
  });
  const wrapper = mount(Host, {...globalConfig});
  return {
    wrapper,
    /** The workspace's read: what the ref it stands on the explorer carries. */
    reach: (): ExplorerReach => {
      const explorer = (wrapper.vm.$refs.scoreView ?? undefined) as ExplorerReach | undefined;
      if (explorer === undefined) {
        throw new Error('the host holds no ref to the score explorer');
      }
      return explorer;
    },
  };
}

/** The published bar, by its labels (English i18n keys). */
const bar = (): Array<string> => (scoreExplorerUi.barCommands ?? []).map((command) => command.label);

const press = (button: 'confirm' | 'secondary'): GamepadIntent => ({kind: 'press', button});
const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

describe('ConsoleScoreExplorer — the score explorer', () => {
  let saved: {
    playerColor: typeof infoModeState.playerColor,
    route: typeof infoModeState.route,
    vpCategoryKey: typeof infoModeState.vpCategoryKey,
    vpCardsGroup: typeof infoModeState.vpCardsGroup,
    reduced: boolean,
  };
  // `CSS.escape` is the browser's (jsdom carries it on its window; the node global has none): the explorer escapes a
  // tile's / a laurel's key with it on every descent, so the suite lends the page's for its own length.
  let lentCss = false;

  before(() => {
    const scope = globalThis as {CSS?: unknown};
    if (scope.CSS === undefined) {
      scope.CSS = (window as unknown as {CSS: unknown}).CSS;
      lentCss = true;
    }
  });
  after(() => {
    if (lentCss) {
      delete (globalThis as {CSS?: unknown}).CSS;
    }
  });

  beforeEach(() => {
    saved = {
      playerColor: infoModeState.playerColor,
      route: infoModeState.route,
      vpCategoryKey: infoModeState.vpCategoryKey,
      vpCardsGroup: infoModeState.vpCardsGroup,
      reduced: reduceMotionOverrideState.enabled,
    };
    reduceMotionOverrideState.enabled = true;
    infoModeState.playerColor = 'blue';
    infoModeState.route = 'vp';
    infoModeState.vpCategoryKey = undefined;
    infoModeState.vpCardsGroup = undefined;
    resetScoreExplorer();
  });

  afterEach(() => {
    infoModeState.playerColor = saved.playerColor;
    infoModeState.route = saved.route;
    infoModeState.vpCategoryKey = saved.vpCategoryKey;
    infoModeState.vpCardsGroup = saved.vpCardsGroup;
    reduceMotionOverrideState.enabled = saved.reduced;
    resetScoreExplorer();
  });

  it('the overview: the hero total, a tile per category with the cursor on the first, the bar published — and taken back on unmount', () => {
    const {wrapper} = mountUnderHost();
    const root = wrapper.find('.con-vpx');
    expect(root.classes(), 'level 1').to.not.contain('con-vpx--deep');
    expect(root.find('[data-vpx-total] .con-vpx__total').text()).to.eq(String(OVERVIEW.total));

    const tiles = root.findAll('[data-vpx-tile]');
    expect(tiles.map((tile) => tile.attributes('data-vpx-tile')), 'the ceremony\'s order').to.deep.eq(KEYS);
    expect(tiles.map((tile) => tile.find('.con-vpx__tile-value').text())).to.deep.eq(OVERVIEW.tiles.map((tile) => String(tile.value)));
    expect(tiles.map((tile) => tile.classes().includes('con-vpx__tile--zero')), 'a zero category stays in the list').to.deep.eq(OVERVIEW.tiles.map((tile) => tile.zero));
    expect(tiles.map((tile) => tile.classes().includes('con-vpx__tile--focused')), 'the cursor').to.deep.eq(KEYS.map((_key, i) => i === 0));

    // The bar draws only what scored; the share line speaks for the tile under the cursor.
    const scored = OVERVIEW.tiles.filter((tile) => tile.value > 0);
    expect(root.findAll('[data-vpx-bar] .con-vpx__seg').length).to.eq(scored.length);
    const first = OVERVIEW.tiles[0];
    expect(root.find('.con-vpx__shareline').text()).to.eq(`${first.value} / ${OVERVIEW.total} · ${Math.round(first.sharePct)}%`);

    expect(root.find('.con-vpx__overview').attributes('style') ?? '', 'the overview is on stage').to.not.contain('display: none');
    expect(root.find('.con-vpx__cat').exists(), 'no category layer yet').to.eq(false);
    expect(root.find('.con-vpx__table').exists(), 'no table layer yet').to.eq(false);
    expect(root.find('.con-vpx__inspect').exists()).to.eq(false);
    expect(root.find('[data-vpx-sealed]').exists(), 'the viewer\'s own score is never sealed').to.eq(false);

    expect(bar()).to.deep.eq(['Players', 'Open', 'To overview', 'Close']);
    wrapper.unmount();
    expect(scoreExplorerUi.barCommands, 'the bar is the workspace\'s again').to.eq(undefined);
  });

  it('a hidden score is the SEALED cell — no total, no tile, and the pad rests', async () => {
    infoModeState.playerColor = 'red';
    const {wrapper, reach} = mountUnderHost(false);
    const root = wrapper.find('.con-vpx');
    expect(root.find('[data-vpx-sealed]').exists()).to.eq(true);
    expect(root.find('.con-vpx__hero').exists(), 'not one number of the score').to.eq(false);
    expect(root.find('[data-vpx-tile]').exists()).to.eq(false);
    expect(bar(), 'nothing to open').to.deep.eq(['Players', 'To overview', 'Close']);

    reach().handleIntent(nav('right'));
    reach().handleIntent(press('confirm'));
    await nextTick();
    expect(scoreExplorerUi.gridFocus, 'the cursor did not move').to.eq(0);
    expect(infoModeState.route, 'nothing was opened').to.eq('vp');
    expect(reach().consumeScoreBack(), 'B is the workspace\'s own').to.eq(false);
  });

  it('a parent\'s ref sees `consumeScoreBack` and `handleIntent` — and nothing else', () => {
    const {reach} = mountUnderHost();
    expect(Object.keys(reach()), 'exactly what the explorer exposes').to.deep.eq(['consumeScoreBack', 'handleIntent']);
    expect(reach().consumeScoreBack).to.be.a('function');
    expect(reach().handleIntent).to.be.a('function');
    // Neither the prop nor the explorer's own state is reachable through the ref.
    const leaked = ['playerView', 'ui', 'route', 'overview', 'barState', 'dropInspect', 'onRouteChange', 'observePreview']
      .filter((name) => (reach() as unknown as Record<string, unknown>)[name] !== undefined);
    expect(leaked).to.deep.eq([]);
    expect(reach().consumeScoreBack(), 'no inspection stands — the workspace\'s own back runs').to.eq(false);
  });

  it('through the ref: the d-pad walks the grid, A descends into the tile under the cursor — the overview PARKS, and leaving the subtree tidies the params', async () => {
    const {wrapper, reach} = mountUnderHost();
    const root = wrapper.find('.con-vpx');
    const at = KEYS.indexOf('milestones');
    expect(at, 'the base game scores milestones').to.be.greaterThan(0);

    for (let step = 0; step < at; step++) {
      reach().handleIntent(nav('right'));
    }
    await nextTick();
    expect(scoreExplorerUi.gridFocus).to.eq(at);
    expect(root.find('.con-vpx__tile--focused').attributes('data-vpx-tile')).to.eq('milestones');
    const tile = OVERVIEW.tiles[at];
    expect(root.find('.con-vpx__shareline').text(), 'the share line follows the cursor').to.eq(`${tile.value} / ${OVERVIEW.total} · ${Math.round(tile.sharePct)}%`);

    reach().handleIntent(press('confirm'));
    await nextTick();
    expect(infoModeState.route).to.eq('vpCategory');
    expect(infoModeState.vpCategoryKey).to.eq('milestones');
    expect(root.classes(), 'level 2').to.contain('con-vpx--deep');
    expect(root.find('.con-vpx__cat .con-vpx__cathead-value').text()).to.eq(String(tile.value));
    expect(root.find('.con-vpx__overview').exists(), 'the overview is parked, never unmounted').to.eq(true);
    expect(root.find('.con-vpx__overview').attributes('style') ?? '').to.contain('display: none');
    expect(root.findAll('[data-vpx-ma]').length, 'one entry per claimed laurel').to.eq(MINE.detailsMilestones.length);
    expect(root.find('.con-vpx__maent--focused').attributes('data-vpx-ma')).to.contain('Terraformer');
    expect(bar()).to.deep.eq(['Players', 'Inspect', 'Back', 'Close']);

    // The workspace's B writes the route back; the explorer brings its overview on stage with the cursor where it stood.
    infoModeState.route = 'vp';
    await nextTick();
    expect(infoModeState.vpCategoryKey, 'the param goes with its level').to.eq(undefined);
    expect(root.find('.con-vpx__cat').exists()).to.eq(false);
    expect(root.find('.con-vpx__overview').attributes('style') ?? '').to.not.contain('display: none');
    expect(root.find('.con-vpx__tile--focused').attributes('data-vpx-tile')).to.eq('milestones');

    // A shortcut out of the subtree from depth: both params are tidied.
    infoModeState.vpCategoryKey = 'cards';
    infoModeState.vpCardsGroup = 'cards-fixed';
    infoModeState.route = 'vpCards';
    await nextTick();
    infoModeState.route = 'summary';
    await nextTick();
    expect(infoModeState.vpCategoryKey).to.eq(undefined);
    expect(infoModeState.vpCardsGroup).to.eq(undefined);
  });

  it('X on a laurel opens its inspection, the pad rests under it, ONE B folds it — and a seat switch drops it at once', async () => {
    infoModeState.vpCategoryKey = 'milestones';
    infoModeState.route = 'vpCategory';
    const {wrapper, reach} = mountUnderHost();
    const root = wrapper.find('.con-vpx');

    reach().handleIntent(nav('down'));
    await nextTick();
    expect(scoreExplorerUi.catFocus).to.eq(1);
    expect(root.find('.con-vpx__maent--focused').attributes('data-vpx-ma')).to.contain('Mayor');

    reach().handleIntent(press('secondary'));
    await nextTick();
    expect(scoreExplorerUi.inspect?.name).to.eq('Mayor');
    expect(root.find('.con-vpx__inspect').exists(), 'the inspection layer stands').to.eq(true);
    expect(root.find('.con-vpx__inspect-fact').text(), 'the server\'s own threshold and score').to.contain('3');
    expect(root.find('.con-vpx__cat').exists(), 'the category stays under it').to.eq(true);
    expect(bar(), 'one read, one way back').to.deep.eq(['Players', 'Back', 'Close']);

    reach().handleIntent(nav('up'));
    await nextTick();
    expect(scoreExplorerUi.catFocus, 'the inspection is a read — the pad rests until B').to.eq(1);

    expect(reach().consumeScoreBack(), 'the explorer took the B').to.eq(true);
    expect(scoreExplorerUi.inspect).to.eq(undefined);
    await nextTick();
    expect(root.find('.con-vpx__inspect').exists()).to.eq(false);
    expect(reach().consumeScoreBack(), 'the next B is the workspace\'s').to.eq(false);

    reach().handleIntent(press('secondary'));
    await nextTick();
    expect(scoreExplorerUi.inspect?.name).to.eq('Mayor');
    infoModeState.playerColor = 'red';
    await nextTick();
    expect(scoreExplorerUi.inspect, 'the laurel may not exist for the arriving seat').to.eq(undefined);
    expect(root.find('.con-vpx__inspect').exists()).to.eq(false);
  });

  it('a seat switch that SHRINKS the list under the cursor clamps it — the depth is kept', async () => {
    infoModeState.vpCategoryKey = 'milestones';
    infoModeState.route = 'vpCategory';
    scoreExplorerUi.catFocus = 1;
    const {wrapper} = mountUnderHost(true);
    const root = wrapper.find('.con-vpx');
    expect(root.find('.con-vpx__maent--focused').attributes('data-vpx-ma')).to.contain('Mayor');

    infoModeState.playerColor = 'red';
    await nextTick();
    expect(infoModeState.route, 'the seat switch keeps the depth').to.eq('vpCategory');
    expect(root.find('[data-vpx-sealed]').exists(), 'this table shows every score').to.eq(false);
    expect(root.findAll('[data-vpx-ma]').length).to.eq(THEIRS.detailsMilestones.length);
    expect(scoreExplorerUi.catFocus, 'the cursor follows the shorter list').to.eq(0);
    await nextTick();
    expect(root.find('.con-vpx__maent--focused').attributes('data-vpx-ma')).to.contain('Gardener');
    expect(root.find('.con-vpx__cathead-value').text()).to.eq(String(THEIRS.milestones));
  });
});
