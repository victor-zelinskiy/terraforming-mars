import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, focusCard, press, soloGameConfig} from './consoleStart';

/**
 * Console-native PLANET FOCUS · the main-grid placement stage.
 *
 * Drives a real solo game to a standard-project GREENERY placement (main
 * grid only → the mode must engage; greenery raises OXYGEN → the scale
 * beat must fire) and asserts the mode's whole contract:
 *
 *   1. entering placement ENGAGES focus: `.con-board--pfocus*` classes on
 *      the board root, the arc band + off-Mars flanks recede, the planet's
 *      `--board-scale` GROWS beyond the overview fit;
 *   2. the placement panel («РАЗМЕЩЕНИЕ ТАЙЛА») still serves normally;
 *   3. mid-scene the top-HUD oxygen readout stays FROZEN at its pre-commit
 *      value (the display hold) even though the server already committed;
 *   4. the exit restores the overview scale and the arc band;
 *   5. ONLY AFTER the exit does the scale story play: the released values
 *      glide and `con-scale-focus-oxygen` pulses — never while the board
 *      is still focused (the sequencing contract).
 *
 * The SECOND test drives the other way a placement reaches the board: a card
 * PLAYED OUT OF THE HAND. There the shell is on the `hand` SECTION when the
 * prompt lands and the placement is still held behind the played-hero, so the
 * board stage is `display: none` at the exact moment the mode engages — the
 * case that shipped the mode looking engaged (arcs receded, veil up) over a
 * planet still at overview size.
 */

const OUT_DIR = path.resolve('screenshots', 'console-planet-focus');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'FocusTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
});

/**
 * The HAND-PLAY case, and the card is chosen for its TIMING.
 *
 * «Мохол» raises heat production 4 steps AND places its tile on an
 * ocean-reserved area: a candidate set that lives entirely on the main grid
 * (so the mode must engage), behind a play outcome that spends its own beats
 * paying the production reward. That gap is the subject — it keeps the board
 * section hidden PAST the mode's settle, which is what the reported bug needs
 * («Колонисты в лавовых трубках»: the same shape — production, then a city on
 * a volcanic area). A card with no reward stage (a bare EVENT) hands the board
 * back inside the enter transition, and the `entering → active` re-fit then
 * papers the whole thing over — the spec would pass on a broken build.
 *
 * Teractor is NAMED, never merely listed: `testMode` deals eight corporations,
 * so `customCorporationsList` guarantees only that it is IN the deal. 60 M€
 * pays the card's 20 without a payment branch to walk.
 */
