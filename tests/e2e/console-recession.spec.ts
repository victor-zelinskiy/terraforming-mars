import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, openConsole, playCardFromHand, press, settle, walkFocusUntil} from './consoleStart';
import {armTransferWitness, transferTrail, transferWitness} from './transferWitness';

/**
 * P59 RECESSION — the forty-first Prelude 2 card, the series' first CROSS-PLAYER one (ledgers FU / FV): «EACH OPPONENT
 * loses 5 M€ and their M€ production decreases 1 step. You gain 10 M€.» The JOURNEY on the WG road (the two-seat table:
 * blue Thorgate, red Teractor with 30 M€); the rules are pinned by `tests/cards/prelude2/Recession.spec.ts`, the victim's
 * one card by `crossPlayerDeliveryAudit` S24, the readings by `tests/client/console/recessionTableImpact.spec.ts`.
 *
 *   (B) WG Project deals Recession: the pick's status rail SHOWS the victim before the press — red's seat with «30 → 25»
 *       and «1 → 0» (invariant 3); A plays it: +10 born on the PRINTED «10» and landing on the rail (`rail:megacredits`);
 *       on RED's screen (a second client, open BEFORE the play) exactly ONE hostile card, final from its first painted
 *       frame (Recession's name, blue as the attacker), red's rail −5; a reload of red's screen raises no twin;
 *   (C) red holds Private Security: red's row names the spared production («✕ … Производство защищено»), red keeps 1;
 *   (D) red at the −5 floor: the card burns, and the rail NAMES why — red's seat dot + «производство M€ уже −5» (FV).
 *
 * Storyboard: `TM_E2E_STORYBOARD=1` → screenshots/p59/tv4k/story-*.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p59', PRESET.id);
const CARD = 'Recession';
const PICK = '.con-hand__outcome .con-deckpick--play';
const RAIL = '.con-deckpick .con-cards__verdict-inner';

type Wire = {
  thisPlayer: {megacredits: number, megacreditProduction: number, tableau: Array<{name: string}>},
  players: Array<{color: string, megacredits: number, megacreditProduction: number}>,
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

/** Poll the SERVER until `ok` holds — never a fixed sleep. */
async function untilServer(request: APIRequestContext, id: string, ok: (m: Wire) => boolean, what: string): Promise<Wire> {
  let last: Wire | undefined;
  for (let i = 0; i < 200; i++) {
    last = await wireOf(request, id);
    if (ok(last)) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the server never reached: ${what} (last: ${JSON.stringify(last?.thisPlayer)})`);
}

/** Open WG Project's prelude pick and walk the cursor onto Recession. */
async function focusRecessionInPick(page: Page): Promise<void> {
  expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
  await expect(page.locator(`${PICK}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
  const focused = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
  expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 12), `focused ${CARD}`).toBeTruthy();
}

/** The victims' line as painted on the pick's rail. */
const railImpact = (page: Page) => page.evaluate((sel) => {
  const block = document.querySelector<HTMLElement>(`${sel} [data-table-impact]`);
  const seats = Array.from(block?.querySelectorAll<HTMLElement>('[data-table-impact-seat]') ?? []).map((s) => ({
    seat: s.getAttribute('data-table-impact-seat') ?? '',
    rows: Array.from(s.querySelectorAll<HTMLElement>('.con-impact-row')).map((r) => `${r.getAttribute('data-impact-scope')}:${r.querySelector('.con-impact-row__num')?.textContent?.trim()}`),
    spared: s.querySelector('[data-table-impact-spared]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  }));
  const r = block?.getBoundingClientRect();
  return {painted: block !== null && block !== undefined && (r?.width ?? 0) > 0 && getComputedStyle(block).visibility !== 'hidden', seats};
}, RAIL);

type NotifSample = {id: string, at: number, negative: boolean, card: string, actor: boolean, text: string};
/** From BEFORE the foreign play: every painted notification card's first frame (atomicity — no late hero). */
async function armNotifAuditor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__p59notif: Array<{id: string, at: number, negative: boolean, card: string, actor: boolean, text: string}>};
    w.__p59notif = [];
    const t0 = performance.now();
    const seen = new Set<string>();
    const read = () => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-notif'))) {
        const id = el.getAttribute('data-notif-id') ?? '';
        const r = el.getBoundingClientRect();
        if (seen.has(id) || r.width === 0 || getComputedStyle(el).visibility === 'hidden') {
          continue;
        }
        seen.add(id);
        w.__p59notif.push({
          id,
          at: Math.round(performance.now() - t0),
          negative: el.classList.contains('con-notif--sign-negative'),
          card: el.querySelector('[data-notif-type-card]')?.textContent?.trim() ?? '',
          actor: el.querySelector('[data-notif-actor]') !== null,
          text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        });
      }
    };
    read();
    new MutationObserver(read).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(read, 40);
  });
}
const notifSamples = (page: Page): Promise<Array<NotifSample>> =>
  page.evaluate(() => (window as unknown as {__p59notif: Array<NotifSample>}).__p59notif);

