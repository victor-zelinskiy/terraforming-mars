import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, playCardFromHand, playQueueCard, press, pressUntil, reloadConsole, settle, waitQueueIdle, walkFocusUntil} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {readTransient, recordTransient} from './transientRecorder';

/**
 * P66 VENUS L1 SHADE — the forty-eighth Prelude 2 card (ledger GI · GJ): «Raise Venus 3 steps.» — fully declarative. The
 * polish area, chosen by the owner up front: «A SCALE STEP AT THE START PAYS ITS RATING». On the start nobody told the
 * rating a prelude's scale steps bring — the hero's wave refused a TR beside a scale gain («the TR is the scale's»,
 * `directTrSpecs`) and the board's scale-step beat refuses every phase but ACTION (`scaleStepRatingPlan` — the start's
 * cover: a field beat there parked 30 s, the 22:15 export) — so the rating cell ticked in the frame the view applied with
 * nothing on screen, and the ruling Greens' answer jumped with it. Now the START HOST tells it through the hero: one
 * rating token per step, each born on its own printed scale icon (`bornOn` — three Venus icons, three sources), the cell
 * ticking on every touchdown, the Greens' +6 after the last one.
 *   (A) the start (fixture `venus-l1-shade-start` — 2p Redux, the fresh table's Greens ruling): A on P66 → three rating
 *       tokens, the k-th born on the k-th printed Venus icon, the cell ticking 20 → 21 → 22 → 23 (no tick before the first
 *       token is in the air), +6 M€ after the last tick; the queue serves Donation; no shadow finding, no stall;
 *   (E) a reload after A: the rail equals the server, nothing flies again;
 *   (B) the class (`venus-l1-shade-enhancers`): Atmospheric Enhancers' «ВАРИАНТ» Venus row → two tokens off its one
 *       printed Venus icon (a row printing fewer icons than tokens births them all on its first);
 *   (D) mid-game (`venus-l1-shade-wg`, the action phase): WG Project deals P66 — the FIELD tells the rating as before,
 *       never the hero a second time (at most three rating tokens, none born on a card face);
 *   (F) the storyboard of A (`TM_E2E_STORYBOARD=1` → screenshots/p66/tv4k/story-*).
 * RX42 on the start (the refused rating flies nothing) is pinned by `tests/console/playRailRule.spec.ts` § P66 · GJ; the
 * rules by `tests/cards/prelude2/VenusL1Shade.spec.ts`. TIMING class (`timingSpecs.ts`).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p66', PRESET.id);
const CARD = 'Venus L1 Shade';
const ENHANCERS = 'Atmospheric Enhancers';

type Wire = {
  game: {venusScaleLevel: number, phase: string},
  thisPlayer: {megacredits: number, terraformRating: number, tableau: Array<{name: string}>},
};
async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

function writeText(name: string, text: string): void {
  fs.mkdirSync(OUT, {recursive: true});
  fs.writeFileSync(path.join(OUT, name), `${text}\n`);
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

function collectConsole(page: Page): Array<string> {
  const lines: Array<string> = [];
  page.on('console', (m) => {
    if (/rail|transfer|start-shadow|liveness|screen-shadow|workspace-stall|board-beat|scale-step/i.test(m.text())) {
      lines.push(`${m.type()} ${m.text().slice(0, 400)}`);
    }
  });
  return lines;
}

/** One pose of the rating story: the cell, the M€ row, the rating tokens in the air, the printed scale icons on faces. */
type RatingPose = {
  tr: number,
  mc: number,
  chips: Array<{id: string, x: number, y: number}>,
  icons: Array<[number, number, number, number]>,
};

