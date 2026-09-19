import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openQuickWheel, openZoomViewer, press, pressUntil, settle,
} from './consoleStart';

/**
 * CENTRAL POWER GRID (Turmoil Redux, RX04) — the second card of the «counter +
 * influence → capped production» family, and the one that proves WHAT is
 * counted can differ while the whole mechanism is shared. End to end at the
 * console's real surface, on the three display profiles:
 *
 *   · the FACE: its own 3:2 art (RX04), the Industrialists' emblem, the
 *     formula «1 [M€ production] / [power tag] + [influence]» with the counted
 *     object drawn as the printed TAG medallion (never a card glyph — that
 *     would read «per card» — and never the energy CUBE), the «max 5» row and
 *     the two-power-tags quest;
 *   · the VOTE: the viewer's own reading — «3 + 1 → +4» by the current TAGS and
 *     influence, and apart from it «3 + 2 → +5 · max» if they win (the Agenda
 *     step counts first), where one of the two counted cards is worth two; the
 *     fullscreen footer reads the same numbers and the rules column names each
 *     counted card with its own contribution («… ×2»), while the card that
 *     merely raises energy production is absent;
 *   · the RESULTS SCENE: the enacted card physically moves from its voting
 *     slot into the government (one visible instance all the way), and the
 *     viewer's +5 M€ production — capped from 7 — flies from the card's own
 *     effect block to the resource rail as ONE production chip; the line names
 *     the tags, the influence and the cap; the enacted card's inspector reads
 *     the RECORDED result, never today's tableau.
 *
 * Fixtures: `parliament-powergrid-vote` (blue: Agenda 2, HE3 Fusion Plant ×2 +
 * Biomass Combustors counted, Artificial Photosynthesis not; red: Agenda 5,
 * two power tags) and `parliament-powergrid-recap` (generation 2: the card was
 * enacted from the middle slot, red P 4 + I 3 → +5 capped, blue P 1 → +1).
 * Screenshots under screenshots/parliament-powergrid/<preset>/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-powergrid');
const VIDEO = process.env.PARL_VIDEO === '1';
if (VIDEO) {
  test.use({video: {mode: 'on', size: {width: 1920, height: 1080}}});
}

const GRID_ID = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';
const GRID_INSTANCE = `${GRID_ID}#0`;
const GRID_CLASS = /rdx-industrialists-central-power-grid/;

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

const reading = (context: string, count: number, influence: number, amount: number, uncapped: number): Reading => ({
  context, count: String(count), influence: String(influence), amount: String(amount), uncapped: String(uncapped),
  max: amount >= 5 ? 'true' : null, skipped: null,
});

type Wire = {
  thisPlayer: {color: string, megacreditProduction: number},
  game: {generation: number, parliament: {enacted?: {resolution: string}, lastPhase?: {outcomes?: Array<{player: string, kind: string, amount?: number, count?: number, influence?: number, uncapped?: number, before?: number, after?: number, counted?: Array<string>, countedUnits?: Array<number>}>}}},
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
  test.describe(`Central Power Grid · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the face, the vote's own TAG count + influence reading, the fullscreen with each card's contribution (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixture(page, request, 'parliament-powergrid-vote', {query: preset.query});
      await openParliament(page);

      // ── THE FACE in the voting area: its art (keyed by RX04), the Industrialists' emblem, the counted object as a TAG.
      const face = page.locator(`.con-parl__slot[data-instance="${GRID_INSTANCE}"] .pcard`);
      await expect(face, 'Central Power Grid stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(/pcard--resolution-art/);
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX04');
      expect(await face.locator('.pcard__party-emblem').getAttribute('src'),
        'the gear-and-factory emblem the project already ships — never the globe of the printed card').toContain('industrialists');
      // The mechanics print the power TAG medallion, and never the card glyph of a per-CARD rule.
      const tagIcons = face.locator('.pcard__mech .pcard-ic--tag');
      await expect(tagIcons, 'the printed power tag on the face').toHaveCount(1);
      expect(await tagIcons.first().evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('power.png');
      await expect(face.locator('.pcard__mech .pvpcard'), 'no card glyph: this card counts tags, not cards').toHaveCount(0);
      await expect(face.locator('.pcard__mech'), 'the cap on the face').toContainText(/макс\. 5|max 5/i);
      await expect(face.locator('.pcard__quest-graphic'), 'the two-power-tags quest as a graphic').toHaveCount(1);
      await shoot(page, preset.id, '01-overview');

      // ── THE VOTE MODE: the own-effect block reads the viewer's TAG COUNT and INFLUENCE, the sum and the cap.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      await expect(page.locator('[data-parl-vote-yield]'), 'the tag count + influence → production block').toHaveCount(1);
      // Blue: 3 power tags (one card worth TWO) + influence 1 → +4 now; winning takes the marker to step 3 (influence 2) → 3 + 2 = +5,
      // the maximum — ONE NUMBER on the panel, the win's +1 as its suffix (the captioned forecast plate is the inspector's).
      expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([
        reading('estimate', 3, 1, 4, 4),
      ]);
      await expect(page.locator('[data-parl-vote-yield] .con-iyield__caption'), 'the panel\'s kicker is the caption — the plate prints none').toHaveCount(0);
      await expect(page.locator('[data-parl-vote-yield] [data-parl-vote-suffix]'), 'the win\'s difference as a suffix').toHaveAttribute('data-parl-vote-suffix', '1');
      await expect(page.locator('[data-parl-vote-yield] .con-iyield__suffix--max'), 'the suffix says the win reaches the maximum').toHaveCount(1);
      await expect(page.locator('[data-parl-vote-yield] .con-iyield__unit--prod').first(), 'the unit is PRODUCTION (the brown plate)').toBeVisible();
      await expect(page.locator('[data-parl-vote-yield] .pcglyph[data-count-tag="power"]').first(), 'the counted object in the reading is the printed tag').toBeVisible();
      await expectFits(page, `${preset.id} vote mode`);
      await shoot(page, preset.id, '02-vote-reading');

      // ── THE FULLSCREEN INSPECTOR: the footer reads the same numbers; the rules name each counted card WITH its contribution.
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(GRID_CLASS);
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([
        reading('estimate', 3, 1, 4, 4),
        reading('forecast', 3, 2, 5, 5),
      ]);
      const rules = zoom.locator('.con-zoom-sidecol');
      await expect(rules, 'the rules state the tag qualification in words').toContainText(/энергетическ|power tag/i);
      await expect(rules, 'the counted cards behind the number').toContainText(/Учтены сейчас|Counted right now/);
      await expect(rules, 'the card worth TWO tags says so').toContainText('×2');
      await expect(rules, 'a card that only raises energy production is not counted').not.toContainText(/Искусственный фотосинтез|Artificial Photosynthesis/);
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, preset.id, '03-fullscreen');
      // Paging to another resolution and back re-reads the grid's own numbers at once.
      await press(page, 'BracketRight', 900);
      await expect(zoom.locator('.card-zoom-stage .pcard').first()).not.toHaveClass(GRID_CLASS, {timeout: 10_000});
      await press(page, 'BracketLeft', 900);
      await expect(zoom.locator('.card-zoom-stage .pcard').first()).toHaveClass(GRID_CLASS, {timeout: 10_000});
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([
        reading('estimate', 3, 1, 4, 4),
        reading('forecast', 3, 2, 5, 5),
      ]);
      await closeZoomViewer(page);
      await press(page, 'Escape', 900);
    });

    test(`after the phase: the enacted grid stands in the government, its recorded result is the rail's — the live beats are the sitting's (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-powergrid-recap', {query: preset.query});
      const wire = await wireOf(request, playerId);
      expect(wire.game.parliament.enacted?.resolution).toBe(GRID_ID);
      const mine = wire.game.parliament.lastPhase?.outcomes?.find((o) => o.player === wire.thisPlayer.color);
      expect(mine, 'the server recorded the viewer\'s result').toMatchObject({kind: 'production', amount: 5, count: 4, influence: 3, uncapped: 7, before: 3, after: 8});
      expect(mine?.countedUnits, 'one of the counted cards was worth two tags').toEqual([2, 1, 1]);
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
