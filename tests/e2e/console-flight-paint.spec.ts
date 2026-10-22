/*
 * THE STAND OF T12 / CA — «ЖЕТОН НИКОГДА НЕ КРАСИТСЯ ПОД ПОВЕРХНОСТЬЮ, НА КОТОРУЮ САДИТСЯ» (the flights' third
 * iteration; the owner's report of 2026-10-22: «при размещении на поле от розыгрыша ПРОЛОГА ресурс летит ПОД панель,
 * как будто проблема с z-index»). The paint witness (`paintWitness.ts`) asks on every sample what is painted ON TOP at
 * each token's centre — the token, or a named surface — with the token and the known `pointer-events: none` covers
 * made hit-testable for that one question. A token under the cockpit's hull (the rail, the strip, a seat's plaque) is
 * the defect; the touchdown must be the token's own paint.
 *
 *  A · the owner's case: a start PRELUDE places a city on a bonus cell while the start workspace stands (the deployment
 *      still owes a prelude) — the cell's printed bonus flies from the board to the rail.
 *  B · a RIVAL's city on a bonus cell: the token lands on the intake plaque hanging from the rival's chip in the status
 *      strip (the strip's stacking context — 11706 — stood over the lit transfer layer, 11670).
 *
 * TIMING class (`timingSpecs.ts`): run `--exclusive --workers=1` on the Steam Machine; TV first, fhd beside it (the
 * z ladder is read per profile). The report of every token lands in `screenshots/t12/<profile>/paint-<scene>-<tag>.txt`
 * (`TM_E2E_SHOTS_TAG=before` for the stand against the HEAD client).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  NO_PAYMENT, bootFixtureSeats, commitFocusedSpace, fetchPlayerModel, payStartPurchase, pickCards, playQueueCard, press,
  queueCards, sendPlayerInput, settle, submitSummary, waitQueueIdle, walkToSpace, walkToSummary,
} from './consoleStart';
import {PaintWitness, armPaintWitness, paintReport, readPaintWitness} from './paintWitness';

const OUT = path.resolve('screenshots', 't12');
const TAG = process.env.TM_E2E_SHOTS_TAG ?? 'after';
const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  // The stand is a claim about the z ladder, and the ladder has profile rules (`console_tv.less`) — fhd beside it.
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
] as const;

type WireSpace = {id: string, bonus?: Array<number>, tileType?: number};
type WireOption = {type: string, title?: unknown, cards?: Array<{name: string, calculatedCost?: number}>};
type Wire = {
  thisPlayer: {color: string},
  game: {spaces?: Array<WireSpace>, oceans?: number},
  waitingFor?: {type: string, spaces?: Array<string>, options?: Array<WireOption>},
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

/** The richest legal cell of a live space prompt (most printed bonus icons). */
async function richestCell(request: APIRequestContext, id: string): Promise<{cell: string, printed: number}> {
  const w = await wireOf(request, id);
  const spaces = new Map((w.game.spaces ?? []).map((s) => [s.id, s]));
  const cell = [...(w.waitingFor?.spaces ?? [])].sort((a, b) => (spaces.get(b)?.bonus?.length ?? 0) - (spaces.get(a)?.bonus?.length ?? 0))[0];
  return {cell, printed: spaces.get(cell)?.bonus?.length ?? 0};
}

/** Wait until no token is in the air and the console is quiet. */
async function sceneDone(page: Page): Promise<void> {
  await expect.poll(() => page.locator('.con-transfer__chip').count(), {timeout: 60_000, message: 'the tokens landed'}).toBe(0);
  await settle(page, {timeoutMs: 30_000});
}

/**
 * A STORYBOARD of the scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time —
 * `screenshots/t12/<profile>/story-<scene>-<tag>/`. (On the 4K raster the CDP screencast hands back empty frames — the
 * T08 finding; the fhd storyboard is the frame-by-frame evidence, the 4K one the witness's numbers.)
 */
async function storyboard(page: Page, profile: string, scene: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, profile, `story-${scene}-${TAG}`);
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

function record(profile: string, scene: string, w: PaintWitness): string {
  const report = paintReport(w);
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  fs.writeFileSync(path.join(OUT, profile, `paint-${scene}-${TAG}.txt`), report + '\n\n' + w.samples.map((s) => JSON.stringify(s)).join('\n') + '\n');
  return report;
}

/** THE LAW, read off the witness: no sample under the hull, every touchdown the token's own paint. */
function expectPainted(w: PaintWitness, report: string, minTokens: number): void {
  expect(w.tokens.length, `tokens flew (${minTokens}+):\n${report}`).toBeGreaterThanOrEqual(minTokens);
  for (const token of w.tokens) {
    expect(token.underHull.map((s) => `${s.t}ms ${s.top}`), `#${token.id} never painted under the panel:\n${report}`).toEqual([]);
    expect(token.touchdown.top, `#${token.id} lands over its destination's paint:\n${report}`).toBe('self');
  }
}

