import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig, waitQueueIdle} from './consoleStart';

/**
 * Console-native · the first-action stage whose action DRAWS A PICK —
 * Valley Trust («возьмите 3 пролога и разыграйте один»).
 *
 * The physical contract this guards, and the two ways it was broken:
 *  ① the drawn preludes must be DEALT into the deployment queue — which means
 *    the queue must be BACK and settled before the deal measures it. The
 *    stage recedes the room for its briefing, and the return used to hang off
 *    one prompt-watcher with a stage guard: fired in the other order, the
 *    room stayed away and the cards simply appeared («прологи выкладываются
 *    без анимации»);
 *  ② the chosen prelude must FLY into «РАЗЫГРАНО» — which means the shelf
 *    must be back and MEASURABLE, or the hero has no landing target and the
 *    card commits in one frame («разыгрывается одним кадром»).
 *
 * …and the shelf itself now STAYS through the briefing (tucked to its peek,
 * the stage laid out above it): it is where the seated card came from and
 * where it settles back, so receding it made that swap happen in a void.
 *
 * Both are asserted as VISIBILITY OF THE REAL SURFACES at the moment they are
 * needed, plus the hero proxy actually existing for the play.
 */

const OUT_DIR = path.resolve('screenshots', 'console-first-action-draw');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'DrawStageTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  startingCorporations: 1,
  customCorporationsList: ['Valley Trust'],
  expansions: {corpera: true, prelude: true},
  // EVERY prelude in the deck DRAWS CARDS, on purpose: Valley Trust's first
  // action deals three of these as the pick, so whichever one the player
  // takes produces a draw — which is the whole subject of assertion ③ (that
  // draw must present INSIDE the workspace). With an ordinary prelude deck
  // the winner often draws nothing and ③ silently tests nothing at all.
  customPreludes: ['Biolab', 'Martian Survey', 'Research Network', 'Acquired Space Agency'],
  startingPreludes: 4,
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** Is this surface genuinely PAINTED (not receded to autoAlpha 0)? */
async function painted(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el !== null &&
      (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
  }, selector).catch(() => false);
}

