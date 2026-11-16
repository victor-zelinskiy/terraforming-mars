import * as fs from 'fs';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusCard, press, pressUntil, settle} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, witnessOf} from './witness';

/**
 * TR10 «ОКРАИННАЯ КОЛОНИЯ» — THE COLONY ROSTER's first card: a colony tile is
 * REPLACED in its slot and built on (docs/COLONY_ROSTER_CEREMONY.md,
 * docs/TURMOIL_REDUX_FRINGE_COLONY.md).
 *
 * The contract under test, end to end against a real server, on two profiles:
 *
 *   1. «Выбрать плитку» sends NOTHING: the landing ritual plays, the colony
 *      grid rises INSIDE the hand workspace, the server has not heard a word.
 *   2. It is ONE flow: on every sample the crumb keeps its root and the card's
 *      name; the tail only moves forward (РОЗЫГРЫШ → … → СНЯТИЕ → ЦЕРЕРА ·
 *      ЗАМЕНА → ЦЕРЕРА → ЛУНА · ЗАМЕНА).
 *   3. LEVEL 1 — «which tile leaves»: the grid is the TABLE; the tiles that
 *      cannot leave state their ONE reason; walking the grid moves no box.
 *   4. LEVEL 2 — «which tile enters»: the grid is the RESERVE; every candidate
 *      says how it would enter (Luna «войдёт активной» with the ghost of the
 *      player's cube; Titan «войдёт неактивной · без колонии»). B walks back
 *      to level 1.
 *   5. LEVEL 3 — the stage: the entering planet in its projection pose, the
 *      leaving tile's seat, the three facts. Still nothing sent.
 *   6. A «Разыграть карту» is the play's ONE POST, its tail the replacement —
 *      BOTH tiles in one answer, ADDRESSED to the card.
 *   7. THE CEREMONY, in ORDER (never intervals): the leaving tile's seat is
 *      gone BEFORE the hero docks; the cube stands in the berth only AFTER it.
 *   8. THE LANDING: Luna stands in the very slot Ceres held, and no other
 *      tile's box moved; the server agrees (the slot, the colony, −24 M€, the
 *      build bonus).
 *   9. The flow ENDS ON THE BOARD: no workspace, nothing stranded, no
 *      overflow, no page error, and the ceremony never confessed a degraded run.
 *
 * Fixture `fringe-colony` (tests/e2e/fixtures/generate.ts): blue's action
 * phase in generation 4, 30 M€; Ceres and Europa empty, Io with red's colony,
 * Callisto with red's fleet; Luna and Titan in the reserve.
 */

const CARD = 'Fringe Colony';
const CARD_RU = 'Окраинная колония';
const ROOT_RU = 'Карты в руке';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, megacreditProduction: number, tableau: Array<{name: string}>};
  game: {gameAge: number, colonies: Array<{name: string, colonies: Array<string>}>};
};

/** The server's own view. One retry on a dropped socket (a loaded per-worker server resets a connection now and then). */
async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  try {
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  } catch (err) {
    if (!/ECONNRESET|socket hang up/.test(String(err))) {
      throw err;
    }
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  }
}

const tableOf = (wire: Wire) => wire.game.colonies.map((c) => c.name);

/** The record folded (`readProbe`). */
type Probe = {
  /** The DISTINCT states recorded (never frames). */
  samples: number;
  steps: Array<string>;
  crumbMisses: Array<string>;
  coloniesOutsideHand: boolean;
  coloniesMax: number;
  degraded: Array<string>;
  stranded: boolean;
  /** The ceremony's facts, each stamped the FIRST time it was seen (ms from the arm; −1 = never). */
  seatSeen: number;
  seatGone: number;
  projected: number;
  docked: number;
  cube: number;
  receipt: number;
  beats: Array<string>;
};

/** ONE observation of the screen — what stands now (the reader's answer; the folding is `readProbe`'s). */
type FringeSeen = {
  head: {root: string, subjects: Array<string>, steps: Array<string>} | null;
  colonies: number;
  /** A colonies surface outside the hand, or standing as a band of its own. */
  outside: boolean;
  degraded: Array<string>;
  beats: Array<string>;
  receipt: boolean;
  stranded: boolean;
  /** The replacement's stage: the leaving tile's seat, the projection pose, the committed cube in Luna's first berth. */
  stage: {seat: boolean, projected: boolean, cube: boolean} | null;
};
const FRINGE_WITNESS = 'tr10-flow';

