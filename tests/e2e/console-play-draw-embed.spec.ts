/*
 * A PLAY'S DRAW BELONGS TO THE WORKSPACE THE PLAY WAS MADE IN.
 *
 * Two reported bugs, one contract, one probe:
 *
 *  1. THE HAND WORKSPACE. Playing a card that draws cards (Lagrange
 *     Observatory — «Возьмите 1 карту») folded the workspace on the landing
 *     beat and the batch then arrived as a full-bleed reveal over the board:
 *     the player pressed «Разыграть» inside a screen and the result of that
 *     press appeared somewhere else. The reveal must present INSIDE
 *     `.con-hand__outcome`, and the workspace must stand until every card has
 *     been taken.
 *
 *  2. THE GAME START WORKSPACE (Point Luna). Its draw comes from a TRIGGERED
 *     effect on its own play (`onCardPlayed`, the Earth tag), so no `behavior`
 *     preview advertises it and the server attributes the batch to POINT LUNA
 *     rather than to the pressed card. Claimed by nobody, it opened the
 *     fullscreen viewer as though the card had come off the board. It must
 *     present in the deployment's own embed zone, with no viewer at all.
 *
 * Both are observed FRAME BY FRAME, because both bugs are one-frame
 * ownership questions: «did the workspace let go before the cards arrived?».
 */
import {expect, test, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'play-draw-embed');

/** Base, AUTOMATED, `drawCard: 1` and nothing else — the whole follow-up is
 *  the card it draws. */
const DRAW_CARD = 'Lagrange Observatory';
/** Filler so the starting hand is not a single card (the cursor walk needs
 *  somewhere to walk, and the batch must not be the hand's only content). */
const FILLER = ['Acquired Company', 'Rover Construction', 'Investment Loan'];

function newGameConfig(corps: ReadonlyArray<string>) {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'DrawEmbed', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true, // 500 of everything → the card is always affordable
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: corps.length,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [...corps],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    // Guaranteed first-hand project cards (dealt off the top of the deck).
    customProjectCards: [DRAW_CARD, ...FILLER],
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

async function key(page: Page, code: string, settleMs = 400): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function openConsole(page: Page, request: APIRequestContext, corps: ReadonlyArray<string>): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig(corps)});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});
  await page.waitForTimeout(3000); // deal cinematic settle
}

/**
 * Drive the start WIZARD (corp → project buy → summary) to its commit. Pure
 * state-driven walking — a blind key sequence drifts, because the deal
 * cinematic swallows the first presses (the landing probe paid for this).
 */
