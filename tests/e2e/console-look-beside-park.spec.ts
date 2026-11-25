import {test, expect, APIRequestContext, Page} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, fetchPlayerModel, openCardActions, openQuickWheel, press, pressUntil, settle, takeRevealCards, walkFocusUntil} from './consoleStart';
import {readSettled} from './settledRead';

/**
 * A LOOK BESIDE ITS OWN PARK OWNS NO FLOW — «Действия карт» opened from the wheel while a card action's own step is
 * set aside is a look: nothing is owed to it, the wait graph names nothing, and the plate brings the step back.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, the zero bar — the fourth hundred of whole games, game 1210, 2026-11-25). The
 * Reds' party action draws and then owes a discard, a hand step inside the action workspace. The player collapses it
 * (B «Свернуть») to read the board, and then opens «Действия карт» from the RT wheel. By the wheel's law that is a
 * FRESH look beside the parked flow («посмотреть», never «вернуться» — `console-card-trade-resume`). But the shell's
 * «the discard is owed to this workspace» read `workspaceFrameMounted('card-actions')` — true for the look — and the
 * conclusion's debt moved from «parked: the player restores it» to «owed-step: the server's follow-up», which could
 * never come: `[wait-graph] dead-end conclusion:card-actions … the follow-up step cannot come — standing 13 s`, and a
 * cure door with «nothing to do». A defect line over a screen doing exactly what the law says.
 *
 * The law now: `workspaceFlowFrameMounted(kind)` — the frame that owns the flow, never a look beside its own park.
 *
 * Fixture `parliament-actions` (the Reds in the government's hall, their action free). «Done» is the SERVER's word
 * (the prompt's id); the one pause is the spec's SUBJECT — the wait graph's own confirmation window.
 */
type Wire = {waitingFor?: {type?: string, promptId?: number}};
const wire = async (request: APIRequestContext, seat: string): Promise<Wire> => await fetchPlayerModel(request, seat) as unknown as Wire;
const bar = (page: Page): Promise<string> => page.evaluate(() => (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim());
const frames = (page: Page): Promise<string> =>
  page.evaluate(() => (window as unknown as {__conReady: () => {wsFrames?: Array<string>}}).__conReady().wsFrames?.join('>') ?? '');
const DISCARD = '.con-cardactions .con-composer__handzone .con-hand--discard';
/** The wait graph confirms a finding over its standing streak — past it, a dead end would have been said. */
const GRAPH_WINDOW_MS = 18_000;

/** The cursor onto a party's tile of the action menu — by the grid's geometry, the ring walk as the fallback (the walk of `console-parliament-actions`). */
async function focusPartyTile(page: Page, party: string): Promise<void> {
  const focused = () => page.evaluate(() => {
    const tile = document.querySelector('.con-cardactions__tile--focused');
    return tile?.getAttribute('data-action-party') ?? tile?.getAttribute('data-action-card') ?? '';
  });
  await expect(page.locator(`.con-cardactions__tile[data-action-party="${party}"]`), `the «${party}» tile is in the menu`).toHaveCount(1);
  const trail: Array<string> = [];
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
    trail.push(`${await focused()}→${dir}`);
    await press(page, dir, 260);
  }
  if (await focused() !== party) {
    // A grid that does not answer the geometry (a column-major ring): fall back to the ring walk.
    await walkFocusUntil(page, async () => await focused() === party, focused, 30);
  }
  expect(await focused(), `never focused the «${party}» party tile (trail: ${trail.join(' ')})`).toBe(party);
}

test.describe('a look beside its own park owns no flow', () => {
  test('the Reds\' discard set aside, «Действия карт» from the wheel: a fresh look, no dead end — and the plate brings the step back', async ({page, request}) => {
    test.setTimeout(300_000);
    const said: Array<string> = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[wait-graph]') || text.includes('[workspace-conclusion]') || text.includes('vue-error')) {
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
    const asked = (await wire(request, playerId)).waitingFor?.promptId;

    // B «Свернуть» — the step is set aside; the board's home offers its way back.
    // (A VISIBLE TOAST TAKES B FIRST — the console's law: the draw's own notices are closed one press each, and the next
    // B is the screen's.)
    expect(await pressUntil(page, 'Escape', async () => await frames(page) === '', {tries: 12, settleMs: 1200}),
      `B sets the discard aside (frames «${await frames(page)}»)`).toBe(true);
    await expect.poll(() => bar(page), {timeout: 20_000, message: 'the home offers the way back to the discard'}).toMatch(/A\s*Вернуться/);

    // RT → ↑ «Действия карт»: a LOOK — a fresh browse beside the parked flow, the discard nowhere in it.
    await openQuickWheel(page);
    expect(await pressUntil(page, 'ArrowUp', async () => (await frames(page)).startsWith('card-actions:browse'), {tries: 3, settleMs: 1500}),
      'the wheel opens a fresh look of the card actions').toBe(true);
    await expect(page.locator(DISCARD), 'the look carries no step').toHaveCount(0);

    // THE WAIT GRAPH's WINDOW PASSES OVER THE LOOK. (The spec's subject: «dead-end … standing 13 s» was said here.)
    await cinematicBeat(page, GRAPH_WINDOW_MS, 'the wait graph\'s confirmation window over the look — where the dead end used to be named');
    expect(said.filter((line) => /dead-end|cure dead-end|dangling|cycle/.test(line)), 'the graph names nothing over a look').toEqual([]);
    expect((await wire(request, playerId)).waitingFor?.promptId, 'the question stands as it stood').toBe(asked);

    // B closes the look; A on the plate brings the STEP back — the same discard, inside the same workspace.
    expect(await pressUntil(page, 'Escape', async () => await frames(page) === '', {tries: 12, settleMs: 1200}), 'B closes the look').toBe(true);
    await expect.poll(() => bar(page), {timeout: 20_000, message: 'the way back is still offered'}).toMatch(/A\s*Вернуться/);
    expect(await pressUntil(page, 'Enter', async () => await page.locator(DISCARD).count() > 0, {tries: 4, settleMs: 2500}), 'A restores the discard step').toBe(true);
    expect((await wire(request, playerId)).waitingFor?.promptId, 'nothing was answered on the way').toBe(asked);
    expect(said.filter((line) => /dead-end|vue-error/.test(line))).toEqual([]);
  });
});
