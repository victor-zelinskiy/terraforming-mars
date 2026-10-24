import * as fs from 'node:fs';
import * as path from 'node:path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, closeZoomViewer, fetchPlayerModel, focusInfoZone, openCardActions, openZoomViewer, press, pressUntil, settle} from './consoleStart';

/**
 * «ИНФОРМАЦИЯ — ДОСЬЕ, А НЕ ТАБЛИЦА» (TR60). The Information workspace on a SATURATED table (`info-dossier`: blue
 * holds 20 cards, 8 of them actions — 4 live, 2 refused, 2 used — a milestone, an award, two delegates; red keeps its
 * score private). What the probe holds:
 *
 *   (A) THE OVERVIEW IS A DOSSIER OF TWO TIERS — the heroes (the score, the card history) stand over the plates
 *       (actions, effects, parliament), the content reaches the frame's foot, nothing scrolls, every zone stays inside
 *       the frame, and the score's total is the SERVER's;
 *   (B) «ДЕЙСТВИЯ» IN DEPTH IS THE SAME TILES as «Действия карт», hosted READ-ONLY — X opens the card's face, A does
 *       too, and nothing in the whole walk is ever sent;
 *   (C) ANOTHER SEAT IS A READ — the head says so in words, its hidden score is a SEALED cell with the public facts
 *       beside it (its rating is the server's), and no VP number of that seat is printed anywhere;
 *   (D) A ZONE OPENS FROM ITS TILE — the unfolding plate's first painted box is the zone's own box, the frame is
 *       never empty on the way in, B folds back onto the same zone, and LB/RB never blinks the frame;
 *   (E) TR60 — «Гражданские истребители» stands in «Действия карт» as its two variants, and its fighters on the
 *       satellite wear the SET role (one plate, two goods joined by «and»).
 * The probes are `MutationObserver` + `setInterval` samplers (never rAF — a quiet screen stops rAF).
 */
const FIXTURE = 'info-dossier';
const OUT = path.resolve(__dirname, '..', '..', 'screenshots', 'e2e', 'info-dossier');

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=auto'},
] as const;

