import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  cinematicBeat, openConsole, pickCards, press, pressUntil, pressUntilVisible, settle, waitForBoardHome, waitQueueIdle,
  walkToSummary, submitSummary,
} from './consoleStart';
import {armWitness, Witness} from './witness';

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
 * The probe RECORDS the whole arrival off the product's own writes
 * (`armWitness`, FLAKE ZERO — every state of tile visibility, the stage clip
 * and the fit scale, in the task that writes it, plus a frame tick for what
 * only a computed style moves) and asserts the two ways this family shipped
 * broken:
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

/** One recorded state of the arrival (the time is the record's own). */
type EntrySeen = {
  present: boolean,
  /** The colonies ROOT's identity (1, 2, … per element ever seen; 0 = none) — a remount is a new id. */
  rootId: number,
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
/** A recorded state with `t` in ms since the arm (the page's clock). */
type EntrySample = EntrySeen & {t: number};

type EntryWatch = {
  /** Distinct colonies roots that entered the document / left it while armed (element identity — a remount is both). */
  mounts: number,
  unmounts: number,
  samples: Array<EntrySample>,
};

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

/**
 * ARM the record of the arrival (`armWitness`): from here on every state the product writes is kept with the page's
 * time, re-installed in every new document (a reload by the product neither loses nor stops it). `settled`: the
 * verdicts are about what a FRAME can show — «never standalone-first», «never dark again once shown», «never absent»
 * — so each state is the one a task LEAVES, never one between two writes of a single task.
 */
async function armEntry(page: Page, key: string): Promise<Witness<EntrySeen>> {
  return armWitness<EntrySeen>(page, key, () => {
    // The root's IDENTITY (a WeakMap of every root ever seen): a remount under the player is a NEW element.
    const memo = window as unknown as {__colEntryIds?: WeakMap<Element, number>, __colEntryNext?: number};
    if (memo.__colEntryIds === undefined) {
      memo.__colEntryIds = new WeakMap<Element, number>();
    }
    const ids = memo.__colEntryIds;
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
    const root = document.querySelector<HTMLElement>('.con-colonies');
    if (root === null) {
      return {
        present: false, rootId: 0, rootOp: -1, rootVis: '',
        slots: 0, visSlots: 0, slot0: -1, browseOp: -1, clip: '', scale: '', embedded: false,
        stack: stackNow(),
      };
    }
    let rootId = ids.get(root);
    if (rootId === undefined) {
      rootId = (memo.__colEntryNext ?? 0) + 1;
      memo.__colEntryNext = rootId;
      ids.set(root, rootId);
    }
    const cs = getComputedStyle(root);
    const slots = Array.from(document.querySelectorAll<HTMLElement>('.con-colonies__slot'));
    const visible = (el: HTMLElement): boolean => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return Number(s.opacity || '1') > 0.5 && s.visibility !== 'hidden' && r.width > 4;
    };
    const browse = document.querySelector<HTMLElement>('.con-colonies__browse');
    const stage = document.querySelector<HTMLElement>('.con-colonies__stagewrap');
    return {
      present: true,
      rootId,
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
    };
  }, {settled: true, max: 20_000});
}

/** The grid reached its settled state: every tile visible at rest. */
const fullyShown = (x: EntrySeen): boolean => x.present && x.slots > 0 && x.visSlots === x.slots && x.slot0 >= 0.99;

/** Stop the record and read it as the trace the verdicts were written for (`t` in ms since the arm). */
async function collect(record: Witness<EntrySeen>): Promise<EntryWatch> {
  const recorded = await record.stop();
  const t0 = recorded[0]?.t ?? 0;
  const samples = recorded.map((s) => ({...s.v, t: s.t - t0}));
  let mounts = 0;
  let unmounts = 0;
  let prevId = 0;
  for (const s of samples) {
    if (s.rootId !== prevId) {
      mounts += s.rootId !== 0 ? 1 : 0;
      unmounts += prevId !== 0 ? 1 : 0;
      prevId = s.rootId;
    }
  }
  return {mounts, unmounts, samples};
}

