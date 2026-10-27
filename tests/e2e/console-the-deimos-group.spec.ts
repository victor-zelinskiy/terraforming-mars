import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixtureSeats, bootIntoGame, closeZoomViewer, crumbText, fetchPlayerModel, focusCard, openZoomViewer, press, pressUntil, settle, soloGameConfig, waitForBoardHome,
} from './consoleStart';
import {focusParty, openParliament, parliament} from './parliamentDrive';

/**
 * TR83 THE DEIMOS GROUP — 50 M€, a Mars tag; «as your first action, add a delegate to any resolution»; «you have +2
 * influence; when playing cards, you can ignore all party requirements» (docs/TURMOIL_REDUX_THE_DEIMOS_GROUP.md).
 *
 *   A — THE FIRST ACTION on a real start flow: the briefing says the vote follows the CONFIRM; A → the Parliament takes
 *       the start's scene in its VOTE mode («СТАРТ ПАРТИИ › THE DEIMOS GROUP › ГОЛОСОВАНИЕ» — the Parliament never titles
 *       itself), three resolutions SHOWN; A → ONE answer; the viewer's delegate is CARRIED from the seat's RESERVE onto
 *       the chosen card's ribbon (never a pop); the server holds one delegate, the reserve −1; the start leaves once; the
 *       Parliament's head reads the influence «+2» naming the corporation.
 *   B — THE STANDING WAIVER (fixture `deimos`): Council Seat (the Reds' plate, the Reds out of power, 0 delegates) is
 *       playable — the hand's plate lifts the party cassette with no one-play bolt, the composer's requirement row names
 *       the corporation, the play goes through and the journal says «thanks to»; the Reds' dossier reads «снято».
 * Order claims are sampled from BEFORE the press (MutationObserver + setInterval, never rAF).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'deimos', 'tv');
const DEIMOS = 'The Deimos Group';
const COUNCIL = 'Council Seat';
const REDS = 'Reds';
const COMPOSER = '.con-hand__stage .con-composer--play';

type WireSlot = {instance: string, party: string, votes: Array<{owner: string}>, totalVotes: number};
type WireSeat = {color: string, reserve: number, lobby: boolean, influence: number, influenceSources?: Array<{amount: number, source?: string}>};
type Wire = {
  thisPlayer: {color: string, megaCredits: number, tableau: Array<{name: string}>},
  cardsInHand?: Array<{name: string}>,
  waitingFor?: {type: string, votePrompt?: {source?: string}},
  game: {parliament: {slots: Array<WireSlot>, players: Array<WireSeat>}},
};
type Box = {x: number, y: number, w: number, h: number};
type Flight = {first: {x: number, y: number}, last: {x: number, y: number}, n: number};
type Probe = {samples: number, ticks: number, flights: Record<string, Flight>, parlMax: number, ownHead: boolean, standalone: boolean, crumbs: Array<string>};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}

const seatOf = (wire: Wire) => wire.game.parliament.players.find((p) => p.color === wire.thisPlayer.color)!;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function boxOf(page: Page, selector: string): Promise<Box | undefined> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    return {x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height};
  }, selector);
}

/** From now on: every Parliament flight proxy's first / last painted centre, the Parliament roots, the crumbs. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__tr83: Probe};
    const p: Probe = {samples: 0, ticks: 0, flights: {}, parlMax: 0, ownHead: false, standalone: false, crumbs: []};
    w.__tr83 = p;
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const parls = document.querySelectorAll('.con-parl:not([data-parl-leaving])');
      p.parlMax = Math.max(p.parlMax, parls.length);
      document.querySelectorAll('.con-wshead').forEach((el) => {
        const crumb = text(el);
        if (crumb !== '' && !p.crumbs.includes(crumb)) {
          p.crumbs.push(crumb);
        }
      });
      document.querySelectorAll<HTMLElement>('.con-parl__flight').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || getComputedStyle(el).visibility === 'hidden' || Number(getComputedStyle(el).opacity) < 0.05) {
          return;
        }
        const id = el.getAttribute('data-parl-flight') ?? '?';
        const now = {x: r.left + r.width / 2, y: r.top + r.height / 2};
        const rec = p.flights[id] ?? (p.flights[id] = {first: now, last: now, n: 0});
        rec.last = now;
        rec.n++;
      });
    };
    new MutationObserver(() => sample(false)).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  });
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__tr83: Probe}).__tr83);
const dist = (a: {x: number, y: number}, b: {x: number, y: number}) => Math.hypot(a.x - b.x, a.y - b.y);

/** RT → «КАРТЫ»: the hand album, settled. */
async function openHand(page: Page, first: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${first}"]`).waitFor({timeout: 15_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
  await settle(page);
}

