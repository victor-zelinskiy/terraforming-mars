import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openMandatoryAnnounce, openQuickWheel,
  openZoomViewer, press, pressUntil, settle,
} from './consoleStart';

/**
 * CLIMATE RESEARCH (Turmoil Redux, RX05) — the first SEQUENTIAL resolution:
 * part two is divided from the total part one leaves behind. End to end at the
 * console's real surface, on the three display profiles:
 *
 *   · the FACE: its own 3:2 art (RX05), the Greens' tree emblem, two rows for
 *     two readings — «[heat PRODUCTION] / [influence]» and «[project card] /
 *     3 [heat PRODUCTION]» (the production plate both times, never the bare
 *     heat cube; no «max» row — this card has no cap), and the +3 heat
 *     production quest as a graphic;
 *   · the VOTE: the viewer's own chain — «[influence] 2 → +2 [heat production]»
 *     and «[heat production] 4 → 6 → +2 [card]» — plus the RULING PARTY's
 *     answer stated apart from it: the Greens' +2 M€ production;
 *   · the ENACTMENT: the mandatory plate names the resolution, A walks into the
 *     Parliament, and the premium TAKE surface stands INSIDE the enactment
 *     stage (one crumb, «ПАРЛАМЕНТ › ПРИНЯТИЕ › ПОЛУЧЕНИЕ», never a second
 *     workspace over it); the cards are withheld from the hand until taken,
 *     X inspects, and the political phase waits for all of it;
 *   · the RESULTS SCENE: both halves of every seat's result are named.
 *
 * Fixtures: `parliament-climate-vote` (blue: Agenda 3 = influence 2, heat
 * production 4 → 6 → 2 cards), `parliament-climate-enact` (the phase stopped
 * inside blue's take) and `parliament-climate-recap` (generation 2).
 * Screenshots under screenshots/parliament-climate/<preset>/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-climate');
const VIDEO = process.env.PARL_VIDEO === '1';
if (VIDEO) {
  test.use({video: {mode: 'on', size: {width: 1920, height: 1080}}});
}

const CLIMATE_ID = 'RDX_GREENS_CLIMATE_RESEARCH';
const CLIMATE_INSTANCE = `${CLIMATE_ID}#0`;
const CLIMATE_CLASS = /rdx-greens-climate-research/;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
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

type Reading = {
  context: string | null, influence: string | null, amount: string | null,
  before: string | null, after: string | null, skipped: string | null,
};

/** Every reading a yield block prints — with the sequential total it stands on. */
const readingsIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    context: el.getAttribute('data-yield-context'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
    before: el.getAttribute('data-yield-total-before'),
    after: el.getAttribute('data-yield-total-after'),
    skipped: el.getAttribute('data-yield-skipped'),
  }));
}, scope) as Promise<Array<Reading>>;

