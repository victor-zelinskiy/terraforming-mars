import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, press} from './consoleStart';

/**
 * THE COLONY BUILD'S CARD BONUS FLIES — the same premium language the trade's
 * payout speaks.
 *
 * Pluto's BUILD bonus is «возьмите 2 карты», so the build ends in a
 * `CardDrawReveal` exactly as its trade does. The contract: those cards are
 * PHYSICAL OBJECTS that leave the build slot's own printed card glyph and
 * travel into the reveal's real slots (the cover-lift scene — the same one a
 * board cell's card bonus rides), and the reveal is HELD until they land. «The
 * cards simply appear» is the bug this spec exists to keep out.
 *
 * It also fences the two physicality rules the payout must obey wherever the
 * cards come from:
 *   · no card is painted in a slot while its own cover is still airborne
 *     (one object, never two — the bonus zone's own back was the offender);
 *   · every card turns IN THE AIR (one flip language), so nothing flips again
 *     after it has landed.
 */

const OUT = path.resolve('screenshots', 'colony-build-flight');

function newGameConfig() {
  return {
    players: [{name: 'BuildFlight', color: 'red', beginner: false, handicap: 0, first: true}],
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

type FlightWatch = {
  /** A cover proxy was POSED (a real box, visible) — the flight happened. */
  proxySeen: boolean;
  /** …and how many distinct proxies carried a card. */
  proxyMax: number;
  /** The lifting hero cover (the separation off the slot glyph) was posed. */
  coverSeen: boolean;
  /** The cover-lift scene's phase ladder, in order (the diagnosis on failure). */
  phases: Array<string>;
  /** A REAL card was painted in a slot while a proxy was still airborne —
   *  the «two objects for one card» break. */
  doubleImage: boolean;
  /** A card back was on screen INSIDE the reveal while proxies still flew
   *  (the bonus zone's own back — physicality broken). */
  zoneBackWhileFlying: boolean;
  /** An in-place flip class ever ran on a landed card (the second, different
   *  flip the in-air turn makes redundant). */
  inPlaceFlip: boolean;
  /** The colony stage's working area was already faded before the first cover
   *  even left its fan (the abrupt disappearance). */
  earlyDissolve: boolean;
  /** Sampled opacity of the colony working area when the first proxy appeared. */
  stageOpacityAtLaunch: number;
};

/**
 * Watch the whole payout from inside the page (a runner-side poll would miss
 * the frames that matter) and record the flight's own evidence.
 */
async function watchFlight(page: Page, ms: number): Promise<FlightWatch> {
  await page.evaluate((budget) => {
    const w = window as unknown as {__buildFlight?: FlightWatch};
    const seen: FlightWatch = {
      proxySeen: false, proxyMax: 0, coverSeen: false, phases: [],
      doubleImage: false, zoneBackWhileFlying: false, inPlaceFlip: false,
      earlyDissolve: false, stageOpacityAtLaunch: -1,
    };
    w.__buildFlight = seen;
    const t0 = performance.now();
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 8 && r.height > 8 && getComputedStyle(el).visibility !== 'hidden' &&
        Number(getComputedStyle(el).opacity || '1') > 0.05;
    };
    const tick = () => {
      const diagFn = (window as unknown as {__conColonyDiag?: () => Record<string, unknown>}).__conColonyDiag;
      const d = diagFn !== undefined ? diagFn() : {};
      const scene = d.bonusScene as {active: boolean, phase: string, source: string} | undefined;
      if (scene !== undefined && scene.active) {
        const tag = `${scene.source}:${scene.phase}`;
        if (seen.phases[seen.phases.length - 1] !== tag && seen.phases.length < 24) {
          seen.phases.push(tag);
        }
      }
      const cover = document.querySelector('.con-bonusfly-cover');
      if (cover !== null && visible(cover)) {
        seen.coverSeen = true;
      }
      // Every flight family that can carry these cards — the cover-lift scene
      // (build) and the trade's own covers — so the probe is about «did a
      // physical card travel», not about which module did it.
      const proxies = Array.from(document.querySelectorAll('.con-bonusfly-proxy, .con-coltrade-proxy'))
        .filter(visible);
      if (proxies.length > 0) {
        seen.proxySeen = true;
        seen.proxyMax = Math.max(seen.proxyMax, proxies.length);
        // PHYSICALITY: nothing may be painted in the reveal while a cover for
        // it is still TRAVELLING — neither a face nor a back.
        //
        // The HANDOFF is deliberately excluded: that beat exists precisely to
        // reveal the real card UNDER its proxy and dissolve the proxy above it
        // («never a swap»), so the two identical copies overlap by design for
        // its duration. Reading the scene's own phase is what keeps this a
        // rule about physicality rather than about frame counts.
        const handingOff = (scene !== undefined && scene.phase === 'handoff') ||
          d.cardScene === 'handoff';
        const painted = Array.from(document.querySelectorAll(
          '.con-reveal .con-cards__slot :is(.card-container, .pcard)')).filter(visible);
        if (!handingOff && painted.length > 0) {
          seen.doubleImage = true;
        }
        const backs = Array.from(document.querySelectorAll(
          '.con-reveal .con-reveal__flip-back, .con-reveal .con-reveal__bonus-slot .con-card-back')).filter(visible);
        if (!handingOff && backs.length > 0) {
          seen.zoneBackWhileFlying = true;
        }
        if (seen.stageOpacityAtLaunch < 0) {
          const main = document.querySelector('.con-colfocus__main');
          seen.stageOpacityAtLaunch = main === null ? -1 :
            Number(getComputedStyle(main).opacity || '1');
          seen.earlyDissolve = seen.stageOpacityAtLaunch >= 0 && seen.stageOpacityAtLaunch < 0.5;
        }
      }
      // A SECOND flip after the landing: the zone's own in-place turn.
      if (document.querySelector('.con-reveal__flip--flipping') !== null) {
        seen.inPlaceFlip = true;
      }
      if (performance.now() - t0 < budget) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, ms);
  await page.waitForTimeout(ms + 300);
  return page.evaluate(() => (window as unknown as {__buildFlight?: FlightWatch}).__buildFlight as FlightWatch);
}

test('Pluto BUILD: the bonus cards physically leave the slot and fly into the reveal', async ({page, request}) => {
  test.setTimeout(420_000);
  await bootSeededGame(page, request, await createGame(request), {buy: 2, keepColony: 'Pluto'});
  await page.waitForTimeout(1500);

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
  await shoot(page, '01-build-stage');

  const watching = watchFlight(page, 12_000);
  await page.keyboard.press('Enter'); // A = build confirm
  await page.waitForTimeout(1500);
  await shoot(page, '02-build-flight');
  await page.waitForTimeout(2500);
  await shoot(page, '03-build-landed');
  const seen = await watching;
  console.log('── Pluto build flight ──', JSON.stringify(seen));

  expect(seen.coverSeen, 'the build bonus never separated from its slot glyph').toBeTruthy();
  expect(seen.proxySeen, 'no card ever physically flew — the cards just appeared').toBeTruthy();
  expect(seen.proxyMax, 'both bonus cards fly as their own objects').toBeGreaterThanOrEqual(2);
  expect(seen.doubleImage, 'a real card was painted while its cover was still airborne').toBeFalsy();
  expect(seen.zoneBackWhileFlying, 'a card back stood in the reveal while covers were still flying').toBeFalsy();
  expect(seen.inPlaceFlip, 'a card flipped again AFTER landing (the in-air turn is the only flip)').toBeFalsy();
  expect(seen.earlyDissolve,
    `the colony stage was already gone when the cards launched (opacity ${seen.stageOpacityAtLaunch})`).toBeFalsy();
});
