import {test, expect, Page} from './consoleTest';
import {
  bootWithCards, cinematicBeat, composerLoaded, openActionFocus, openCardActions, playCardFromHand, settle, soloGameConfig,
  waitForTurn,
} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';

/**
 * Console DECK CHECK · THE ARRIVAL IS ONE PHYSICAL OBJECT.
 *
 * «Поиск жизни» pulls the top card off the HUD deck, flies it into the reveal
 * slot and turns it over there. The beat is premium exactly for as long as it
 * ends the way a real object does — at rest, on the spot it was travelling to.
 * It used to end with a JUMP, and this spec measures the two independent
 * reasons it did (both reproduced 2026-08-19, both fixed):
 *
 *  1. THE ROW RE-CENTRED UNDER THE LANDED CARD. The verdict panel's berth was
 *     a `min-width`/`max-width` RANGE, and the breakdown is wider than the
 *     floor — so «Вскрываем карту» → the verdict GREW the berth (380 → 432px
 *     at 1080, 880 → 1001px at 4K) and the centred row slid the revealed card
 *     26px / 61px to the left, out from under a proxy that had already landed.
 *  2. THE FLIGHT WAS AIMED THROUGH THE SLOT'S OWN ENTRANCE. The reveal slot is
 *     one of the outcome cascade's items (`descendCascade`, `y: descendPx(9)`),
 *     so the launch measurement answered a box 9px (18px at 4K) below the
 *     resting one and the whole flight — travel, flip, handoff — went there.
 *
 * The claims are therefore GEOMETRIC, not «did it animate»: the landing rect
 * may not move while the card is in the air, and the proxy's last painted box
 * must be the real card's box. The boxes are RECORDED off the product's own
 * writes (`armWitness` — every DOM change in the task that makes it, plus a
 * frame tick for what only a transform moves; `settled`, because «the proxy's
 * box IS the card's box» compares two elements of ONE painted state). A dead
 * recorder would pass both silently, so its liveness is asserted first.
 */

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'RevealLanding', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  seed: 0.03,
});

type Rect = {l: number, t: number, w: number, h: number} | null;
type Landing = {slot: Rect, proxy: Rect, card: Rect, vslot: Rect, verdict: number};
type Sample = Landing & {t: number};

/** Sub-pixel tolerance: a rect is "the same box" inside one CSS pixel. */
const EPS = 1;

/** The landing's boxes as the page holds them NOW — in the page, self-contained (the witness's reader). */
function readLanding(): Landing {
  const rect = (sel: string) => {
    const el = document.querySelector(sel);
    if (el === null) {
      return null;
    }
    const r = el.getBoundingClientRect();
    return {l: +r.left.toFixed(2), t: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2)};
  };
  return {
    slot: rect('.con-composer__revealslot'),
    proxy: rect('.con-deal-proxy'),
    card: rect('.con-composer__revealslot :is(.pcard, .card-container)'),
    vslot: rect('.con-composer__verdictslot'),
    verdict: document.querySelectorAll('.con-verdict').length,
  };
}

/** The verdict stage's berth and slot, rounded — the layout the claims compare, read AT REST. */
async function readBerth(page: Page) {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r === undefined ? null : [Math.round(r.left * 10) / 10, Math.round(r.top * 10) / 10, Math.round(r.width * 10) / 10];
    };
    return {slot: box('.con-composer__revealslot'), vslot: box('.con-composer__verdictslot'),
      card: box('.con-composer__revealslot :is(.pcard, .card-container)'), proxy: document.querySelector('.con-deal-proxy') !== null};
  });
}

const PROFILES = [
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv', backstop: false},
] as const;

