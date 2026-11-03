import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  bootFixture, createGameWithCards, crumbText, fetchPlayerModel, openConsole, pickCards, playCardFromHand, playQueueCard, press,
  reloadConsole, sendPlayerInput, settle, soloGameConfig, submitSummary, waitQueueIdle, walkFocusUntil, walkToSummary,
} from './consoleStart';

/**
 * P48 EARLY COLONIZATION — «Raise all colony tracks 2 steps. Place a colony. Gain 3 energy» (Prelude 2,
 * `src/server/cards/prelude2/EarlyColonization.ts`). The rules order is the server's: the raise is applied in the play,
 * the placement prompt arrives over the raised tracks and CARRIES what was raised (`trackRaise`).
 *
 * THE START IS ONE FLOW (A): A on the prelude in the queue → the colonies take the start's step («СТАРТ ПАРТИИ › …
 * › КОЛОНИИ») while the deployment RELEASES in place (the same DOM nodes come back — no `v-if` remount) → every tile
 * stands where it STOOD, then the ONE track wave lifts the active ones (the pick locked meanwhile) → the pick → the
 * cube → the step hands the screen back only after its story → the queue goes on. (D) A reload inside the step never
 * replays the wave: the tiles stand on the truth and the pick is open at once.
 *
 * The rule (raise → place, the top, the inactive tiles, the record, the log) is pinned by
 * `tests/cards/prelude2/EarlyColonization.spec.ts`; the raise module by `tests/client/console/colonyTrackRaise.spec.ts`.
 * This spec is the JOURNEY on the TV profile, its order claims sampled from BEFORE the press (MutationObserver +
 * setInterval, never rAF) — a TIMING-class spec (`timingSpecs.ts`).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'p48', PRESET.id);
const CARD = 'Early Colonization';
const CORP = 'Teractor';
const SECOND_PRELUDE = 'Allied Bank';
/** The list the table is dealt from: a solo table deals THREE of them (players + 2) and the server refuses a list shorter
 *  than its minimum — WHICH tiles are in play and which are active is read off the server, never assumed. */
const COLONY_LIST = ['Luna', 'Ganymede', 'Miranda', 'Titan', 'Callisto'];

type WireColony = {name: string, trackPosition: number, colonies: Array<string>, isActive: boolean};
type Wire = {
  thisPlayer: {color: string, energy: number, coloniesCount: number, tableau: Array<{name: string}>},
  waitingFor?: {type: string, promptId?: number, coloniesModel?: Array<{name: string}>, trackRaise?: Array<{colony: string, before: number, after: number}>},
  game: {colonies: Array<WireColony>, gameLog?: unknown},
};
type Probe = {
  samples: number, ticks: number,
  /** The marker cell each tile showed the FIRST time the step's grid painted it (0-based, `<Name>#<pos>`). */
  firstMarker: Record<string, number>,
  /** Every marker position each tile showed, in order. */
  markers: Record<string, Array<number>>,
  /** The colonies section's mode, in order. */
  modes: Array<string>,
  /** The wave was on stage while the mode already read «pick» with the input open (it must not). */
  pickDuringWave: number,
  waveSeen: number,
  /** How many times a colonies step zone was ADDED to the DOM. */
  stepMounts: number,
  crumbs: Array<string>,
};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await fetchPlayerModel(request, id) as unknown as Wire;
}
const namesOf = (wire: Wire) => wire.game.colonies.map((c) => c.name);
const tracksOf = (wire: Wire) => wire.game.colonies.map((c) => c.trackPosition);
const activeOf = (wire: Wire) => wire.game.colonies.filter((c) => c.isActive).map((c) => c.name);

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** `TM_E2E_STORYBOARD=1`: every painted frame of the scene, for the owner's 4K review. */
async function storyboard(page: Page, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

/** From the press on: the markers of the step's tiles as PAINTED, the section's mode, the wave, the step's mounts. */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__p48: Probe, __conReady?: () => {colonyTrackWave?: {active: boolean}}};
    const p: Probe = {samples: 0, ticks: 0, firstMarker: {}, markers: {}, modes: [], pickDuringWave: 0, waveSeen: 0, stepMounts: 0, crumbs: []};
    w.__p48 = p;
    // The deployment node the step must NOT remount — tagged before the press, asked after the return.
    const deploy = document.querySelector('.con-start__deploy');
    if (deploy !== null) {
      (deploy as unknown as {__p48Node?: boolean}).__p48Node = true;
    }
    const sample = (tick: boolean) => {
      p.samples++;
      if (tick) {
        p.ticks++;
      }
      const zone = document.querySelector('.con-start__colonystep');
      const grid = zone?.querySelector('.con-colonies');
      if (grid !== null && grid !== undefined) {
        const mode = grid.getAttribute('data-colony-mode') ?? '';
        if (p.modes[p.modes.length - 1] !== mode) {
          p.modes.push(mode);
        }
        grid.querySelectorAll('.con-coltile__track-cell--marker[data-colony-track-cell]').forEach((cell) => {
          const [name, pos] = (cell.getAttribute('data-colony-track-cell') ?? '').split('#');
          const at = Number(pos);
          if (name === '' || Number.isNaN(at)) {
            return;
          }
          if (p.firstMarker[name] === undefined) {
            p.firstMarker[name] = at;
          }
          const seen = p.markers[name] ?? (p.markers[name] = []);
          if (seen[seen.length - 1] !== at) {
            seen.push(at);
          }
        });
        const wave = w.__conReady?.()?.colonyTrackWave?.active === true;
        if (wave) {
          p.waveSeen++;
        }
      }
      document.querySelectorAll('.con-wshead').forEach((el) => {
        const crumb = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (crumb !== '' && !p.crumbs.includes(crumb)) {
          p.crumbs.push(crumb);
        }
      });
    };
    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement && n.classList.contains('con-start__colonystep')) {
            p.stepMounts++;
          }
        });
      }
      sample(false);
    }).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample(true), 30);
  });
}
const readProbe = (page: Page): Promise<Probe> => page.evaluate(() => (window as unknown as {__p48: Probe}).__p48);
const deploySurvived = (page: Page): Promise<boolean> => page.evaluate(() =>
  (document.querySelector('.con-start__deploy') as unknown as {__p48Node?: boolean} | null)?.__p48Node === true);

