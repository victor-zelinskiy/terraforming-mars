import {test, expect, APIRequestContext} from './consoleTest';
import {bootFixture, fetchPlayerModel, press, reloadConsole} from './consoleStart';

/**
 * THE FINALE UNDER A LAW THAT REPLACES THE GREENERY (RX35 Diverted Research) — a guard of the finale's road, written
 * while reading CI's autopilot on `6ba4e117ff`, game 539, and the box's game 2921 (`liveness/stall/unserved/choice/
 * board/stranded`: the finale's context standing with no pick and no verb, the last thing in flight the sitting's
 * enactment). That class did not come on this road; what the road must keep is held here:
 *   · under the law the placing branch is a plain OPTION — its «open» IS the answer, so nothing converts the player's
 *     plants by itself (no press, no conversion — and none after a reload, invariant 3);
 *   · every conversion is reachable from the screen: the law's «where» (the data's card) is taken, and the next offer
 *     stands behind a press (the plate's A), never behind a bar of «Завершить · Свернуть» alone.
 * The fixture: blue asked its final greenery with 16 plants — two conversions — and Martian Census to hold the data.
 */

const plantsOf = async (request: APIRequestContext, id: string): Promise<number> =>
  ((await fetchPlayerModel(request, id)).thisPlayer as {plants?: number}).plants ?? -1;
const bar = (page: import('@playwright/test').Page) => page.evaluate(() => (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim());

test('the diverted finale answers nothing by itself — the screen stands, the plants stay, until the player presses', async ({page, request}) => {
  test.setTimeout(120_000);
  const id = await bootFixture(page, request, 'finale-diverted', {landing: 'prompt'});
  // The finale stands open on the screen (its plate or its own bar) — and the server is still asked: no press was made,
  // so nothing may have been converted. Read at rest, twice, a beat of the finale's own apart.
  await expect.poll(() => bar(page), {timeout: 30_000, message: 'the finale stands on the screen'}).toMatch(/Разместить озеленение|Потратить растения|Завершить свою партию/);
  expect(await plantsOf(request, id), 'no conversion the player did not press').toBe(16);
  await reloadConsole(page);
  await expect.poll(() => bar(page), {timeout: 30_000, message: 'the finale stands after a reload'}).toMatch(/Разместить озеленение|Потратить растения|Завершить свою партию/);
  expect(await plantsOf(request, id), 'a reload converts nothing either').toBe(16);
});

test('the diverted finale offers its press for every conversion — the second one too, nothing stranded', async ({page, request}) => {
  test.setTimeout(240_000);
  const id = await bootFixture(page, request, 'finale-diverted', {landing: 'prompt'});
  expect(await plantsOf(request, id), 'the fixture: 16 plants').toBe(16);

  // THE FIRST CONVERSION — the finale's way in (its plate or the finale's own bar), then its press: act → verify by the
  // server's own count, again only while it has not moved.
  for (let i = 0; i < 8 && await plantsOf(request, id) === 16; i++) {
    await press(page, 'Enter', 400);
    await expect.poll(() => plantsOf(request, id), {timeout: 5_000}).toBe(8).catch(() => undefined);
  }
  expect(await plantsOf(request, id), 'the first conversion spent 8 plants').toBe(8);

  // THE LAW's «WHERE» — the data's card (Martian Census): its pick stands, A takes it (act → verify: the pick leaves).
  const census = async () => ((await fetchPlayerModel(request, id)).thisPlayer as {tableau?: Array<{name: string, resources?: number}>})
    .tableau?.find((c) => c.name === 'Martian Census')?.resources ?? 0;
  for (let i = 0; i < 6 && await census() === 0; i++) {
    await expect.poll(() => bar(page), {timeout: 10_000}).toContain('Эффект резолюции').catch(() => undefined);
    await press(page, 'Enter', 400);
    await expect.poll(census, {timeout: 5_000}).toBe(1).catch(() => undefined);
  }
  expect(await census(), 'the first data landed on Martian Census').toBe(1);
  // THE NEXT OFFER — the same question renewed: a press of the screen reaches it (the plate's A, or the finale's own
  // «Потратить растения»), never a bar of «Завершить · Свернуть» alone — act → verify by the server's count.
  for (let i = 0; i < 8 && await plantsOf(request, id) === 8; i++) {
    await expect.poll(() => bar(page), {timeout: 10_000}).toMatch(/Разместить озеленение|Потратить растения/).catch(() => undefined);
    await press(page, 'Enter', 400);
    await expect.poll(() => plantsOf(request, id), {timeout: 5_000}).toBe(0).catch(() => undefined);
  }
  expect(await plantsOf(request, id), 'the second conversion spent the rest').toBe(0);
});
