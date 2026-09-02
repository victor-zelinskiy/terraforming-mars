import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';
import cardManifest from '../../src/genfiles/cards.json';

/**
 * SOCIAL HEATING (DP09) — «каждый раз, когда ЛЮБОЙ игрок продвигается по
 * Гидросети, получите 1 тепло за каждое пройденное деление».
 *
 * What only a live run can prove (the domain half is unit-tested — see
 * `tests/cards/delta/SocialHeating.spec.ts` and `tests/delta/deltaMovement.spec.ts`):
 *
 *  1. THE PROMISE. Planning the player's OWN advance, the workspace states the
 *     bonus BEFORE the confirm, beside «Вы получите», in the same result
 *     language: source card named, `сейчас → станет`, `+N`. It follows the
 *     plan (a different destination is a different number) and it does not
 *     push the panel into a scroll or move the CTA column.
 *  2. THE PAYOUT. After the commit the heat that arrives equals the number the
 *     row promised, the result stage restates the row, and the marker's own
 *     arrival wave is what delivers it.
 *  3. THE OTHER PLAYER. When somebody ELSE moves, the owner is told through
 *     the ordinary affected-player notification — the result first, the cause
 *     second, the source card named — and no workspace of theirs is captured.
 *
 * Screenshots → `screenshots/social-heating/`.
 */

const OUT = path.resolve('screenshots', 'social-heating');

/** Path tags 1..5 (Building/Power · Power · Earth · Space · Science). */
const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research'];
/** The city the card requires, placed on its own reserved area (no prompt). */
const CITY_CARD = 'Ganymede Colony';
const ALL_CARDS = [CITY_CARD, 'Social Heating', ...TAG_CARDS];

const CFG = soloGameConfig({
  players: [{name: 'HeatProbe', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  customProjectCards: ALL_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.51,
});

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function toActionMenu(request: APIRequestContext, id: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 30; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 400));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    if (prompt.type === 'space') {
      model = await sendPlayerInput(request, id,
        {type: 'space', spaceId: (prompt.spaces ?? [])[0]} as never) as Wire;
      continue;
    }
    model = prompt.type === 'card' ?
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never) as Wire :
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

function payMc(amount: number): Wire {
  return {
    megacredits: amount, steel: 0, titanium: 0, heat: 0, plants: 0, microbes: 0,
    floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0, auroraiData: 0,
    graphene: 0, kuiperAsteroids: 0, corruption: 0, floodgateSteel: 0,
  };
}

async function playCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Play project card');
  expect(at, 'the menu offers «Play project card»').toBeGreaterThanOrEqual(0);
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
  expect(offered, `${card} is playable (its requirement is met)`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 30)},
  } as never);
}

async function heatOf(request: APIRequestContext, id: string): Promise<number> {
  const model = await fetchPlayerModel(request, id) as Wire;
  return (model.thisPlayer ?? {}).heat ?? 0;
}

async function positionOf(request: APIRequestContext, id: string): Promise<number> {
  const model = await fetchPlayerModel(request, id) as Wire;
  return (model.thisPlayer ?? {}).deltaProject?.position ?? 0;
}

/** The «ДОПОЛНИТЕЛЬНО» group, read off the live DOM. */
async function extraRow(page: Page) {
  return page.evaluate(() => {
    const group = document.querySelector('.con-hydro__gains-extra');
    if (group === null) {
      return undefined;
    }
    const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    return {
      label: norm((group.querySelector('.con-hydro__section-label') as HTMLElement | null)?.innerText),
      source: norm((group.querySelector('.con-hydro__extra-src') as HTMLElement | null)?.innerText),
      beforeAfter: norm((group.querySelector('.con-hydro__beforeafter') as HTMLElement | null)?.innerText),
      plus: norm((group.querySelector('.con-hydro__plus') as HTMLElement | null)?.innerText),
      icon: (group.querySelector('.con-hydro__delta-img') as HTMLElement | null)?.className ?? '',
      // Inside the ONE outcome block — never a panel of its own.
      insideGains: document.querySelector('.con-hydro__gains .con-hydro__gains-extra') !== null,
    };
  });
}