async function runWizard(page: Page, corp: string, buy: ReadonlyArray<string> = []): Promise<void> {
  const frame = page.locator('.con-start__frame');
  let lastFocused = '';
  let stalls = 0;
  const walk = async (focused: string) => {
    if (focused === '') {
      await page.waitForTimeout(400);
      return;
    }
    stalls = focused === lastFocused ? stalls + 1 : 0;
    await key(page, stalls >= 1 ? 'ArrowDown' : 'ArrowRight', 240);
    lastFocused = focused;
  };
  for (let i = 0; i < 220 && await frame.count() > 0; i++) {
    const s = await page.evaluate(() => ({
      active: (document.querySelector('.con-jrail__item--current')?.textContent ?? '').toUpperCase(),
      focused: document.querySelector('.con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '',
      picked: Array.from(document.querySelectorAll('.con-cards__slot--picked'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getAttribute('data-zoom-slot') ?? ''),
      ceremony: document.querySelector('.con-start--ceremony') !== null,
    }));
    if (s.ceremony) {
      return; // the wizard flowed into the deployment inside the same root
    }
    if (s.active.includes('КОРПОРАЦ')) {
      if (s.picked.includes(corp)) {
        await key(page, 'Period', 1100);
        lastFocused = '';
      } else if (s.focused === corp) {
        await key(page, 'Enter', 600);
        lastFocused = '';
      } else {
        await walk(s.focused);
      }
      continue;
    }
    if (s.active.includes('ПРОЕКТ')) {
      // The starting hand IS this step's purchase (testMode gives 500 M€, so
      // everything is affordable). Buying nothing leaves an empty hand — which
      // is exactly how this probe first failed.
      const missing = buy.filter((c) => !s.picked.includes(c));
      if (missing.length === 0) {
        await key(page, 'Period', 1100);
        lastFocused = '';
      } else if (missing.includes(s.focused)) {
        await key(page, 'Enter', 420);
        lastFocused = '';
      } else {
        await walk(s.focused);
      }
      continue;
    }
    await key(page, 'Enter', 1200); // the summary commits
  }
}

test.describe('a play\'s DRAW presents inside the workspace the play was made in', () => {
  test.setTimeout(300_000);

  /**
   * POINT LUNA — the corporation's own Earth tag draws a card as it is played,
   * in the middle of the deployment. Watched frame by frame from the commit
   * to the release.
   */
  test('the start workspace hosts a TRIGGERED draw (Point Luna), never a fullscreen viewer', async ({page, request}) => {
    await openConsole(page, request, ['Point Luna', 'CrediCor']);
    await runWizard(page, 'Point Luna');

    const log = {
      /** The drawn card presented INSIDE the deployment's embed zone. */
      embedded: false,
      /** The fullscreen viewer opened while the batch was on screen (the bug). */
      viewerFrames: 0,
      /** A full-bleed standalone reveal stood outside the workspace (the bug). */
      standaloneFrames: 0,
      /** The workspace was gone while the batch was still on screen (the bug). */
      orphanFrames: 0,
      trace: [] as Array<string>,
    };
    let shotEmbed = false;
    let goneStreak = 0;
    for (let i = 0; i < 200; i++) {
      const s = await page.evaluate(() => {
        const start = document.querySelector('.con-start');
        const reveal = document.querySelector('.con-reveal');
        return {
          start: start !== null,
          reveal: reveal !== null,
          // The reveal re-homed into the deployment's own zone.
          embedded: document.querySelector('.con-start__embed .con-reveal') !== null,
          // …and the two failure shapes.
          viewer: document.querySelector('.con-zoom') !== null,
          standalone: reveal !== null &&
            document.querySelector('.con-start__embed .con-reveal') === null,
          cta: start !== null && document.querySelector('.con-start__slot-a') !== null,
          mandatory: document.querySelector('.con-mandatory') !== null,
        };
      });
      log.trace.push(`${i} s:${s.start ? 1 : 0} r:${s.reveal ? 1 : 0} e:${s.embedded ? 1 : 0} z:${s.viewer ? 1 : 0}`);
      if (s.embedded) {
        log.embedded = true;
        if (!shotEmbed) {
          shotEmbed = true;
          await shoot(page, 'pointluna-embedded-draw');
        }
      }
      if (s.reveal && s.viewer) {
        log.viewerFrames++;
      }
      if (s.standalone) {
        log.standaloneFrames++;
      }
      if (s.reveal && !s.start) {
        log.orphanFrames++;
      }
      if (!s.start) {
        goneStreak++;
        if (goneStreak >= 8 || s.mandatory) {
          break;
        }
      } else {
        goneStreak = 0;
      }
      // A = play the queued corporation, then take the drawn card.
      if (s.cta || s.embedded) {
        await key(page, 'Enter', 700);
      } else {
        await page.waitForTimeout(200);
      }
    }
    console.log(`[point luna trace]\n${log.trace.join('\n')}`);
    expect(log.embedded, 'the triggered draw presented INSIDE the start workspace').toBeTruthy();
    expect(log.viewerFrames, 'no fullscreen viewer — the card is the workspace\'s, not the board\'s').toBe(0);
    expect(log.standaloneFrames, 'the batch never stood outside the workspace that produced it').toBe(0);
    expect(log.orphanFrames, 'the workspace never let go while its own cards were on screen').toBe(0);
    // …and the card really did reach the hand (the flow completed, not stalled).
    await expect(page.locator('.con-start')).toHaveCount(0, {timeout: 60_000});
  });

  /**
   * THE HAND WORKSPACE — «КАРТЫ В РУКЕ › ЛАГРАНЖЕВА ОБСЕРВАТОРИЯ › ДОБОР КАРТ».
   */
  test('the hand workspace holds its play\'s drawn card and leaves only once it is taken', async ({page, request}) => {
    await openConsole(page, request, ['CrediCor']);
    await runWizard(page, 'CrediCor', [DRAW_CARD, ...FILLER]);
    // The deployment plays the corporation on its own (CrediCor draws nothing);
    // press A through whatever CTA stands until the workspace releases.
    for (let i = 0; i < 120 && await page.locator('.con-start').count() > 0; i++) {
      if (await page.locator('.con-start__slot-a').count() > 0) {
        await key(page, 'Enter', 700);
      } else {
        await page.waitForTimeout(300);
      }
    }
    await expect(page.locator('.con-start')).toHaveCount(0, {timeout: 60_000});
    await page.waitForTimeout(3500); // the starting hand's intake settles

    // ── into the hand workspace, onto the card, and one level deeper. ──
    for (let i = 0; i < 6 && await page.locator('.con-hand__frame').count() === 0; i++) {
      await key(page, 'Period', 800);
      await key(page, 'Enter', 1100);
    }
    await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 15_000});
    await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
    await page.waitForTimeout(800);
    const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${DRAW_CARD}"]`).count();
    let lastSelected = '';
    for (let i = 0; i < 60 && await onTarget() === 0; i++) {
      const selected = await page.evaluate(() =>
        document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
      await key(page, selected === lastSelected && i > 0 ? 'ArrowDown' : 'ArrowRight', 260);
      lastSelected = selected;
    }
    expect(await onTarget(), `hand cursor never reached ${DRAW_CARD}`).toBeGreaterThan(0);
    await key(page, 'Enter', 600);
    await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 15_000});
    await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 15_000});
    await page.waitForTimeout(1200);
    await shoot(page, 'hand-composer');

    // ── CONFIRM, and watch the whole episode. ──
    await page.keyboard.press('Enter');
    const log = {
      embedded: false,
      /** The workspace was gone while the drawn card was on screen (the bug). */
      orphanFrames: 0,
      /** The reveal stood as a full-bleed band outside the workspace (the bug). */
      standaloneFrames: 0,
      /** The fullscreen viewer took the single drawn card (the bug's 1-card shape). */
      viewerFrames: 0,
      /** The landing scene stayed until the outcome arrived (no empty stage). */
      sawLanding: false,
      landingFrames: 0,
      /** Frames with the workspace up and NOTHING in its stage (the gap bug). */
      emptyFrames: 0,
      /** The stage names itself in the SHARED chassis head + status line. */
      sawHead: false,
      sawStatus: false,
      /** Frames where the hand shelf stood LIT behind the embedded stage. */
      unparkedFrames: 0,
      /** The workspace crumb grew a tail instead of restarting a screen. */
      crumb: '',
      trace: [] as Array<string>,
    };
    let shotEmbed = false;
    let taken = false;
    for (let i = 0; i < 120; i++) {
      const s = await page.evaluate(() => {
        const reveal = document.querySelector('.con-reveal');
        const embedded = document.querySelector('.con-hand__outcome .con-reveal');
        return {
          hand: document.querySelector('.con-hand') !== null,
          reveal: reveal !== null,
          embedded: embedded !== null,
          landing: document.querySelector('.con-composer__playstage--up') !== null,
          viewer: document.querySelector('.con-zoom') !== null,
          untaken: document.querySelectorAll('.con-reveal .con-cards__slot:not(.con-cards__slot--taken)').length,
          // The stage's own chassis (title row + status line) and the
          // workspace crumb ABOVE it — the four-condition contract's «one
          // continuous line, only the tail advances».
          head: embedded?.querySelector('.con-ws-stage-head') !== null &&
            embedded?.querySelector('.con-ws-stage-head') !== undefined,
          status: embedded?.querySelector('.con-ws-stage-status') !== null &&
            embedded?.querySelector('.con-ws-stage-status') !== undefined,
          crumb: (document.querySelector('.con-wshead')?.textContent ?? '')
            .replace(/\s+/g, ' ').trim(),
          // The browse shelf must stay PARKED behind the stage.
          browseParked: document.querySelector('.con-hand__browse--parked') !== null,
        };
      });
      log.trace.push(`${i} h:${s.hand ? 1 : 0} r:${s.reveal ? 1 : 0} e:${s.embedded ? 1 : 0} l:${s.landing ? 1 : 0} z:${s.viewer ? 1 : 0} u:${s.untaken} p:${s.browseParked ? 1 : 0} | ${s.crumb}`);
      if (s.embedded && s.crumb !== '') {
        log.crumb = s.crumb;
      }
      if (s.embedded && !s.browseParked) {
        log.unparkedFrames++;
      }
      if (s.landing) {
        log.sawLanding = true;
        if (!s.reveal) {
          log.landingFrames++;
        }
      }
      // THE FLIGHT WINDOW — the hero has ended, the deck is dealing the drawn
      // card, and the workspace must still be showing the settled tableau. An
      // empty frame here is the «UI исчез → пауза → готовый reveal» shape.
      if (!s.reveal && !s.landing && !s.viewer && s.hand && log.sawLanding) {
        log.emptyFrames++;
        if (log.emptyFrames === 2) {
          await shoot(page, 'hand-flight-window');
        }
      }
      if (s.embedded) {
        log.embedded = true;
        log.sawHead = log.sawHead || s.head;
        log.sawStatus = log.sawStatus || s.status;
        if (!shotEmbed) {
          shotEmbed = true;
          // SETTLED, not the first frame: the batch is still flying on the
          // frame the zone appears, and a screenshot there proves nothing
          // about the stage the player actually reads.
          await page.waitForTimeout(900);
          await shoot(page, 'hand-embedded-draw');
        }
      }
      if (s.reveal && !s.embedded) {
        log.standaloneFrames++;
      }
      if (s.reveal && !s.hand) {
        log.orphanFrames++;
      }
      if (s.reveal && s.viewer) {
        log.viewerFrames++;
      }
      // A takes the card once the batch has arrived; then the workspace must
      // leave on its own.
      if (s.embedded && s.untaken > 0) {
        await key(page, 'Enter', 500);
        taken = true;
        continue;
      }
      if (taken && !s.reveal && !s.hand) {
        break;
      }
      await page.waitForTimeout(220);
    }
    console.log(`[hand draw trace]\n${log.trace.join('\n')}`);
    expect(log.embedded, 'the drawn card presented INSIDE the hand workspace').toBeTruthy();
    expect(log.standaloneFrames, 'never a full-bleed band outside the workspace that drew it').toBe(0);
    expect(log.orphanFrames, 'the workspace never let go while its own card was on screen').toBe(0);
    expect(log.viewerFrames, 'a single drawn card is the workspace\'s stage, not a fullscreen hand-over').toBe(0);
    expect(log.sawLanding, 'the landing scene held the stage until the outcome arrived').toBeTruthy();
    // ONE SURFACE TAKES OVER FROM ANOTHER. The deck deals the drawn card only
    // after the hero's scene ends, so the settled tableau has to stand through
    // that flight — an empty workspace there is «UI исчез → пауза → готовый
    // reveal», the shape this whole contract exists to remove.
    expect(log.emptyFrames, 'the workspace is never empty between the landing and the draw').toBe(0);
    expect(log.unparkedFrames, 'the hand shelf stays PARKED behind the stage — never a surface floating over its own screen').toBe(0);
    expect(log.sawHead, 'the stage wears the shared chassis head (it names itself once, in the stage)').toBeTruthy();
    expect(log.sawStatus, 'the stage carries the shared status line («A Взять»)').toBeTruthy();
    // ONE CONTINUOUS LINE: root › the played card › the stage. The workspace
    // name and the card name never restart, and only the tail advances.
    expect(log.crumb.toUpperCase(), `the crumb kept its context and gained a tail (got «${log.crumb}»)`)
      .toContain('ДОБОР КАРТ');
    expect(log.crumb.toUpperCase()).toContain('ЛАГРАНЖА');
    // …and the flow ENDS: the workspace leaves once the card is taken.
    await expect(page.locator('.con-hand')).toHaveCount(0, {timeout: 30_000});
    await shoot(page, 'hand-after-take');
  });
});
