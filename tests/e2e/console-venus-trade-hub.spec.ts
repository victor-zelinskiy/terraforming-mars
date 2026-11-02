import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, fetchPlayerModel, press, pressUntil, settle} from './consoleStart';
import {openColoniesSection} from './cardTradeDoor';
import {focusDockCard} from './fleetDockDriver';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * P90 «ВЕНЕРИАНСКИЙ ТОРГОВЫЙ УЗЕЛ» — the TWENTY-FOURTH Prelude 2 card: «when you trade, gain 3 M€». The effect is the
 * CARD's hook (`onTrade`), fired under the card's own `'trade'` effect scope — so the card-reaction framework plays it:
 *   A · a COLONY trade (Luna): «⚡ сработает» names the card BEFORE the press; X → ONE POST; Luna's income lands, then
 *       the card RISES (at the rail's edge — the table is not open), 3 M€ are born on ITS printed effect
 *       (`reactor:Venus Trade Hub:…`) and land on the M€ row; the server holds the card's `'trade'` record.
 *   B · a DOCK trade (UNMI Liner — +1 TR on the rail): the same hook on the other door — the source is the CARD.
 * Fixture: tests/e2e/fixtures/generate.ts § P90 (the dry run proves the record). TIMING class (`timingSpecs.ts`): the
 * births are sampled motion — `--exclusive --workers=1` on the box. Storyboard: `TM_E2E_STORYBOARD=1`.
 */

const CARD = 'Venus Trade Hub';
const LINER = 'UNMI Liner';
const OUT = path.resolve('screenshots', 'p90');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type Wire = {
  thisPlayer: {megacredits: number, energy: number, terraformRating: number},
  game: {cardReactions?: Array<{card: string, channel: string, owner: string, seq: number}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const hubRecords = (wire: Wire) => (wire.game.cardReactions ?? []).filter((r) => r.card === CARD && r.channel === 'trade');

async function shoot(page: Page, name: string): Promise<void> {
  const dir = path.join(OUT, PRESET.id);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, PRESET.id, `story-${name}`);
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

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** The reaction scene, sampled on a task clock (never rAF): which faces rose (seated at the stage / emerged in place). */
async function armReactionProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__p90: Array<string>};
    w.__p90 = [];
    window.setInterval(() => {
      const seated = Array.from(document.querySelectorAll('.con-reaction__face[data-reaction-card], .con-recv__emerge[data-played-key]'))
        .map((e) => e.getAttribute('data-reaction-card') ?? e.getAttribute('data-played-key') ?? '');
      for (const name of seated) {
        if (!w.__p90.includes(name)) {
          w.__p90.push(name);
        }
      }
    }, 16);
  });
}
async function risen(page: Page): Promise<Array<string>> {
  return page.evaluate(() => (window as unknown as {__p90?: Array<string>}).__p90 ?? []);
}

function writeTrail(name: string, trail: string): void {
  fs.mkdirSync(path.join(OUT, PRESET.id), {recursive: true});
  fs.writeFileSync(path.join(OUT, PRESET.id, `${name}-trail.txt`), trail + '\n');
  console.log(`[p90 ${name}] trail\n${trail}`);
}

