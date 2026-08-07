import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, openActionFocus, openCardActions, openQuickWheel, playCardFromHand, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * Console surface-motion system · the Search For Life reveal chain + wheels.
 *
 * Drives a real solo game through the console-native shell:
 *  1. RT/LT quick wheels — open / dismiss / handoff (the shared `.con-shade`
 *     dim must stay CONTINUOUS across the wheel → Standard-Projects handoff,
 *     and the wheel must carry no private backdrop anymore);
 *  2. play Search For Life from hand, then run its blue-card action through
 *     the composer confirm → the committed AWAITING hold → the reveal result
 *     as ONE scene: the shade never blinks through the swap, the composer's
 *     source card FLIPs into the result's «Источник» slot (both carry the
 *     `data-motion-anchor="card:Search For Life"` contract), and OK after
 *     the semantic commit lands on the RESULT — never back on the confirm.
 *
 * The regression this guards: the composer used to unmount synchronously on
 * confirm (bare board for the whole round-trip), the reveal then faded in as
 * an unrelated modal — three backdrop blinks per action.
 */

const OUT_DIR = path.resolve('screenshots', 'console-surface-motion');

/**
 * Deterministic solo game config (the seed is varied by the driver's deal
 * search). `deltaProject` ON: the Hydronetwork workspace section drives the
 * section-exit regression probe (the planet must never rescale).
 */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'MotionTester', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  seed: 0.03,
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** Sample the shade's ON state every `stepMs` — the anti-blink probe. */
async function sampleShadeContinuity(page: Page, samples: number, stepMs: number): Promise<boolean[]> {
  const out: boolean[] = [];
  for (let i = 0; i < samples; i++) {
    out.push(await page.locator('.con-shade--on').count() > 0);
    await page.waitForTimeout(stepMs);
  }
  return out;
}

/** The target profiles: the 1080 logical console, the 4K TV recomposition
 *  (`consoleProfile=tv` — rem scale ×2, the same live-rect choreography) and
 *  the reduced-motion axis (same stage order / input / commits, short fades —
 *  every DOM assertion must hold identically). */
const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: '', reduced: false},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv', reduced: false},
  {tag: 'fhd-reduced', width: 1920, height: 1080, query: '', reduced: true},
] as const;

