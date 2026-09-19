import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openQuickWheel, openZoomViewer, press, pressUntil, settle,
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

    test(`after the phase: the enacted award stands in the government, its recorded result is the rail's — the live beats are the sitting's (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-architecture-recap', {query: preset.query});
      const wire = await wireOf(request, playerId);
      expect(wire.game.parliament.enacted?.resolution).toBe(AWARD_ID);
      const mine = wire.game.parliament.lastPhase?.outcomes?.find((o) => o.player === wire.thisPlayer.color);
      expect(mine, 'the server recorded the viewer\'s result').toMatchObject({kind: 'production', amount: 5, count: 3, influence: 3, uncapped: 6, before: 3, after: 8});
      expect(wire.thisPlayer.megacreditProduction).toBe(8);
      // Э3 retired the results scene: the phase plays LIVE as the sitting — the enactment beat carries the card
      // into the government and the reward wave flies the result into the rail (asserted in
      // `console-parliament-sitting-reward.spec.ts`, photographed by `console-parliament-gallery.spec.ts`).
      // After the phase the Parliament opens on the OVERVIEW with the law already standing.
      await openParliament(page);
      await expect(page.locator('.con-parl__stage[data-parl-stage="recap"]'), 'no results scene').toHaveCount(0);
      await expect(page.locator('[data-parl-gov] .con-parl__gov-card .pcard'), 'the enacted card stands in the government').toHaveCount(1);
      expect((await crumbText(page)).toUpperCase(), 'the overview names itself').toContain('ОБЗОР');
      await expectFits(page, `${preset.id} after the phase`);
      await shoot(page, preset.id, '20-after-phase');
    });
  });
}