const HAND_CARD = 'Mohole Area';
const HAND_CONFIG = soloGameConfig({
  players: [{name: 'HandFocusTester', color: 'red', beginner: false, handicap: 0, first: true}],
  customCorporationsList: ['Teractor'],
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** The inline `--board-scale` the console fit engine writes on <html>. */
function boardScale(page: Page): Promise<number> {
  return page.evaluate(() =>
    parseFloat(document.documentElement.style.getPropertyValue('--board-scale') || '0'));
}

/** The top-HUD ocean readout (the `N/9` of the strip). */
async function hudOceans(page: Page): Promise<string> {
  const text = await page.locator('.con-status').innerText();
  const m = text.match(/(\d+)\/9/);
  return m === null ? '' : m[1];
}

/**
 * Walk the standard-projects sheet until the FOCUSED card names `title`.
 * The grid geometry is not load-bearing for this spec — a blind "two downs"
 * once landed on «Город» (no parameter change → the beat legitimately
 * degenerated to a silent release and the accent probe starved).
 */
async function focusStdProject(page: Page, title: RegExp): Promise<boolean> {
  const focusedName = () =>
    page.locator('.con-stdp__card--focused .con-stdp__name').innerText().catch(() => '');
  // Let the sheet finish its enter transition before the first press —
  // early arrows were swallowed and the walk desynced from the grid.
  await page.waitForTimeout(900);
  const walk = ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft',
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowDown'];
  for (let i = 0; i <= walk.length; i++) {
    if (title.test(await focusedName())) {
      return true;
    }
    if (i < walk.length) {
      await key(page, walk[i], 500);
    }
  }
  return false;
}

/**
 * The arc band's computed state. The `.global-numbers` container is a
 * ZERO-HEIGHT box (every arc child is absolute), so Playwright's
 * `toBeVisible` can never pass on it — probe the computed style instead.
 */
type DockPose = {compact: boolean, raised: boolean, scale: number, opacity: number, cls: string, hdScale: string};

/**
 * The hand dock's live POSE: which of the three classes is on, and the
 * whole-pack transform the CSS resolved for it. `scale` is read off the
 * computed matrix — the pose contract is "one uniform shrink", so the
 * matrix's `a` component IS the pose.
 *
 * The pack is read THROUGH the dock (`dock.querySelector`), never as a second
 * top-level query: the two must describe ONE physical object, or a pose
 * failure reports a class list and a transform that belong to different
 * elements. `cls` + `hdScale` (the resolved `--hd-scale` custom property the
 * pose rules actually set — `console.less` `&--compact` / `&--raised`) ride
 * along so a mismatch names its own cause instead of "expected 1, got 0.7".
 */
function dockPose(page: Page): Promise<DockPose> {
  return page.evaluate(() => {
    const dock = document.querySelector('.con-handdock');
    const pack = dock?.querySelector('.con-handdock__pack') ?? null;
    if (dock === null || pack === null) {
      return {compact: false, raised: false, scale: 0, opacity: 0, cls: 'no dock', hdScale: ''};
    }
    const cs = getComputedStyle(pack as HTMLElement);
    const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform);
    return {
      compact: dock.classList.contains('con-handdock--compact'),
      raised: dock.classList.contains('con-handdock--raised'),
      scale: Math.round(m.a * 1000) / 1000,
      opacity: Number(cs.opacity),
      cls: dock.className,
      hdScale: cs.getPropertyValue('--hd-scale').trim(),
    };
  });
}

/**
 * Wait until the pack's pose transition has actually SETTLED (two equal
 * samples), then report it. A fixed sleep read the eased tail (0.994) and
 * turned an exact-pose assertion into a flake.
 */
async function settledDockPose(page: Page): Promise<DockPose> {
  // Poll until the pack STOPS moving — three consecutive equal samples, and
  // never fewer than two rounds (a single pair can both land before the
  // transition's first frame and read the OLD pose as "settled").
  let last = await dockPose(page);
  let stable = 0;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(120);
    const now = await dockPose(page);
    stable = now.scale === last.scale && now.opacity === last.opacity ? stable + 1 : 0;
    last = now;
    if (stable >= 3) {
      break;
    }
  }
  return last;
}

function arcBandState(page: Page): Promise<{display: string, opacity: string}> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-board .global-numbers');
    if (el === null) {
      return {display: 'missing', opacity: ''};
    }
    const cs = getComputedStyle(el as HTMLElement);
    return {display: cs.display, opacity: cs.opacity};
  });
}

