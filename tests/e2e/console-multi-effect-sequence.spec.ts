import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootWithCards, soloGameConfig, playCardFromHand, press,
} from './consoleStart';

/**
 * ONE PRESS, SEVERAL EFFECTS — the SEQUENCING guard for a card play's follow-up
 * step.
 *
 * A single play routinely produces several effects and the server sends them in
 * ONE response: «Научная колония» runs `drawCard: 2` synchronously in the
 * executor and DEFERS a `SelectColony`, so the drawn batch and the colony prompt
 * arrive together; «Шахтёрская колония» has no draw at all, so its colony prompt
 * arrives while the played-hero scene is still playing.
 *
 * The console used to hand the player the next surface immediately: the colony
 * grid stood up on the RAW prompt (`waitingFor.type === 'colony'` — the one
 * prompt-routed door that never asked `consolePromptAdmission`), so it appeared
 * under whatever the previous effect was still showing. And because both
 * teleport into the SAME zone, the grid was laid out as a flex SIBLING of it:
 * measured 521 px of a 1621 px band, tile fit solved for that box, then a jump
 * to full width when the other surface left — the two reports, one cause.
 *
 * What this spec pins:
 *  ① NO OVERLAP — no frame shows the colony GRID while a drawn-cards reveal is
 *    up. «Processed» for a draw means every card TAKEN; only then may the next
 *    surface open.
 *  ② THE DOOR WAS REALLY HELD — the prompt stood live with no surface for a
 *    stretch. Without this the spec would also pass on a game that happened to
 *    ask for the colony later, i.e. it would stop testing the gate.
 *  ③ ONE ARRIVAL, ONE GEOMETRY — once the grid paints it never re-lays out: one
 *    width, one `--coltile-scale`, never standalone first.
 *  ④ ONE FLOW — it arrives EMBEDDED in the hand workspace the play was made in
 *    (`hand ⊃ colonies`), under a crumb that stands still.
 *
 * The probe is `MutationObserver` + `setInterval`, never `requestAnimationFrame`:
 * headless Chromium drives rAF off the compositor, so a rAF sampler stops
 * sampling exactly when the screen goes quiet — which is when these bugs fire.
 * The spec asserts its own `samples` count, so a dead probe cannot pass.
 */

const OUT = path.resolve('screenshots', 'multi-effect-sequence');

type Sample = {
  t: number,
  /** A reveal overlay is PAINTED (the drawn batch owns the screen). */
  revealUp: boolean,
  /** Cards the reveal still offers (untaken slots) — diagnostics. */
  revealCards: number,
  /** The colony GRID is painted (root visible + at least one visible tile). */
  colonyGrid: boolean,
  /** The colony root's box, rounded — the «half the screen» witness. */
  colW: number,
  colH: number,
  colX: number,
  /** The fit engine's output. A change after the grid paints IS the re-lay-out. */
  scale: string,
  embedded: boolean,
  /** The play composer / landing tableau still occupies the step's zone. */
  composerUp: boolean,
  /** "hand(committed;slot)>colonies(committed;-)|tgt:…" */
  stack: string,
  wfType: string,
  /** The shell's own «this flow still owes a step» fact. */
  owedStep: boolean,
  /** The crumb's stage segment (the tail that must only ever move forward). */
  crumb: string,
};

type Watch = {armed: boolean, samples: Array<Sample>};

declare global {
  interface Window {
    __seqWatch?: Watch,
  }
}

