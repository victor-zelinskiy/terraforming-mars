import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  openConsole, pickCards, press, waitForBoardHome, walkToSummary, submitSummary,
} from './consoleStart';

/**
 * THE COLONY WORKSPACE ENTRY — the no-blink / premium-arrival guard.
 *
 * Two doors into the colonies GRID (the overview, not the focus descend),
 * both speaking ONE entry phrase (`colonyEntryCascade` — islands surface in
 * reading order, planets arrive a beat later, the rail seats last):
 *   A. the quick wheel's «Торговля» → the STANDALONE workspace (the
 *      surface-motion 'section' entrance + the shared cascade);
 *   B. a game-start SelectColony (solo setup removal / Poseidon's build) →
 *      the workspace EMBEDDED as a step of the start flow (`start ⊃
 *      colonies`, `playColonyStepEntry`).
 *
 * The probe records the whole arrival from inside the page — a per-frame
 * trace of tile visibility, the stage clip and the fit scale — and asserts
 * the two ways this family shipped broken:
 *   · the STANDALONE door arrived as a bare panel fade («колонии просто
 *     появляются») — the director's colony cascade was guarded by
 *     `el.querySelector('.con-colonies')`, which never matches the root
 *     itself, so the branch was silently dead → the entry must visibly RAMP;
 *   · the EMBEDDED door played its entry TWICE («колонии мигают» at game
 *     start) — the played-hero 'closing' beat `goBoardHome()`-truncated the
 *     prompt-anchored colonies frame (its guard knew only the hand host, not
 *     the start), the stranded self-heal re-pushed it, and the section
 *     remounted → after the grid is fully shown it must NEVER dip back out.
 */

const OUT = path.resolve('screenshots', 'colony-entry-probe');

type EntrySample = {
  t: number,
  present: boolean,
  rootOp: number,
  rootVis: string,
  slots: number,
  visSlots: number,
  slot0: number,
  browseOp: number,
  clip: string,
  scale: string,
  embedded: boolean,
  /** The workspace stack, compact: "start(committed;slot)>colonies(committed;-)". */
  stack?: string,
};

type EntryWatch = {
  armed: boolean,
  mounts: number,
  unmounts: number,
  samples: Array<EntrySample>,
};

declare global {
  interface Window {
    __colEntry?: EntryWatch,
  }
}

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    players: [{name: 'Entry', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: true,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.31, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false,
    customCorporationsList: ['CrediCor', 'Teractor'],
    bannedCards: [], includedCards: [],
    // Exactly four colony tiles → no solo setup-removal picks in the way.
    customColoniesList: ['Luna', 'Triton', 'Callisto', 'Ceres'],
    customPreludes: [],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
    startingCeos: 3, startingPreludes: 4,
    ...overrides,
  };
}

async function createGame(request: APIRequestContext, config: Record<string, unknown>): Promise<string> {
  const created = await request.post('/api/creategame', {data: config});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  return model.players[0].id;
}

