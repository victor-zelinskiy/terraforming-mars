import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, cinematicBeat, press, settle, soloGameConfig} from './consoleStart';
import {armLeakWitness, parliamentWire, strandedReports} from './parliamentDrive';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';

/**
 * THE TURMOIL REDUX VENUS on the console (docs/claude/turmoil-redux-colonies.md § Venus).
 *
 * The ADDITION tile pays a COMPOSITE trade income — «terraform Venus 1 step,
 * AND the bonus under the marker» — and its build bonus is «add 2 delegates
 * to a resolution», answered in the Mars Parliament. Two journeys:
 *
 *  1. THE READING. The grid tile draws the fixed Venus step BESIDE the
 *     marker's bonus; the dossier (X) states the fixed line above the
 *     per-position bonus and its seven cells read levy · nothing · floater ×3
 *     · delegates ×2; the tile starts ACTIVE at the empty 2nd position, which
 *     is a ZERO income — no refusal anywhere (the two refusals are unit-guarded
 *     in `tests/colonies/VenusRedux.spec.ts`, and the client speaks them through
 *     the same `colonyTradeBlocks` path the Pluto journey pins).
 *
 *  2. THE STEP. Build Colony (the standard project) → Venus → confirm: the
 *     server's «Add 2 delegates to a resolution» prompt opens the Parliament's
 *     VOTE MODE as an EMBEDDED step of the flow the player is standing in —
 *     one instance, teleported into the host's zone, no head of its own, the
 *     host's crumb gaining «ГОЛОСОВАНИЕ» as its tail — never a second
 *     standalone Parliament band. A then sends BOTH delegates, the step pops
 *     on their landing, and the server holds two of the seat's cubes on the
 *     chosen card.
 * Evidence → screenshots/venus-redux/.
 */

const OUT = path.resolve('screenshots', 'venus-redux');
const VENUS = 'Venus Redux';

function config() {
  return soloGameConfig({
    expansions: {colonies: true, turmoilRedux: true, venus: true},
    // Solo deals FOUR — exactly this list; the Redux Venus is an ADDITION (no base twin).
    customColoniesList: [VENUS, 'Luna', 'Europa', 'Callisto'],
  });
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type ServerView = {
  game: {
    colonies: Array<{name: string, trackPosition: number, isActive: boolean}>,
    parliament?: {slots: Array<{instance: string, party: string, votes: Array<{owner: string}>}>},
  },
  thisPlayer: {color: string, megacredits: number, colonyTradeBlocks?: Array<{colony: string, reason: string}>},
  waitingFor?: {type: string, title?: unknown, votePrompt?: {source: string, count?: number}},
};

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: config()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return model.players[0].id;
}

const serverView = async (request: APIRequestContext, playerId: string): Promise<ServerView> =>
  await (await request.get(`/api/player?id=${playerId}`)).json() as ServerView;

async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
}

async function focusTile(page: Page, target: string): Promise<void> {
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}


test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