async function installWatch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const watch: Watch = {armed: false, samples: []};
    window.__seqWatch = watch;
    const painted = (el: Element | null): boolean =>
      el !== null && (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
    const diag = (): {stack: string, wfType: string, owedStep: boolean} => {
      const fn = (window as unknown as {__conColonyDiag?: () => {
        stack?: Array<{kind: string, phase: string, slot: string}>,
        embedTarget?: string | null,
        wfType?: string | null,
        owedStep?: boolean,
      }}).__conColonyDiag;
      if (fn === undefined) {
        return {stack: '', wfType: '', owedStep: false};
      }
      try {
        const d = fn();
        const frames = (d.stack ?? [])
          .map((f) => `${f.kind}(${f.phase};${f.slot !== '' ? 'slot' : '-'})`).join('>');
        return {
          stack: `${frames}|tgt:${d.embedTarget ?? '-'}`,
          wfType: d.wfType ?? '',
          owedStep: d.owedStep === true,
        };
      } catch {
        return {stack: 'diag-error', wfType: '', owedStep: false};
      }
    };
    const sample = (): void => {
      const root = document.querySelector<HTMLElement>('.con-colonies');
      const slots = Array.from(document.querySelectorAll<HTMLElement>('.con-colonies__slot'));
      const visSlots = slots.filter((s) => painted(s) && s.getBoundingClientRect().width > 4).length;
      const rect = root !== null ? root.getBoundingClientRect() : undefined;
      // An untaken card is a reveal slot still ON the table: the taken ones
      // carry the surface's own `--taken` modifier.
      const untaken = document.querySelectorAll(
        '.con-reveal .con-cards__slot:not(.con-cards__slot--taken)').length;
      watch.samples.push({
        t: Math.round(performance.now()),
        revealUp: painted(document.querySelector('.con-reveal')),
        revealCards: untaken,
        colonyGrid: painted(root) && visSlots > 0,
        colW: rect !== undefined ? Math.round(rect.width) : -1,
        colH: rect !== undefined ? Math.round(rect.height) : -1,
        colX: rect !== undefined ? Math.round(rect.x) : -1,
        scale: root !== null ? getComputedStyle(root).getPropertyValue('--coltile-scale').trim() : '',
        embedded: root !== null && root.classList.contains('con-colonies--embedded'),
        composerUp: painted(document.querySelector('.con-composer--embed')),
        crumb: (document.querySelector('.con-wshead__step')?.textContent ?? '').trim(),
        ...diag(),
      });
      if (watch.samples.length > 4000) {
        watch.samples.shift();
      }
    };
    // A coarse clock keeps sampling through a QUIET screen (a rAF sampler would
    // not); the observer catches the frames where a surface actually swaps.
    setInterval(() => {
      if (watch.armed) {
        sample();
      }
    }, 50);
    const mo = new MutationObserver(() => {
      if (watch.armed) {
        sample();
      }
    });
    const observe = () => mo.observe(document.documentElement,
      {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style']});
    if (document.readyState === 'loading') {
      addEventListener('DOMContentLoaded', observe);
    } else {
      observe();
    }
  });
}

async function arm(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window.__seqWatch;
    if (w !== undefined) {
      w.armed = true;
      w.samples = [];
    }
  });
}

async function collect(page: Page): Promise<Watch> {
  return page.evaluate(() => {
    const w = window.__seqWatch as Watch;
    w.armed = false;
    return w;
  });
}