test.describe('console first action · a drawn pick (Valley Trust)', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the drawn preludes are dealt into a standing queue and the pick FLIES to «РАЗЫГРАНО»', async ({page, request}) => {
    test.setTimeout(300_000);

    await bootIntoGame(page, request, {
      config: GAME_CONFIG,
      corporation: 'Valley Trust',
      preludes: ['Biolab', 'Martian Survey'],
      until: 'startRelease',
    });

    // The deck is all-drawing on purpose, so the player's OWN preludes open
    // their (embedded) reveals first — take them until the stage stands.
    const stage = page.locator('.con-start__firstact');
    for (let i = 0; i < 40 && await stage.count() === 0; i++) {
      if (await page.locator('.con-reveal').count() > 0) {
        await page.keyboard.press('Escape'); // B = take all
      }
      await page.waitForTimeout(700);
    }
    await stage.waitFor({state: 'visible', timeout: 60_000});
    await page.waitForTimeout(1200);
    await shoot(page, '01-stage');

    // THE BRIEFING OWNS THE ROOM — but «РАЗЫГРАНО» IS NOT PART OF IT.
    //
    // It used to recede with the queue, and that made both halves of the seat
    // swap fly into nothing: the corporation EMERGES from this shelf and
    // SETTLES back into it, so a receded shelf is a card shrinking toward a
    // place the player cannot see. It stays lit and merely TUCKS to its peek
    // band (`--shelfstage`), with the stage laid out ABOVE it. The seat's own
    // place in it stands EMPTY, which is the visible half of the same fact.
    expect(await painted(page, '.con-splayed'),
      'the shelf stays on stage — it is the seat\'s own home').toBeTruthy();
    const stageBox = await stage.boundingBox();
    const shelfBox = await page.locator('.con-splayed').boundingBox();
    expect((stageBox?.y ?? 0) + (stageBox?.height ?? 0),
      'and the briefing is laid out above it, never over it').toBeLessThanOrEqual(shelfBox?.y ?? 0);
    expect(await page.locator('[data-played-key="Valley Trust"] .con-splayed__place').count(),
      'the seated corporation left its place empty').toBe(1);

    // A performs the first action → the three preludes are drawn as a PICK.
    await page.keyboard.press('Enter');

    // ── ① THE ROOM COMES BACK FOR THE CANDIDATES, and the cards are dealt
    //    INTO it. Sample while the deal is running: the queue must be painted
    //    (a deal into a receded surface is the invisible-deal bug) and the
    //    deck-deal layer must actually run.
    const queueCards = page.locator('.con-start__qcard');
    await expect.poll(async () => queueCards.count(), {timeout: 45_000}).toBeGreaterThan(0);

    // The deal HOLDS its cards while the proxies fly, so the honest claim is
    // not about one frame but about the ORDER: the queue must be standing
    // before the cards land in it. Sampled while the cinematic runs — with
    // the room left receded (the bug) this never becomes true.
    let sawDealLayer = false;
    let sawHeldSlot = false;
    let queuePainted = false;
    for (let i = 0; i < 80 && !(queuePainted && (sawDealLayer || sawHeldSlot)); i++) {
      sawDealLayer = sawDealLayer || await page.locator('.con-deal-layer').count() > 0;
      sawHeldSlot = sawHeldSlot || await page.locator('.con-start__qcard.con-deal-hold').count() > 0;
      queuePainted = queuePainted || await painted(page, '.con-start__queue');
      await page.waitForTimeout(60);
    }
    await shoot(page, '02-candidates-dealt');
    expect(sawDealLayer || sawHeldSlot,
      'the drawn preludes must ARRIVE (deal cinematic), never just appear').toBeTruthy();
    expect(queuePainted,
      'the drawn candidates must be dealt into a STANDING queue').toBeTruthy();
    // …and they are genuinely ON SCREEN once the cinematic releases them.
    await expect.poll(async () => page.locator('.con-start__qcard:not(.con-deal-hold)').count(),
      {timeout: 30_000, message: 'the dealt candidates never became visible'}).toBeGreaterThan(0);

    // ── ② THE PICK FLIES HOME. The shelf must be painted and measurable when
    //    the hero launches, else the card commits in a single frame.
    //
    //    Wait for the queue to be genuinely IDLE first (the shared driver's
    //    verdict): a press during the deal is consumed as its SKIP by design,
    //    so pressing early tests nothing.
    await waitQueueIdle(page);
    await expect.poll(async () => painted(page, '.con-splayed'),
      {timeout: 30_000, message: 'the played shelf must be back before the pick'}).toBeTruthy();

    const before = await queueCards.count();
    await page.keyboard.press('Enter');

    // Sample for the flight until the pick has RESOLVED, never for a fixed
    // window: a drawing winner (Experimental Forest) first sends the seated
    // corporation home, and the submit's round trip is machine-speed — a
    // 3 s budget passes alone and flakes in a parallel run, which says
    // nothing about the product either way.
    let sawHeroProxy = false;
    let resolved = false;
    const deadline = 40;
    for (let i = 0; i < deadline * 10 && !(resolved && sawHeroProxy); i++) {
      sawHeroProxy = sawHeroProxy ||
        await page.locator('.con-played-hero__proxy, .con-startdock-proxy').count() > 0;
      resolved = resolved || await queueCards.count() < before;
      if (resolved && sawHeroProxy) {
        break;
      }
      await page.waitForTimeout(100);
    }
    await shoot(page, '03-pick-flying');
    expect(resolved, 'the pick never resolved (the candidates stayed in the queue)').toBeTruthy();
    expect(sawHeroProxy, 'the chosen prelude must FLY into «РАЗЫГРАНО», never commit in one frame').toBeTruthy();
    await shoot(page, '04-after-pick');

    // ── ③ EVERYTHING THE FIRST ACTION SET OFF STAYS INSIDE THE WORKSPACE.
    //    The picked prelude may draw cards of its own; those cards must
    //    present in the start workspace's OWN zone — never as a standalone
    //    full-bleed «Получены карты» over a workspace that already let go.
    let sawStandaloneReveal = false;
    let startGoneWhileRevealing = false;
    for (let i = 0; i < 120; i++) {
      const s = await page.evaluate(() => {
        const reveal = document.querySelector('.con-reveal');
        const start = document.querySelector('.con-start');
        const embedded = document.querySelector('.con-start__embed .con-reveal') !== null;
        return {
          reveal: reveal !== null,
          embedded,
          startPainted: start !== null &&
            (start as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true}),
        };
      });
      if (s.reveal && !s.embedded) {
        sawStandaloneReveal = true;
      }
      if (s.reveal && !s.startPainted) {
        startGoneWhileRevealing = true;
      }
      if (!s.reveal && !await page.locator('.con-start').count()) {
        break; // the whole start flow is over — nothing left to watch
      }
      await page.waitForTimeout(100);
    }
    await shoot(page, '05-follow-up-presentation');
    expect(sawStandaloneReveal,
      'a draw caused by the first action must present INSIDE the workspace, not in a standalone modal').toBeFalsy();
    expect(startGoneWhileRevealing,
      'the start workspace may not let go while its own action is still presenting').toBeFalsy();
  });
});
