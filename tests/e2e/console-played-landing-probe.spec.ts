import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, press, settle} from './consoleStart';
import {armWitness} from './witness';

/**
 * «РАЗЫГРАНО» — THE CATEGORY'S LANDING (the owner, 2026-11-01: «when a category opens and the cards fly to their place
 * IN THE CATEGORY — 15–20 automated cards — they skip and bounce on landing: no smooth, premium, seamless touchdown»).
 *
 * A TIMING probe (motion ×1, one worker): the 50-card table, the big «АВТОМАТИЧЕСКИЕ» category opened. A RECORD armed
 * BEFORE the press (`armWitness`) keeps every state the product writes — each airborne proxy's box and opacity and each
 * real slot's card box and paint. It names:
 *   · the HANDOFF error — at the moment the proxies start to dissolve, the distance between each proxy and the real
 *     card painting under it (a mismatch is a visible jump the instant the real card shows);
 *   · the SETTLE motion — how far each real card's box moves after it first paints (a landed card must stand still);
 *   · the APPROACH — each proxy's last frames: a y that dips past its target and comes back is a bounce.
 * The cause it named (PL-1416): the view measured its box off whichever element its layout mounted — the album's box
 * planned a grid, the grid's box (the body minus its air) planned the album — so the open flight was planned for a
 * 24-card grid and the album stood up under it one frame later (handoff error up to 616 px); and the focused card
 * stepped up 0.35rem after the dissolve. Now the plan reads ONE box and the focused proxy lands on the lifted pose:
 * one layout for the whole episode, handoff ≤ 2 px, no landed card moving.
 */

const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'played-landing', PRESET.id);
const TABLE = '.con-played:not(.con-played--embedded)';

type Box = {x: number, y: number, w: number, h: number};
type Frame = {t: number, kind?: string, stackW?: number, proxies: Array<Box & {o: number}>, slots: Array<Box & {name: string, painted: boolean}>, held: boolean, phase: string};

const focusedZone = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('.con-played__family--focused')?.dataset.playedCat ?? '');

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
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 80, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

/** The big zone (24 automated cards — the ALBUM) and a smaller one (whatever layout its count takes — a grid or the
 *  single stage): the plan's box must be the same whichever layout is mounted. */
const ZONES = ['automated', 'active'] as const;

