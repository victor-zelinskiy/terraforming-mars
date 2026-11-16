import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, openActionFocus, openCardActions, playCardFromHand, press, settle, soloGameConfig, waitForTurn} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';

/**
 * Console ACTION FLOW · the browse ⇄ ACTION FOCUS recompose.
 *
 * Drives a real solo game to the Action Browser and proves the new flow at
 * its real surface:
 *  1. BROWSE — the inspector anchors on the source-card THUMBNAIL (a physical
 *     zoom slot), the old right-panel schema duplicate is gone;
 *  2. A — the SAME frame recomposes into the ACTION FOCUS stage (no floating
 *     modal: the stage lives inside the frame's stage wrap, the browse layer
 *     parks in place, the header turns into the operation breadcrumb);
 *  3. B — the reverse movement restores the browse layer with its filters,
 *     selection and header intact;
 *  4. X in focus — the fullscreen dossier opens over the PRESERVED stage and
 *     closing it returns to the exact same focus state.
 *
 * The commit half (confirm → awaiting hold → reveal FLIP) is guarded by
 * console-surface-motion.spec.ts — this spec deliberately stops before the
 * commit and walks BACK instead (the reversible half of the flow).
 */

const OUT_DIR = path.resolve('screenshots', 'console-action-focus');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'FocusTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.11,
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await press(page, code, settleMs);
}

