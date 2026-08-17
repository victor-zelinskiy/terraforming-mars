import {test, expect, Page} from '@playwright/test';
import {bootSeededGame, createGameWithCards} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console WORKSPACE BAND — the ONE premium format of every decision surface
 * (docs/claude/console/workspace-band.md).
 *
 * The contract this proves at the real surface, per reachable surface:
 *  1. the root carries the `con-ws` family marker;
 *  2. its box starts RIGHT OF the always-visible player rail (never over it);
 *  3. the rail is genuinely LIT — its host is lifted above the shared shade
 *     (`.con-root:has(.con-ws)`), so the resources stay readable context and
 *     the future resource-flight has a live landing zone;
 *  4. nothing overflows the viewport horizontally (the `min(Xrem, 100%)`
 *     width rule — a `vw` cap used to overrun the narrowed band);
 *  5. THE OPENING IS THE WHOLE CONTRACT, with ONE distinction inside it:
 *     · a compact DIALOG (a confirm, a task card, the attack modal) clears ALL
 *       FOUR hull members and the shared dim covers exactly that opening — no
 *       bar is ever greyed out;
 *     · a WORKSPACE SCREEN (card actions / standard projects / MA / hand / …)
 *       IS the stage: it takes the right rail's zone too, and the rail stops
 *       being DRAWN rather than sitting dimmed underneath.
 *     Which one a surface is, is read from the shell's own policy class
 *     (`.con-root--rail-replaced`, computed from the workspace stack) — never
 *     guessed from the surface's name here.
 *
 * Driven on a REAL solo game: the surfaces are opened the way a player opens
 * them (wheels + A), never by injecting DOM.
 */

const OUT = path.resolve('screenshots', 'workspace-band');

