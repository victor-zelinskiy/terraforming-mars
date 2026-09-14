import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openCardActions, openMandatoryAnnounce, openQuickWheel, openZoomViewer, press, pressUntil,
  sendPlayerInput, settle, takeRevealCards, waitForBoardHome, walkFocusUntil,
} from './consoleStart';

/**
 * THE PARTY ACTIONS ARE ACTIONS (Turmoil Redux) — they live in the standard
 * action menu («ДЕЙСТВИЯ КАРТ») as sources of their own, beside the cards,
 * and the Parliament keeps only a CONTEXTUAL door from a party's detail. Both
 * doors open the SAME composer over the SAME server prompt, so limits and
 * availability can never disagree:
 *
 *   INDUSTRIALISTS — from the ACTION MENU: two picks (decrease / increase),
 *     one commit; the production moved on the server; the flow leaves.
 *   SCIENTISTS — from the PARLIAMENT's party detail (the contextual door): a
 *     resource, a target card, a commit; Tardigrades holds 2 microbes.
 *   UNITY — from the ACTION MENU: the colony workspace stands inside the
 *     action menu (one crumb) with the trade fee LOCKED to the free Unity
 *     path; B walks back out and nothing was spent.
 *   REDS — from the ACTION MENU: one confirm draws at once (the action is spent
 *     at that press — leaving and coming back cannot draw again), the
 *     mandatory discard follows, the hand size is back where it was.
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
const pact = (page: Page, kind: string) => page.locator(`.con-pact[data-pact="${kind}"]`);

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

/**
 * In «ДЕЙСТВИЯ КАРТ»: steer the cursor onto a PARTY's action tile. The menu is
 * a 2-D grid (groups flow in columns), so the walk is steered by GEOMETRY —
 * each hop goes toward the target's measured rect — with the focused tile's
 * identity as the positive witness on every step.
 */
async function focusPartyTile(page: Page, party: string): Promise<void> {
  const focused = () => page.evaluate(() => {
    const tile = document.querySelector('.con-cardactions__tile--focused');
    return tile?.getAttribute('data-action-party') ?? tile?.getAttribute('data-action-card') ?? '';
  });
  await expect(page.locator(`.con-cardactions__tile[data-action-party="${party}"]`), `the «${party}» tile is in the menu`).toHaveCount(1);
  const trail: Array<string> = [];
  for (let i = 0; i < 16 && await focused() !== party; i++) {
    const dir = await page.evaluate((target) => {
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
    }, party);
    trail.push(`${await focused()}→${dir}`);
    await press(page, dir, 260);
  }
  if (await focused() !== party) {
    // A grid that does not answer the geometry (a column-major ring): fall back to the ring walk.
    await walkFocusUntil(page, async () => await focused() === party, focused, 30);
  }
  expect(await focused(), `never focused the «${party}» party tile (trail: ${trail.join(' ')})`).toBe(party);
}

/** A on a focused party tile: the party composer descends into the stage. */
async function openPartyComposer(page: Page, kind: string): Promise<void> {
  expect(await pressUntil(page, 'Enter', async () => await pact(page, kind).count() > 0, {tries: 3, settleMs: 1100}),
    `A must open the «${kind}» party composer`).toBeTruthy();
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

/** The Parliament's action stage grows over the Agenda, never past it, and its commit row is whole. */
async function expectActionStageFits(page: Page, label: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const out: Array<string> = [];
    const stage = document.querySelector('.con-parl__stage')?.getBoundingClientRect();
    const agenda = document.querySelector('.con-parl__agenda')?.getBoundingClientRect();
    const cta = document.querySelector('.con-parl__stage [data-pact-cta]')?.getBoundingClientRect();
    if (stage === undefined || agenda === undefined || cta === undefined) {
      return ['missing stage / agenda / commit row'];
    }
    if (stage.bottom > agenda.bottom + 1) {
      out.push(`stage bottom ${Math.round(stage.bottom)} past the Agenda ${Math.round(agenda.bottom)}`);
    }
    if (cta.bottom > stage.bottom + 1 || cta.top < stage.top) {
      out.push(`commit row ${Math.round(cta.top)}..${Math.round(cta.bottom)} outside the stage ${Math.round(stage.top)}..${Math.round(stage.bottom)}`);
    }
    for (const row of Array.from(document.querySelectorAll<HTMLElement>('.con-parl__stage .con-pact__row'))) {
      const r = row.getBoundingClientRect();
      if (r.bottom > stage.bottom + 1) {
        out.push(`a decision row runs under the stage edge (${Math.round(r.bottom)} > ${Math.round(stage.bottom)})`);
      }
    }
    return out;
  });
  expect(problems, `${label}: the party action stage fits`).toEqual([]);
}

