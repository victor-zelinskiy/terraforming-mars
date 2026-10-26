/*
 * TR79 FERRUS ACADEMY — the second new corporation of Turmoil Redux (`docs/TURMOIL_REDUX_FERRUS_ACADEMY.md`). A live
 * solo game on the TV profile, the corporation named in the seed:
 *
 *  A · THE FIRST ACTION AS ONE PHYSICAL SCENE — the start workspace's «ПЕРВОЕ ДЕЙСТВИЕ» stage → A → the city
 *      placement; on the aimed cell the RING the city would reserve stands as SILHOUETTES of the player's cube (one per
 *      cell the server's own preview names — `marked-area-reserve.spaces`), through the lock; the press lands the city,
 *      then the cubes are set down ONE BY ONE (never one frame, never before the city); the start workspace never
 *      paints over the chain and returns once;
 *  B · A TILE ON AN OWN CUBE ASKS — a standard Greenery aimed at a reserved cell: the dossier names Ferrus Academy's
 *      answer before the press; after it the question stands with «3 данных» VISIBLE AND DISABLED with its reason
 *      (no card holds data — the owner's decision 3), the card is taken.
 * The doubled printed bonus, the predicate, Arcadian + Ferrus on one table are pinned server-side
 * (`tests/cards/turmoilRedux/FerrusAcademy.spec.ts`, `tests/boards/{PrintedBonusMultiplier,OwnMarkerBuilt}.spec.ts`).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootIntoGame, cinematicBeat, confirmLockedPlacement, visibleSurfaces, fetchPlayerModel, press, pressUntil, readiness, settle, soloGameConfig, walkToSpace,
} from './consoleStart';

const OUT = path.resolve('screenshots', 'ferrus');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const FERRUS = 'Ferrus Academy';

type Fact = {id: string, spaces?: Array<string>, reservesSpaces?: true};
type Preview = {legal: boolean, immediateFacts: Array<Fact>, ruleFacts: Array<Fact>, recipientFacts: Array<Fact>, costFacts: Array<Fact>};
type Wire = {
  id?: string,
  thisPlayer: {color: string, megaCredits: number, cardsInHandNbr?: number},
  game: {spaces: Array<{id: string, color?: string, tileType?: number}>},
  waitingFor?: {type: string, spaces?: Array<string>},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
  await page.screenshot({path: path.join(OUT, PRESET.id, `${name}.png`)});
}

/** The server's own reading of the ring the first city would reserve on `space` — the silhouettes' authority. */
async function ringOf(request: APIRequestContext, playerId: string, space: string): Promise<Array<string>> {
  const params = new URLSearchParams({id: playerId, space, kind: 'city', card: FERRUS, bonus: '2'});
  const res = await request.get(`/api/game/board-cell-preview?${params.toString()}`);
  if (res.status() !== 200) {
    return [];
  }
  const preview = await res.json() as Preview;
  const facts = [...preview.immediateFacts, ...preview.ruleFacts, ...preview.recipientFacts, ...preview.costFacts];
  return facts.find((f) => f.reservesSpaces === true)?.spaces ?? [];
}

/** The start workspace is PAINTED (mounted-and-hidden is the yield pose). */
async function startPainted(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-start');
    return el !== null && (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
  }).catch(() => false);
}