/**
 * THE FLOW'S RECORD (FLAKE ZERO — `armWitness`, replace-proof, armed before the first press): the hand's crumb, the
 * colonies surfaces, the roster's beats and the stage's facts as they stand; every change kept with the PAGE's time.
 * The claims are about ORDER (the ceremony's beats) and COEXISTENCE (one colonies instance, never outside the hand), so
 * the record is `settled` — the state a task leaves, the one a frame paints.
 */
async function armProbe(page: Page): Promise<void> {
  await armWitness<FringeSeen>(page, FRINGE_WITNESS, () => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const head = document.querySelector('.con-hand')?.querySelector('.con-wshead') ?? null;
    const colonies = Array.from(document.querySelectorAll('.con-colonies'));
    const stage = document.querySelector('.con-colfocus[data-colony-roster="replace"]');
    return {
      head: head === null ? null : {
        root: text(head.querySelector('.con-wshead__root')),
        subjects: Array.from(head.querySelectorAll('.con-wshead__subject')).map(text),
        steps: Array.from(head.querySelectorAll('.con-wshead__step')).map(text).filter((s) => s !== ''),
      },
      colonies: colonies.length,
      outside: colonies.some((el) => el.closest('.con-hand') === null || el.classList.contains('con-ws')),
      degraded: colonies.map((el) => el.getAttribute('data-colony-roster-degraded')).filter((d): d is string => d !== null),
      beats: colonies.map((el) => el.getAttribute('data-colony-roster-beat') ?? '').filter((b) => b !== ''),
      receipt: colonies.some((el) => el.querySelector('[data-colony-roster-receipt]') !== null),
      stranded: document.querySelector('.con-stranded') !== null,
      stage: stage === null ? null : {
        seat: stage.querySelector('[data-roster-outgoing-seat]') !== null,
        projected: stage.classList.contains('con-colfocus--roster-projected'),
        // The colony the same answer built: the committed cube stands in the stage's own first berth.
        cube: stage.querySelector('[data-colony-build-slot="Luna#0"] .player-cube') !== null,
      },
    };
  }, {settled: true});
}

/** The record folded — the ceremony's facts stamped the FIRST time each was seen (ms from the first state; −1 = never). */
async function readProbe(page: Page): Promise<Probe> {
  const record = await witnessOf<FringeSeen>(page, FRINGE_WITNESS).stop();
  const t0 = record[0]?.t ?? 0;
  const p: Probe = {
    samples: record.length, steps: [], crumbMisses: [], coloniesOutsideHand: false, coloniesMax: 0, degraded: [], stranded: false,
    seatSeen: -1, seatGone: -1, projected: -1, docked: -1, cube: -1, receipt: -1, beats: [],
  };
  for (const {t, v} of record) {
    const stamp = (key: 'seatSeen' | 'seatGone' | 'projected' | 'docked' | 'cube' | 'receipt') => {
      if (p[key] === -1) {
        p[key] = t - t0;
      }
    };
    if (v.head !== null) {
      if (v.head.root.toLowerCase() !== ROOT_RU.toLowerCase() || !v.head.subjects.some((s) => s.toLowerCase() === CARD_RU.toLowerCase())) {
        if (p.crumbMisses.length < 8) {
          p.crumbMisses.push(`${t - t0}ms root=«${v.head.root}» subject=«${v.head.subjects.join('|')}»`);
        }
      }
      for (const step of v.head.steps) {
        if (!p.steps.includes(step)) {
          p.steps.push(step);
        }
      }
    }
    p.coloniesMax = Math.max(p.coloniesMax, v.colonies);
    if (v.outside) {
      p.coloniesOutsideHand = true;
    }
    for (const degraded of v.degraded) {
      if (!p.degraded.includes(degraded)) {
        p.degraded.push(degraded);
      }
    }
    for (const beat of v.beats) {
      if (p.beats[p.beats.length - 1] !== beat) {
        p.beats.push(beat);
      }
    }
    if (v.receipt) {
      stamp('receipt');
    }
    if (v.stranded) {
      p.stranded = true;
    }
    if (v.stage !== null) {
      if (v.stage.seat) {
        stamp('seatSeen');
      } else if (p.seatSeen !== -1) {
        stamp('seatGone');
      }
      if (v.stage.projected) {
        stamp('projected');
      } else if (p.projected !== -1) {
        stamp('docked');
      }
      if (v.stage.cube) {
        stamp('cube');
      }
    }
  }
  return p;
}