function digest(watch: Watch) {
  const s = watch.samples;
  const overlap = s.filter((x) => x.revealUp && x.colonyGrid);
  const firstGrid = s.findIndex((x) => x.colonyGrid);
  const gridSamples = firstGrid === -1 ? [] : s.slice(firstGrid).filter((x) => x.colonyGrid);
  return {
    samples: s.length,
    overlapFrames: overlap.length,
    firstOverlap: overlap[0],
    /** The prompt is live and its own surface is deliberately held. */
    owedFrames: s.filter((x) => x.owedStep).length,
    firstGridAt: firstGrid,
    firstGrid: gridSamples[0],
    lastGrid: gridSamples[gridSamples.length - 1],
    gridWidths: [...new Set(gridSamples.map((x) => x.colW))],
    gridScales: [...new Set(gridSamples.map((x) => x.scale))],
    gridCrumbs: [...new Set(gridSamples.map((x) => x.crumb))],
    standaloneFirst: gridSamples.length > 0 && !gridSamples[0].embedded,
    stacks: [...new Set(s.map((x) => x.stack))],
    crumbs: [...new Set(s.map((x) => x.crumb))].filter((c) => c !== ''),
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The colony-expansion solo game every case here starts from. */
function colonyGame() {
  return soloGameConfig({
    expansions: {colonies: true},
    // `customCorporationsList` does not NARROW a testMode deal (it deals eight)
    // — it only guarantees the corporation is IN it. Teractor: 60 M€, no
    // mandatory first action, and no tag the subject cards trigger.
    customCorporationsList: ['Teractor', 'Saturn Systems'],
    // A fixed tile set → a stable grid shape to measure.
    customColoniesList: ['Luna', 'Triton', 'Callisto', 'Ceres'],
  });
}

/**
 * Play `card` from hand and record the whole episode: the effect it produced,
 * the take, and the colony step arriving.
 */
async function playAndTrace(page: Page, card: string) {
  await arm(page);
  const played = await playCardFromHand(page, card);
  expect(played, `${card} must be played from hand`).toBeTruthy();
  await page.waitForTimeout(2500);
  await shoot(page, `${card}-1-after-play`);

  // Take whatever the play produced, one press at a time, and let the colonies
  // arrive on their own.
  const reveal = page.locator('.con-reveal');
  for (let i = 0; i < 8 && await reveal.count() > 0; i++) {
    await press(page, 'Enter', 1200);
  }
  await shoot(page, `${card}-2-after-take`);
  await page.locator('.con-colonies').waitFor({timeout: 30_000}).catch(() => {});
  await page.waitForTimeout(2500);
  await shoot(page, `${card}-3-colonies`);

  const d = digest(await collect(page));
  console.log(`── ${card} ──`, JSON.stringify({...d, firstOverlap: d.firstOverlap ?? null}, null, 1));
  return d;
}

/** ③ + ④ — the claims both cases share. */
function expectOneArrivalInsideTheHand(d: ReturnType<typeof digest>) {
  expect(d.samples, 'the probe sampled the episode').toBeGreaterThan(50);
  expect(d.firstGridAt, 'the colony grid was reached').toBeGreaterThan(-1);
  // ③ ONE ARRIVAL, ONE GEOMETRY — the «half the screen, crooked, then the whole
  // workspace» report, as two numbers.
  expect(d.gridWidths.length,
    `the colony surface changed width after painting: ${d.gridWidths.join(' → ')}`).toBe(1);
  expect(d.gridScales.length,
    `the tile fit re-solved after painting: ${d.gridScales.join(' → ')}`).toBe(1);
  // ④ ONE FLOW — embedded from its first painted frame, under a crumb that
  // stands still (locale-free: the VALUE must not change while the step stands.
  // It used to fall back to «… › РОЗЫГРЫШ» the moment the grid opened — the tail
  // naming a stage one screen up).
  expect(d.standaloneFirst, 'the colonies must never paint standalone first').toBeFalsy();
  expect(d.gridCrumbs.length,
    `the crumb moved while the colony step stood: ${d.gridCrumbs.join(' → ')}`).toBe(1);
}

test.use({viewport: {width: 1920, height: 1080}});

test.describe('one press, several effects', () => {
  /**
   * THE REPORT. «Научная колония»: draw 2 + build a colony, one response. The
   * grid stood under the drawn batch, cropped to the leftover band.
   */
  test('a draw AND a colony: the batch is taken BEFORE the grid opens', async ({page, request}) => {
    test.setTimeout(420_000);
    await installWatch(page);
    await bootWithCards(page, request, {
      cards: ['Research Colony'],
      corporation: 'Teractor',
      config: colonyGame(),
    });

    const d = await playAndTrace(page, 'Research Colony');

    // ① ONE SURFACE AT A TIME.
    expect(d.overlapFrames,
      `the colony grid stood under a live drawn-cards reveal: ${JSON.stringify(d.firstOverlap)}`).toBe(0);
    // ② …and the two effects really did arrive TOGETHER: the colony prompt stood
    // live, with no surface of its own, for the length of the batch.
    expect(d.owedFrames, 'the colony step was held while the batch was worked through').toBeGreaterThan(3);
    expectOneArrivalInsideTheHand(d);
    expect(await page.locator('.con-hand .con-colonies').count(),
      `the colonies must stand INSIDE the hand workspace — stacks seen: ${d.stacks.join(' | ')}`)
      .toBeGreaterThan(0);
  });

  /**
   * THE SAME DEFECT WITHOUT A DRAW. «Шахтёрская колония» raises titanium
   * production and builds a colony, so the prompt arrives while the PLAYED-HERO
   * scene is still playing — the grid used to open into the zone the landing
   * tableau was occupying, which is the other half of the «half the screen»
   * report.
   */
  test('a colony after a plain effect: the grid opens into a FREE zone', async ({page, request}) => {
    test.setTimeout(420_000);
    await installWatch(page);
    await bootWithCards(page, request, {
      cards: ['Mining Colony'],
      corporation: 'Teractor',
      config: colonyGame(),
    });

    const d = await playAndTrace(page, 'Mining Colony');

    // The hero scene held the door — the step waited for the play to finish
    // being shown, exactly as it waits for a batch to be taken.
    expect(d.owedFrames, 'the colony step was held while the play was shown').toBeGreaterThan(3);
    expectOneArrivalInsideTheHand(d);
    expect(await page.locator('.con-hand .con-colonies').count(),
      `the colonies must stand INSIDE the hand workspace — stacks seen: ${d.stacks.join(' | ')}`)
      .toBeGreaterThan(0);
  });
});