for (const profile of PROFILES) {
  test.describe(`console surface motion · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
      contextOptions: {reducedMotion: profile.reduced ? 'reduce' : 'no-preference'},
    });

    test('wheel handoff + composer → reveal as one scene', async ({page, request}) => {
      test.setTimeout(480_000);

      // ── The pregame: the shared start driver puts Search For Life in hand.
      //    The walk is SETUP, never the subject — this spec's claim is the
      //    surface-motion chain, so a start-flow change is adapted in
      //    `consoleStart`, never here. (It also picks a corporation without a
      //    mandatory first action and without alternative payment resources:
      //    both would put a different scenario between the boot and the
      //    subject — see `CORP_WITH_FIRST_ACTION`.)
      await bootWithCards(page, request, {
        cards: ['Search For Life'],
        config: GAME_CONFIG,
        query: profile.query,
      });
      await waitForTurn(page);
      await page.waitForTimeout(4000); // intake / delivery settle

      // ── 1. The RT wheel: open (no private backdrop, shared shade ON). ───
      // Verified entry (the driver retries) — a blind press is consumed on a
      // busy 4K frame, which is what made this fail on tv4k and pass on fhd.
      await openQuickWheel(page);
      expect(await page.locator('.con-quick__backdrop').count(), 'the wheel has no private backdrop').toBe(0);
      await expect(page.locator('.con-shade--on')).toHaveCount(1);
      await shoot(page, `${profile.tag}-01-rt-wheel-open`);
      // Dismiss (B): the wheel leaves through the director; the shade lets go.
      await key(page, 'Escape', 700);
      await expect(page.locator('.con-quick')).toHaveCount(0);
      await expect(page.locator('.con-shade--on')).toHaveCount(0);

      // ── 2. The LT wheel → Standard Projects handoff: the shade must stay
      // ON through the whole swap (the anti-blink probe samples it live). ──
      await key(page, 'Comma', 600);
      await expect(page.locator('.con-quick')).toHaveCount(1);
      await page.keyboard.press('Enter'); // center slot = Standard Projects
      const handoffShade = await sampleShadeContinuity(page, 8, 45);
      expect(handoffShade.every(Boolean), `shade blinked during wheel→stdp handoff: ${handoffShade}`).toBeTruthy();
      await expect(page.locator('.con-stdp')).toHaveCount(1);
      expect(await page.locator('.con-stdp__backdrop').count(), 'std-projects has no private backdrop').toBe(0);
      await shoot(page, `${profile.tag}-02-stdp-after-wheel-handoff`);
      await key(page, 'Escape', 700);
      await expect(page.locator('.con-stdp')).toHaveCount(0);

      // ── 2b. WORKSPACE section exit — the planet must NOT rescale. Open
      // the Hydronetwork (RT wheel → ← slot), close with B, and sample
      // --board-scale through the whole exit: the frozen leaver dissolves
      // OVER a full-size board, so the stored scale never wobbles (the
      // regression: the planet mounted half-width, then jumped to size
      // while the departing screen flashed squeezed on the right).
      const boardScale = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--board-scale'));
      const baseScale = await boardScale();
      expect(baseScale, 'the board scale must be set on the board home').not.toBe('');
      await key(page, 'Period', 600); // RT wheel
      await key(page, 'ArrowLeft', 1000); // ← slot = Hydronetwork
      await expect(page.locator('.con-hydro')).toHaveCount(1);
      await page.keyboard.press('Escape'); // B → close → board
      const scaleSamples: string[] = [];
      for (let i = 0; i < 10; i++) {
        scaleSamples.push(await boardScale());
        await page.waitForTimeout(45);
      }
      expect(scaleSamples.every((s2) => s2 === baseScale),
        `--board-scale wobbled through the section exit: [${scaleSamples.join(', ')}] vs ${baseScale}`).toBeTruthy();
      await expect(page.locator('.con-hydro')).toHaveCount(0);
      await shoot(page, `${profile.tag}-02b-board-after-hydro-exit`);

      // ── 3. Play Search For Life from hand (RT → center = КАРТЫ). ────────
      expect(await playCardFromHand(page, 'Search For Life'),
        'Search For Life must have been played').toBe(true);

      // ── 4. The blue-card action: RT → ↑ (card actions) → composer. ──────
      await openCardActions(page);
      expect(await page.locator('.con-cardactions__backdrop').count(), 'action center has no private backdrop').toBe(0);
      await openActionFocus(page); // open the composer for Search For Life
      await expect(page.locator('.con-composer')).toHaveCount(1);
      expect(await page.locator('.con-composer__backdrop').count(), 'action composer has no private backdrop').toBe(0);
      await expect(page.locator('.con-composer [data-motion-anchor="card:Search For Life"]')).toHaveCount(1);
      await expect(page.locator('.con-shade--on')).toHaveCount(1);
      await shoot(page, `${profile.tag}-03-action-composer-confirm`);

      // ── 5. Confirm → the IN-FRAME reveal phase: the ACTION FOCUS stage
      // STAYS («Действия карт › Результат вскрытия») — the deck flight +
      // flip present the outcome in the SAME frame, the standalone reveal
      // overlay never mounts for the claimed reveal, and the shade cannot
      // blink (the center owns it through the whole operation).
      await page.keyboard.press('Enter');
      const phaseShade = await sampleShadeContinuity(page, 10, 45);
      expect(phaseShade.every(Boolean), `shade blinked during confirm→reveal: ${phaseShade}`).toBeTruthy();
      await expect(page.locator('.con-composer--stage .con-composer__revealzone')).toHaveCount(1, {timeout: 10_000});
      expect(await page.locator('.con-reveal').count(), 'no standalone overlay for the claimed reveal').toBe(0);
      // The source-card anchor never left the stage (the hero column holds).
      await expect(page.locator('.con-composer--stage [data-motion-anchor="card:Search For Life"]')).toHaveCount(1);
      // The outcome settles (deck flight + the in-place flip). The longer
      // beat lets the status → verdict crossfade finish even on a heavy 4K
      // frame, so the screenshot always carries the verdict pill.
      await expect(page.locator('.con-composer__revealoutcome')).toHaveCount(1, {timeout: 10_000});
      await page.waitForTimeout(900);
      await shoot(page, `${profile.tag}-04-reveal-result`);

      // ── 6. OK returns to the REFRESHED browse grid (semantic commit:
      // never back to a re-confirmable state); B then closes the center and
      // the shade lets go once the band is empty. ─────────────────────────
      await key(page, 'Enter', 800);
      await expect(page.locator('.con-composer--stage')).toHaveCount(0);
      await expect(page.locator('.con-cardactions')).toHaveCount(1);
      await key(page, 'Escape', 800);
      await expect(page.locator('.con-cardactions')).toHaveCount(0);
      await page.waitForTimeout(600);
      await expect(page.locator('.con-shade--on')).toHaveCount(0);
      await shoot(page, `${profile.tag}-05-back-to-board`);
    });
  });
}
