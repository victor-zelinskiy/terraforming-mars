import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  answerPrompt, fetchPlayerModel, fillPicks, handCount, openConsole, pickCalmCorporation, playQueueCard, press, queueCards, sendPlayerInput, settle,
  submitSummary, waitForBoardHome, waitQueueIdle, walkToSummary,
} from './consoleStart';
import {campaignModelAs, createCampaign, devCommit, launchMission} from './campaignFixtures';

/**
 * THE START'S «НАСЛЕДИЕ» ROW PRESSED TOO EARLY (PL-1106, the owner's QA report 2026-10-27): right after the bought
 * cards' payment the carried cards' row stands, the bought cascade is still flying into the dock and the payment's
 * answer is still presenting — the funnel is BUSY, and a press then used to launch the legacy cascade for a submit the
 * transport silently dropped: the cards lifted off, hung in the air and dissolved, the row stood on.
 *
 * The stand (mission 2 of a campaign, two carried projects for the viewer's seat, two bought projects):
 *  1. the pay press → the bought cards fly; while they are in the air the «Наследие» row is already the ring's item;
 *  2. A at once → the press is REFUSED and NAMED (`data-start-press-refused` = `request` | `delivery`), no legacy
 *     delivery episode opens, the server was never asked (the carried cards are not in the hand), the bar reads the
 *     wait (A dim);
 *  3. the cascade lands, the bar offers «Получить» again → A → the carried cards fly ONCE and land: the server grants
 *     them, the dock holds bought + carried, nothing is withheld or in flight, no refuted landing.
 */
const CARRIED = ['Ants', 'Algae'];
const LINEAGE = 'Teractor';

type Wire = {cardsInHand?: Array<{name: string}>, waitingFor?: {type: string, startGamePrompt?: {kind: string}}};
type IntakeDiag = {activeRuns: number, episodes: Array<{role: string, phase: string}>, held: Array<string>, inFlight: Array<string>, refuted: Array<string>};

