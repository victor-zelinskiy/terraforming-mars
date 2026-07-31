import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * «КАРТЫ В РУКЕ» as a first-class WORKSPACE, and playing a card as a DESCENT
 * inside it.
 *
 * The four conditions a stage reached from inside a workspace must satisfy are
 * geometric and structural, so this is where they are guarded:
 *
 *  1. EMBEDDED — the play composer renders INSIDE `.con-hand`'s stage zone, as
 *     ONE instance (never a second copy, never a band of its own);
 *  2. CONTINUOUS BREADCRUMB — `КАРТЫ В РУКЕ › <карта> › РОЗЫГРЫШ`: the root and
 *     the subject are the SAME nodes before and after, only the tail grows;
 *  3. THE SAME PHRASE ONE LEVEL DEEPER — the shelf PARKS (it is never
 *     unmounted), the frame / rail / bars do not move;
 *  4. B IS ONE LOGICAL LEVEL — back to the hand, not out to the board, and the
 *     selection survives it.
 *
 * Screenshots land in screenshots/console-hand-workspace/ for the visual review.
 */

const OUT = path.resolve('screenshots', 'console-hand-workspace');

function newGameConfig() {
  return {
    players: [{name: 'HandWsTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
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
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** Boot a solo game and land on the board home (verbatim from hand-reveal-probe). */
async function bootGame(page: Page, request: any, buyProjects: number, profileQuery = ''): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1${profileQuery}`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForTimeout(3500);
  // The start wizard, driven STEP BY STEP rather than by one flat key walk: a
  // step that has hit its own limit («Лимит 2/2», «Недостаточно средств»)
  // swallows A, so a rotating sequence stalls there forever — which is exactly
  // how the first two cuts of this spec hung.
  // NB: the step advance is RT (`Period`) — «СЛЕД. ШАГ» in the wizard's own
  // footer. RB (`KeyE`) is a different verb and leaves the step where it was,
  // which is how an earlier cut bought 14 cards and ran the wallet dry.
  const launch = page.getByText('НАЧАТЬ ПАРТИЮ').first();
  // Driven by the wizard's OWN counter, never by a fixed number of presses: a
  // step that takes one extra beat to settle shifts a blind sequence onto the
  // wrong screen, and the run then starts with an EMPTY hand — which looks
  // like a broken hand screen and is really a lost boot.
  const pickedCount = async(): Promise<number> => {
    const text = await page.locator('.con-start__frame').innerText().catch(() => '');
    return Number(/Выбрано\s+(\d+)/.exec(text)?.[1] ?? '0');
  };
  // 1 · CORPORATION — exactly one pick, then advance.
  for (let i = 0; i < 6 && await pickedCount() < 1; i++) {
    await key(page, 'Enter', 900);
  }
  await key(page, 'Period', 1700);
  // 2 · PROJECTS — buy a small, affordable handful (3 M€ each of 36).
  await page.getByText('стартовые карты для покупки').first().waitFor({timeout: 15_000}).catch(() => {});
  for (let i = 0; i < 24 && await pickedCount() < buyProjects; i++) {
    await key(page, 'Enter', 700);
    await key(page, 'ArrowRight', 260);
  }
  expect(await pickedCount(), 'starting projects bought').toBeGreaterThanOrEqual(1);
  await key(page, 'Period', 1700);
  // 3 · SUMMARY — the launch is the explicit A CTA.
  for (let i = 0; i < 4 && await launch.count() === 0; i++) {
    await key(page, 'Period', 1300);
  }
  if (await launch.count() > 0) {
    await key(page, 'Enter', 2400); // pay + start
  }
  await page.waitForTimeout(3000);
  const live = page.locator('.con-handdock--live');
  const placement = page.locator('.con-context__task-kicker');
  const wizard = page.locator('.con-start__frame');
  const quick = page.locator('.con-quick');
  const handSec = page.locator('.con-hand');
  const composer = page.locator('.con-composer');
  const banner = page.locator('.con-banner');
  const finishers = ['ArrowRight', 'Enter', 'KeyE'];
  const dirs = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 36 && (await live.count() === 0 || await placement.count() > 0); i++) {
      if (await quick.count() > 0) {
        await key(page, 'Escape', 1100);
      } else if (await composer.count() > 0) {
        const corpFirst = await page.locator('.con-composer--corpfirst').count() > 0;
        await key(page, corpFirst ? 'Enter' : 'KeyX', 1600);
      } else if (await handSec.count() > 0) {
        // CLOSE the hand — never A. This spec needs the hand to still HOLD the
        // cards it was dealt; a self-healing Enter here plays them, and the
        // test then walks into an empty shelf («КАРТЫ 0/0»).
        await key(page, 'Escape', 1400);
      } else if (await wizard.count() > 0) {
        await key(page, finishers[i % finishers.length], 900);
      } else if (await placement.count() > 0) {
        await key(page, 'Enter', 1200);
        if (await placement.count() > 0) {
          await key(page, dirs[i % dirs.length], 600);
          await key(page, 'Enter', 1400);
        }
      } else {
        await key(page, 'Enter', 1500);
      }
    }
    await page.waitForTimeout(2500);
    if (await live.count() === 1 && await placement.count() === 0) {
      break;
    }
  }
  if (await live.count() === 0) {
    await shoot(page, 'boot-stuck');
  }
  await expect(live).toHaveCount(1);
  // Resolve anything the self-healing walk MINIMIZED on the way here. A
  // deferred prompt keeps the action window shut, and then every card in hand
  // reads «нельзя разыграть» — which looks exactly like a broken hand and is
  // really just a boot artifact.
  for (let i = 0; i < 8 && await page.locator('.con-mandatory').count() > 0; i++) {
    await key(page, 'Enter', 1400);
    if (await placement.count() > 0) {
      await key(page, 'Enter', 1400);
    }
  }
  await page.waitForTimeout(1000);
}

/** RT wheel → A («КАРТЫ»), then let the reveal episode settle. */
async function openHand(page: Page): Promise<void> {
  for (let i = 0; i < 4 && await page.locator('.con-hand').count() === 0; i++) {
    await key(page, 'Period', 600);
    await key(page, 'Enter', 2600);
    // A wheel that stayed open means the commit did not take (a beat was still
    // running when it opened) — close it and try the whole gesture again.
    if (await page.locator('.con-quick').count() > 0) {
      await key(page, 'Escape', 700);
    }
  }
  await expect(page.locator('.con-hand')).toHaveCount(1);
  await page.waitForTimeout(600);
}

/**
 * Walk the cursor onto a card that can actually be played.
 *
 * The hand is sorted playable-first, so this normally lands on the first press.
 * A hand with NOTHING playable means the boot left a prompt open rather than
 * anything about this screen — the caller reports that honestly instead of
 * failing on a misleading assertion about the cursor.
 */
async function focusPlayableCard(page: Page): Promise<string> {
  // A hand where NOTHING is playable is a boot artifact, not a screen defect:
  // the walk minimized a prompt somewhere and the action window is still shut,
  // so every card reads «нельзя разыграть». Recover by going back to the board,
  // restoring whatever was deferred, answering it, and re-opening.
  for (let round = 0; round < 3 && await page.locator('.con-hand__slot--playable').count() === 0; round++) {
    await key(page, 'Escape', 1800); // leave the hand
    await key(page, 'Escape', 1500); // restore a deferred prompt, if there is one
    for (let i = 0; i < 6; i++) {
      const pending = await page.locator('.con-mandatory, .con-task-host, .con-context__task-kicker').count();
      if (pending === 0) {
        break;
      }
      await key(page, 'Enter', 1400);
    }
    await openHand(page);
  }
  if (await page.locator('.con-hand__slot--playable').count() === 0) {
    await shoot(page, 'no-playable-card');
    return '';
  }
  for (let i = 0; i < 30; i++) {
    const focused = page.locator('.con-hand__slot--selected.con-hand__slot--playable');
    if (await focused.count() > 0) {
      return await focused.first().getAttribute('data-zoom-slot') ?? '';
    }
    await key(page, 'ArrowRight', 220);
  }
  return '';
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  // The Deck is the tightest band the workspace has to hold: the seam tokens
  // narrow it AND the composition has to stay two columns without a horizontal
  // scroll ever appearing.
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console hand workspace · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('hand is a workspace · A descends into the card · B is one level back', async ({page, request}) => {
      test.setTimeout(480_000);
      // Eight starting projects: the wallet affords twelve, and a hand this
      // size reliably contains at least one card with no unmet requirement
      // (the descent half of this spec needs a card that can actually be played).
      await bootGame(page, request, 8, profile.query);
      await openHand(page);

      // ── 1 · THE HAND IS A WORKSPACE ────────────────────────────────────
      const hand = page.locator('.con-hand');
      await expect(hand).toHaveClass(/con-ws/);
      await expect(hand).toHaveAttribute('data-flow', 'browse');
      await expect(page.locator('.con-hand__frame')).toHaveCount(1);
      // The SHARED header, with its identity emblem and the workspace name.
      await expect(page.locator('.con-hand .con-wshead__emblem')).toHaveCount(1);
      expect((await page.locator('.con-hand .con-wshead__root').innerText()).trim().toUpperCase())
        .toContain('КАРТЫ В РУКЕ');
      // Browse layer = no tail. The crumb only ever GAINS one.
      await expect(page.locator('.con-hand .con-wshead__subject')).toHaveCount(0);
      // The rail is lit and ringed by the `con-ws` marker (the wallet every
      // play on this screen is paid from stays on-screen context).
      await expect(page.locator('.con-root:has(.con-ws) .con-res-host')).toHaveCount(1);
      await shoot(page, `${profile.tag}-1-browse`);

      const frameBefore = await page.locator('.con-hand__frame').boundingBox();
      const cardName = await focusPlayableCard(page);
      expect(cardName, 'a playable card in hand').not.toBe('');

      // ── 2 · A DESCENDS — embedded, not a new surface ────────────────────
      await key(page, 'Enter', 1800);
      await expect(hand, 'the hand workspace stays on screen').toHaveCount(1);
      await expect(hand).toHaveAttribute('data-flow', 'configure');
      // ONE composer, and it lives INSIDE the hand's stage zone.
      await expect(page.locator('.con-composer--play')).toHaveCount(1);
      await expect(page.locator('.con-hand__stage .con-composer--play.con-composer--embed')).toHaveCount(1);
      // …which means it is NOT a band overlay any more.
      await expect(page.locator('body > .con-composer--play')).toHaveCount(0);
      // The browse layer is PARKED, never unmounted — that is what makes the
      // way back a return rather than a rebuild.
      await expect(page.locator('.con-hand__browse--parked')).toHaveCount(1);
      await expect(page.locator('.con-hand__slot').first()).toHaveCount(1);

      // ── 3 · THE BREADCRUMB IS CONTINUOUS ───────────────────────────────
      expect((await page.locator('.con-hand .con-wshead__root').innerText()).trim().toUpperCase())
        .toContain('КАРТЫ В РУКЕ');
      await expect(page.locator('.con-hand .con-wshead__subject')).toHaveCount(1);
      expect((await page.locator('.con-hand .con-wshead__step').innerText()).trim().toUpperCase())
        .toBe('РОЗЫГРЫШ');
      // The embedded surface does NOT title itself.
      await expect(page.locator('.con-hand__stage .con-composer__kicker')).toHaveCount(0);
      await expect(page.locator('.con-hand__stage .con-composer__name')).toHaveCount(0);

      // ── 4 · THE FRAME DID NOT MOVE ─────────────────────────────────────
      // Measured AT REST on both sides: the contract is «the frame does not
      // move», not «no intermediate frame of any animation ever differs» — the
      // dock park and the band's ResizeObserver both settle a beat after the
      // descent, and sampling inside that window makes this guard flaky about
      // something it is not testing.
      await page.waitForTimeout(700);
      const frameAfter = await page.locator('.con-hand__frame').boundingBox();
      const box = `browse ${JSON.stringify(frameBefore)} → stage ${JSON.stringify(frameAfter)}`;
      expect(Math.abs((frameAfter?.x ?? 0) - (frameBefore?.x ?? 0)), box).toBeLessThan(1.5);
      expect(Math.abs((frameAfter?.y ?? 0) - (frameBefore?.y ?? 0)), box).toBeLessThan(1.5);
      expect(Math.abs((frameAfter?.width ?? 0) - (frameBefore?.width ?? 0)), box).toBeLessThan(1.5);
      expect(Math.abs((frameAfter?.height ?? 0) - (frameBefore?.height ?? 0)), box).toBeLessThan(1.5);
      // A workspace never scrolls sideways — least of all on the Deck, where
      // the band is narrowest and a stray `vw` cap is the classic overrun.
      const overflowX = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflowX, 'no horizontal overflow in the play stage').toBeLessThanOrEqual(1);
      await shoot(page, `${profile.tag}-2-play-stage`);

      // ── 5 · B IS ONE LOGICAL LEVEL ─────────────────────────────────────
      await key(page, 'Escape', 2000);
      await expect(page.locator('.con-composer--play')).toHaveCount(0);
      await expect(hand, 'B returns to the HAND, never straight to the board').toHaveCount(1);
      await expect(hand).toHaveAttribute('data-flow', 'browse');
      await expect(page.locator('.con-hand__browse--parked')).toHaveCount(0);
      await expect(page.locator('.con-hand .con-wshead__subject')).toHaveCount(0);
      // The carried card came home and is still the selection.
      await expect(page.locator(`.con-hand__slot--selected[data-zoom-slot="${cardName}"]`)).toHaveCount(1);
      await shoot(page, `${profile.tag}-3-restored`);

      // …and only the NEXT B leaves the workspace.
      await key(page, 'Escape', 2600);
      await expect(page.locator('.con-hand')).toHaveCount(0);
    });
  });
}