test.describe(`console · TR79 Ferrus Academy · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A · B — the ring as silhouettes, the cubes set down one by one, a tile on an own cube asks with «3 data» disabled', async ({page, request}) => {
    test.setTimeout(480_000);
    const playerId = await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {colonies: true, turmoilRedux: true},
        startingCorporations: 1,
        customCorporationsList: [FERRUS],
      }),
      corporation: FERRUS,
      buy: 0,
      until: 'startRelease',
      query: PRESET.query,
    });

    // ── A · the stage: the corporation's first action, the start workspace's own stage.
    const stage = page.locator('.con-start__firstact');
    await stage.waitFor({state: 'visible', timeout: 60_000});
    await settle(page, {timeoutMs: 20_000});
    await shoot(page, '01-first-action-stage');
    const next = (await stage.locator('.con-start__firstact-next').allInnerTexts()).join(' ');
    expect(next, 'the stage names the doubled printed bonus').toMatch(/удвоен/i);
    expect(next, 'the stage names the ring of cubes').toMatch(/куб/i);

    // A → the city placement.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-board--placing').count() > 0, {tries: 3, settleMs: 1500}),
      'the city placement opened').toBeTruthy();
    const color = (await wireOf(request, playerId)).thisPlayer.color;
    const legal = (await wireOf(request, playerId)).waitingFor?.spaces ?? [];
    expect(legal.length, 'legal city cells').toBeGreaterThan(0);
    // The cell with the WIDEST ring the server names (the silhouettes' authority — never a client geometry).
    let target = '';
    let ring: Array<string> = [];
    for (const space of legal) {
      const r = await ringOf(request, playerId, space);
      if (r.length > ring.length) {
        target = space;
        ring = r;
      }
      if (ring.length === 6) {
        break;
      }
    }
    expect(ring.length, `a city cell with a ring (best ${target})`).toBeGreaterThan(1);
    await walkToSpace(page, target);

    // THE SILHOUETTES: one per reserved cell, exactly the server's cells — and no light (material only, invariant 15).
    const ghosts = page.locator('[data-reserve-ghost]');
    await expect(ghosts, 'one silhouette per reserved cell').toHaveCount(ring.length, {timeout: 15_000});
    const seated = await ghosts.evaluateAll((els) => els.map((e) => e.getAttribute('data-reserve-space') ?? '').sort());
    expect(seated, 'the silhouettes stand on the server\'s ring').toEqual([...ring].sort());
    const halo = await ghosts.evaluateAll((els) => els.some((e) => {
      const s = getComputedStyle(e);
      return /\d+px \d+px [1-9]/.test(s.boxShadow) || s.filter.includes('drop-shadow');
    }));
    expect(halo, 'a silhouette is material, never a glow').toBeFalsy();
    await expect(page.locator('.con-context'), 'the dossier names the ring').toContainText(/Участки вокруг города/i, {timeout: 10_000});
    await shoot(page, '02-silhouettes');

    // The LOCK keeps them standing.
    await press(page, 'Enter', 420);
    await expect(page.locator('.con-board--locked'), 'the cell is locked').toHaveCount(1, {timeout: 5_000});
    await expect(ghosts, 'the silhouettes stand through the lock').toHaveCount(ring.length);
    await shoot(page, '03-silhouettes-locked');

    // THE SAMPLER — armed before the confirm: when the city tile and each ring cube FIRST paint.
    await page.evaluate(({cells, city}) => {
      const t0 = performance.now();
      const seen: Record<string, number> = {};
      let painted = false;
      let flash = false;
      (window as unknown as {__ferrusRing: unknown}).__ferrusRing = {seen, t0, get flash() {
        return flash;
      }};
      const tick = () => {
        const cityCell = document.querySelector(`.board-space[data_space_id="${city}"]`);
        // The REAL tile paints in the cell at the contact, under the settling proxy (the hero layer itself stays for the rewards).
        if (seen.city === undefined && cityCell !== null && cityCell.querySelector('[class*="board-space-tile--"]') !== null) {
          seen.city = performance.now() - t0;
        }
        for (const id of cells) {
          if (seen[id] === undefined && document.querySelector(`.board-space[data_space_id="${id}"] > .player-cube.board-owner-cube`) !== null) {
            seen[id] = performance.now() - t0;
          }
        }
        const start = document.querySelector('.con-start') as HTMLElement | null;
        const chain = document.querySelectorAll('.con-tileplace').length > 0;
        painted = start !== null && start.checkVisibility({opacityProperty: true, visibilityProperty: true});
        if (painted && chain) {
          flash = true;
        }
      };
      window.setInterval(tick, 16);
    }, {cells: ring, city: target});
    await confirmLockedPlacement(page, 'Enter');

    // The server: the city stands, the ring is the player's.
    await expect.poll(async () => {
      const spaces = (await wireOf(request, playerId)).game.spaces;
      return ring.every((id) => spaces.find((s) => s.id === id)?.color === color);
    }, {timeout: 30_000, message: 'every cell of the ring holds the player\'s cube on the server'}).toBeTruthy();

    // The cubes land — read the sampler once every ring cube has painted.
    await expect.poll(async () => page.evaluate((cells) => {
      const s = (window as unknown as {__ferrusRing: {seen: Record<string, number>}}).__ferrusRing.seen;
      return cells.every((id) => s[id] !== undefined);
    }, ring), {timeout: 30_000, message: 'every ring cube painted on the board'}).toBeTruthy();
    await shoot(page, '04-ring-landed');
    const sample = await page.evaluate(() => {
      const r = (window as unknown as {__ferrusRing: {seen: Record<string, number>, flash: boolean}}).__ferrusRing;
      return {seen: {...r.seen}, flash: r.flash};
    });
    const cubeTimes = ring.map((id) => sample.seen[id]).sort((a, b) => a - b);
    const distinct = new Set(cubeTimes.map((t) => Math.round(t / 16))).size;
    console.log(`── ring ${target}: city ${sample.seen.city?.toFixed(0)} ms · cubes ${cubeTimes.map((t) => t.toFixed(0)).join(' / ')}`);
    expect(distinct, 'the cubes are set down one by one — never one frame').toBeGreaterThanOrEqual(Math.min(3, ring.length));
    expect(cubeTimes[cubeTimes.length - 1] - cubeTimes[0], 'the ring takes its time').toBeGreaterThan((ring.length - 1) * 30);
    if (sample.seen.city !== undefined) {
      expect(cubeTimes[0], 'no cube before the city').toBeGreaterThanOrEqual(sample.seen.city);
    }

    // The completion barrier: the workspace never painted over the chain; the board settles.
    await settle(page, {timeoutMs: 60_000});
    expect(sample.flash, 'the start workspace never painted over the placement chain').toBeFalsy();
    expect(await startPainted(page) || await page.locator('.con-board').count() > 0, 'a settled end state').toBeTruthy();
    await shoot(page, '05-settled');

    // ── B · a standard Greenery on a reserved cell: the dossier names Ferrus' answer before the press.
    for (let i = 0; i < 6 && await startPainted(page); i++) {
      await press(page, 'Escape', 900);
    }
    await settle(page, {timeoutMs: 30_000});
    const handBefore = (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr ?? 0;
    await press(page, 'Comma', 1100);
    await press(page, 'Enter', 1400);
    await expect(page.locator('.con-stdp'), 'the standard projects opened').toHaveCount(1, {timeout: 15_000});
    await settle(page, {timeoutMs: 15_000});
    const focused = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
    const snake = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowDown'];
    for (let i = 0; i < 6 && !/озеленени/i.test(await focused()); i++) {
      await press(page, 'ArrowUp', 200);
    }
    for (let i = 0; i < snake.length && !/озеленени/i.test(await focused()); i++) {
      await press(page, snake[i], 240);
    }
    expect(/озеленени/i.test(await focused()), `the Greenery row (at «${await focused()}»)`).toBeTruthy();
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-board--placing').count() > 0, {tries: 3, settleMs: 1500}),
      'the greenery placement opened').toBeTruthy();
    const greeneryLegal = (await wireOf(request, playerId)).waitingFor?.spaces ?? [];
    const marked = ring.find((id) => greeneryLegal.includes(id));
    expect(marked, 'a reserved cell takes the greenery').toBeDefined();
    await walkToSpace(page, marked!);
    await expect(page.locator('.con-context'), 'the dossier names Ferrus Academy\'s answer').toContainText(/Ferrus Academy/i, {timeout: 10_000});
    await expect(page.locator('.con-context'), '«data has nowhere to go» is said before the press').toContainText(/данные класть некуда/i);
    await shoot(page, '06-marked-cell-answer');
    await press(page, 'Enter', 420);
    await confirmLockedPlacement(page, 'Enter');

    // The question: «3 данных» VISIBLE and disabled with its reason; the draw is the live branch.
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.type, {timeout: 30_000, message: 'the question stands'}).toBe('or');
    const decision = page.locator('.con-task');
    // The question is the NEXT surface of this press: it must rise within a few beats, never behind a safety net. A trail
    // of the product's own readiness (holds, transport, depth) names what kept it if it does not.
    const asked = Date.now();
    const trail: Array<string> = [];
    page.on('console', (msg) => {
      if (/strand|leak|recover|watchdog|admission|mandatory/i.test(msg.text())) {
        trail.push(`${Date.now() - asked}ms console: ${msg.text().slice(0, 240)}`);
      }
    });
    trail.push(`surfaces: ${(await visibleSurfaces(page)).join(',')} · plate=${await page.locator('.con-mandatory').count()}`);
    while (await decision.count() === 0 && Date.now() - asked < 30_000) {
      const r = await readiness(page);
      trail.push(`${Date.now() - asked}ms plate=${await page.locator('.con-mandatory').count()} surf=${(await visibleSurfaces(page)).join('/')} holds=[${(r?.holds ?? []).join(',')}] ws=${r?.wsDepth} wf=${r?.transport?.waitingForType} crumb=${(await page.locator('.con-wshead').first().innerText({timeout: 500}).catch(() => '')).replace(/\s+/g, ' ')}`);
      await cinematicBeat(page, 1000, 'a poll of the question\'s rise — the trail names what holds it');
    }
    console.log(`── question after ${Date.now() - asked} ms\n${trail.join('\n')}`);
    await expect(decision, 'the question surfaces').toBeVisible({timeout: 5_000});
    expect(Date.now() - asked, 'the question rises with the landing, not behind a safety net').toBeLessThan(15_000);
    await expect(decision.locator('.con-task__disabled'), '«3 data» stands disabled').toContainText(/данных/i);
    await expect(decision.locator('.con-task__disabled'), '…with its reason').toContainText(/Нет карты, принимающей данные/i);
    await shoot(page, '07-question-data-disabled');
    // The answer is read on the SERVER's hand (the next prompt is another `or` — the action menu — so its type says nothing).
    expect(await pressUntil(page, 'Enter', async () => ((await wireOf(request, playerId)).thisPlayer.cardsInHandNbr ?? 0) > handBefore, {tries: 3, settleMs: 1500}),
      'the draw answers the question').toBeTruthy();
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr ?? 0, {timeout: 30_000, message: 'a card was drawn'})
      .toBeGreaterThan(handBefore);
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, '08-card-taken');
  });
});
