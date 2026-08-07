import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootToBoard, fillPicks, press} from './consoleStart';

/**
 * PLUTO — THE EMBEDDED FOLLOW-UP GUARD.
 *
 * Pluto is the colony whose trade AND build deal CARDS, so both paths end in a
 * `CardDrawReveal`. The contract is that the payout presents INSIDE the colony
 * workspace — the focus stage hands its working area over and the reveal opens
 * there — and NEVER as a full-bleed band over the still-standing colony
 * screen (which is what «Плутон открывает модалку» actually was: not a legacy
 * component, but the console's own reveal teleported to `body` because the
 * claim was missing on the build path and the withhold arm knew only the card
 * claim).
 *
 * These two tests are the reason that can never come back silently.
 */

const OUT = path.resolve('screenshots', 'colony-pluto');

function newGameConfig() {
  return {
    players: [{name: 'PlutoEmbed', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
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
    // Pluto plus three resource colonies: the setup removal can take one and
    // Pluto still survives into the action phase (`keepColony`).
    customColoniesList: ['Pluto', 'Luna', 'Triton', 'Callisto'],
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
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return model.players[0].id;
}

async function boot(page: Page, playerId: string): Promise<void> {
  await page.goto(`/player?id=${playerId}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForTimeout(3500);
  await bootToBoard(page, {
    keepColony: 'Pluto',
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 600);
      } else if (kind === 'project') {
        await fillPicks(p, 2);
      }
    },
  });
  await page.waitForTimeout(1500);
}

async function openColoniesAndFocus(page: Page, target: string): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  expect(await colonies.count(), 'colonies section did not open').toBeGreaterThan(0);
  const focused = page.locator(`.con-coltile--focused[data-test="con-colony-${target}"]`);
  for (let i = 0; i < 10 && await focused.count() === 0; i++) {
    await press(page, 'ArrowRight', 380);
  }
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  expect(await focused.count(), `could not focus ${target}`).toBeGreaterThan(0);
}

type Sighting = {
  /** The reveal was on screen at all. */
  seen: boolean;
  /** …and it was INSIDE the colony focus stage's outcome zone. */
  inStage: boolean;
  /** …and it carried the embedded skin (no own band / plate / header). */
  embedded: boolean;
  /** A full-bleed reveal parented straight to <body> — the reported bug. */
  fullBleed: boolean;
  /** Any legacy modal-input surface, ever. */
  legacyModal: boolean;
};

/** Watch the whole payout window from inside the page (a poll from the test
 *  runner would miss the frames that matter). */
async function watchPayout(page: Page, ms: number): Promise<Sighting> {
  await page.evaluate((budget) => {
    const w = window as unknown as {__pluto?: Sighting};
    const seen: Sighting = {seen: false, inStage: false, embedded: false, fullBleed: false, legacyModal: false};
    w.__pluto = seen;
    const t0 = performance.now();
    const tick = () => {
      const reveal = document.querySelector('.con-reveal');
      if (reveal !== null) {
        seen.seen = true;
        if (reveal.closest('.con-colfocus [data-outcome-zone]') !== null) {
          seen.inStage = true;
        }
        if (reveal.classList.contains('con-reveal--embedded')) {
          seen.embedded = true;
        }
        // Parented to <body> (or to the shell root) instead of a workspace
        // zone = the standalone band the contract forbids for a claimed
        // payout. `[data-embed-slot]` is the only legitimate host.
        if (reveal.closest('[data-embed-slot]') === null) {
          seen.fullBleed = true;
        }
      }
      if (document.querySelector('.mandatory-input-modal, .modal-input-root') !== null) {
        seen.legacyModal = true;
      }
      if (performance.now() - t0 < budget) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, ms);
  await page.waitForTimeout(ms + 300);
  return page.evaluate(() => (window as unknown as {__pluto?: Sighting}).__pluto as Sighting);
}

test.describe.configure({mode: 'serial'});

test('Pluto TRADE: the payout presents inside the colony workspace, never as a band', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, await createGame(request));
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000); // descend into the focus stage (trade)
  expect(await page.locator('.con-colfocus').count(), 'the focus stage did not open').toBeGreaterThan(0);
  await shoot(page, '01-trade-stage');

  const watching = watchPayout(page, 11_000);
  await page.keyboard.press('KeyX'); // confirm the trade
  await page.waitForTimeout(1800);
  await shoot(page, '02-trade-handoff');
  await page.waitForTimeout(2200);
  await shoot(page, '03-trade-reveal');
  const seen = await watching;
  console.log('── Pluto trade payout ──', JSON.stringify(seen));
  await shoot(page, '04-trade-end');

  expect(seen.seen, 'no payout reveal ever appeared').toBeTruthy();
  expect(seen.legacyModal, 'a LEGACY modal opened for the Pluto payout').toBeFalsy();
  expect(seen.fullBleed, 'the payout mounted OUTSIDE a workspace zone (the full-bleed band)').toBeFalsy();
  expect(seen.embedded, 'the payout did not carry the embedded skin').toBeTruthy();
  expect(seen.inStage, 'the payout did not open inside the colony FOCUS STAGE').toBeTruthy();
});

test('Pluto BUILD: the draw presents inside the colony workspace, never as a band', async ({page, request}) => {
  test.setTimeout(420_000);
  await boot(page, await createGame(request));

  // The Build Colony standard project → the colony pick → the focus stage.
  await press(page, 'Comma', 1200);
  await press(page, 'Enter', 1400);
  expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  expect(/колони/i.test(await focusedName()), 'could not focus the colony standard project').toBeTruthy();
  await press(page, 'Enter', 1800);

  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await openColoniesAndFocus(page, 'Pluto');
  await press(page, 'Enter', 2000); // descend — build intent
  expect(await page.locator('.con-colfocus').count(), 'the build stage did not open').toBeGreaterThan(0);
  expect(await page.locator('.con-colfocus').getAttribute('data-colony-intent')).toBe('build');
  await shoot(page, '05-build-stage');

  const watching = watchPayout(page, 11_000);
  await page.keyboard.press('Enter'); // A = build confirm
  await page.waitForTimeout(1800);
  await shoot(page, '06-build-handoff');
  await page.waitForTimeout(2200);
  await shoot(page, '07-build-reveal');
  const seen = await watching;
  console.log('── Pluto build payout ──', JSON.stringify(seen));
  console.log('── reveal fit inside the zone ──', JSON.stringify(await page.evaluate(() => {
    const box = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el === null) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return {w: Math.round(r.width), h: Math.round(r.height)};
    };
    return {
      zone: box('.con-colfocus__outcome'),
      reveal: box('.con-colfocus__outcome .con-reveal'),
      strip: box('.con-colfocus__outcome .con-reveal__strip'),
      slot: box('.con-colfocus__outcome .con-cards__slot'),
      card: box('.con-colfocus__outcome .con-cards__slot :is(.card-container, .pcard)'),
      zoom: getComputedStyle(document.querySelector('.con-colfocus__outcome .con-reveal__strip') ?? document.body).getPropertyValue('--con-cards-zoom'),
    };
  })));
  await shoot(page, '08-build-end');

  expect(seen.seen, 'no draw reveal ever appeared for the build bonus').toBeTruthy();
  expect(seen.legacyModal, 'a LEGACY modal opened for the Pluto build draw').toBeFalsy();
  expect(seen.fullBleed, 'the draw mounted OUTSIDE a workspace zone (the full-bleed band)').toBeFalsy();
  expect(seen.embedded, 'the draw did not carry the embedded skin').toBeTruthy();
  expect(seen.inStage, 'the draw did not open inside the colony FOCUS STAGE').toBeTruthy();

  // ── NO SIZE JUMP WHEN A CARD IS TAKEN. The reveal's own contract says the
  //    card scale is FIXED for the batch — taking one must re-centre the row,
  //    never resize what is left. Inside a workspace zone that is doubly
  //    true: a resize here would move the whole stage under the player.
  const cardW = () => page.evaluate(() => {
    const el = document.querySelector('.con-colfocus__outcome .con-cards__slot :is(.card-container, .pcard)');
    return el === null ? -1 : Math.round(el.getBoundingClientRect().width);
  });
  const before = await cardW();
  await press(page, 'Enter', 2200); // take one card
  const after = await cardW();
  console.log(`── card width across a take: ${before} → ${after}`);
  await shoot(page, '09-build-after-take');
  if (before > 0 && after > 0) {
    expect(Math.abs(after - before), `the card resized when one was taken (${before} → ${after})`)
      .toBeLessThanOrEqual(2);
  }
});
