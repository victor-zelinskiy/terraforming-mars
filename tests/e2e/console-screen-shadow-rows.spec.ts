import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, openMandatoryAnnounce} from './consoleStart';

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