/** Record the rating story off the product's writes — the scale whose printed icons the tokens must be born on. */
async function recordRatingStory(page: Page, key: string, scale: string): Promise<void> {
  await recordTransient(page, key, (needle: string) => {
    const num = (sel: string): number => {
      const text = (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, '');
      const m = /^-?\d+/.exec(text);
      return m === null ? -1 : Number(m[0]);
    };
    // PAINTED only (the witness's own predicate): a chip in its mount frame stands unpositioned and transparent.
    const painted = (el: Element): boolean => {
      let op = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return false;
        }
        op *= Number(cs.opacity);
      }
      return op > 0.05;
    };
    const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip'))
      .filter((chip) => chip.querySelector('.resource_icon--rating') !== null && painted(chip))
      .map((chip) => {
        const r = chip.getBoundingClientRect();
        return {id: chip.getAttribute('data-transfer-id') ?? '', x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2)};
      })
      .filter((c) => c.x > 0 || c.y > 0);
    const icons = Array.from(document.querySelectorAll<HTMLElement>('.pcard .pcard-ic'))
      .filter((el) => (el.style.backgroundImage ?? '').includes(needle) && el.closest('.pcard-effect') === null)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < window.innerHeight)
      .map((r) => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] as [number, number, number, number]);
    return {tr: num('.con-res .con-score__value--tr'), mc: num('.con-res__row--megacredits .con-res__digits'), chips, icons};
  }, {args: scale});
}

type Birth = {id: string, t: number, x: number, y: number, icon: number, icons: number};
/** Each rating token's FIRST painted pose, with the printed scale icon (index by left edge) it stood on then (−1: none). */
function birthsOf(poses: ReadonlyArray<{t: number, v: RatingPose}>): Array<Birth> {
  const seen = new Map<string, Birth>();
  for (const s of poses) {
    const icons = [...s.v.icons].sort((a, b) => a[0] - b[0]);
    for (const c of s.v.chips) {
      if (seen.has(c.id)) {
        continue;
      }
      const pad = 10;
      const icon = icons.findIndex(([l, t, r, b]) => c.x >= l - pad && c.x <= r + pad && c.y >= t - pad && c.y <= b + pad);
      seen.set(c.id, {id: c.id, t: s.t, x: c.x, y: c.y, icon, icons: icons.length});
    }
  }
  return [...seen.values()];
}

/** The distinct values a counter went through, in order. */
function ticksOf(poses: ReadonlyArray<{t: number, v: RatingPose}>, key: 'tr' | 'mc'): Array<{t: number, v: number}> {
  const out: Array<{t: number, v: number}> = [];
  for (const s of poses) {
    if (s.v[key] >= 0 && out[out.length - 1]?.v !== s.v[key]) {
      out.push({t: s.t, v: s.v[key]});
    }
  }
  return out;
}

/** The story's law: N tokens, each on its own printed scale icon; the cell ticks once per token, never before one flies. */
function expectToldByTheHero(poses: ReadonlyArray<{t: number, v: RatingPose}>, steps: number, label: string, distinct = true): {births: Array<Birth>, tr: Array<{t: number, v: number}>} {
  const births = birthsOf(poses);
  const tr = ticksOf(poses, 'tr');
  const dump = `births ${JSON.stringify(births)} · tr ${tr.map((x) => `${x.v}@${Math.round(x.t)}`).join(' → ')}`;
  expect(births.length, `${label}: ${steps} rating tokens — one per scale step (${dump})`).toBe(steps);
  expect(births.every((b) => b.icon >= 0), `${label}: every token born ON a printed scale icon (${dump})`).toBe(true);
  if (distinct) {
    expect(new Set(births.map((b) => b.icon)).size, `${label}: the k-th token on the k-th icon — ${steps} icons, ${steps} sources (${dump})`).toBe(steps);
  }
  expect(tr.length, `${label}: the cell ticks once per step (${dump})`).toBe(steps + 1);
  expect(tr.every((x, i) => i === 0 || x.v === tr[i - 1].v + 1), `${label}: +1 on each touchdown (${dump})`).toBe(true);
  const firstBirth = Math.min(...births.map((b) => b.t));
  expect(tr[1].t, `${label}: no tick before the first token is in the air — a tick with no cause (${dump})`).toBeGreaterThanOrEqual(firstBirth);
  return {births, tr};
}

