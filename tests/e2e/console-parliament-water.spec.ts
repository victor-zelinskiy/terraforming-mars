import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, closeZoomViewer, commitFocusedSpace, crumbText, fetchPlayerModel, focusCard, openConsole, openMandatoryAnnounce, openZoomViewer,
  placementState, press, pressUntil, settle, walkToSpace,
} from './consoleStart';
import {answerGateAs, armLeakWitness, mandatoryPlate, parliament, parliamentWire, sittingStage, strandedReports, waitSittingAtRest} from './parliamentDrive';

/**
 * WATER EXPORT (Turmoil Redux, RX33) — the ONE e2e of the new mechanic: a WORLD
 * step that ASKS, and a tile that LEAVES the board with a visible frame. Two
 * moments of one journey, on one profile (the owner's budget — one e2e per new
 * mechanic):
 *
 *   PART 1 · THE SITTING (fixture `parliament-water-assembly`, TWO clients): the
 *   vote panel reads THREE blocks — the seat's M€, the TABLE's part outside «для
 *   вас» («первый игрок снимает 1 тайл океана»), the standing discount; the
 *   inspector states the world part in the board's numbers («Океаны: 1 → 0»).
 *   A answers gate 1, red answers over the API. The seats are paid; then the
 *   FIRST PLAYER (blue — the viewer) gets the OCEAN PICK as a step of the sitting
 *   (a placement door, «К полю»), the dossier on the ocean says out loud what the
 *   removal does, and the pick is still asked with ONE candidate. The commit
 *   REMOVES the tile: on BOTH clients the ocean LIFTS OFF its cell (a departure
 *   proxy over the cell, the cell painting the water until the lift, then the
 *   bare hex) — never a silent pop-out; the HUD's ocean count falls 1 → 0; the
 *   sitting comes back and the results carry the PLANET line with the ocean step.
 *
 *   PART 2 · THE DISCOUNT (fixture `parliament-water-enacted`): the law stands,
 *   the viewer holds «Miranda Resort» (printed 12, a Jovian tag); the play
 *   composer's payment head reads «12 → 9» with «−3».
 *
 * Screens under screenshots/parliament-water/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-water');
const PRESET = {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'} as const;
const WATER_ID = 'RDX_REDS_WATER_EXPORT';
const JOVIAN_CARD = 'Miranda Resort';
/** TileType.OCEAN (`common/TileType`). */
const OCEAN = 1; // TileType.OCEAN (GREENERY=0, OCEAN=1, CITY=2)

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  await page.screenshot({path: path.join(OUT_ROOT, `${name}.png`)});
}

type Outcome = {player?: string, step: string, part?: string, kind: string, amount?: number, space?: string, actor?: string,
  parameter?: {id: string, before: number, after: number}};
type Wire = {
  thisPlayer: {color: string, megacredits: number, terraformRating: number},
  cardsInHand?: Array<{name: string, calculatedCost?: number}>,
  game: {
    oceans: number,
    spaces: Array<{id: string, tileType?: number}>,
    parliament?: {phase?: {step: string, pending?: {player: string, key: string, input?: string}, outcomes?: Array<Outcome>}, lastPhase?: {outcomes?: Array<Outcome>}},
  },
  waitingFor?: {type?: string, spaces?: Array<string>, placementType?: string, placementEffect?: string, placementContext?: {source?: {kind: string, resolution?: string}}},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

/**
 * THE PROBE — armed on BOTH clients. A `setInterval` sampler (never rAF — a
 * quiet screen stops the compositor exactly when this beat plays) that reads,
 * every tick: whether the sitting's frame is on screen, whether a DEPARTURE
 * proxy stands on the tile stage, whether the chosen cell still paints the
 * ocean art, and what the HUD's ocean readout SAYS.
 */
type Sample = {t: number, wall: number, parl: boolean, depart: boolean, cellOcean: boolean, oceans: string, board: boolean, holds: string, sit: string};
type Probe = {samples: Array<Sample>};

async function armProbe(page: Page, spaceId: string): Promise<void> {
  await page.evaluate((id) => {
    const w = window as unknown as {__waterProbe?: Probe};
    const probe: Probe = {samples: []};
    w.__waterProbe = probe;
    const oceanText = (): string => {
      const host = Array.from(document.querySelectorAll('.con-status__param'))
        .find((el) => el.querySelector('.wgt-icon--ocean') !== null);
      return (host?.querySelector('.con-status__value')?.textContent ?? '').trim();
    };
    const take = (): void => {
      const cell = document.querySelector<HTMLElement>(`.board-space[data_space_id="${id}"] [data-test="tile"]`);
      const board = document.querySelector<HTMLElement>('.board-cont');
      const ready = (window as unknown as {__conReady?: () => {holds?: Array<string>, wsDepth?: number, wsYielded?: boolean}}).__conReady?.();
      probe.samples.push({
        t: Math.round(performance.now()),
        wall: Date.now(),
        parl: document.querySelector('.con-parl') !== null,
        depart: document.querySelector('.con-tileplace__tile--depart') !== null,
        cellOcean: cell !== null && /board-space-tile--ocean(\s|$)/.test(cell.className),
        oceans: oceanText(),
        // Diagnostics for a red run: is the BOARD on screen, and which named holds stand.
        board: board !== null && board.getBoundingClientRect().width > 0 && getComputedStyle(board).visibility !== 'hidden',
        holds: (ready?.holds ?? []).filter((h) => /tile|board|parliament|placement/.test(h)).join('|'),
        sit: (() => {
          const root = document.querySelector<HTMLElement>('.con-parl');
          const tail = document.querySelector<HTMLElement>('.con-wshead__step, .con-wshead [data-stage]')?.textContent?.trim() ?? '';
          return root === null ? '' : `pg=${root.dataset.sittingPage ?? '-'} mo=${root.dataset.sittingMotion ?? '-'} bt=${root.dataset.sittingBeat ?? '-'} d=${ready?.wsDepth ?? '?'} y=${ready?.wsYielded ?? '?'} ${tail}`;
        })(),
      });
      if (probe.samples.length > 6000) {
        probe.samples.splice(0, 3000);
      }
    };
    take();
    setInterval(take, 40);
  }, spaceId);
}

const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__waterProbe: Probe}).__waterProbe);