/**
 * Digest the record into the guard's verdicts — over RECORDED STATES (each a
 * distinct state the product wrote), never over frames a sampler happened to
 * catch.
 *
 *  · `rampStates` — states of the ENTRY (from the first present one to the
 *    full show) where the root or the first tile is mid-fade: an entry that
 *    ANIMATES passes through a second such state after its hidden first one;
 *    an instant pop goes hidden → full with nothing between (an ORDER claim:
 *    hidden, then ramping, then full);
 *  · `fullShowAt` — the first state with every tile visible at rest;
 *  · `dipAfterFullShow` — a later state where the grid went dark again (the
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
    if (fullShowAt === -1 && fullyShown(x)) {
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
  const entry = first < 0 ? [] : s.slice(first, fullShowAt < 0 ? s.length : fullShowAt);
  const rampStates = entry.filter((x) => x.present &&
    ((x.rootOp >= 0 && x.rootOp < 0.98) || (x.slot0 >= 0 && x.slot0 < 0.98))).length;
  return {
    states: s.length,
    firstPresentAt: first,
    firstSample: s[first],
    fullShowAt,
    dipAfterFullShow,
    absentAfterPresent,
    rampStates,
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
    await openConsole(page, playerId);
    await walkToSummary(page);
    await submitSummary(page);
    await waitForBoardHome(page);
    await settle(page);

    const record = await armEntry(page, 'colony-entry-standalone');
    const colonies = page.locator('.con-colonies');
    for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
      await press(page, 'Period', 900);
      await pressUntil(page, 'ArrowRight', async () => await colonies.count() > 0, {tries: 1, settleMs: 1200});
    }
    await expect.poll(() => colonies.count(), {message: 'colonies opened from the wheel'}).toBeGreaterThan(0);
    // The record runs until the grid has fully SHOWN (the end of the entry, waited for — never a guessed window), then
    // through the window a replayed entry would fall into.
    await record.waitFor(fullyShown, {message: 'the grid reached its settled state'});
    await cinematicBeat(page, 2000, 'the window after the full show in which a replayed entry (the blink) would fall');
    const watch = await collect(record);
    const d = digest(watch);
    console.log('── standalone entry ──', JSON.stringify({...d, dipAfterFullShow: d.dipAfterFullShow ?? null}));

    // The entrance COMPOSES — never a pop. Keyed on the property rather than
    // on a frame COUNT: the phrase is ~300 ms, so a count threshold is really
    // an assertion about the sampler's frame rate on the runner.
    expect(d.firstSample?.slot0, 'the grid is hidden on its first painted frame').toBeLessThan(0.5);
    expect(d.fullShowAt, 'it takes more than one frame to reach full').toBeGreaterThan(d.firstPresentAt);
    expect(d.rampStates, 'the tiles ramp in').toBeGreaterThanOrEqual(2);
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
    await openConsole(page, playerId);
    await walkToSummary(page, {onStep: async (p, kind) => {
      if (kind === 'corporation') {
        const got = await pickCards(p, ['Poseidon']);
        expect(got, 'Poseidon offered and picked').toContain('Poseidon');
      }
    }});
    await submitSummary(page);
    // The deployment stands and takes presses (its cards standing, nothing in the air, the rail released) — the state
    // the old fixed pause stood for.
    await waitQueueIdle(page);

    const record = await armEntry(page, 'colony-entry-embedded');
    // The deployment: play the corp — its behavior defers the SelectColony,
    // which the start workspace hosts as a step. Act → verify (the colonies
    // stand) → retry only without it.
    const colonies = page.locator('.con-colonies');
    await pressUntilVisible(page, 'Enter', '.con-colonies', {tries: 10, settleMs: 1600});
    await expect.poll(() => colonies.count(), {message: 'colonies opened inside the start'}).toBeGreaterThan(0);
    // The record runs until the grid has fully SHOWN, then through the window the shipped replay fell into (~0.5 s
    // after the settle).
    await record.waitFor(fullyShown, {message: 'the grid reached its settled state'});
    await cinematicBeat(page, 2500, 'the window after the full show in which a replayed entry (the blink) would fall');
    const watch = await collect(record);
    const d = digest(watch);
    console.log('── embedded entry ──', JSON.stringify({...d, dipAfterFullShow: d.dipAfterFullShow ?? null}));

    // The step arrives INSIDE the start (the teleport chain), wearing the
    // embedded shell from its very first frame — never standalone-first.
    await expect.poll(() => page.locator('.con-start .con-colonies').count(), {message: 'embedded inside the start'})
      .toBeGreaterThan(0);
    expect(watch.samples.every((x) => !x.present || x.embedded), 'never renders standalone-first').toBeTruthy();
    // The room OPENS (the step's clip beat ran) and the tiles ramp in.
    expect(watch.samples.some((x) => x.present && x.clip !== '' && x.clip !== 'none' && !x.clip.startsWith('inset(0')),
      'the step entry opens its room by clip').toBeTruthy();
    expect(d.firstSample?.slot0, 'the grid is hidden on its first painted frame').toBeLessThan(0.5);
    expect(d.fullShowAt, 'it takes more than one frame to reach full').toBeGreaterThan(d.firstPresentAt);
    expect(d.rampStates, 'the tiles ramp in').toBeGreaterThanOrEqual(2);
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