/**
 * Every tile's SLOT on the grid, by colony. The slot, not the tile: the tile under the cursor wears the cursor's own
 * lift, which is not the grid moving.
 */
const tileBoxes = (page: Page, scope: string) => page.evaluate((sel) => {
  const out: Record<string, string> = {};
  document.querySelectorAll<HTMLElement>(`${sel} [data-test^="con-colony-"]`).forEach((el) => {
    const r = (el.closest('.con-colonies__slot') ?? el).getBoundingClientRect();
    out[(el.getAttribute('data-test') ?? '').replace('con-colony-', '')] = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
  });
  return out;
}, scope);
/** `tileBoxes` at REST (class C — `readSettled`: the same answer twice, a frame apart). The pick STANDS for the player
 *  — no `settle` first. */
const tileBoxesAtRest = (page: Page, scope: string, what: string) => readSettled(page, () => tileBoxes(page, scope), {settle: false, message: what});

/**
 * The receipt grid's slot boxes — RECORDED from before the commit (`armWitness`): the receipt stands for ONE read
 * (`ROSTER_READ_MS`, 680 ms — 340 at the functional class's ×0.5), so its pose is caught in the task that paints it,
 * never by a read that may come after it left. Null while no receipt stands — and once its surface is LEAVING (the
 * product's own `data-motion-leaving`): the dissolve is the leave's, not the landing's.
 */