/** The real start up to the queue: the wizard through the console, the corporation played, the solo trim answered. */
async function startToQueue(page: Page, request: APIRequestContext): Promise<string> {
  const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
    expansions: {colonies: true, prelude: true, prelude2: true},
    startingCorporations: 1,
    customCorporationsList: [CORP],
    customPreludes: [CARD, SECOND_PRELUDE, 'Business Empire', 'Mohole'],
    customColoniesList: [...COLONY_LIST],
  })});
  await openConsole(page, playerId, PRESET.query);
  await walkToSummary(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        expect(await pickCards(p, [CORP]), 'the corporation was offered and picked').toContain(CORP);
      } else if (kind === 'prelude') {
        const got = await pickCards(p, [CARD, SECOND_PRELUDE]);
        expect(got, 'both Preludes were picked').toEqual(expect.arrayContaining([CARD, SECOND_PRELUDE]));
      }
    },
  });
  await submitSummary(page);
  await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
  await settle(page, {timeoutMs: 30_000});
  expect(await playQueueCard(page, CORP), 'the corporation was played from the queue').toBe(true);
  // A solo setup colony question (if the variant asks one) is not this spec's subject — answered over the API.
  for (let i = 0; i < 20; i++) {
    const wire = await wireOf(request, playerId);
    if (wire.waitingFor?.type === 'colony' && wire.waitingFor.trackRaise === undefined) {
      await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (wire.waitingFor.coloniesModel ?? [])[0]?.name ?? ''});
      break;
    }
    if (wire.thisPlayer.tableau.some((c) => c.name === CORP)) {
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  await waitQueueIdle(page);
  await settle(page, {timeoutMs: 30_000});
  return playerId;
}