test.describe(`console · P90 Venus Trade Hub · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A · a colony trade: named before the press, ONE POST, the card rises and pays 3 M€ off its printed effect', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const {playerId} = await bootFixtureSeats(page, request, 'venus-trade-hub', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    const posts = watchPosts(page);

    await openColoniesSection(page);
    await settle(page);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus').count() > 0, {tries: 3, settleMs: 2000}),
      'A opens Luna\'s focus stage').toBe(true);
    await settle(page);
    // THE PROMISE — the card is the table's answer, named before anything is sent.
    const door = page.locator('.con-colfocus [data-forecast-row]').first();
    await expect(door, '«⚡ сработает» stands on the trade').toBeVisible({timeout: 15_000});
    expect(((await door.textContent()) ?? '').replace(/\s+/g, ' '), 'the door carries the card\'s +3').toMatch(/3/);
    expect(posts, 'nothing sent to read it').toEqual([]);
    await shoot(page, 'a1-promise');

    await armTransferWitness(page);
    await armReactionProbe(page);
    const stop = await storyboard(page, 'colony');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'KeyX', 300);
      await expect.poll(() => posts.length, {timeout: 5_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the trade is ONE request').toBe(1);
    await expect.poll(() => page.locator('.con-ws').count(), {timeout: 60_000, message: 'the workspace left'}).toBe(0);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await cinematicBeat(page, 600, 'the board settles for the frame');
    await shoot(page, 'a2-traded');

    const witness = await transferWitness(page);
    writeTrail('a', transferTrail(witness));
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    const births = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}:`));
    expect(births.length, `the 3 M€ were born on the card's printed effect\n${transferTrail(witness)}`).toBeGreaterThan(0);
    const landings = witness.landings.filter((l) => births.some((b) => b.id === l.id));
    expect(landings.length > 0 && landings.every((l) => l.under === 'rail:megacredits'), `…and landed on the M€ row\n${transferTrail(witness)}`).toBe(true);
    expect(await risen(page), 'the card rose').toContain(CARD);

    const after = await wireOf(request, playerId);
    expect(hubRecords(after).length, 'the server recorded the card\'s answer on \'trade\'').toBeGreaterThan(hubRecords(before).length);
    test.info().annotations.push({type: 'p90-colony', description: JSON.stringify({mc: [before.thisPlayer.megacredits, after.thisPlayer.megacredits], energy: [before.thisPlayer.energy, after.thisPlayer.energy]})});
    expect(errors, 'no page errors').toEqual([]);
  });

  test('B · a dock trade (UNMI Liner): the same hook, the source is the CARD — it rises and pays on the M€ row', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const {playerId} = await bootFixtureSeats(page, request, 'venus-trade-hub-dock', {query: PRESET.query});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, playerId);
    const posts = watchPosts(page);

    await openColoniesSection(page);
    await settle(page);
    await focusDockCard(page, LINER);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-fleetdock').count() > 0, {tries: 3, settleMs: 2500}),
      'A opened the dock\'s stage').toBe(true);
    await settle(page, {timeoutMs: 15_000});
    await shoot(page, 'b1-dock-stage');

    await armTransferWitness(page);
    await armReactionProbe(page);
    const stop = await storyboard(page, 'dock');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'KeyX', 300);
      await expect.poll(() => posts.length, {timeout: 5_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the dock trade is ONE request').toBe(1);
    await expect.poll(() => page.locator('.con-ws').count(), {timeout: 60_000, message: 'the workspace left'}).toBe(0);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await shoot(page, 'b2-docked');

    const witness = await transferWitness(page);
    writeTrail('b', transferTrail(witness));
    // The flights' own trail (the rail seed's verdict, the reaction seeder's attached / standalone, the answer) — a red
    // here names WHICH reactor took which token.
    const diag = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady?: () => {transfer?: unknown}}).__conReady?.()?.transfer ?? null));
    console.log(`[p90 b] transfer\n${diag}`);
    expect(endsOverGlass(witness), `every end visible\n${transferTrail(witness)}`).toEqual([]);
    const births = witness.births.filter((b) => b.under.startsWith(`reactor:${CARD}:`));
    expect(births.length, `the dock's trade woke the card — born on its printed effect\n${transferTrail(witness)}`).toBeGreaterThan(0);
    expect(await risen(page), 'the card rose').toContain(CARD);
    const after = await wireOf(request, playerId);
    expect(hubRecords(after).length, 'the server recorded the card\'s answer').toBeGreaterThan(hubRecords(before).length);
    expect(errors, 'no page errors').toEqual([]);
  });
});