test.describe('Social Heating (DP09) · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('the plan promises the heat, the commit pays exactly it, the result restates it', async ({page, request}) => {
    test.setTimeout(480_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: CFG, seed: 0.51});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'ThorGate'});
    // The CITY first — Social Heating's own requirement. (`playCard` asserts
    // the card is offered, so a broken requirement fails here by name.)
    for (const card of [CITY_CARD, 'Social Heating', ...TAG_CARDS]) {
      await playCard(request, id, card);
    }
    await toActionMenu(request, id);
    expect(await positionOf(request, id), 'nothing has moved yet').toBe(0);

    await openConsole(page, id, '');
    await waitForBoardHome(page, 25);

    // ── Open the Hydronetwork and plan a THREE-step advance (0 → 3). ──
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});
    await page.waitForSelector('.con-hydro__payline', {timeout: 10_000});
    await press(page, 'Period', 900); // RT — «К дальнему» (stage 5 here)
    for (let i = 0; i < 6; i++) {
      const at = await page.evaluate(() =>
        document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
      if (at === '3') {
        break;
      }
      await press(page, 'ArrowLeft', 500);
    }
    const focused = await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    expect(focused, 'the plan stands on stage 3').toBe('3');

    // ── 1 · THE PROMISE, before any confirm. ──
    const heatBefore = await heatOf(request, id);
    const promise = await extraRow(page);
    expect(promise, 'the ДОПОЛНИТЕЛЬНО group renders beside «Вы получите»').toBeDefined();
    expect(promise!.insideGains, 'it lives INSIDE the one outcome block').toBe(true);
    expect(promise!.label).toBe('ДОПОЛНИТЕЛЬНО');
    expect(promise!.source, 'the source card is named').toBe('Социальное отопление');
    expect(promise!.plus, 'one heat per planned step').toBe('+3');
    expect(promise!.beforeAfter).toBe(`${heatBefore} → ${heatBefore + 3}`);
    expect(promise!.icon, 'the heat sprite').toContain('heat');
    await shoot(page, '01-plan-promise');

    // The panel must not scroll and the CTA column must not have moved.
    const geometry = await page.evaluate(() => {
      const panel = document.querySelector('.con-hydro__panel') as HTMLElement | null;
      const act = document.querySelector('.con-hydro__act') as HTMLElement | null;
      const r = act?.getBoundingClientRect();
      return {
        scrollTop: panel?.scrollTop ?? -1,
        overflow: panel === null ? -1 : panel.scrollHeight - panel.clientHeight,
        ctaRight: r === undefined ? -1 : Math.round(r.right),
        viewport: window.innerWidth,
      };
    });
    expect(geometry.overflow, 'the plan panel does not scroll').toBeLessThanOrEqual(1);
    expect(geometry.ctaRight).toBeLessThanOrEqual(geometry.viewport);

    // ── The promise FOLLOWS THE PLAN — one step back is one heat less. ──
    await press(page, 'ArrowLeft', 700);
    const shorter = await extraRow(page);
    expect(shorter!.plus, 'a two-step plan promises +2').toBe('+2');
    expect(shorter!.beforeAfter).toBe(`${heatBefore} → ${heatBefore + 2}`);
    await press(page, 'ArrowRight', 700);
    expect((await extraRow(page))!.plus).toBe('+3');

    // ── 2 · THE PAYOUT. Commit; the marker walks; the wave lands. ──
    await press(page, 'Enter', 3500);
    await page.waitForSelector('.con-hydro__layer--result', {timeout: 40_000});
    await page.waitForTimeout(1200);

    expect(await positionOf(request, id), 'the marker committed 0 → 3').toBe(3);
    const heatAfter = await heatOf(request, id);
    expect(heatAfter, 'the server paid exactly what the row promised').toBe(heatBefore + 3);

    const result = await extraRow(page);
    expect(result, 'the result restates the ДОПОЛНИТЕЛЬНО row').toBeDefined();
    expect(result!.source).toBe('Социальное отопление');
    expect(result!.plus).toBe('+3');
    await shoot(page, '02-result');

    // The rail's heat metric ends on the SERVER's number (the wave settled).
    const railHeat = await page.evaluate(() => {
      const el = document.querySelector('[data-metric="heat"] .con-rail__value, [data-rail-metric="heat"]') as HTMLElement | null;
      return el === null ? undefined : Number((el.innerText ?? '').replace(/[^0-9-]/g, ''));
    });
    if (railHeat !== undefined) {
      expect(railHeat, 'the resource rail matches the server').toBe(heatAfter);
    }
  });
});

