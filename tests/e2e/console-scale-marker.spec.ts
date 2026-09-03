import {test, expect, APIRequestContext, Page} from '@playwright/test';
import {NO_PAYMENT, createGameWithCards, fetchPlayerModel, openConsole, seedGameOverApi, sendPlayerInput,
  soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * THE GLOBAL-PARAMETER CURSOR — the ring that rides each arc dial.
 *
 * Two claims about it, both of which shipped broken and neither of which
 * any cheaper test can make (the first is pure layout, the second needs a
 * real WAAPI animation and a real section handoff):
 *
 *   A. IT IS NOT SLICED. The fit engine frames the board by the union of
 *      its semantic content, and the cursor is deliberately not in that
 *      union (it moves — measuring it would re-scale the planet on every
 *      tick), so it overhangs the band it rides. The stage's clip has to
 *      allow for that overhang or the ocean cursor is cut along a hard
 *      horizontal line — which is what the player sees as "the hand dock
 *      cuts the circle".
 *   B. IT IS NEVER LATE. It must APPEAR when the first ocean lands (the
 *      ocean dial's digits run 1..9 while the parameter starts at 0), and
 *      a change that arrives while the board section is `display: none`
 *      must be on the dial the instant the section comes back.
 *
 * B needs a SECOND player, and that is not incidental: the transport
 * deliberately skips a refresh while the viewer holds a prompt, so an
 * out-of-band change only ever reaches the client while somebody else is
 * acting — exactly the multiplayer shape the desync was reported in.
 *
 * The value-tracking half of B is also pinned cheaply and per-scale in
 * `tests/client/components/board/AnimatedScaleMarker.spec.ts`.
 */

type Wire = Record<string, any>;

function payMc(amount: number): Wire {
  return {...NO_PAYMENT, megacredits: amount};
}

/** Run the Aquifer standard project once, placing on the first offered space. */
async function placeOcean(request: APIRequestContext, id: string): Promise<void> {
  const model = await fetchPlayerModel(request, id) as Wire;
  const menu = model.waitingFor as Wire;
  const options = (menu?.options ?? []) as Array<Wire>;
  const at = options.findIndex((o) => /standard project/i.test(String(o.title?.message ?? o.title ?? '')));
  expect(at, `no standard-projects branch in ${JSON.stringify(options.map((o) => o.title))}`).toBeGreaterThanOrEqual(0);
  const cards = (options[at].cards ?? []) as Array<Wire>;
  const aquifer = cards.find((c) => c.name === 'Aquifer');
  expect(aquifer, `no Aquifer among ${JSON.stringify(cards.map((c) => c.name))}`).toBeDefined();
  const after = await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card: 'Aquifer', payment: payMc(aquifer?.calculatedCost ?? 18)},
  } as never) as Wire;
  const prompt = after.waitingFor as Wire;
  expect(prompt?.type, 'Aquifer must ask for a space').toBe('space');
  await sendPlayerInput(request, id, {type: 'space', spaceId: (prompt.spaces ?? [])[0]} as never);
}

async function readMarker(page: Page): Promise<Wire> {
  return page.evaluate(() => {
    const stage = document.querySelector('.con-board__stage') as HTMLElement | null;
    const sr = stage?.getBoundingClientRect();
    const cs = stage === null ? null : getComputedStyle(stage);
    const m = document.querySelector('.scale-marker--oceans') as HTMLElement | null;
    const mr = m?.getBoundingClientRect();
    const digit = document.querySelector('.arc-scale--oceans .arc-scale__digit--current') as HTMLElement | null;
    const dr = digit?.getBoundingClientRect();
    // WHICH tick points outward depends on the arc's local radial sign, so
    // take the lower of the two — that is the one the bottom clip can cut.
    const ticks = Array.from(m?.querySelectorAll('.scale-marker__tick') ?? [])
      .map((t) => t.getBoundingClientRect().bottom);
    return {
      stage: sr ? {t: Math.round(sr.top), b: Math.round(sr.bottom)} : null,
      overflow: cs?.overflow,
      clipMargin: cs?.getPropertyValue('overflow-clip-margin'),
      boardScale: getComputedStyle(document.documentElement).getPropertyValue('--board-scale'),
      markerCls: m?.className,
      markerOpacity: m === null ? null : getComputedStyle(m).opacity,
      marker: mr ? {t: Math.round(mr.top), b: Math.round(mr.bottom)} : null,
      currentDigit: digit?.textContent?.trim(),
      digitCentreY: dr ? Math.round(dr.top + dr.height / 2) : null,
      tickBottom: ticks.length > 0 ? Math.round(Math.max(...ticks)) : null,
    };
  });
}

