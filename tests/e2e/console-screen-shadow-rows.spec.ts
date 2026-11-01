import {test, expect, Page, APIRequestContext} from './consoleTest';
import {NO_PAYMENT, bootFixtureSeats, fetchPlayerModel, openMandatoryAnnounce, reloadConsole} from './consoleStart';

/**
 * THE SCREEN DIRECTOR'S UNVERIFIED ROWS (step 1 of `docs/claude/console/screen-director.md`): a row of
 * `expectedScreenOwners` the whole suite never judged is a row nobody has proved. Each stand here puts its prompt kind
 * LIVE on the real build and reads the shadow's own record (`window.__conScreenShadow()`): the question is judged, it
 * agrees with the owner the table names, and nothing is filed.
 *
 * `colonyBonus` — a colony bonus ANOTHER seat's trade paid the viewer (Miranda's «draw 1 card», a detached delivery):
 * announced (the announce gate holds it — a named wait with NOTHING under it), and the door that opens it IS the answer
 * (the collect), after which the colonies present the payout with no question standing. The other three rows the first map left unjudged are not reachable as a live prompt in the console's scope
 * today — the report names them with the reason (`scripts/screen-shadow-report.mjs` `KNOWN_UNREACHABLE`).
 *
 * Functional class: state reads off the shadow's record, never a frame.
 */

const TV = {width: 3840, height: 2160};
const QUERY = '&consoleProfile=tv';

type Readout = {
  findings: Array<{kind: string, prompt: string}>,
  stats: {owners: Record<string, Record<string, number>>, masked: Record<string, Record<string, number>>, shapes: Record<string, number>},
};

async function readout(page: Page): Promise<Readout> {
  return page.evaluate(() => (window as unknown as {__conScreenShadow: () => Readout}).__conScreenShadow());
}

/** Red trades with Miranda over the API: the action menu's trade option, paid in M€, the colony named. */
async function tradeAs(request: APIRequestContext, seat: string, colony: string): Promise<void> {
  const res = await request.get(`/api/player?id=${seat}`);
  expect(res.ok(), 'the opponent\'s model').toBeTruthy();
  const model = await res.json() as {waitingFor?: {options?: Array<{title?: string | {message?: string}}>}};
  const options = model.waitingFor?.options ?? [];
  const titleOf = (o: {title?: string | {message?: string}}) => typeof o.title === 'string' ? o.title : o.title?.message;
  const index = options.findIndex((o) => titleOf(o) === 'Trade with a colony tile');
  expect(index, `the opponent can trade (${options.map(titleOf).join(' · ')})`).toBeGreaterThanOrEqual(0);
  const post = await request.post(`/player/input?id=${seat}`, {data: {
    type: 'or', index,
    response: {type: 'and', responses: [{type: 'or', index: 0, response: {type: 'option'}}, {type: 'colony', colonyName: colony}]},
  }});
  expect(post.ok(), `the opponent's trade was accepted (${post.status()} ${await post.text().catch(() => '')})`).toBeTruthy();
}

test.describe('the screen director — the rows the first map never judged', () => {
  test.use({viewport: TV});

  test('colonyBonus — another seat\'s trade pays the viewer: held by the announce with nothing under it, the door its answer', async ({page, request}) => {
    test.setTimeout(240_000);
    const {seats} = await bootFixtureSeats(page, request, 'miranda-remote-bonus', {query: QUERY});
    await tradeAs(request, seats[1], 'Miranda');

    // The delivery is ANNOUNCED — judged, held by the gate, with NOTHING under it (the announce is its surface).
    await expect.poll(async () => (await readout(page)).stats.shapes.colonyBonus ?? 0,
      {timeout: 30_000, message: 'the shadow judges the remote colony bonus'}).toBeGreaterThan(0);
    const announced = await readout(page);
    expect(announced.stats.masked.colonyBonus, 'held by the announce gate, nothing under it')
      .toEqual({'held:announce-gate | nothing': announced.stats.shapes.colonyBonus});

    // THE DOOR IS THE ANSWER: opening the announce collects the card (the server's `SelectOption`), the colonies'
    // stage then presents the PAYOUT with no question standing — the row's live window is the announce alone.
    expect(await openMandatoryAnnounce(page), 'the colony bonus was announced').toBeTruthy();
    await expect.poll(async () => {
      const model = await fetchPlayerModel(request, seats[0]) as {waitingFor?: {colonyBonusPrompt?: unknown}};
      return model.waitingFor?.colonyBonusPrompt === undefined;
    }, {timeout: 30_000, message: 'opening the announce answered the collect'}).toBeTruthy();
    await expect(page.locator('.con-colonies'), 'the colonies present the payout').toBeVisible({timeout: 30_000});

    const r = await readout(page);
    console.log('[rows] colonyBonus readout', JSON.stringify(r));
    expect(r.findings, 'the row agrees — nothing filed').toEqual([]);
    for (const key of Object.keys(r.stats.masked.colonyBonus ?? {})) {
      expect(key, 'a wait hid nothing (no foreign surface under it)').toMatch(/\| nothing$/);
    }
  });
});

