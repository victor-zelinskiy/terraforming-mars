import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, openCardActions, press, pressUntil, settle, takeRevealCards, waitForBoardHome} from './consoleStart';

/**
 * «ОДИН ФРЕЙМВОРК» · П3 — THE A/B OF THE DRAW (Turmoil Redux, the owner's own example, 2026-10-24): the Reds' «draw 2»
 * is composed by THE card actions' composer, so its drawn cards land in THE SAME draw zone, in THE SAME prepared slots,
 * as «Центр ИИ»'s — byte for byte. On ONE fixture (`parliament-actions` + AI Central on the table), ONE profile, ONE
 * snapshot: each slot of the Reds' landed row equals AI Central's (w · h · top · left, ±1 px), the prepared beat slots
 * are the landing rects (±1 px), and no sample ever paints a standalone reveal. Two profiles on purpose — the claim is a
 * per-profile NUMBER (the tv4k and the 1080 geometry each). The frames go to `screenshots/one-framework/`.
 */
const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
] as const;

type Rect = {w: number, h: number, top: number, left: number};
type DrawSample = {landed: Array<Rect>, prepared: Array<Rect>, standalone: number, samples: number};

const OUT = path.resolve('screenshots', 'one-framework');

/** Walk the action grid's cursor onto the tile `selector` names (by geometry, never a memorised key sequence). */
async function focusActionTile(page: Page, selector: string): Promise<void> {
  await expect(page.locator(`.con-cardactions__tile${selector}`), `the tile ${selector} is in the menu`).toHaveCount(1);
  const focused = () => page.evaluate((sel) => document.querySelector(`.con-cardactions__tile--focused${sel}`) !== null, selector);
  for (let i = 0; i < 20 && !await focused(); i++) {
    const dir = await page.evaluate((sel) => {
      const f = document.querySelector('.con-cardactions__tile--focused')?.getBoundingClientRect();
      const t = document.querySelector(`.con-cardactions__tile${sel}`)?.getBoundingClientRect();
      if (f === undefined || t === undefined) {
        return 'ArrowRight';
      }
      const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
      const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
      if (Math.abs(dy) > f.height / 2) {
        return dy > 0 ? 'ArrowDown' : 'ArrowUp';
      }
      return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    }, selector);
    await press(page, dir, 300);
  }
  expect(await focused(), `the cursor stands on ${selector}`).toBe(true);
}

/** Arm the sampler (MutationObserver + a 16 ms interval — never rAF): the prepared beat slots, the landed slots, any standalone reveal. */
async function armDrawSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__oneFw?: {landed: Array<{w: number, h: number, top: number, left: number}>, prepared: Array<{w: number, h: number, top: number, left: number}>, standalone: number, samples: number}, __oneFwStop?: () => void};
    w.__oneFwStop?.();
    const rec = {landed: [] as Array<{w: number, h: number, top: number, left: number}>, prepared: [] as Array<{w: number, h: number, top: number, left: number}>, standalone: 0, samples: 0};
    w.__oneFw = rec;
    const rectOf = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left)};
    };
    const sample = () => {
      rec.samples++;
      const prepared = Array.from(document.querySelectorAll('.con-composer__revealzone--draw .con-composer__beatslot')).map(rectOf).filter((r) => r.w > 4);
      if (prepared.length > 0) {
        rec.prepared = prepared;
      }
      const landed = Array.from(document.querySelectorAll('.con-composer__revealzone--draw .con-reveal .con-cards__slot')).map(rectOf).filter((r) => r.w > 4);
      if (landed.length > 0) {
        rec.landed = landed;
      }
      if (document.querySelector('.con-reveal:not(.con-reveal--embedded)') !== null) {
        rec.standalone++;
      }
    };
    const timer = window.setInterval(sample, 16);
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {childList: true, subtree: true, attributes: true});
    w.__oneFwStop = () => {
      window.clearInterval(timer);
      mo.disconnect();
    };
  });
}

async function readDrawSampler(page: Page): Promise<DrawSample> {
  return page.evaluate(() => {
    const w = window as unknown as {__oneFw?: DrawSample, __oneFwStop?: () => void};
    w.__oneFwStop?.();
    return w.__oneFw ?? {landed: [], prepared: [], standalone: 0, samples: 0};
  }) as Promise<DrawSample>;
}

