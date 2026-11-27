import {test, expect, Route} from './consoleTest';
import {bootFixture, fetchPlayerModel, press, pressUntilVisible, settle} from './consoleStart';

/**
 * THE RESEARCH BUY AFTER A REFUSED ANSWER (CI's autopilot on `16f6bbef91`, game 549 — the door on «Select card(s) to
 * buy»): the weather refused the buy's answer once (`#stale-prompt` — «the game state has changed, your last action
 * was not applied»), the alert said so, and every RT «Купить 0» after it changed nothing — twenty presses, then the
 * door. A refused answer is NOT applied: the question stands, and its commit must take the next press.
 *
 * The fixture is the solo buy (no draft): four cards, buy none. The first POST of an answer meets an injected 400
 * `#stale-prompt`; every later one goes to the server. «Done» is the server's word (it asks something else).
 */

test('a buy refused once as stale takes the next press — the research ends', async ({page, request}) => {
  test.setTimeout(180_000);
  let refused = 0;
  await page.route('**/player/input*', async (route: Route) => {
    if (refused === 0) {
      refused++;
      await route.fulfill({status: 400, contentType: 'application/json', body: JSON.stringify({id: '#stale-prompt', message: 'The question has moved on (injected).'})});
      return;
    }
    await route.continue();
  });
  const id = await bootFixture(page, request, 'draft-showcase-solo-buy', {landing: 'prompt'});
  if (!await page.locator('.con-draftws').isVisible()) {
    await pressUntilVisible(page, 'Enter', '.con-draftws', {settleMs: 1500});
  }
  await settle(page, {timeoutMs: 30_000});
  await expect(page.locator('.con-draftws__stage--buy .con-cards__slot')).toHaveCount(4, {timeout: 45_000});
  const asked = async (): Promise<string> => ((await fetchPlayerModel(request, id)) as unknown as {waitingFor?: {type?: string, promptId?: number}}).waitingFor?.type ?? 'none';
  const before = await asked();
  expect(before, 'the server asks the buy').toBe('card');

  // THE FIRST RT is refused (injected): the alert stands — closed by A, as the pilot and a player do.
  await press(page, 'Period', 900);
  await expect.poll(() => refused, {timeout: 10_000, message: 'the first answer met the refusal'}).toBe(1);
  if (await page.locator('.con-alert').count() > 0) {
    await press(page, 'Enter', 700);
  }
  // …THEN RT AGAIN — the question still stands, its commit takes the press: act → verify by the server's word.
  for (let i = 0; i < 6 && await asked() === 'card'; i++) {
    await press(page, 'Period', 900);
    await expect.poll(asked, {timeout: 5_000}).not.toBe('card').catch(() => undefined);
  }
  expect(await asked(), 'the buy was answered after the refusal').not.toBe('card');
});

test('…and a buy of ONE card refused once: the card comes back, the next press buys it', async ({page, request}) => {
  test.setTimeout(180_000);
  let refused = 0;
  await page.route('**/player/input*', async (route: Route) => {
    if (refused === 0) {
      refused++;
      await route.fulfill({status: 400, contentType: 'application/json', body: JSON.stringify({id: '#stale-prompt', message: 'The question has moved on (injected).'})});
      return;
    }
    await route.continue();
  });
  const id = await bootFixture(page, request, 'draft-showcase-solo-buy', {landing: 'prompt'});
  if (!await page.locator('.con-draftws').isVisible()) {
    await pressUntilVisible(page, 'Enter', '.con-draftws', {settleMs: 1500});
  }
  await settle(page, {timeoutMs: 30_000});
  await expect(page.locator('.con-draftws__stage--buy .con-cards__slot')).toHaveCount(4, {timeout: 45_000});
  type Seat = {thisPlayer: {cardsInHandNbr?: number}, waitingFor?: {type?: string}};
  const seat = async (): Promise<Seat> => (await fetchPlayerModel(request, id)) as unknown as Seat;
  const handBefore = (await seat()).thisPlayer.cardsInHandNbr ?? 0;
  // A takes the focused card (the bar's RT then reads «Купить 1»), RT commits — refused once.
  await press(page, 'Enter', 700);
  await expect.poll(async () => (await page.locator('.con-cmdbar').textContent()) ?? '', {timeout: 10_000}).toMatch(/Купить\s*1/);
  await press(page, 'Period', 900);
  await expect.poll(() => refused, {timeout: 10_000, message: 'the first answer met the refusal'}).toBe(1);
  if (await page.locator('.con-alert').count() > 0) {
    await press(page, 'Enter', 700);
  }
  // …RT again (the card taken back to the stage first by the unwind — A again if the pick was let go): the server buys it.
  for (let i = 0; i < 6 && (await seat()).waitingFor?.type === 'card'; i++) {
    const bar = (await page.locator('.con-cmdbar').textContent()) ?? '';
    await press(page, /Купить\s*1/.test(bar) ? 'Period' : 'Enter', 900);
    await expect.poll(async () => (await seat()).waitingFor?.type, {timeout: 5_000}).not.toBe('card').catch(() => undefined);
  }
  expect((await seat()).waitingFor?.type, 'the buy was answered after the refusal').not.toBe('card');
  expect((await seat()).thisPlayer.cardsInHandNbr, 'one card bought').toBe(handBefore + 1);
});
