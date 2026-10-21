/*
 * A RIVAL'S GAIN OFF THE FIELD LANDS ON THE SEAT CHIP'S INTAKE (T06 «ОБА КОНЦА ПОЛЁТА — ЖИВЫЕ», the owner's decision 6 =
 * M1 «плашка-хвост» — `docs/claude/console/resource-transfer.md`). Fixture `tile-language` (blue on the move, red driven
 * over the API): blue passes, red places a City on the richest legal cell — the cell's printed steel is red's money.
 * fhd + tv4k, on blue's screen:
 *   · the plaque under red's chip OPENS before the token is born (in the frame of the first birth it stands EXPECTING);
 *   · ONE token per resource carrying its sum (two steel = one «+2», never a swarm);
 *   · the token lands ON the plaque's number (`intake:red`), the plaque reads RECEIVED «+2», stands a read, folds;
 *   · the chip ribbon's width never changes (the plaque is absolute) and nothing is painted over nothing (the sentinel).
 * The probe is `setInterval` + `MutationObserver` — never rAF. `TM_E2E_STORYBOARD=1` also records every frame the compositor
 * produced (`screenshots/t06/<profile>/story-rival-intake/`) — the acceptance at 4K is that storyboard on the GPU.
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {NO_PAYMENT, bootFixtureSeats, fetchPlayerModel, sendPlayerInput, settle} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

const OUT = path.resolve('screenshots', 't06');
const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type WireSpace = {id: string, bonus?: Array<number>};
type WireOption = {type: string, title?: unknown, cards?: Array<{name: string, calculatedCost?: number}>};
type Wire = {thisPlayer: {color: string}, game: {spaces?: Array<WireSpace>}, waitingFor?: {type: string, spaces?: Array<string>, options?: Array<WireOption>}};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

type Sample = {t: number, intake: string | null, nums: string, chips: number, ribbonW: number};

async function armProbe(page: Page, seat: string): Promise<void> {
  await page.evaluate((color) => {
    const w = window as unknown as {__intakeProbe?: {samples: Array<Sample>, stop: () => void}};
    w.__intakeProbe?.stop();
    const samples: Array<Sample> = [];
    const t0 = performance.now();
    const sample = () => {
      const plaque = document.querySelector(`[data-intake-seat="${color}"]`);
      samples.push({
        t: Math.round(performance.now() - t0),
        intake: plaque?.getAttribute('data-intake-phase') ?? null,
        nums: Array.from(document.querySelectorAll(`[data-intake-seat="${color}"] .con-status__intake-num`)).map((n) => n.textContent ?? '').join(','),
        chips: Array.from(document.querySelectorAll('.con-transfer__chip')).filter((c) => Number(getComputedStyle(c).opacity) > 0.05).length,
        ribbonW: Math.round((document.querySelector('.con-status__ribbon')?.getBoundingClientRect().width ?? 0) * 10) / 10,
      });
    };
    const timer = window.setInterval(sample, 12);
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['data-intake-phase', 'style']});
    w.__intakeProbe = {samples, stop: () => {
      window.clearInterval(timer);
      mo.disconnect();
    }};
  }, seat);
}

/** A STORYBOARD of the scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
async function storyboard(page: Page, preset: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const dir = path.join(OUT, preset, `story-${name}`);
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

const readProbe = (page: Page) => page.evaluate(() => {
  const w = window as unknown as {__intakeProbe?: {samples: Array<Sample>, stop: () => void}};
  w.__intakeProbe?.stop();
  return w.__intakeProbe?.samples ?? [];
});

for (const preset of PRESETS) {
  test.describe(`a rival's payout lands on the seat chip's intake · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1});

    test(`red's city on a bonus cell: the intake opens before the token, takes ONE «+N» on its number, ticks and folds (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId: blue, seats} = await bootFixtureSeats(page, request, 'tile-language', {query: preset.query});
      const red = seats.find((s) => s !== blue)!;
      const redColor = (await wireOf(request, red)).thisPlayer.color;
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
      const w = await wireOf(request, red);
      const spaces = new Map((w.game.spaces ?? []).map((s) => [s.id, s]));
      const cell = [...(w.waitingFor?.spaces ?? [])].sort((a, b) => (spaces.get(b)?.bonus?.length ?? 0) - (spaces.get(a)?.bonus?.length ?? 0))[0];
      const printed = spaces.get(cell)?.bonus?.length ?? 0;
      expect(printed, 'the richest legal cell prints a bonus').toBeGreaterThan(0);
      await armTransferWitness(page);
      await armProbe(page, redColor);
      const stopStory = await storyboard(page, preset.id, 'rival-intake');
      await sendPlayerInput(request, red, {type: 'space', spaceId: cell});
      // The scene: the tile lands, the bonus flies, the plaque reads, then folds.
      await expect.poll(() => page.evaluate((color) => document.querySelector(`[data-intake-seat="${color}"]`) !== null, redColor), {timeout: 60_000,
        message: 'red\'s intake opened'}).toBe(true);
      await expect.poll(() => page.evaluate((color) => document.querySelector(`[data-intake-seat="${color}"]`) === null, redColor), {timeout: 20_000,
        message: 'red\'s intake folded'}).toBe(true);
      await settle(page, {timeoutMs: 30_000});
      await stopStory();
      const s = await readProbe(page);
      const wit = await transferWitness(page);
      fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
      const diag = await page.evaluate(() => (window as unknown as {__conColonyDiag?: () => {transfer?: unknown}}).__conColonyDiag?.()?.transfer ?? null);
      fs.writeFileSync(path.join(OUT, preset.id, 'rival-intake-trail.txt'), transferTrail(wit) + '\n' + JSON.stringify(diag) + '\n' + s.map((x) => JSON.stringify(x)).join('\n') + '\n');
      // THE ORDER: the plaque stands EXPECTING before any token is painted.
      const firstChip = s.findIndex((x) => x.chips > 0);
      const firstOpen = s.findIndex((x) => x.intake !== null);
      expect(firstOpen, 'the intake opened').toBeGreaterThanOrEqual(0);
      expect(firstChip, 'a token flew').toBeGreaterThanOrEqual(0);
      expect(firstOpen, 'the receiver announced itself BEFORE the token was born').toBeLessThanOrEqual(firstChip);
      expect(s[firstChip].intake, 'in the frame of the birth the plaque waits').toBe('expecting');
      // ONE token per resource, landed on the plaque's number.
      const births = wit.births.filter((e) => e.under.startsWith('cell:'));
      expect(births.length, `one token per printed resource (trail:\n${transferTrail(wit)})`).toBe(new Set((spaces.get(cell)?.bonus ?? [])).size);
      for (const birth of births) {
        const landed = wit.landings.find((e) => e.id === birth.id);
        expect(landed?.under, 'landed ON red\'s intake').toBe(`intake:${redColor}`);
        expect(landed?.touched, 'its contact beat played').toBeDefined();
      }
      expect(endsOverGlass(wit), 'no end over glass or nothing').toEqual([]);
      // RECEIVED: the number reads the sum, and the plaque stands a read before it folds.
      const received = s.filter((x) => x.intake === 'received');
      expect(received.length, 'the plaque read RECEIVED').toBeGreaterThan(0);
      expect(received[0].nums, 'the sum on the number').toMatch(/^\+\d/);
      const readMs = received[received.length - 1].t - received[0].t;
      expect(readMs, `the plaque stands a read (${readMs} ms)`).toBeGreaterThanOrEqual(700);
      // The ribbon never moved: the plaque is absolute.
      // (measured while the plaque stands — a status relabel before it, «СПАСОВАЛ» / «ДЕЙСТВИЕ», is the chips' own business)
      const widths = new Set(s.filter((x) => x.intake !== null).map((x) => x.ribbonW).filter((v) => v > 0));
      expect(Math.max(...widths) - Math.min(...widths), `the chip ribbon kept its width (${[...widths].join(', ')})`).toBeLessThanOrEqual(0.5);
      await page.screenshot({path: path.join(OUT, preset.id, 'rival-intake-after.png')});
    });
  });
}
