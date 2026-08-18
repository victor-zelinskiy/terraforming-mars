import {test, expect} from '@playwright/test';
import {bootWithCards, openActionFocus, openCardActions, playCardFromHand, soloGameConfig, waitForTurn} from './consoleStart';

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
 * must be the real card's box. A sampler that stops sampling would pass both
 * silently, so its own frame count is asserted first (and `requestAnimationFrame`
 * is deliberately not used — headless Chromium drives it off the compositor and
 * it goes quiet exactly during the beat under test).
 */

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'RevealLanding', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  seed: 0.03,
});

type Rect = {l: number, t: number, w: number, h: number} | null;
type Sample = {t: number, slot: Rect, proxy: Rect, card: Rect, vslot: Rect, verdict: number};

/** Sub-pixel tolerance: a rect is "the same box" inside one CSS pixel. */
const EPS = 1;

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: '', backstop: true},
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
      await page.waitForTimeout(4000);
      expect(await playCardFromHand(page, 'Search For Life'), 'Search For Life must have been played').toBe(true);
      await openCardActions(page);
      await openActionFocus(page);
      await expect(page.locator('.con-composer')).toHaveCount(1);
      await page.waitForTimeout(800);

      // ── The sampler: `setInterval` + `MutationObserver`, never rAF. ──────
      await page.evaluate(() => {
        const t0 = performance.now();
        const rect = (sel: string) => {
          const el = document.querySelector(sel);
          if (el === null) {
            return null;
          }
          const r = el.getBoundingClientRect();
          return {l: +r.left.toFixed(2), t: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2)};
        };
        const samples: unknown[] = [];
        const scan = () => {
          if (samples.length > 4000) {
            return;
          }
          samples.push({
            t: +(performance.now() - t0).toFixed(1),
            slot: rect('.con-composer__revealslot'),
            proxy: rect('.con-deal-proxy'),
            card: rect('.con-composer__revealslot :is(.pcard, .card-container)'),
            vslot: rect('.con-composer__verdictslot'),
            verdict: document.querySelectorAll('.con-verdict').length,
          });
        };
        const timer = window.setInterval(scan, 16);
        const mo = new MutationObserver(scan);
        mo.observe(document.body, {childList: true, subtree: true, attributes: true, characterData: true});
        (window as unknown as {__revLanding: unknown}).__revLanding = {
          samples,
          stop: () => {
            window.clearInterval(timer);
            mo.disconnect();
          },
        };
      });

      await page.keyboard.press('Enter'); // CTA confirm → the deck pull
      // A screenshot forces a BeginFrame: headless starves the app's OWN rAF on
      // a quiet screen, and a starved GSAP tween FREEZES rather than finishing —
      // indistinguishable from "settled" to any sampler.
      for (let i = 0; i < 42; i++) {
        await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
        await page.waitForTimeout(40);
      }
      await expect(page.locator('.con-composer--stage .con-verdict')).toHaveCount(1, {timeout: 15_000});
      await page.waitForTimeout(500);

      const samples = await page.evaluate(() => {
        const p = (window as unknown as {__revLanding: {samples: unknown[], stop: () => void}}).__revLanding;
        p.stop();
        return p.samples as unknown[];
      }) as Array<Sample>;

      const P = `[${profile.tag}]`;
      // A dead probe passes every geometric claim below — assert it lived.
      expect(samples.length, 'the sampler must have run').toBeGreaterThan(200);
      const withSlot = samples.filter((s) => s.slot !== null);
      expect(withSlot.length, 'the reveal slot must have been sampled').toBeGreaterThan(50);

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
        await page.waitForTimeout(23_000);
        await expect(page.locator('.con-composer--stage .con-verdict'),
          'the verdict stage must survive a long read').toHaveCount(1);
        expect(await page.locator('.con-reveal').count(),
          'the claim backstop must not summon the standalone reveal modal').toBe(0);
      }
    });
  });
}