/** The index of the action menu's option titled `title` on `seat` (a server-set English title — a test may read it). */
async function menuIndex(request: APIRequestContext, seat: string, title: string): Promise<number> {
  const model = await fetchPlayerModel(request, seat) as {waitingFor?: {options?: Array<{title?: string | {message?: string}}>}};
  const options = model.waitingFor?.options ?? [];
  const titleOf = (o: {title?: string | {message?: string}}) => typeof o.title === 'string' ? o.title : o.title?.message;
  const index = options.findIndex((o) => titleOf(o) === title);
  expect(index, `«${title}» on the menu (${options.map(titleOf).join(' · ')})`).toBeGreaterThanOrEqual(0);
  return index;
}

async function answer(request: APIRequestContext, seat: string, body: unknown): Promise<void> {
  const post = await request.post(`/player/input?id=${seat}`, {data: body});
  expect(post.ok(), `the answer was accepted (${post.status()} ${await post.text().catch(() => '')})`).toBeTruthy();
}

/**
 * A shape LIVE on the screen, read off the shadow: judged, served (agree passes — opened through the announce when
 * the console announces it), and nothing filed. Returns the readout for the caller's own reading of WHO served.
 */
async function servedLive(page: Page, shape: string): Promise<Readout> {
  await expect.poll(async () => (await readout(page)).stats.shapes[shape] ?? 0,
    {timeout: 30_000, message: `the shadow judges «${shape}» live`}).toBeGreaterThan(0);
  if (await page.locator('.con-mandatory').isVisible().catch(() => false)) {
    await openMandatoryAnnounce(page);
  }
  const agreed = (r: Readout) => Object.values(r.stats.owners[shape] ?? {}).reduce((n, c) => n + c, 0);
  const served = await expect.poll(async () => agreed(await readout(page)), {timeout: 30_000}).toBeGreaterThan(1)
    .then(() => true, () => false);
  const r = await readout(page);
  console.log(`[rows] ${shape} readout`, JSON.stringify(r));
  expect(r.findings, `«${shape}» agrees — nothing filed`).toEqual([]);
  expect(served, `«${shape}» is served (${JSON.stringify(r.stats.owners[shape] ?? {})} · hid ${JSON.stringify(r.stats.masked[shape] ?? {})})`).toBeTruthy();
  return r;
}

/*
 * THE SHAPES THE COMPOSERS PRE-COLLECT (`UNOBSERVED_SHAPES` until these stands): the console meets them LIVE only when
 * the answer did not ride a batch — a divergence, a reconnect. Each stand makes the move over the API (no batch), so the
 * server asks the shape on its own, then reloads the console onto it — the reconnect path — and reads who serves it.
 */
test.describe('the screen director — the shapes a composer pre-collects, met LIVE', () => {
  test.use({viewport: TV});

  test('player — Law Suit played with no batch: the live SelectPlayer is served', async ({page, request}) => {
    test.setTimeout(240_000);
    const {seats} = await bootFixtureSeats(page, request, 'law-suit-live', {query: QUERY});
    const index = await menuIndex(request, seats[0], 'Play project card');
    await answer(request, seats[0], {type: 'or', index, response: {type: 'projectCard', card: 'Law Suit', payment: {...NO_PAYMENT, megacredits: 2}}});
    await reloadConsole(page);
    await servedLive(page, 'player');
  });

  test('choice:espionage — Modular Floodgates\' blockade asked with no batch is served by its door', async ({page, request}) => {
    test.setTimeout(240_000);
    const {seats} = await bootFixtureSeats(page, request, 'floodgates-blockade-then-action', {query: QUERY});
    const index = await menuIndex(request, seats[0], 'Perform an action from a played card');
    await answer(request, seats[0], {type: 'or', index, response: {type: 'card', cards: ['Modular Floodgates']}});
    const or = await fetchPlayerModel(request, seats[0]) as {waitingFor?: {options?: Array<{title?: string | {message?: string}}>}};
    const deploy = (or.waitingFor?.options ?? []).findIndex((o) => (typeof o.title === 'string' ? o.title : o.title?.message) === 'Deploy a blockade on the Hydronetwork');
    expect(deploy, 'the blockade is offered').toBeGreaterThanOrEqual(0);
    await answer(request, seats[0], {type: 'or', index: deploy, response: {type: 'option'}});
    await reloadConsole(page);
    await servedLive(page, 'choice:espionage');
  });

  test('amount:delta — the Hydronetwork advance asked with no batch is served', async ({page, request}) => {
    test.setTimeout(240_000);
    const {seats} = await bootFixtureSeats(page, request, 'hydro-terminal', {query: QUERY});
    const index = await menuIndex(request, seats[0], 'Advance on the Hydronetwork track');
    await answer(request, seats[0], {type: 'or', index, response: {type: 'option'}});
    await reloadConsole(page);
    await servedLive(page, 'amount:delta');
  });
});
