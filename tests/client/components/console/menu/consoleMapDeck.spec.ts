/*
 * ConsoleMapDeck — the creator's «Карта» deck: a GRID of map tiles solved from the measured stage (strict pages when
 * they do not fit), the cursored map's detail line under it — or its dossier beside it on the wide creator. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): pure presentation — the rows, the cursor and
 * the shaking row arrive as props; a press / a pointer move goes UP as `activate` / `hover` with the row's index, the
 * solved plan as `layout`. It exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {BoardName} from '@/common/boards/BoardName';
import {MapRow} from '@/client/console/menu/consoleCreateModel';
import {mapGridPlan} from '@/client/console/menu/lobbyCardModel';
import {automaBlockerText, createGameState, GameMode} from '@/client/components/create/premium/createGameState';
import {PremiumMapMeta} from '@/client/components/create/premium/createGameMeta';
import ConsoleMapDeck from '@/client/components/console/menu/ConsoleMapDeck.vue';

// The fingerprint is its own subject; this spec reads what the deck asks it to draw.
// (A render function, not a template string: the runtime compiler is not in this build.)
const FingerprintStub = defineComponent({
  name: 'PremiumMapFingerprint',
  props: {mapId: String, random: Boolean, accent: String, variant: String},
  render: () => h('i', {class: 'fingerprint-stub'}),
});

/** jsdom has no ResizeObserver: the deck's own is stood in for, so a spec can say «the stage was resized». */
type Observed = {fire: () => void, targets: Array<Element>, disconnected: boolean};
const observers: Array<Observed> = [];
class FakeResizeObserver {
  private readonly record: Observed;
  constructor(callback: () => void) {
    this.record = {fire: callback, targets: [], disconnected: false};
    observers.push(this.record);
  }
  observe(el: Element): void {
    this.record.targets.push(el);
  }
  unobserve(): void {}
  disconnect(): void {
    this.record.disconnected = true;
  }
}

const meta = (id: string, over: Partial<PremiumMapMeta> = {}): PremiumMapMeta => ({
  id: id as BoardName, random: false, labelKey: `name of ${id}`, descKey: `about ${id}`, accent: '1,2,3', ...over,
});
const row = (of: PremiumMapMeta, selected = false, conflict = false): MapRow => ({meta: of, selected, conflict});

/** Six maps: the random pick (selected), three official boards (one marked fan-made), and a board MarsBot has no adaptation for. */
const ROWS: ReadonlyArray<MapRow> = [
  row(meta('random-all', {random: true}), true),
  row(meta(BoardName.THARSIS)),
  row(meta(BoardName.HELLAS, {fan: true})),
  row(meta('a board the bot cannot play')),
  row(meta(BoardName.ELYSIUM)),
  row(meta(BoardName.UTOPIA_PLANITIA)),
];

/** The deck's own tile proportions at a rem of `r` px, and the spine's row it keeps out of the height. */
const tileOpts = (r: number) => ({gap: 1 * r, minW: 9.5 * r, maxW: 17 * r, aspect: 0.62, chromeH: 6 * r});
const remNow = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const solved = (width: number, height: number, count: number) => mapGridPlan(width, Math.max(0, height - 2.2 * remNow()), count, tileOpts(remNow()));

function deck(props: {rows: ReadonlyArray<MapRow>, cursor: number, shakeRow?: number, wide?: boolean}) {
  return mount(ConsoleMapDeck, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {PremiumMapFingerprint: FingerprintStub}},
  });
}

/** Give the stage the box jsdom never lays out, and say it was resized — the deck re-solves its grid from it. */
async function resizeStage(wrapper: ReturnType<typeof deck>, width: number, height: number): Promise<void> {
  const stage = wrapper.find('.cm-maps__stage').element;
  Object.defineProperty(stage, 'clientWidth', {configurable: true, value: width});
  Object.defineProperty(stage, 'clientHeight', {configurable: true, value: height});
  observers.forEach((observer) => observer.fire());
  await nextTick();
}