test.describe(`«Разыграно» · the category's landing · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport});

  for (const zone of ZONES) {
    test(`«${zone}» lands without a jump: proxies hand off onto their real cards, landed cards stand still`, async ({page, request}) => {
      test.setTimeout(240_000);
      await bootFixtureSeats(page, request, 'played-table-50', {query: PRESET.query});
      await settle(page);
      for (let i = 0; i < 3 && await page.locator(TABLE).count() === 0; i++) {
        await press(page, 'KeyX', 1200);
      }
      await expect(page.locator(TABLE)).toHaveCount(1);
      await settle(page).catch(() => undefined);
      for (let i = 0; i < 8 && await focusedZone(page) !== zone; i++) {
        await press(page, 'ArrowRight', 300);
      }
      for (let i = 0; i < 8 && await focusedZone(page) !== zone; i++) {
        await press(page, 'ArrowLeft', 300);
      }
      expect(await focusedZone(page)).toBe(zone);
      const count = Number(await page.locator(`[data-played-stack="${zone}"] .con-played__caption-count`).first().textContent() ?? '0');

      // THE RECORD (FLAKE ZERO — `armWitness`, armed before the press): every state the product writes, recorded in the
      // task that writes it (a CSS-only pose through the frame tick), stamped with the page's clock. `settled`: the
      // handoff is a COEXISTENCE claim (a proxy standing over its painted card) — the state a task LEAVES is what a frame
      // can paint.
      const landing = await armWitness<Omit<Frame, 't'>, string>(page, `played-landing-${zone}`, (zoneKey) => {
        const box = (el: Element) => {
          const r = el.getBoundingClientRect();
          return {x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10};
        };
        const view = document.querySelector('.con-played-cat');
        const proxies = [...document.querySelectorAll('.con-played-cat__proxy')].map((el) => ({...box(el), o: Number(getComputedStyle(el).opacity)}));
        const slots = [...document.querySelectorAll('.con-played-cat__slot')].map((slot) => {
          const face = slot.querySelector('.con-played-cat__face > *');
          const lift = slot.querySelector<HTMLElement>('.con-played-cat__lift');
          return {
            ...(face === null ? {x: 0, y: 0, w: 0, h: 0} : box(face)),
            name: slot.getAttribute('data-zoom-slot') ?? '',
            painted: face !== null && lift !== null && getComputedStyle(lift).visibility !== 'hidden',
          };
        });
        const grid = document.querySelector<HTMLElement>('.con-played-cat__grid');
        const albumbox = document.querySelector<HTMLElement>('.con-played-cat__albumbox');
        const stack = document.querySelector(`[data-played-cat="${zoneKey}"]`);
        return {
          kind: albumbox !== null ? `album ${albumbox.clientWidth}x${albumbox.clientHeight}` : grid !== null ? `grid ${grid.clientWidth}x${grid.clientHeight}` : 'none',
          stackW: stack === null ? 0 : Math.round(stack.getBoundingClientRect().width),
          proxies, slots,
          held: view?.classList.contains('con-played-cat--held') === true,
          phase: view === null ? 'none' : (view.classList.contains('con-played-cat--framed') ? 'framed' : 'flying'),
        };
      }, {args: zone, settled: true, max: 20_000});
      const stop = await storyboard(page, zone);
      await press(page, 'Enter', 200);
      // The window is the EPISODE, never a duration: recorded until the proxies are gone over a framed view, then until
      // the screen is at REST (a landed card still moving keeps it busy — and the record sees every pose of it) — a
      // starved renderer stretches the flight, it does not end it early.
      await expect.poll(async () => {
        const last = await landing.last();
        return last !== undefined && last.proxies.length === 0 && last.phase === 'framed';
      }, {timeout: 40_000, message: 'the proxies are gone over a framed view'}).toBe(true);
      await settle(page);
      await stop();
      const recorded = await landing.stop();
      const t0 = recorded[0]?.t ?? 0;
      const frames: Array<Frame> = recorded.map((x) => ({...x.v, t: x.t - t0}));

      // ── the HANDOFF: the first frame the real cards paint while proxies still stand ──
      const handoff = frames.find((f) => f.proxies.length > 0 && f.slots.some((s) => s.painted));
      const handoffErr: Array<number> = [];
      if (handoff !== undefined) {
        for (const p of handoff.proxies.filter((q) => q.o > 0.5)) {
          let best = Infinity;
          for (const s of handoff.slots.filter((q) => q.painted)) {
            best = Math.min(best, Math.hypot(p.x - s.x, p.y - s.y) + Math.abs(p.w - s.w));
          }
          if (best !== Infinity) {
            handoffErr.push(Math.round(best * 10) / 10);
          }
        }
      }
      // ── the SETTLE: how far each real card moves after it first paints ──
      const firstPaint = new Map<string, Box>();
      const settleMove = new Map<string, number>();
      for (const f of frames) {
        for (const s of f.slots) {
          if (!s.painted || s.w === 0) {
            continue;
          }
          const at = firstPaint.get(s.name);
          if (at === undefined) {
            firstPaint.set(s.name, s);
            continue;
          }
          const d = Math.hypot(s.x - at.x, s.y - at.y) + Math.abs(s.w - at.w);
          settleMove.set(s.name, Math.max(settleMove.get(s.name) ?? 0, Math.round(d * 10) / 10));
        }
      }
      // ── the APPROACH: does a proxy's y overshoot (dip past its last y and come back)? ──
      const tracks: Array<Array<Box & {t: number, painted: boolean}>> = [];
      for (const f of frames) {
        const painted = f.slots.some((q) => q.painted);
        f.proxies.forEach((p, i) => {
          // A proxy's mount frame stands at (0, 0) before the director places it — not a pose of the flight.
          if (p.x !== 0 || p.y !== 0) {
            (tracks[i] ??= []).push({...p, t: f.t, painted});
          }
        });
      }
      const dips = tracks.map((tr) => {
        const end = tr[tr.length - 1];
        const after = tr.slice(Math.floor(tr.length * 0.5));
        let worst = {d: 0, t: -1, painted: false};
        for (const p of after) {
          const d = Math.abs(p.y - end.y);
          if (d > worst.d && (p.y - end.y) * (tr[0].y - end.y) < 0) {
            worst = {d, t: p.t, painted: p.painted};
          }
        }
        return {d: Math.round(worst.d * 10) / 10, t: worst.t, painted: worst.painted, from: tr[0].y, to: end.y, endT: end.t};
      });
      const overshoots = dips.map((x) => x.d);

      const report = {
        cards: count,
        frames: frames.length,
        handoffAt: handoff?.t,
        handoffErr: {max: Math.max(0, ...handoffErr), n: handoffErr.length, all: handoffErr},
        settleMove: {max: Math.max(0, ...settleMove.values()), moved: [...settleMove.entries()].filter(([, d]) => d > 1)},
        overshoot: {max: Math.max(0, ...overshoots), worst: dips.reduce<typeof dips[number] | undefined>((a, x) => (a === undefined || x.d > a.d ? x : a), undefined)},
        phases: [...new Set(frames.map((f) => `${f.phase}${f.held ? ':held' : ''}`))],
        kinds: frames.map((f) => `${f.t}:${f.kind}:${f.stackW}`).filter((s, i, a) => i === 0 || s.split(':').slice(1).join(':') !== a[i - 1].split(':').slice(1).join(':')),
      };
      fs.mkdirSync(OUT, {recursive: true});
      fs.writeFileSync(path.join(OUT, `landing-report-${zone}.json`), JSON.stringify({report, frames}, null, 1));
      // A repeat keeps its own evidence: a red in `--repeat-each` is never overwritten by the green run after it.
      fs.writeFileSync(path.join(OUT, `landing-report-${zone}-r${test.info().repeatEachIndex}.json`), JSON.stringify({report, frames}, null, 1));
      console.log(`[played-landing] ${zone} ${JSON.stringify(report)}`);

      // ── the verdict (PL-1416) ──
      const why = JSON.stringify(report);
      // ONE layout for the whole episode: the plan never reads its own result back (grid ↔ album flipped under the flight).
      const layouts = [...new Set(frames.map((f) => f.kind?.split(' ')[0]).filter((k) => k !== undefined && k !== 'none'))];
      expect(layouts, `the view kept one layout · ${why}`).toHaveLength(1);
      expect(handoff, `the real cards painted while the proxies still stood · ${why}`).toBeDefined();
      expect(handoffErr.length, `a proxy stood over a painted card at the handoff · ${why}`).toBeGreaterThan(0);
      expect(Math.max(0, ...handoffErr), `every proxy hands off onto its real card (px) · ${why}`).toBeLessThanOrEqual(2);
      expect(Math.max(0, ...settleMove.values()), `a landed card stands still (the focused one lands LIFTED) · ${why}`).toBeLessThanOrEqual(2);
      expect(Math.max(0, ...overshoots), `no proxy dips past its place (px — sub-pixel rounding aside) · ${why}`).toBeLessThanOrEqual(2);
    });
  }
});
