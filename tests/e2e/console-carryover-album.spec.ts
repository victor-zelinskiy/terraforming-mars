import * as fs from 'fs';
import * as path from 'path';
import {expect, test, Page} from './consoleTest';
import {cinematicBeat, press} from './consoleStart';
import {campaignBase, campaignModelAs, createCampaign, devCommit, launchMission, openMapAs} from './campaignFixtures';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * The «ДВЕРЬ» iteration's NEW copy (§19), read in either language: the box's locale bundle is ONE shared copy every
 * session syncs (`~/tm-e2e/repo/assets`), and a session on an older base re-sends its own bundle without these keys —
 * the behaviour is witnessed by the hooks; the RU wording is the i18n audit's (`lint:i18n`) and stands in the locale.
 */
const NEW_COPY = {
  canExecute: /можно исполнить|can execute/i,
  preludeStep: /шаге прологов|prelude step/i,
  projectStep: /шаге проектов|project step/i,
  executeTender: /исполнить тендер|execute the tender/i,
};

/**
 * «НАСЛЕДИЕ ПРОЕКТОВ» ON THE HAND ALBUM'S CHASSIS (P87 — the owner, 2026-11-01: «сделан как будто на отдельном движке,
 * слабая подача, плохо на большом количестве карт, ставить назад неудобно — надо нажимать на пустую ячейку; лимит —
 * переменная игрока»). On the standalone map (the campaign screen), at 4K:
 *   A — a 14-card terminal hand, the seat limit 2: the hand ARRIVES from the viewer's seat row (a deal, the slots held
 *       until each touchdown), strict pages (10 + 4) with the spine «1 / 2» in the foot, RB / LB turn the page, A keeps a
 *       card IN PLACE (its kant + band, the manifest names it — readable from the other page), A on a third card is a
 *       NAMED refusal (nothing dims), A on a kept card returns it (the next one moves up a seat), X inspects from the
 *       slot, RT is ONE POST in seat order → the kept cards fly into the next mission's card (it answers the touch), the
 *       ready strip; Y opens the stage with both cards already in their kant — no deal;
 *   B — the seat limit 3 (the dev fixture's per-seat limit): three seats, three keeps, the fourth refused;
 *   D — an empty hand: no album, RT once = readiness.
 * The embedded host (the endgame's map scene) mounts the SAME component — its markup is pinned by the unit guard
 * (`albumChassisParity`, `consoleCarryoverPicker.spec`); its live walk rides `console-campaign-endgame`.
 */

const HAND = [
  'Ants', 'Algae', 'Birds', 'Fish', 'Pets', 'Lichen', 'Mangrove', 'Trees', 'Heather', 'Kelp Farming',
  'Adapted Lichen', 'Asteroid', 'Cartel', 'Comet',
];
const OUT = path.resolve('screenshots', 'carryover-album', 'map');
const SLOT = '.con-carry .con-album__slot';

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

function watchCarryPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/campaign\/carryover/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

/** The focused slot's card name (the ONE cursor — `--selected`). */
const focused = (page: Page) => page.locator(`${SLOT}--selected`).getAttribute('data-album-slot');
/** The cards standing on screen (inside the album's clip). */
const onScreen = (page: Page) => page.evaluate(() => {
  const box = document.querySelector('.con-carry .con-album')!.getBoundingClientRect();
  return Array.from(document.querySelectorAll<HTMLElement>('.con-carry .con-album__slot')).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.left >= box.left - 1 && r.right <= box.right + 1;
  }).map((el) => el.dataset.albumSlot);
});

async function interlude(request: Parameters<typeof createCampaign>[0], hand: Array<string>, limits?: Record<number, number>) {
  const {id} = await createCampaign(request);
  await launchMission(request, id);
  await devCommit(request, id, [0, 1], {carryoverPending: true, carryover: {0: [], 1: hand}, carryoverLimits: limits});
  return id;
}