test.describe('P48 — Early Colonization: the raise is told, then the pick, inside the start', () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A: the start — the step takes the deployment\'s place, the wave lifts every active track, the pick, the cube, the return', async ({page, request}) => {
    test.setTimeout(420_000);
    const playerId = await startToQueue(page, request);
    const before = await wireOf(request, playerId);
    const tracksBefore = tracksOf(before);
    const COLONIES = namesOf(before);
    expect(COLONIES.every((name) => COLONY_LIST.includes(name)), `the tiles are dealt from the list (${COLONIES.join(', ')})`).toBe(true);
    const ACTIVE = activeOf(before);
    test.info().annotations.push({type: 'table', description: `active: ${ACTIVE.join(', ')} · tracks ${tracksBefore.join(', ')}`});
    await shoot(page, '01-queue');

    await armProbe(page);
    const stop = await storyboard(page, 'start');
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.type ?? 'none',
      {timeout: 40_000, message: 'the server raises the colony pick after the Prelude'}).toBe('colony');
    const asked = await wireOf(request, playerId);
    // THE SERVER: the raise first, applied before the question, and carried ON it.
    expect(asked.thisPlayer.energy, 'the 3 energy came with the play').toBe(before.thisPlayer.energy + 3);
    expect(tracksOf(asked), 'the active tracks rose 2 steps, the inactive did not')
      .toEqual(COLONIES.map((name, i) => ACTIVE.includes(name) ? Math.min(tracksBefore[i] + 2, 6) : tracksBefore[i]));
    expect((asked.waitingFor?.trackRaise ?? []).map((m) => m.colony).sort(), 'the prompt carries the raise of the active tiles').toEqual([...ACTIVE].sort());

    await page.locator('.con-start__colonystep .con-colonies').waitFor({timeout: 40_000});
    await expect.poll(async () => (await crumbText(page)).toUpperCase(), {timeout: 20_000, message: 'the crumb: the start\'s flow, the colonies step'})
      .toMatch(/СТАРТ ПАРТИИ.*РАННЯЯ КОЛОНИЗАЦИЯ.*КОЛОНИИ/);
    await shoot(page, '02-step-before-wave');
    // THE WAVE: every active marker leaves BEFORE and lands AFTER; the pick is opened only after it.
    await expect.poll(async () => {
      const p = await readProbe(page);
      return ACTIVE.every((name) => (p.markers[name] ?? []).includes(Math.min(tracksBefore[COLONIES.indexOf(name)] + 2, 6)));
    }, {timeout: 30_000, message: 'every active marker reached its raised cell'}).toBe(true);
    await expect.poll(async () => page.evaluate(() =>
      (window as unknown as {__conReady?: () => {colonyTrackWave?: {active: boolean}}}).__conReady?.()?.colonyTrackWave?.active ?? false),
    {timeout: 20_000, message: 'the wave ends'}).toBe(false);
    await shoot(page, '03-wave-landed');
    const mid = await readProbe(page);
    for (const name of ACTIVE) {
      expect(mid.firstMarker[name], `${name} was first painted where it STOOD (the hold, never the truth first)`).toBe(tracksBefore[COLONIES.indexOf(name)]);
    }
    expect(mid.waveSeen, 'the wave was on stage').toBeGreaterThan(0);
    // The grid is a SHOW step while the raise is told, the pick's ask only after the last landing.
    expect(mid.modes[0], `the grid opened as the raise's show step (modes ${mid.modes.join(' → ')})`).toBe('raise');
    await expect.poll(async () => (await readProbe(page)).modes.at(-1), {timeout: 10_000, message: 'the pick opens after the wave'}).toBe('pick');

    // THE PICK: A focuses a tile, A builds.
    for (let i = 0; i < 4 && await page.locator('.con-colfocus').count() === 0; i++) {
      await press(page, 'Enter', 1800);
    }
    await page.locator('.con-colfocus').waitFor({timeout: 20_000});
    await shoot(page, '04-build-stage');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.coloniesCount, {timeout: 30_000, message: 'the server: a colony built'})
      .toBe(before.thisPlayer.coloniesCount + 1);
    // THE RETURN: the step leaves, the SAME deployment comes back — no remount, the queue goes on.
    await expect.poll(() => page.locator('.con-start__colonystep').count(), {timeout: 60_000, message: 'the step hands the screen back'}).toBe(0);
    await shoot(page, '05-returned');
    expect(await deploySurvived(page), 'the deployment is the SAME node (released in place, never remounted)').toBe(true);
    await waitQueueIdle(page);
    await stop();
    const probe = await readProbe(page);
    test.info().annotations.push({type: 'probe', description: JSON.stringify({modes: probe.modes, markers: probe.markers, firstMarker: probe.firstMarker,
      waveSeen: probe.waveSeen, stepMounts: probe.stepMounts, crumbs: probe.crumbs, samples: probe.samples})});
    expect(probe.ticks, `the probe's sampler ran (${probe.samples} samples)`).toBeGreaterThan(5);
    expect(probe.stepMounts, 'the step zone mounted once').toBe(1);
    const after = await wireOf(request, playerId);
    expect(after.thisPlayer.coloniesCount, 'one colony').toBe(before.thisPlayer.coloniesCount + 1);
  });

  test('D: a reload inside the step never replays the wave — the tiles stand on the truth, the pick is open', async ({page, request}) => {
    test.setTimeout(420_000);
    const playerId = await startToQueue(page, request);
    expect(await playQueueCard(page, CARD), 'the Prelude was played from the queue').toBe(true);
    await page.locator('.con-start__colonystep .con-colonies').waitFor({timeout: 40_000});
    await expect.poll(async () => page.evaluate(() =>
      (window as unknown as {__conReady?: () => {colonyTrackWave?: {active: boolean, lastFinish: string}}}).__conReady?.()?.colonyTrackWave?.lastFinish ?? ''),
    {timeout: 30_000, message: 'the wave played once'}).not.toBe('');
    await reloadConsole(page);
    await page.locator('.con-colonies').first().waitFor({timeout: 60_000});
    await armProbe(page);
    await settle(page, {timeoutMs: 30_000});
    const wire = await wireOf(request, playerId);
    expect(wire.waitingFor?.type, 'still the pick').toBe('colony');
    const ACTIVE = activeOf(wire);
    const COLONIES = namesOf(wire);
    const probe = await readProbe(page);
    expect(probe.waveSeen, 'no wave after the reload').toBe(0);
    const truth = tracksOf(wire);
    for (const name of ACTIVE) {
      const shown = await page.locator(`.con-coltile__track-cell--marker[data-colony-track-cell^="${name}#"]`).first().getAttribute('data-colony-track-cell');
      expect(shown, `${name} stands on the truth`).toBe(`${name}#${truth[COLONIES.indexOf(name)]}`);
    }
    await shoot(page, '06-reload-pick-open');
  });

  test('B: a prelude played mid-game (WG Project) — the same wave inside the hand step, the pick, the return into the hand chain', async ({page, request}) => {
    test.setTimeout(360_000);
    const PICK = '.con-hand__outcome .con-deckpick--play';
    const id = await bootFixture(page, request, 'early-colonization-wg', {query: PRESET.query});
    await settle(page);
    const before = await wireOf(request, id);
    const tracksBefore = new Map(before.game.colonies.map((c) => [c.name, c.trackPosition]));
    const stop = await storyboard(page, 'wg');
    expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
    await expect(page.locator(`${PICK}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
    const focused = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === CARD, focused, 12), `never focused ${CARD}`).toBeTruthy();
    await press(page, 'Enter', 400);
    await press(page, 'Period', 300); // RT — the commit
    await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type ?? 'none',
      {timeout: 40_000, message: 'the colony pick after the prelude'}).toBe('colony');
    const asked = await wireOf(request, id);
    const raised = (asked.waitingFor?.trackRaise ?? []).filter((m) => m.after > m.before);
    expect(raised.length, 'the prompt carries a raise').toBeGreaterThan(0);
    // The step stands INSIDE the hand (never a screen of its own), and the wave plays on its tiles.
    const grid = page.locator('.con-hand .con-colonies');
    await grid.first().waitFor({timeout: 40_000});
    const first = raised[0];
    await expect(page.locator(`.con-hand .con-coltile__track-cell--marker[data-colony-track-cell="${first.colony}#${first.after}"]`),
      `${first.colony}'s marker reaches its raised cell`).toHaveCount(1, {timeout: 30_000});
    expect(tracksBefore.get(first.colony), 'the record before is the table before').toBe(first.before);
    await expect.poll(async () => page.evaluate(() =>
      (window as unknown as {__conReady?: () => {colonyTrackWave?: {active: boolean, lastFinish: string}}}).__conReady?.()?.colonyTrackWave?.lastFinish ?? ''),
    {timeout: 30_000, message: 'the wave landed'}).toBe('landed');
    await shoot(page, 'B-hand-wave-landed');
    for (let i = 0; i < 4 && await page.locator('.con-colfocus').count() === 0; i++) {
      await press(page, 'Enter', 1800);
    }
    await page.locator('.con-colfocus').waitFor({timeout: 20_000});
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await wireOf(request, id)).thisPlayer.coloniesCount, {timeout: 30_000, message: 'a colony built'})
      .toBe(before.thisPlayer.coloniesCount + 1);
    await expect.poll(() => page.locator('.con-hand .con-colonies').count(), {timeout: 60_000, message: 'the colony step leaves the hand'}).toBe(0);
    await settle(page, {timeoutMs: 40_000});
    await stop();
    await shoot(page, 'B-after');
  });
});
