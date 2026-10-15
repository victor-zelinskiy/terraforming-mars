/*
 * TR53 FRONTIER LABS («Лаборатории фронтира») + THE ITERATION «ПРИЁМ РЕСУРСА КАРТОЙ — ОДИН ПРЕМИУМ-СТАНДАРТ»
 * (`docs/TURMOIL_REDUX_FRONTIER_LABS.md`) — the ONE spec of the iteration (the prompt's §4), three fixtures, fhd + tv4k:
 *
 *   A · `frontier-labs` — the ACTION. The target step reads every candidate's own tail BEFORE the press (the server's
 *       `extraByCard`: «· [card] +1» under a microbe holder, the struck card under a science one) and the near miss
 *       (Pets — 0 of 1, shown, never chosen); the commit: the price leaves the rail, the unit lands on the CHOSEN
 *       miniature (the witness reads `composer-card:<card>`), the conditional draw stays the workspace's (never the
 *       headless fullscreen viewer) and reaches the hand; the server: −5 M€, +1 microbe, +1 card. A science target
 *       (Olympus Conference): +1 science, no draw.
 *   B · `receive-board` — the LIVE PICK FROM THE FIELD (a printed microbe; an Ares tile's animal): the plate asks, A,
 *       and the answer is the BOARD's scene — the chosen card rises by the field (`.con-citypay__card`), its token is
 *       born on the board and lands on it, the card goes home; the draft's departure never plays (`.con-exit-reject`);
 *       the server's count. One holder (the printed data) asks nothing and plays the same scene.
 *   C · `receive-colony` — red trades with Titan: blue's owner bonus is a live pick; the token is born on the plate's
 *       source (`source`) and lands on the chosen candidate (`slot:<card>`), the card is carried home; the server's count.
 *
 * Waits are state-waits (the server's model, the scene's own roots); the flight ends are WITNESSED
 * (`transferWitness.ts` — `endsOverGlass` empty). 4K timing claims: `TM_E2E_GPU=1`, `--workers=1`.
 */
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, commitFocusedSpace, fetchPlayerModel, openActionFocus, openCardActions, openMandatoryAnnounce, press,
  pressUntil, settle, walkToSpace,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';

const PROFILES = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  thisPlayer: {megacredits: number, cardsInHandNbr?: number, tableau: Array<{name: string, resources?: number}>},
  cardsInHand?: Array<{name: string}>,
  waitingFor?: {type?: string, options?: Array<{title?: string | {message?: string}}>},
};

