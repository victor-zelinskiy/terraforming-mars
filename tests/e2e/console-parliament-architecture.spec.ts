import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openConsole, openQuickWheel, openZoomViewer, press, pressUntil, settle,
  waitForBoardHome,
} from './consoleStart';

/**
 * ARCHITECTURE AWARD (Turmoil Redux, RX02) — the first resolution whose amount
 * is a COUNT of the tableau plus influence, then capped — end to end at the
 * console's real surface, on the three display profiles:
 *
 *   · the FACE: its own 3:2 art (RX02), the Mars First emblem, the formula
 *     «1 [M€ production] / [Building card with a VP icon] + [influence]» with
 *     the counted object drawn as a CARD (never a bare building tag) and the
 *     «max 5» row, the two-building-tags quest;
 *   · the VOTE: the viewer's own reading — «2 + 2 → +4» by the current cards
 *     and influence, and apart from it «2 + 3 → +5 · max» if they win (the
 *     Agenda step counts first); the fullscreen footer reads the same numbers,
 *     the rules column names WHICH cards were counted, paging to another
 *     resolution and back re-reads them at once; another seat reads its own;
 *   · the RESULTS SCENE: the enacted card physically moves from its voting
 *     slot into the government (one visible instance all the way), and the
 *     viewer's +5 M€ production — capped from 6 — flies from the card's own
 *     effect block to the resource rail as ONE production chip; the line
 *     names the inputs and the cap; the enacted card's inspector reads the
 *     RECORDED result, never today's tableau.
 *
 * Fixtures: `parliament-architecture-vote` (blue: Agenda 4, Artificial Lake +
 * Physics Complex counted, Mine + Biomass Combustors not; red: Agenda 5, five
 * counted) and `parliament-architecture-recap` (generation 2: the award was
 * enacted from the middle slot, blue B 3 + I 3 → +5 capped, red B 1 → +1).
 * Screenshots under screenshots/parliament-architecture/<preset>/; the motion
 * record `PARL_VIDEO=1` → screenshots/parliament-architecture/video/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-architecture');
const VIDEO = process.env.PARL_VIDEO === '1';
if (VIDEO) {
  test.use({video: {mode: 'on', size: {width: 1920, height: 1080}}});
}

const AWARD_ID = 'RDX_MARS_ARCHITECTURE_AWARD';
const AWARD_INSTANCE = `${AWARD_ID}#0`;
const AWARD_CLASS = /rdx-mars-architecture-award/;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  // A recording run takes no stills: a screenshot pauses the screencast and leaves grey frames in the video.
  if (VIDEO) {
    return;
  }
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const parliament = (page: Page) => page.locator('.con-parl');

/** Open the Parliament from the wheel (RT → down). */
async function openParliament(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await parliament(page).count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

type Reading = {context: string | null, count: string | null, influence: string | null, amount: string | null, uncapped: string | null, max: string | null, skipped: string | null};

/** The readings a yield block prints, by context — every input the number stands on. */
const readingsIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    context: el.getAttribute('data-yield-context'),
    count: el.getAttribute('data-yield-count'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
    uncapped: el.getAttribute('data-yield-uncapped'),
    max: el.getAttribute('data-yield-max'),
    skipped: el.getAttribute('data-yield-skipped'),
  }));
}, scope) as Promise<Array<Reading>>;

const reading = (context: string, count: number, influence: number, amount: number, uncapped: number, skipped: string | null = null): Reading => ({
  context, count: String(count), influence: String(influence), amount: String(amount), uncapped: String(uncapped),
  max: amount >= 5 && skipped === null ? 'true' : null, skipped,
});

