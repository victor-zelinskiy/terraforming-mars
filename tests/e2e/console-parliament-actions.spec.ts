import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, openMandatoryAnnounce, openQuickWheel, press, pressUntil, sendPlayerInput, settle, takeRevealCards,
  waitForBoardHome,
} from './consoleStart';

/**
 * THE FOUR PARTY ACTIONS (Turmoil Redux, iteration 0) — each stage of the
 * Parliament workspace from the action tile to the server's own answer:
 *
 *   INDUSTRIALISTS — «Перестроить производство»: two picks (decrease / increase)
 *     and one commit; the production moved on the server.
 *   SCIENTISTS — «Добавить 2 данных или микроба»: a resource, a target card,
 *     a commit; Tardigrades holds 2 microbes on the server.
 *   UNITY — «Бесплатная торговля»: the colony workspace opens INSIDE the
 *     Parliament (a nested frame, one crumb) with the free payment path on
 *     offer; B returns to the Parliament.
 *   REDS — «Взять 2, сбросить 2»: one confirm draws at once, the MANDATORY
 *     discard follows in the hand's discard mode, the hand size is back
 *     where it was and the payout landed.
 *
 * STATE IS DECLARED (the `parliament-actions` fixture): blue holds every
 * action party's effect by grant; a party action is a full ACTION, so the
 * opponent passes over the API between blue's turns.
 */

const OUT_ROOT = path.resolve('screenshots', 'parliament-actions', 'standard-1080');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

const parliament = (page: Page) => page.locator('.con-parl');
const stage = (page: Page) => page.locator('.con-parl__stage');
const focusedTile = (page: Page) => page.locator('.con-parl__tile--focus');

type Seat = {
  megacredits: number;
  cardsInHandNbr: number;
  megacreditProduction: number;
  steelProduction: number;
  titaniumProduction: number;
  plantProduction: number;
  energyProduction: number;
  heatProduction: number;
  tableau: Array<{name: string, resources?: number}>;
};

type ParliamentView = {
  viewer: {partyActions: Array<{id: string, usesLeft: number, available: boolean}>};
};

async function seatOf(request: APIRequestContext, playerId: string): Promise<{seat: Seat, parliament: ParliamentView, waitingFor: {type?: string, options?: Array<{title: string}>} | undefined}> {
  const model = await fetchPlayerModel(request, playerId) as unknown as {
    thisPlayer: Seat, game: {parliament: ParliamentView}, waitingFor?: {type?: string, options?: Array<{title: string}>},
  };
  return {seat: model.thisPlayer, parliament: model.game.parliament, waitingFor: model.waitingFor};
}

function productionOf(seat: Seat): Record<string, number> {
  return {
    megacredits: seat.megacreditProduction, steel: seat.steelProduction, titanium: seat.titaniumProduction,
    plants: seat.plantProduction, energy: seat.energyProduction, heat: seat.heatProduction,
  };
}

async function usesLeft(request: APIRequestContext, playerId: string, id: string): Promise<number> {
  const {parliament} = await seatOf(request, playerId);
  return parliament.viewer.partyActions.find((a) => a.id === id)?.usesLeft ?? -1;
}