test.describe('«Наследие проектов» — the hand album\'s chassis · tv4k', () => {
  test.use({viewport: {width: 3840, height: 2160}});

  test('A — 14 cards, limit 2: a deal from the seat row, pages, keep in place, a named refusal, return, X, RT → the flight into the next mission, Y', async ({page, request}) => {
    test.setTimeout(240_000);
    const id = await interlude(request, HAND);
    const posts = watchCarryPosts(page);
    // Arm the deal witness before the stage opens itself.
    await page.addInitScript(() => {
      const w = window as unknown as {__carryDeal: {flight: number, held: number}};
      w.__carryDeal = {flight: 0, held: 0};
      const tick = () => {
        if (document.querySelector('.con-carry-flight') !== null) {
          w.__carryDeal.flight++;
        }
        if (document.querySelector('.con-album__slot--held') !== null) {
          w.__carryDeal.held++;
        }
      };
      // A sampler on the page clock (the ratchet keeps rAF out of the specs).
      window.setInterval(tick, 16);
    });
    await openMapAs(page, id, 'Bruno');
    await page.waitForSelector('.con-carry .con-album', {timeout: 20_000});
    await shoot(page, 'a-01-enter');

    // THE ENTRY: the hand was dealt (clones in the air, slots held until their touchdown) and settles.
    await expect.poll(() => page.locator(`${SLOT}--held`).count(), {timeout: 10_000}).toBe(0);
    const deal = await page.evaluate(() => (window as unknown as {__carryDeal: {flight: number, held: number}}).__carryDeal);
    expect(deal.flight, 'a deal layer flew').toBeGreaterThan(0);
    expect(deal.held, 'the slots waited for their cards').toBeGreaterThan(0);

    // THE CHASSIS: the ONE head, strict pages (10 on screen), the spine «1 / 2», the manifest of two seats.
    await expect(page.locator('.con-carry .con-wshead')).toBeVisible();
    expect((await onScreen(page)).length, 'a 5 × 2 page').toBe(10);
    await expect(page.locator('.con-carry [data-album-spine] .con-handdock__pager-now')).toHaveText('1');
    await expect(page.locator('.con-carry [data-album-spine] .con-handdock__pager-total')).toHaveText('2');
    await expect(page.locator('.con-carry [data-carry-seat]')).toHaveCount(2);
    expect(await focused(page)).toBe(HAND[0]);
    await shoot(page, 'a-02-settled');

    // RB — the page turns; A keeps a page-2 card IN PLACE.
    await press(page, 'KeyE', 500);
    expect(await focused(page)).toBe(HAND[10]);
    await expect.poll(async () => (await onScreen(page)).length).toBe(4);
    await expect(page.locator('.con-carry [data-album-spine] .con-handdock__pager-now')).toHaveText('2');
    await press(page, 'Enter', 400);
    await expect(page.locator(`${SLOT}--picked`)).toHaveCount(1);
    await expect(page.locator(`.con-carry [data-album-slot="${HAND[10]}"] [data-album-band]`)).toContainText('1');
    await expect(page.locator('.con-carry [data-carry-seat="1"]')).toHaveAttribute('data-carry-seat-card', HAND[10]);
    await shoot(page, 'a-03-kept-page2');

    // LB — back to page 1: the manifest still names the page-2 card.
    await press(page, 'KeyQ', 500);
    expect(await focused(page)).toBe(HAND[0]);
    await expect(page.locator('.con-carry [data-carry-seat="1"]')).toHaveAttribute('data-carry-seat-card', HAND[10]);
    await press(page, 'Enter', 400);
    await expect(page.locator(`${SLOT}--picked`)).toHaveCount(2);
    await expect(page.locator('.con-carry [data-carry-seat="2"]')).toHaveAttribute('data-carry-seat-card', HAND[0]);

    // A on a third card — the seats are full: a NAMED refusal, nothing dims, nothing changes.
    await press(page, 'ArrowRight', 300);
    await press(page, 'Enter', 400);
    await expect(page.locator('.con-carry [data-carry-notice]')).toBeVisible();
    await expect(page.locator(`${SLOT}--picked`)).toHaveCount(2);
    await expect(page.locator(`${SLOT}--disabled`)).toHaveCount(0);
    await shoot(page, 'a-04-seats-full');

    // A on a KEPT card returns it — the same key, the same object; the next card moves up a seat.
    await press(page, 'KeyE', 500);
    expect(await focused(page)).toBe(HAND[11]);
    await press(page, 'ArrowLeft', 300);
    expect(await focused(page)).toBe(HAND[10]);
    await press(page, 'Enter', 400);
    await expect(page.locator(`${SLOT}--picked`)).toHaveCount(1);
    await expect(page.locator('.con-carry [data-carry-seat="1"]')).toHaveAttribute('data-carry-seat-card', HAND[0]);
    await expect(page.locator('.con-carry [data-carry-seat="2"]')).not.toHaveAttribute('data-carry-seat-card', /.+/);
    await press(page, 'KeyQ', 500);
    await press(page, 'ArrowRight', 300);
    await press(page, 'Enter', 400);
    await expect(page.locator(`${SLOT}--picked`)).toHaveCount(2);

    // X — inspect from the slot (the card lifts out of it), Esc back.
    await press(page, 'KeyX', 900);
    await expect(page.locator('.con-carry .con-zoom-hold')).toHaveCount(1);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', {code: 'Escape'})));
    await page.waitForSelector('.con-zoom', {state: 'detached', timeout: 10_000});
    expect(posts.length, 'nothing sent before RT').toBe(0);
    await shoot(page, 'a-05-two-kept');

    // RT — ONE POST in seat order; the kept cards fly into the next mission's card, which answers the touch.
    await page.evaluate(() => {
      const w = window as unknown as {__carryExit: {flight: number, receiving: number}};
      w.__carryExit = {flight: 0, receiving: 0};
      const tick = () => {
        if (document.querySelector('.con-carry-flight') !== null) {
          w.__carryExit.flight++;
        }
        if (document.querySelector('.cmap__card--receiving') !== null) {
          w.__carryExit.receiving++;
        }
      };
      // A sampler on the page clock (the ratchet keeps rAF out of the specs).
      window.setInterval(tick, 16);
    });
    await press(page, 'Period', 300);
    await page.waitForSelector('.cmap__wait-strip--ready', {timeout: 20_000});
    expect(posts.length, 'ONE POST').toBe(1);
    expect(JSON.parse(posts[0]).cards, 'the seats\' order').toEqual([HAND[0], HAND[1]]);
    await expect.poll(() => page.evaluate(() => (window as unknown as {__carryExit: {receiving: number}}).__carryExit.receiving),
      {timeout: 5_000, message: 'the mission card answered the touchdown'}).toBeGreaterThan(0);
    const exit = await page.evaluate(() => (window as unknown as {__carryExit: {flight: number}}).__carryExit);
    expect(exit.flight, 'the kept cards flew').toBeGreaterThan(0);
    await expect(page.locator('[data-cmap-seat-you] [data-cmap-seat-carry]')).toBeVisible();
    await shoot(page, 'a-06-ready');
    const model = await campaignModelAs(request, id, 'Bruno');
    const seat = model.carryover!.bySeat.find((s) => s.seat === 1)!;
    expect(seat.status).toBe('confirmed');
    expect(seat.count).toBe(2);
    expect(seat.limit).toBe(2);

    // Y — the SAME stage with both kept cards already in their kant; nothing is dealt (the cards are «here»).
    await page.evaluate(() => {
      (window as unknown as {__carryDeal: {flight: number}}).__carryDeal.flight = 0;
    });
    await press(page, 'KeyY', 800);
    await page.waitForSelector('.con-carry .con-album', {timeout: 10_000});
    await expect(page.locator(`${SLOT}--picked`)).toHaveCount(2);
    await cinematicBeat(page, 600, 'a revision must not deal — give a deal the window it would have taken to start');
    expect(await page.evaluate(() => (window as unknown as {__carryDeal: {flight: number}}).__carryDeal.flight), 'no deal on a revision').toBe(0);
    await shoot(page, 'a-07-revise');
  });

  test('B — the seat limit is the SEAT\'s: 3 seats, three keeps, the fourth a named refusal', async ({page, request}) => {
    test.setTimeout(120_000);
    const id = await interlude(request, HAND.slice(0, 6), {1: 3});
    await openMapAs(page, id, 'Bruno');
    await page.waitForSelector('.con-carry .con-album', {timeout: 20_000});
    await expect.poll(() => page.locator(`${SLOT}--held`).count(), {timeout: 10_000}).toBe(0);
    await expect(page.locator('.con-carry [data-carry-seat]')).toHaveCount(3);
    await expect(page.locator('.con-carry [data-carry-ask]')).toContainText('3');
    for (let i = 0; i < 3; i++) {
      await press(page, 'Enter', 400);
      await press(page, 'ArrowRight', 300);
    }
    await expect(page.locator(`${SLOT}--picked`)).toHaveCount(3);
    await press(page, 'Enter', 400);
    await expect(page.locator('.con-carry [data-carry-notice]')).toBeVisible();
    await expect(page.locator(`${SLOT}--picked`)).toHaveCount(3);
    await shoot(page, 'b-limit-3');
    const res = await request.get(`${campaignBase()}/api/campaign?id=${id}&name=Bruno`);
    expect((await res.json()).carryover.yourLimit).toBe(3);
  });

  test('D — an empty hand: no album, RT once is readiness', async ({page, request}) => {
    test.setTimeout(120_000);
    const id = await interlude(request, []);
    await openMapAs(page, id, 'Bruno');
    await page.waitForSelector('.con-carry', {timeout: 20_000});
    await expect(page.locator('.con-carry .con-album')).toHaveCount(0);
    await expect(page.locator('.con-carry__empty')).toBeVisible();
    await shoot(page, 'd-empty');
    await press(page, 'Period', 600);
    await page.waitForSelector('.cmap__wait-strip--ready', {timeout: 20_000});
  });
  test('E — «Тендеры» before the finale: a tender seat on the manifest, the played prelude carried by «Продление программы» — one POST carries both', async ({page, request}) => {
    test.setTimeout(240_000);
    // A three-mission tenders campaign: Bruno won «Расширенное наследие» + «Продление программы» at mission 1 (granted
    // outright by the dev fixture), mission 2 committed with the carryover round OPEN and his played preludes recorded.
    const {id} = await createCampaign(request, {}, {rewardMode: 'tenders', missionCount: 3});
    await launchMission(request, id);
    await devCommit(request, id, [1, 0], {tenders: {1: ['extendedLegacy', 'programExtension']}});
    // Mission 2 is LAUNCHED before its commit — the carryover's source seat is the bearer of the POST (`interlude()`).
    await launchMission(request, id);
    await devCommit(request, id, [0, 1], {
      carryoverPending: true, carryover: {0: [], 1: HAND}, finalPreludes: {1: ['Allied Bank', 'Biofuels']},
    });
    // A legacy tender is ACTIVATED on the step, never used silently (2026-11-08): the limit counts the seat only after
    // the activation — here over the API (the picker's own activation stage is the subject of test F).
    const brunoId = (await campaignModelAs(request, id, 'Bruno')).missions[1]?.yourPlayerId;
    expect(brunoId, 'Bruno\'s seat in the source mission').toBeTruthy();
    expect((await campaignModelAs(request, id, 'Bruno')).carryover?.yourLimit, 'the base alone until the tenders are activated').toBe(2);
    for (const instance of ['dev0-1-0', 'dev0-1-1']) {
      const res = await request.post(`${campaignBase()}/api/campaign/tender?id=${id}`, {data: {playerId: brunoId, instance}});
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    const before = await campaignModelAs(request, id, 'Bruno');
    expect(before.carryover?.yourLimit, 'the seat\'s limit counts the activated tender seat').toBe(3);
    expect(before.carryover?.yourTenders?.map((t: {status: string}) => t.status), 'both holdings read executed').toEqual(['executed', 'executed']);
    const posts = watchCarryPosts(page);
    await openMapAs(page, id, 'Bruno');
    await page.waitForSelector('.con-carry .con-album', {timeout: 20_000});
    await expect.poll(() => page.locator(`${SLOT}--held`).count(), {timeout: 10_000}).toBe(0);
    // The frames below are for the eye: the boot loader paints OVER the standing map for a while — wait it out.
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 30_000}).catch(() => undefined);

    // The manifest: three seats, the third the TENDER's (its tag); the band stands with the two played preludes.
    await expect(page.locator('.con-carry [data-carry-seat]')).toHaveCount(3);
    await expect(page.locator('.con-carry [data-carry-seat="3"]')).toHaveAttribute('data-carry-seat-tender', 'yes');
    await expect(page.locator('.con-carry [data-carry-prelude]')).toHaveCount(2);
    await expect(page.locator('.con-carry [data-carry-prelude-count]')).toHaveText('0 / 1');
    await shoot(page, 'e-01-tenders-interlude');

    // Keep one card (A), then ↑ to the band and carry the second prelude (▶ A) — the summary names both.
    await press(page, 'Enter', 700);
    await expect(page.locator('.con-carry [data-carry-seat="1"]')).toHaveAttribute('data-carry-seat-card', HAND[0]);
    await press(page, 'ArrowUp', 500);
    await expect(page.locator('.con-carry [data-carry-preludes].con-carry__preludes--active')).toHaveCount(1);
    await expect.poll(() => page.locator('.con-cmdbar').innerText(), {timeout: 5_000}).toMatch(/Взять пролог в финал/i);
    await press(page, 'ArrowRight', 400);
    await press(page, 'Enter', 700);
    await expect(page.locator('.con-carry [data-carry-prelude="Biofuels"]')).toHaveAttribute('data-carry-prelude-picked', 'yes');
    await expect(page.locator('.con-carry [data-carry-prelude-count]')).toHaveText('1 / 1');
    await expect(page.locator('.con-carry [data-carry-prelude-summary]')).toBeVisible();
    await shoot(page, 'e-02-prelude-carried');

    // RT confirms: ONE POST carries the cards AND the prelude; the server records both.
    await press(page, 'Period', 1200);
    await expect.poll(() => posts.length, {timeout: 10_000}).toBe(1);
    const body = JSON.parse(posts[0]);
    expect(body.cards).toEqual([HAND[0]]);
    expect(body.preludes).toEqual(['Biofuels']);
    await expect.poll(async () => (await campaignModelAs(request, id, 'Bruno')).carryover?.bySeat.find((b) => b.seat === 1)?.status, {timeout: 10_000}).toBe('confirmed');
    const after = await campaignModelAs(request, id, 'Bruno');
    expect(after.carryover?.yourCards).toEqual([HAND[0]]);
    expect(after.carryover?.yourPreludes).toEqual(['Biofuels']);
  });

  test('F — «Тендеры» before the finale (§19 · §20): the album first; L3 opens the door\'s list; A carries a tender onto its ACTIVATION SHEET (the result in the seat\'s numbers, B back to the list); A stamps it and the album returns with the GHOST place, which materializes in place — the seat, the prelude seat and the band (reserved, nothing re-flows); the readiness warns while one is still held', async ({page, request}) => {
    test.setTimeout(240_000);
    const {id} = await createCampaign(request, {}, {rewardMode: 'tenders', missionCount: 3});
    await launchMission(request, id);
    await devCommit(request, id, [1, 0], {tenders: {1: ['extendedLegacy', 'programExtension']}});
    await launchMission(request, id);
    await devCommit(request, id, [0, 1], {
      carryoverPending: true, carryover: {0: [], 1: HAND}, finalPreludes: {1: ['Allied Bank', 'Biofuels']},
    });
    expect((await campaignModelAs(request, id, 'Bruno')).carryover?.yourLimit, 'the base alone until an activation').toBe(2);
    const posts = watchCarryPosts(page);
    await openMapAs(page, id, 'Bruno');
    await page.waitForSelector('.con-carry .con-album', {timeout: 20_000});
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 30_000}).catch(() => undefined);
    await expect.poll(() => page.locator(`${SLOT}--held`).count(), {timeout: 10_000}).toBe(0);
    const bar = () => page.locator('.con-cmdbar').innerText();
    const head = () => page.locator('.con-carry .con-wshead').innerText();
    const door = page.locator('.con-carry [data-carry-tender-door]');
    const albumBox = () => page.locator('.con-carry .con-album').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}`;
    });
    /** ONE press, then the state — L3 is the door's toggle (a re-press mid-phrase would close what it opened). */
    const openDoor = async () => {
      await press(page, 'KeyC', 600);
      await expect(page.locator('.con-carry [data-carry-tenders-stage]'), 'L3 opens the door').toBeVisible({timeout: 15_000});
      await expect(page.locator('.con-carry [data-tender-portfolio].con-tport--live')).toHaveCount(1);
    };

    // ── The ALBUM stands first (the page the legacy tenders change); the door is lit for two; the band's place is
    //    RESERVED (locked) — so no activation can change the album's size. ──
    await expect(page.locator('.con-carry [data-carry-album-stage]')).toBeVisible();
    await expect(door).toHaveAttribute('data-carry-tender-door-ready', '2');
    await expect(page.locator('.con-cmdbar .con-cmdbar__cmd--hot', {hasText: /тендеры/i}), 'the door verb is LIT on this page').toHaveCount(1, {timeout: 5_000});
    await expect(page.locator('.con-carry [data-carry-preludes]')).toHaveAttribute('data-carry-preludes-locked', 'yes');
    await expect(page.locator('.con-carry [data-carry-seat]')).toHaveCount(2);
    const album0 = await albumBox();
    await shoot(page, 'f-01-album-door');

    // The ghost seat is a moment of the hand-over now (the sheet's A brings the album back with it, the answer follows):
    // recorded off the product's own writes, never sampled.
    await recordTransient(page, 'carry-ghosts', () => Array.from(document.querySelectorAll('.con-carry [data-carry-seat-ghost="yes"]'))
      .map((el) => el.getAttribute('data-carry-seat') ?? 'p' + (el.getAttribute('data-carry-prelude-seat') ?? '')).join(','));
    const ghostsSeen = async () => (await readTransient<string>(page, 'carry-ghosts')).map((x) => x.v).filter((v) => v !== '');
    const sheet = page.locator('.con-carry [data-tender-sheet]');

    // ── L3: the list — both READY (they execute here); A: «Расширенное наследие» is carried onto its ACTIVATION SHEET —
    //    the crumb names it, the result reads «Места наследия 2 → 3»; B is one level back to the list. ──
    await openDoor();
    await expect(page.locator('.con-carry [data-tport-slot]')).toHaveCount(2);
    await expect(page.locator('.con-carry [data-tport-slot]').first()).toHaveAttribute('data-tport-kind', 'extendedLegacy');
    await expect(page.locator('.con-carry [data-tport-slot][data-tport-kind="extendedLegacy"]')).toHaveAttribute('data-tport-state', 'ready');
    await expect(page.locator('.con-carry [data-tport-reading]')).toContainText('2 → 3');
    await shoot(page, 'f-02-list');
    await press(page, 'Enter', 900);
    await expect(sheet).toHaveAttribute('data-tender-sheet-id', 'extendedLegacy', {timeout: 10_000});
    await expect(sheet).toHaveAttribute('data-tender-sheet-open', 'yes', {timeout: 10_000});
    await expect(page.locator('.con-carry [data-tender-portfolio]'), 'the list yields its layer to the sheet').toBeHidden();
    await expect.poll(head, {timeout: 5_000}).toMatch(/расширенное наследие/i);
    const seatRow = sheet.locator('[data-tsheet-row="Legacy seats"]');
    await expect(seatRow.locator('[data-tsheet-from]')).toHaveText('2');
    await expect(seatRow.locator('[data-tsheet-to]')).toHaveText('3');
    await expect.poll(bar, {timeout: 5_000}).toMatch(NEW_COPY.executeTender);
    await shoot(page, 'f-03-sheet');
    await press(page, 'Escape', 900);
    await expect(sheet, 'B — one level back: the list').toHaveCount(0, {timeout: 10_000});
    await expect(page.locator('.con-carry [data-tender-portfolio].con-tport--live')).toBeVisible();
    await press(page, 'Enter', 900);
    await expect(sheet).toHaveAttribute('data-tender-sheet-open', 'yes', {timeout: 10_000});
    expect(posts.length).toBe(0);

    // ── A: the stamp, the album back with the GHOST seat «+3», the certificate home — then the activation lands: the
    //    ghost IS the seat now (the same place, its tag), the server opened it. ──
    await press(page, 'Enter', 900);
    await expect(page.locator('.con-carry [data-carry-album-stage]')).toBeVisible({timeout: 10_000});
    await expect(page.locator('.con-carry [data-carry-seat="3"]')).not.toHaveAttribute('data-carry-seat-ghost', 'yes', {timeout: 10_000});
    await expect(page.locator('.con-carry [data-carry-seat="3"]')).toHaveAttribute('data-carry-seat-tender', 'yes');
    await expect(page.locator('.con-carry [data-carry-seat]')).toHaveCount(3);
    expect((await campaignModelAs(request, id, 'Bruno')).carryover?.yourLimit, 'the server opened the seat').toBe(3);
    await expect.poll(head, {timeout: 5_000}).not.toMatch(/расширенное наследие/i);
    expect(await ghostsSeen(), 'the album came back with the GHOST seat before the server opened it').toContain('3');
    expect(await albumBox(), 'the album\'s box never moved').toBe(album0);
    await shoot(page, 'f-04-seat-opened');

    // ── The readiness RT while «Продление программы» is still held: the WARNING names it; B disarms. ──
    await press(page, 'Period', 700);
    await expect(page.locator('.con-carry [data-carry-tender-warning]')).toBeVisible();
    await expect(page.locator('.con-carry [data-carry-tender-warning]')).toContainText(/Продление программы/i);
    expect(posts.length, 'nothing was posted — the warning stood first').toBe(0);
    await press(page, 'Escape', 500);
    await expect(page.locator('.con-carry [data-carry-tender-warning]')).toHaveCount(0);

    // ── «Продление программы»: its GHOST is a PRELUDE seat beside the project seats; A unlocks the reserved band in place. ──
    await openDoor();
    await expect(page.locator('.con-carry [data-tport-slot]').first()).toHaveAttribute('data-tport-kind', 'programExtension');
    await press(page, 'Enter', 900);
    await expect(sheet).toHaveAttribute('data-tender-sheet-id', 'programExtension', {timeout: 10_000});
    await expect(sheet).toHaveAttribute('data-tender-sheet-open', 'yes', {timeout: 10_000});
    await expect.poll(head, {timeout: 5_000}).toMatch(/продление программы/i);
    const preludeRow = sheet.locator('[data-tsheet-row="Preludes into the finale"]');
    await expect(preludeRow.locator('[data-tsheet-from]')).toHaveText('0');
    await expect(preludeRow.locator('[data-tsheet-to]')).toHaveText('1');
    await shoot(page, 'f-05-prelude-sheet');
    await press(page, 'Enter', 900);
    await expect(page.locator('.con-carry [data-carry-prelude-seat="1"]')).not.toHaveAttribute('data-carry-seat-ghost', 'yes', {timeout: 10_000});
    await expect(page.locator('.con-carry [data-carry-preludes]')).not.toHaveAttribute('data-carry-preludes-locked', 'yes');
    await expect(page.locator('.con-carry [data-carry-prelude]')).toHaveCount(2);
    await expect(page.locator('.con-carry [data-carry-prelude-count]')).toHaveText('0 / 1');
    expect(await albumBox(), 'the band was reserved — the album\'s box never moved').toBe(album0);
    await expect(door).toHaveAttribute('data-carry-tender-door-ready', '0');
    expect(await ghostsSeen(), 'the prelude seat stood as its GHOST first').toContain('p1');
    await shoot(page, 'f-06-band-unlocked');

    // ── The cursor went where the choice is (the band): A carries Allied Bank (its seat takes the name); ↓ A keeps a card;
    //    RT: no warning left — ONE POST carries both. ──
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-carry [data-carry-prelude-count]')).toHaveText('1 / 1');
    await expect(page.locator('.con-carry [data-carry-prelude-seat="1"]')).toHaveAttribute('data-carry-prelude-seat-card', 'Allied Bank');
    await press(page, 'ArrowDown', 500);
    await press(page, 'Enter', 700);
    await expect(page.locator('.con-carry [data-carry-seat="1"]')).toHaveAttribute('data-carry-seat-card', HAND[0]);
    await press(page, 'Period', 900);
    await expect.poll(() => posts.length, {timeout: 10_000}).toBe(1);
    const body = JSON.parse(posts[0]) as {cards: Array<string>, preludes?: Array<string>};
    expect(body.cards).toEqual([HAND[0]]);
    expect(body.preludes).toEqual(['Allied Bank']);
    const after = await campaignModelAs(request, id, 'Bruno');
    expect(after.carryover?.yourTenders?.map((t: {status: string}) => t.status)).toEqual(['executed', 'executed']);
  });
});
