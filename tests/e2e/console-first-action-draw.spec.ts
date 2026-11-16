import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, settle, soloGameConfig, waitQueueIdle} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';

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
    // their (embedded) reveals first — take them until the stage stands. Each
    // round waits for what it acts on (the stage, or a reveal not already
    // taking), B goes only to a standing reveal, and its EFFECT is the witness
    // (that batch collecting, or gone); a swallowed B is pressed again on the
    // next round — never a fixed pause between looks.
    const stage = page.locator('.con-start__firstact');
    const revealOpen = page.locator('.con-reveal:not([data-take="busy"])');
    for (let i = 0; i < 40 && await stage.count() === 0; i++) {
      await expect.poll(async () => await stage.count() > 0 || await revealOpen.count() > 0,
        {timeout: 60_000, message: 'neither the first-action stage nor a prelude\'s own reveal ever stood'}).toBe(true);
      if (await stage.count() > 0) {
        break;
      }
      await page.keyboard.press('Escape'); // B = take all
      await expect.poll(async () => await revealOpen.count() === 0 || await stage.count() > 0, {timeout: 3_000})
        .toBe(true).catch(() => { /* swallowed — the next round presses again */ });
    }
    await stage.waitFor({state: 'visible', timeout: 60_000});
    // The briefing's entrance over: the layout below is read AT REST (both boxes in one read, two equal reads a frame
    // apart). The start is a phase-long scene, so its quiet is waited for softly — the read itself must hold still.
    await settle(page, {timeoutMs: 20_000}).catch(() => { /* the read below still waits for rest */ });
    const laid = await readSettled(page, async () => ({
      stage: await stage.boundingBox(),
      shelf: await page.locator('.con-splayed').boundingBox(),
    }), {settle: false, message: 'the briefing and the shelf at rest'});
    await shoot(page, '01-stage');

    // THE BRIEFING OWNS THE ROOM — but «РАЗЫГРАНО» IS NOT PART OF IT.
    //
    // It used to recede with the queue, and that made both halves of the seat
    // swap fly into nothing: the corporation EMERGES from this shelf and
    // SETTLES back into it, so a receded shelf is a card shrinking toward a
    // place the player cannot see. It stays lit and merely TUCKS to its peek
    // band (`--shelfstage`), with the stage laid out ABOVE it. The seat's own
    // place in it stands EMPTY, which is the visible half of the same fact.
    await expect.poll(() => painted(page, '.con-splayed'),
      {message: 'the shelf stays on stage — it is the seat\'s own home'}).toBe(true);
    const stageBox = laid.stage;
    const shelfBox = laid.shelf;
    expect((stageBox?.y ?? 0) + (stageBox?.height ?? 0),
      'and the briefing is laid out above it, never over it').toBeLessThanOrEqual(shelfBox?.y ?? 0);
    await expect.poll(() => page.locator('[data-played-key="Valley Trust"] .con-splayed__place').count(), {message: 'the seated corporation left its place empty'}).toBe(1);

    // ── ① THE ROOM COMES BACK FOR THE CANDIDATES, and the cards are dealt
    //    INTO it. RECORDED from before the press (`armWitness` — the product's
    //    own writes): the queue must be painted (a deal into a receded surface
    //    is the invisible-deal bug) and the deck-deal layer must actually run.
    type DealSeen = {dealLayer: boolean, heldSlot: boolean, queuePainted: boolean};
    const deal = await armWitness<DealSeen>(page, 'first-action-deal', () => {
      const queue = document.querySelector<HTMLElement>('.con-start__queue');
      return {
        dealLayer: document.querySelector('.con-deal-layer') !== null,
        heldSlot: document.querySelector('.con-start__qcard.con-deal-hold') !== null,
        queuePainted: queue !== null && queue.checkVisibility({opacityProperty: true, visibilityProperty: true}),
      };
    });

    // A performs the first action → the three preludes are drawn as a PICK.
    await page.keyboard.press('Enter');

    const queueCards = page.locator('.con-start__qcard');
    await expect.poll(async () => queueCards.count(), {timeout: 45_000}).toBeGreaterThan(0);

    // The deal HOLDS its cards while the proxies fly, so the honest claim is
    // not about one frame but about the ORDER: the queue must be standing
    // before the cards land in it. The record closes once it holds both facts
    // (bounded — with the room left receded, the bug, this never becomes true,
    // and the claims below name it).
    const dealSeen = async () => ({
      arrived: await deal.ever((s) => s.dealLayer || s.heldSlot),
      queuePainted: await deal.ever((s) => s.queuePainted),
    });
    await expect.poll(async () => {
      const d = await dealSeen();
      return d.arrived && d.queuePainted;
    }, {timeout: 10_000}).toBe(true).catch(() => { /* the claims below say which half never came */ });
    const dealt = await dealSeen();
    await deal.stop();
    await shoot(page, '02-candidates-dealt');
    expect(dealt.arrived,
      'the drawn preludes must ARRIVE (deal cinematic), never just appear').toBeTruthy();
    expect(dealt.queuePainted,
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
    // Both records armed BEFORE the press: the pick's flight (short — a poll after the press can sleep through it) and
    // everything the first action sets off after it (③ — `settled`: «a reveal standing while the start is gone» is
    // a claim about ONE painted state, never the gap between two writes of one teardown).
    type PickSeen = {heroProxy: boolean, cards: number};
    const pick = await armWitness<PickSeen>(page, 'first-action-pick', () => ({
      heroProxy: document.querySelector('.con-played-hero__proxy, .con-startdock-proxy') !== null,
      cards: document.querySelectorAll('.con-start__qcard').length,
    }));
    type FollowSeen = {reveal: boolean, standalone: boolean, presenting: boolean, start: boolean, startPainted: boolean};
    const follow = await armWitness<FollowSeen>(page, 'first-action-follow-up', () => {
      const start = document.querySelector<HTMLElement>('.con-start');
      return {
        reveal: document.querySelector('.con-reveal') !== null,
        // A FULL-BLEED band is the overlay in its own STANDALONE mode — the product's declared mode, never an
        // embedded one caught between two tasks of its host's teardown (a host leaves a task before its stage).
        standalone: document.querySelector('.con-reveal:not(.con-reveal--embedded)') !== null,
        // STILL PRESENTING: a reveal with a card the player has not taken, and not already collecting them.
        presenting: Array.from(document.querySelectorAll('.con-reveal')).some((r) => {
          if (r.classList.contains('con-reveal--collecting')) {
            return false;
          }
          const slots = r.querySelectorAll('[data-zoom-slot]').length;
          return slots === 0 || slots > r.querySelectorAll('.con-reveal__takenmark').length;
        }),
        start: start !== null,
        startPainted: start !== null && start.checkVisibility({opacityProperty: true, visibilityProperty: true}),
      };
    }, {settled: true, max: 20_000});
    await page.keyboard.press('Enter');

    // Recorded until the pick has RESOLVED and the hero has flown, never for a
    // fixed window: a drawing winner (Experimental Forest) first sends the
    // seated corporation home, and the submit's round trip is machine-speed
    // (bounded — the claims below name what never came).
    const pickSeen = async () => ({
      resolved: await pick.ever((s) => s.cards < before),
      heroProxy: await pick.ever((s) => s.heroProxy),
    });
    await expect.poll(async () => {
      const p = await pickSeen();
      return p.resolved && p.heroProxy;
    }, {timeout: 40_000}).toBe(true).catch(() => { /* the claims below say which half never came */ });
    const picked = await pickSeen();
    await pick.stop();
    await shoot(page, '03-pick-flying');
    expect(picked.resolved, 'the pick never resolved (the candidates stayed in the queue)').toBeTruthy();
    expect(picked.heroProxy, 'the chosen prelude must FLY into «РАЗЫГРАНО», never commit in one frame').toBeTruthy();
    await shoot(page, '04-after-pick');

    // ── ③ EVERYTHING THE FIRST ACTION SET OFF STAYS INSIDE THE WORKSPACE.
    //    The picked prelude may draw cards of its own; those cards must
    //    present in the start workspace's OWN zone — never as a standalone
    //    full-bleed «Получены карты» over a workspace that already let go.
    //    The record runs to the flow's END — no reveal and no start left
    //    (bounded; the claims are judged on whatever was recorded).
    await follow.waitFor((s) => !s.reveal && !s.start, {timeoutMs: 20_000}).catch(() => undefined);
    const followed = await follow.stop();
    await shoot(page, '05-follow-up-presentation');
    const sawStandaloneReveal = followed.some((s) => s.v.standalone);
    const startGoneWhileRevealing = followed.some((s) => s.v.presenting && !s.v.startPainted);
    const t0 = followed[0]?.t ?? 0;
    console.log(`[follow-up trace]\n${followed.map(({t, v}) =>
      `${t - t0} r:${v.reveal ? 1 : 0} sa:${v.standalone ? 1 : 0} pr:${v.presenting ? 1 : 0} s:${v.start ? 1 : 0} sp:${v.startPainted ? 1 : 0}`).join('\n')}`);
    expect(sawStandaloneReveal,
      'a draw caused by the first action must present INSIDE the workspace, not in a standalone modal').toBeFalsy();
    expect(startGoneWhileRevealing,
      'the start workspace may not let go while its own action is still presenting').toBeFalsy();
  });
});
