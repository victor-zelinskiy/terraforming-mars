import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, fetchPlayerModel, openCardActions, press, pressUntil, settle, takeRevealCards, waitForBoardHome} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, witnessOf} from './witness';

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

/** `lifted`: the slot under the cursor — the cursor grammar LIFTS it (a scale + a rise), so its rect is not its rest. */
type Rect = {w: number, h: number, top: number, left: number, lifted?: boolean};
type DrawSample = {landed: Array<Rect>, prepared: Array<Rect>, standalone: number, samples: number};

const OUT = path.resolve('screenshots', 'one-framework');

/** Walk the action grid's cursor onto the tile `selector` names (by geometry, never a memorised key sequence). */
async function focusActionTile(page: Page, selector: string): Promise<void> {
  await expect(page.locator(`.con-cardactions__tile${selector}`), `the tile ${selector} is in the menu`).toHaveCount(1);
  const focused = () => page.evaluate((sel) => document.querySelector(`.con-cardactions__tile--focused${sel}`) !== null, selector);
  for (let i = 0; i < 20 && !await focused(); i++) {
    // The direction is read off the tiles AT REST (C — `readSettled`), never off a grid still laying itself out.
    const dir = await readSettled(page, () => page.evaluate((sel) => {
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
    }, selector), {settle: false, message: `the direction to ${selector}`});
    await press(page, dir, 300);
  }
  expect(await focused(), `the cursor stands on ${selector}`).toBe(true);
}

/** What one painted state shows of the draw zone (the reader's observation). */
type DrawSeen = {prepared: Array<Rect>, landed: Array<Rect>, standalone: boolean};
const DRAW_WITNESS = 'one-framework-draw';

/**
 * Arm the draw's recording — RECORDED (FLAKE ZERO — `armWitness`, armed before the commit, replace-proof): the prepared
 * beat slots, the landed slots, any standalone reveal, in every state the zone stood in. «Never a standalone reveal» is
 * a claim about every painted state, so the record is `settled` — the state a task LEAVES.
 */
async function armDrawSampler(page: Page): Promise<void> {
  await armWitness<DrawSeen>(page, DRAW_WITNESS, () => {
    const rectOf = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      const lifted = el.classList.contains('con-cards__slot--focused');
      return {w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), ...(lifted ? {lifted} : {})};
    };
    return {
      prepared: Array.from(document.querySelectorAll('.con-composer__revealzone--draw .con-composer__beatslot')).map(rectOf).filter((r) => r.w > 4),
      landed: Array.from(document.querySelectorAll('.con-composer__revealzone--draw .con-reveal .con-cards__slot')).map(rectOf).filter((r) => r.w > 4),
      standalone: document.querySelector('.con-reveal:not(.con-reveal--embedded)') !== null,
    };
  }, {settled: true, max: 20_000});
}

/**
 * The record, stopped and folded: the LAST prepared and the LAST landed slots the zone showed, how many states held a
 * standalone reveal. The stop is a sample too (the recorder flushes the page's last state before it is read).
 */
async function readDrawSampler(page: Page): Promise<DrawSample> {
  const recorded = await witnessOf<DrawSeen>(page, DRAW_WITNESS).stop();
  const out: DrawSample = {landed: [], prepared: [], standalone: 0, samples: recorded.length};
  for (const s of recorded) {
    if (s.v.prepared.length > 0) {
      out.prepared = s.v.prepared;
    }
    if (s.v.landed.length > 0) {
      out.landed = s.v.landed;
    }
    if (s.v.standalone) {
      out.standalone++;
    }
  }
  return out;
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
      await expect(page.locator('.con-cardactions .con-composer__handzone .con-hand--discard')).toHaveCount(1, {timeout: 30_000});
      await settle(page, {timeoutMs: 15_000});
      // act → verify → retry (tests.md): A toggles the focused card (✓ = `--select-picked`), the d-pad moves on, RT
      // confirms the pair. Four blind presses lost one to the album's own arrival on a starved renderer.
      const handZone = page.locator('.con-cardactions .con-composer__handzone .con-hand--discard');
      const picked = async (): Promise<number> => await handZone.locator('.con-hand__slot--select-picked').count();
      for (let i = 0; i < 12 && await picked() < 2; i++) {
        const focusedDone = await handZone.locator('.con-hand__slot--selected:is(.con-hand__slot--select-picked, .con-hand__slot--select-disabled)').count() > 0;
        if (focusedDone) {
          await press(page, 'ArrowRight', 300);
        } else {
          await pressUntil(page, 'Enter', async () => await handZone.locator('.con-hand__slot--selected.con-hand__slot--select-picked').count() > 0,
            {tries: 2, settleMs: 900});
        }
      }
      expect(await picked(), 'two cards picked for the discard').toBe(2);
      expect(await pressUntil(page, 'Period', async () => await waitingType(request, playerId) !== 'card', {tries: 3, settleMs: 3000}),
        'RT answers the discard').toBe(true);
      await expect.poll(() => waitingType(request, playerId), {timeout: 30_000, message: 'the discard was answered'}).not.toBe('card');
      await waitForBoardHome(page, 40);

      const report = `ai-central ${JSON.stringify(central)}\nreds ${JSON.stringify(reds)}`;
      fs.mkdirSync(path.join(OUT, profile.id), {recursive: true});
      fs.writeFileSync(path.join(OUT, profile.id, 'draw-ab.txt'), report + '\n');
      // The recorder's liveness only (a dead recorder): it keeps distinct STATES, never frames.
      expect(central.samples, `the sampler ran (${report})`).toBeGreaterThan(0);
      expect(central.landed.length, `AI Central landed two slots (${report})`).toBe(2);
      expect(reds.landed.length, `the Reds landed two slots (${report})`).toBe(2);
      for (let i = 0; i < 2; i++) {
        // THE PLACE, never the pose: the slot under the cursor wears the cursor's lift (×1.045, eased in once the stage
        // lets go of its arrival gate) — a sample may catch it anywhere on that ease (935 / 954 / 973 / 977 px at 4K on
        // the software renderer). A lifted slot is compared by its PREPARED place, which the loop below pins to the
        // landing rect of every slot at rest.
        const lifted = reds.landed[i].lifted === true || central.landed[i].lifted === true;
        const [a, b] = lifted ? [reds.prepared[i], central.prepared[i]] : [reds.landed[i], central.landed[i]];
        expect(near(a, b), `slot ${i}: the Reds' ${lifted ? 'prepared place' : 'rect'} equals AI Central's ±1 px (${report})`).toBe(true);
      }
      for (const [label, run] of [['ai-central', central], ['reds', reds]] as const) {
        expect(run.standalone, `${label}: never a standalone reveal (${report})`).toBe(0);
        // The prepared slots ARE the landing rects — for every slot at rest (the one under the cursor is lifted by the
        // cursor grammar, a pose on top of the same place; the A/B above compares it lifted against lifted).
        // The prepared stage reserves EXACTLY the batch: never a socket for a card that is not coming (the Reds' discard
        // prompt once sized it by the whole hand — nine sockets for two cards).
        expect(run.prepared.length, `${label}: the prepared stage holds as many slots as land (${report})`).toBe(run.landed.length);
        run.prepared.forEach((r, i) => {
          if (run.landed[i].lifted !== true) {
            expect(near(r, run.landed[i]), `${label}: prepared slot ${i} is the landing rect ±1 px (${report})`).toBe(true);
          }
        });
        expect(run.landed.some((r) => r.lifted !== true), `${label}: at least one slot was measured at rest (${report})`).toBe(true);
      }
    });
  });
}
