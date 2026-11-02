import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, press, pressUntil, reloadConsole} from './consoleStart';
import {closeSitting, enterSittingByPass, parliament, parliamentWire, turnTo} from './parliamentDrive';

/**
 * THE PARLIAMENT → DRAFT HANDOVER (P89 · ledger EA — the owner, 2026-11-01: «драфт открывается сразу с уже
 * розданными картами — премиум-анимация первой раздачи не проигрывается»), two seats, the TV profile.
 *
 * The root cause: the draft's live-entry latch was never set on the sitting's close (the game phase was DRAFTING
 * already, so no PHASE edge was left to see) and the first packet was taken for a RELOAD — shown at once, its deal
 * memory eaten. Now the seat's admission is its own edge (`observeDraftWorkspace`), the generation counter's flip is a
 * debt of the screen (`generation-flip`) the swap waits for, and the first packet comes off the real HUD deck once the
 * Parliament has left. The board never shows between the two surfaces and no plate rises (the softgates contract).
 *
 * Screens under screenshots/parliament-into-draft/.
 */
const OUT = path.resolve('screenshots', 'parliament-into-draft');
const TV = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${TV.id}-${name}.png`)});
}

/**
 * The sampler (setInterval 50 ms — never rAF): what the seat SEES each beat — the counter (its value and whether it is
 * flipping), the sitting, the draft frame, its slots held by the deal, the deal layer and its first proxy's centre, the
 * HUD pile's centre. A MutationObserver also records the FIRST deal proxy the instant it is inserted (a 50 ms sample
 * can miss the start of its flight).
 */
type Sample = {
  t: number, gen: string, flipping: boolean, parl: boolean, draft: boolean,
  slots: number, held: number, layer: boolean, proxies: number,
};
type Origin = {proxy: {x: number, y: number}, pile: {x: number, y: number, w: number} | undefined};
async function armSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__intoDraft?: Array<Sample>, __intoDraftOrigin?: Origin};
    const samples: Array<Sample> = [];
    w.__intoDraft = samples;
    const centre = (el: Element | null) => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width};
    };
    const take = () => {
      const slots = document.querySelectorAll('.con-draftws .con-draftws__slot');
      samples.push({
        t: Math.round(performance.now()),
        gen: (document.querySelector('.con-status__gen .con-status__value')?.textContent ?? '').trim(),
        flipping: document.querySelector('.con-status__gen .con-flipval--flip') !== null,
        parl: document.querySelector('.con-parl') !== null,
        draft: document.querySelector('.con-draftws') !== null,
        slots: slots.length,
        held: document.querySelectorAll('.con-draftws .con-draftws__slot.con-deal-hold').length,
        layer: document.querySelector('.con-draftws .con-deal-layer .con-deal-proxy') !== null,
        proxies: document.querySelectorAll('.con-deal-proxy').length,
      });
      if (samples.length > 6000) {
        samples.splice(0, 3000);
      }
    };
    new MutationObserver(() => {
      if (w.__intoDraftOrigin !== undefined) {
        return;
      }
      // The proxy's FIRST POSED frame — the director writes its transform and lifts its opacity before the flight; the
      // bare insertion (no transform yet) sits at the layer's origin and says nothing about where the card leaves from.
      const proxy = document.querySelector<HTMLElement>('.con-draftws .con-deal-proxy');
      if (proxy === null) {
        return;
      }
      const cs = getComputedStyle(proxy);
      // The director PLACES the proxy at its origin (transform written) before it lifts its opacity and flies — the
      // first written transform is the origin; waiting for a visible frame read a mid-flight pose under load.
      if (cs.transform === 'none') {
        return;
      }
      const c = centre(proxy);
      if (c === undefined || c.w < 2) {
        return;
      }
      w.__intoDraftOrigin = {proxy: {x: c.x, y: c.y}, pile: centre(document.querySelector('.con-deckstack__pile'))};
    }).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class']});
    take();
    setInterval(take, 50);
  });
}
const samplesOf = (page: Page): Promise<Array<Sample>> => page.evaluate(() => (window as unknown as {__intoDraft: Array<Sample>}).__intoDraft);
const originOf = (page: Page): Promise<Origin | undefined> => page.evaluate(() => (window as unknown as {__intoDraftOrigin?: Origin}).__intoDraftOrigin);

/** Walk a sitting to its results and close it on screen; returns the press's page time. */
async function walkAndClose(page: Page, request: Parameters<typeof closeSitting>[1], seat: string, door: RegExp): Promise<number> {
  await enterSittingByPass(page, request, seat);
  expect(await turnTo(page, 'results', 120_000), 'the walk reaches the results by itself').toBe(true);
  await expect(page.locator('.con-cmdbar'), 'A names the next workspace').toContainText(door);
  await shoot(page, '01-results');
  const pressedAt = await page.evaluate(() => Math.round(performance.now()));
  await closeSitting(page, request, seat);
  return pressedAt;
}

/** The handover's witnesses, read off the samples from the press on. */
function judgeHandover(samples: ReadonlyArray<Sample>, pressedAt: number): {afterPress: Array<Sample>, firstDraft: number} {
  const afterPress = samples.filter((s) => s.t >= pressedAt);
  const firstDraft = afterPress.findIndex((s) => s.draft);
  expect(firstDraft, 'the sampler saw the draft arrive').toBeGreaterThan(-1);
  // (2) the board never shows between the two surfaces.
  const bare = afterPress.slice(0, firstDraft).filter((s) => !s.parl);
  expect(bare.length, `no frame of the board home between the sitting and the draft (first at ${bare[0]?.t})`).toBe(0);
  // (1) the counter flips as a BEAT while the Parliament still stands — before the draft's first frame.
  const flipBeforeDraft = afterPress.slice(0, firstDraft + 1).some((s) => s.flipping && s.parl);
  expect(flipBeforeDraft, `the counter flips while the Parliament stands, before the draft arrives (${[...new Set(afterPress.map((s) => s.gen))].join(' → ')})`).toBe(true);
  return {afterPress, firstDraft};
}

test.describe(`the Parliament → draft handover · ${TV.id}`, () => {
  test.use({viewport: TV.viewport});

  test('«К драфту»: the counter flips as a beat, the Parliament hands the screen over, the first packet comes off the HUD deck', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId: blue} = await bootFixtureSeats(page, request, 'parliament-architecture-assembly-draft', {query: TV.query});
    const start = await parliamentWire(request, blue);
    expect(start.game.phase, 'one pass before the sitting').toBe('action');
    await armSampler(page);
    await shoot(page, '00-one-pass-away');

    const pressedAt = await walkAndClose(page, request, blue, /К драфту|To the draft/i);
    await expect(page.locator('.con-draftws'), 'the draft takes the screen by itself').toHaveCount(1, {timeout: 30_000});
    await expect(parliament(page), 'the sitting leaves with its close').toHaveCount(0, {timeout: 30_000});
    await shoot(page, '02-draft-entering');
    // (3) the first packet ARRIVES: every slot it fills is held in the first frames (never «already lying there»), the
    // deal layer flies, then the slots let go.
    await expect.poll(async () => (await samplesOf(page)).some((s) => s.t >= pressedAt && s.layer), {timeout: 20_000, message: 'the deal layer flew the first packet'}).toBe(true);
    await expect.poll(async () => page.locator('.con-draftws .con-draftws__slot:not(.con-deal-hold)').count(), {timeout: 30_000, message: 'the dealt cards became visible'}).toBeGreaterThan(0);
    await shoot(page, '03-packet-dealt');
    const {afterPress, firstDraft} = judgeHandover(await samplesOf(page), pressedAt);
    const firstWithSlots = afterPress.slice(firstDraft).find((s) => s.slots > 0);
    expect(firstWithSlots, 'the draft frame showed its slots').toBeDefined();
    expect(firstWithSlots!.held, `the first frame with slots holds them all (${firstWithSlots!.held} of ${firstWithSlots!.slots}) — never cards already lying there`).toBe(firstWithSlots!.slots);
    const origin = await originOf(page);
    expect(origin?.pile, 'the HUD pile was measurable at the first proxy').toBeDefined();
    const dist = Math.hypot(origin!.proxy.x - origin!.pile!.x, origin!.proxy.y - origin!.pile!.y);
    expect(dist, `the first card leaves the real HUD deck (proxy ${JSON.stringify(origin!.proxy)} · pile ${JSON.stringify(origin!.pile)})`).toBeLessThanOrEqual(Math.max(24, origin!.pile!.w / 2));
    await expect(page.locator('.con-mandatory'), 'no plate: the press already opened it').toHaveCount(0);
    await expect.poll(async () => (await samplesOf(page)).slice(-1)[0]?.gen, {timeout: 20_000}).toBe('2');

    // (4) the pick works — one press, one POST.
    const before = ((await parliamentWire(request, blue)) as unknown as {draftedCards?: Array<unknown>}).draftedCards?.length ?? 0;
    await expect.poll(async () => {
      await press(page, 'Enter', 1500);
      return ((await parliamentWire(request, blue)) as unknown as {draftedCards?: Array<unknown>}).draftedCards?.length ?? 0;
    }, {timeout: 60_000, message: 'the first pick lands'}).toBeGreaterThan(before);
    await shoot(page, '04-first-pick');
  });

  test('a reload right after the close presents the packet at once — no deal plays twice (PL-924)', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId: blue} = await bootFixtureSeats(page, request, 'parliament-architecture-assembly-draft', {query: TV.query});
    await walkAndClose(page, request, blue, /К драфту|To the draft/i);
    await expect(page.locator('.con-draftws'), 'the draft takes the screen').toHaveCount(1, {timeout: 30_000});
    await reloadConsole(page);
    await armSampler(page);
    // A reload announces the draft on its plate (the mandatory gate) — A opens it.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-draftws').count() > 0, {tries: 6, settleMs: 1500}),
      'the reload lands in the draft (A on its plate)').toBe(true);
    await expect.poll(async () => page.locator('.con-draftws .con-draftws__slot:not(.con-deal-hold)').count(), {timeout: 20_000}).toBeGreaterThan(0);
    expect((await samplesOf(page)).some((s) => s.layer), 'no deal layer after a reload').toBe(false);
    await shoot(page, '05-reload-instant');
  });

  test('«К исследованию» (no draft): the counter flips as a beat and the four research cards come off the deck', async ({page, request}) => {
    test.setTimeout(600_000);
    const {playerId: blue} = await bootFixtureSeats(page, request, 'parliament-architecture-assembly', {query: TV.query});
    await armSampler(page);
    const pressedAt = await walkAndClose(page, request, blue, /К исследованию|To the research/i);
    await expect(page.locator('.con-draftws'), 'the research takes the screen by itself').toHaveCount(1, {timeout: 30_000});
    await expect.poll(async () => (await samplesOf(page)).some((s) => s.t >= pressedAt && s.proxies > 0), {timeout: 20_000, message: 'the buy row was dealt off the deck'}).toBe(true);
    await expect.poll(async () => page.locator('.con-draftws .con-draftws__slot:not(.con-deal-hold)').count(), {timeout: 30_000}).toBeGreaterThan(0);
    judgeHandover(await samplesOf(page), pressedAt);
    await shoot(page, '06-research-dealt');
  });
});