describe('ConsoleMapDeck — the creator\'s maps as a showcase grid', () => {
  const globals = globalThis as unknown as {ResizeObserver?: unknown};
  const hadObserver = 'ResizeObserver' in globals;
  const realObserver = globals.ResizeObserver;
  /** What the bot's seat read before a test set it — given back after it. */
  let was: {gameMode: GameMode, seatMarsBot: boolean} | undefined;

  beforeEach(() => {
    observers.length = 0;
    globals.ResizeObserver = FakeResizeObserver;
    // Module state is bundle-shared: the bot's seat is this spec's to set, and to give back. The config is read HERE,
    // for every test, never once for the file — `resetCreateGameState()` (a spec that ran earlier) REPLACES the
    // object, and a reference taken at describe time would be a dead one the deck no longer reads.
    const config = createGameState.config;
    was = {gameMode: config.gameMode, seatMarsBot: config.seatMarsBot};
    config.gameMode = 'multiplayer';
    config.seatMarsBot = false;
  });

  afterEach(() => {
    if (hadObserver) {
      globals.ResizeObserver = realObserver;
    } else {
      delete globals.ResizeObserver;
    }
    if (was !== undefined) {
      const config = createGameState.config;
      config.gameMode = was.gameMode;
      config.seatMarsBot = was.seatMarsBot;
      was = undefined;
    }
  });

  it('publishes its plan UP at once, re-solves it from the MEASURED stage on a resize, and lets its observer go when it leaves', async () => {
    const w = deck({rows: ROWS, cursor: 0});
    const unmeasured = solved(0, 0, ROWS.length);
    expect(w.emitted('layout'), 'the cursor\'s walk has its columns before the first frame').to.deep.eq([[{cols: unmeasured.cols, perPage: unmeasured.perPage}]]);
    expect(observers, 'one observer, on the grid\'s stage').to.have.length(1);
    expect(observers[0].targets).to.deep.eq([w.find('.cm-maps__stage').element]);
    expect((w.find('.cm-maps__grid').element as HTMLElement).getAttribute('style') ?? '', 'no tokens before a measure').to.eq('');

    await resizeStage(w, 1100, 600);
    const plan = solved(1100, 600, ROWS.length);
    expect([plan.cols, plan.rows, plan.pages], 'the probe box holds the six maps on one page of 4 × 2').to.deep.eq([4, 2, 1]);
    expect(w.emitted('layout')).to.deep.eq([[{cols: unmeasured.cols, perPage: unmeasured.perPage}], [{cols: 4, perPage: 8}]]);
    expect(w.attributes('data-map-showcase')).to.eq('');
    expect([w.attributes('data-map-cols'), w.attributes('data-map-rows'), w.attributes('data-map-pages')]).to.deep.eq(['4', '2', '1']);
    const style = (w.find('.cm-maps__grid').element as HTMLElement).style;
    expect(style.getPropertyValue('--cm-map-tile-w'), 'the tile’s width reaches the sheet as a token').to.eq(`${plan.tileW}px`);
    expect(w.findAll('button.cm-map'), 'the whole page of tiles').to.have.length(6);
    expect(w.find('[data-map-spine]').exists(), 'one page — no spine').to.eq(false);

    w.unmount();
    expect(observers[0].disconnected).to.eq(true);
  });

  it('a TILE: the board\'s fingerprint, its name, its state in chips; the cursor and the shake by index; a press and a pointer go up with the index', async () => {
    const w = deck({rows: ROWS, cursor: 2, shakeRow: 1});
    await resizeStage(w, 1100, 600);
    const tiles = w.findAll('.cm-maps__grid > button.cm-map');
    expect(tiles.map((tile) => tile.attributes('data-map-tile'))).to.deep.eq(ROWS.map((r) => r.meta.id));
    expect(tiles.map((tile) => tile.attributes('data-map-index'))).to.deep.eq(['0', '1', '2', '3', '4', '5']);
    expect(tiles.map((tile) => tile.find('.cm-map__name').text())).to.deep.eq(ROWS.map((r) => $t(r.meta.labelKey)));
    expect(tiles.map((tile) => tile.classes().includes('cm-map--cursor'))).to.deep.eq([false, false, true, false, false, false]);
    expect(tiles.map((tile) => tile.classes().includes('cm-row--shake'))).to.deep.eq([false, true, false, false, false, false]);
    expect(tiles.map((tile) => tile.classes().includes('cm-map--selected'))).to.deep.eq([true, false, false, false, false, false]);
    expect(tiles.map((tile) => tile.find('[data-map-current]').exists())).to.deep.eq([true, false, false, false, false, false]);
    expect(tiles[0].find('[data-map-current]').text()).to.eq($t('Current map'));
    expect(tiles.map((tile) => tile.find('[data-map-fan]').exists())).to.deep.eq([false, false, true, false, false, false]);
    expect(tiles[2].find('[data-map-fan]').text()).to.eq($t('Fan map'));
    expect(tiles.map((tile) => tile.find('[data-map-bot]').exists()), 'no MarsBot mark while the bot is not seated').to.deep.eq([false, false, false, false, false, false]);
    expect(tiles.map((tile) => tile.classes().includes('cm-map--botless'))).to.deep.eq([false, false, false, false, false, false]);

    const prints = w.findAllComponents(FingerprintStub);
    expect(prints, 'one fingerprint per tile').to.have.length(6);
    expect(prints.map((print) => print.props('variant'))).to.deep.eq(['card', 'card', 'card', 'card', 'card', 'card']);
    expect(prints.map((print) => print.props('random'))).to.deep.eq([true, false, false, false, false, false]);
    expect(prints.map((print) => print.props('mapId')), 'the random pick draws no single board').to.deep.eq([undefined, ...ROWS.slice(1).map((r) => r.meta.id)]);
    expect(prints[1].props('accent')).to.eq('1,2,3');

    await tiles[4].trigger('click');
    await tiles[5].trigger('mousemove');
    expect(w.emitted('activate')).to.deep.eq([[4]]);
    expect(w.emitted('hover')).to.deep.eq([[5]]);
  });

  it('the cursored map is read in ONE detail line under the grid — and in a DOSSIER beside it on the wide creator', async () => {
    const w = deck({rows: ROWS, cursor: 1});
    expect(w.classes()).to.include.members(['cm-deckbody', 'cm-maps', 'cm-maps--grid']);
    expect(w.classes()).to.not.include('cm-maps--wide');
    expect(w.find('.cm-maps__dossier').exists()).to.eq(false);
    expect(w.find('.cm-maps__detail-name').text()).to.eq($t(ROWS[1].meta.labelKey));
    expect(w.find('.cm-maps__detail-desc').text()).to.eq($t(ROWS[1].meta.descKey));
    expect(w.find('[data-map-blocker]').exists()).to.eq(false);

    await w.setProps({wide: true, cursor: 0});
    expect(w.classes()).to.include('cm-maps--wide');
    expect(w.find('.cm-maps__detail').exists(), 'the dossier replaces the line').to.eq(false);
    const dossier = w.find('aside.cm-maps__dossier');
    expect(dossier.attributes('data-map-dossier-id')).to.eq('random-all');
    expect(dossier.find('.cm-maps__dossier-name').text()).to.eq($t(ROWS[0].meta.labelKey));
    expect(dossier.find('.cm-maps__dossier-desc').text()).to.eq($t(ROWS[0].meta.descKey));
    expect(dossier.find('.cm-map__chip--current').exists(), 'the selected map says so in its dossier too').to.eq(true);
    // The dossier follows the grid, so its hero fingerprint is the last one the deck draws.
    const prints = w.findAllComponents(FingerprintStub);
    const hero = prints[prints.length - 1];
    expect([hero.props('variant'), hero.props('random'), hero.props('mapId')]).to.deep.eq(['hero', true, undefined]);

    await w.setProps({cursor: 99});
    expect(w.find('.cm-maps__dossier').exists(), 'a cursor on no map has no dossier').to.eq(false);
    expect(w.find('.cm-maps__detail').text(), '…and an empty line in its place').to.eq('');
  });

  it('with MarsBot SEATED every board wears its mark before the pick, and one it cannot play recedes with the reason in words', async () => {
    createGameState.config.gameMode = 'marsbot';
    const rows = [...ROWS.slice(0, 5), row(ROWS[5].meta, false, true)];
    const w = deck({rows, cursor: 3});
    await resizeStage(w, 1100, 600);
    const tiles = w.findAll('button.cm-map');
    expect(tiles.map((tile) => tile.find('[data-map-bot]').exists() ? tile.find('[data-map-bot]').attributes('data-map-bot') : 'none'),
      'the random pick wears no mark — the pool narrows instead').to.deep.eq(['none', 'yes', 'yes', 'no', 'yes', 'yes']);
    expect(tiles[1].find('[data-map-bot]').text()).to.eq(`${$t('MarsBot')} ✓`);
    expect(tiles[3].find('[data-map-bot]').text()).to.eq(`${$t('MarsBot')} —`);
    expect(tiles[3].find('[data-map-bot]').classes()).to.include('cm-map__chip--botno');
    expect(tiles.map((tile) => tile.classes().includes('cm-map--botless')), 'no adaptation, or the model\'s own conflict').to.deep.eq([false, false, false, true, false, true]);
    expect(tiles.map((tile) => tile.classes().includes('cm-map--conflict'))).to.deep.eq([false, false, false, false, false, true]);

    expect(w.find('.cm-maps__detail > [data-map-blocker]').text(), 'the blocker takes the detail line').to.eq($t(automaBlockerText('board')));
    expect(w.find('.cm-maps__detail-name').exists()).to.eq(false);

    await w.setProps({cursor: 0});
    expect(w.find('.cm-maps__detail-desc').text(), 'the random pick says which pool it rolls from').to.eq($t('One of the maps adapted for MarsBot will be chosen at game start.'));

    await w.setProps({wide: true, cursor: 3});
    const dossier = w.find('aside.cm-maps__dossier');
    expect(dossier.find('[data-map-blocker]').text()).to.eq($t(automaBlockerText('board')));
    expect(dossier.find('.cm-map__chip--bot').classes()).to.include('cm-map__chip--botno');
  });

  it('a stage too short for every row PAGES: the page is the cursor\'s, the spine says which', async () => {
    const w = deck({rows: ROWS, cursor: 0});
    await resizeStage(w, 1100, 330);
    const plan = solved(1100, 330, ROWS.length);
    expect([plan.cols, plan.rows, plan.pages], 'the probe box holds one row of four — two pages').to.deep.eq([4, 1, 2]);
    expect(w.findAll('button.cm-map').map((tile) => tile.attributes('data-map-index'))).to.deep.eq(['0', '1', '2', '3']);
    expect(w.find('[data-map-spine]').text()).to.eq('1 / 2');
    expect(w.attributes('data-map-pages')).to.eq('2');

    await w.setProps({cursor: 5});
    expect(w.findAll('button.cm-map').map((tile) => tile.attributes('data-map-index')), 'the cursor crossed the page edge').to.deep.eq(['4', '5']);
    expect(w.findAll('button.cm-map').map((tile) => tile.classes().includes('cm-map--cursor'))).to.deep.eq([false, true]);
    expect(w.find('[data-map-spine]').text()).to.eq('2 / 2');
  });
});