function cfg() {
  return {
    players: [{name: 'WSTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false,
    clonedGamedId: undefined, undoOption: false, showTimers: false, fastModeOption: false,
    showOtherPlayersVP: false, testMode: true, aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard', solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false, modularMA: false, draftVariant: false,
    initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false, customCorporationsList: [], bannedCards: [],
    includedCards: [], customColoniesList: [], customPreludes: [],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false,
    customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function key(page: Page, code: string, settle = 500): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

async function shoot(page: Page, tag: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${tag}-${name}.png`)});
}

async function toBoard(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    // B on the start scene MINIMISES the wizard (it is not a surface to
    // close) — never walk back from there.
    if (await page.locator('.con-start__frame').count() > 0) {
      return;
    }
    if (await page.locator('.con-quick, .con-stdp, .con-ma, .con-cardactions, .con-composer, .con-sheet, .con-hand, .con-played, .con-journal').count() === 0) {
      return;
    }
    await key(page, 'Escape', 400);
  }
}

async function appears(page: Page, sel: string, ms = 4000): Promise<boolean> {
  return page.locator(sel).first().waitFor({state: 'attached', timeout: ms})
    .then(() => true).catch(() => false);
}

/** The band + rail geometry a workspace surface must satisfy. */
type BandProbe = {
  hasMarker: boolean,
  bandLeft: number,
  railRight: number,
  railZ: string,
  railHostZ: string,
  auxHidden: boolean,
  auxZ: number,
  bandRight: number,
  viewportW: number,
  panelOverflow: number,
};

async function probe(page: Page, selector: string): Promise<BandProbe> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel) as HTMLElement;
    const rail = document.querySelector('.con-res') as HTMLElement;
    const host = document.querySelector('.con-res-host') as HTMLElement;
    // The ДОП.РЕСУРСЫ satellite only exists once a card resource does, so this
    // is a "if it is there, it must not be hidden" check, not a presence one.
    const aux = document.querySelector('.con-res-aux') as HTMLElement | null;
    const rootBox = root.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    // The widest painted child box — catches a `vw` width cap overrunning the
    // narrowed band (the panel would stick out past the viewport edge).
    let overflow = 0;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && b.height > 0) {
        overflow = Math.max(overflow, b.right - window.innerWidth);
      }
    }
    const boxOf = (sel: string): {l: number, r: number, t: number, b: number} | null => {
      const el = document.querySelector<HTMLElement>(sel);
      if (el === null) {
        return null;
      }
      const bb = el.getBoundingClientRect();
      // `display: none` measures 0×0 — the member is not on screen at all.
      return bb.width <= 0 || bb.height <= 0 ? null : {l: bb.left, r: bb.right, t: bb.top, b: bb.bottom};
    };
    const shadeEl = document.querySelector<HTMLElement>('.con-shade');
    const shade = shadeEl === null ? null : shadeEl.getBoundingClientRect();
    return {
      hasMarker: root.classList.contains('con-ws'),
      bandLeft: rootBox.left,
      bandRight: rootBox.right,
      bandTop: rootBox.top,
      bandBottom: rootBox.bottom,
      strat: boxOf('.con-strat'),
      // Is the right rail DRAWN? A workspace screen replaces it (visibility),
      // a dialog leaves it lit. `boxOf` deliberately keeps reporting the box —
      // it must survive, or the board reflows for a mode change.
      stratDrawn: (() => {
        const el = document.querySelector<HTMLElement>('.con-strat');
        return el !== null && getComputedStyle(el).visibility !== 'hidden';
      })(),
      railReplaced: document.querySelector('.con-root')?.classList.contains('con-root--rail-replaced') === true,
      strip: boxOf('.con-status'),
      cmdbar: boxOf('.con-footer .con-cmdbar'),
      shade: shade === null ? null : {l: shade.left, r: shade.right, t: shade.top, b: shade.bottom},
      shadeOn: shadeEl !== null && shadeEl.classList.contains('con-shade--on'),
      shadeFullBleed: shadeEl !== null && shadeEl.classList.contains('con-shade--fullbleed'),
      railRight: railBox.right,
      railZ: getComputedStyle(rail).zIndex,
      railHostZ: getComputedStyle(host).zIndex,
      auxHidden: aux !== null && getComputedStyle(aux).display === 'none',
      auxZ: aux === null ? -1 : Number(getComputedStyle(aux).zIndex),
      viewportW: window.innerWidth,
      panelOverflow: overflow,
    };
  }, selector);
}

async function assertBand(page: Page, selector: string, label: string): Promise<void> {
  const p = await probe(page, selector);
  expect(p.hasMarker, `${label}: the root must carry the con-ws family marker`).toBeTruthy();
  // The band starts at (or right of) the rail's right edge — a 2px tolerance
  // for sub-pixel rounding under the TV profile's zoom/scale model.
  expect(p.bandLeft, `${label}: band left ${p.bandLeft} must clear the rail right ${p.railRight}`)
    .toBeGreaterThanOrEqual(p.railRight - 2);
  // The rail is LIT: the PANEL itself is lifted above the shared shade
  // (11460). The lift sits on `.con-res`, not on `.con-res-host` — a stacking
  // context on the host would drag the ДОП.РЕСУРСЫ satellite up with it.
  expect(Number(p.railZ), `${label}: the rail panel must be lifted (was z=${p.railZ})`)
    .toBeGreaterThan(11460);
  // …and the HOST must stay z-auto. This is the mechanism, not a detail: a
  // z-index here makes the host a stacking context, the satellite is dragged
  // above the panels with it, and the historical answer to that was to hide the
  // satellite outright — which blanked the card-resource counts exactly while a
  // card action was configured AND killed the landing anchor the resource
  // flights measure. Z-ORDER, NOT VISIBILITY.
  expect(p.railHostZ, `${label}: the rail HOST must not be a stacking context (was z=${p.railHostZ})`)
    .toBe('auto');
  expect(p.auxHidden, `${label}: the ДОП.РЕСУРСЫ satellite must be covered, never hidden`).toBeFalsy();
  // …and it must sit in the ONE gap: over the shade (11460) so a workspace
  // never DIMS it, under the band surfaces (11480+) so it never paints over
  // one. (-1 = no card resource in this game, so nothing to check.)
  if (p.auxZ >= 0) {
    expect(p.auxZ, `${label}: the satellite must clear the shade (was z=${p.auxZ})`).toBeGreaterThan(11460);
    expect(p.auxZ, `${label}: the satellite must stay under the band (was z=${p.auxZ})`).toBeLessThan(11480);
  }
  // Nothing sticks out past the viewport (the min(Xrem, 100%) width rule).
  expect(p.panelOverflow, `${label}: content overflows the viewport by ${p.panelOverflow}px`).toBeLessThan(2);

  // ── THE OPENING, ON ALL FOUR SIDES ────────────────────────────────────────
  // A decision surface may not reach under any hull member. Tolerance is 2px
  // for the TV profile's sub-pixel scale model (same as the left edge above).
  if (p.strip !== null) {
    expect(p.bandTop, `${label}: band top ${p.bandTop} must clear the status strip ${p.strip.b}`)
      .toBeGreaterThanOrEqual(p.strip.b - 2);
  }
  if (p.cmdbar !== null) {
    expect(p.bandBottom, `${label}: band bottom ${p.bandBottom} must clear the command bar ${p.cmdbar.t}`)
      .toBeLessThanOrEqual(p.cmdbar.t + 2);
  }
  // THE RIGHT EDGE — the one place the two families differ.
  if (p.railReplaced) {
    // A WORKSPACE SCREEN is the stage: it takes the rail's zone, and the rail
    // is not drawn. (Its BOX still exists — asserted below — so the board never
    // reflows for a mode change.)
    expect(p.stratDrawn, `${label}: a workspace screen must REPLACE the rail, not dim it`).toBeFalsy();
    expect(p.bandRight, `${label}: a workspace screen must reach the physical edge`)
      .toBeGreaterThanOrEqual(p.viewportW - 2);
    if (p.strat !== null) {
      expect(p.strat.r - p.strat.l, `${label}: the rail's box must survive the replacement`)
        .toBeGreaterThan(0);
    }
  } else if (p.strat !== null) {
    // A DIALOG stands inside the opening, beside a LIT rail.
    expect(p.stratDrawn, `${label}: the rail must stay drawn beside a dialog`).toBeTruthy();
    expect(p.bandRight, `${label}: band right ${p.bandRight} must clear the strategy rail ${p.strat.l}`)
      .toBeLessThanOrEqual(p.strat.l + 2);
  }

  // ── AND THE DIM COVERS THE SAME OPENING ──────────────────────────────────
  // Bounding the shade by GEOMETRY is what makes «no bar is ever dimmed» true
  // for all four at once — the old `inset: 0` relied on the two horizontal bars
  // out-stacking it and had no answer for the side rails. A full-bleed owner
  // (the card-reveal cinematic) is the one sanctioned exception.
  if (p.shadeOn && p.shade !== null && !p.shadeFullBleed) {
    expect(p.shade.l, `${label}: the dim reaches the player rail (${p.shade.l} < ${p.railRight})`)
      .toBeGreaterThanOrEqual(p.railRight - 2);
    if (p.strat !== null && !p.railReplaced) {
      expect(p.shade.r, `${label}: the dim reaches the strategy rail (${p.shade.r} > ${p.strat.l})`)
        .toBeLessThanOrEqual(p.strat.l + 2);
    }
    if (p.strip !== null) {
      expect(p.shade.t, `${label}: the dim reaches the status strip`).toBeGreaterThanOrEqual(p.strip.b - 2);
    }
    if (p.cmdbar !== null) {
      expect(p.shade.b, `${label}: the dim reaches the command bar`).toBeLessThanOrEqual(p.cmdbar.t + 2);
    }
  }
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console workspace band · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('every decision surface stands right of a LIT player rail', async ({page, request}) => {
      test.setTimeout(480_000);

      // The pregame is SETUP — the subject is where every DECISION surface
      // stands. The shared driver ANSWERS it over `player/input` and opens the
      // console on a live board; what stood here was a key script keyed on
      // `.con-start__step--active`, a selector the wizard moved away from.
      const playerId = await createGameWithCards(request, [], {config: cfg()});
      await bootSeededGame(page, request, playerId, {buy: 2, query: profile.query});
      await toBoard(page);
      expect(await page.locator('.con-board').count(), 'never reached the board home').toBeGreaterThan(0);

      // Every surface reached in this walk, checked + shot. The set is
      // deliberately opened through the REAL command grammar; a surface the
      // walk cannot reach in this seed is skipped, never faked.
      let checked = 0;

      // ── 1 · Standard projects (LT wheel → A) ────────────────────────────
      // A busy 4K frame silently drops a single press — retry, but never
      // press LT while the wheel is ALREADY open (the trigger toggles it
      // shut, which is how the retry used to fight itself).
      for (let tries = 0; tries < 4 && await page.locator('.con-stdp').count() === 0; tries++) {
        if (await page.locator('.con-quick').count() > 0) {
          await key(page, 'Enter', 1300);
        } else {
          await key(page, 'Comma', 1100);
        }
      }
      if (await appears(page, '.con-stdp')) {
        await assertBand(page, '.con-stdp', 'standard projects');
        await shoot(page, profile.tag, '01-standard-projects');
        checked++;
      }
      await toBoard(page);

      // ── 2 · Card actions (RT wheel → ArrowUp) ───────────────────────────
      await key(page, 'Period', 900);
      if (await page.locator('.con-quick').count() > 0) {
        await key(page, 'ArrowUp', 1200);
      }
      if (await appears(page, '.con-cardactions')) {
        await assertBand(page, '.con-cardactions', 'card actions');
        await shoot(page, profile.tag, '02-card-actions');
        checked++;
      }
      await toBoard(page);

      // -- 3 . Milestones (LB on the board home -- the stable board verb) ---
      await key(page, 'KeyQ', 1200);
      if (await appears(page, '.con-ma')) {
        await assertBand(page, '.con-ma', 'milestones / awards');
        await shoot(page, profile.tag, '03-milestones');
        checked++;
      }
      await toBoard(page);

      // -- 4 . The pass CONFIRMATION panel (LT wheel -> down = Pass) --------
      await key(page, 'Comma', 900);
      if (await page.locator('.con-quick').count() > 0) {
        await key(page, 'ArrowDown', 1200);
      }
      if (await appears(page, '.con-confirm')) {
        await assertBand(page, '.con-confirm', 'pass confirmation');
        await shoot(page, profile.tag, '04-pass-confirm');
        checked++;
      }
      await toBoard(page);

      // -- 5 . The played tableau («РАЗЫГРАНО», X on the board home) --------
      // X on the board home opens «Разыграно» — but only from the calm home
      // (never mid-inspection); a busy frame may swallow the first press.
      for (let tries = 0; tries < 3 && await page.locator('.con-played').count() === 0; tries++) {
        await key(page, 'KeyX', 1200);
        await appears(page, '.con-played', 2500);
      }
      if (await page.locator('.con-played').count() > 0) {
        await assertBand(page, '.con-played', 'played tableau');
        await shoot(page, profile.tag, '05-played');
        checked++;
      }
      await toBoard(page);

      expect(checked, 'no workspace surface was reachable in this walk').toBeGreaterThanOrEqual(4);
    });

    test('the opening FOLLOWS a window resize', async ({page, request}) => {
      test.setTimeout(300_000);

      // The opening is MEASURED, so a resize is the one event that can leave a
      // band standing on stale numbers — and a shrink is the dangerous
      // direction: a band still sized for the old viewport reaches under the
      // bars rather than merely leaving a gap. The rails are content-sized in
      // rem, so their boxes move too; nothing here may be re-derived from the
      // size the surface opened at.
      const playerId = await createGameWithCards(request, [], {config: cfg()});
      await bootSeededGame(page, request, playerId, {buy: 2, query: profile.query});
      await toBoard(page);

      // The cheapest band surface with the family marker: the LT wheel (a
      // DIALOG — it must clear the strategy rail before AND after).
      for (let tries = 0; tries < 4 && await page.locator('.con-quick').count() === 0; tries++) {
        await key(page, 'Comma', 900);
      }
      expect(await page.locator('.con-quick').count(), 'the LT wheel never opened').toBeGreaterThan(0);
      await assertBand(page, '.con-quick', 'wheel @ open size');

      // …shrink INSIDE the same profile band (a profile flip is a different
      // test — it re-mounts surfaces and would hide a stale-geometry bug).
      const shrunk = {width: Math.round(profile.width * 0.875), height: Math.round(profile.height * 0.9)};
      await page.setViewportSize(shrunk);
      await page.waitForTimeout(700);
      await assertBand(page, '.con-quick', `wheel @ ${shrunk.width}x${shrunk.height}`);
      await shoot(page, profile.tag, '06-resized');

      // …and back: the opening is a state, not a one-way narrowing.
      await page.setViewportSize({width: profile.width, height: profile.height});
      await page.waitForTimeout(700);
      await assertBand(page, '.con-quick', 'wheel @ restored size');
    });
  });
}
