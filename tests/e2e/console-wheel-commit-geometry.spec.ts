/*
 * THE ACTION WHEEL'S COMMIT GEOMETRY — the cross may not MOVE on the press.
 *
 * The wheel is a band surface: its four insets ARE the central opening's live
 * geometry (`--con-stage-*` + the shell's `.con-root--rail-replaced` policy).
 * And the very press that dismisses it opens the workspace that TAKES the
 * strategy rail's zone — a sheet screen raises the policy class, a section
 * workspace `v-show`s the rail away so the geometry mirror measures 0×0. Both
 * land in the SAME Vue flush as the wheel's leave, so a wheel that still reads
 * those tokens re-centres in the now-wider opening and slides half a rail
 * sideways on the first painted frame of its own recession.
 *
 * ONE FRAME. That is the whole reason this is a numeric probe and not a
 * screenshot: at 60fps the shift is 16ms of a 180ms exit and the eye reads it
 * as a twitch, not as a position. The assertion is therefore the LAYOUT itself
 * — `.con-quick`'s box, sampled every 8ms from the commit press until the
 * element leaves the DOM, must have exactly ONE distinct value.
 *
 * Every destination the wheel can reach is walked, because the two mechanisms
 * are different (policy class vs. a `v-show`n rail) and a fix for one is not a
 * fix for the other; the pass CONFIRMATION is walked as the control — it is a
 * dialog, the rail stays lit, and nothing may move there either.
 *
 * ⚠ setInterval, never rAF: headless Chromium starves rAF exactly on the quiet
 * frames a probe like this exists to watch (a layout read needs no compositor
 * frame — `getBoundingClientRect` flushes style itself), and the waits pump a
 * tiny screenshot so the app's own GSAP exit actually advances.
 */
import {test, expect, Page} from '@playwright/test';
import {bootSeededGame, createGameWithCards, soloGameConfig} from './consoleStart';

type WheelSample = {
  t: number,
  /** Was `.con-quick` in the DOM at this sample? */
  present: boolean,
  /** `.con-quick`'s viewport box — the LAYOUT truth (the panel's own GSAP
   *  transform is authored motion and identical either way). '-' when gone. */
  box: string,
  /** Is the shell's rail-replacement policy up at this sample? */
  replaced: boolean,
  /** The measured right inset of the central opening (0px = the rail is gone). */
  stageR: string,
};

type WheelProbe = {
  samples: Array<WheelSample>,
  /** The box the cross had at the moment of the press — the reference. */
  before: string,
};

declare global {
  var __wheelGeom: {
    state: WheelProbe,
    stop: () => void,
    arm: () => void,
  } | undefined;
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

/** A real BeginFrame — headless starves the app's rAF on a quiet screen. */
async function forceFrame(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
}

/**
 * The sampler.
 *
 * TWO SOURCES, deliberately: a `setInterval` for the steady beat, and a
 * `MutationObserver` because the beat alone is not enough here. Opening a
 * workspace is a heavy synchronous flush, and a blocked main thread starves
 * timers exactly across the frames this probe exists to watch (measured: two
 * samples for a whole card-actions commit). The observer fires as a microtask
 * ON the mutation that moves the edge — the shell's `.con-root` class flip and
 * the rail's own `style` change — so the frame where the box COULD move is
 * sampled by construction, whatever the thread is doing. rAF is not used at
 * all: headless Chromium drives it off the compositor, and a layout read needs
 * no frame anyway (`getBoundingClientRect` flushes style itself).
 */
async function installProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state: WheelProbe = {samples: [], before: '-'};
    const t0 = performance.now();
    const boxOf = (): string => {
      const el = document.querySelector<HTMLElement>('.con-quick');
      if (el === null) {
        return '-';
      }
      const b = el.getBoundingClientRect();
      return `${b.left.toFixed(1)}|${b.right.toFixed(1)}|${b.top.toFixed(1)}|${b.bottom.toFixed(1)}`;
    };
    const scan = (): void => {
      const box = boxOf();
      state.samples.push({
        t: Math.round(performance.now() - t0),
        present: box !== '-',
        box,
        replaced: document.querySelector('.con-root')?.classList.contains('con-root--rail-replaced') === true,
        stageR: document.documentElement.style.getPropertyValue('--con-stage-r'),
      });
    };
    const timer = window.setInterval(scan, 8);
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {attributes: true, childList: true, subtree: true});
    globalThis.__wheelGeom = {
      state,
      stop: () => {
        window.clearInterval(timer);
        observer.disconnect();
      },
      arm: () => {
        state.samples.splice(0);
        state.before = boxOf();
      },
    };
  });
}

/** Take the reference box and clear the window — called just before the press. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => globalThis.__wheelGeom?.arm());
}

async function readProbe(page: Page): Promise<WheelProbe> {
  return page.evaluate(() => globalThis.__wheelGeom?.state ?? {samples: [], before: '-'});
}

/** Pump frames until `check` holds (or the budget runs out). */
async function waitWithFrames(page: Page, check: () => Promise<boolean>, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await check()) {
      return true;
    }
    await forceFrame(page);
    await page.waitForTimeout(60);
  }
  return check();
}

/** Back to the calm board home — the one place a wheel can be opened. */
async function toBoard(page: Page): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const open = await page.locator(
      '.con-quick, .con-stdp, .con-ma, .con-cardactions, .con-composer, .con-sheet, ' +
      '.con-hand, .con-colonies, .con-hydro, .con-played, .con-journal, .con-confirm').count();
    if (open === 0) {
      return;
    }
    await page.keyboard.press('Escape');
    await forceFrame(page);
    await page.waitForTimeout(450);
  }
}

