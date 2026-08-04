import {test, expect, Page} from '@playwright/test';
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
 *     width rule — a `vw` cap used to overrun the narrowed band).
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
    return {
      hasMarker: root.classList.contains('con-ws'),
      bandLeft: rootBox.left,
      bandRight: rootBox.right,
      railRight: railBox.right,
      railZ: getComputedStyle(rail).zIndex,
      railHostZ: getComputedStyle(host).zIndex,
      auxHidden: aux !== null && getComputedStyle(aux).display === 'none',
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
  // Nothing sticks out past the viewport (the min(Xrem, 100%) width rule).
  expect(p.panelOverflow, `${label}: content overflows the viewport by ${p.panelOverflow}px`).toBeLessThan(2);
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

      const created = await request.post('/api/creategame', {data: cfg()});
      expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
      const model = await created.json() as {players: Array<{id: string}>};
      await page.goto(`/player?id=${model.players[0].id}&console=1${profile.query}`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
      await page.waitForTimeout(3500);

      // The start wizard, driven STATE-AWARE (a blind A/RT alternation buys
      // cards on the project step, and the payment task it spawns then eats
      // the walk): read the active step each iteration — corp step = pick,
      // project step = skip, summary = launch, anything else = A.
      for (let i = 0; i < 22; i++) {
        const stage = await page.evaluate(() => {
          const steps = [...document.querySelectorAll('.con-start__step')];
          const active = steps.findIndex((s) => s.classList.contains('con-start__step--active'));
          return {
            start: document.querySelector('.con-start__frame') !== null,
            host: document.querySelector('.con-task-host') !== null,
            active,
            steps: steps.length,
          };
        });
        if (!stage.start && !stage.host) {
          break;
        }
        if (stage.start && stage.steps > 0) {
          if (stage.active === 0) {
            await key(page, 'Enter', 1000); // pick the focused corporation
            await key(page, 'Period', 1000); // → the project step
          } else if (stage.active === stage.steps - 1) {
            await key(page, 'Enter', 1300); // summary → launch
          } else {
            await key(page, 'Period', 1000); // buy nothing
          }
        } else {
          await key(page, 'Enter', 1100);
        }
      }
      await page.waitForTimeout(1500);
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
  });
}