/** Open the Parliament from the wheel (RT → down). */
async function openParliament(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await parliament(page).count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

/** Walk the browse ring onto the action tile `id` (a positive witness on every step). */
async function focusActionTile(page: Page, id: string): Promise<void> {
  const zone = () => parliament(page).getAttribute('data-zone');
  if (await zone() !== 'actions') {
    await press(page, 'ArrowDown', 300); // voting → parties
    expect(await pressUntil(page, 'ArrowRight', async () => await zone() === 'actions', {tries: 8, settleMs: 250}),
      'the ring must reach the actions column').toBeTruthy();
  }
  const onTile = async () => await focusedTile(page).getAttribute('data-tile') === id;
  if (!await onTile()) {
    // Left to the first tile, then right until the tile answers.
    for (let i = 0; i < 6 && await focusedTile(page).getAttribute('data-tile') !== 'vote'; i++) {
      await press(page, 'ArrowLeft', 200);
      if (await zone() !== 'actions') {
        await press(page, 'ArrowRight', 200);
        break;
      }
    }
    expect(await pressUntil(page, 'ArrowRight', onTile, {tries: 6, settleMs: 250}), `never focused the «${id}» tile`).toBeTruthy();
  }
}

/** A press that must land the stage `id` inside the workspace. */
async function openStage(page: Page, id: string): Promise<void> {
  const up = async (): Promise<boolean> =>
    await stage(page).count() > 0 && await stage(page).getAttribute('data-parl-stage', {timeout: 1_000}) === id;
  expect(await pressUntil(page, 'Enter', up, {tries: 3, settleMs: 900}),
    `A must open the «${id}» stage (tile: ${await focusedTile(page).getAttribute('data-tile', {timeout: 1_000})})`).toBeTruthy();
  await settle(page, {timeoutMs: 8_000});
}

/** The opponent passes for the generation over the API (its action menu's own option). */
async function passSeat(request: APIRequestContext, playerId: string): Promise<void> {
  const {waitingFor} = await seatOf(request, playerId);
  const options = waitingFor?.options ?? [];
  const index = options.findIndex((o) => String(o.title).startsWith('Pass for this generation'));
  expect(index, `the opponent holds the action menu with a pass option (got ${waitingFor?.type}: ${options.map((o) => o.title).join(' | ')})`).toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, playerId, {type: 'or', index, response: {type: 'option'}});
}