/** A red run names the frames: consecutive equal states collapsed to their transitions (the last 60). */
function transitions(samples: ReadonlyArray<Sample>): string {
  const out: Array<string> = [];
  let last = '';
  for (const s of samples) {
    const key = `${s.parl ? 'P' : '-'}${s.board ? 'B' : '-'}${s.depart ? 'D' : '-'}${s.cellOcean ? 'O' : '-'} oceans=${s.oceans || '?'} holds=${s.holds} sit=[${s.sit}]`;
    if (key !== last) {
      out.push(`${s.t}: ${key}`);
      last = key;
    }
  }
  return out.slice(-60).join(String.fromCharCode(10));
}

const composer = (page: Page) => page.locator('.con-composer--play');

/**
 * THE LIFT LASTS 380 ms — no screenshot call can be raced against it (measured: three tries, three frames of the
 * bare hex). CDP streams every painted frame with its own wall-clock stamp, so the REVIEWABLE frame is chosen
 * afterwards, from the probe's first `depart` sample, exactly as the forestry probe picks its payout frame.
 */
type CastFrame = {wall: number, data: string};

async function recordFrames(page: Page): Promise<{frames: ReadonlyArray<CastFrame>, stop: () => Promise<void>}> {
  const frames: Array<CastFrame> = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Page.screencastFrame', (frame) => {
    frames.push({wall: (frame.metadata.timestamp ?? 0) * 1000, data: frame.data});
    cdp.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', {format: 'png', everyNthFrame: 1});
  return {
    frames,
    stop: async () => {
      await cdp.send('Page.stopScreencast').catch(() => undefined);
      await cdp.detach().catch(() => undefined);
    },
  };
}

/** Write the recorded frame nearest a moment the probe named (within a quarter second). */
function writeFrameAt(frames: ReadonlyArray<CastFrame>, wall: number, name: string): boolean {
  let best: CastFrame | undefined;
  for (const frame of frames) {
    if (best === undefined || Math.abs(frame.wall - wall) < Math.abs(best.wall - wall)) {
      best = frame;
    }
  }
  if (best === undefined || Math.abs(best.wall - wall) > 250) {
    return false;
  }
  fs.mkdirSync(OUT_ROOT, {recursive: true});
  fs.writeFileSync(path.join(OUT_ROOT, `${name}.png`), Buffer.from(best.data, 'base64'));
  return true;
}

/**
 * THE OBSERVER ENTERS THE SITTING. Its own client lands inside the start
 * workspace (its corporation's first action waits behind the political phase),
 * where the sitting's announce is a beacon chip and the plate stands on the
 * board home: B steps out of the stage, A on the plate opens the sitting. The
 * removal is a beat of the SITTING for an observer — its walk yields the frame
 * to the board for the world's move — so «seen by the observer» means seen
 * from there, not from a screen that never shows the planet.
 */