type Wire = {
  thisPlayer: {color: string, heatProduction: number, megacreditProduction: number, cardsInHandNbr: number},
  game: {generation: number, parliament: {enacted?: {resolution: string}, lastPhase?: {outcomes?: Array<{
    player: string, step: string, kind: string, amount?: number, drawn?: number, influence?: number,
    before?: number, after?: number, total?: {before: number, after: number},
  }>}}},
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
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__info, .con-parl__info-block, .con-parl__info-own,' +
      ' .con-parl__stage, .con-iyield, .con-iyield__reading, .con-preact, .con-parl__recap-item,' +
      ' .con-parl__enact-hero, .con-extdraw__cards, .con-cards__slot';
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
  test.describe(`Climate Research · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the face, the chained vote reading and the ruling party's answer (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixture(page, request, 'parliament-climate-vote', {query: preset.query});
      await openParliament(page);

      // ── THE FACE: its own art (keyed by RX05), the Greens' emblem, and the
      //    two printed rows — PRODUCTION plates, a project card, no cap.
      const face = page.locator(`.con-parl__slot[data-instance="${CLIMATE_INSTANCE}"] .pcard`);
      await expect(face, 'Climate Research stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(/pcard--resolution-art/);
      expect(await face.locator('.pcard__art img').getAttribute('src'), 'the 3:2 art is keyed by the printed code').toContain('RX05');
      expect(await face.locator('.pcard__party-emblem').getAttribute('src'), 'the Greens\' tree').toContain('greens');
      const prodBoxes = face.locator('.pcard__mech .pcard-prod');
      await expect(prodBoxes, 'BOTH rows read production, never the bare heat cube').toHaveCount(2);
      // The draw's object is the PROJECT CARD cover (never the resolution deck's back).
      const drawGlyph = face.locator('.pcard__mech .pcard-ic').filter({has: page.locator('nothing')});
      expect(await face.locator('.pcard__mech .pcard-ic').evaluateAll(
        (els) => els.filter((el) => getComputedStyle(el).backgroundImage.includes('card')).length),
      'the project card of the draw').toBeGreaterThan(0);
      expect(drawGlyph).toBeDefined();
      await expect(face.locator('.pcard__mech'), 'this card has no maximum').not.toContainText(/макс|max/i);
      await expect(face.locator('.pcard__quest-graphic'), 'the +3 heat production quest as a graphic').toHaveCount(1);
      await shoot(page, preset.id, '01-overview');

      // ── THE VOTE MODE: the whole chain, and the ruling party's answer apart from it.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}),
        'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      await expect(page.locator('[data-parl-vote-yield]'), 'the chained reading block').toHaveCount(1);
      // Blue: Agenda 3 = influence 2 (winning → step 4 keeps influence 2, so no
      // second forecast), heat production 4 → 6 → 2 cards.
      expect(await readingsIn(page, '[data-parl-vote-yield]')).toEqual([
        {context: 'estimate', influence: '2', amount: '2', before: null, after: null, skipped: null},
        {context: 'estimate', influence: '2', amount: '2', before: '4', after: '6', skipped: null},
      ]);
      await expect(page.locator('[data-parl-vote-yield] .con-iyield__unit--prod').first(), 'the raise is PRODUCTION (the brown plate)').toBeVisible();
      // …and the Greens' own answer to the raise: +2 M€ PRODUCTION.
      const reaction = page.locator('[data-parl-vote-reaction]');
      await expect(reaction, 'the ruling party answers the raise').toHaveCount(1);
      await expect(reaction).toHaveAttribute('data-reaction-party', 'Greens');
      await expect(reaction).toHaveAttribute('data-reaction-amount', '2');
      await expect(reaction.locator('.con-preact__unit--prod').first(), 'M€ PRODUCTION, never cash').toBeVisible();
      await expectFits(page, `${preset.id} vote mode`);
      await shoot(page, preset.id, '02-vote-reading');

      // ── THE FULLSCREEN INSPECTOR: the same numbers, in words beside them.
      await openZoomViewer(page);
      const zoom = page.locator('dialog.con-zoom[open]');
      await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(CLIMATE_CLASS);
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom[open] [data-zoom-yield]'), {timeout: 10_000}).toEqual([
        {context: 'estimate', influence: '2', amount: '2', before: null, after: null, skipped: null},
        {context: 'estimate', influence: '2', amount: '2', before: '4', after: '6', skipped: null},
      ]);
      const rules = zoom.locator('.con-zoom-rules').last();
      await expect(rules, 'the rules state both halves in words').toContainText(/производство тепла|heat production/i);
      await expect(rules, '…including the second half').toContainText(/3 шага|3 steps/i);
      // …and the ruling party's answer rides the footer beside the numbers.
      await expect(zoom.locator('[data-zoom-reaction]'), 'the party answer in the footer').toHaveCount(1);
      await shoot(page, preset.id, '03-fullscreen');
      await closeZoomViewer(page);
      await press(page, 'Escape', 900);
    });

    test(`the enactment: the take stands INSIDE the stage, the cards reach the hand, the phase waits (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      // The fixture resumes ON the take — a prompt that owns the screen, so the
      // driver waits for quiet instead of walking to a board home the player
      // never lands on.
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-climate-enact', {query: preset.query, landing: 'prompt'});
      const before = await wireOf(request, playerId);
      expect(before.thisPlayer.heatProduction, 'the raise already landed (4 + influence 2)').toBe(6);
      expect(before.thisPlayer.megacreditProduction, 'the ruling Greens answered it').toBeGreaterThanOrEqual(2);
      // The seat bought cards during the start flow, so the hand is not empty —
      // what matters is that the DRAWN pair is not in it yet.
      const handBefore = before.thisPlayer.cardsInHandNbr;

      // ── The mandatory PLATE names the resolution and A walks into the
      //    Parliament — unless the resume already landed the player inside the
      //    flow they never left, which is what this fixture models.
      if (await parliament(page).count() === 0) {
        expect(await openMandatoryAnnounce(page), 'the take is announced, never auto-opened').toBe(true);
        await settle(page, {timeoutMs: 20_000});
      }
      await expect(parliament(page), 'the Parliament hosts it — never a second workspace over it').toHaveCount(1, {timeout: 20_000});

      // ── THE TAKE IS EMBEDDED: one instance, inside the stage's own zone.
      const take = page.locator('.con-extdraw');
      await expect(take, 'the premium take surface is on screen').toHaveCount(1, {timeout: 20_000});
      await expect(take, '…host-agnostic: no plate of its own').toHaveClass(/con-extdraw--embedded/);
      await expect(page.locator('.con-extdraw .con-wshead'), 'the crumb belongs to the host').toHaveCount(0);
      expect(await page.locator('.con-parl [data-embed-slot="parliament-enact"] .con-extdraw').count(),
        'the surface stands in the enactment stage\'s own zone').toBe(1);
      const crumb = (await crumbText(page)).toUpperCase();
      expect(crumb, `one continuous crumb, got «${crumb}»`).toMatch(/ПАРЛАМЕНТ|PARLIAMENT/);
      expect(crumb).toMatch(/ПОЛУЧЕНИЕ|INTAKE/);
      // The SOURCE is the resolution — its own face, not a project card.
      await expect(page.locator('.con-extdraw__source .pcard').first(), 'the source dock draws the resolution').toHaveClass(CLIMATE_CLASS);
      await expect(page.locator('.con-extdraw .con-cards__slot'), 'two cards were drawn (production 6 / 3)').toHaveCount(2);
      await expectFits(page, `${preset.id} enactment take`);
      await shoot(page, preset.id, '10-enact-take');

      // ── X inspects and comes back with the batch untouched.
      await openZoomViewer(page);
      await expect(page.locator('dialog.con-zoom[open]')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, preset.id, '11-enact-inspect');
      await closeZoomViewer(page);
      // The close is a flight: the row is measured again on the way back, so the
      // claim is polled (a one-shot count can land inside the handoff frame).
      await expect.poll(() => page.locator('.con-extdraw .con-cards__slot').count(), {timeout: 20_000, intervals: [150]})
        .toBe(2);
      expect((await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, 'and took nothing').toBe(handBefore);

      // ── A takes one, the row keeps its layout (a ghost seat), the phase still waits.
      await press(page, 'Enter', 1600);
      await settle(page, {timeoutMs: 20_000});
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, {timeout: 20_000})
        .toBeGreaterThanOrEqual(handBefore + 1);
      await expect(page.locator('.con-extdraw__slot--ghost'), 'the taken card leaves a quiet ghost seat').toHaveCount(1, {timeout: 10_000});

      // ── …and the rest: the political phase moves on only when the take is done.
      await pressUntil(page, 'Enter', async () => await page.locator('.con-extdraw').count() === 0, {tries: 6, settleMs: 1600});
      await settle(page, {timeoutMs: 25_000});
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.cardsInHandNbr, 'both drawn cards reached the hand').toBe(handBefore + 2);
      await shoot(page, preset.id, '12-enact-done');
    });

    test(`a BIG draw shows every card at a readable size, nothing trimmed (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-climate-big', {query: preset.query, landing: 'prompt'});
      expect((await wireOf(request, playerId)).thisPlayer.heatProduction, '17 + influence 2').toBe(19);
      if (await parliament(page).count() === 0) {
        expect(await openMandatoryAnnounce(page)).toBe(true);
        await settle(page, {timeoutMs: 20_000});
      }
      await expect(page.locator('.con-extdraw'), 'the take stands').toHaveCount(1, {timeout: 20_000});
      await expect(page.locator('.con-extdraw .con-cards__slot'), '19 / 3 = SIX cards, none trimmed to fit').toHaveCount(6, {timeout: 20_000});
      await settle(page, {timeoutMs: 20_000});
      // Every card is a READABLE object: a real face, and no slot smaller than a
      // fifth of the stage zone's height (the fit engine wraps, it never drops).
      const verdict = await page.evaluate(() => {
        const zone = document.querySelector<HTMLElement>('.con-parl__enact-zone');
        const slots = Array.from(document.querySelectorAll<HTMLElement>('.con-extdraw .con-cards__slot'));
        const zoneBox = zone?.getBoundingClientRect();
        return {
          zoneH: Math.round(zoneBox?.height ?? 0),
          faces: slots.filter((s) => s.querySelector('.pcard') !== null).length,
          minH: Math.min(...slots.map((s) => Math.round(s.getBoundingClientRect().height))),
          overflow: slots.filter((s) => {
            const r = s.getBoundingClientRect();
            return zoneBox === undefined || r.bottom > zoneBox.bottom + 1 || r.top < zoneBox.top - 1 ||
              r.right > zoneBox.right + 1 || r.left < zoneBox.left - 1;
          }).length,
        };
      });
      expect(verdict.faces, `every slot draws a real card face (${JSON.stringify(verdict)})`).toBe(6);
      expect(verdict.overflow, `no card is cut by the stage zone (${JSON.stringify(verdict)})`).toBe(0);
      expect(verdict.minH, `no card is shrunk below a readable size (${JSON.stringify(verdict)})`)
        .toBeGreaterThan(verdict.zoneH / 5);
      await expectFits(page, `${preset.id} big draw`);
      await shoot(page, preset.id, '13-enact-big-draw');
    });

    test(`the results scene names BOTH halves of every seat's result (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-climate-recap', {query: preset.query});
      const wire = await wireOf(request, playerId);
      expect(wire.game.parliament.enacted?.resolution).toBe(CLIMATE_ID);
      const outcomes = wire.game.parliament.lastPhase?.outcomes ?? [];
      const raise = outcomes.find((o) => o.player === wire.thisPlayer.color && o.step === 'heat-production');
      const draw = outcomes.find((o) => o.player === wire.thisPlayer.color && o.step === 'draw');
      expect(raise, 'the server recorded the raise').toMatchObject({kind: 'production'});
      expect(draw, 'and the draw it was divided into').toMatchObject({kind: 'cards'});
      expect(draw?.total, 'with the total the division stood on').toBeDefined();

      await openParliament(page);
      const stage = page.locator('.con-parl__stage');
      await expect(stage, 'the results scene takes the stage').toHaveAttribute('data-parl-stage', 'recap', {timeout: 15_000});
      await expect.poll(() => page.locator('.con-parl__recap-item--shown').count(), {timeout: 25_000, intervals: [120]})
        .toBe(await page.locator('.con-parl__recap-item').count());
      // Both halves are named for the viewer: the production step and the cards.
      await expect(page.locator('.con-parl__recap-item').filter({hasText: /производств|production/i}), 'the raise is named')
        .not.toHaveCount(0);
      await expect(page.locator('.con-parl__recap-item').filter({hasText: /карт|card/i}), 'and the draw').not.toHaveCount(0);
      await expect(page.locator('[data-parl-gov] .con-parl__gov-card .pcard'), 'the card now stands in the government').toHaveClass(CLIMATE_CLASS);
      await expectFits(page, `${preset.id} recap`);
      await shoot(page, preset.id, '20-recap');
    });
  });
}

