import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, openActionFocus, openCardActions, openQuickWheel, playCardFromHand, press, settle, soloGameConfig, waitForTurn} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, Witness} from './witness';

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
 *     the semantic commit lands on the RESULT — never back on the confirm,
 *     and never back in the browse grid: acknowledging the verdict ENDS the
 *     operation, so the workspace leaves with it (THE CONCLUSION).
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
  await press(page, code, settleMs);
}

/**
 * THE ANTI-BLINK PROBE — the shade's ON state RECORDED from before the press (`armWitness`, FLAKE ZERO): every state the
 * product writes, in the task that writes it. `settled`: «the shade never blinks» is a claim about what a FRAME can
 * show, so each state is the one a task LEAVES — never the instant between one owner letting go and the next claiming
 * in the same flush. Armed BEFORE the press, asked once the destination stands.
 */
async function armShadeContinuity(page: Page, key: string): Promise<Witness<boolean>> {
  return armWitness<boolean>(page, key, () => document.querySelector('.con-shade--on') !== null, {settled: true});
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
      await settle(page); // intake / delivery settle

      // ── 1. The RT wheel: open (no private backdrop, shared shade ON). ───
      // Verified entry (the driver retries) — a blind press is consumed on a
      // busy 4K frame, which is what made this fail on tv4k and pass on fhd.
      await openQuickWheel(page);
      await expect(page.locator('.con-quick[data-motion-surface]'), 'the wheel rides the shared shade (no private backdrop)').toHaveCount(1);
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
      const handoffWatch = await armShadeContinuity(page, 'surface-motion-handoff-shade');
      await page.keyboard.press('Enter'); // center slot = Standard Projects
      await expect(page.locator('.con-stdp')).toHaveCount(1);
      await settle(page); // the wheel's leave and the screen's entry are over
      // The record covers the WHOLE swap — from the press to the screen at rest — never 8 polls of 45 ms.
      const handoffShade = await handoffWatch.values();
      await handoffWatch.stop();
      expect(handoffShade.every(Boolean), `shade blinked during wheel→stdp handoff: ${handoffShade}`).toBeTruthy();
      await expect(page.locator('.con-stdp[data-motion-surface]'), 'std-projects rides the shared shade (no private backdrop)').toHaveCount(1);
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
      // The reference is the board home's scale AT REST (`readSettled`) — a comparison is only as settled as its
      // least settled side.
      const baseScale = await readSettled(page, boardScale, {message: 'the board home\'s --board-scale'});
      expect(baseScale, 'the board scale must be set on the board home').not.toBe('');
      await key(page, 'Period', 600); // RT wheel
      await key(page, 'ArrowLeft', 1000); // ← slot = Hydronetwork
      await expect(page.locator('.con-hydro')).toHaveCount(1);
      // RECORD the stored scale through the WHOLE exit, from before the press (`armWitness`): every value the fit
      // engine writes, in the task that writes it — never 10 polls of 45 ms.
      const scaleWatch = await armWitness<string>(page, 'surface-motion-exit-scale',
        () => document.documentElement.style.getPropertyValue('--board-scale'));
      await page.keyboard.press('Escape'); // B → close → board
      await expect(page.locator('.con-hydro')).toHaveCount(0);
      await settle(page); // the exit is over and the board home at rest — a late re-fit is the very jump guarded here
      const scaleSamples = await scaleWatch.values();
      await scaleWatch.stop();
      expect(scaleSamples.every((s2) => s2 === baseScale),
        `--board-scale wobbled through the section exit: [${scaleSamples.join(', ')}] vs ${baseScale}`).toBeTruthy();
      await shoot(page, `${profile.tag}-02b-board-after-hydro-exit`);

      // ── 3. Play Search For Life from hand (RT → center = КАРТЫ). ────────
      expect(await playCardFromHand(page, 'Search For Life'),
        'Search For Life must have been played').toBe(true);

      // ── 4. The blue-card action: RT → ↑ (card actions) → composer. ──────
      await openCardActions(page);
      await expect(page.locator('.con-cardactions[data-motion-surface]'), 'the action center rides the shared shade (no private backdrop)').toHaveCount(1);
      await openActionFocus(page); // open the composer for Search For Life
      await expect(page.locator('.con-composer')).toHaveCount(1);
      await expect(page.locator('.con-composer[data-motion-surface]'), 'the action composer rides the shared shade (no private backdrop)').toHaveCount(1);
      await expect(page.locator('.con-composer [data-motion-anchor="card:Search For Life"]')).toHaveCount(1);
      await expect(page.locator('.con-shade--on')).toHaveCount(1);
      await shoot(page, `${profile.tag}-03-action-composer-confirm`);

      // ── 5. Confirm → the IN-FRAME reveal phase: the ACTION FOCUS stage
      // STAYS («Действия карт › Результат вскрытия») — the deck flight +
      // flip present the outcome in the SAME frame, the standalone reveal
      // overlay never mounts for the claimed reveal, and the shade cannot
      // blink (the center owns it through the whole operation).
      const phaseWatch = await armShadeContinuity(page, 'surface-motion-phase-shade');
      await page.keyboard.press('Enter');
      await expect(page.locator('.con-composer--stage .con-composer__revealzone')).toHaveCount(1, {timeout: 10_000});
      await expect.poll(() => page.locator('.con-reveal').count(), {message: 'no standalone overlay for the claimed reveal'}).toBe(0);
      // The source-card anchor never left the stage (the hero column holds).
      await expect(page.locator('.con-composer--stage [data-motion-anchor="card:Search For Life"]')).toHaveCount(1);
      // The outcome settles (deck flight + the in-place flip). The longer
      // beat lets the status → verdict crossfade finish even on a heavy 4K
      // frame, so the screenshot always carries the verdict panel.
      await expect(page.locator('.con-composer--stage .con-verdict')).toHaveCount(1, {timeout: 10_000});
      // The shade record covers the whole confirm → reveal phase, from the press to the verdict standing.
      const phaseShade = await phaseWatch.values();
      await phaseWatch.stop();
      expect(phaseShade.every(Boolean), `shade blinked during confirm→reveal: ${phaseShade}`).toBeTruthy();
      // The EMBEDDED stage carries the WHOLE reading, not a four-word pill: the
      // reward row is stated either way («не получена» on a miss), which is what
      // the legacy modal used to be the only surface to say.
      await expect(page.locator('.con-composer--stage .con-verdict__row')).not.toHaveCount(0);
      await settle(page); // the status → verdict crossfade is over before the frame
      await shoot(page, `${profile.tag}-04-reveal-result`);

      // ── 5b. REGRESSION — B ON THE VERDICT DOES NOTHING. «Свернуть» used to
      // park the workspace here; `lastReveal` is server state until the next
      // input, so the LEGACY full-bleed modal then rose over the board carrying
      // the very verdict the player had just minimized — the same information
      // twice, the second time in the shape the embedded flow exists to retire.
      // A verdict keeps no decision alive, so it is a TERMINAL phase: no
      // collapse, no B, «ОК» is the way out (consoleWorkspaceFlow 'verdict').
      await key(page, 'Escape', 500);
      await expect(page.locator('.con-composer--stage .con-verdict')).toHaveCount(1);
      await expect.poll(() => page.locator('.con-reveal').count(), {message: 'B on the verdict must not summon the standalone reveal modal'}).toBe(0);

      // ── 6. OK ENDS THE OPERATION — one press, and the player is on the
      // board. THE CONCLUSION (`workspaceConclusionFor`): past the commit
      // boundary the workspace is not a place to come back to, it is the thing
      // that is over. This used to fold to the ДЕЙСТВИЯ КАРТ browse grid and
      // demand a second press (B) to leave — a screen whose only content was
      // the action just performed, greyed «Активирована». The stage departs
      // WITH the workspace in one motion (never a fold-then-close), and the
      // shade lets go once the band is empty. ─────────────────────────────
      await key(page, 'Enter', 800);
      await expect(page.locator('.con-composer--stage')).toHaveCount(0);
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 8000});
      // The shade letting go is a STATE — the assertion polls it (no fixed beat before it).
      await expect(page.locator('.con-shade--on')).toHaveCount(0);
      // …and the ack leaves NOTHING behind: the claim is released and the key
      // marked seen in the same press, so the standalone overlay has no verdict
      // to pick up as the workspace departs.
      await expect(page.locator('.con-reveal')).toHaveCount(0);
      await shoot(page, `${profile.tag}-05-back-to-board`);
    });
  });
}
