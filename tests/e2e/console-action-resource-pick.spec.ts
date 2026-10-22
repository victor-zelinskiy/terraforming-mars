import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, openCardActions, press, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * Console CARD ACTION · «получите любой стандартный ресурс» is an EMBEDDED
 * PRE-SELECT STEP, not a follow-up.
 *
 * Astrodrill's third branch answers with a nested `OrOptions` (which of the six
 * standard resources), and for the whole life of the console composer the
 * preview declared nothing about it: the batch ended at the branch pick, the
 * server was left holding a live prompt, and it surfaced as a bare STANDALONE
 * band right after the player had already confirmed — the one screen the
 * workspace contract promises they will never see.
 *
 * This spec drives the real surface and proves the three halves of the fix:
 *
 *  1. the resource pick is a REQUIRED ROW inside the workspace (the commit is
 *     refused until it is answered) and its options render as the PALETTE of
 *     the variant grammar (TR54, «ПАЛИТРА СТАНДАРТНОГО РЕСУРСА») — six equal
 *     tiles in ONE row, each led by its resource's own sprite (louder than the
 *     reading chip by a step) and its number, the player's own
 *     `current → resulting` via the shared `ActionEffectChip` under it, the
 *     printed «?» on the kicker, ←→ along the row — never six sentences;
 *  2. confirming produces NO standalone task band — the whole action is one
 *     submit;
 *  3. the chosen resource actually LANDS: the rail counter moves by exactly
 *     the amount the chip promised.
 *
 * The pick is driven by DOM state, never by a fixed key count: which tile /
 * branch index Astrodrill's rows land on is layout, and this spec's claim is
 * about the step, not about the geometry around it.
 */

const OUT_DIR = path.resolve('screenshots', 'console-action-resource-pick');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'AstroTester', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {promo: true},
  seed: 0.31,
  // `customCorporationsList` puts the named corporation ON TOP of the deck (it
  // is `Deck.shuffle(cardsOnTop)`, never a filter) — with testMode's eight-corp
  // deal that is enough to guarantee Astrodrill is among what is offered.
  customCorporationsList: ['AstroDrill'],
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** The six-option sub-list of the resource step, once it is open. */
function optionRows(page: Page) {
  return page.locator('.con-composer__sublist .con-vchoice__opt');
}

/**
 * Descend into the action whose composer offers the resource step.
 *
 * Astrodrill draws TWO printed action rows and the branch that owns the step is
 * inside one of them; which tile that is depends on the resource state, so the
 * walk asks the DOM instead of counting presses. Returns false when no tile
 * offered it (a real failure — the caller asserts).
 */
