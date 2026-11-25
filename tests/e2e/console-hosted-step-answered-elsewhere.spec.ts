import {test, expect, APIRequestContext, Page} from './consoleTest';
import {answerPrompt, bootFixtureSeats, cinematicBeat, fetchPlayerModel, openCardActions, press, pressUntil, sendPlayerInput, settle, takeRevealCards, walkFocusUntil} from './consoleStart';
import {readSettled} from './settledRead';

/**
 * A HOSTED STEP LIVES FOR ITS QUESTION — the Reds' discard, a hand step inside «Действия карт», answered ANOTHER way
 * than by the hand (another device, a reload, the autopilot's door) takes its step down; the card action's workspace
 * then concludes as a finished flow does.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO — CI #148, the autopilot's game 1125). The hosted hand left only through its own
 * answer. Answered elsewhere, it stayed — serving the NEXT turn's menu inside the old flow («Действия карт › … A
 * Разыграть»), and the card centre's conclusion held «nested-step» for good: `[wait-graph] overdue
 * conclusion:card-actions … standing 33 s`. The law now (`handController.whenHostedHandQuestionChanges`): the step
 * remembers the question it was opened for; a question of its own kind keeps it, any other takes it down.
 *
 * Fixture `parliament-actions` (the Reds in the government's hall, their action free). «Done» is the SERVER's word (the
 * prompt's id) and the stack's (`__conReady().wsFrames`); the one pause is the spec's SUBJECT — the wait graph's window.
 */
type Wire = {waitingFor?: {type?: string, promptId?: number}};
const wire = async (request: APIRequestContext, seat: string): Promise<Wire> => await fetchPlayerModel(request, seat) as unknown as Wire;
const frames = (page: Page): Promise<string> =>
  page.evaluate(() => (window as unknown as {__conReady: () => {wsFrames?: Array<string>}}).__conReady().wsFrames?.join('>') ?? '');
const DISCARD = '.con-cardactions .con-composer__handzone .con-hand--discard';
/** The wait graph confirms a finding over its standing streak — past it, an overdue conclusion would have been said. */
const GRAPH_WINDOW_MS = 18_000;

/** The cursor onto a party's tile of the action menu — by the grid's geometry, the ring walk as the fallback. */
async function focusPartyTile(page: Page, party: string): Promise<void> {
  const focused = () => page.evaluate(() => {
    const tile = document.querySelector('.con-cardactions__tile--focused');
    return tile?.getAttribute('data-action-party') ?? tile?.getAttribute('data-action-card') ?? '';
  });
  await expect(page.locator(`.con-cardactions__tile[data-action-party="${party}"]`), `the «${party}» tile is in the menu`).toHaveCount(1);
  for (let i = 0; i < 16 && await focused() !== party; i++) {
    const dir = await readSettled(page, () => page.evaluate((target) => {
      const f = document.querySelector('.con-cardactions__tile--focused')?.getBoundingClientRect();
      const t = document.querySelector(`.con-cardactions__tile[data-action-party="${target}"]`)?.getBoundingClientRect();
      if (f === undefined || t === undefined) {
        return 'ArrowRight';
      }
      const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
      const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
      if (Math.abs(dy) > f.height / 2) {
        return dy > 0 ? 'ArrowDown' : 'ArrowUp';
      }
      return dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    }, party), {message: `the hop toward the «${party}» tile`});
    await press(page, dir, 260);
  }
  if (await focused() !== party) {
    await walkFocusUntil(page, async () => await focused() === party, focused, 30);
  }
  expect(await focused(), `never focused the «${party}» party tile`).toBe(party);
}

test.describe('a hosted step lives for its question', () => {
  test('the Reds\' discard answered over the API: the hand step leaves, «Действия карт» concludes — no overdue conclusion', async ({page, request}) => {
    test.setTimeout(300_000);
    const said: Array<string> = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[wait-graph]') || text.includes('[workspace-stall]') || text.includes('vue-error')) {
        said.push(text.slice(0, 300));
      }
    });
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-actions', {query: '&consoleProfile=auto'});

    // THE REDS' ACTION: the tile, the composer, the draw — and the discard it owes, a hand step of the same workspace.
    await openCardActions(page);
    await focusPartyTile(page, 'Reds');
    const composer = page.locator('.con-cardactions .con-composer[data-composer-source="party:Reds"]');
    expect(await pressUntil(page, 'Enter', async () => await composer.count() > 0, {tries: 3, settleMs: 1100}), 'A opens the Reds\' composer').toBe(true);
    await settle(page, {timeoutMs: 8_000});
    expect(await pressUntil(page, 'Enter', async () => (await wire(request, playerId)).waitingFor?.type === 'card', {tries: 3, settleMs: 6_000}),
      'A draws: the server asks for the discard').toBe(true);
    await expect(page.locator('.con-cardactions .con-composer__revealzone--draw .con-reveal'), 'the drawn cards stand in the composer').toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 15_000});
    await takeRevealCards(page);
    await expect(page.locator(DISCARD), 'the discard stands inside the action workspace').toHaveCount(1, {timeout: 30_000});
    await settle(page, {timeoutMs: 15_000});
    expect(await frames(page), 'the hand is a step of the card centre').toMatch(/card-actions.*>hand/);

    // THE DISCARD IS ANSWERED ELSEWHERE — the server's own word, not the hand's.
    const asked = (await wire(request, playerId)).waitingFor;
    expect(asked?.type, 'the discard is asked').toBe('card');
    await sendPlayerInput(request, playerId, {...answerPrompt(asked as never, {}), promptId: asked?.promptId} as never);
    await expect.poll(async () => (await wire(request, playerId)).waitingFor?.promptId, {timeout: 20_000, message: 'the server moved on'}).not.toBe(asked?.promptId);

    // …THE STEP LEAVES, AND THE FINISHED FLOW WITH IT: the stack goes home.
    await expect.poll(() => frames(page), {timeout: 30_000, message: 'the hand step and the card centre leave'}).toBe('');
    // The wait graph's window passes: nothing is overdue, nothing was cured.
    await cinematicBeat(page, GRAPH_WINDOW_MS, 'the wait graph\'s confirmation window — where the overdue conclusion used to be named');
    expect(said.filter((line) => /overdue|dead-end|workspace-stall|vue-error/.test(line)), 'no conclusion stood overdue').toEqual([]);
    expect(await frames(page), 'and nothing came back').toBe('');
  });
});