test.describe('console planet focus · main-grid placement stage', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the board becomes the stage; the scales move only after the return', async ({page, request}) => {
    test.setTimeout(360_000);

    // ── The pregame: the shared start driver (`consoleStart.ts`). The walk
    //    is SETUP, never the subject — this spec's claim is the Planet Focus
    //    stage, so a start-flow change is adapted THERE, never here.
    //
    //    What used to stand here was a blind A/RT alternation that decided
    //    the wizard was over by COUNTING `.con-start__frame` nodes. That
    //    predicate is unanswerable by construction: the scene stays MOUNTED
    //    through its yield (`ConsoleShell.vue:2395`) and its panes are
    //    `v-show` (`ConsoleStartScene.vue:26`) — and this spec was
    //    fail-BY-DESIGN, because `startSceneVisible` is
    //    `startSceneMounted && !placementActive` (`ConsoleShell.vue:2393`),
    //    so during the very board placement it goes on to assert, the scene
    //    is GUARANTEED mounted-and-hidden.
    await bootIntoGame(page, request, {config: GAME_CONFIG});

    // ── overview baseline ─────────────────────────────────────────────
    const board = page.locator('.con-board');
    const scaleBefore = await boardScale(page);
    expect(scaleBefore, 'no overview fit ran').toBeGreaterThan(0);
    const arcsBefore = await arcBandState(page);
    expect(arcsBefore.display, 'no arc band on the overview board').not.toBe('none');
    expect(arcsBefore.opacity).toBe('1');
    const oceansBefore = await hudOceans(page);
    // POSE 1 — the dock's default: full-size pack, no pose class.
    const poseHome = await dockPose(page);
    expect(poseHome.compact || poseHome.raised, 'the dock starts in a pose').toBe(false);
    expect(poseHome.scale).toBe(1);
    await shoot(page, '01-board-home');

    // LT wheel → Standard Projects → «Аквифер»: an OCEAN placement — the
    // candidates are main-grid ocean cells (the mode must engage) and the
    // ocean count rises (the scale beat + the oceans accent must fire).
    await key(page, 'Comma', 1200);
    await key(page, 'Enter', 1500);
    expect(await focusStdProject(page, /океан/i), 'never focused «Океан»').toBeTruthy();
    await key(page, 'Enter', 1600);
    // The project opens the shared payment panel — X is «ОПЛАТИТЬ».
    if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
      await key(page, 'KeyX', 2600);
    }

    // ── the mode engages ──────────────────────────────────────────────
    const panel = page.locator('.con-context');
    expect((await panel.innerText()).includes('РАЗМЕЩЕНИЕ ТАЙЛА'),
      'never reached a board placement').toBeTruthy();
    await expect(board).toHaveClass(/con-board--pfocus/);
    await page.waitForSelector('.con-board--pfocus-settled', {timeout: 5_000});
    const scaleFocused = await boardScale(page);
    // The disc-framed fit + the reclaimed banner/dock rows give a LARGE
    // growth (≥25% is the conservative floor across profiles) — a weak
    // growth means the frame regressed to the transparent asset canvas.
    expect(scaleFocused, 'the planet did not grow into the freed space')
      .toBeGreaterThan(scaleBefore * 1.25);
    // The arc band receded out of the scene (display drops at settle).
    expect((await arcBandState(page)).display).toBe('none');
    // POSE 2 — the hand steps back so it stops competing with the planet.
    const poseFocus = await settledDockPose(page);
    expect(poseFocus.compact, 'the dock did not take its compact pose').toBe(true);
    // ~30% more compact — and NEVER so small it reads as gone (the first
    // cut buried the pack behind the tray, which is not a pose, it's a
    // disappearance). Both bounds are the contract.
    expect(poseFocus.scale, 'the compact pack is not visibly smaller').toBeLessThan(0.8);
    expect(poseFocus.scale, 'the compact pack shrank out of sight').toBeGreaterThan(0.62);
    expect(poseFocus.opacity).toBeLessThan(1);
    await shoot(page, '02-placement-focus');

    // POSE 3 over POSE 2 — the RT wheel is legal on an expanded planet: the
    // pack must come back to FULL size and stand ready (never stay tucked),
    // and closing the wheel must return it to compact, not to default.
    await key(page, 'Period', 500);
    const poseWheel = await settledDockPose(page);
    const wheelStory = `pose ${JSON.stringify(poseWheel)}`;
    expect(poseWheel.raised, `RT did not raise the dock over the focused board — ${wheelStory}`).toBe(true);
    expect(poseWheel.compact, `raised and compact are mutually exclusive — ${wheelStory}`).toBe(false);
    expect(poseWheel.scale, `the raised pack is not at full size — ${wheelStory}`).toBe(1);
    expect(poseWheel.opacity, wheelStory).toBe(1);
    await shoot(page, '02b-wheel-over-focus');
    await key(page, 'Period', 500); // the same trigger closes it
    const poseBack = await settledDockPose(page);
    expect(poseBack.compact, 'closing the wheel did not return the compact pose').toBe(true);
    expect(poseBack.scale).toBeLessThan(0.8);
    expect(poseBack.scale).toBeGreaterThan(0.62);

    // ── place: the hero + rewards play on the enlarged stage ──────────
    await key(page, 'Enter', 600);
    // The commit lands mid-scene, but the DISPLAYED ocean count must not
    // move while the board still owns the story (the display hold).
    expect(await hudOceans(page)).toBe(oceansBefore);
    await shoot(page, '03-mid-scene');

    // ── the exit restores the overview… ───────────────────────────────
    // …WITHOUT the "invisible wall": sample the return continuously and
    // catch any frame where a VISIBLE arc band sticks out of the stage's
    // clip box (the stage is `overflow: hidden`, so that is exactly the
    // frame where the player saw the band sliced along the dock line).
    const clipWatch = page.evaluate(() => new Promise<{unclipped: number, frames: number, arcs: number, at: string}>((resolve) => {
      const stage = document.querySelector('.con-board__stage') as HTMLElement | null;
      /**
       * The PAINTED opacity of one arc part, accumulated up to the stage.
       *
       * Load-bearing: the arcs are absolutely-positioned children of a
       * ZERO-HEIGHT `.global-numbers` container, and the focus exit fades the
       * arc SHELLS (`.global-numbers > *` — console.less § LEAVING/RETURNING),
       * never the container. So the container's own computed style reads
       * "visible" from the first frame of the return while every arc is still
       * at `opacity: 0` and the disc is still at its focused size. Gating on
       * IT (as this watcher first did) measures geometry nobody can see and
       * reports a 200px "slice" for a band that is not on screen at all.
       */
      const painted = (el: HTMLElement): number => {
        let o = 1;
        for (let n: HTMLElement | null = el; n !== null && n !== stage; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden') {
            return 0;
          }
          o *= Number(cs.opacity);
        }
        return o;
      };
      /**
       * The BLEED the stage's clip box gains while the focus is engaged or
       * exiting — measured from the app's own token, never hard-coded:
       * `.con-board--pfocus/-exit .con-board__stage` replaces the clip with
       * `polygon(… 100% + var(--pfocus-bleed) …)` (console.less), so during the
       * return the visible region really does reach BELOW the element box, on
       * purpose: that is the room the arcs condense back through. Comparing the
       * arcs against the element rect alone accuses the app of slicing a band
       * that is fully drawn.
       *
       * Measured through a probe element because the token is authored in rem
       * and `getPropertyValue` hands back the unresolved `"2.9rem"` string
       * (the same trap the console's own JS readers pay for — console-ui.md
       * § Scale model).
       */
      let bleed = 0;
      if (stage !== null) {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:var(--pfocus-bleed, 0px)';
        stage.appendChild(probe);
        bleed = probe.getBoundingClientRect().height;
        probe.remove();
      }
      /*
       * WHAT THIS CAN AND CANNOT MEASURE — the correction that matters.
       *
       * This watcher used to compare each arc's `getBoundingClientRect()`
       * against the stage rect and report the excess as «a visible arc band
       * overflowed the clip box» (173px at tv4k). That check is structurally
       * incapable of detecting what it claims, for two independent reasons:
       *
       *  1. The arcs are DESCENDANTS of `.con-board__stage` (the selector
       *     itself says so), and the stage carries a `clip-path` during the
       *     focus phases. `clip-path` clips every descendant unconditionally —
       *     unlike `overflow`, nothing escapes it. Ink outside the clip is not
       *     painted, so a rect poking out proves nothing.
       *  2. These are SVG paths. `ConsoleBoardSection.vue` documents the exact
       *     trap: the band «is drawn inside a SQUARE SVG whose DOM rect is the
       *     whole square, not the visible band», so an arc's box is legitimately
       *     far wider than its stroke. At 4K it is wider than the stage.
       *
       * So the honest thing to assert is the MECHANISM that provides the
       * guarantee: while the focus is engaged or exiting, the stage really does
       * carry a clip, and the arcs really are inside it. That is falsifiable —
       * remove the rule and this goes red — whereas the rect comparison could
       * only ever report the geometry of a curve.
       *
       * `bleed` is still measured (below) because the clip's DOWNWARD extension
       * is the part of the shape worth naming in a failure message.
       */
      let unclipped = 0;
      let arcs = 0;
      let at = '';
      let frames = 0;
      const started = performance.now();
      const tick = () => {
        frames++;
        if (stage !== null) {
          const focusing = stage.closest('.con-board--pfocus, .con-board--pfocus-exit') !== null;
          const clipped = getComputedStyle(stage).clipPath !== 'none';
          const visible = [...document.querySelectorAll(
            '.con-board__stage .arc-scale__rail, .con-board__stage .arc-scale__edge')]
            .filter((n) => painted(n as HTMLElement) > 0.05);
          arcs = Math.max(arcs, visible.length);
          if (focusing && !clipped && visible.length > 0) {
            unclipped++;
            at = `${visible.length} arc part(s) painted with NO clip on the stage ` +
              `(bleed=${Math.round(bleed)}) at +${Math.round(performance.now() - started)}ms`;
          }
        }
        if (performance.now() - started > 5000) {
          resolve({unclipped, frames, arcs, at});
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));

    await page.waitForSelector('.con-board--pfocus', {state: 'detached', timeout: 20_000});
    // …and ONLY THEN the scale story plays: the oceans accent pulse must
    // arrive strictly on the RESTORED board (never over a focused one).
    const accentSeen = await page.waitForFunction(() => {
      const html = document.documentElement.classList;
      const focused = document.querySelector('.con-board--pfocus') !== null;
      return html.contains('con-scale-focus-oceans') && !focused;
    }, undefined, {timeout: 12_000});
    expect(accentSeen).toBeTruthy();
    await shoot(page, '04-scale-beat');

    // The beat released the held values: the HUD now tells the raise.
    await page.waitForFunction((before: string) => {
      const strip = document.querySelector('.con-status');
      const m = strip === null ? null : (strip as HTMLElement).innerText.match(/(\d+)\/9/);
      return m !== null && m[1] !== before;
    }, oceansBefore, {timeout: 8_000});

    const clip = await clipWatch;
    // ANTI-VACUOUS-PASS GUARD, not a performance assertion — its own message
    // says so. `clip.worst` is meaningless if the watcher never armed, so this
    // only has to prove it sampled the transition. The old `> 30` encoded the
    // machine's FRAME RATE (rAF count × duration): a loaded run sampled 17 and
    // was failed for being slow, while the thing under test — «no arc band
    // overflows the clip box» — was perfectly satisfied. The real assertion is
    // the next line.
    expect(clip.frames, 'the clip watcher never sampled a frame').toBeGreaterThan(4);
    // NON-VACUOUS: the guarantee below is meaningless if the watcher never saw
    // a painted arc part inside the stage — that is also what proves the arcs
    // are DESCENDANTS of the clipped element, which is what makes the clip bind.
    expect(clip.arcs, 'the watcher never saw a painted arc part inside the stage')
      .toBeGreaterThan(0);
    // THE CONTRACT: while the focus is engaged or exiting, the stage carries the
    // clip that keeps the band off the rail. Not a tolerance — a mechanism.
    expect(clip.unclipped, `the stage painted arcs with no clip during the focus (${clip.at})`)
      .toBe(0);

    const arcsAfter = await arcBandState(page);
    expect(arcsAfter.display, 'the arc band never returned').not.toBe('none');
    expect(arcsAfter.opacity).toBe('1');
    // …and the hand returns to POSE 1 with the rest of the interface.
    const poseAfter = await settledDockPose(page);
    expect(poseAfter.compact, 'the dock stayed tucked after the exit').toBe(false);
    expect(poseAfter.scale).toBe(1);
    const scaleAfter = await boardScale(page);
    expect(Math.abs(scaleAfter - scaleBefore), 'the overview fit did not return')
      .toBeLessThan(scaleBefore * 0.06);
    await page.waitForTimeout(1600); // the accent window closes
    await shoot(page, '05-after');
  });

  /**
   * THE HANDED-OVER PLACEMENT — the case the standard-project road cannot
   * reach. The projects sheet is a band OVER the board section, so the stage
   * is measurable the whole time; a card played out of the hand puts the shell
   * on the `hand` SECTION, which `v-show`s the board away — and the placement
   * that follows is HELD behind the played-hero and the outcome's reward
   * beats, so Planet Focus (which engages on the RAW prompt, by design) takes
   * a stage whose box is 0×0 and stays that way past its own settle.
   *
   * The fit is skipped there, and the board's return is the same box it left
   * with: without the FRAMING MODE in the fit key that return read as «already
   * fitted» and nothing ever fitted the focus. The player got the whole mode —
   * receded arcs, veil, compact dock — around a planet at OVERVIEW size.
   */
  test('a placement handed over from the HAND lands on the focused stage', async ({page, request}) => {
    test.setTimeout(360_000);

    await bootIntoGame(page, request, {
      config: HAND_CONFIG,
      cards: [HAND_CARD],
      corporation: 'Teractor',
    });

    const board = page.locator('.con-board');
    const scaleBefore = await boardScale(page);
    expect(scaleBefore, 'no overview fit ran').toBeGreaterThan(0);
    await shoot(page, '10-hand-board-home');

    // THE SCENARIO'S OWN WITNESS. The bug lives in one frame — «the mode is
    // engaged while the stage is 0×0» — and a run where the board happened to
    // come back early would assert the contract against a case that never
    // occurred. So watch for it, and demand below that it really happened.
    await page.evaluate(() => {
      const w = window as unknown as {__focusHidden: boolean};
      w.__focusHidden = false;
      const tick = () => {
        const el = document.querySelector('.con-board--pfocus, .con-board--pfocus-settled');
        const stage = document.querySelector('.con-board__stage');
        if (el !== null && stage !== null && stage.getBoundingClientRect().width < 40) {
          w.__focusHidden = true;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // ONE PRESS PER BEAT — deliberately NOT `playCardFromHand`, which presses
    // Enter five times over the composer. Those extra presses dismiss the play
    // outcome before the placement prompt lands, the board comes back inside
    // the enter transition, and the scenario above never happens.
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1600); // centre slot → the hand screen
    await page.locator(`.con-hand [data-zoom-slot="${HAND_CARD}"]`)
      .waitFor({timeout: 20_000});
    expect(await focusCard(page, HAND_CARD, 24), `never focused «${HAND_CARD}»`).toBeTruthy();
    await press(page, 'Enter', 1200); // open the play composer
    await press(page, 'Enter', 400); // confirm the play — and hands off

    // The placement takes the board back (`goBoardHome`) — the panel is the
    // structural proof that the prompt is being SERVED, not merely pending.
    // Case-insensitive on purpose: the kicker's capitals are `text-transform`,
    // so the DOM carries «Размещение тайла» and only `innerText` sees CAPS.
    const panel = page.locator('.con-context');
    await expect(panel, 'the placement never took the board').toContainText(
      /размещение тайла/i, {timeout: 60_000});

    // NON-VACUOUS: the mode really did take a hidden stage.
    expect(await page.evaluate(() => (window as unknown as {__focusHidden: boolean}).__focusHidden),
      'the board was never hidden while the focus was engaged — this run did not ' +
      'exercise the handed-over case (the outcome handed the board back too early)').toBe(true);

    // ENGAGED — and engaged is not a class, it is a GROWN planet. The bug this
    // guards left the class on and the scale at the overview value, which is
    // why both halves are asserted (the class alone passed the whole time).
    await expect(board).toHaveClass(/con-board--pfocus/);
    await expect.poll(() => boardScale(page), {
      message: 'the planet never grew for a placement handed over from the hand',
      timeout: 10_000,
    }).toBeGreaterThan(scaleBefore * 1.25);
    await shoot(page, '11-hand-placement-focus');
  });
});