/** Install the watcher before any app code runs (survives navigation). */
async function installWatch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const watch: EntryWatch = {armed: false, mounts: 0, unmounts: 0, samples: []};
    window.__colEntry = watch;
    const holdsColonies = (n: Node): boolean =>
      n instanceof HTMLElement &&
      (n.classList.contains('con-colonies') || n.querySelector?.('.con-colonies') !== null);
    const mo = new MutationObserver((muts) => {
      if (!watch.armed) {
        return;
      }
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (holdsColonies(n)) {
            watch.mounts++;
          }
        });
        m.removedNodes.forEach((n) => {
          if (holdsColonies(n)) {
            watch.unmounts++;
          }
        });
      }
    });
    const startObserving = () => mo.observe(document.documentElement, {childList: true, subtree: true});
    if (document.readyState === 'loading') {
      addEventListener('DOMContentLoaded', startObserving);
    } else {
      startObserving();
    }
    const stackNow = (): string => {
      const diagFn = (window as unknown as {__conColonyDiag?: () => {
        stack?: Array<{kind: string, phase: string, slot: string}>,
        embedTarget?: string | null,
      }}).__conColonyDiag;
      if (diagFn === undefined) {
        return '';
      }
      try {
        const d = diagFn();
        const frames = (d.stack ?? [])
          .map((f) => `${f.kind}(${f.phase};${f.slot !== '' ? 'slot' : '-'})`)
          .join('>');
        return `${frames}|tgt:${d.embedTarget ?? '-'}`;
      } catch {
        return 'diag-error';
      }
    };
    const tick = () => {
      if (watch.armed) {
        const root = document.querySelector<HTMLElement>('.con-colonies');
        if (root === null) {
          watch.samples.push({
            t: Math.round(performance.now()), present: false, rootOp: -1, rootVis: '',
            slots: 0, visSlots: 0, slot0: -1, browseOp: -1, clip: '', scale: '', embedded: false,
            stack: stackNow(),
          });
        } else {
          const cs = getComputedStyle(root);
          const slots = Array.from(document.querySelectorAll<HTMLElement>('.con-colonies__slot'));
          const visible = (el: HTMLElement): boolean => {
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return Number(s.opacity || '1') > 0.5 && s.visibility !== 'hidden' && r.width > 4;
          };
          const browse = document.querySelector<HTMLElement>('.con-colonies__browse');
          const stage = document.querySelector<HTMLElement>('.con-colonies__stagewrap');
          watch.samples.push({
            t: Math.round(performance.now()),
            present: true,
            rootOp: Number(cs.opacity || '1'),
            rootVis: cs.visibility,
            slots: slots.length,
            visSlots: slots.filter(visible).length,
            slot0: slots[0] !== undefined ? Number(getComputedStyle(slots[0]).opacity || '1') : -1,
            browseOp: browse !== null ? Number(getComputedStyle(browse).opacity || '1') : -1,
            clip: stage !== null ? (getComputedStyle(stage).clipPath || 'none') : '',
            scale: cs.getPropertyValue('--coltile-scale').trim(),
            embedded: root.classList.contains('con-colonies--embedded'),
            stack: stackNow(),
          });
        }
        if (watch.samples.length > 6000) {
          watch.samples.shift();
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function arm(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window.__colEntry;
    if (w !== undefined) {
      w.armed = true;
      w.mounts = 0;
      w.unmounts = 0;
      w.samples = [];
    }
  });
}

async function collect(page: Page): Promise<EntryWatch> {
  return page.evaluate(() => {
    const w = window.__colEntry as EntryWatch;
    w.armed = false;
    return w;
  });
}

/**
 * Digest the trace into the guard's verdicts.
 *
 *  · `rampFrames` — frames where the root or the first tile is mid-fade: the
 *    entry ANIMATES (an instant pop has none);
 *  · `fullShowAt` — the first frame with every tile visible at rest;
 *  · `dipAfterFullShow` — a later frame where the grid went dark again (the
 *    replayed-entry blink: the exact shipped bug);
 *  · `absentAfterPresent` — the section left the DOM inside the window (a
 *    remount under the player);
 *  · `scaleChanges` — the fit re-solving mid-entrance (tiles resizing under
 *    the opening).
 */
function digest(watch: EntryWatch) {
  const s = watch.samples;
  const first = s.findIndex((x) => x.present);
  const scaleChanges: Array<string> = [];
  let lastScale = '';
  let fullShowAt = -1;
  let dipAfterFullShow: EntrySample | undefined;
  let absentAfterPresent = 0;
  for (let i = Math.max(0, first); i >= 0 && i < s.length; i++) {
    const x = s[i];
    if (!x.present) {
      absentAfterPresent++;
      continue;
    }
    if (fullShowAt === -1 && x.slots > 0 && x.visSlots === x.slots && x.slot0 >= 0.99) {
      fullShowAt = i;
    }
    if (fullShowAt !== -1 && i > fullShowAt && dipAfterFullShow === undefined &&
        (x.visSlots === 0 || (x.slot0 >= 0 && x.slot0 < 0.5))) {
      dipAfterFullShow = x;
    }
    if (x.scale !== '' && x.scale !== lastScale) {
      if (lastScale !== '') {
        scaleChanges.push(`${lastScale}→${x.scale}@${x.t}`);
      }
      lastScale = x.scale;
    }
  }
  const rampFrames = s.filter((x) => x.present &&
    ((x.rootOp >= 0 && x.rootOp < 0.98) || (x.slot0 >= 0 && x.slot0 < 0.98))).length;
  return {
    frames: s.length,
    firstPresentAt: first,
    firstSample: s[first],
    fullShowAt,
    dipAfterFullShow,
    absentAfterPresent,
    rampFrames,
    scaleChanges,
    mounts: watch.mounts,
    unmounts: watch.unmounts,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

test.describe('colony workspace entry probe', () => {
  test('A · standalone: the wheel «Торговля» door', async ({page, request}) => {
    test.setTimeout(300_000);
    const playerId = await createGame(request, baseConfig());
    await installWatch(page);
    await openConsole(page, playerId);
    await walkToSummary(page);
    await submitSummary(page);
    await waitForBoardHome(page);
    await page.waitForTimeout(800);

    await arm(page);
    const colonies = page.locator('.con-colonies');
    for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
      await press(page, 'Period', 900);
      await press(page, 'ArrowRight', 1200);
    }
    expect(await colonies.count(), 'colonies opened from the wheel').toBeGreaterThan(0);
    await page.waitForTimeout(2500);
    const watch = await collect(page);
    const d = digest(watch);
    console.log('── standalone entry ──', JSON.stringify({...d, dipAfterFullShow: d.dipAfterFullShow ?? null}));

    // The entrance ANIMATES — a bare v-if pop / dead cascade has no ramp.
    expect(d.rampFrames, 'the standalone entry must visibly compose (tiles ramp in)').toBeGreaterThanOrEqual(3);
    // ONE arrival: the grid never leaves or goes dark once fully shown.
    expect(d.fullShowAt, 'the grid reached its settled state').toBeGreaterThan(-1);
    expect(d.dipAfterFullShow, `the grid dipped out after settling (the replayed-entry blink): ${JSON.stringify(d.dipAfterFullShow)}`).toBeUndefined();
    expect(d.absentAfterPresent, 'the section must not remount during the arrival').toBe(0);
    // The fit is solved BEFORE the first frame — nothing resizes under the opening.
    expect(d.scaleChanges, `tiles resized mid-entrance: ${d.scaleChanges.join(', ')}`).toHaveLength(0);
    await shoot(page, 'A-standalone-settled');
  });

  test('B · embedded at game start: Poseidon build colony', async ({page, request}) => {
    test.setTimeout(300_000);
    const playerId = await createGame(request, baseConfig({
      customCorporationsList: ['Poseidon', 'CrediCor'],
    }));
    await installWatch(page);
    await openConsole(page, playerId);
    await walkToSummary(page, {onStep: async (p, kind) => {
      if (kind === 'corporation') {
        const got = await pickCards(p, ['Poseidon']);
        expect(got, 'Poseidon offered and picked').toContain('Poseidon');
      }
    }});
    await submitSummary(page);
    await page.waitForTimeout(1000);

    await arm(page);
    // The deployment: play the corp — its behavior defers the SelectColony,
    // which the start workspace hosts as a step.
    const colonies = page.locator('.con-colonies');
    for (let i = 0; i < 10 && await colonies.count() === 0; i++) {
      await press(page, 'Enter', 1600);
    }
    expect(await colonies.count(), 'colonies opened inside the start').toBeGreaterThan(0);
    await page.waitForTimeout(3000);
    const watch = await collect(page);
    const d = digest(watch);
    console.log('── embedded entry ──', JSON.stringify({...d, dipAfterFullShow: d.dipAfterFullShow ?? null}));

    // The step arrives INSIDE the start (the teleport chain), wearing the
    // embedded shell from its very first frame — never standalone-first.
    expect((await page.locator('.con-start .con-colonies').count()), 'embedded inside the start').toBeGreaterThan(0);
    expect(watch.samples.every((x) => !x.present || x.embedded), 'never renders standalone-first').toBeTruthy();
    // The room OPENS (the step's clip beat ran) and the tiles ramp in.
    expect(watch.samples.some((x) => x.present && x.clip !== '' && x.clip !== 'none' && !x.clip.startsWith('inset(0')),
      'the step entry opens its room by clip').toBeTruthy();
    expect(d.rampFrames, 'the embedded entry must visibly compose (tiles ramp in)').toBeGreaterThanOrEqual(3);
    // ONE arrival — the shipped bug was this exact dip: the played-hero
    // closing beat truncated the prompt frame, the self-heal re-pushed it,
    // and the whole entry replayed ~0.5 s after it had settled.
    expect(d.fullShowAt, 'the grid reached its settled state').toBeGreaterThan(-1);
    expect(d.dipAfterFullShow, `the grid dipped out after settling (the replayed-entry blink): ${JSON.stringify(d.dipAfterFullShow)}`).toBeUndefined();
    expect(d.absentAfterPresent, 'the section must not remount during the arrival').toBe(0);
    expect(d.scaleChanges, `tiles resized mid-entrance: ${d.scaleChanges.join(', ')}`).toHaveLength(0);
    await shoot(page, 'B-embedded-settled');
  });
});