test('Venus Redux — the reading: the tile and the dossier state the COMPOSITE income; the empty 2nd position is a zero, never a refusal', async ({page, request}) => {
  test.setTimeout(420_000);
  const playerId = await createGame(request);
  const view = await serverView(request, playerId);
  console.log('── colonies ──', JSON.stringify(view.game.colonies));
  console.log('── colonyTradeBlocks ──', JSON.stringify(view.thisPlayer.colonyTradeBlocks));
  const names = view.game.colonies.map((c) => c.name);
  expect(names, 'the Redux addition is seated').toContain(VENUS);
  expect(names, 'the retired community tile is gone').not.toContain('Venus');
  const venus = view.game.colonies.find((c) => c.name === VENUS);
  expect(venus?.isActive, '«Venus starts active»').toBe(true);
  expect(venus?.trackPosition, 'the marker starts on the empty 2nd position').toBe(1);
  expect((view.thisPlayer.colonyTradeBlocks ?? []).map((b) => b.colony), 'a zero income is never a refusal').not.toContain(VENUS);

  await bootSeededGame(page, request, playerId, {buy: 2, keepColony: VENUS});
  await settle(page);
  await openColonies(page);
  await focusTile(page, VENUS);
  await cinematicBeat(page, 600, 'the grid settles on the focused tile');
  await shoot(page, '00-grid');

  const tile = await page.evaluate((venusName) => {
    const el = document.querySelector(`.con-coltile--focused[data-test="con-colony-${venusName}"]`);
    const fixed = el?.querySelector('[data-colony-trade-fixed] .benefit-glyph');
    const marker = el?.querySelector('.con-coltile__cell-reward .benefit-glyph');
    return {
      status: (el?.querySelector('.con-coltile__status')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      statusClass: el?.querySelector('.con-coltile__status')?.className ?? '',
      fixedType: fixed?.getAttribute('data-bg-type') ?? '',
      fixedIcon: fixed?.querySelector('.benefit-glyph__tile')?.className ?? '',
      fixedOneLine: ((): boolean => {
        const plus = el?.querySelector('.con-coltile__cell-plus');
        const reward = el?.querySelector('.con-coltile__cell-reward');
        if (fixed === undefined || fixed === null || plus === null || plus === undefined || reward === null || reward === undefined) {
          return false;
        }
        const a = fixed.getBoundingClientRect(); const b = plus.getBoundingClientRect(); const c = reward.getBoundingClientRect();
        const mid = (r: DOMRect) => r.top + r.height / 2;
        return a.width > 0 && c.width > 0 && Math.abs(mid(a) - mid(b)) < 6 && Math.abs(mid(a) - mid(c)) < 6;
      })(),
      markerType: marker?.getAttribute('data-bg-type') ?? '',
      markerVoid: marker?.querySelector('.benefit-glyph__void') !== null,
      planetClass: el?.querySelector('.con-planet')?.className ?? '',
      // The cell's own arithmetic (diagnostic — the label yields by an ellipsis in its own box, the value never).
      widths: ((): Record<string, number> => {
        const w = (sel: string): number => Math.round(el?.querySelector(sel)?.getBoundingClientRect().width ?? -1);
        return {
          cell: w('.con-coltile__cell--trade'), label: w('.con-coltile__cell-label'), value: w('.con-coltile__cell-value'),
          fixed: w('[data-colony-trade-fixed]'), glyph: w('[data-colony-trade-fixed] .benefit-glyph'), plus: w('.con-coltile__cell-plus'),
          reward: w('.con-coltile__cell-reward'), rewardGlyph: w('.con-coltile__cell-reward .benefit-glyph'),
          labelScroll: Math.round((el?.querySelector('.con-coltile__cell-label') as HTMLElement | null)?.scrollWidth ?? -1),
        };
      })(),
    };
  }, VENUS);
  console.log('── tile ──', JSON.stringify(tile));
  expect(tile.statusClass, 'no refusal on the tile').not.toContain('con-coltile__status--blocked');
  expect(tile.fixedType, 'the tile draws the FIXED Venus step beside the marker\'s bonus').toBe(String(ColonyBenefit.INCREASE_VENUS_SCALE));
  expect(tile.fixedIcon, 'the fixed glyph is the Venus tile').toContain('venus');
  expect(tile.fixedOneLine, '«[Venus] + [bonus]» stands on ONE line (the fixed part must never wrap under the label)').toBe(true);
  expect(tile.markerType, 'the marker stands on the printed-empty 2nd position (a LOSE_RESOURCES of zero)').toBe(String(ColonyBenefit.LOSE_RESOURCES));
  expect(tile.markerVoid, 'an empty position is drawn as a void, never as «−0»').toBe(true);
  expect(tile.planetClass, 'the tile wears the Venus art').toContain('Venus-Redux-background');

  // ── X → the dossier: the fixed line ABOVE the per-position bonus, seven honest cells, the lore. ──
  await page.keyboard.press('KeyX');
  await cinematicBeat(page, 2300, 'the dossier entrance + the late reveal wave');
  await shoot(page, '01-dossier');
  const dossier = await page.evaluate(() => {
    const t = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {
      crumb: t(document.querySelector('.con-colonies .con-wshead')),
      fixed: t(document.querySelector('[data-colinspect-fixed]')),
      fixedGlyph: document.querySelector('[data-colinspect-fixed] .benefit-glyph')?.getAttribute('data-bg-type') ?? '',
      verdict: t(document.querySelector('.con-colinspect__act .con-colinspect__verdict')),
      verdictClass: document.querySelector('.con-colinspect__act .con-colinspect__verdict')?.className ?? '',
      gains: Array.from(document.querySelectorAll('.con-colinspect__gain')).map(t),
      rules: Array.from(document.querySelectorAll('.con-colinspect__rules .con-colinspect__text')).map(t),
      lore: t(document.querySelector('.con-colinspect .card-zoom-lore__text')),
      // The marker's part of each cell (the fixed Venus step stands above it on its own line — see `fixedCells`).
      cells: Array.from(document.querySelectorAll('.con-colinspect .con-colfocus__xcell .con-colfocus__xcell-glyph .benefit-glyph')).map((g) => g.getAttribute('data-bg-type')),
      fixedCells: Array.from(document.querySelectorAll('.con-colinspect .con-colfocus__xcell [data-colony-track-fixed] .benefit-glyph')).map((g) => g.getAttribute('data-bg-type')),
      levyCell: (document.querySelector('.con-colinspect .con-colfocus__xcell-qty--levy')?.textContent ?? '').trim(),
    };
  });
  console.log('── dossier ──', JSON.stringify(dossier, null, 2));
  expect(dossier.crumb).toMatch(/КОЛОНИИ.*ВЕНЕРА.*ОСМОТР/i);
  expect(dossier.fixed, 'the dossier states the fixed Venus step in the TRADE INCOME group').toMatch(/Венер/);
  expect(dossier.fixedGlyph).toBe(String(ColonyBenefit.INCREASE_VENUS_SCALE));
  expect(dossier.verdictClass, 'a zero income is not a refusal').not.toContain('con-colinspect__verdict--no');
  const L = String(ColonyBenefit.LOSE_RESOURCES);
  const F = String(ColonyBenefit.ADD_RESOURCES_TO_CARD);
  const D = String(ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION);
  expect(dossier.cells, 'the track: levy · nothing · floater ×3 · delegates ×2').toEqual([L, L, F, F, F, D, D]);
  // THE COMPOSITE INCOME IS ON EVERY CELL: the fixed Venus step stands above the marker's part, separated, on all seven.
  expect(dossier.fixedCells, 'every cell carries the fixed Venus step').toEqual(Array(7).fill(String(ColonyBenefit.INCREASE_VENUS_SCALE)));
  expect(dossier.levyCell, 'the 1st position is a LOSS and reads as one').toBe('−4');
  expect(dossier.rules.join(' | '), 'the three printed rules name the delegates and the Venus step').toMatch(/делегат/i);
  expect(dossier.rules.join(' | ')).toMatch(/Венер/);
  expect(dossier.lore.length, 'the tile prints its own archive entry').toBeGreaterThan(20);
  expect(dossier.gains.join(' | '), '«ВЫ ПОЛУЧИТЕ» carries the Venus step').toMatch(/Венер|\+1/);

  // ── B → back; A → the trade stage stands with no refusal. ──
  await press(page, 'Escape', 1600);
  expect(await page.locator('.con-colinspect').count(), 'B folded the dossier').toBe(0);
  await press(page, 'Enter', 2200);
  await shoot(page, '02-stage');
  const stage = await page.evaluate(() => ({
    up: document.querySelector('.con-colfocus') !== null,
    verdictClass: document.querySelector('.con-colfocus__verdict')?.className ?? '',
    verdict: (document.querySelector('.con-colfocus__verdict')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
  console.log('── stage ──', JSON.stringify(stage));
  expect(stage.up, 'A entered the trade stage').toBe(true);
  expect(stage.verdictClass, 'the stage carries no refusal at the empty position').not.toContain('--no');
  await press(page, 'Escape', 1200);
});

type StepProbe = {
  /** A STANDALONE Parliament band (`.con-parl.con-ws`) ever stood — the «modal that arrived». */
  standalone: boolean;
  /** How many `.con-parl` roots stood at once, at most (one instance, teleported — never a copy). */
  parlMax: number;
  /** The embedded root's first host zone (`data-embed-slot` of the nearest slot ancestor). */
  firstZone: string;
  /** Whether the embedded surface ever drew a head of its own. */
  ownHead: boolean;
  /** The workspace crumbs seen while the step stood (deduped, in order). */
  crumbs: Array<string>;
  /** A mandatory plate rose for the grant (it is a STEP of the flow, never an announce). */
  plate: boolean;
  samples: number;
  /** Every visible `.con-parl__flight` proxy seen: its first and last rect (left, top, width) and how many samples saw it. */
  flights: Record<string, {first: Array<number>, last: Array<number>, n: number}>;
};

async function armStepProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__venusStep: StepProbe};
    const p: StepProbe = {standalone: false, parlMax: 0, firstZone: '', ownHead: false, crumbs: [], plate: false, samples: 0, flights: {}};
    w.__venusStep = p;
    const sample = () => {
      p.samples++;
      const parls = document.querySelectorAll('.con-parl');
      p.parlMax = Math.max(p.parlMax, parls.length);
      if (document.querySelector('.con-parl.con-ws') !== null) {
        p.standalone = true;
      }
      const embedded = document.querySelector('.con-parl--embedded');
      if (embedded !== null) {
        if (p.firstZone === '') {
          p.firstZone = embedded.closest('[data-embed-slot]')?.getAttribute('data-embed-slot') ?? '(none)';
        }
        if (embedded.querySelector('.con-wshead') !== null) {
          p.ownHead = true;
        }
        const crumb = Array.from(document.querySelectorAll('.con-wshead')).map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' || ');
        if (crumb !== '' && p.crumbs[p.crumbs.length - 1] !== crumb && p.crumbs.length < 40) {
          p.crumbs.push(crumb);
        }
      }
      if (document.querySelector('.con-mandatory') !== null && embedded !== null) {
        p.plate = true;
      }
      document.querySelectorAll<HTMLElement>('.con-parl__flight').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || getComputedStyle(el).visibility === 'hidden') {
          return;
        }
        const id = el.getAttribute('data-parl-flight') ?? '?';
        const now = [Math.round(r.left), Math.round(r.top), Math.round(r.width)];
        const rec = p.flights[id] ?? (p.flights[id] = {first: now, last: now, n: 0});
        rec.last = now;
        rec.n++;
      });
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-stage']});
    window.setInterval(sample, 50);
  });
}

