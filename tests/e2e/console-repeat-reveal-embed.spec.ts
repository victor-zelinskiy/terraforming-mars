import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootWithCards, focusCard, openActionFocus, openCardActions, playCardFromHand, press,
  soloGameConfig, waitForTurn,
} from './consoleStart';

/**
 * A REPEATED ACTION'S VERDICT BELONGS TO THE WORKSPACE THE PRESS WAS MADE IN.
 *
 * «Проверка проекта» is played FROM THE HAND and copies an action already used
 * this generation. When the copied action is a deck check (Search For Life),
 * the server answers with a `lastReveal` — and that verdict used to open as the
 * LEGACY full-bleed modal over the very workspace that had just produced it:
 * the player pressed «Разыграть» inside «КАРТЫ В РУКЕ» and the result of that
 * press appeared somewhere else, in the shape the embedded flow exists to
 * retire.
 *
 * Two things had to be true for the North-Star answer:
 *  · the CLAIM must cover it — a play claims `scope: 'chain'`, and the server
 *    attributes the verdict to the card whose action RAN («Поиски жизни»),
 *    never to the card the player pressed;
 *  · the SAME shell-mounted `ConsoleRevealOverlay` must re-home into the hand
 *    workspace's outcome zone (one instance, one command contract, one input
 *    path) instead of standing as a band.
 *
 * …and the verdict is TERMINAL: «ОК» ends the flow, B is not on offer (it would
 * park a workspace whose artifact is server state and would come straight back
 * as that same modal — see `consoleWorkspaceFlow` 'verdict').
 *
 * SETUP, never the subject: the two cards are GUARANTEED onto the top of the
 * project deck (`customProjectCards`) instead of being fished out of a seed
 * scan — two named cards in one deal is a ~1-in-130 shot per attempt, which is
 * a flake budget, not a test.
 */

const OUT_DIR = path.resolve('screenshots', 'console-repeat-reveal-embed');

/**
 * ⚠️ The corporation is NAMED, and it is one with NO ACTION of its own.
 * `promo: true` puts Astrodrill in the corp pool, the default «calm corp» pick
 * took it, and the ДЕЙСТВИЯ КАРТ grid then held TWO action cards — so
 * `openActionFocus` opened whichever the cursor happened to sit on and the
 * spec failed on the verdict of an action it never meant to use. (The walk
 * below is the second half of the same fix: the tile is chosen by SOURCE, never
 * by position.)
 */