const PROFILES = [
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  // The ACTION WORKSPACE must hold its vertical capacity on the Deck too —
  // the rail-adjacent geometry + the two-tier header are profile-sensitive.
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console action focus · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('browse thumbnail → A focus recompose → B restore', async ({page, request}) => {
      test.setTimeout(480_000);

      // ── The pregame: the shared start driver puts Search For Life (a clean
      //    single-variant action) in hand. The walk is SETUP, never the
      //    subject — this spec's claim is the browse ⇄ focus recompose, so a
      //    start-flow change is adapted in `consoleStart`, never here.
      await bootWithCards(page, request, {
        cards: ['Search For Life'],
        config: GAME_CONFIG,
        query: profile.query,
        step: 0.013, // the deal-search stride this spec's seed line was tuned on
      });
      await waitForTurn(page);
      // The start's release and the turn's arrival are over — the board at rest before the hand is driven.
      await settle(page, {timeoutMs: 30_000});

      // ── Play Search For Life (RT wheel → center = КАРТЫ). ───────────────
      expect(await playCardFromHand(page, 'Search For Life'),
        'Search For Life must have been played').toBe(true);

      // ── 1. BROWSE: the inspector thumbnail is the physical anchor. ──────
      await openCardActions(page);
      const thumb = page.locator('.con-cardactions__detail-cardwrap[data-zoom-slot="Search For Life"]');
      await expect(thumb).toHaveCount(1);
      // The action SCHEMA reads on the focused tile only — the inspector
      // carries the card and the structured chips, never a second graphic.
      await expect.poll(() => page.locator('.con-cardactions__detail .con-cardactions__graphic').count(), {message: 'the right-panel schema duplicate must be gone'}).toBe(0);
      await expect.poll(() => page.locator('.con-composer--stage').count(), {message: 'no stage in browse'}).toBe(0);
      await shoot(page, `${profile.tag}-01-browse-thumbnail`);

      // ── 2. A: the SAME frame recomposes into ACTION FOCUS. ──────────────
      await openActionFocus(page);
      // No second frame chrome, no private backdrop — the browser's frame IS
      // the stage's chrome (never a web-modal feeling): the stage stands inside
      // the frame's stage wrap (`openActionFocus`) and draws no header of its own.
      await expect(page.locator('.con-composer--stage .con-wshead')).toHaveCount(0);
      await expect(page.locator('.con-cardactions__browse--parked')).toHaveCount(1);
      // The header is the operation breadcrumb now.
      await expect(page.locator('.con-wshead__step')).toHaveCount(1);
      await expect.poll(async () => (await page.locator('.con-wshead__subject').innerText()).toUpperCase()).toContain('ПОИСКИ ЖИЗНИ');
      // The hero card slot carries the FLIP/zoom contracts.
      await expect(page.locator('.con-composer--stage [data-action-focus-card][data-zoom-slot="Search For Life"]')).toHaveCount(1);
      // The CTA dock is pinned outside the scroll.
      await expect(page.locator('.con-composer__ctadock .con-composer__cta')).toHaveCount(1);
      // The couch chip weight must survive the runtime-injected scoped SFC
      // styles (the doubled-class chip-system rule): on the TV profile the
      // hero chips read at the accent size, never the 13px desktop fallback.
      // Read once the FLIP has settled (`readSettled`: the console at rest,
      // the same size twice a frame apart).
      const chipFs = await readSettled(page, () => page.evaluate(() => {
        const chip = document.querySelector('.con-composer--stage .action-effect-chip');
        return chip !== null ? parseFloat(getComputedStyle(chip).fontSize) : 0;
      }), {message: 'the hero chip\'s font size'});
      expect(chipFs, 'the effect chips must ride the console chip tokens').toBeGreaterThan(15);
      await shoot(page, `${profile.tag}-02-action-focus`);

      // ── 3. B: the reverse movement restores browse exactly. ─────────────
      await key(page, 'Escape', 900);
      await expect(page.locator('.con-composer--stage')).toHaveCount(0);
      await expect(page.locator('.con-cardactions__browse--parked')).toHaveCount(0);
      await expect(page.locator('.con-wshead__step')).toHaveCount(0);
      await expect(thumb).toHaveCount(1);
      await shoot(page, `${profile.tag}-03-back-to-browse`);

      // ── 4. X in focus: the dossier opens over the PRESERVED stage. ──────
      await openActionFocus(page);
      await key(page, 'KeyX', 1600);
      await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(1, {timeout: 8000});
      await shoot(page, `${profile.tag}-04-inspect-from-focus`);
      await key(page, 'Escape', 1200);
      await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(0);
      // The focus state survived the inspect roundtrip.
      await expect(page.locator('.con-cardactions__stagewrap .con-composer--stage')).toHaveCount(1);
      await shoot(page, `${profile.tag}-05-focus-after-inspect`);
      // Leave cleanly (B → browse, B → board).
      await key(page, 'Escape', 700);
      await expect(page.locator('.con-composer--stage')).toHaveCount(0);

      // ── 5. B → BOARD: the dismissal may not RESIZE what it dismisses. ───
      //    `beforeUnmount` fires SYNCHRONOUSLY on the press while the leave
      //    transition keeps the surface fully painted, so any teardown that
      //    writes to this surface's own DOM plays out on screen. Dropping the
      //    published `--act-fit` there popped every action formula from its
      //    fitted size to its natural one — the workspace left with enlarged
      //    icons. The probe samples the SAME nodes across the whole leave
      //    (a detached node measures 0, so only growth can fail this).
      //    The record is armed BEFORE the press, so the real key path (not a
      //    synthetic event) is what dismisses the workspace — RECORDED (FLAKE
      //    ZERO — `armWitness`: the product's own writes and every frame, across
      //    the WHOLE leave, never a frame clock that stops when the screen goes
      //    quiet). The nodes are fixed on the first read (kept on `window`, so
      //    every sample measures the same elements), and «never bigger on
      //    screen» is a claim about what a frame paints: `settled`.
      const dismiss = await armWitness(page, 'act-dismiss', () => {
        const w = window as unknown as {__actDismissNodes?: Array<HTMLElement>};
        w.__actDismissNodes ??= [...document.querySelectorAll<HTMLElement>('.con-cardactions__graphic')];
        const nodes = w.__actDismissNodes;
        return {
          widths: nodes.map((n) => Math.round(n.getBoundingClientRect().width * 100) / 100),
          fitted: nodes.filter((n) => n.style.getPropertyValue('--act-fit') !== '').length,
        };
      }, {settled: true});
      await key(page, 'Escape', 2000);
      // The leave is OVER (the workspace gone) before the record is read — its end state, never its first sign.
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 8000});
      const record = (await dismiss.stop()).map((s) => s.v);
      const first = record[0] ?? {widths: [], fitted: 0};
      const base = first.widths;
      const max = base.map((w, i) => Math.max(...record.map((r) => r.widths[i] ?? 0), w));
      // «Still fitted» is read on the LAST state the surface still painted (a node laid out at all — a detached one
      // measures 0): the mechanism's claim is about the leave, not about the nodes once they are gone.
      const lastPainted = record.filter((r) => r.widths.some((w) => w > 0)).at(-1) ?? first;
      const dismissal = {
        base, max,
        fitted: first.fitted,
        stillFitted: lastPainted.fitted,
        grew: base.map((w, i) => (w > 0 ? max[i] / w : 1)),
      };
      console.log(`[act-dismiss ${profile.tag}] formulas=${dismissal.base.length} fitted=${dismissal.fitted}` +
        ` stillFitted=${dismissal.stillFitted} maxGrowth=${Math.max(...dismissal.grew).toFixed(3)}`);
      expect(dismissal.base.length, 'the browse grid must have carried action formulas').toBeGreaterThan(0);
      // The published fits survive the press (the mechanism)…
      expect(dismissal.stillFitted, 'a teardown must not drop --act-fit while the surface still paints')
        .toBe(dismissal.fitted);
      // …and nothing on the way out is bigger than it was (what the player sees).
      expect(Math.max(...dismissal.grew), 'no formula may grow during the dismissal').toBeLessThan(1.02);
    });
  });
}