test.describe('parliament · party actions', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('Industrialists · Scientists · Unity (nested trade) · Reds (draw, then the mandatory discard)', async ({page, request}) => {
    test.setTimeout(420_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-actions', {query: '&consoleProfile=auto'});
    const opponent = seats[1];

    // ── INDUSTRIALISTS ──
    await openParliament(page);
    await focusActionTile(page, 'industrialists-shift');
    await shoot(page, '01-actions-column');
    const before = (await seatOf(request, playerId)).seat;
    await openStage(page, 'industrialists');
    await shoot(page, '02-industrialists-stage');
    await press(page, 'Enter', 500); // pick the decrease under the cursor → the cursor moves to the increase row
    await press(page, 'Enter', 500); // pick the increase
    await expect(page.locator('.con-parl__opt--picked')).toHaveCount(2);
    await shoot(page, '03-industrialists-picked');
    await press(page, 'Enter', 900); // commit
    await expect.poll(async () => await usesLeft(request, playerId, 'industrialists-shift'), {timeout: 20_000, message: 'the Industrialists action is spent'}).toBe(0);
    const afterShift = (await seatOf(request, playerId)).seat;
    const delta = Object.entries(productionOf(afterShift)).map(([k, v]) => [k, v - productionOf(before)[k]] as const).filter(([, d]) => d !== 0);
    // −1 on one production, +2 on M€ or energy — the same pool for both is a
    // legal net +1 (the first options under the cursor are both M€).
    expect(delta.reduce((sum, [, d]) => sum + d, 0), `a net +1 production step (${JSON.stringify(delta)})`).toBe(1);
    expect(delta.some(([k, d]) => d > 0 && (k === 'megacredits' || k === 'energy')), `M€ or energy production rose (${JSON.stringify(delta)})`).toBeTruthy();
    await waitForBoardHome(page, 30);

    // ── SCIENTISTS ──
    await openParliament(page);
    await focusActionTile(page, 'scientists-lab');
    await openStage(page, 'scientists');
    await shoot(page, '04-scientists-stage');
    await press(page, 'Enter', 500); // the resource under the cursor → the target row
    await press(page, 'Enter', 500); // the target card
    await expect(page.locator('.con-parl__opt--picked')).toHaveCount(2);
    await press(page, 'Enter', 900); // commit
    await expect.poll(async () => (await seatOf(request, playerId)).seat.tableau.find((c) => c.name === 'Tardigrades')?.resources ?? -1,
      {timeout: 20_000, message: 'Tardigrades received 2 microbes'}).toBe(2);
    expect(await usesLeft(request, playerId, 'scientists-lab')).toBe(0);
    await waitForBoardHome(page, 30);

    // Two actions spent — the opponent's turn. It passes; blue is back on.
    await passSeat(request, opponent);
    await expect.poll(async () => (await seatOf(request, playerId)).waitingFor?.type, {timeout: 20_000, message: 'blue holds the action menu again'}).toBe('or');
    await settle(page, {timeoutMs: 15_000});

    // ── UNITY: the trade inside the Parliament ──
    await openParliament(page);
    await focusActionTile(page, 'unity-trade');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colonies').count() > 0, {tries: 3, settleMs: 1200}),
      'A on the Unity tile opens the colony workspace inside the Parliament').toBeTruthy();
    await settle(page, {timeoutMs: 15_000});
    expect((await crumbText(page)).toUpperCase(), 'one crumb: the Parliament, the party, the trade').toContain('ПАРЛАМЕНТ');
    await shoot(page, '05-unity-colonies-nested');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus__payrow').count() > 0, {tries: 3, settleMs: 1500}),
      'A on a colony opens its trade stage').toBeTruthy();
    await expect(page.locator('.con-colfocus__payrow', {hasText: /бесплатно/i}), 'the free Unity path is on offer').not.toHaveCount(0);
    await shoot(page, '06-unity-free-path');
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-colonies').count() === 0, {tries: 5, settleMs: 900}),
      'B folds the trade back to the Parliament').toBeTruthy();
    await expect(parliament(page)).toHaveCount(1);
    expect(await usesLeft(request, playerId, 'unity-trade'), 'nothing was spent — the trade was not committed').toBe(1);

    // ── REDS: confirm → draw 2 at once → the mandatory discard ──
    const beforeReds = (await seatOf(request, playerId)).seat;
    await focusActionTile(page, 'reds-recycle');
    await openStage(page, 'reds');
    await shoot(page, '07-reds-stage');
    await press(page, 'Enter', 1500); // confirm: the draw happens now
    await expect.poll(async () => (await seatOf(request, playerId)).waitingFor?.type, {timeout: 20_000, message: 'the discard prompt stands'}).toBe('card');
    // The two drawn cards arrive as the ordinary drawn-cards reveal (the party
    // action is their source); the player takes them, THEN the mandatory
    // discard is announced and A opens the hand in discard mode.
    await expect(page.locator('.con-reveal'), 'the drawn cards are presented').toHaveCount(1, {timeout: 20_000});
    await shoot(page, '08-reds-drawn');
    await takeRevealCards(page);
    if (await page.locator('.con-hand--discard').count() === 0) {
      expect(await openMandatoryAnnounce(page), 'the mandatory discard is announced; A opens the hand').toBeTruthy();
    }
    await expect(page.locator('.con-hand--discard'), 'the hand in discard mode').toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 15_000});
    // The header names the PARTY that asks and carries the per-tag payout live.
    await expect(page.locator('.con-hand__discard')).toContainText(/Красные/);
    await expect(page.locator('.con-hand__discard-swap')).toHaveCount(1);
    await shoot(page, '09-reds-discard');
    await press(page, 'Enter', 300); // pick the focused card
    await press(page, 'ArrowRight', 250);
    await press(page, 'Enter', 300); // pick a second one
    await press(page, 'Period', 1200); // RT — confirm the set
    await expect.poll(async () => (await seatOf(request, playerId)).waitingFor?.type, {timeout: 30_000, message: 'the discard was answered'}).not.toBe('card');
    await waitForBoardHome(page, 40);
    const afterReds = (await seatOf(request, playerId)).seat;
    expect(afterReds.cardsInHandNbr, 'drew 2, discarded 2').toBe(beforeReds.cardsInHandNbr);
    expect(afterReds.megacredits, 'the payout never takes money').toBeGreaterThanOrEqual(beforeReds.megacredits);
    expect(await usesLeft(request, playerId, 'reds-recycle')).toBe(0);
    await shoot(page, '10-after-reds');
  });
});
