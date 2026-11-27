import {test, expect, APIRequestContext, Page} from './consoleTest';
import {bootFixture, fetchPlayerModel, press, pressUntil, settle} from './consoleStart';

/**
 * A FIRST ACTION STILL OWED, AND THE SEAT WOULD RATHER PASS. The corporation's first action is the seat's to take OR to
 * pass over: for as long as it is owed the server's menu is «the first action | pass» — on any turn of any generation
 * (a seat that passed over it meets the same plate the next generation).
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO — the counting pass of a hundred whole games, CI run 45471563686, game 780: in
 * generation 14 the pilot's pass by the wheel did not land three times and the door answered). The plate «Первое
 * действие» offers only the action, so the pass lives on the basic-actions wheel — and the wheel withheld it from a
 * player who had OPENED the plate to read it and minimized it: a parked decision blocks every basic action. But this
 * pass is an ANSWER to that very decision, not a way around it; the one legal answer left was the one the player had
 * just declined to give.
 *
 * The table is fixture `first-action-owed-late`: a solo action phase in generation 3 with Inventrix's first action
 * never taken. «Done» is the SERVER's word (the generation moves on — a solo pass ends it); the page is read by state.
 */
type Wire = {
  waitingFor?: {type?: string, promptId?: number, options?: Array<unknown>, startGamePrompt?: {kind?: string}},
  game: {generation: number},
  thisPlayer: {tableau: Array<{name: string}>},
};
const wire = async (request: APIRequestContext, seat: string): Promise<Wire> => await fetchPlayerModel(request, seat) as unknown as Wire;

const barText = async (page: Page): Promise<string> => (await page.locator('.con-cmdbar__label').allTextContents()).map((t) => t.trim()).join(' | ');
const PASS = '.con-quick [data-quick-id="pass"]';