/** Open a wheel — never a second press while it is already up (the trigger
 *  TOGGLES, which is how a retry used to fight itself). */
async function openWheel(page: Page, trigger: string): Promise<boolean> {
  for (let tries = 0; tries < 5; tries++) {
    if (await page.locator('.con-quick').count() > 0) {
      return true;
    }
    await page.keyboard.press(trigger);
    await forceFrame(page);
    await page.waitForTimeout(500);
  }
  return page.locator('.con-quick').count().then((n) => n > 0);
}

type WheelCase = {
  label: string,
  /** The trigger that opens the wheel this slot lives on. */
  trigger: 'Period' | 'Comma',
  /** The key that arms + commits the slot (press → release). */
  slot: string,
  /** The surface the commit must actually reach — proof the case ran. */
  surface: string,
  /**
   * Does this destination TAKE the strategy rail's zone? Every workspace does
   * (that is the regression); the pass confirmation is the dialog control, and
   * asserting the difference keeps a silently-inert case from passing green.
   */
  replaces: boolean,
};

const CASES: ReadonlyArray<WheelCase> = [
  // RT — the four action categories. `cards` / `trading` / `hydro` are SECTION
  // workspaces (the rail is `v-show`n away → the mirror publishes 0);
  // `cardActions` is a sheet frame (the policy class alone).
  {label: 'RT · Карты в руке', trigger: 'Period', slot: 'Enter', surface: '.con-hand', replaces: true},
  {label: 'RT · Действия карт', trigger: 'Period', slot: 'ArrowUp', surface: '.con-cardactions', replaces: true},
  {label: 'RT · Колонии', trigger: 'Period', slot: 'ArrowRight', surface: '.con-colonies', replaces: true},
  {label: 'RT · Гидросеть', trigger: 'Period', slot: 'ArrowLeft', surface: '.con-hydro', replaces: true},
  // LT — the standard-projects SCREEN (a frame that welds to the physical
  // edge), and the pass CONFIRMATION as the dialog control.
  {label: 'LT · Стандартные проекты', trigger: 'Comma', slot: 'Enter', surface: '.con-stdp', replaces: true},
  {label: 'LT · Пас (диалог)', trigger: 'Comma', slot: 'ArrowDown', surface: '.con-confirm', replaces: false},
];

for (const profile of PROFILES) {
  test.describe(`console wheel commit geometry · ${profile.tag}`, () => {
    test.describe.configure({mode: 'serial'});
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('the cross keeps its box from the press to the last frame it paints', async ({page, request}) => {
      test.setTimeout(420_000);

      const config = soloGameConfig({expansions: {colonies: true, deltaProject: true}});
      const playerId = await createGameWithCards(request, [], {config});
      await bootSeededGame(page, request, playerId, {buy: 2, query: profile.query});
      await toBoard(page);
      expect(await page.locator('.con-board').count(), 'never reached the board home').toBeGreaterThan(0);

      await installProbe(page);
      let walked = 0;

      for (const c of CASES) {
        await toBoard(page);
        if (!await openWheel(page, c.trigger)) {
          continue; // the wheel never came up in this seed — never faked
        }
        // The open's own choreography must be over before the box is claimed
        // stable: a still-arriving surface is not what this probe is about.
        await forceFrame(page);
        await page.waitForTimeout(600);
        await armProbe(page);

        await page.keyboard.press(c.slot);
        // …and hold the samples until the wheel has actually left the DOM.
        await waitWithFrames(page, async () => (await page.locator('.con-quick').count()) === 0, 6_000);

        const {samples, before} = await readProbe(page);
        const alive = samples.filter((s) => s.present);
        if (before === '-' || await page.locator(c.surface).count() === 0) {
          // The slot refused (unavailable in this seed) or the destination
          // never opened — say so instead of passing an inert case.
          expect(before, `${c.label}: the wheel was already gone at the press`).not.toBe('-');
          continue;
        }
        walked++;

        // A dead probe passes every assertion — so assert it was ALIVE, and
        // that it saw the frames that matter: the cross still in the DOM AFTER
        // the opening's right edge moved. That sample is the whole test.
        expect(samples.length, `${c.label}: the probe never sampled`).toBeGreaterThan(2);
        if (c.replaces) {
          expect(alive.some((s) => s.replaced || s.stageR === '0px'),
            `${c.label}: no frame with the wheel alive past the rail's departure — inert case ` +
            `(${JSON.stringify(samples.slice(0, 10))})`).toBeTruthy();
        } else {
          expect(alive.length, `${c.label}: the wheel left without a sampled frame`).toBeGreaterThan(0);
        }

        // ── THE VERDICT ──────────────────────────────────────────────────
        const boxes = [...new Set([before, ...alive.map((s) => s.box)])];
        // The evidence, printed: how many frames the cross was watched for and
        // in which box (a passing geometry probe is otherwise invisible).
        console.log(`  ${profile.tag} · ${c.label}: ${alive.length}/${samples.length} live samples, box ${before}, boxes ${boxes.length}`);
        expect(boxes, `${c.label}: the wheel moved after the press — ${JSON.stringify(samples.slice(0, 10))}`)
          .toHaveLength(1);
      }

      await page.evaluate(() => globalThis.__wheelGeom?.stop());
      expect(walked, 'no wheel destination was reachable in this walk').toBeGreaterThanOrEqual(4);
    });
  });
}