const GAME_CONFIG = soloGameConfig({
  players: [{name: 'InspectTester', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {promo: true},
  customCorporationsList: ['Teractor'],
  customProjectCards: ['Search For Life', 'Project Inspection'],
  seed: 0.07,
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** The action-grid inspector names the FOCUSED tile's source card (English). */
async function focusedSource(page: Page): Promise<string> {
  return page.locator('.con-cardactions .con-cardactions__detail-cardwrap').first()
    .getAttribute('data-zoom-slot').then((v) => v ?? '').catch(() => '');
}

/** Walk the action grid to the tile of `card` — never «press A where we are». */
async function walkToSource(page: Page, card: string, steps = 12): Promise<boolean> {
  for (let i = 0; i < steps; i++) {
    if (await focusedSource(page) === card) {
      return true;
    }
    await press(page, 'ArrowDown', 350);
  }
  return await focusedSource(page) === card;
}

/**
 * BOTH PROFILES. A geometry claim asserted at one resolution is a claim about
 * one resolution — the 4K recomposition is a different stage with a different
 * chrome budget, and this stage is a ROW of two cards plus a panel.
 */
const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080},
  {tag: 'tv4k', width: 3840, height: 2160},
] as const;

for (const profile of PROFILES) {
  test.describe(`console repeat-action reveal · ${profile.tag} · the verdict embeds`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('«Проверка проекта» hosts its «Результат вскрытия» inside the hand workspace', async ({page, request}) => {
      test.setTimeout(600_000);

      await bootWithCards(page, request, {
        cards: ['Search For Life', 'Project Inspection'],
        corporation: 'Teractor',
        config: GAME_CONFIG,
      });
      await waitForTurn(page);
      await page.waitForTimeout(2500);

      // ── SETUP 1: play Search For Life, so the tableau has a blue action. ──
      expect(await playCardFromHand(page, 'Search For Life'), 'Search For Life played').toBe(true);

      // ── SETUP 2: use that action once — «Проверка проекта» may only copy an
      //    action already used this generation. (This is also the DIRECT door,
      //    whose verdict the composer draws itself.) ─────────────────────────
      await openCardActions(page);
      expect(await walkToSource(page, 'Search For Life'), 'focus the Search For Life tile').toBe(true);
      await openActionFocus(page);
      await press(page, 'Enter', 4000); // confirm — one branch, 1 M€, no decisions
      await expect(page.locator('.con-composer--stage .con-verdict'))
        .toHaveCount(1, {timeout: 15_000});
      // The DIRECT door draws its own stage — the overlay is not re-homed there.
      expect(await page.locator('.con-reveal').count(),
        'the card-actions stage draws its own verdict').toBe(0);
      await press(page, 'Enter', 3500); // ОК — the activation is over
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 10_000});
      await page.waitForTimeout(1500);

      // ── THE SUBJECT: play «Проверка проекта» and copy that action. ────────
      await press(page, 'Period', 700); // RT → the quick wheel
      await press(page, 'Enter', 1600); // centre slot → the hand screen
      expect(await focusCard(page, 'Project Inspection', 16), 'focus Project Inspection').toBe(true);
      // …same retry-on-absence discipline (a press on a settling hand is
      // consumed; a second press on an OPEN composer would answer its row).
      const playComposer = page.locator('.con-composer--play');
      for (let i = 0; i < 4 && await playComposer.count() === 0; i++) {
        await press(page, 'Enter', 1200);
      }
      await expect(playComposer, 'A opens the play composer').toHaveCount(1, {timeout: 10_000});

      // A on the «Действие для повтора» row hands the choice to the ДЕЙСТВИЯ
      // КАРТ surface in REPEAT mode (a client pick bridge — the play composer
      // stays mounted, hidden, with every capture intact).
      //
      // Retried on the bridge's ABSENCE, never pressed blind: a press landing
      // while the composer is still settling is consumed BY DESIGN (at 4K that
      // is the common case), and a second press on an OPEN grid would activate
      // whatever tile the cursor sits on.
      const repeatGrid = page.locator('.con-cardactions');
      for (let i = 0; i < 4 && await repeatGrid.count() === 0; i++) {
        await press(page, 'Enter', 1600);
      }
      await expect(repeatGrid, 'A on the repeat row opens the ДЕЙСТВИЯ КАРТ bridge')
        .toHaveCount(1, {timeout: 10_000});
      expect(await walkToSource(page, 'Search For Life'), 'focus the copyable action').toBe(true);
      await openActionFocus(page);
      await press(page, 'Enter', 2500); // confirm the copied action's own setup
      // …and back in the play composer, with the row filled.
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 10_000});
      await shoot(page, `${profile.tag}-01-play-composer-repeat-filled`);
      await press(page, 'Enter', 1200); // РАЗЫГРАТЬ

      // ── THE VERDICT IS THE WORKSPACE'S OWN STAGE. ────────────────────────
      // It waits for the played-hero scene first («сначала карта сыграна, потом
      // результат действия»), then arrives INSIDE the hand's outcome zone.
      const embedded = page.locator('[data-embed-slot="hand-outcome"] .con-reveal--embedded');
      await expect(embedded, 'the verdict re-homes into the hand workspace')
        .toHaveCount(1, {timeout: 30_000});
      await expect(page.locator('[data-embed-slot="hand-outcome"] .con-verdict'))
        .toHaveCount(1, {timeout: 20_000});
      // …and it is the SAME instance, not a second copy standing in a band.
      expect(await page.locator('.con-reveal').count(), 'one reveal, one home').toBe(1);
      // The crumb only ever GAINS a tail: the workspace and the played card stay,
      // the stage segment is the verdict's own name (handed UP by the surface).
      await expect(page.locator('.con-wshead__step')).toHaveText(/ВСКРЫТ/i, {timeout: 10_000});
      await page.waitForTimeout(1200);
      await shoot(page, `${profile.tag}-02-embedded-verdict`);

      // THE STAGE FITS ITS ZONE. The row is two premium faces plus a panel, and
      // the zone — not the viewport — is the room: nothing may hang out of the
      // hand workspace's own frame. (Asking the VIEWPORT is what missed every
      // earlier overflow of this family: the viewport was never what clipped.)
      const fits = await page.evaluate(() => {
        const zone = document.querySelector('[data-embed-slot="hand-outcome"]');
        const body = document.querySelector('.con-reveal__body--result');
        if (zone === null || body === null) {
          return {ok: false, why: 'missing'};
        }
        const z = zone.getBoundingClientRect();
        const b = body.getBoundingClientRect();
        return {
          ok: b.left >= z.left - 1 && b.right <= z.right + 1 && b.top >= z.top - 1 && b.bottom <= z.bottom + 1,
          why: `body ${Math.round(b.left)},${Math.round(b.top)}–${Math.round(b.right)},${Math.round(b.bottom)} ` +
          `vs zone ${Math.round(z.left)},${Math.round(z.top)}–${Math.round(z.right)},${Math.round(z.bottom)}`,
        };
      });
      expect(fits.ok, `the verdict stage must fit its zone: ${fits.why}`).toBeTruthy();

      // …AND IT MUST SPEND IT. «Fits» and «uses» are different claims, and only
      // the first was ever asserted: the verdict is a row of NATURAL-size cards
      // centred in whatever band it is given, so it reads as a small cluster
      // adrift in an empty stage exactly when the stage is largest (4K).
      const spend = await page.evaluate(() => {
        const zone = document.querySelector('[data-embed-slot="hand-outcome"]');
        const cards = Array.from(document.querySelectorAll(
          '.con-reveal__body--result :is(.con-reveal__source, .con-reveal__revealed) .card-container, ' +
          '.con-reveal__body--result :is(.con-reveal__source, .con-reveal__revealed) .pcard'));
        const zh = zone?.getBoundingClientRect().height ?? 0;
        const tallest = Math.max(0, ...cards.map((c) => c.getBoundingClientRect().height));
        const z = zone?.getBoundingClientRect();
        // NOTHING MAY BE CLIPPED, and «the body fits» does not say that: the
        // body has `overflow: visible`, so its own rect stays inside the zone
        // while its children hang out of it — which is exactly how an
        // over-solved fit rendered both cards cut off at the bottom.
        const parts = Array.from(document.querySelectorAll(
          '.con-reveal__body--result > *'));
        const spill = z === undefined ? -1 : parts.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.height > 1 && (r.top < z.top - 1 || r.bottom > z.bottom + 1 ||
            r.left < z.left - 1 || r.right > z.right + 1);
        }).length;
        return {
          zh: Math.round(zh), tallest: Math.round(tallest), n: cards.length, spill,
          // The VERDICT PANEL is content, not decoration — an over-solved row
          // wrapped it onto a line with no height and it vanished entirely.
          verdictPanel: document.querySelectorAll(
            '.con-reveal__body--result .con-reveal__verdict-slot').length,
          // The band states its own solve — read it, never guess the input.
          fit: document.querySelector('.con-reveal__body--result')
            ?.getAttribute('data-verdict-fit') ?? '(no fit)',
        };
      });
      const pct = Math.round(100 * spend.tallest / Math.max(1, spend.zh));

      console.log(`[${profile.tag}] verdict card ${spend.tallest}px of ${spend.zh}px zone ` +
        `(${pct}%), cards=${spend.n}, ${spend.fit}`);
      expect(spend.n, 'the source and the revealed card are both on stage').toBe(2);
      expect(spend.spill, `nothing hangs out of the zone — ${spend.fit}`).toBe(0);
      expect(spend.verdictPanel, `the verdict panel is still on stage — ${spend.fit}`).toBe(1);
      // The band is a ROW of different things, so the cards cannot reach the
      // 70 % a pure card grid does — the connector and the verdict panel are
      // real content beside them. 60 % is the honest bar for this shape, and it
      // is well clear of the 51 % the authored constants produced with no fit
      // at all (measured identically at 1080 and at 4K, which is what proved
      // the band was never being read).
      expect(pct, `the verdict spends its band — ${spend.fit}`).toBeGreaterThan(60);

      // ── B IS DEAD on a terminal verdict (it would park the workspace and the
      //    server-side `lastReveal` would return as the legacy modal). ───────
      await press(page, 'Escape', 900);
      await expect(embedded, 'B must not minimize a verdict').toHaveCount(1);
      expect(await page.locator('.con-reveal').count(),
        'B must not summon the standalone modal').toBe(1);

      // ── «ОК» ENDS THE FLOW: the workspace leaves with its stage, and nothing
      //    is left behind for the standalone presenter to pick up. ───────────
      await press(page, 'Enter', 2500);
      await expect(page.locator('.con-reveal')).toHaveCount(0, {timeout: 15_000});
      await expect(page.locator('.con-hand')).toHaveCount(0, {timeout: 15_000});
      await shoot(page, `${profile.tag}-03-back-to-board`);
    });
  });
}