for (const preset of [
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const) {
  test.describe(`parliament · party action stage · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});
    test(`the Parliament's contextual door composes inside the workspace (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, 'parliament-actions', {query: preset.query});
      await openParliament(page);
      await press(page, 'ArrowDown', 400);
      const partyFocused = () => page.evaluate(() => document.querySelector('.con-parl__party--focus')?.getAttribute('data-party') ?? '');
      expect(await walkFocusUntil(page, async () => await partyFocused() === 'Scientists', partyFocused, 12), 'never focused the Scientists tile').toBeTruthy();
      expect(await pressUntil(page, 'Enter', async () => await pact(page, 'scientists').count() > 0, {tries: 3, settleMs: 1100})).toBeTruthy();
      await settle(page, {timeoutMs: 10_000});
      await expectActionStageFits(page, preset.id);
      const dir = path.resolve('screenshots', 'parliament-actions', preset.id);
      fs.mkdirSync(dir, {recursive: true});
      await page.screenshot({path: path.join(dir, '01-scientists-stage.png')});
      expect(await pressUntil(page, 'Escape', async () => await pact(page, 'scientists').count() === 0, {tries: 3, settleMs: 900}),
        'B folds the stage back to the parties').toBeTruthy();
    });
  });
}

test.describe('parliament · party actions', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('Industrialists (action menu) · Scientists (Parliament door) · Unity (nested trade) · Reds (draw, then the mandatory discard)', async ({page, request}) => {
    test.setTimeout(480_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-actions', {query: '&consoleProfile=auto'});
    const opponent = seats[1];

    // ── The Parliament carries NO actions column: party actions are actions. ──
    await openParliament(page);
    await expect(page.locator('[data-zone="actions"], .con-parl__tile'), 'no action catalog inside the Parliament').toHaveCount(0);
    expect(await pressUntil(page, 'Escape', async () => await parliament(page).count() === 0, {tries: 4, settleMs: 900})).toBeTruthy();
    await settle(page);

    // ── INDUSTRIALISTS from the action menu ──
    await openCardActions(page);
    await expect(page.locator('.con-cardactions__tile[data-action-party]'), 'the four party actions stand in the action menu').toHaveCount(4);
    await focusPartyTile(page, 'Industrialists');
    await shoot(page, '01-action-menu-parties');
    const before = (await seatOf(request, playerId)).seat;
    await openPartyComposer(page, 'industrialists');
    const crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, `one crumb: the action menu, the party (${crumb})`).toContain('ДЕЙСТВИЯ КАРТ');
    expect(crumb).toContain('ИНДУСТРИАЛИСТЫ');
    await shoot(page, '02-industrialists-stage');
    await press(page, 'Enter', 500); // pick the decrease under the cursor → the cursor moves to the increase row
    await expect(page.locator('.con-pact__opt--picked')).toHaveCount(1);
    // X inspects the SOURCE (the party's banner) over the stage — the pick survives it.
    await openZoomViewer(page);
    await closeZoomViewer(page);
    await expect(page.locator('.con-pact__opt--picked'), 'inspecting the party keeps the pick made').toHaveCount(1);
    await press(page, 'Enter', 500); // pick the increase → the cursor lands on the commit row
    await expect(page.locator('.con-pact__opt--picked')).toHaveCount(2);
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
    await expect(page.locator('.con-cardactions'), 'a finished flow leaves the workspace').toHaveCount(0);

    // ── SCIENTISTS from the Parliament's party detail ──
    await openParliament(page);
    await press(page, 'ArrowDown', 400); // voting → parties
    const partyFocused = () => page.evaluate(() => document.querySelector('.con-parl__party--focus')?.getAttribute('data-party') ?? '');
    expect(await walkFocusUntil(page, async () => await partyFocused() === 'Scientists', partyFocused, 12), 'never focused the Scientists tile').toBeTruthy();
    await expect(page.locator('.con-parl__pdetail[data-party="Scientists"]'), 'the detail zone explains the focused party').toHaveCount(1);
    await shoot(page, '04-parliament-party-detail');
    expect(await pressUntil(page, 'Enter', async () => await pact(page, 'scientists').count() > 0, {tries: 3, settleMs: 1100}),
      'A on the party opens its action as a Parliament stage').toBeTruthy();
    await expect(page.locator('.con-parl__stage[data-parl-stage="action"]')).toHaveCount(1);
    await settle(page, {timeoutMs: 8_000});
    await expectActionStageFits(page, 'standard-1080');
    await shoot(page, '05-scientists-stage');
    await press(page, 'Enter', 500); // the resource under the cursor → the target row
    await press(page, 'Enter', 500); // the target card → the commit row
    await expect(page.locator('.con-pact__opt--picked, .con-pact__card--picked')).toHaveCount(2);
    await press(page, 'Enter', 900); // commit
    await expect.poll(async () => (await seatOf(request, playerId)).seat.tableau.find((c) => c.name === 'Tardigrades')?.resources ?? -1,
      {timeout: 20_000, message: 'Tardigrades received 2 microbes'}).toBe(2);
    expect(await usesLeft(request, playerId, 'scientists-lab')).toBe(0);
    await waitForBoardHome(page, 30);

    // Two actions spent — the opponent's turn. It passes; blue is back on.
    await passSeat(request, opponent);
    await expect.poll(async () => (await seatOf(request, playerId)).waitingFor?.type, {timeout: 20_000, message: 'blue holds the action menu again'}).toBe('or');
    await settle(page, {timeoutMs: 15_000});

    // ── UNITY: the trade inside the action menu, fee locked to the party path ──
    await openCardActions(page);
    // The spent actions follow the menu's own rule for a used action: out of
    // the default «not activated» view, listed under «Активированы».
    await expect(page.locator('.con-cardactions__tile[data-action-party="Scientists"]'), 'a used party action leaves the default view').toHaveCount(0);
    expect(await pressUntil(page, 'Period', async () => await page.locator('.con-cardactions__tile--activated[data-action-party="Scientists"]').count() > 0, {tries: 3, settleMs: 700}),
      'RT shows the activated actions: the used Scientists action is there').toBeTruthy();
    await shoot(page, '06a-action-menu-activated');
    expect(await pressUntil(page, 'Comma', async () => await page.locator('.con-cardactions__tile[data-action-party="Unity"]').count() > 0, {tries: 3, settleMs: 700}),
      'LT returns to the actions still to take').toBeTruthy();
    await focusPartyTile(page, 'Unity');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colonies').count() > 0, {tries: 3, settleMs: 1200}),
      'A on the Unity tile opens the colony workspace inside the action menu').toBeTruthy();
    await settle(page, {timeoutMs: 15_000});
    expect((await crumbText(page)).toUpperCase(), 'one crumb: the action menu, the party, the trade').toContain('ДЕЙСТВИЯ КАРТ');
    await shoot(page, '06-unity-colonies-nested');
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus__payrow').count() > 0, {tries: 3, settleMs: 1500}),
      'A on a colony opens its trade stage').toBeTruthy();
    await expect(page.locator('.con-colfocus__payrow', {hasText: /бесплатно/i}), 'the free Unity path is on offer').not.toHaveCount(0);
    await settle(page, {timeoutMs: 10_000});
    // The colony stage stands in the WHOLE focus stage — the party composer's
    // zone once collapsed to 0 px and the trade laid itself out in no room.
    const colonyStage = await page.locator('.con-colfocus').evaluate((el) => el.getBoundingClientRect().height);
    expect(colonyStage, 'the colony trade stage has the room of the focus stage').toBeGreaterThan(300);
    await expect(page.locator('.con-colfocus__payrow', {hasText: /бесплатно/i}).first(), 'the free path is on screen').toBeVisible();
    await shoot(page, '07-unity-free-path');
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-colonies').count() === 0, {tries: 5, settleMs: 900}),
      'B walks the trade back out').toBeTruthy();
    expect(await usesLeft(request, playerId, 'unity-trade'), 'nothing was spent — the trade was not committed').toBe(1);
    await settle(page, {timeoutMs: 10_000});

    // ── REDS: confirm → draw 2 at once → the mandatory discard ──
    if (await page.locator('.con-cardactions').count() === 0) {
      await openCardActions(page);
    }
    const beforeReds = (await seatOf(request, playerId)).seat;
    await focusPartyTile(page, 'Reds');
    await openPartyComposer(page, 'reds');
    await shoot(page, '08-reds-stage');
    await press(page, 'Enter', 1500); // the cursor opens on the commit row: the draw happens now
    await expect.poll(async () => (await seatOf(request, playerId)).waitingFor?.type, {timeout: 20_000, message: 'the discard prompt stands'}).toBe('card');
    // The action is spent AT THE DRAW — no way back to a second free draw.
    expect(await usesLeft(request, playerId, 'reds-recycle'), 'the Reds action is spent at the draw').toBe(0);
    await expect(page.locator('.con-reveal'), 'the drawn cards are presented').toHaveCount(1, {timeout: 20_000});
    await shoot(page, '09-reds-drawn');
    await takeRevealCards(page);
    if (await page.locator('.con-hand--discard').count() === 0) {
      expect(await openMandatoryAnnounce(page), 'the mandatory discard is announced; A opens the hand').toBeTruthy();
    }
    await expect(page.locator('.con-hand--discard'), 'the hand in discard mode').toHaveCount(1, {timeout: 20_000});
    await settle(page, {timeoutMs: 15_000});
    await expect(page.locator('.con-hand__discard')).toContainText(/Красные/);
    await shoot(page, '10-reds-discard');
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
    await shoot(page, '11-after-reds');
  });
});