type Wire = {
  thisPlayer: {color: string, megacreditProduction: number},
  game: {generation: number, parliament: {enacted?: {resolution: string}, lastPhase?: {outcomes?: Array<{player: string, kind: string, amount?: number, count?: number, influence?: number, uncapped?: number, before?: number, after?: number, counted?: Array<string>}>}}},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

/** Nothing of the workspace sticks out of the viewport and no block spills. */
async function expectFits(page: Page, label: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const root = document.querySelector('.con-parl');
    if (root === null) {
      return ['no root'];
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out: Array<string> = [];
    const name = (el: Element) => el.className.toString().split(' ')[0];
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__info, .con-parl__info-block, .con-parl__info-own, .con-parl__stage, .con-iyield, .con-iyield__reading, .con-parl__recap-item';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(blocks))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') {
        continue;
      }
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
        out.push(`off-screen ${name(el)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') {
        out.push(`clipped-x ${name(el)} ${el.scrollWidth}>${el.clientWidth}`);
      }
    }
    // A reading's own parts never spill out of its plate (the counted glyph, the MAX mark).
    for (const plate of Array.from(root.querySelectorAll<HTMLElement>('.con-iyield__reading'))) {
      const box = plate.getBoundingClientRect();
      for (const part of Array.from(plate.querySelectorAll<HTMLElement>('.con-iyield__in, .con-iyield__out, .con-iyield__max'))) {
        const r = part.getBoundingClientRect();
        if (r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1)) {
          out.push(`spill ${name(part)} ${Math.round(r.left)}..${Math.round(r.right)} outside ${Math.round(box.left)}..${Math.round(box.right)}`);
        }
      }
    }
    return out;
  });
  expect(problems, `${label}: layout problems`).toEqual([]);
}

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

for (const preset of PRESETS) {
  test.describe(`Architecture Award · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the face, the vote's own count + influence reading, the fullscreen with the counted cards and its paging (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixture(page, request, 'parliament-architecture-vote', {query: preset.query});
      await openParliament(page);

      // ── THE FACE in the voting area: its art (keyed by RX02), the Mars First emblem, the counted object as a CARD glyph.
      const face = page.locator(`.con-parl__slot[data-instance="${AWARD_INSTANCE}"] .pcard`);
      await expect(face, 'Architecture Award stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(/pcard--resolution-art/);
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX02');
      await expect(face.locator('.pcard__party-emblem'), 'the Mars First emblem').toHaveCount(1);
      await expect(face.locator('.pcard__mech .pvpcard[data-vp-card-tag="building"]'), 'the counted object: a building CARD with a VP plate').toHaveCount(1);
      await expect(face.locator('.pcard__mech .pvpcard__vp'), 'the VP plate on the glyph').toHaveCount(1);
      await expect(face.locator('.pcard__mech'), 'the cap on the face').toContainText(/макс\. 5|max 5/i);
      await expect(face.locator('.pcard__quest-graphic'), 'the two-building-tags quest as a graphic').toHaveCount(1);
      await shoot(page, preset.id, '01-overview');

      // ── THE VOTE MODE: the own-effect block reads the viewer's COUNT and INFLUENCE, the sum and the cap.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      await expect(page.locator('[data-parl-vote-yield]'), 'the count + influence → production block').toHaveCount(1);
      // Blue: 2 counted cards + influence 2 → +4 now; winning takes the marker to step 5 (influence 3) → 2 + 3 = +5, the maximum —
      // ONE NUMBER on the panel, the win's +1 as its suffix (the captioned forecast plate is the inspector's).
      expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([
        reading('estimate', 2, 2, 4, 4),
      ]);
      await expect(page.locator('[data-parl-vote-yield] .con-iyield__caption'), 'the panel\'s kicker is the caption — the plate prints none').toHaveCount(0);
      await expect(page.locator('[data-parl-vote-yield] [data-parl-vote-suffix]'), 'the win\'s difference as a suffix').toHaveAttribute('data-parl-vote-suffix', '1');
      await expect(page.locator('[data-parl-vote-yield] .con-iyield__suffix--max'), 'the suffix says the win reaches the maximum').toHaveCount(1);
      await expect(page.locator('[data-parl-vote-yield] .con-iyield__unit--prod').first(), 'the unit is PRODUCTION (the brown plate)').toBeVisible();
      await expectFits(page, `${preset.id} vote mode`);
      await shoot(page, preset.id, '02-vote-reading');

      // ── THE FULLSCREEN INSPECTOR: the footer reads the same numbers; the rules name the counted cards.
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(AWARD_CLASS);
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([
        reading('estimate', 2, 2, 4, 4),
        reading('forecast', 2, 3, 5, 5),
      ]);
      const rules = zoom.locator('.con-zoom-sidecol');
      await expect(rules, 'the rules state the qualification in words').toContainText(/значок ПО|VP icon/);
      await expect(rules, 'the counted cards behind the number').toContainText(/Учтены сейчас|Counted right now/);
      await expect(rules).toContainText(/Искусственное озеро|Artificial Lake/);
      await expect(rules, 'Mine (no VP icon) is not counted').not.toContainText(/Шахта|\bMine\b/);
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, preset.id, '03-fullscreen');
      // Paging to another resolution re-reads at once — the neighbour is a REAL card with its own
      // reading, so the award's numbers must simply be gone — and back again.
      await press(page, 'BracketRight', 900);
      await expect(zoom.locator('.card-zoom-stage .pcard').first()).not.toHaveClass(AWARD_CLASS, {timeout: 10_000});
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).not.toEqual([
        reading('estimate', 2, 2, 4, 4),
        reading('forecast', 2, 3, 5, 5),
      ]);
      await press(page, 'BracketLeft', 900);
      await expect(zoom.locator('.card-zoom-stage .pcard').first()).toHaveClass(AWARD_CLASS, {timeout: 10_000});
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([
        reading('estimate', 2, 2, 4, 4),
        reading('forecast', 2, 3, 5, 5),
      ]);
      await closeZoomViewer(page);
      await press(page, 'Escape', 900);
    });

    test(`the results scene: the enacted card moves into the government, the capped +5 production flies to the rail (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-architecture-recap', {query: preset.query});
      const wire = await wireOf(request, playerId);
      expect(wire.game.parliament.enacted?.resolution).toBe(AWARD_ID);
      const mine = wire.game.parliament.lastPhase?.outcomes?.find((o) => o.player === wire.thisPlayer.color);
      expect(mine, 'the server recorded the viewer\'s result').toMatchObject({kind: 'production', amount: 5, count: 3, influence: 3, uncapped: 6, before: 3, after: 8});
      expect(wire.thisPlayer.megacreditProduction).toBe(8);

      // A MutationObserver + setInterval probe (never rAF), armed BEFORE the Parliament opens: the card proxy, how
      // many copies of the award are VISIBLE at once, the production chip and its text, and how large a delegate
      // cube in the air ever gets next to a cube at rest in a reserve.
      await page.evaluate(() => {
        type Probe = {
          samples: number, faceFlights: number, maxVisible: number, awaiting: number, chips: number, chipText: string, chipProduction: boolean,
          cubeFlights: number, cubeMaxPx: number, reserveCubePx: number,
        };
        const w = window as unknown as {__awardProbe: Probe};
        w.__awardProbe = {samples: 0, faceFlights: 0, maxVisible: 0, awaiting: 0, chips: 0, chipText: '', chipProduction: false, cubeFlights: 0, cubeMaxPx: 0, reserveCubePx: 0};
        const visible = (el: Element) => {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) {
            return false;
          }
          for (let n: Element | null = el; n !== null; n = n.parentElement) {
            const style = getComputedStyle(n);
            if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.05) {
              return false;
            }
          }
          return true;
        };
        const sample = () => {
          const probe = w.__awardProbe;
          probe.samples++;
          if (document.querySelector('.con-parl__flight--face') !== null) {
            probe.faceFlights = Math.max(probe.faceFlights, 1);
          }
          if (document.querySelector('.con-parl__gov-card--awaiting') !== null) {
            probe.awaiting++;
          }
          // Copies in DIFFERENT places: the landing handoff reveals the destination under the proxy for one
          // frame by design (identical copies, one place) — two faces that overlap are one physical card.
          const rects = Array.from(document.querySelectorAll('.pcard--rdx-mars-architecture-award'))
            .filter((el) => el.closest('dialog') === null && visible(el))
            .map((el) => el.getBoundingClientRect());
          const places: Array<DOMRect> = [];
          for (const r of rects) {
            const same = places.some((p) => {
              const ix = Math.max(0, Math.min(p.right, r.right) - Math.max(p.left, r.left));
              const iy = Math.max(0, Math.min(p.bottom, r.bottom) - Math.max(p.top, r.top));
              const inter = ix * iy;
              return inter / (p.width * p.height + r.width * r.height - inter) > 0.5;
            });
            if (!same) {
              places.push(r);
            }
          }
          probe.maxVisible = Math.max(probe.maxVisible, places.length);
          // A delegate in the air is a CUBE: its box stays the size of the cube it lands as (the lift adds ~12 %).
          for (const cube of Array.from(document.querySelectorAll('.con-parl__flight:not(.con-parl__flight--card) .player-cube'))) {
            if (visible(cube)) {
              probe.cubeFlights = Math.max(probe.cubeFlights, 1);
              probe.cubeMaxPx = Math.max(probe.cubeMaxPx, Math.round(cube.getBoundingClientRect().width));
            }
          }
          for (const cube of Array.from(document.querySelectorAll('[data-parl-seat-reserve] .player-cube'))) {
            probe.reserveCubePx = Math.max(probe.reserveCubePx, Math.round(cube.getBoundingClientRect().width));
          }
          const chips = document.querySelectorAll('.con-transfer__chip');
          if (chips.length > probe.chips) {
            probe.chips = chips.length;
            probe.chipText = (chips[0]?.textContent ?? '').trim();
            probe.chipProduction = chips[0]?.classList.contains('con-transfer__chip--production') ?? false;
          }
        };
        new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style']});
        window.setInterval(sample, 16);
      });

      await openParliament(page);
      const stage = page.locator('.con-parl__stage');
      await expect(stage, 'the results scene takes the stage').toHaveAttribute('data-parl-stage', 'recap', {timeout: 15_000});
      expect((await crumbText(page)).toUpperCase()).toMatch(/ИТОГИ|RESULTS/);
      const items = page.locator('.con-parl__recap-item');
      // A forced frame keeps headless rAF alive while the probe polls; a recording's own screencast already
      // draws frames, and a screenshot would grey them out.
      const pump = async (read: () => Promise<number>) => {
        if (!VIDEO) {
          await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
        }
        return read();
      };
      // Mid-scene: the move and the gain (a frame for the video, and the proof they were on screen).
      await expect.poll(() => pump(() => page.evaluate(() => (window as unknown as {__awardProbe: {faceFlights: number}}).__awardProbe.faceFlights)), {
        timeout: 15_000, intervals: [60], message: 'the enacted card flew from its voting slot',
      }).toBe(1);
      await shoot(page, preset.id, '10-recap-card-move');
      await expect.poll(() => pump(() => page.evaluate(() => (window as unknown as {__awardProbe: {chips: number}}).__awardProbe.chips)), {
        timeout: 20_000, intervals: [60], message: 'the production chip flew',
      }).toBeGreaterThan(0);
      await shoot(page, preset.id, '11-recap-production-flight');
      await expect.poll(() => pump(() => page.locator('.con-parl__recap-item--shown').count()), {timeout: 20_000, intervals: [80], message: 'every beat landed'})
        .toBe(await items.count());
      await expect.poll(() => pump(() => page.locator('.con-parl__flight, .con-transfer__chip').count()), {timeout: 10_000, intervals: [80], message: 'no proxy is left behind'})
        .toBe(0);
      const probe = await page.evaluate(() => (window as unknown as {__awardProbe: Record<string, unknown>}).__awardProbe);
      expect(probe.samples as number, 'the probe ran').toBeGreaterThan(10);
      expect(probe.awaiting as number, `the government face waited for the card (${JSON.stringify(probe)})`).toBeGreaterThan(0);
      expect(probe.maxVisible as number, `never two visible copies of the award (${JSON.stringify(probe)})`).toBe(1);
      expect(probe.chips as number, `ONE production chip carries the whole amount (${JSON.stringify(probe)})`).toBe(1);
      expect(probe.chipText as string).toContain('5');
      expect(probe.chipProduction as boolean, 'the chip is a PRODUCTION chip, not a stock coin').toBe(true);
      // The winner's delegate went home from the enacted card — as a cube, never as a card-sized block.
      expect(probe.cubeFlights as number, `the enacted card's delegate flew home (${JSON.stringify(probe)})`).toBe(1);
      expect(probe.reserveCubePx as number, 'a reserve cube was measured').toBeGreaterThan(0);
      expect(probe.cubeMaxPx as number, `a delegate in the air stays cube-sized (${JSON.stringify(probe)})`).toBeLessThanOrEqual(Math.ceil((probe.reserveCubePx as number) * 2));
      // The line names the result, the cap and the inputs.
      const line = page.locator('.con-parl__recap-item').filter({hasText: /производство M€ \+5|M€ production \+5/});
      await expect(line, 'the viewer\'s production line').toHaveCount(1);
      await expect(line).toContainText(/максимум|the maximum/);
      await expect(line).toContainText(/3 → 8/);
      await expect(line).toContainText(/влияние 3|influence 3/);
      await expect(page.locator('.con-parl__recap-item').filter({hasText: /\+1 \(1 → 2\)/}), 'the other seat\'s own +1').toHaveCount(1);
      await expect(page.locator('[data-parl-gov] .con-parl__gov-card .pcard'), 'the award now stands in the government').toHaveClass(AWARD_CLASS);
      await expectFits(page, `${preset.id} recap`);
      await shoot(page, preset.id, '12-recap');

      // ── A lets the player through; the enacted card's inspector reads the RECORDED result.
      expect(await pressUntil(page, 'Enter', async () => await stage.count() === 0, {tries: 3, settleMs: 800}), 'A closes the results').toBeTruthy();
      await expect(page.locator('[data-parl-enacted-effect]'), 'a finished one-time effect is no standing effect of the government').toHaveCount(0);
      // The government is the second focus zone: walk to it and open the inspector on the enacted card.
      for (let i = 0; i < 4 && await page.locator('.con-parl__gov--focus').count() === 0; i++) {
        await press(page, 'ArrowLeft', 500);
      }
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first()).toHaveClass(AWARD_CLASS);
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([
        {...reading('applied', 3, 3, 5, 6)},
      ]);
      await expect(zoom.locator('.con-zoom-sidecol')).toContainText(/Учтены при принятии|Counted at the enactment/);
      await shoot(page, preset.id, '13-enacted-inspector');
      await closeZoomViewer(page);

      // ── THE OTHER SEAT reads ITS OWN recorded result: one counted card, no influence → +1.
      await openConsole(page, seats[1], preset.query);
      await waitForBoardHome(page, 25);
      await openParliament(page);
      if (await page.locator('.con-parl__stage[data-parl-stage="recap"]').count() > 0) {
        expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__stage').count() === 0, {tries: 4, settleMs: 900})).toBeTruthy();
      }
      for (let i = 0; i < 4 && await page.locator('.con-parl__gov--focus').count() === 0; i++) {
        await press(page, 'ArrowLeft', 500);
      }
      await openZoomViewer(page);
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([reading('applied', 1, 0, 1, 1)]);
      await shoot(page, preset.id, '14-enacted-inspector-other-seat');
      await closeZoomViewer(page);
    });
  });
}
