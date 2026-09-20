import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, press, pressUntil, settle} from './consoleStart';
import {focusParliamentZone, openParliament, parliament, parliamentWire} from './parliamentDrive';

/**
 * THE VOTE'S GEOMETRY STANDS STILL (v2, § Б5). From the press on «Отправить делегата» to the flow's end
 * NOTHING but text, the confirm's state and the cube's flight may change: the three cards keep their
 * boxes (0 px), the info panel keeps its box, the confirm plate keeps its box — a vote from the lobby and
 * a vote from the reserve alike (the reserve's M€ the server pays itself: no bill, no geometry). The
 * pre-v2 mode re-fitted the cards a size smaller for the reserve's landing (measured −94 px of card row
 * at 1080) while the delegate flew. Measured on 1080 and on the TV; the sampler is `setInterval` +
 * `MutationObserver`, never rAF.
 */
type Box = {x: number, y: number, w: number, h: number};
type GeoSample = {t: number, stage: string, boxes: Record<string, Box>, flights: number};
type GeoProbe = {samples: Array<GeoSample>};

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

async function armGeometryProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__voteGeo: GeoProbe};
    w.__voteGeo = {samples: []};
    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return {x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10};
    };
    const sample = () => {
      const boxes: Record<string, Box> = {};
      document.querySelectorAll<HTMLElement>('.con-parl__vrow .con-parl__slot').forEach((el) => {
        boxes[`slot:${el.getAttribute('data-instance')}`] = box(el);
        const card = el.querySelector('.con-parl__card');
        if (card !== null) {
          boxes[`card:${el.getAttribute('data-instance')}`] = box(card);
        }
      });
      for (const sel of ['.con-parl__info', '.con-parl__cta', '.con-parl__vrow', '.con-parl__info-party']) {
        const el = document.querySelector(sel);
        if (el !== null) {
          boxes[sel] = box(el);
        }
      }
      w.__voteGeo.samples.push({
        t: performance.now(),
        stage: document.querySelector('.con-parl')?.getAttribute('data-stage') ?? '',
        boxes,
        flights: document.querySelectorAll('[data-parl-flight]').length,
      });
      if (w.__voteGeo.samples.length > 8000) {
        w.__voteGeo.samples.splice(0, 1000);
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'data-stage']});
    window.setInterval(sample, 16);
  });
}
const readGeometry = (page: Page): Promise<GeoProbe> => page.evaluate(() => (window as unknown as {__voteGeo: GeoProbe}).__voteGeo);

/** Every box that existed in the FIRST sample keeps its size (0 px) in every later sample it exists in. */
function sizeChanges(samples: ReadonlyArray<GeoSample>): Array<string> {
  const base = samples[0]?.boxes ?? {};
  const out: Array<string> = [];
  const seen = new Set<string>();
  samples.forEach((s, i) => {
    for (const key of Object.keys(base)) {
      const b = s.boxes[key];
      if (b === undefined) {
        continue;
      }
      if ((Math.abs(b.w - base[key].w) > 0.5 || Math.abs(b.h - base[key].h) > 0.5) && !seen.has(key)) {
        seen.add(key);
        out.push(`${key}: ${base[key].w}×${base[key].h} → ${b.w}×${b.h} @${i} (${Math.round(s.t - samples[0].t)} ms, stage ${s.stage})`);
      }
    }
  });
  return out;
}

async function voteAndSample(page: Page, label: string): Promise<{changes: Array<string>, samples: number, flights: boolean}> {
  await armGeometryProbe(page);
  await press(page, 'Enter', 200);
  // The flow ends by leaving: the whole workspace is gone once the delegate has landed and been read.
  await expect(parliament(page), `${label}: the vote's flow left`).toHaveCount(0, {timeout: 40_000});
  const probe = await readGeometry(page);
  const withMode = probe.samples.filter((s) => Object.keys(s.boxes).some((k) => k.startsWith('card:')));
  return {changes: sizeChanges(withMode), samples: withMode.length, flights: probe.samples.some((s) => s.flights > 0)};
}

for (const preset of PRESETS) {
  test.describe(`the vote's geometry (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test('from A to the flow\'s end the three cards, the panel and the confirm keep their boxes — a vote from the lobby, then one from the reserve', async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament', {query: preset.query, landing: 'board'});
      const before = await parliamentWire(request, playerId);
      expect(before.game.parliament?.phase, 'the action phase').toBeUndefined();
      // ── The LOBBY delegate.
      await openParliament(page);
      await focusParliamentZone(page, 'voting');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator('[data-parl-cta-cost]')).toHaveAttribute('data-cost-kind', 'free');
      const lobby = await voteAndSample(page, `${preset.id} lobby`);
      expect(lobby.samples, 'the sampler saw the mode').toBeGreaterThan(20);
      expect(lobby.flights, 'the delegate flew').toBe(true);
      expect(lobby.changes, `${preset.id}: not one box changed size during the lobby vote`).toEqual([]);
      await settle(page, {timeoutMs: 30_000});
      // ── The RESERVE delegate (the server pays the M€ itself — no bill, no geometry).
      await openParliament(page);
      await focusParliamentZone(page, 'voting');
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens again').toBe(true);
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator('[data-parl-cta-cost]')).toHaveAttribute('data-cost-kind', 'cost');
      const reserve = await voteAndSample(page, `${preset.id} reserve`);
      expect(reserve.samples).toBeGreaterThan(20);
      expect(reserve.flights, 'the reserve delegate flew').toBe(true);
      expect(reserve.changes, `${preset.id}: not one box changed size during the reserve vote`).toEqual([]);
    });
  });
}