const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;
const intakeDiag = (page: Page): Promise<IntakeDiag> => page.evaluate(() => (window as unknown as {__conIntakeDiag: () => IntakeDiag}).__conIntakeDiag());
const refusal = (page: Page): Promise<string> => page.evaluate(() => document.querySelector('.con-start')?.getAttribute('data-start-press-refused') ?? '');
const legacyFocused = (page: Page): Promise<boolean> => page.evaluate(() => document.querySelector('.con-start__legacy.con-start__buy--focused') !== null);
const legacyRowUp = (page: Page): Promise<boolean> => page.evaluate(() => document.querySelector('.con-start__legacy') !== null);
const sceneDiag = (page: Page): Promise<string> => page.evaluate(() => {
  const start = document.querySelector('.con-start');
  const ready = (window as unknown as {__conReady?: () => unknown}).__conReady?.();
  return JSON.stringify({
    startClass: start?.className ?? 'NO .con-start',
    refused: start?.getAttribute('data-start-press-refused'),
    legacy: document.querySelector('.con-start__legacy')?.className,
    bar: (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ready: JSON.stringify(ready ?? {}).slice(0, 1200),
  });
});

/** The second seat answers its wizard over the API (one corporation, no projects) — the table is not pinned in research. */
async function answerSecondSeat(request: APIRequestContext, playerId: string): Promise<void> {
  const model = await fetchPlayerModel(request, playerId);
  const prompt = model.waitingFor;
  expect(prompt?.type, 'the second seat opens on its setup wizard').toBe('initialCards');
  await sendPlayerInput(request, playerId, {
    type: 'initialCards',
    responses: (prompt?.options ?? []).map((step) => ({
      type: 'card',
      cards: (step.cards ?? []).map((c) => c.name).slice(0, step.min ?? 0),
    })),
  });
}

/**
 * THE SECOND SEAT OWES THE TABLE ITS OWN OPENING — and, when the random seating gives it the FIRST turn, that turn: played
 * out over the API (`answerPrompt`, the seeder's own answers), passing at the action menu. Whether Bruno sits first is the
 * deal's, never the spec's subject — left to the deal, «board home» never came for the viewer half the time
 * («Ожидаем ход игрока Bruno», the 2026-10-30 whole-suite run). Bounded: a seat with nothing to answer owes nothing now.
 */
async function drainSecondSeat(request: APIRequestContext, playerId: string): Promise<void> {
  for (let round = 0; round < 24; round++) {
    const prompt = (await fetchPlayerModel(request, playerId)).waitingFor;
    if (prompt === undefined) {
      return;
    }
    const pass = (prompt.options ?? []).findIndex((o) => String(o.title).startsWith('Pass for this generation'));
    await sendPlayerInput(request, playerId, pass >= 0 ? {type: 'or', index: pass, response: {type: 'option'}} : answerPrompt(prompt, {}));
  }
}

test.describe('the start · «Наследие» pressed while the bought cards are still arriving', () => {
  test('the early press is refused and named, the later one delivers the carried cards once', async ({page, request}) => {
    test.setTimeout(300_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    const {id} = await createCampaign(request);
    await devCommit(request, id, [0, 1], {
      lineages: {0: [LINEAGE], 1: ['Helion']},
      carryover: {0: CARRIED, 1: []},
    });
    const {gameId, yourPlayerId} = await launchMission(request, id);
    expect(yourPlayerId).toBeTruthy();
    const bruno = (await campaignModelAs(request, id, 'Bruno')).missions.find((m) => m.gameId === gameId)?.yourPlayerId;
    expect(bruno, 'the second seat\'s player id').toBeTruthy();
    await answerSecondSeat(request, bruno!);

    await openConsole(page, yourPlayerId!);
    await page.waitForSelector('.con-start__frame', {timeout: 60_000});
    let bought: Array<string> = [];
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          await pickCalmCorporation(p);
        } else if (kind === 'project') {
          bought = await fillPicks(p, 2);
          expect(bought, 'two projects bought').toHaveLength(2);
        }
      },
    });
    await submitSummary(page);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await settle(page, {timeoutMs: 30_000});

    // The deployment up to the PAY item: every corporation press (the lineage's, the merge's) first.
    for (let i = 0; i < 6 && await page.locator('.con-start__buy--focused:not(.con-start__legacy)').count() === 0; i++) {
      const queue = await queueCards(page);
      if (queue.length > 0) {
        await playQueueCard(page, queue[0]);
        await waitQueueIdle(page);
      } else {
        for (let hop = 0; hop < 6 && await page.locator('.con-start__buy--focused').count() === 0; hop++) {
          await press(page, 'ArrowRight', 260);
        }
      }
    }
    await expect(page.locator('.con-start__buy--focused:not(.con-start__legacy)'), 'the purchase owns the ring').toHaveCount(1);
    const dockBefore = await handCount(page);

    // 1. THE PAY PRESS — the bought cards leave the grid for the dock; the legacy row is the ring's next item.
    await page.keyboard.press('Enter');
    await expect.poll(() => legacyRowUp(page), {timeout: 20_000, message: 'the carried cards\' row stands after the payment'}).toBe(true);
    for (let hop = 0; hop < 6 && !await legacyFocused(page); hop++) {
      await press(page, 'ArrowRight', 60);
    }
    expect(await legacyFocused(page), 'the «Наследие» row owns the ring').toBe(true);

    // 2. THE EARLY PRESS — refused and named; no legacy episode opens; the server was never asked.
    await page.keyboard.press('Enter');
    await expect.poll(() => refusal(page), {timeout: 5_000, message: 'the early press is REFUSED and named'}).toMatch(/^(request|delivery)$/);
    console.log('[legacy-stand] after the early press:', await sceneDiag(page));
    const diagEarly = await intakeDiag(page);
    expect(diagEarly.episodes.filter((e) => e.role === 'legacy' && e.phase === 'flying'), `no legacy cascade for a dropped submit (${JSON.stringify(diagEarly)})`).toEqual([]);
    const wireEarly = await wireOf(request, yourPlayerId!);
    expect(wireEarly.cardsInHand?.map((c) => c.name).filter((n) => CARRIED.includes(n)), 'the carried cards are not granted by the refused press').toEqual([]);
    await expect(page.locator('.con-cmdbar'), 'the bar names the wait').toContainText(/Выполняется…|Карты прилетают…/);

    // 3. THE CASCADE LANDS — the server (its payment answered) now asks for the legacy press and the carried cards are
    //    still not in the hand; the bar offers the press again → A → the carried cards fly ONCE and land.
    await expect.poll(async () => (await intakeDiag(page)).inFlight.length, {timeout: 30_000, message: 'the bought cascade has landed'}).toBe(0);
    await expect.poll(async () => (await wireOf(request, yourPlayerId!)).waitingFor?.startGamePrompt?.kind ?? 'none',
      {timeout: 20_000, message: 'the server asks for the legacy press — the refused press never answered it'}).toBe('campaignLegacy');
    expect((await wireOf(request, yourPlayerId!)).cardsInHand?.map((c) => c.name).filter((n) => CARRIED.includes(n)), 'still not granted').toEqual([]);
    console.log('[legacy-stand] after the landing:', await sceneDiag(page));
    await expect.poll(async () => /Получить/.test(await page.locator('.con-cmdbar').textContent() ?? ''), {timeout: 20_000, message: 'the press is offered again'}).toBe(true);
    await expect.poll(async () => {
      await page.keyboard.press('Enter');
      const w = await wireOf(request, yourPlayerId!);
      return (w.cardsInHand ?? []).filter((c) => CARRIED.includes(c.name)).length;
    }, {timeout: 30_000, intervals: [400, 800, 1200], message: 'the honoured press grants the carried cards'}).toBe(CARRIED.length);
    await expect.poll(async () => {
      const d = await intakeDiag(page);
      return d.inFlight.length + d.held.length + d.activeRuns;
    }, {timeout: 40_000, message: 'nothing hangs in the air, nothing is withheld'}).toBe(0);
    const diagDone = await intakeDiag(page);
    expect(diagDone.refuted, `no landing was refuted (${JSON.stringify(diagDone)})`).toEqual([]);
    expect(diagDone.episodes.find((e) => e.role === 'legacy')?.phase, 'the legacy episode ran exactly once, to its end').toBe('done');
    await expect.poll(() => handCount(page), {timeout: 20_000, message: 'the dock holds the bought and the carried cards'}).toBe(dockBefore + bought.length + CARRIED.length);
    await expect.poll(() => legacyRowUp(page), {timeout: 20_000, message: 'the row has left'}).toBe(false);

    await drainSecondSeat(request, bruno!);
    await waitForBoardHome(page);
    expect(errors, 'no page errors').toEqual([]);
  });
});