/** A start with a CITY prelude among four (the deployment keeps a second prelude queued while the city plays). */
function preludeCityConfig(): Record<string, unknown> {
  return {
    players: [{name: 'PaintProbe', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: false, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: ['Teractor', 'Thorgate'], bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: ['Early Settlement', 'Donation', 'Loan', 'Martian Industries'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false, altVenusBoard: false,
    escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 3, startingPreludes: 4,
    automa: undefined,
  };
}

for (const profile of PROFILES) {
  test.describe(`the paint of a flight · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1});

    test(`A · a start prelude's city on a bonus cell: its tokens never paint under the rail (${profile.id})`, async ({page, request}) => {
      test.setTimeout(360_000);
      const created = await request.post('/api/creategame', {data: preludeCityConfig()});
      const id = (await created.json() as {players: Array<{id: string}>}).players[0].id;
      await page.goto(`/player?id=${id}&console=1${profile.query}`);
      await page.waitForSelector('.con-start__frame', {timeout: 60_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
      await walkToSummary(page, {
        onStep: async (p, kind) => {
          if (kind === 'corporation') {
            await press(p, 'Enter', 600);
          } else if (kind === 'prelude') {
            await pickCards(p, ['Early Settlement', 'Donation']);
          }
        },
      });
      await submitSummary(page);
      await waitQueueIdle(page);
      // The city prelude plays WITH THE DEPLOYMENT STILL RUNNING (Donation stays queued) — the start workspace stands.
      for (let i = 0; i < 4; i++) {
        await waitQueueIdle(page);
        const ahead = (await queueCards(page)).find((n) => n !== 'Early Settlement' && n !== 'Donation');
        if (ahead === undefined) {
          break;
        }
        expect(await playQueueCard(page, ahead), `the deployment plays ${ahead}`).toBeTruthy();
      }
      await payStartPurchase(page);
      await waitQueueIdle(page);
      expect(await queueCards(page), 'Donation keeps the deployment running').toContain('Donation');
      expect(await playQueueCard(page, 'Early Settlement'), 'the city prelude plays').toBeTruthy();
      await expect.poll(async () => (await wireOf(request, id)).waitingFor?.type, {timeout: 30_000, message: 'the server asks for the city'}).toBe('space');
      const {cell, printed} = await richestCell(request, id);
      expect(printed, `the richest legal cell prints a bonus (${cell})`).toBeGreaterThan(0);
      await page.waitForSelector('.con-context__task-kicker', {timeout: 30_000});
      await walkToSpace(page, cell);
      await armPaintWitness(page);
      const stopStory = await storyboard(page, profile.id, 'prelude-city');
      expect(await commitFocusedSpace(page), `the city lands on ${cell}`).toBeTruthy();
      await sceneDone(page);
      await stopStory();
      const w = await readPaintWitness(page);
      const report = record(profile.id, 'prelude-city', w);
      test.info().annotations.push({type: 'paint', description: report});
      expectPainted(w, report, 1);
    });

    test(`B · a rival's city on a bonus cell: the token lands OVER the seat's intake plaque (${profile.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId: blue, seats} = await bootFixtureSeats(page, request, 'tile-language', {query: profile.query});
      const red = seats.find((s) => s !== blue)!;
      const menu = (await wireOf(request, blue)).waitingFor!;
      const passIdx = (menu.options ?? []).findIndex((o) => JSON.stringify(o.title ?? '').includes('Pass for this generation'));
      expect(passIdx, 'blue can pass').toBeGreaterThanOrEqual(0);
      await sendPlayerInput(request, blue, {type: 'or', index: passIdx, response: {type: 'option'}});
      await expect.poll(async () => (await wireOf(request, red)).waitingFor?.type, {timeout: 30_000}).toBe('or');
      await settle(page, {timeoutMs: 30_000});
      const redMenu = (await wireOf(request, red)).waitingFor!;
      const idx = (redMenu.options ?? []).findIndex((o) => o.type === 'projectCard' && (o.cards ?? []).some((c) => c.name === 'City'));
      const card = (redMenu.options?.[idx].cards ?? []).find((c) => c.name === 'City');
      await sendPlayerInput(request, red, {type: 'or', index: idx, response: {type: 'projectCard', card: 'City', payment: {...NO_PAYMENT, megacredits: card?.calculatedCost ?? 25}}});
      await expect.poll(async () => (await wireOf(request, red)).waitingFor?.type, {timeout: 20_000}).toBe('space');
      const {cell, printed} = await richestCell(request, red);
      expect(printed, 'the richest legal cell prints a bonus').toBeGreaterThan(0);
      await armPaintWitness(page);
      const stopStory = await storyboard(page, profile.id, 'rival-intake');
      await sendPlayerInput(request, red, {type: 'space', spaceId: cell});
      await expect.poll(() => page.locator('[data-intake-seat]').count(), {timeout: 60_000, message: 'the rival\'s intake opened'}).toBeGreaterThan(0);
      await expect.poll(() => page.locator('[data-intake-seat]').count(), {timeout: 30_000, message: 'the rival\'s intake folded'}).toBe(0);
      await sceneDone(page);
      await stopStory();
      const w = await readPaintWitness(page);
      const report = record(profile.id, 'rival-intake', w);
      test.info().annotations.push({type: 'paint', description: report});
      expectPainted(w, report, 1);
    });
  });
}