type Wire = {
  thisPlayer: {color: string, victoryPointsBreakdown: {total: number}},
  players: Array<{color: string, terraformRating: number}>,
};

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${preset}-${name}.png`)});
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posts.push(r.postData() ?? '');
    }
  });
  return posts;
}

async function openInfo(page: Page): Promise<void> {
  expect(await pressUntil(page, 'KeyY', async () => await page.locator('.con-info [data-dossier]').count() > 0, {tries: 4, settleMs: 1100}),
    'the Information workspace opens on Y as the dossier').toBe(true);
  await settle(page, {timeoutMs: 20_000});
}

/** The overview's geometry as data: the two tiers, the frame, what scrolls. */
const overviewOf = (page: Page) => page.evaluate(() => {
  const frame = document.querySelector<HTMLElement>('.con-info__frame');
  const dossier = document.querySelector<HTMLElement>('.con-info [data-dossier]');
  if (frame === null || dossier === null) {
    return null;
  }
  const fr = frame.getBoundingClientRect();
  const rect = (z: string) => {
    const r = dossier.querySelector<HTMLElement>(`[data-zone="${z}"]`)?.getBoundingClientRect();
    return r === undefined ? null : {top: r.top, bottom: r.bottom, left: r.left, right: r.right};
  };
  const zones = Array.from(dossier.querySelectorAll<HTMLElement>('[data-zone]')).map((z) => z.dataset.zone ?? '');
  const scrolling = Array.from(dossier.querySelectorAll<HTMLElement>('*'))
    .filter((e) => e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY))
    .map((e) => e.className.toString().split(' ')[0]);
  const outside = zones.filter((z) => {
    const r = rect(z);
    return r === null || r.top < fr.top - 1 || r.bottom > fr.bottom + 1 || r.left < fr.left - 1 || r.right > fr.right + 1;
  });
  return {
    frame: {top: fr.top, bottom: fr.bottom, height: fr.height},
    zones,
    vp: rect('vp'),
    played: rect('played'),
    plates: ['actions', 'effects', 'parliament'].map(rect).filter((r) => r !== null) as Array<{top: number, bottom: number}>,
    bottom: Math.max(...zones.map((z) => rect(z)?.bottom ?? 0)),
    scrolling,
    outside,
    total: dossier.querySelector('[data-zone="vp"] [data-vpx-total]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  };
});

/** Arm the sampler (MutationObserver + setInterval) over the Information frame. */
async function armFrameProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Sample = {t: number, tick: boolean, unfolding: {left: number, top: number, width: number, height: number} | null, filled: boolean};
    const w = window as unknown as {__dossierProbe?: {samples: Array<Sample>, stop: () => void}};
    w.__dossierProbe?.stop();
    const samples: Array<Sample> = [];
    const t0 = performance.now();
    // The plate unfolds under a CLIP (`descendUnfold`): what is painted is the box minus the clip's inset.
    const painted = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const m = /^inset\(([^)]*)\)/.exec(getComputedStyle(el).clipPath);
      if (m === null) {
        return {left: r.left, top: r.top, width: r.width, height: r.height};
      }
      const px = m[1].split(' round ')[0].trim().split(/\s+/).map((v) => parseFloat(v));
      const [t, rr, b, l] = px.length === 1 ? [px[0], px[0], px[0], px[0]] : px.length === 2 ? [px[0], px[1], px[0], px[1]] :
        px.length === 3 ? [px[0], px[1], px[2], px[1]] : px;
      return {left: r.left + l, top: r.top + t, width: r.width - l - rr, height: r.height - t - b};
    };
    const sample = (tick: boolean) => {
      const plate = document.querySelector<HTMLElement>('.con-info .con-info__unfolding');
      // The frame is FILLED when the overview or a detail host stands in it with a painted box.
      const host = document.querySelector<HTMLElement>('.con-info [data-dossier], .con-info [data-info-zone]');
      const hr = host?.getBoundingClientRect();
      samples.push({
        t: Math.round(performance.now() - t0),
        tick,
        unfolding: plate === null ? null : painted(plate),
        filled: hr !== undefined && hr.width > 0 && hr.height > 0,
      });
    };
    const mo = new MutationObserver(() => sample(false));
    const root = document.querySelector('.con-info') ?? document.body;
    mo.observe(root, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style']});
    const timer = window.setInterval(() => sample(true), 16);
    w.__dossierProbe = {samples, stop: () => {
      mo.disconnect();
      window.clearInterval(timer);
    }};
  });
}

async function readFrameProbe(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {__dossierProbe?: {samples: Array<{t: number, tick: boolean, unfolding: {left: number, top: number, width: number, height: number} | null, filled: boolean}>, stop: () => void}};
    w.__dossierProbe?.stop();
    return w.__dossierProbe?.samples ?? [];
  });
}

const zoneRect = (page: Page, zone: string) => page.evaluate((z) => {
  const r = document.querySelector<HTMLElement>(`.con-info [data-zone="${z}"]`)?.getBoundingClientRect();
  return r === undefined ? null : {left: r.left, top: r.top, width: r.width, height: r.height};
}, zone);

for (const preset of PRESETS) {
  test.describe(`Information · the dossier · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test('(A) the overview is two tiers that fill the frame, (C) another seat is a read', async ({page, request}) => {
      test.setTimeout(300_000);
      const posts = watchPosts(page);
      const {playerId, seats} = await bootFixtureSeats(page, request, FIXTURE, {query: preset.query});
      const wire = await fetchPlayerModel(request, playerId) as unknown as Wire;
      await settle(page);
      await openInfo(page);

      // ── (A) two tiers: the heroes over the plates, the foot reached, nothing scrolls, nothing outside ──
      const o = await overviewOf(page);
      expect(o, 'the dossier stands').not.toBeNull();
      expect(o!.zones, 'the five zones of a human seat in a parliament game').toEqual(expect.arrayContaining(['vp', 'played', 'actions', 'effects', 'parliament']));
      expect(o!.vp, 'the score is a hero').not.toBeNull();
      expect(o!.played, 'the card history is a hero').not.toBeNull();
      expect(o!.plates.length, 'three plates').toBe(3);
      for (const plate of o!.plates) {
        expect(plate.top, 'every plate stands UNDER the heroes').toBeGreaterThanOrEqual(Math.max(o!.vp!.bottom, o!.played!.bottom) - 1);
      }
      expect((o!.bottom - o!.frame.top) / o!.frame.height, 'the content reaches the frame\'s foot (≥ 85 %)').toBeGreaterThanOrEqual(0.85);
      expect(o!.scrolling, 'nothing on the overview scrolls').toEqual([]);
      expect(o!.outside, 'every zone stays inside the frame').toEqual([]);
      expect(o!.total ?? '', 'the score\'s total is the server\'s').toContain(String(wire.thisPlayer.victoryPointsBreakdown.total));
      await expect(page.locator('[data-info-readonly]'), 'the viewer\'s own seat is not a read').toHaveCount(0);
      // The actions plate: the seat's own states by SHAPE (ready · blocked · used), TR60 among them.
      const ownStates = await page.locator('[data-zone="actions"] [data-action-state]')
        .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-action-state') ?? ''))].sort());
      expect(ownStates, 'the own plate reads the three states').toEqual(['blocked', 'ready', 'used']);
      await expect(page.locator('[data-zone="actions"] [data-dossier-action="Civilian Spacefighters"]'), 'TR60 stands on the plate').toHaveCount(1);
      // The parliament plate's delegates are ONE row, by construction.
      const tokenTops = await page.locator('[data-zone="parliament"] .con-dparl__token')
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(tokenTops.length, 'the delegates stand as tokens').toBeGreaterThan(1);
      expect(Math.max(...tokenTops) - Math.min(...tokenTops), `the delegates are one row (${tokenTops.join(', ')})`).toBeLessThanOrEqual(2);
      // Nothing under the TV floor outside a card face (the type-floor law, measured).
      if (preset.id === 'tv4k') {
        const below = await page.evaluate(() => {
          const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
          const floor = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--con-t-floor')) * rem;
          return Array.from(document.querySelectorAll<HTMLElement>('.con-info [data-dossier] *'))
            .filter((el) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== ''))
            .filter((el) => el.closest('.pcard, svg, .gp-glyph') === null && !/^(p?card-)/.test(el.className.toString()))
            .filter((el) => el.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(el).fontSize) + 0.5 < floor)
            .map((el) => `${el.className.toString().split(' ')[0]} «${(el.textContent ?? '').trim().slice(0, 24)}»`);
        });
        expect(below, 'no text of the overview under the TV floor').toEqual([]);
      }
      await shoot(page, preset.id, 'A-overview');

      // ── (C) another seat: the head says «only a read», the score is sealed, the facts are public ──
      const rival = wire.players.find((p) => p.color !== wire.thisPlayer.color);
      expect(rival, 'the fixture seats a rival').toBeDefined();
      expect(await pressUntil(page, 'KeyE', async () => await page.locator('[data-info-readonly]').count() > 0, {tries: 3, settleMs: 1200}),
        'RB walks to the rival, and the head names the read').toBe(true);
      await settle(page);
      await expect(page.locator('[data-info-readonly]')).toHaveText('Состояние соперника — только просмотр');
      const sealed = page.locator('[data-zone="vp"] [data-dossier-sealed]');
      await expect(sealed, 'the rival\'s hidden score is a sealed cell').toHaveCount(1);
      await expect(page.locator('[data-zone="vp"] [data-vpx-total]'), 'no total of the rival is printed').toHaveCount(0);
      await expect(sealed.locator('[data-dossier-public-fact="rating"] .con-dsealed__value'), 'the public rating is the server\'s')
        .toHaveText(String(rival!.terraformRating));
      // Not one VP number of the rival anywhere in the workspace: neither in a `data-*` that speaks of points nor in the
      // score zone's text (the server's own total, read off the rival's own seat).
      const rivalWire = await fetchPlayerModel(request, seats[1]) as unknown as Wire;
      const rivalTotal = String(rivalWire.thisPlayer.victoryPointsBreakdown.total);
      const leaks = await page.evaluate((total) => Array.from(document.querySelectorAll<HTMLElement>('.con-info *'))
        .flatMap((el) => Array.from(el.attributes)
          .filter((a) => /^data-.*vp/i.test(a.name) && a.value.split(/\D+/).includes(total))
          .map((a) => `${a.name}=${a.value}`)), rivalTotal);
      expect(leaks, 'no data-* of the workspace carries the rival\'s total').toEqual([]);
      if (rivalTotal !== String(rival!.terraformRating)) {
        const vpText = await page.locator('[data-zone="vp"]').innerText();
        expect(vpText.split(/\D+/).includes(rivalTotal), `the sealed zone prints no rival total (${rivalTotal}): ${vpText}`).toBe(false);
      }
      const rivalStates = await page.locator('[data-zone="actions"] [data-action-state]')
        .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-action-state') ?? ''))]);
      expect(rivalStates.every((st) => st === 'idle' || st === 'used'), `a rival's plate says only what is public (${rivalStates.join(', ')})`).toBe(true);
      const ro = await overviewOf(page);
      expect(ro!.scrolling, 'the rival\'s overview scrolls nothing').toEqual([]);
      expect(ro!.outside, 'every rival zone stays inside the frame').toEqual([]);
      await shoot(page, preset.id, 'C-rival');
      expect(posts, 'nothing was sent').toEqual([]);
    });

    if (preset.id === 'deck') {
      return;
    }

    test('(B) «Действия» is the same tiles, read-only; (D) a zone opens from its tile and folds back; (E) TR60', async ({page, request}) => {
      test.setTimeout(360_000);
      const posts = watchPosts(page);
      await bootFixtureSeats(page, request, FIXTURE, {query: preset.query});
      await settle(page);
      await openInfo(page);

      // ── (D) the entry: the plate's first box is the zone's own, the frame is never empty ──
      expect(await focusInfoZone(page, 'actions'), 'the ring reaches «Действия»').toBe(true);
      const from = await zoneRect(page, 'actions');
      expect(from, 'the zone has a box').not.toBeNull();
      await armFrameProbe(page);
      expect(await pressUntil(page, 'Enter', async () => await page.locator('[data-info-zone="actions"] .con-dgal__tile').count() > 0, {tries: 3, settleMs: 1200}),
        'A opens the gallery').toBe(true);
      await settle(page);
      const entry = await readFrameProbe(page);
      expect(entry.length, `the sampler ran (${entry.length} samples)`).toBeGreaterThan(5);
      expect(entry.filter((s) => !s.filled).length, 'the frame is never empty on the way in').toBe(0);
      // The START of the unfold is the pose the enter hook writes in the same task as the plate's class (`descendUnfold`
      // is a `fromTo` — its start clip is rendered immediately), so the FIRST sample of either clock that sees the plate
      // reads it. A task-clock sample alone cannot carry the claim: on a loaded 4K run the first `setInterval` tick came
      // after the whole 160 ms door had opened (the final functional run of 2026-10-22: «first plate» 3001 × 1736, the
      // product right). The claim that the door then OPENS is read off the plate's own growth.
      const plates = entry.filter((s) => s.unfolding !== null).map((s) => s.unfolding!);
      const firstPlate = plates[0];
      expect(firstPlate, 'the detail arrives as the zone\'s plate').toBeDefined();
      const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
      const tol = Math.max(24, from!.width * 0.12);
      expect(near(firstPlate!.left, from!.left, tol) && near(firstPlate!.top, from!.top, tol) && near(firstPlate!.width, from!.width, tol * 2),
        `the plate unfolds from the zone's own box (zone ${JSON.stringify(from)} · first plate ${JSON.stringify(firstPlate)})`).toBe(true);
      const widest = Math.max(...plates.map((p) => p.width));
      expect(widest, `…and the door OPENS out of it (widths ${plates.map((p) => Math.round(p.width)).join(' → ')})`)
        .toBeGreaterThan(firstPlate!.width + tol * 2);

      // ── (B) the same tiles, read-only ──
      const gallery = page.locator('[data-info-zone="actions"]');
      await expect(gallery.locator('.con-dgal__tile .con-cardactions__group').first(), 'a tile IS a «Действия карт» group').toBeVisible();
      await expect(gallery.locator('[data-action-group]').first()).toBeVisible();
      await expect(gallery.locator('.con-dgal__tile[data-zoom-slot="Civilian Spacefighters"]'), 'TR60 stands in the gallery').toHaveCount(1);
      await expect(gallery.locator('.con-dgal__tile--wide[data-zoom-slot="Civilian Spacefighters"]'), 'its two variants take two columns').toHaveCount(1);
      await expect(gallery.locator('[data-action-count="used"] b'), 'the legend counts the used actions').toHaveText('2');
      // The verdicts over EVERY page (ONE FRAMEWORK: the seat's Parliament actions stand among the cards and can take the
      // first page) — the cursor walks the pages and comes back to where it stood.
      const verdictSet = new Set<string>();
      const readVerdicts = async () => {
        for (const v of await gallery.locator('[data-action-verdict]').evaluateAll((els) => els.map((e) => e.getAttribute('data-action-verdict') ?? ''))) {
          verdictSet.add(v);
        }
      };
      await readVerdicts();
      let walked = 0;
      for (; walked < 24 && verdictSet.size < 3; walked++) {
        await press(page, 'ArrowRight', 160);
        await readVerdicts();
      }
      for (let i = 0; i < walked; i++) {
        await press(page, 'ArrowLeft', 120);
      }
      const verdicts = [...verdictSet];
      expect(verdicts.length, `the gallery's tiles read their states by the server's verdict (${verdicts.join(', ')})`).toBeGreaterThanOrEqual(3);
      await shoot(page, preset.id, 'B-gallery');
      await openZoomViewer(page, 'KeyX');
      await expect(page.locator('dialog.con-zoom[open]'), 'X opens the card\'s face').toHaveCount(1);
      await closeZoomViewer(page);
      await press(page, 'Enter', 900);
      await expect(page.locator('dialog.con-zoom[open]'), 'A opens the face too — never a submit').toHaveCount(1);
      await closeZoomViewer(page);
      expect(posts, 'the gallery sends nothing').toEqual([]);

      // ── (D) B folds back onto the same zone ──
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-info [data-dossier]').count() > 0, {tries: 3, settleMs: 1200}),
        'B folds the detail back into the overview').toBe(true);
      await settle(page);
      await expect(page.locator('.con-info__zone--actions.con-info__zone--focused'), 'the ring stands on the zone it left').toHaveCount(1);

      // ── (D) LB/RB never blinks the frame ──
      await armFrameProbe(page);
      await press(page, 'KeyE', 1200);
      await settle(page);
      await press(page, 'KeyQ', 1200);
      await settle(page);
      const swap = await readFrameProbe(page);
      expect(swap.length, `the sampler ran (${swap.length} samples)`).toBeGreaterThan(5);
      expect(swap.filter((s) => !s.filled).length, 'the seat switch never empties the frame').toBe(0);
      expect(posts, 'the whole Information walk sent nothing').toEqual([]);

      // ── (E) TR60 in «Действия карт» and on the satellite ──
      await press(page, 'KeyY', 1100);
      await settle(page);
      const holder = page.locator('.con-res-aux [data-aux-cards*="Civilian Spacefighters"]');
      await expect(holder, 'the fighters stand on the satellite').toHaveCount(1);
      await expect(holder.locator('[data-role-set="2"]'), 'their role is ONE plate of a SET of two goods').toHaveCount(1);
      await expect(holder.locator('.con-res-aux__roleand'), 'the goods are joined by «and», never by a slant').toHaveCount(1);
      await openCardActions(page);
      await settle(page);
      await expect(page.locator('.con-cardactions__tile[data-action-card="Civilian Spacefighters"]'), 'TR60 offers its two variants').toHaveCount(2);
      await shoot(page, preset.id, 'E-card-actions');
    });
  });
}