test.describe('a first action still owed — and the pass over it', () => {
  test('the plate opened, read and minimized: the wheel still offers the pass, and it is taken', async ({page, request}) => {
    test.setTimeout(180_000);
    // (The boot leaves the question to the PLAYER: its default answers an opening over the API.)
    const viewer = await bootFixture(page, request, 'first-action-owed-late', {landing: 'prompt'});
    const asked = await wire(request, viewer);
    expect(asked.waitingFor?.startGamePrompt?.kind, 'the server asks the first action').toBe('corporationInitialAction');
    expect(asked.waitingFor?.options?.length, 'the first action — or the pass').toBe(2);
    const generation = asked.game.generation;

    // THE PLATE: A opens it from the board home; it offers the action, a look and «Свернуть» — never the pass.
    expect(await pressUntil(page, 'Enter', async () => /первое действие|first action/i.test(await barText(page)), {tries: 4, settleMs: 1200}),
      'A opens the first action\'s plate').toBe(true);
    // B MINIMIZES IT: the board home, the way back standing on the bar.
    expect(await pressUntil(page, 'Escape', async () => /вернуться к решению|return to the decision/i.test(await barText(page)), {tries: 3, settleMs: 1200}),
      'B minimizes the plate — the way back stands on the bar').toBe(true);
    expect((await wire(request, viewer)).waitingFor?.promptId, 'nothing was answered by looking').toBe(asked.waitingFor?.promptId);

    // THE WHEEL: the pass ANSWERS the parked question — offered, not withheld.
    expect(await pressUntil(page, 'Comma', async () => await page.locator(PASS).count() > 0, {tries: 3, settleMs: 900}), 'LT opens the basic actions').toBe(true);
    await expect(page.locator(PASS), 'the pass is offered: it goes THROUGH the parked question, never around it')
      .not.toHaveClass(/con-quick__slot--disabled/, {timeout: 15_000});
    // …while a verb that WOULD go around it stays withheld (the standard projects, the wheel's centre).
    await expect(page.locator('.con-quick [data-quick-id="standardProjects"]'), 'a verb around the parked question stays withheld')
      .toHaveClass(/con-quick__slot--disabled/);

    // THE PASS: the direction IS the activation; the confirm; A — «done» is the server's word (a solo pass ends the generation).
    expect(await pressUntil(page, 'ArrowDown', async () => await page.locator('.con-confirm').count() > 0, {tries: 3, settleMs: 900}), '↓ asks to confirm the pass').toBe(true);
    for (let tries = 0; tries < 3 && (await wire(request, viewer)).game.generation === generation && await page.locator('.con-confirm').count() > 0; tries++) {
      await press(page, 'Enter', 1200);
    }
    await expect.poll(async () => (await wire(request, viewer)).game.generation, {timeout: 30_000, message: 'the server took the pass: the generation moved on'})
      .toBe(generation + 1);

    // NOTHING OF THE PARKED QUESTION IS LEFT BEHIND: the next question is served, no stale way back to a decision that is gone.
    await settle(page, {timeoutMs: 60_000});
    await expect.poll(() => barText(page), {timeout: 30_000, message: 'no stale «Вернуться к решению» over the next question'})
      .not.toMatch(/вернуться к решению|return to the decision/i);
    await expect(page.locator('.con-confirm')).toHaveCount(0);
    await expect(page.locator('.con-quick')).toHaveCount(0);
  });

  /*
   * …AND AT THE OPENING (CI's autopilot on `6593366`, game 333 — the fixture `first-action-owed-opening`: generation 1,
   * Inventrix's «draw 3 cards» owed). The pass over it is the seat's to give there too, and it ENDS the seat's opening:
   * the first action is the next generation's menu from then on, never the start's last stage. What the pass used to
   * leave behind: a start that stood on into generation 2 — the draft opened OVER its frame and the start director
   * cured it by level. «Done» is the server's word (the generation moves on); the page is read by state.
   */
  test('at the opening: the pass over the first action ends the opening — the next generation has no start under it', async ({page, request}) => {
    test.setTimeout(180_000);
    const viewer = await bootFixture(page, request, 'first-action-owed-opening', {landing: 'prompt'});
    const asked = await wire(request, viewer);
    expect(asked.game.generation, 'the opening').toBe(1);
    expect(asked.waitingFor?.startGamePrompt?.kind, 'the server asks the first action').toBe('corporationInitialAction');
    expect(asked.waitingFor?.options?.length, 'the first action — or the pass').toBe(2);
    await expect(page.locator('.con-start'), 'the start serves its last stage').toHaveCount(1, {timeout: 60_000});

    // THE PASS: B folds the start to the board, LT opens the basic actions — until the pass is offered.
    let offered = false;
    for (let tries = 0; tries < 4 && !offered; tries++) {
      await press(page, 'Escape', 900);
      offered = await pressUntil(page, 'Comma', async () => await page.locator(PASS).count() > 0, {tries: 2, settleMs: 900});
    }
    expect(offered, 'the basic actions offer the pass over the owed first action').toBe(true);
    await expect(page.locator(PASS), 'the pass is offered').not.toHaveClass(/con-quick__slot--disabled/, {timeout: 15_000});
    expect(await pressUntil(page, 'ArrowDown', async () => await page.locator('.con-confirm').count() > 0, {tries: 3, settleMs: 900}), '↓ asks to confirm the pass').toBe(true);
    for (let tries = 0; tries < 3 && (await wire(request, viewer)).game.generation === 1 && await page.locator('.con-confirm').count() > 0; tries++) {
      await press(page, 'Enter', 1200);
    }
    await expect.poll(async () => (await wire(request, viewer)).game.generation, {timeout: 30_000, message: 'the server took the pass: the generation moved on'})
      .toBe(2);

    // THE OPENING IS OVER for this seat: no start stands under the next generation — neither on the stack nor PARKED
    // (a parked start is a way back the bar offers: in game 333 the pilot took it, and the start served nothing).
    await settle(page, {timeoutMs: 60_000});
    const startStands = () => page.evaluate(() => {
      const d = (window as unknown as {__conColonyDiag?: () => {stack: Array<{kind: string}>, parked: Array<string>}}).__conColonyDiag?.();
      return d === undefined ? 'no diag' : [...d.stack.map((f) => `live:${f.kind}`), ...d.parked.map((k) => `parked:${k}`)].filter((k) => k.endsWith(':start')).join(' ');
    });
    await expect.poll(startStands, {timeout: 30_000, message: 'no start frame, live or parked, under the next generation'}).toBe('');
    await expect(page.locator('.con-start'), 'no start scene on screen').toHaveCount(0);
    expect((await wire(request, viewer)).thisPlayer.tableau.some((c) => c.name === 'Inventrix'), "the corporation is still the seat's").toBe(true);
  });
});