test.describe(`P59 Recession · every opponent hit, SEEN before the press · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('(B) the WG road: the victim on the rail before the press; +10 off the printed «10»; red hears ONE hostile card; a reload raises no twin', async ({page, request, context}) => {
    test.setTimeout(480_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'recession-wg', {query: PRESET.query});
    const red = seats[1];
    await settle(page);

    // THE VICTIM'S SCREEN — open BEFORE the play, so its feed hears the foreign action as it happens.
    const redPage = await context.newPage();
    await redPage.setViewportSize(PRESET.viewport);
    await openConsole(redPage, red, PRESET.query);
    await settle(redPage, {timeoutMs: 30_000});
    await armNotifAuditor(redPage);
    const redBefore = await wireOf(request, red);
    expect(redBefore.thisPlayer.megacredits).toBe(30);
    expect(redBefore.thisPlayer.megacreditProduction).toBe(1);
    await page.bringToFront();

    await focusRecessionInPick(page);
    await expect.poll(async () => (await railImpact(page)).painted, {message: 'the victims line stands on the pick\'s rail', timeout: 20_000}).toBe(true);
    const impact = await railImpact(page);
    expect(impact.seats, 'red — the only opponent — with both scopes, the server\'s numbers').toEqual([
      {seat: 'red', rows: ['stock:30 → 25', 'production:1 → 0'], spared: ''},
    ]);
    await shoot(page, 'B-01-pick-victims');

    const stop = await storyboard(page, 'B-play');
    await armTransferWitness(page);
    await press(page, 'Enter', 400);
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    for (let i = 0; i < 3 && !(await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === CARD); i++) {
      await press(page, 'Period', 1500);
    }
    const after = await untilServer(request, playerId, (m) => m.thisPlayer.tableau.some((c) => c.name === CARD), 'Recession on the table');
    expect(after.thisPlayer.megacredits, '20 − 9 (WG Project) + 10').toBe(21);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await stop();
    const w = await transferWitness(page);
    const trail = transferTrail(w);
    const births = w.births.filter((b) => b.value === '+10');
    expect(births.length, `the +10 flew (trail:
${trail})`).toBeGreaterThan(0);
    for (const b of births) {
      // On the WG road the played prelude stands on the deck object's «РАЗЫГРАНО» seat — the witness names that anchor.
      expect(b.under, `born on the played card (its printed icon / the deck's seat it stands on) (trail:
${trail})`).toMatch(/^printed:|^prelude-seat$/);
      expect(w.landings.find((l) => l.id === b.id)?.under, `landed on the rail (trail:
${trail})`).toBe('rail:megacredits');
    }
    // Which printed M€ tile: the nearest one on the seated card must read «10» — never the «−5» or the production «−1».
    const nearest = await page.evaluate(({x, y}) => {
      const tiles = Array.from(document.querySelectorAll<HTMLElement>('[data-prelude-played-seat] .pcard-mi--mc'));
      let best: {text: string, d: number} | undefined;
      for (const t of tiles) {
        const r = t.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
        if (best === undefined || d < best.d) {
          best = {text: (t.textContent ?? '').trim(), d};
        }
      }
      return best;
    }, {x: births[0].x, y: births[0].y});
    if (nearest !== undefined) {
      expect(nearest.text, `the +10 was born on the printed «10» (trail:
${trail})`).toBe('10');
    } else {
      test.info().annotations.push({type: 'note', description: 'the seated card left before the read — the tile choice rests on the unit spec'});
    }
    await shoot(page, 'B-02-blue-after');

    // RED: −5 M€ and −1 production; ONE hostile card, its first painted frame already final.
    const redAfter = await untilServer(request, red, (m) => m.thisPlayer.megacredits === 25, 'red at 25 M€');
    expect(redAfter.thisPlayer.megacreditProduction, 'red production 1 → 0').toBe(0);
    await redPage.bringToFront();
    await expect.poll(async () => (await notifSamples(redPage)).filter((s) => s.negative).length,
      {message: 'red\'s hostile card arrives', timeout: 40_000}).toBeGreaterThan(0);
    await settle(redPage, {timeoutMs: 20_000}).catch(() => undefined);
    const hostile = (await notifSamples(redPage)).filter((s) => s.negative);
    expect(hostile.length, `exactly ONE hostile card (samples: ${JSON.stringify(hostile)})`).toBe(1);
    expect(hostile[0].actor, 'the attacker named from the first frame').toBe(true);
    expect(hostile[0].text, 'the card names Recession from its first frame').toMatch(/Рецессия/);
    await shoot(redPage, 'B-03-red-card');

    // A RELOAD of the victim's screen raises no twin (the seen-set holds).
    await redPage.reload();
    await redPage.waitForSelector('.con-root', {timeout: 90_000});
    await settle(redPage, {timeoutMs: 30_000});
    await armNotifAuditor(redPage);
    await settle(redPage, {timeoutMs: 10_000}).catch(() => undefined);
    expect((await notifSamples(redPage)).filter((s) => s.negative && /Рецессия/.test(s.text)), 'no twin after a reload').toHaveLength(0);
  });

  test('(C) Private Security: red\'s row names the spared production; the M€ still go', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'recession-wg-protected', {query: PRESET.query});
    await settle(page);
    await focusRecessionInPick(page);
    await expect.poll(async () => (await railImpact(page)).painted, {message: 'the victims line stands on the pick\'s rail', timeout: 20_000}).toBe(true);
    const impact = await railImpact(page);
    expect(impact.seats.map((s) => s.rows), 'the M€ only — the production is spared').toEqual([['stock:30 → 25']]);
    expect(impact.seats[0].spared, 'the spared step NAMED with its reason').toMatch(/Производство защищено/);
    await shoot(page, 'C-01-protected');
    await press(page, 'Enter', 400);
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    for (let i = 0; i < 3 && !(await wireOf(request, playerId)).thisPlayer.tableau.some((c) => c.name === CARD); i++) {
      await press(page, 'Period', 1500);
    }
    await untilServer(request, playerId, (m) => m.thisPlayer.tableau.some((c) => c.name === CARD), 'Recession on the table');
    const red = await untilServer(request, seats[1], (m) => m.thisPlayer.megacredits === 25, 'red at 25 M€');
    expect(red.thisPlayer.megacreditProduction, 'Private Security kept red\'s production').toBe(1);
  });

  test('(D) red at the −5 floor: the card burns, and the rail NAMES why — red\'s seat and its reason (FV)', async ({page, request}) => {
    test.setTimeout(300_000);
    await bootFixtureSeats(page, request, 'recession-wg-floor', {query: PRESET.query});
    await settle(page);
    await focusRecessionInPick(page);
    await expect(page.locator(`.con-deckpick [data-deckpick-slot="${CARD}"] [data-prelude-burns]`), 'the burn mark on the face').toHaveCount(1);
    const why = page.locator(`${RAIL} [data-prelude-burn-reason]`);
    await expect(why, 'a burn names its cause').toHaveCount(1, {timeout: 20_000});
    await expect(why).toContainText('производство M€ уже −5');
    await expect(why.locator('.player_bg_color_red'), 'the seat\'s dot — structural, never a parsed name').toHaveCount(1);
    await expect(page.locator(`${RAIL} [data-table-impact]`), 'a burn hits nobody — no victims line').toHaveCount(0);
    await shoot(page, 'D-01-floor-reason');
  });
});