test('the ocean cursor is not sliced by the stage clip (4K)', async ({page, request}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({width: 3840, height: 2160});
  const id = await createGameWithCards(request, [], {config: soloGameConfig()});
  await seedGameOverApi(request, id);
  for (let i = 0; i < 5; i++) {
    await placeOcean(request, id);
  }
  await openConsole(page, id);
  await waitForBoardHome(page, 25);
  await page.waitForTimeout(3500);

  const m = await readMarker(page);
  console.log('clip:', JSON.stringify(m, null, 1));
  await page.screenshot({path: 'screenshots/console-scale-marker/oceans-4k.png'});

  expect(m.currentDigit, 'the dial must read 5').toBe('5');
  expect(m.markerCls).toContain('scale-marker--ready');
  const clip = Number(String(m.clipMargin).replace('px', ''));
  expect(m.overflow).toBe('clip');
  expect(clip).toBeGreaterThan(40);
  expect(m.tickBottom, `the cursor's outer tick is cut (clip ends at ${m.stage.b + clip})`)
    .toBeLessThanOrEqual(m.stage.b + clip);
});

test('a change that lands off-screen is not late', async ({page, request}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({width: 1920, height: 1080});
  const created = await request.post('/api/creategame', {
    data: soloGameConfig({
      players: [
        {name: 'Actor', color: 'red', beginner: false, handicap: 0, first: true},
        {name: 'Viewer', color: 'blue', beginner: false, handicap: 0, first: false},
      ],
    }),
  });
  expect(created.ok(), 'create-game accepted').toBeTruthy();
  const {players} = await created.json();
  const actor = players[0].id;
  const viewer = players[1].id;
  // Both pregames answered concurrently; the non-active seat then simply has
  // nothing to answer, which its seeder reports as «never came back» — that
  // is the expected end of its road here.
  await Promise.all([
    seedGameOverApi(request, actor).catch(() => undefined),
    seedGameOverApi(request, viewer).catch(() => undefined),
  ]);

  await openConsole(page, viewer);
  await page.waitForTimeout(6000);
  console.log('before:', JSON.stringify(await readMarker(page)));

  // ── the first ocean must make the cursor APPEAR ──────────────────────
  await placeOcean(request, actor);
  await page.waitForFunction(() => {
    const d = document.querySelector('.arc-scale--oceans .arc-scale__digit--current');
    return (d?.textContent ?? '').trim() === '1';
  }, undefined, {timeout: 60_000});
  await page.waitForTimeout(2000);
  const one = await readMarker(page);
  console.log('1 ocean:', JSON.stringify(one));
  expect(one.markerCls, 'the cursor never stepped onto the dial').toContain('scale-marker--ready');
  expect(Number(one.markerOpacity)).toBe(1);
  expect(Math.abs((one.marker.t + one.marker.b) / 2 - one.digitCentreY)).toBeLessThanOrEqual(6);

  // ── the second one lands while the board section is hidden ───────────
  await page.evaluate(() => {
    (document.querySelector('.con-board') as HTMLElement).style.display = 'none';
  });
  await placeOcean(request, actor);
  await page.waitForFunction(() => {
    const chip = document.querySelector('.con-status');
    return (chip?.textContent ?? '').includes('2/9');
  }, undefined, {timeout: 60_000});
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    (document.querySelector('.con-board') as HTMLElement).style.display = '';
  });
  await page.waitForTimeout(1800);
  const two = await readMarker(page);
  console.log('2 oceans (after the hidden leg):', JSON.stringify(two));
  await page.screenshot({path: 'screenshots/console-scale-marker/offscreen.png'});
  expect(two.currentDigit, 'the dial must read 2').toBe('2');
  expect(Math.abs((two.marker.t + two.marker.b) / 2 - two.digitCentreY),
    'the cursor is not on the current digit — it lagged').toBeLessThanOrEqual(6);
});