async function waitingType(request: APIRequestContext, playerId: string): Promise<string | undefined> {
  const model = await fetchPlayerModel(request, playerId) as unknown as {waitingFor?: {type?: string}};
  return model.waitingFor?.type;
}

/** Open the composer of `selector`'s tile, confirm, and read the draw zone once its cards stand. */
async function drawThrough(page: Page, selector: string, label: string, profile: string): Promise<DrawSample> {
  await openCardActions(page);
  await focusActionTile(page, selector);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions .con-composer').count() > 0, {tries: 3, settleMs: 1100}),
    `A opens the card composer of ${label}`).toBeTruthy();
  await settle(page, {timeoutMs: 10_000});
  await armDrawSampler(page);
  await press(page, 'Enter', 1500); // the cursor stands on the commit row of a bare draw: the draw happens now
  await expect(page.locator('.con-cardactions .con-composer__revealzone--draw .con-reveal'), `${label}: the cards land in the composer's draw zone`)
    .toHaveCount(1, {timeout: 25_000});
  await settle(page, {timeoutMs: 15_000});
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `draw-${label}.png`)});
  return readDrawSampler(page);
}

function near(a: Rect, b: Rect): boolean {
  return Math.abs(a.w - b.w) <= 1 && Math.abs(a.h - b.h) <= 1 && Math.abs(a.top - b.top) <= 1 && Math.abs(a.left - b.left) <= 1;
}

for (const profile of PROFILES) {
  test.describe(`one framework · the Reds' draw IS AI Central's · ${profile.id}`, () => {
    test.use({viewport: profile.viewport});

    test(`П3 · the same draw zone, the same slots, byte for byte (${profile.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-actions', {query: profile.query});

      // A — «Центр ИИ»: a card's own draw.
      const central = await drawThrough(page, '[data-action-card="AI Central"]', 'ai-central', profile.id);
      await takeRevealCards(page);
      await waitForBoardHome(page, 40);
      await settle(page, {timeoutMs: 15_000});

      // B — the Reds: the party's draw through THE SAME composer.
      const reds = await drawThrough(page, '[data-action-party="Reds"]', 'reds', profile.id);
      await expect(page.locator('.con-cardactions .con-composer[data-composer-source="party:Reds"]'), 'the Reds composed by the card composer').toHaveCount(1);
      await takeRevealCards(page);
      // The mandatory discard closes the flow (two cards, RT) — the hand step stands in the composer's own layer.
      await expect(page.locator('.con-cardactions .con-composer__ledgerzone .con-hand--discard')).toHaveCount(1, {timeout: 30_000});
      await press(page, 'Enter', 300);
      await press(page, 'ArrowRight', 250);
      await press(page, 'Enter', 300);
      await press(page, 'Period', 1200);
      await expect.poll(() => waitingType(request, playerId), {timeout: 30_000, message: 'the discard was answered'}).not.toBe('card');
      await waitForBoardHome(page, 40);

      const report = `ai-central ${JSON.stringify(central)}\nreds ${JSON.stringify(reds)}`;
      fs.mkdirSync(path.join(OUT, profile.id), {recursive: true});
      fs.writeFileSync(path.join(OUT, profile.id, 'draw-ab.txt'), report + '\n');
      expect(central.samples, `the sampler ran (${report})`).toBeGreaterThan(10);
      expect(central.landed.length, `AI Central landed two slots (${report})`).toBe(2);
      expect(reds.landed.length, `the Reds landed two slots (${report})`).toBe(2);
      for (let i = 0; i < 2; i++) {
        expect(near(reds.landed[i], central.landed[i]), `slot ${i}: the Reds' rect equals AI Central's ±1 px (${report})`).toBe(true);
      }
      for (const [label, run] of [['ai-central', central], ['reds', reds]] as const) {
        expect(run.standalone, `${label}: never a standalone reveal (${report})`).toBe(0);
        if (run.prepared.length === run.landed.length) {
          run.prepared.forEach((r, i) => expect(near(r, run.landed[i]), `${label}: prepared slot ${i} is the landing rect ±1 px (${report})`).toBe(true));
        }
      }
    });
  });
}