async function enterSittingAs(page: Page): Promise<void> {
  for (let i = 0; i < 10; i++) {
    if (await parliament(page).count() > 0) {
      return;
    }
    if (await mandatoryPlate(page).count() > 0) {
      await press(page, 'Enter', 1200);
      continue;
    }
    await press(page, 'Escape', 1200);
  }
  await expect(parliament(page), "the observer's client stands in the sitting").toHaveCount(1, {timeout: 20_000});
}

const dossierRows = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.con-context .con-dossier-row')).map((row) => ({
  label: (row.querySelector('.con-dossier-row__title')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  value: (row.querySelector('.con-dossier-row__val')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
})));

/** Open the hand workspace and descend into `card`'s play composer (the forecast e2e's own route). */
async function openPlayComposer(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 5 && await page.locator('.con-hand').count() === 0; i++) {
    await press(page, 'Period', 600); // RT → the quick wheel
    await press(page, 'Enter', 1400); // centre slot → the hand screen
  }
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
  expect(await focusCard(page, card, Math.max(24, slots * 3)), `never focused «${card}»`).toBeTruthy();
  expect(await pressUntil(page, 'Enter', async () => await composer(page).count() > 0, {tries: 3, settleMs: 1200}),
    `A must open the play composer for «${card}»`).toBeTruthy();
  await page.locator('.con-composer--play .con-composer__cta').waitFor({timeout: 20_000});
  await settle(page);
}

/** The departure's frames on one client: the proxy stood, the cell painted the water until it lifted, and the bare hex followed. */
function expectVisibleDeparture(samples: ReadonlyArray<Sample>, who: string): void {
  const lift = samples.findIndex((s) => s.depart);
  expect(lift, `${who}: a DEPARTURE proxy stood on the stage — the tile did not simply vanish`).toBeGreaterThanOrEqual(0);
  const before = samples.slice(0, lift);
  expect(before.some((s) => s.cellOcean), `${who}: the cell painted the OCEAN until the proxy took it over`).toBe(true);
  const after = samples.slice(lift);
  expect(after.some((s) => !s.depart && !s.cellOcean), `${who}: the bare hex remains once the tile is gone`).toBe(true);
  expect(before.every((s) => s.cellOcean), `${who}: the cell never blanked BEFORE the lift (no silent pop-out)`).toBe(true);
}