/**
 * DP07 — the ordered multi-step traversal. The whole move is ONE movement, so
 * the promise is one row of `steps` heat and the payout is one aggregate: never
 * a chip per crossed cell, never a double count on top of the per-stage
 * rewards Delta Surge grants.
 */
const SURGE_CARDS = [CITY_CARD, 'Social Heating', 'Delta Surge', ...TAG_CARDS];
const SURGE_CFG = soloGameConfig({
  players: [{name: 'SurgeHeat', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  customProjectCards: SURGE_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.61,
});

test.describe('Social Heating × Delta Surge · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('a four-step traversal promises ONE +4 row and pays exactly it, once', async ({page, request}) => {
    test.setTimeout(480_000);
    const id = await createGameWithCards(request, SURGE_CARDS, {config: SURGE_CFG, seed: 0.61});
    await seedGameOverApi(request, id, {cards: SURGE_CARDS, corporation: 'ThorGate'});
    for (const card of SURGE_CARDS) {
      await playCard(request, id, card);
    }
    await toActionMenu(request, id); // Delta Surge's own ocean

    await openConsole(page, id, '');
    await waitForBoardHome(page, 25);
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});
    await page.waitForSelector('.con-hydro__payline', {timeout: 10_000});
    await press(page, 'Period', 900); // RT — «К дальнему» (5)
    await press(page, 'ArrowLeft', 700); // step back to 4 (stage 5 opens a deck pick)
    const focused = await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    expect(focused, 'the plan stands on stage 4').toBe('4');

    const heatBefore = await heatOf(request, id);
    const promise = await extraRow(page);
    expect(promise, 'the traversal promises the movement bonus too').toBeDefined();
    expect(promise!.plus, 'ONE row for the WHOLE move — four actual steps').toBe('+4');
    expect(promise!.beforeAfter).toBe(`${heatBefore} → ${heatBefore + 4}`);
    // …and exactly ONE such row: never one per crossed cell.
    expect(await page.locator('.con-hydro__gains-extra .con-hydro__extra').count()).toBe(1);
    await shoot(page, '03-traversal-plan');

    // Answer the two crossed reward choices (stages 1 and 2) on the rail,
    // then commit — the same walk the Delta Surge probe drives.
    await press(page, 'Enter', 900);
    await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
    await press(page, 'Enter', 900);
    await press(page, 'Enter', 900);
    await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
    await press(page, 'Enter', 900);
    expect(await page.locator('.con-hydro__pickrow .con-hydro__bonus-tick').count(),
      'both crossed choices resolved').toBe(2);

    await press(page, 'Enter', 4000);
    await page.waitForSelector('.con-hydro__layer--result', {timeout: 60_000});
    await page.waitForTimeout(1500);

    expect(await positionOf(request, id), 'the marker committed 0 → 4').toBe(4);
    expect(await heatOf(request, id), 'exactly four heat, once')
      .toBe(heatBefore + 4);
    const result = await extraRow(page);
    expect(result!.plus).toBe('+4');
    expect(await page.locator('.con-hydro__gains-extra .con-hydro__extra').count(),
      'the result states ONE aggregate row').toBe(1);
    await shoot(page, '04-traversal-result');
  });
});

/**
 * ANOTHER PLAYER MOVES — the owner is TOLD, through the ordinary
 * affected-player notification. No workspace of theirs is captured, no modal
 * opens, the RESULT leads and the CAUSE follows with the source card named.
 */