async function serverModel(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

function resourcesOn(model: Wire, card: string): number {
  return model.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;
}

function handSize(model: Wire): number {
  return model.cardsInHand?.length ?? model.thisPlayer.cardsInHandNbr ?? 0;
}

/** Poll the SERVER until `ok` holds (the press is answered) — never a fixed sleep. */
async function untilServer(request: APIRequestContext, playerId: string, ok: (m: Wire) => boolean, what: string): Promise<Wire> {
  let last: Wire | undefined;
  for (let i = 0; i < 120; i++) {
    last = await serverModel(request, playerId);
    if (ok(last)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the server never reached «${what}» — last: ${JSON.stringify(last?.thisPlayer.tableau.map((c) => [c.name, c.resources]))}`);
}

/** A sampler (task clock, never rAF): did a draft departure / a headless viewer / the field's receiving card ever paint? */
async function armSceneProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__frl: {reject: number, headless: number, citypay: Array<string>, samples: number, trail: Array<string>}};
    w.__frl = {reject: 0, headless: 0, citypay: [], samples: 0, trail: []};
    const t0 = performance.now();
    let last = '';
    const sample = () => {
      w.__frl.samples++;
      // THE TRAIL — what stood, line by line on change: a red names the state it timed out in.
      const ready = (window as unknown as {__conReady?: () => {
        holds?: Array<string>,
        actionCommitRail?: {phase: string, link: number, lastEnd: string, capsules: Array<string>, fallback: string},
      }}).__conReady?.() ?? {};
      const rail = ready.actionCommitRail;
      const line = `host=${document.querySelector('.con-task-host') === null ? 0 : 1} ` +
        `pay=${document.querySelector('.con-citypay')?.getAttribute('data-city-payout') ?? '-'} ` +
        `rail=${rail === undefined ? '-' : `${rail.phase}:${rail.link}:${rail.lastEnd}:${rail.capsules.join('+')}:${rail.fallback}`} ` +
        `rows=${Array.from(document.querySelectorAll('.con-cardactions .con-composer [data-composer-card]')).map((e) => e.getAttribute('data-composer-card')).join('+')} ` +
        `zone=${document.querySelector('.con-cardactions [data-embed-slot="workspace-reveal"]') === null ? 0 : 1} ` +
        `holds=${(ready.holds ?? []).join(',')}`;
      if (line !== last) {
        w.__frl.trail.push(`${Math.round(performance.now() - t0)} ${line}`);
        last = line;
      }
      if (document.querySelector('.con-exit-reject') !== null) {
        w.__frl.reject++;
      }
      // The headless fullscreen viewer of a drawn card — a draw that escaped its workspace: the zoom with its
      // «ПОЛУЧЕННАЯ КАРТА» pill (the overlay's own `--headless` root paints nothing — it may stand a gap frame while
      // the claimed batch waits for its zone).
      if (document.querySelector('.con-zoom .con-zoom__status--received') !== null) {
        w.__frl.headless++;
      }
      const card = document.querySelector<HTMLElement>('.con-citypay__card[data-played-key]');
      const key = card?.getAttribute('data-played-key') ?? '';
      if (key !== '' && !w.__frl.citypay.includes(key)) {
        w.__frl.citypay.push(key);
      }
    };
    window.setInterval(sample, 20);
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true});
  });
}

type SceneProbe = {reject: number, headless: number, citypay: Array<string>, samples: number, trail: Array<string>};

async function sceneProbe(page: Page): Promise<SceneProbe> {
  return page.evaluate(() => (window as unknown as {__frl: SceneProbe}).__frl);
}

/** The probe's trail as one message (the last lines — a red names what stood). */
async function trailOf(page: Page): Promise<string> {
  const probe = await sceneProbe(page).catch(() => undefined);
  return (probe?.trail ?? []).slice(-24).join(' | ');
}

/** LT wheel → the plants conversion (the LEFT slot of the basic actions; the direction press IS the activation), then the cell. */
async function convertPlantsAt(page: Page, spaceId: string): Promise<void> {
  const placing = page.locator('.con-context__task-kicker');
  await pressUntil(page, 'Comma', async () => await page.locator('.con-quick').count() > 0, {tries: 4, settleMs: 1300});
  await pressUntil(page, 'ArrowLeft', async () => await placing.count() > 0, {tries: 3, settleMs: 2400});
  await expect(placing, 'the greenery placement stands').toHaveCount(1, {timeout: 15_000});
  await walkToSpace(page, spaceId);
  expect(await commitFocusedSpace(page, 0), `the greenery landed on ${spaceId}`).toBe(true);
}

/** The fixture's dressed cells, read off the server's board (the generator logs them; the board is the truth). */
async function receiveCells(request: APIRequestContext, playerId: string): Promise<{microbe: string, data: string}> {
  const res = await request.get(`/api/player?id=${playerId}`);
  const model = await res.json() as {game: {spaces: Array<{id: string, bonus: Array<SpaceBonus>, tileType?: number}>}};
  const free = (b: SpaceBonus) => model.game.spaces.find((s) => s.tileType === undefined && s.bonus.length === 1 && s.bonus[0] === b)?.id;
  const microbe = free(SpaceBonus.MICROBE);
  const data = free(SpaceBonus.DATA);
  expect(microbe, 'the printed-microbe cell').toBeDefined();
  expect(data, 'the printed-data cell').toBeDefined();
  return {microbe: microbe ?? '', data: data ?? ''};
}

for (const profile of PROFILES) {
  test.describe(`TR53 Frontier Labs · ${profile.id}`, () => {
    test.use({viewport: profile.viewport});

    /** Into the action composer of TR53 and its target step. */
    async function openTargetStep(page: Page): Promise<void> {
      await openCardActions(page);
      const focusedTile = () => page.evaluate(() => document.querySelector('.con-cardactions__tile--focused')?.getAttribute('data-action-card') ?? '');
      const moves = ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowDown'];
      for (let i = 0; i < 24 && await focusedTile() !== 'Frontier Labs'; i++) {
        await press(page, moves[i % moves.length], 260);
      }
      expect(await focusedTile(), 'the browse grid focuses TR53').toBe('Frontier Labs');
      await openActionFocus(page);
      await settle(page);
      const step = page.locator('.con-cardactions .con-ptsel');
      await pressUntil(page, 'Enter', async () => await step.count() > 0, {tries: 6, settleMs: 700});
      await expect(step, 'the target step stands').toHaveCount(1);
    }

    function cellOf(page: Page, card: string) {
      return page.locator(`.con-cardactions .con-ptsel__cell:has(.con-ptsel__slot[data-zoom-slot*="${card}"])`);
    }

    /** Walk the step's cursor onto a candidate and choose it, then onto the commit. */
    async function chooseAndCommit(page: Page, card: string): Promise<void> {
      const focused = () => page.evaluate(() => document.querySelector('.con-cardactions .con-ptsel__slot--focused')?.getAttribute('data-zoom-slot') ?? '');
      for (const key of ['ArrowLeft', 'ArrowRight']) {
        for (let i = 0; i < 6 && !(await focused()).includes(card); i++) {
          await press(page, key, 260);
        }
      }
      expect(await focused(), `the cursor stands on ${card}`).toContain(card);
      await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions .con-ptsel').count() === 0, {tries: 3, settleMs: 800});
      const cta = page.locator('.con-cardactions .con-composer__cta--focused');
      for (let i = 0; i < 8 && await cta.count() === 0; i++) {
        await press(page, 'ArrowDown', 250);
      }
      await expect(cta, 'the commit is focused').toHaveCount(1);
    }

    test(`A · the action: tails, the near miss, the unit on the chosen card, the draw in the workspace (${profile.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'frontier-labs', {query: profile.query});
      await settle(page);
      const before = await serverModel(request, playerId);
      await openTargetStep(page);

      // THE TAILS (rule 6 / 13): the server's per-candidate «what else», read by looking.
      await expect(cellOf(page, 'Tardigrades').locator('[data-ptsel-extra="cards"]'), 'a microbe holder also draws').toHaveCount(1);
      await expect(cellOf(page, 'Olympus Conference').locator('[data-ptsel-extra="none"]'), 'a science holder draws nothing — said').toHaveCount(1);
      // THE NEAR MISS (rule 4): Pets holds none — shown, disabled, «0 / 1», never hidden.
      const pets = page.locator('.con-cardactions .con-ptsel__slot[data-ptsel-blocked="1"][data-zoom-slot*="Pets"]');
      await expect(pets, 'Pets stands as a near miss').toHaveCount(1);
      await expect(pets.locator('.con-ptsel__blocked-num')).toHaveText(/0\s*\/\s*1/);

      await chooseAndCommit(page, 'Tardigrades');
      await armTransferWitness(page);
      await armSceneProbe(page);
      await press(page, 'Enter', 300);
      const after = await untilServer(request, playerId,
        (m) => resourcesOn(m, 'Tardigrades') === resourcesOn(before, 'Tardigrades') + 1, 'Tardigrades +1');
      expect(after.thisPlayer.megacredits, 'the price').toBe(before.thisPlayer.megacredits - 5);
      expect(handSize(after), 'a microbe target draws a card').toBe(handSize(before) + 1);
      // THE DRAW THE CHOICE DECIDED IS THE WORKSPACE'S (PL-415): the drawn card stands embedded in «Действия карт»
      // («› ДОБОР КАРТ»), never the headless fullscreen viewer over the board; A takes it and the flow ends.
      const embedded = page.locator('.con-cardactions .con-reveal--embedded');
      await expect(embedded, 'the drawn card stands inside the workspace').toHaveCount(1, {timeout: 40_000});
      await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions').count() === 0, {tries: 4, settleMs: 2500});
      await expect(page.locator('.con-cardactions'), 'the flow ends').toHaveCount(0, {timeout: 40_000});
      await settle(page, {timeoutMs: 30_000});

      const witness = await transferWitness(page);
      const trail = transferTrail(witness);
      expect(endsOverGlass(witness), `no flight end over glass:\n${trail}`).toEqual([]);
      expect(witness.landings.some((e) => e.under === 'composer-card:Tardigrades'),
        `the unit lands on the chosen miniature:\n${trail}\n— scene: ${await trailOf(page)}`).toBe(true);
      const probe = await sceneProbe(page);
      expect(probe.samples, 'the scene sampler ran').toBeGreaterThan(5);
      expect(probe.headless, 'the drawn card never opened the headless fullscreen viewer').toBe(0);
    });

    test(`A · a science target: +1, no draw (${profile.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'frontier-labs', {query: profile.query});
      await settle(page);
      const before = await serverModel(request, playerId);
      await openTargetStep(page);
      await chooseAndCommit(page, 'Olympus Conference');
      await press(page, 'Enter', 300);
      const after = await untilServer(request, playerId,
        (m) => resourcesOn(m, 'Olympus Conference') === resourcesOn(before, 'Olympus Conference') + 1, 'Olympus +1');
      expect(after.thisPlayer.megacredits).toBe(before.thisPlayer.megacredits - 5);
      expect(handSize(after), 'science draws nothing').toBe(handSize(before));
      await expect(page.locator('.con-cardactions'), 'the flow ends').toHaveCount(0, {timeout: 40_000});
    });

    test(`B · the live pick from the field: the card rises by the field, the token lands on it (${profile.id})`, async ({page, request}) => {
      test.setTimeout(400_000);
      const {playerId} = await bootFixtureSeats(page, request, 'receive-board', {query: profile.query});
      await settle(page);
      const cells = await receiveCells(request, playerId);
      const before = await serverModel(request, playerId);

      // ONE HOLDER (the printed data — Martian Census alone): no question, the board's own scene.
      await armSceneProbe(page);
      await armTransferWitness(page);
      await convertPlantsAt(page, cells.data);
      await untilServer(request, playerId, (m) => resourcesOn(m, 'Martian Census') === resourcesOn(before, 'Martian Census') + 1, 'Census +1');
      await settle(page, {timeoutMs: 30_000});
      expect(await page.locator('.con-task-host').count(), 'one holder is no question').toBe(0);
      let probe = await sceneProbe(page);
      expect(probe.citypay, 'the census rose by the field').toContain('Martian Census');

      // TWO HOLDERS (the printed microbe — Tardigrades, Decomposers): the plate asks; the answer is the field's scene.
      await convertPlantsAt(page, cells.microbe);
      await page.locator('.con-task-host .con-cards__slot').first().waitFor({timeout: 30_000});
      await expect(page.locator('.con-task-host [data-zoom-slot="Decomposers"]'), 'the empty holder is a candidate').toHaveCount(1);
      const focused = () => page.evaluate(() => document.querySelector('.con-task-host .con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '');
      for (let i = 0; i < 4 && await focused() !== 'Decomposers'; i++) {
        await press(page, 'ArrowRight', 400);
      }
      expect(await focused()).toBe('Decomposers');
      await press(page, 'Enter', 300);
      await untilServer(request, playerId, (m) => resourcesOn(m, 'Decomposers') === resourcesOn(before, 'Decomposers') + 1, 'Decomposers +1');
      await expect(page.locator('.con-task-host'), 'the plate leaves').toHaveCount(0, {timeout: 30_000})
        .catch(async (e) => {
          throw new Error(`${String(e)} — trail: ${await trailOf(page)}`);
        });
      await settle(page, {timeoutMs: 30_000});

      probe = await sceneProbe(page);
      expect(probe.reject, 'the draft departure never plays on a target pick').toBe(0);
      expect(probe.citypay, 'the chosen card rose by the field').toContain('Decomposers');
      const witness = await transferWitness(page);
      const trail = transferTrail(witness);
      expect(endsOverGlass(witness), `no flight end over glass:\n${trail}`).toEqual([]);
      for (const card of ['Martian Census', 'Decomposers']) {
        expect(witness.landings.some((e) => e.under === `recv:${card}`), `a unit landed on ${card} by the field:\n${trail}`).toBe(true);
      }
    });

    test(`C · a foreign trade's colony bonus: the token from the plate's source onto the chosen card (${profile.id})`, async ({page, request}) => {
      test.setTimeout(400_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'receive-colony', {query: profile.query});
      await settle(page);
      const before = await serverModel(request, playerId);
      // Red trades with Titan over the API (red is on the move; blue's floater is the detached live pick).
      const red = await serverModel(request, seats[1]);
      const titleOf = (o: {title?: string | {message?: string}}) => typeof o.title === 'string' ? o.title : o.title?.message;
      const index = (red.waitingFor?.options ?? []).findIndex((o) => titleOf(o) === 'Trade with a colony tile');
      expect(index, 'red can trade').toBeGreaterThanOrEqual(0);
      const post = await request.post(`/player/input?id=${seats[1]}`, {data: {
        type: 'or', index,
        response: {type: 'and', responses: [{type: 'or', index: 0, response: {type: 'option'}}, {type: 'colony', colonyName: 'Titan'}]},
      }});
      expect(post.ok(), `the trade was accepted (${post.status()})`).toBeTruthy();
      if (await page.locator('.con-task-host .con-cards__slot').count() === 0) {
        await openMandatoryAnnounce(page);
      }
      await page.locator('.con-task-host .con-cards__slot').first().waitFor({timeout: 40_000});
      await settle(page, {timeoutMs: 20_000});
      await armSceneProbe(page);
      await armTransferWitness(page);
      const focused = await page.evaluate(() => document.querySelector('.con-task-host .con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '');
      expect(focused, 'a floater holder is focused').not.toBe('');
      await press(page, 'Enter', 300);
      await untilServer(request, playerId, (m) => resourcesOn(m, focused) === resourcesOn(before, focused) + 1, `${focused} +1`);
      await expect(page.locator('.con-task-host'), 'the plate leaves').toHaveCount(0, {timeout: 30_000});
      await settle(page, {timeoutMs: 30_000});

      const probe = await sceneProbe(page);
      expect(probe.reject, 'the draft departure never plays on a target pick').toBe(0);
      const witness = await transferWitness(page);
      const trail = transferTrail(witness);
      expect(endsOverGlass(witness), `no flight end over glass:\n${trail}`).toEqual([]);
      expect(witness.births.some((e) => e.under === 'source'), `the token is born on the plate's source:\n${trail}`).toBe(true);
      expect(witness.landings.some((e) => e.under === `slot:${focused}`), `the token lands on ${focused}:\n${trail}`).toBe(true);
    });
  });
}
