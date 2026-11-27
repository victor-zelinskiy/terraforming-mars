import {test, expect} from './consoleTest';
import {bootFixture, fetchPlayerModel, press} from './consoleStart';

/**
 * PHILARES' FIRST ACTION AT THE OPENING — the greenery that raises the oxygen (CI's autopilot on `9b18aa2259`, game
 * 553, replayed on the box to the same three lines). After the placement the start stood over the board serving
 * nothing, while the oxygen step's TR waited for a board the player could see — a mutual wait that only the story's
 * 32 s ceiling ended (`presentation-ledger/story-due/scale-step-rating`), and the foreground's mandatory lease stood
 * over nothing rendered (`console-foreground-watchdog/expired/lease:mandatory-choice×n`).
 *
 * The road a player takes: A on «Выполнить первое действие», a cell, A to confirm — and the opening is over. «Done» is
 * the server's word at every step (the question it asks, the oxygen it reports); the page is read by state.
 */

type Wire = {game: {generation: number, oxygenLevel: number}, waitingFor?: {type: string, startGamePrompt?: {kind?: string}}};
const wire = async (request: import('@playwright/test').APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

test('the first action places its greenery, the start gives the board back, and the oxygen\'s TR is told on it — no wait on a covered board', async ({page, request}) => {
  test.setTimeout(180_000);
  const watchdog: Array<string> = [];
  page.on('console', (msg) => {
    if (/\[console-foreground-watchdog\]|story «scale-step-rating» degraded|ceiling scale-step-rating:stage/.test(msg.text())) {
      watchdog.push(msg.text());
    }
  });
  const viewer = await bootFixture(page, request, 'first-action-philares-opening', {landing: 'prompt'});
  const asked = await wire(request, viewer);
  expect(asked.waitingFor?.startGamePrompt?.kind, 'the server asks the first action').toBe('corporationInitialAction');
  await expect(page.locator('.con-start'), 'the start serves its last stage').toHaveCount(1, {timeout: 60_000});

  // THE FIRST ACTION: A until the server asks the greenery's cell (act → verify → again only while it has not moved).
  for (let i = 0; i < 6 && (await wire(request, viewer)).waitingFor?.type !== 'space'; i++) {
    await press(page, 'Enter', 400);
    await expect.poll(async () => (await wire(request, viewer)).waitingFor?.type, {timeout: 5_000}).toBe('space').catch(() => undefined);
  }
  expect((await wire(request, viewer)).waitingFor?.type, 'the greenery asks its cell').toBe('space');
  const before = (await wire(request, viewer)).game.oxygenLevel;
  // THE CELL: A selects, A confirms — until the server reports the oxygen raised.
  for (let i = 0; i < 6 && (await wire(request, viewer)).game.oxygenLevel === before; i++) {
    await press(page, 'Enter', 400);
    await expect.poll(async () => (await wire(request, viewer)).game.oxygenLevel, {timeout: 5_000}).toBe(before + 1).catch(() => undefined);
  }
  expect((await wire(request, viewer)).game.oxygenLevel, 'the greenery raised the oxygen').toBe(before + 1);
  // (…and on the solo table the greenery stands beside a neutral city: Philares pays one standard resource — the
  // corporation's own question, answered on its plate: A puts the unit on the focused row, X takes it.)
  for (let i = 0; i < 6 && (await wire(request, viewer)).waitingFor?.type === 'resources'; i++) {
    await press(page, i % 2 === 0 ? 'Enter' : 'KeyX', 500);
    await expect.poll(async () => (await wire(request, viewer)).waitingFor?.type, {timeout: 4_000}).not.toBe('resources').catch(() => undefined);
  }
  expect((await wire(request, viewer)).waitingFor?.type, 'Philares\' payout answered').not.toBe('resources');

  // THE OPENING IS OVER: the start leaves by itself (no press), the board is the player's — well inside the story's bound.
  await expect(page.locator('.con-start'), 'the start gives the board back').toHaveCount(0, {timeout: 20_000});
  expect(watchdog, 'no wait on a board the start covers, no lease over nothing').toEqual([]);
});