const readStepProbe = (page: Page): Promise<StepProbe> => page.evaluate(() => (window as unknown as {__venusStep: StepProbe}).__venusStep);

test('Venus Redux — the step: the build\'s «2 delegates to a resolution» opens the vote INSIDE the flow, one crumb, and the cubes land', async ({page, request}) => {
  test.setTimeout(420_000);
  const playerId = await createGame(request);
  await bootSeededGame(page, request, playerId, {buy: 2, keepColony: VENUS});
  await settle(page);
  await armLeakWitness(page);
  const before = await serverView(request, playerId);
  expect(before.thisPlayer.megacredits, 'the seat can afford the 17 M€ standard project').toBeGreaterThanOrEqual(17);
  const me = before.thisPlayer.color;

  // The Build Colony standard project → the colony pick → the build stage.
  await press(page, 'Comma', 1200);
  await press(page, 'Enter', 1400);
  expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  expect(/колони/i.test(await focusedName()), 'could not focus the colony standard project').toBeTruthy();
  await press(page, 'Enter', 1800);
  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await focusTile(page, VENUS);
  await press(page, 'Enter', 2000); // descend — the build intent
  expect(await page.locator('.con-colfocus').count(), 'the build stage did not open').toBeGreaterThan(0);
  const crumbBefore = await page.evaluate(() => Array.from(document.querySelectorAll('.con-wshead')).map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim()));
  console.log('── crumb before the commit ──', JSON.stringify(crumbBefore));
  await shoot(page, '10-build-stage');

  await armStepProbe(page);
  await page.keyboard.press('Enter'); // A = build confirm
  // THE DOOR: the server answers with the grant prompt, the shell pushes the
  // Parliament as a hosted step and the section mounts straight into its vote pose.
  await page.waitForSelector('.con-parl--embedded', {timeout: 40_000});
  await cinematicBeat(page, 1800, 'the vote pose settles (fresh entrance, the seats row, the ledger)');
  await shoot(page, '11-vote-step');

  const step = await page.evaluate(() => {
    const t = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const parl = document.querySelector('.con-parl');
    return {
      parls: document.querySelectorAll('.con-parl').length,
      embedded: parl?.classList.contains('con-parl--embedded') ?? false,
      standalone: parl?.classList.contains('con-ws') ?? false,
      zone: parl?.closest('[data-embed-slot]')?.getAttribute('data-embed-slot') ?? '(none)',
      hostStep: document.querySelector('[data-colonies-parliament-step]') !== null,
      stage: parl?.getAttribute('data-stage') ?? '',
      ownHead: parl?.querySelector('.con-wshead') !== null,
      crumbs: Array.from(document.querySelectorAll('.con-wshead')).map(t),
      count: document.querySelector('[data-parl-vote-count]')?.getAttribute('data-parl-vote-count') ?? '',
      source: t(document.querySelector('[data-parl-vote-count]')),
      grantRow: document.querySelector('[data-parl-vote-grant]') !== null,
      cta: t(document.querySelector('.con-parl__cta')),
      ctaClass: document.querySelector('.con-parl__cta')?.className ?? '',
      bar: t(document.querySelector('.con-cmdbar')),
      plate: document.querySelector('.con-mandatory') !== null,
      colfocus: document.querySelector('.con-colfocus') !== null,
    };
  });
  console.log('── the embedded vote step ──', JSON.stringify(step, null, 2));
  const wire = await parliamentWire(request, playerId);
  console.log('── server waitingFor ──', JSON.stringify(wire.waitingFor));
  expect(wire.waitingFor?.type, 'the server asks the party (the grant)').toBe('party');
  expect(step.parls, 'ONE Parliament instance').toBe(1);
  expect(step.embedded, 'the Parliament is EMBEDDED').toBe(true);
  expect(step.standalone, 'never a standalone band').toBe(false);
  expect(step.zone, 'teleported into a host zone').not.toBe('(none)');
  expect(step.ownHead, 'an embedded surface does not title itself').toBe(false);
  expect(step.stage, 'straight into the vote pose').toBe('vote');
  expect(step.count, 'the grant is ×2').toBe('2');
  expect(step.cta, 'A sends BOTH delegates').toMatch(/Отправить делегатов/);
  expect(step.ctaClass).toContain('con-parl__cta--ready');
  expect(step.plate, 'a step of the flow, never an announce plate').toBe(false);
  const crumb = step.crumbs.join(' || ');
  expect(crumb, 'the crumb gains ГОЛОСОВАНИЕ as its tail').toMatch(/ГОЛОСОВАНИЕ/i);
  expect(crumb, 'the carried subject (the tile) survives into the step').toMatch(/ВЕНЕРА/i);

  // ── A → both cubes fly from the reserve onto the chosen card; the step pops on the landing. ──
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.type ?? 'none', {timeout: 30_000, message: 'the grant was answered'}).not.toBe('party');
  await cinematicBeat(page, 1400, 'the cubes leave the reserve');
  await shoot(page, '12-cubes-fly');
  await expect.poll(async () => page.locator('.con-parl').count(), {timeout: 40_000, message: 'the vote step pops after the landing'}).toBe(0);
  await cinematicBeat(page, 1200, 'the host takes the screen back');
  await shoot(page, '13-after-step');

  const after = await serverView(request, playerId);
  const mine = (after.game.parliament?.slots ?? []).map((s) => ({instance: s.instance, party: s.party, mine: s.votes.filter((v) => v.owner === me).length}));
  console.log('── the table after ──', JSON.stringify(mine));
  expect(mine.some((s) => s.mine === 2), 'two of the seat\'s delegates stand on ONE card').toBe(true);
  expect(after.game.colonies.find((c) => c.name === VENUS)?.isActive).toBe(true);

  const probe = await readStepProbe(page);
  console.log('── step probe ──', JSON.stringify(probe, null, 2));
  expect(probe.samples, 'the probe was alive').toBeGreaterThan(20);
  expect(probe.standalone, 'a standalone Parliament band stood at some point').toBe(false);
  expect(probe.parlMax, 'at most one Parliament root at any moment').toBeLessThanOrEqual(1);
  expect(probe.ownHead, 'the embedded surface titled itself at some point').toBe(false);
  expect(probe.plate, 'a mandatory plate rose over the step').toBe(false);
  // THE CUBES FLY — every granted delegate is a proxy that visibly TRAVELS from the reserve to the card.
  const travels = Object.entries(probe.flights).map(([id, f]) => ({id, n: f.n, dx: f.last[0] - f.first[0], dy: f.last[1] - f.first[1], w: f.first[2]}));
  console.log('── delegate flights ──', JSON.stringify(travels));
  expect(travels.length, 'two delegate proxies were seen in flight').toBeGreaterThanOrEqual(2);
  for (const t of travels) {
    expect(Math.hypot(t.dx, t.dy), `flight ${t.id} travelled`).toBeGreaterThan(40);
  }

  // The flow LEAVES: nothing is owed after the landing, so the whole stack goes home.
  await expect.poll(async () => page.evaluate(() => ({
    colonies: document.querySelectorAll('.con-colonies').length,
    stdp: document.querySelectorAll('.con-stdp').length,
  })), {timeout: 40_000, message: 'the finished flow leaves for the board'}).toEqual({colonies: 0, stdp: 0});
  await shoot(page, '14-board');
  const stranded = await strandedReports(page);
  expect(stranded, 'no prompt was stranded on the way').toEqual([]);
});