const RECEIPT_WITNESS = 'tr10-receipt';
/** One recorded pose of the receipt: the slot boxes and the receipt's own words (both read IN its window). */
type ReceiptPose = {boxes: Record<string, string>, words: string};
async function armReceiptBoxes(page: Page): Promise<void> {
  await armWitness<ReceiptPose | null>(page, RECEIPT_WITNESS, () => {
    const grid = document.querySelector('.con-hand .con-colonies--receipt');
    if (grid === null || grid.closest('[data-motion-leaving]') !== null) {
      return null;
    }
    const boxes: Record<string, string> = {};
    grid.querySelectorAll<HTMLElement>('[data-test^="con-colony-"]').forEach((el) => {
      const r = (el.closest('.con-colonies__slot') ?? el).getBoundingClientRect();
      boxes[(el.getAttribute('data-test') ?? '').replace('con-colony-', '')] = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
    });
    const words = (document.querySelector('.con-hand [data-colony-roster-receipt]')?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {boxes, words};
  }, {settled: true});
}
/**
 * The pose the receipt RESTED in — its LAST pose before it ended (waited for on the RECORD: a pose, then none — the
 * receipt stands for one read, 340 ms at the functional pace, and a wait for it to be visible that starts after the
 * server's answer was polled can begin after it has already left), with its words.
 */
async function receiptRest(page: Page): Promise<ReceiptPose> {
  const w = witnessOf<ReceiptPose | null>(page, RECEIPT_WITNESS);
  const ended = (poses: ReadonlyArray<ReceiptPose | null>) => {
    const first = poses.findIndex((p) => p !== null);
    return first === -1 ? -1 : poses.indexOf(null, first);
  };
  await expect.poll(async () => ended(await w.values()), {timeout: 30_000, message: 'the receipt stood and was read'}).toBeGreaterThan(0);
  const poses = (await w.stop()).map((s) => s.v);
  const rest = poses[ended(poses) - 1] ?? null;
  // The words: the last non-empty reading of the receipt's own line while it stood.
  const words = poses.slice(0, ended(poses)).filter((p): p is ReceiptPose => p !== null).map((p) => p.words).filter((s) => s !== '').at(-1) ?? '';
  return {boxes: rest?.boxes ?? {}, words};
}

const composer = '.con-composer--play';
const grid = '.con-hand .con-colonies[data-colony-mode="pick"]';
const stage = '.con-hand .con-colfocus[data-colony-roster="replace"]';
const tile = (name: string) => `${grid} [data-test="con-colony-${name}"]`;
const focusedTile = (page: Page) => page.evaluate(() =>
  document.querySelector('.con-colonies__slot--focused [data-test^="con-colony-"]')?.getAttribute('data-test')?.replace('con-colony-', '') ?? '');
const railNames = (page: Page) => page.evaluate((sel) =>
  Array.from(document.querySelectorAll(`${sel} [data-test^="con-colony-"]`)).map((el) => (el.getAttribute('data-test') ?? '').replace('con-colony-', '')), grid);

/** «ВЫБРАТЬ ПЛИТКУ» — one press, verified by the composer's OWN state; never a blind retry. */
async function chooseTile(page: Page): Promise<void> {
  const taken = () => page.evaluate((sel) =>
    document.querySelector('.con-composer--submitting, .con-composer--landing') !== null || document.querySelector(sel) !== null, grid);
  await pressUntil(page, 'Enter', taken, {tries: 3, settleMs: 2_500});
  await page.locator(grid).waitFor({timeout: 30_000});
  await expect(page.locator(composer), 'the composer left with the landing scene').toHaveCount(0, {timeout: 15_000});
  await settle(page, {timeoutMs: 20_000});
}

/** Walk the grid cursor to `name` — each press verified by the cursor itself; turns around at a wall. */
async function walkTo(page: Page, name: string): Promise<void> {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  for (let step = 0; step < 24 && await focusedTile(page) !== name; step++) {
    const before = await focusedTile(page);
    await press(page, keys[Math.floor(step / 6) % keys.length], 200);
    await expect.poll(() => focusedTile(page), {timeout: 1_500}).not.toBe(before).catch(() => undefined);
  }
  expect(await focusedTile(page), `the cursor reached ${name}`).toBe(name);
}

for (const preset of PRESETS) {
  test.describe(`TR10 Fringe Colony · the colony roster · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`play → «Выбрать плитку» → Ceres leaves → the reserve → B → again → Luna's stage → A → the ceremony → the landing → the board (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const pageErrors: Array<string> = [];
      const overflow: Array<string> = [];
      const posts: Array<{url: string, body: string}> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push({url: r.url(), body: r.postData() ?? ''});
        }
      });

      const playerId = await bootFixture(page, request, 'fringe-colony', {query: preset.query});
      const before = await wireOf(request, playerId);
      expect(tableOf(before), 'the fixture\'s table').toEqual(['Ceres', 'Io', 'Callisto', 'Europa']);

      // ── the composer: the door's verb and its step row ──
      await press(page, 'Period', 600); // RT → the quick wheel
      await press(page, 'Enter', 1600); // centre slot → the hand
      await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
      expect(await focusCard(page, CARD, 24), `never focused «${CARD}»`).toBeTruthy();
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await press(page, 'Enter', 1200);
      await page.locator(composer).waitFor({timeout: 15_000});
      await settle(page);
      await expect(page.locator(composer), 'the CTA is the door\'s navigation verb').toContainText('Выбрать плитку');
      await expect(page.locator(composer), 'the next step is named, not guessed').toContainText('Плитка колонии — замена в «Колониях»');

      await armProbe(page);

      // ── 1. «Выбрать плитку»: nothing is sent ──
      await chooseTile(page);
      expect(posts, 'no POST before the commit').toEqual([]);
      const staged = await wireOf(request, playerId);
      expect(staged.game.gameAge, 'the server\'s change counter stands still').toBe(before.game.gameAge);
      expect((staged.cardsInHand ?? []).map((c) => c.name), 'the card is still in the hand on the server').toContain(CARD);

      // ── 3. LEVEL 1: the table; who cannot leave says why; walking moves no box ──
      expect(await railNames(page), 'level 1 rails the TABLE').toEqual(['Ceres', 'Io', 'Callisto', 'Europa']);
      await expect(page.locator(`${tile('Io')} .con-coltile__status`), 'a tile with a colony states why it stays').toContainText('На плитке есть колонии');
      await expect(page.locator(`${tile('Callisto')} .con-coltile__status`), 'a tile with a fleet states why it stays').toContainText('На плитке стоит торговый флот');
      expect(await focusedTile(page), 'the cursor stands on the first tile that may leave (A only chooses)').toBe('Ceres');
      const tableBoxes = await tileBoxesAtRest(page, grid, 'the table\'s slots');
      await walkTo(page, 'Europa');
      expect(await tileBoxesAtRest(page, grid, 'the table\'s slots after the walk'), 'the grid\'s boxes did not move under the walk').toEqual(tableBoxes);
      await walkTo(page, 'Ceres');
      await expect(page.locator(`${grid} [data-colonies-rail-roster="leaves"]`), 'the rail says what choosing it does').toContainText('будет снята');

      // ── 4. LEVEL 2: the reserve, each candidate as it would enter; B walks back ──
      const toReserve = async () => {
        await pressUntil(page, 'Enter', async () => (await railNames(page)).includes('Luna'), {tries: 3, settleMs: 4_000});
        expect(await railNames(page), 'level 2 rails the RESERVE').toContain('Luna');
        await settle(page, {timeoutMs: 20_000});
      };
      await toReserve();
      expect(await railNames(page), 'the tiles in play are not offered to enter').not.toContain('Ceres');
      expect(posts, 'choosing the leaving tile sends nothing').toEqual([]);
      await expect(page.locator(`${tile('Luna')} .con-coltile__status`), 'Luna: how it would enter').toContainText('Войдёт активной');
      await expect(page.locator(`${tile('Luna')} [data-colony-projected-cube]`), 'Luna: the ghost of the player\'s cube in its first berth').toHaveCount(1);
      await expect(page.locator(`${tile('Titan')} .con-coltile__status`), 'Titan: inactive, and the colony will not stand').toContainText('Войдёт неактивной · без колонии');
      await expect(page.locator(`${tile('Titan')} [data-colony-projected-cube]`), 'Titan: no ghost cube').toHaveCount(0);
      await expect(page.locator(`${grid} [data-colonies-rail-roster="leaving"]`), 'the leaving tile leads the rail').toContainText('Церера');

      await pressUntil(page, 'Escape', async () => (await railNames(page)).includes('Ceres'), {tries: 3, settleMs: 4_000});
      expect(await railNames(page), 'B walks back to level 1 — the table').toEqual(['Ceres', 'Io', 'Callisto', 'Europa']);
      expect(await focusedTile(page), 'the cursor is back on the tile that was un-chosen').toBe('Ceres');
      await expect(page.locator(composer), 'B from level 2 is ONE level — never the composer').toHaveCount(0);
      expect(posts).toEqual([]);

      // ── 5. forward again; A on Luna descends to its stage ──
      await toReserve();
      await walkTo(page, 'Luna');
      await pressUntil(page, 'Enter', async () => await page.locator(stage).count() > 0, {tries: 3, settleMs: 4_000});
      await page.locator(stage).waitFor({timeout: 15_000});
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator(stage), 'the entering planet stands in its projection pose').toHaveClass(/con-colfocus--roster-projected/);
      await expect(page.locator(`${stage} [data-roster-outgoing-seat]`), 'the leaving tile\'s seat').toContainText('Церера');
      await expect(page.locator(`${stage} [data-roster-fact="leaves"]`), 'fact 1: who leaves').toContainText('Церера');
      await expect(page.locator(`${stage} [data-roster-fact="arrives"]`), 'fact 2: who arrives, and how').toContainText('Войдёт активной');
      await expect(page.locator(`${stage} [data-roster-fact="build"]`), 'fact 3: the colony lands').toHaveAttribute('data-roster-build', 'lands');
      expect(posts, 'the descent sends nothing').toEqual([]);

      // ── 6. A «Разыграть карту» — ONE POST, the replacement addressed to the card ──
      await armReceiptBoxes(page);
      await pressUntil(page, 'Enter', async () => posts.length > 0, {tries: 3, settleMs: 3_000});
      expect(posts.map((p) => new URL(p.url).pathname), 'the play is ONE batch POST').toEqual(['/player/input-batch']);
      const sent = JSON.parse(posts[0].body) as {responses?: Array<Record<string, unknown>>} | Array<Record<string, unknown>>;
      const responses = Array.isArray(sent) ? sent : sent.responses ?? [];
      expect(responses[responses.length - 1], 'the tail names BOTH tiles, ADDRESSED to the card')
        .toMatchObject({type: 'colony', colonyName: 'Luna', replaces: 'Ceres', stagedFor: CARD});

      // ── 8. the server: the slot, the colony, the price, the build bonus ──
      await expect.poll(async () => tableOf(await wireOf(request, playerId)), {timeout: 30_000, message: 'Luna holds the slot Ceres held'})
        .toEqual(['Luna', 'Io', 'Callisto', 'Europa']);
      const after = await wireOf(request, playerId);
      expect(after.game.colonies[0].colonies, 'the player\'s colony stands on Luna').toEqual([after.thisPlayer.color]);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(after.thisPlayer.megacredits, 'the card cost 24 M€').toBe(before.thisPlayer.megacredits - 24);
      expect(after.thisPlayer.megacreditProduction, 'Luna\'s build bonus: +2 M€ production').toBe(before.thisPlayer.megacreditProduction + 2);

      // ── 8b. THE LANDING: the receipt grid — Luna in Ceres's slot, nobody else moved ──
      // The receipt stands for ONE read (`ROSTER_READ_MS`, 680 ms — 340 at the functional class's ×0.5): its boxes AND
      // its words come from the RECORD armed before the commit, read IN that window — never a wait for it to be
      // visible, which starts after the server's answer was polled and can begin after the receipt has left.
      const receipt = await receiptRest(page);
      const landed = receipt.boxes;
      expect(landed.Luna, 'Luna stands in the very box Ceres stood in').toBe(tableBoxes.Ceres);
      for (const name of ['Io', 'Callisto', 'Europa']) {
        expect(landed[name], `${name} did not move`).toBe(tableBoxes[name]);
      }
      expect(receipt.words, 'the receipt names the change').toContain('Церера');

      // ── 9. the flow ends on the board ──
      await expect.poll(() => page.evaluate(() => ({
        hand: document.querySelectorAll('.con-hand').length,
        colonies: document.querySelectorAll('.con-colonies').length,
        ws: document.querySelectorAll('.con-ws').length,
      })), {timeout: 40_000, message: 'the finished flow leaves for the board'}).toEqual({hand: 0, colonies: 0, ws: 0});
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator(composer), 'the composer never comes back past the commit').toHaveCount(0);
      expect(posts.length, 'and nothing else was sent').toBe(1);

      const probe = await readProbe(page);
      const dump = JSON.stringify(probe);
      fs.mkdirSync('test-results', {recursive: true});
      fs.writeFileSync(`test-results/fringe-colony-${preset.id}.json`, JSON.stringify(probe, null, 1));
      // The record keeps DISTINCT states, never frames: its floor catches only a dead recorder (`tests.md`).
      expect(probe.samples, `the probe's recorder ran (${probe.samples} states)`).toBeGreaterThan(0);

      // ── 2. one flow ──
      expect(probe.crumbMisses, 'the crumb kept its root and the card\'s name on every sample').toEqual([]);
      expect(probe.steps[0], `the tail starts at the composer (${dump})`).toBe('Розыгрыш');
      expect(probe.steps, `the tail names level 1 (${dump})`).toContain('Снятие');
      expect(probe.steps, `…then level 2 (${dump})`).toContain('Церера · Замена');
      expect(probe.steps[probe.steps.length - 1], `…and ends on the stage (${dump})`).toBe('Церера → Луна · Замена');
      expect(probe.coloniesOutsideHand, 'the colonies stood inside the hand, never as a band of their own').toBe(false);
      expect(probe.coloniesMax, 'ONE colonies instance').toBe(1);

      // ── 7. the ceremony's ORDER (law 17: the source was seen, the destination was seen, the change happened) ──
      expect(probe.seatSeen, `the leaving tile's seat was on screen (${dump})`).toBeGreaterThanOrEqual(0);
      expect(probe.projected, `the hero stood in its projection pose (${dump})`).toBeGreaterThanOrEqual(0);
      expect(probe.seatGone, `the seat let go (${dump})`).toBeGreaterThan(probe.seatSeen);
      expect(probe.docked, `the hero docked (${dump})`).toBeGreaterThan(probe.projected);
      expect(probe.seatGone, `the leaving planet was gone BEFORE the new one docked (${dump})`).toBeLessThanOrEqual(probe.docked);
      expect(probe.cube, `the player's cube stood in the berth only AFTER the planet docked (${dump})`).toBeGreaterThan(probe.docked);
      expect(probe.receipt, `the receipt came AFTER the cube (${dump})`).toBeGreaterThan(probe.cube);

      expect(probe.degraded, 'the ceremony never confessed a degraded run').toEqual([]);
      expect(probe.stranded, 'nothing was stranded').toBe(false);
      expect(overflow, 'no [console-overflow]').toEqual([]);
      expect(pageErrors, 'no page errors').toEqual([]);
    });
  });
}