const CARD_DATA = cardManifest as ReadonlyArray<{name: string, type?: string, tags?: ReadonlyArray<string>}>;
/**
 * Corporations that carry a BUILDING tag — the path tag position 1 of the
 * track requires. The mover's PROJECT deal is not seeded (the forced cards all
 * go to the first seat), so their tag has to come from the corporation, which
 * IS steerable: `customCorporationsList` is cards-on-top, so listing three
 * building corporations against four dealt slots guarantees this seat is
 * offered at least one.
 */
const BUILDING_CORPS = CARD_DATA
  .filter((c) => c.type === 'corporation' && (c.tags ?? []).includes('building'))
  .map((c) => c.name);

/** The corporation names this seat was offered, from its own pregame prompt. */
function offeredCorporations(prompt: Wire | undefined): Array<string> {
  const out: Array<string> = [];
  const walk = (node: Wire | undefined): void => {
    if (node === undefined) {
      return;
    }
    for (const c of (node.cards ?? []) as Array<Wire>) {
      if (typeof c.name === 'string' && BUILDING_CORPS.includes(c.name)) {
        out.push(c.name);
      }
    }
    for (const o of (node.options ?? []) as Array<Wire>) {
      walk(o);
    }
  };
  walk(prompt);
  return out;
}

/** Advance this player N steps on the track through the standard action. */
async function advanceOverApi(request: APIRequestContext, id: string, steps: number): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Advance on the Hydronetwork track');
  expect(at, 'the menu offers the Hydronetwork advance').toBeGreaterThanOrEqual(0);
  // The menu option is a plain SelectOption whose callback RAISES the step
  // input — two responses, exactly what the console's own batch sends.
  await sendPlayerInput(request, id, {type: 'or', index: at, response: {type: 'option'}} as never);
  await sendPlayerInput(request, id, {type: 'deltaProject', amount: steps} as never);
}

const DUO_CFG = soloGameConfig({
  players: [
    {name: 'HeatOwner', color: 'red', beginner: false, handicap: 0, first: true},
    {name: 'Mover', color: 'blue', beginner: false, handicap: 0, first: false},
  ],
  expansions: {deltaProject: true},
  customProjectCards: ALL_CARDS,
  // Three building corporations against four dealt slots (2 seats × 2) — the
  // mover is offered one whichever way the deal splits.
  customCorporationsList: [...BUILDING_CORPS, 'ThorGate'],
  seed: 0.71,
});