async function descendToResourceBranch(page: Page): Promise<boolean> {
  const stage = page.locator('.con-cardactions__stagewrap .con-composer--stage');
  const tiles = page.locator('.con-cardactions__tile');
  const tileCount = await tiles.count();
  for (let tile = 0; tile < Math.max(1, tileCount); tile++) {
    // Walk the browse cursor to this tile, then descend.
    for (let i = 0; i < tile; i++) {
      await press(page, 'ArrowDown', 350);
    }
    for (let i = 0; i < 4 && await stage.count() === 0; i++) {
      await press(page, 'Enter', 1000);
    }
    if (await stage.count() === 0) {
      continue;
    }
    // Inside the composer: select each branch in turn and look for the step.
    const branches = page.locator('.con-composer__branches .con-vchoice__opt');
    const branchCount = await branches.count();
    for (let b = 0; b < Math.max(1, branchCount); b++) {
      if (branchCount > 1) {
        // Focus is flat: branch tiles first. ↑ re-enters the group (on the tile the cursor left), then the walk aims
        // at THIS branch's own tile by its hook: → across a side-by-side group (`data-variant-axis="row"`, wrapping),
        // ↓ down a stacked one — never a counted press from a guessed corner.
        const target = await branches.nth(b).getAttribute('data-branch-pos');
        const focusedPos = () => page.evaluate(() => document.querySelector('.con-composer__branches .con-vchoice__opt--focused')?.getAttribute('data-branch-pos') ?? '');
        for (let i = 0; i < 3 && (await focusedPos()) === ''; i++) {
          await press(page, 'ArrowUp', 200);
        }
        const row = await page.evaluate(() => document.querySelector('.con-composer__branches')?.getAttribute('data-variant-axis') === 'row');
        for (let i = 0; i < branchCount + 1 && (await focusedPos()) !== target; i++) {
          await press(page, row ? 'ArrowRight' : 'ArrowDown', 300);
        }
        expect(await focusedPos(), `the cursor stands on branch ${target}`).toBe(target);
        await press(page, 'Enter', 700); // A SELECTS the branch
      }
      // A required, unanswered row is the step's own signature.
      const missing = page.locator('.con-composer__row--missing');
      if (await missing.count() === 0) {
        continue;
      }
      // Walk down onto it and open it. Another branch's own step (the card target of «add an asteroid» — the
      // embedded played-target step) is not this one: stop at it, never walk past it into a commit, back out.
      const step = page.locator('.con-ptsel');
      for (let i = 0; i < 6 && await optionRows(page).count() === 0 && await step.count() === 0; i++) {
        await press(page, 'ArrowDown', 300);
        await press(page, 'Enter', 700);
      }
      if (await optionRows(page).count() >= 6) {
        return true;
      }
      for (let i = 0; i < 3 && await step.count() > 0; i++) {
        await press(page, 'Escape', 600);
      }
    }
    // Not this tile — walk back out to browse and try the next one.
    for (let i = 0; i < 3 && await stage.count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
    if (await page.locator('.con-cardactions').count() === 0) {
      await openCardActions(page);
    }
  }
  return false;
}

const PROFILES = [
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console action resource pick · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('the resource choice is an embedded step with premium chips, and one submit ends it', async ({page, request}) => {
      test.setTimeout(480_000);

      // Astrodrill is the CORPORATION, so the pregame takes it directly — the
      // walk is SETUP, never this spec's subject.
      await bootIntoGame(page, request, {
        config: GAME_CONFIG,
        corporation: 'AstroDrill',
        query: profile.query,
      });
      await waitForTurn(page);
      await page.waitForTimeout(2500);

      await openCardActions(page);
      expect(await descendToResourceBranch(page),
        'the «gain a standard resource» branch must offer its pick INSIDE the workspace').toBe(true);
      await shoot(page, `${profile.tag}-1-resource-step`);

      // ── 1. PREMIUM LANGUAGE: every option carries the shared effect chip
      //       (icon + current → resulting), never a bare word. ─────────────
      const rows = optionRows(page);
      expect(await rows.count(), 'six standard resources').toBe(6);
      const withChips = await page.locator('.con-composer__sublist .con-vchoice__opt .action-effect-chip').count();
      expect(withChips, 'every option renders its own ActionEffectChip').toBeGreaterThanOrEqual(6);
      const chipText = await page.locator('.con-composer__sublist .con-vchoice__opt').first().innerText();
      expect(chipText, `the first option must state a before→after: «${chipText}»`).toMatch(/\d+\s*→\s*\d+/);
      // Every tile leads with a real resource sprite (the hero), not a text fallback.
      expect(await page.locator('.con-composer__sublist .con-vchoice__opt .con-vchoice__heroicon.resource_icon').count())
        .toBeGreaterThanOrEqual(6);

      // ── THE PALETTE (TR54): one row of six equal tiles, the hero louder than the chip, the «?» on the kicker, no
      //    medallion, ←→ along the row. ──
      await expect(page.locator('.con-composer__sublist.con-vchoice--palette'), 'the pick is the palette').toHaveCount(1);
      const geometry = await page.evaluate(() => {
        const group = document.querySelector('.con-composer__sublist')!;
        const tiles = Array.from(group.querySelectorAll<HTMLElement>('.con-vchoice__opt'));
        return {
          axis: group.getAttribute('data-variant-axis'),
          tops: [...new Set(tiles.map((t) => t.offsetTop))],
          widths: tiles.map((t) => Math.round(t.getBoundingClientRect().width)),
          hero: Math.min(...tiles.map((t) => t.querySelector('.con-vchoice__heroicon')?.getBoundingClientRect().width ?? 0)),
          chip: group.querySelector('.action-effect-chip')?.getBoundingClientRect().height ?? 0,
          figures: tiles.map((t) => t.querySelector('[data-vchoice-figure]')?.textContent?.trim() ?? ''),
          emblem: group.querySelector('[data-vchoice-emblem="wild"]') !== null,
          medals: group.querySelectorAll('.con-vchoice__or').length,
        };
      });
      expect(geometry.axis, 'the palette walks as a row').toBe('row');
      expect(geometry.tops, `ONE row: ${JSON.stringify(geometry.tops)}`).toHaveLength(1);
      expect(Math.max(...geometry.widths) - Math.min(...geometry.widths), `equal tiles: ${geometry.widths}`).toBeLessThanOrEqual(2);
      expect(geometry.hero, `the hero (${geometry.hero}) is louder than the reading chip (${geometry.chip}) by a step`).toBeGreaterThanOrEqual(geometry.chip * 1.25);
      expect(geometry.figures, 'every tile states its number').toEqual(['+1', '+1', '+1', '+1', '+1', '+1']);
      expect(geometry.emblem, 'the printed «?» on the kicker').toBe(true);
      expect(geometry.medals, 'a palette draws no «ИЛИ» medallion').toBe(0);
      const focusedAt = () => page.evaluate(() => Array.from(document.querySelectorAll('.con-composer__sublist .con-vchoice__opt'))
        .findIndex((el) => el.classList.contains('con-vchoice__opt--focused')));
      expect(await focusedAt(), 'the cursor opens on the first tile').toBe(0);
      await press(page, 'ArrowRight', 300);
      expect(await focusedAt(), '→ walks the row').toBe(1);
      await press(page, 'ArrowLeft', 300);
      expect(await focusedAt(), '← walks it back').toBe(0);

      // ── The breadcrumb never left the workspace while the step is open. ──
      await expect(page.locator('.con-cardactions')).toHaveCount(1);

      // ── 2. Answer the step, then commit. ────────────────────────────────
      // Read the CHOSEN option's promise off its own chip, so the assertion
      // below is about what the UI said — not about a resource picked here.
      const chosen = rows.first();
      const promised = await chosen.innerText();
      const [, from, to] = /(\d+)\s*→\s*(\d+)/.exec(promised) ?? [];
      expect(from, `the option must promise a concrete before→after: «${promised}»`).not.toBe(undefined);

      await press(page, 'Enter', 900); // pick the focused option
      await expect(optionRows(page)).toHaveCount(0, {timeout: 5000});
      await expect(page.locator('.con-composer__row--missing'),
        'the answered step must stop blocking the commit').toHaveCount(0, {timeout: 5000});
      await shoot(page, `${profile.tag}-2-answered`);

      await page.keyboard.press('Enter'); // COMMIT
      await page.waitForTimeout(3500);

      // ── 3. NO standalone band. The task host may only appear EMBEDDED. ──
      const standalone = page.locator('.con-task-host.con-ws');
      expect(await standalone.count(),
        'a follow-up band after the confirm is the regression this spec exists for').toBe(0);
      await shoot(page, `${profile.tag}-3-after-commit`);

      // ── 4. The promised resource actually landed on the rail. ───────────
      await expect
        .poll(async () => page.locator('.con-res').innerText().catch(() => ''), {timeout: 15_000})
        .toContain(String(to));
    });
  });
}