for (const profile of PROFILES) {
  test.describe(`console reveal landing · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('the deck-check card lands where it rests', async ({page, request}) => {
      test.setTimeout(480_000);

      // The pregame is SETUP, never the subject — a start-flow change is
      // adapted in `consoleStart`, never here.
      await bootWithCards(page, request, {
        cards: ['Search For Life'],
        config: GAME_CONFIG,
        query: profile.query,
      });
      await waitForTurn(page);
      await settle(page);
      expect(await playCardFromHand(page, 'Search For Life'), 'Search For Life must have been played').toBe(true);
      await openCardActions(page);
      await openActionFocus(page);
      await expect(page.locator('.con-composer')).toHaveCount(1);
      // The action focus LOADED and at rest — the confirm below lands on a still, ready stage.
      await composerLoaded(page);
      await settle(page);

      // ── The recorder: the product's own writes + a frame tick, armed BEFORE the press. ──────
      const landing = await armWitness<Landing>(page, 'reveal-landing', readLanding, {settled: true, max: 20_000});

      await page.keyboard.press('Enter'); // CTA confirm → the deck pull
      // A screenshot forces a BeginFrame: headless starves the app's OWN rAF on
      // a quiet screen, and a starved GSAP tween FREEZES rather than finishing —
      // indistinguishable from "settled" to any recorder. The frames are pumped
      // until the beat's own end — the verdict standing — never for a fixed count.
      const verdict = page.locator('.con-composer--stage .con-verdict');
      for (let i = 0; i < 400 && await verdict.count() === 0; i++) {
        await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
      }
      await expect(verdict).toHaveCount(1, {timeout: 15_000});
      // The record runs until the stage is AT REST — the proxy handed over and the berth holding still (two equal reads
      // a frame apart; `settle: false` — the verdict stands inside the action's flow).
      const rest = await readSettled(page, () => readBerth(page), {settle: false, message: 'the verdict stage at rest'});

      const samples: Array<Sample> = (await landing.stop()).map((s) => ({...s.v, t: s.t}));

      const P = `[${profile.tag}]`;
      console.log(`${P} at rest: ${JSON.stringify(rest)} · ${samples.length} recorded states`);
      // A dead recorder passes every geometric claim below — assert it lived (it records DISTINCT states, never
      // frames: any recorded state is life).
      expect(samples.length, 'the sampler must have run').toBeGreaterThan(0);
      const withSlot = samples.filter((s) => s.slot !== null);
      expect(withSlot.length, 'the reveal slot must have been sampled').toBeGreaterThan(0);

      // ── 1. THE LANDING RECT MAY NOT MOVE SIDEWAYS. The verdict berth is a
      //       fixed width, so the status → breakdown swap changes nothing the
      //       flight was aimed at. (Vertically the slot still plays its own
      //       cascade entrance — that is the surface arriving, and the flight
      //       deliberately aims past it at the RESTING box.)
      const lefts = withSlot.map((s) => (s.slot as {l: number}).l);
      const spanX = Math.max(...lefts) - Math.min(...lefts);
      const vw = samples.filter((s) => s.vslot !== null).map((s) => (s.vslot as {w: number}).w);
      const vSpan = Math.max(...vw) - Math.min(...vw);
      console.log(`${P} slot spanX=${spanX.toFixed(2)}px · verdict berth span=${vSpan.toFixed(2)}px`);
      expect(vSpan, 'the verdict berth must be a FIXED width, never a min/max range').toBeLessThan(EPS);
      expect(spanX, 'the revealed card must not slide when the verdict lands').toBeLessThan(EPS);

      // ── 2. THE HANDOFF IS A ZERO-DISTANCE CROSS-OVER: the proxy's last
      //       painted box IS the real card's box.
      const last = [...samples].reverse().find((s) => s.proxy !== null && s.card !== null);
      expect(last, 'the flight proxy and the real card must have overlapped').toBeDefined();
      const proxy = (last as Sample).proxy as {l: number, t: number, w: number};
      const card = (last as Sample).card as {l: number, t: number, w: number};
      console.log(`${P} handoff Δ=${(proxy.l - card.l).toFixed(2)},${(proxy.t - card.t).toFixed(2)} Δw=${(proxy.w - card.w).toFixed(2)}`);
      expect(Math.abs(proxy.l - card.l), 'the proxy must vanish exactly on the real card (x)').toBeLessThan(EPS);
      expect(Math.abs(proxy.t - card.t), 'the proxy must vanish exactly on the real card (y)').toBeLessThan(EPS);
      expect(Math.abs(proxy.w - card.w), 'the proxy must vanish at the real card size').toBeLessThan(EPS);

      if (profile.backstop) {
        // ── 3. READING THE VERDICT IS NOT A RACE. The outcome CLAIM carries a
        //    20 s backstop for «claimed, and nothing ever came»; the deck check
        //    never marked itself PRESENTING, so the timer stayed armed while the
        //    verdict was on screen — at 20 s the claim dropped, the workspace
        //    concluded on its own and the LEGACY full-bleed modal rose carrying
        //    the very verdict the player was reading.
        await cinematicBeat(page, 23_000, 'a long read PAST the claim\'s 20 s backstop — the duration IS the claim');
        await expect(page.locator('.con-composer--stage .con-verdict'),
          'the verdict stage must survive a long read').toHaveCount(1);
        await expect.poll(() => page.locator('.con-reveal').count(), {message: 'the claim backstop must not summon the standalone reveal modal'}).toBe(0);
      }
    });
  });
}