test.describe('Social Heating — another player’s movement · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('the owner is told: the gain leads, the mover is the cause, the card is the source', async ({page, request}) => {
    test.setTimeout(480_000);
    const created = await request.post('/api/creategame', {data: DUO_CFG});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const {players} = await created.json() as {players: Array<{id: string}>};
    const owner = players[0].id;
    const mover = players[1].id;

    const moverCorps = offeredCorporations(
      (await fetchPlayerModel(request, mover) as Wire).waitingFor as Wire | undefined);
    expect(moverCorps.length, 'the mover is offered a BUILDING corporation').toBeGreaterThan(0);
    await Promise.all([
      seedGameOverApi(request, owner, {cards: ALL_CARDS}).catch(() => undefined),
      seedGameOverApi(request, mover, {corporation: moverCorps[0]}).catch(() => undefined),
    ]);

    // ── GENERATION 1, and deliberately not later: every player's energy is
    //    converted to heat at the generation change, so a mover in generation 2
    //    has nothing to pay a track step with. The owner (first player) spends
    //    their two actions putting the card in play; the turn then passes and
    //    the owner becomes a SPECTATOR — exactly the case this card is about. ──
    await playCard(request, owner, CITY_CARD);
    await playCard(request, owner, 'Social Heating');

    await openConsole(page, owner, '');
    await page.waitForTimeout(4000);

    const heatBefore = await heatOf(request, owner);
    await advanceOverApi(request, mover, 1);

    // ── The SERVER paid the owner for somebody else's step. ──
    await expect.poll(async () => await heatOf(request, owner), {timeout: 60_000})
      .toBe(heatBefore + 1);

    // ── The CONSOLE told them, through the ordinary notification. ──
    const card = page.locator('.con-notif').first();
    await card.waitFor({state: 'visible', timeout: 60_000});
    const told = await page.evaluate(() => {
      const el = document.querySelector('.con-notif');
      if (el === null) {
        return undefined;
      }
      const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
      return {
        sign: Array.from(el.classList).find((c) => c.startsWith('con-notif--sign-')) ?? '',
        band: norm((el.querySelector('.con-notif__you') as HTMLElement | null)?.innerText),
        head: norm((el.querySelector('.con-notif__head') as HTMLElement | null)?.innerText),
        cause: norm((el.querySelector('.con-notif__why') as HTMLElement | null)?.innerText),
        // A notification may never capture a screen.
        modal: document.querySelector('.con-hydro, .con-task') !== null,
      };
    });
    expect(told, 'no notification card reached the owner').toBeDefined();
    expect(told!.sign, 'the card reads as a POSITIVE change for the viewer').toBe('con-notif--sign-positive');
    expect(told!.band, 'the RESULT leads').toContain('+1');
    // The actor is stated ONCE — the head's chip; the «почему»-zone names the
    // owner's OWN earning card under the stable «ИСТОЧНИК» anchor.
    expect(told!.head, 'the initiator lives in the head chip').toContain('Mover');
    expect(told!.cause, 'the SOURCE is the owner’s own card').toContain('Социальное отопление');
    expect(told!.cause, 'the ownership anchor states WHOSE card it is').toMatch(/ВАША КАРТА|Your card/i);
    expect(told!.modal, 'nothing captured the owner’s screen').toBe(false);
    await shoot(page, '05-other-player-notification');
  });
});

/**
 * MARSBOT MOVES — the blocking acceptance case.
 *
 * The bot's Solo Delta Project resolution goes through the SAME position-write
 * ledger a human advance does (`src/server/delta/deltaMovement.ts`), so the
 * card is paid without knowing a bot exists. What only a live game can show is
 * that the whole chain holds end to end: the bot's rows, the owner's heat, and
 * an ORDERED bot-turn card that leads with the gain rather than burying it.
 */