test.describe(`P66 Venus L1 Shade · a scale step at the start pays its rating · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('(A · E · F) the start: three rating tokens off the three printed Venus icons, the cell ticking on each, the Greens +6 after; a reload tells nothing twice', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const logs = collectConsole(page);
    const id = await bootFixture(page, request, 'venus-l1-shade-start', {query: PRESET.query, landing: 'prompt'});
    await settle(page, {timeoutMs: 30_000});
    await expect(page.locator(`.con-start [data-queue-slot="${CARD}"]`), 'the prelude stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    expect(before.game.venusScaleLevel, 'the fixture: Venus 0 %').toBe(0);
    await shoot(page, 'A-01-queue');

    await armTransferWitness(page);
    await recordRatingStory(page, 'p66-a', 'venus');
    const stop = await storyboard(page, 'A-start');
    expect(await playQueueCard(page, CARD), 'P66 was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, id)).game.venusScaleLevel, {timeout: 40_000, message: 'the server: Venus 6 %'}).toBe(6);
    // The top strip reads the truth at once (invariant 16): Venus 6 % while the story is still being told.
    await expect.poll(async () => (await page.locator('.con-status__param--venus .con-status__value').first().textContent() ?? '').replace(/\s+/g, ''),
      {timeout: 15_000, message: 'the top strip reads Venus 6 %'}).toMatch(/^6/);
    await waitQueueIdle(page, 60_000);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'A-02-after');
    const after = await wireOf(request, id);
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating, 'the server: TR +3').toBe(3);
    expect(after.thisPlayer.megacredits - before.thisPlayer.megacredits, 'the server: the Greens +6').toBe(6);

    const poses = await readTransient<RatingPose>(page, 'p66-a');
    const witness = await transferWitness(page);
    writeText('A-poses.txt', poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
    writeText('A-trail.txt', transferTrail(witness));
    writeText('A-console.txt', logs.join('\n'));
    const {tr} = expectToldByTheHero(poses, 3, 'A');
    expect(tr[0].v, 'A: the cell starts on the server\'s rating').toBe(before.thisPlayer.terraformRating);
    const mc = ticksOf(poses, 'mc');
    expect(mc[mc.length - 1].v - mc[0].v, `A: the M€ row ends +6 (${mc.map((x) => x.v).join(' → ')})`).toBe(6);
    const mcRise = mc.find((x, i) => i > 0 && x.v > mc[i - 1].v);
    expect(mcRise?.t ?? 0, `A: the Greens answer AFTER the last rating touchdown (${mc.map((x) => `${x.v}@${Math.round(x.t)}`).join(' → ')})`)
      .toBeGreaterThanOrEqual(tr[tr.length - 1].t);
    const trLandings = witness.landings.filter((l) => l.under === 'rail:tr');
    expect(trLandings.length, `A: three tokens landed on the rating cell (trail:\n${transferTrail(witness)})`).toBe(3);
    expect(endsOverGlass(witness), 'A: no end over glass or nothing').toEqual([]);
    await expect(page.locator('.con-start [data-queue-slot="Donation"]'), 'the queue serves Donation').toHaveCount(1, {timeout: 20_000});
    expect(logs.filter((l) => /start-shadow|\[liveness\]|workspace-stall|rail-owed/.test(l)), 'no shadow finding, no stall, no owed rail').toEqual([]);

    // (E) a reload: the rail equals the server, nothing flies again.
    await recordRatingStory(page, 'p66-e', 'venus');
    await reloadConsole(page);
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await expect.poll(async () => (await readTransient<RatingPose>(page, 'p66-e')).at(-1)?.v.tr ?? -1,
      {timeout: 20_000, message: 'the rating cell reads the server after the reload'}).toBe(after.thisPlayer.terraformRating);
    expect(birthsOf(await readTransient<RatingPose>(page, 'p66-e')), 'E: the reload flies no rating token').toEqual([]);
    expect(errors, 'no page error').toEqual([]);
  });

  test('(B) the class: Atmospheric Enhancers\' Venus row on the start — two rating tokens off its printed Venus icon', async ({page, request}) => {
    test.setTimeout(420_000);
    const logs = collectConsole(page);
    const id = await bootFixture(page, request, 'venus-l1-shade-enhancers', {query: PRESET.query, landing: 'prompt'});
    await settle(page, {timeoutMs: 30_000});
    await expect(page.locator(`.con-start [data-queue-slot="${ENHANCERS}"]`), 'P44 stands in the deployment queue').toHaveCount(1, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    const before = await wireOf(request, id);
    const focused = () => page.evaluate(() => document.querySelector('.con-start__qcard--focused')?.getAttribute('data-queue-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === ENHANCERS, focused, 8), 'P44 focused in the queue').toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('[data-start-variant] [data-prelude-variant-row]').count() === 3,
      {tries: 3, settleMs: 900}), 'the «ВАРИАНТ» step stands').toBe(true);
    await settle(page);
    for (let i = 0; i < 6 && await page.locator('[data-start-variant] .con-vchoice__opt--focused').getAttribute('data-prelude-variant-row') !== '2'; i++) {
      await press(page, 'ArrowDown', 200);
    }
    await expect(page.locator('[data-start-variant] .con-vchoice__opt--focused')).toHaveAttribute('data-prelude-variant-row', '2');
    await shoot(page, 'B-01-variant');

    await armTransferWitness(page);
    await recordRatingStory(page, 'p66-b', 'venus');
    const stop = await storyboard(page, 'B-enhancers');
    await press(page, 'Enter', 400);
    await expect.poll(async () => (await wireOf(request, id)).game.venusScaleLevel, {timeout: 40_000, message: 'the server: Venus 4 %'}).toBe(4);
    await waitQueueIdle(page, 60_000);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await stop();
    await shoot(page, 'B-02-after');
    const after = await wireOf(request, id);
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating, 'the server: TR +2').toBe(2);
    const poses = await readTransient<RatingPose>(page, 'p66-b');
    const witness = await transferWitness(page);
    writeText('B-poses.txt', poses.map((s) => `${Math.round(s.t)} ${JSON.stringify(s.v)}`).join('\n'));
    writeText('B-trail.txt', transferTrail(witness));
    // P44 prints ONE Venus icon in its Venus branch: both tokens are born on it (the first icon when the row prints fewer).
    expectToldByTheHero(poses, 2, 'B', false);
    expect(endsOverGlass(witness), 'B: no end over glass or nothing').toEqual([]);
    expect(logs.filter((l) => /start-shadow|\[liveness\]|workspace-stall|rail-owed/.test(l)), 'no shadow finding, no stall, no owed rail').toEqual([]);
  });

  test('(D) mid-game: WG Project deals P66 — the field tells the rating in the action phase, never the hero a second time', async ({page, request}) => {
    test.setTimeout(420_000);
    const id = await bootFixture(page, request, 'venus-l1-shade-wg', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id);
    expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
    const pick = '.con-hand__outcome .con-deckpick--play';
    await expect(page.locator(`${pick}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
    const focused = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 12), `focused ${CARD}`).toBeTruthy();
    await armTransferWitness(page);
    await recordRatingStory(page, 'p66-d', 'venus');
    await press(page, 'Enter', 400);
    await settle(page, {timeoutMs: 20_000}).catch(() => undefined);
    for (let i = 0; i < 3 && !(await wireOf(request, id)).thisPlayer.tableau.some((c) => c.name === CARD); i++) {
      await press(page, 'Period', 1500);
    }
    await expect.poll(async () => (await wireOf(request, id)).game.venusScaleLevel, {timeout: 40_000, message: 'the server: Venus +6 %'})
      .toBe(before.game.venusScaleLevel + 6);
    await settle(page, {timeoutMs: 60_000}).catch(() => undefined);
    await shoot(page, 'D-01-after');
    const after = await wireOf(request, id);
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating, 'the server: TR +3').toBe(3);
    const witness = await transferWitness(page);
    writeText('D-trail.txt', transferTrail(witness));
    const births = birthsOf(await readTransient<RatingPose>(page, 'p66-d'));
    writeText('D-births.txt', JSON.stringify(births));
    expect(births.length, `D: at most three rating tokens — one story, never the hero and the field both (${JSON.stringify(births)})`).toBeLessThanOrEqual(3);
    expect(births.filter((b) => b.icon >= 0), `D: no rating token born on a card face in the action phase (${JSON.stringify(births)})`).toEqual([]);
    expect(endsOverGlass(witness), 'D: no end over glass or nothing').toEqual([]);
  });
});