test.describe('TR83 — The Deimos Group: a delegate as the first action, +2 influence, every party requirement lifted', () => {
  test.use({viewport: PRESET.viewport});
  test.setTimeout(300_000);

  test('A — the first action: the Parliament\'s VOTE mode inside the start, ONE answer, the delegate CARRIED from the reserve', async ({page, request}) => {
    const playerId = await bootIntoGame(page, request, {
      config: soloGameConfig({
        expansions: {colonies: true, turmoilRedux: true},
        startingCorporations: 1,
        customCorporationsList: [DEIMOS],
      }),
      corporation: DEIMOS,
      buy: 0,
      until: 'startRelease',
      query: PRESET.query,
    });

    const stage = page.locator('.con-start__firstact');
    await stage.waitFor({state: 'visible', timeout: 60_000});
    await settle(page, {timeoutMs: 20_000});
    // THE BRIEFING: the printed action, and the vote as the step AFTER the confirm (never «after the play»).
    await expect(stage, 'the printed first action').toContainText(/Добавьте делегата на любую резолюцию/);
    await expect(stage, 'the vote follows the confirm, in the Parliament').toContainText(/после подтверждения — выбор в Парламенте/);
    const before = await wireOf(request, playerId);
    const seat0 = seatOf(before);
    expect(seat0.influenceSources, 'the +2 stands on the ledger from the corporation\'s play').toEqual([{amount: 2, source: DEIMOS}]);
    expect(before.game.parliament.slots.length, 'three resolutions up for the vote').toBe(3);
    await shoot(page, '01-first-action');

    // A on «ПЕРВОЕ ДЕЙСТВИЕ» → the server raises the GRANT (a cause split from the client's).
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.votePrompt?.source ?? 'none',
      {timeout: 30_000, message: 'the server raises the delegate grant after the first action'}).toBe('grant');
    const vote = page.locator('.con-parl__vote.con-parl__vote--up');
    try {
      await expect(vote, 'the vote mode opens inside the start flow').toHaveCount(1, {timeout: 40_000});
    } catch (e) {
      const diag = await page.evaluate(() => JSON.stringify((window as unknown as {__conReady?: () => unknown}).__conReady?.() ?? {}));
      console.log('[deimos-diag]', diag.slice(0, 3000), '| parl:', await page.locator('.con-parl').count(), '| crumb:', await crumbText(page));
      throw e;
    }
    await settle(page, {timeoutMs: 20_000});
    expect((await crumbText(page)).toUpperCase(), 'the crumb: the start\'s flow, one level deeper').toMatch(/СТАРТ ПАРТИИ.*THE DEIMOS GROUP.*ГОЛОСОВАНИЕ/);
    // The start row hands the Parliament the whole SCENE (`frameSteps: {parliament: 'scene'}` — Septem's road): ONE instance,
    // standing as the start's step (the crumb above), never a second Parliament beside it.
    await expect(page.locator('.con-parl:not([data-parl-leaving])'), 'ONE Parliament instance').toHaveCount(1);
    expect(await page.locator('.con-parl__slot').count(), 'three cards on offer').toBeGreaterThanOrEqual(3);
    await shoot(page, '02-vote-in-start');

    // THE PRESS: one delegate from the RESERVE onto the selected card's ribbon.
    const reserveSel = `[data-parl-seat-reserve="${before.thisPlayer.color}"]`;
    const reserveBox = await boxOf(page, reserveSel);
    const ribbonBox = await boxOf(page, '[data-parl-vote-ribbon]');
    expect(reserveBox, 'the reserve stack is on screen').toBeDefined();
    expect(ribbonBox, 'the selected card\'s ribbon is on screen').toBeDefined();
    const chosen = await page.locator('.con-parl__slot--selected').first().getAttribute('data-party');
    await armProbe(page);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.votePrompt?.source ?? 'none',
      {timeout: 30_000, message: 'the grant was answered'}).not.toBe('grant');
    await expect.poll(async () => (await readProbe(page)).flights, {timeout: 20_000, message: 'a delegate was seen in flight'}).not.toEqual({});
    await shoot(page, '03-delegate-flies');

    // THE SERVER: one of the viewer's delegates on the chosen card, the reserve −1, the lobby untouched.
    const after = await wireOf(request, playerId);
    const mine = after.game.parliament.slots.map((s) => ({party: s.party, n: s.votes.filter((v) => v.owner === after.thisPlayer.color).length}));
    expect(mine.filter((s) => s.n > 0), 'ONE delegate, on the chosen card').toEqual([{party: chosen, n: 1}]);
    expect(seatOf(after).reserve, 'the delegate left the RESERVE').toBe(seat0.reserve - 1);
    expect(seatOf(after).lobby, 'the lobby\'s cube never moved').toBe(seat0.lobby);

    // THE START LEAVES once; then the Parliament's head names the +2 and its giver.
    await waitForBoardHome(page);
    const probe = await readProbe(page);
    expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(5);
    expect(probe.parlMax, 'ONE Parliament instance').toBeLessThanOrEqual(1);
    const travels = Object.values(probe.flights).filter((f) => f.n >= 2 && dist(f.first, f.last) > 24);
    const slack = PRESET.viewport.width / 24;
    const near = (a: {x: number, y: number}, b: Box | undefined) => b !== undefined && dist(a, b) <= Math.max(b.w, b.h) + slack;
    const dump = JSON.stringify({reserveBox, ribbonBox, flights: probe.flights});
    expect(travels.length, `a delegate TRAVELLED (${dump})`).toBeGreaterThanOrEqual(1);
    expect(travels.some((f) => near(f.first, reserveBox)), `…born at the RESERVE (${dump})`).toBe(true);
    expect(travels.some((f) => near(f.last, ribbonBox)), `…landed on the chosen card's ribbon (${dump})`).toBe(true);

    await openParliament(page);
    const head = page.locator('[data-parl-influence-head]');
    await expect(head.locator('[data-parl-influence-sum] [data-inf-mod]'), 'the head: +2 beyond the Career').toHaveText('+2');
    await expect(head.locator('[data-inf-mod]').first(), 'the tab names its giver').toHaveAttribute('data-hint', /The Deimos Group/);
    await shoot(page, '04-parliament-influence');
  });

  test('B — the standing waiver: the Reds\' card from the hand, the composer names the corporation, the dossier says «снято»', async ({page, request}) => {
    const {playerId} = await bootFixtureSeats(page, request, 'deimos', {query: PRESET.query});
    const before = await wireOf(request, playerId);
    expect(before.cardsInHand?.map((c) => c.name), 'the fixture: Council Seat in the hand').toContain(COUNCIL);

    // THE HAND: the party cassette lifted, decisive, and no one-play bolt.
    await openHand(page, COUNCIL);
    const slot = page.locator(`.con-hand__slot[data-zoom-slot="${COUNCIL}"]`);
    await expect(slot.locator('[data-hand-ease]'), 'the tile\'s plate names the lift — decisive').toHaveAttribute('data-hand-ease', 'waive ✓');
    await expect(slot.locator('[data-req-state="waived"]').first(), 'the party cassette is lifted').toBeVisible();
    await shoot(page, '05-hand');

    // THE COMPOSER: the requirement row is lifted and names the corporation.
    const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
    expect(await focusCard(page, COUNCIL, slots * 2 + 6), 'the cursor reached Council Seat').toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await page.locator(COMPOSER).count() > 0, {tries: 3, settleMs: 900}), 'A opens the composer').toBe(true);
    await settle(page);
    const req = page.locator(`${COMPOSER} [data-composer-req]`);
    await expect(req).toHaveAttribute('data-req-state', 'waived');
    await expect(req).toContainText(DEIMOS);
    await expect(req, 'a standing lift is not «one play»').not.toContainText(/один розыгрыш/i);
    await shoot(page, '06-composer');

    // THE PLAY goes through — the journal names who let it through.
    for (let i = 0; i < 8 && await page.locator('.con-composer__cta--focused').count() === 0; i++) {
      await press(page, 'ArrowDown', 300);
    }
    await expect(page.locator('.con-composer__cta--focused'), 'the cursor stands on «Разыграть карту»').toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.tableau.map((c) => c.name), {timeout: 30_000}).toContain(COUNCIL);
    const logs = await (await request.get(`/api/game/logs?id=${playerId}`)).json() as Array<{message: string}>;
    expect(logs.some((m) => m.message === '${0} ignored the party requirement of ${1} thanks to ${2}'),
      'the journal: «… ignored the party requirement … thanks to …»').toBe(true);
    await waitForBoardHome(page);

    // THE PARLIAMENT: the Reds' dossier — the requirement «снято», the effect still not the viewer's.
    await openParliament(page);
    await focusParty(page, REDS);
    await openZoomViewer(page);
    const panel = page.locator('dialog.con-zoom[open] [data-parl-access-panel]');
    await expect(panel).toBeVisible({timeout: 10_000});
    await expect(panel, 'the requirement is lifted, named').toContainText(/Требование этой партии на картах: снято — «The Deimos Group»/);
    await expect(panel, 'the effect is not granted').not.toContainText(/Требование этой партии на картах: не выполнено/);
    await shoot(page, '07-reds-dossier');
    await closeZoomViewer(page);
    for (let i = 0; i < 4 && await parliament(page).count() > 0; i++) {
      await press(page, 'Escape', 900);
    }
  });
});