const BOT_CFG = soloGameConfig({
  players: [{name: 'HeatSolo', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  automa: {difficulty: 'normal'},
  customProjectCards: ALL_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.81,
});

type BotSample = {generation: number, botPosition: number, heat: number};

test.describe('Social Heating — MarsBot’s movement · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('the bot’s rows pay the owner exactly, and the turn card leads with the gain', async ({page, request}) => {
    test.setTimeout(900_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: BOT_CFG, seed: 0.81});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'ThorGate'});
    await playCard(request, id, CITY_CARD);
    await playCard(request, id, 'Social Heating');

    const sample = async (): Promise<BotSample> => {
      const model = await fetchPlayerModel(request, id) as Wire;
      const bot = ((model.players ?? []) as Array<Wire>).find((p) => p.isMarsBot === true);
      return {
        generation: (model.game ?? {}).generation ?? 0,
        botPosition: bot?.deltaProject?.position ?? 0,
        heat: (model.thisPlayer ?? {}).heat ?? 0,
      };
    };

    /**
     * PASS THROUGH THE PAGE — the quick wheel's DOWN slot, then its confirm.
     *
     * ⚠️ A PAGE THAT HOLDS A PROMPT DOES NOT POLL — that is the client's own
     * contract («it is your turn, nothing can change»). Answering the viewer's
     * prompts over the API behind an OPEN page therefore freezes it at the
     * generation it was loaded in (measured: server at generation 6, page
     * still painting generation 1, zero errors), and the whole notification
     * feed with it. Everything the viewer owes is driven through the SHELL.
     */
    const passViaPage = async (): Promise<void> => {
      await press(page, 'Comma', 1000); // LT — the basic-actions wheel
      await press(page, 'ArrowDown', 1000); // its «Пас» slot arms the confirm
      // Passing is irreversible, so its confirm is a HOLD, not a tap (the
      // shared hold-to-confirm ring) — a `press` here does nothing at all.
      await page.keyboard.down('Enter');
      await page.waitForTimeout(1600);
      await page.keyboard.up('Enter');
      await page.waitForTimeout(1200);
    };

    /** Record every notification card that ever appears (MutationObserver +
     *  interval — never rAF: headless Chromium stops rAF on a quiet screen,
     *  which is most of a bot's generation). */
    const armRecorder = () => page.evaluate(() => {
      const w = window as unknown as {__notifs?: Array<Record<string, string>>};
      if (w.__notifs !== undefined) {
        return;
      }
      w.__notifs = [];
      const seen = new Set<string>();
      const norm = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim();
      const scan = () => {
        document.querySelectorAll('.con-notif').forEach((el) => {
          const sign = Array.from(el.classList).find((c) => c.startsWith('con-notif--sign-')) ?? '';
          const variant = Array.from(el.classList).find((c) => c.startsWith('notification-card--variant-')) ?? '';
          const band = norm((el.querySelector('.con-notif__you') as HTMLElement | null)?.innerText);
          const text = norm((el as HTMLElement).innerText).slice(0, 200);
          const key = `${variant}|${sign}|${band}|${text}`;
          if (!seen.has(key)) {
            seen.add(key);
            w.__notifs!.push({variant, sign, band, text});
          }
        });
      };
      new MutationObserver(scan).observe(document.body, {childList: true, subtree: true, characterData: true});
      setInterval(scan, 150);
    });

    let moved: {steps: number, heat: number} | undefined;
    let seenCards: Array<Record<string, string>> = [];

    await openConsole(page, id, '');
    await waitForBoardHome(page, 30);
    await armRecorder();

    // The bot's Solo Delta Project resolution fires on its FIRST turn of a
    // generation, and its Power / associated-tag tracks only become eligible
    // after it has revealed a few cards — so this walks generations, passing
    // each one, until the marker actually moves.
    for (let round = 0; round < 16 && moved === undefined; round++) {
      const before = await sample();
      await passViaPage();
      for (let i = 0; i < 60; i++) {
        const cur = await sample();
        if (cur.botPosition > before.botPosition && cur.generation === before.generation) {
          moved = {steps: cur.botPosition - before.botPosition, heat: cur.heat - before.heat};
          break;
        }
        if (cur.generation !== before.generation) {
          break; // the round rolled over without a move — try the next one
        }
        await page.waitForTimeout(500);
      }
      if (moved === undefined) {
        await waitForBoardHome(page, 40);
      }
    }

    // Let the turn card present before reading what was recorded.
    for (let i = 0; i < 40 && moved !== undefined; i++) {
      seenCards = await page.evaluate(() =>
        (window as unknown as {__notifs?: Array<Record<string, string>>}).__notifs ?? []);
      if (seenCards.some((n) => n.band.includes(`+${moved!.steps}`))) {
        break;
      }
      await page.waitForTimeout(500);
    }

    expect(moved, 'MarsBot never advanced on the Hydronetwork').toBeDefined();
    // ONE heat per ACTUAL row the bot took — the same rule a human move obeys,
    // read across a pair of samples inside ONE generation (the generation
    // change converts energy to heat and would drown the reading).
    expect(moved!.heat, `bot advanced ${moved!.steps} row(s)`).toBe(moved!.steps);

    // ── The bot's own turn card LEADS with the viewer's gain — the ordinary
    //    affected-player mechanism, no card-specific bus. ──
    const told = seenCards.find((n) => n.band.includes(`+${moved!.steps}`));
    expect(told, `no card carrying +${moved!.steps} reached the owner; seen: ${JSON.stringify(seenCards)}`)
      .toBeDefined();
    expect(told!.sign, 'the card reads as a POSITIVE change for the viewer').toBe('con-notif--sign-positive');
    expect(told!.variant, 'it is the BOT TURN card — no separate bus').toBe('notification-card--variant-bot-turn');
    await shoot(page, '06-bot-turn-notification');
  });
});
