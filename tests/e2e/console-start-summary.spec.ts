import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The start-setup SUMMARY: the launch CTA + the zero-projects confirmation.
 *
 * The summary doubles as the setup's waiting room, so its side rail carries ONE
 * slot that is either the waiting readout (somebody else still owes a pick) or
 * the «НАЧАТЬ ПАРТИЮ» CTA. This drives a real 1-human + 1-bot game to it and
 * asserts the two things that are easy to regress:
 *
 *  1. The launch names A — the press that starts the game must sit on the
 *     confirm button every other console surface confirms with, never on a
 *     trigger (RT hid the biggest press of the setup).
 *  2. MarsBot is never given a `waitingFor`, so it is ready from the first
 *     frame and a bot game opens straight on the CTA — the waiting state must
 *     NOT show against a bot.
 *  3. A on an empty buy arms the amber warning first; only the second A submits.
 */

const OUT_DIR = path.resolve('screenshots', 'start-summary');

/** Full NewGameConfig. Default: a deterministic 1-human + 1-bot game (the
 *  server creates the MarsBot seat itself when `automa` is set on a solo
 *  config). `twoHumans` swaps that for a second HUMAN seat instead — the only
 *  shape in which the summary's waiting state can actually occur. */
function newGameConfig(twoHumans = false) {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: twoHumans ? [
      {name: 'Victor', color: 'red', beginner: false, handicap: 0, first: true},
      {name: 'Anna', color: 'green', beginner: false, handicap: 0, first: false},
    ] : [{name: 'Victor', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
    automa: twoHumans ? undefined : {difficulty: 'normal'},
  };
}

/**
 * Walk the wizard to its final summary step. This config's steps are
 * corporation → project buy (`prelude: false`), and the two take DIFFERENT
 * presses: a single-pick step commits with A, the multi-pick buy continues
 * with RT — pressing A there would silently toggle a card into the buy and
 * quietly void the zero-projects case. So read the active step chip and
 * decide, rather than alternating keys blindly.
 */
async function walkToSummary(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  const summary = page.locator('.con-start__summary');
  const activeStep = page.locator('.con-start__step--active');

  for (let i = 0; i < 8 && await summary.count() === 0; i++) {
    // The verdict bar renders only once the deal cinematic has finished
    // (`v-if="focusedCard && !deal.state.active"`), so it is the exact "this
    // press acts instead of skipping the cinematic" gate.
    await page.waitForSelector('.con-cards__verdictbar', {timeout: 25_000});
    await page.waitForTimeout(400);
    const before = (await activeStep.innerText()).toLowerCase();
    await key(page, /корпорац|директор/.test(before) ? 'Enter' : 'Period', 1200);
    // Let the step actually change before looking again — otherwise the next
    // iteration fires into the outgoing frame.
    for (let w = 0; w < 20 && await summary.count() === 0 &&
         (await activeStep.innerText()).toLowerCase() === before; w++) {
      await page.waitForTimeout(250);
    }
  }
  await expect(summary).toHaveCount(1);
  await page.waitForTimeout(600);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 900): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

test.describe('console start scene · the summary launch', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('reaches the summary; the launch is the A CTA and an empty buy confirms twice', async ({page, request}) => {
    test.setTimeout(180_000);

    const created = await request.post('/api/creategame', {data: newGameConfig()});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string}>};

    await page.goto(`/player?id=${model.players[0].id}&console=1`);
    await walkToSummary(page);
    const summary = page.locator('.con-start__summary');
    await shoot(page, '01-summary');

    // 1 + 2 · A bot owes no pick → the CTA, never the waiting readout.
    // (The plates are uppercased in CSS; the DOM text keeps its source case.)
    await expect(page.locator('.con-start__wait')).toHaveCount(0);
    const cta = page.locator('.con-start__beginline');
    await expect(cta).toHaveCount(1);
    await expect(cta).toContainText(/начать партию/i);
    // The plate names A — the whole point of moving off RT.
    await expect(cta.locator('.gp-glyph')).toHaveText('A');

    // The command bar mirrors it (consoleStartUi) — and RT no longer carries it.
    const bar = page.locator('.con-cmdbar');
    await expect(bar).toContainText(/начать партию/i);
    expect(await bar.innerText()).not.toContain('RT');

    // 3 · Zero projects bought → the first A arms the warning, not a submit.
    await key(page, 'Enter', 700);
    await expect(page.locator('.con-start__skipwarn')).toHaveCount(1);
    await expect(summary).toHaveCount(1); // still here — nothing was sent
    await shoot(page, '02-skip-armed');

    // The second A submits: the wizard resolves and the scene leaves the
    // summary (the ceremony takes over, or the scene unmounts entirely).
    await key(page, 'Enter', 2500);
    await expect(summary).toHaveCount(0);
    await shoot(page, '03-submitted');
  });

  /**
   * The waiting state can ONLY happen against another human (MarsBot never
   * owes a pick), so this is the only shape that proves it — including the
   * live morph, which rides the `/api/waitingFor` poll and NOT a view refresh
   * (the view is deliberately frozen while the viewer holds their prompt).
   */
  test('another human still picking → the waiting readout, morphing to the CTA when they submit', async ({page, request, browser}) => {
    test.setTimeout(240_000);

    const created = await request.post('/api/creategame', {data: newGameConfig(true)});
    expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
    const model = await created.json() as {players: Array<{id: string, name: string}>};
    const victor = model.players.find((p) => p.name === 'Victor')!;
    const anna = model.players.find((p) => p.name === 'Anna')!;

    await page.goto(`/player?id=${victor.id}&console=1`);
    await walkToSummary(page);

    // Anna has not picked → the rail waits on her by name, and says so.
    const wait = page.locator('.con-start__wait');
    await expect(wait).toHaveCount(1);
    await expect(page.locator('.con-start__beginline')).toHaveCount(0);
    await expect(wait).toContainText(/ожидаем других игроков/i);
    const annaRow = page.locator('.con-start__mate--active');
    await expect(annaRow).toHaveCount(1);
    await expect(annaRow).toContainText('Anna');
    // A is still bound (a hard gate would deadlock both summaries) — it just
    // says what it really does before Anna is done.
    await expect(page.locator('.con-start__wait-cta')).toContainText(/отправить выбор/i);
    await expect(page.locator('.con-cmdbar')).toContainText(/отправить выбор/i);
    await shoot(page, '04-waiting-for-human');

    // Anna finishes her setup in a second context. Victor's view is NOT
    // refreshed by this (he is mid-prompt) — only the poll can carry it.
    const annaPage = await (await browser.newContext()).newPage();
    await annaPage.goto(`/player?id=${anna.id}&console=1`);
    await walkToSummary(annaPage);
    await key(annaPage, 'Enter', 700); // arms the zero-projects warning
    await key(annaPage, 'Enter', 2500); // submits

    // …and Victor's rail morphs to the launch CTA on its own. The freshness
    // is the poll's: `waitingForTimeout` (1s) normally, stretched to
    // LONG_POLL_MS (20s) while the realtime socket is healthy — so allow a
    // full long-poll cycle rather than pinning a cadence this doesn't own.
    const cta = page.locator('.con-start__beginline');
    await expect(cta).toHaveCount(1, {timeout: 30_000});
    await expect(cta).toContainText(/начать партию/i);
    await expect(wait).toHaveCount(0);
    // The top strip reads the SAME status brain and must agree — it rides the
    // same poll now, so it can't sit on «стартовый выбор» while the rail has
    // already handed the launch over.
    await expect(page.locator('.con-status__players')).toContainText(/готов/i);
    await shoot(page, '05-morphed-to-cta');
    await annaPage.context().close();
  });
});