test.describe('Climate Research · the Polygon stand', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('the sequential family reads on the stand: the chain, the party answer and the catalog entry', async ({page}) => {
    test.setTimeout(240_000);
    await page.goto('/?resolutionsPlayground&consoleProfile=auto');
    await expect(page.locator('[data-resolutions-playground]')).toHaveCount(1, {timeout: 30_000});
    // ▶ …: RX05, addressed BY CODE — the catalog grows, the code does not move.
    const onRx05 = await pressUntil(page, 'ArrowRight',
      async () => await page.locator('[data-rxpg-catalog] .con-rxpg__slot--cursor[data-rxpg-code="RX05"]').count() > 0,
      {tries: 10, settleMs: 350});
    expect(onRx05, 'the catalog cursor reaches RX05').toBe(true);
    const slot = page.locator('[data-rxpg-catalog] .con-rxpg__slot[data-rxpg-code="RX05"]');
    await expect(slot.locator('.pcard')).toHaveClass(/pcard--resolution-art/);
    await expect(slot.locator('.pcard__mech .pcard-prod'), 'both rows read production').toHaveCount(2);
    await shoot(page, 'polygon', '30-catalog');
    // RB → the face at the three sizes + the inspector's columns; RB again → the scenario section.
    await press(page, 'BracketRight', 700);
    await press(page, 'BracketRight', 700);

    // ── The family's opening scenario: heat production 4 → 6 → 2 cards.
    await expect(page.locator('[data-rxpg-scenario="seq-4-to-6"]'), 'the family opens on «4 → 6 — two cards»')
      .toHaveClass(/con-rxpg__scenario--active/, {timeout: 15_000});
    const readings = await readingsIn(page, '[data-rxpg-yield]');
    expect(readings.some((r) => r.before === '4' && r.after === '6' && r.amount === '2'),
      `the chained reading is drawn, got ${JSON.stringify(readings)}`).toBe(true);
    await expect(page.locator('[data-rxpg-reaction]'), 'the ruling party answers beside it').not.toHaveCount(0);
    await shoot(page, 'polygon', '31-stand');
  });
});