test.describe(`Water Export · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  test('the first player removes an ocean and both clients see it leave; then a Jovian card is 3 M€ cheaper', async ({page, context, request}) => {
    test.setTimeout(900_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    // ════════════════ PART 1 · THE SITTING — a world step that ASKS ════════════════
    const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-water-assembly', {query: PRESET.query, landing: 'prompt'});
    const red = seats[1];
    await armLeakWitness(page);
    await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
    await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(page, 30_000);

    const before = await wireOf(request, playerId);
    expect(before.game.oceans, 'the fixture stands with ONE ocean').toBe(1);
    const oceanCell = before.game.spaces.find((s) => s.tileType === OCEAN);
    expect(oceanCell, 'the ocean is on the board').toBeTruthy();
    const oceanId = oceanCell!.id;
    await shoot(page, '01-verdict');

    // ── ⓪ THE INSPECTION states the world part in the board's numbers, and the passive as its own block.
    await openZoomViewer(page);
    const rules = page.locator('dialog.con-zoom[open] .con-zoom-sidecol');
    await expect(rules).toContainText(/Что делает с планетой|What it does to the planet/);
    await expect(rules).toContainText(/Океаны: 1 → 0|Oceans: 1 → 0/);
    await expect(rules).toContainText(/на 3 M€ меньше|3 M€ less/);
    await shoot(page, '01b-inspect-world');
    await closeZoomViewer(page);
    await settle(page, {timeoutMs: 15_000});

    // THE SECOND CLIENT — red's console opens and stays open in the background: the removal must be seen there too.
    const redPage = await context.newPage();
    redPage.on('pageerror', (e) => console.log('[red pageerror]', e.message));
    await openConsole(redPage, red, PRESET.query);
    await settle(redPage, {timeoutMs: 20_000});
    await enterSittingAs(redPage);
    await expect.poll(() => sittingStage(redPage), {timeout: 15_000}).toBe('verdict');
    await waitSittingAtRest(redPage, 30_000);
    await armProbe(page, oceanId);
    await armProbe(redPage, oceanId);

    // ── GATE 1: A on the verdict; red answers over the API. Everything after this turns by itself.
    expect(await pressUntil(page, 'Enter', async () => (await parliamentWire(request, playerId)).waitingFor?.parliamentPhasePrompt === undefined,
      {tries: 4, settleMs: 1500}), 'A answers the assembly gate').toBe(true);
    await answerGateAs(request, red, 'assembly');

    // ── ① THE SEATS ARE PAID FIRST: 2 M€ per influence, influence 2 → +4.
    await expect.poll(async () => {
      const outcomes = (await wireOf(request, playerId)).game.parliament?.phase?.outcomes ?? [];
      return outcomes.find((o) => o.step === 'megacredits' && o.player === before.thisPlayer.color)?.amount;
    }, {timeout: 60_000, message: 'the seat\'s own 4 M€ is recorded'}).toBe(4);

    // ── ② THE WORLD STEP ASKS THE FIRST PLAYER: a removal prompt, marked by the server, on ONE candidate.
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.placementEffect, {timeout: 60_000,
      message: 'the first player holds the removal'}).toBe('remove');
    const asked = await wireOf(request, playerId);
    expect(asked.waitingFor?.placementType).toBe('ocean-removal');
    expect(asked.waitingFor?.spaces, 'ONE candidate — still a question (no auto-select)').toEqual([oceanId]);
    expect(asked.waitingFor?.placementContext?.source).toMatchObject({kind: 'resolution', resolution: WATER_ID});
    expect(asked.game.parliament?.phase?.pending, 'published as the phase\'s pending question').toMatchObject({player: before.thisPlayer.color, key: 'oceanRemoval', input: 'space'});
    const redWire = await wireOf(request, red);
    expect(redWire.waitingFor?.type, 'red waits — the sitting stops at the question').toBeUndefined();

    // ── ③ THE DOOR: the sitting names the step and A takes the player to the board — the pick is theirs.
    await waitSittingAtRest(page, 60_000);
    await waitSittingAtRest(redPage, 60_000); // the observer's walk stands on its wait for this seat
    // The crumb's tail names what the board step DOES — a removal, never a «placement» (the door and the pose are the tile's).
    expect(await crumbText(page), 'the tail reads СНЯТИЕ').toMatch(/СНЯТИЕ|Removal/i);
    await shoot(page, '02-removal-step');
    expect(await pressUntil(page, 'Enter', async () => await placementState(page) !== 'none', {tries: 6, settleMs: 1500}),
      'A opens the ocean pick on the board').toBe(true);
    await settle(page, {timeoutMs: 20_000});
    await walkToSpace(page, oceanId);
    await settle(page, {timeoutMs: 15_000});
    await expect.poll(async () => (await dossierRows(page)).some((r) => /уходит с поля|leaves the board/i.test(r.label)), {
      timeout: 15_000, message: 'the dossier says the tile LEAVES',
    }).toBe(true);
    const rows = await dossierRows(page);
    expect(rows.some((r) => /РТ никто не теряет|Nobody loses TR/i.test(r.label)), `no silent loss — the rating nobody loses is said (${JSON.stringify(rows)})`).toBe(true);
    await shoot(page, '03-ocean-pick-dossier');

    // ── ④ THE COMMIT REMOVES THE TILE — and the frame is VISIBLE on both clients.
    const cast = await recordFrames(page);
    expect(await commitFocusedSpace(page), 'the ocean is removed through the standard two-press flow').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).game.oceans, {timeout: 60_000, message: 'the ocean count fell'}).toBe(0);
    const sawDeparture = (who: Page, timeoutMs: number): Promise<boolean> =>
      expect.poll(async () => (await readProbe(who)).samples.some((s) => s.depart), {timeout: timeoutMs}).toBe(true)
        .then(() => true, () => false);
    const chooserSaw = await sawDeparture(page, 30_000);
    await cast.stop();
    // THE FRAME OF THE LIFT: the screencast frame nearest the probe's first `depart` sample plus a third of the
    // lift — the tile is off its cell and in the air. A miss is reported, never a substitute frame.
    const firstDepart = (await readProbe(page)).samples.find((s) => s.depart);
    if (firstDepart !== undefined) {
      expect(writeFrameAt(cast.frames, firstDepart.wall + 120, '04-tile-leaving'),
        `a screencast frame within 250 ms of the lift (${cast.frames.length} frames recorded)`).toBe(true);
    }
    const observerSaw = await sawDeparture(redPage, 60_000);
    if (!chooserSaw || !observerSaw) {
      // A red run names its frames: both clients' state transitions and the observer's wire.
      console.log(`[water] chooser frames (P=parliament B=board D=depart O=cell paints ocean):${String.fromCharCode(10)}${transitions((await readProbe(page)).samples)}`);
      console.log(`[water] observer frames:${String.fromCharCode(10)}${transitions((await readProbe(redPage)).samples)}`);
      const redWireNow = await wireOf(request, red);
      console.log(`[water] observer wire: outcomes=${JSON.stringify((redWireNow.game.parliament?.phase?.outcomes ?? []).map((o) => ({kind: o.kind, step: o.step, player: o.player})))} waitingFor=${redWireNow.waitingFor?.type}`);
    }
    expect(chooserSaw, 'the chooser saw the departure proxy').toBe(true);
    expect(observerSaw, 'the OBSERVER saw the departure proxy too — from its own sitting, which stepped aside for the board').toBe(true);
    await expect.poll(async () => (await readProbe(page)).samples.some((s) => !s.depart && !s.cellOcean && s.oceans.includes('0')), {timeout: 30_000,
      message: 'the bare hex and the HUD readout 0 after the lift'}).toBe(true);
    await expect.poll(async () => (await readProbe(redPage)).samples.some((s) => !s.depart && !s.cellOcean), {timeout: 60_000,
      message: 'the observer\'s cell is bare after the lift'}).toBe(true);
    expectVisibleDeparture((await readProbe(page)).samples, 'the chooser');
    expectVisibleDeparture((await readProbe(redPage)).samples, 'the observer');
    await shoot(page, '05-bare-hex');

    const after = await wireOf(request, playerId);
    const record = (after.game.parliament?.phase?.outcomes ?? after.game.parliament?.lastPhase?.outcomes ?? []).find((o) => o.step === 'oceanRemoval');
    expect(record, 'the world record names the cell, the count and the chooser — and no seat').toMatchObject({
      kind: 'tileRemoved', part: 'world', space: oceanId, actor: before.thisPlayer.color, amount: -1, parameter: {id: 'oceans', before: 1, after: 0},
    });
    expect(record?.player).toBeUndefined();
    expect(after.thisPlayer.terraformRating - before.thisPlayer.terraformRating, 'nobody loses TR — the winner gains at most its Agenda step').toBeGreaterThanOrEqual(0);

    // ── ⑤ THE FRAME COMES BACK and the RESULTS carry the planet line with the ocean step.
    await expect(parliament(page), 'the sitting is back').toHaveCount(1, {timeout: 60_000});
    await waitSittingAtRest(page, 60_000);
    await expect.poll(() => sittingStage(page), {timeout: 90_000, message: 'the walk reaches the results'}).toBe('results');
    const planet = page.locator('[data-sit-section="planet"] [data-sit-planet]');
    await expect(planet, 'one line member — the ocean count').toHaveCount(1);
    await expect(planet.nth(0)).toHaveAttribute('data-sit-planet-param', 'oceans');
    await expect(planet.nth(0)).toHaveAttribute('data-sit-planet-steps', '-1');
    await shoot(page, '06-results-planet');
    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
    await redPage.close();

    // ════════════════ PART 2 · THE DISCOUNT — the law stands, a Jovian card is cheaper ════════════════
    const enacted = await bootFixtureSeats(page, request, 'parliament-water-enacted');
    const viewer = enacted.playerId;
    const wire = await wireOf(request, viewer);
    const held = wire.cardsInHand?.find((c) => c.name === JOVIAN_CARD);
    expect(held, 'the viewer holds Miranda Resort').toBeTruthy();
    expect(held?.calculatedCost, 'the SERVER prices it 12 − 3 = 9 — the one price function').toBe(9);
    expect(wire.game.oceans, 'the fixture\'s ocean is gone').toBe(0);

    // ── ⑥ THE PAYMENT HEAD: «ЦЕНА 12 → 9» with «−3» — the composer reads the same breakdown the server charges.
    await openPlayComposer(page, JOVIAN_CARD);
    const head = page.locator('.con-composer--play .con-pay__head');
    await expect(head.locator('[data-pay-base]')).toHaveText('12');
    await expect(head.locator('.con-pay__price-value')).toHaveText('9');
    await expect(head.locator('[data-pay-saved]')).toHaveText('−3');
    await shoot(page, '07-play-discount');

    // Back out without playing: the journey is the price and its explanation, not the play.
    for (let i = 0; i < 6 && await page.locator('.con-composer--play, .con-hand').count() > 0; i++) {
      await press(page, 'Escape', 700);
    }
    await settle(page, {timeoutMs: 30_000});
    expect(await strandedReports(page), 'nothing stranded').toEqual([]);
  });
});
