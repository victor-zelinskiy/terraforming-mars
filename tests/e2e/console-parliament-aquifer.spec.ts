import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixture, bootFixtureSeats, closeZoomViewer, crumbText, fetchPlayerModel, openMandatoryAnnounce, openQuickWheel, openZoomViewer, placeTile,
  placementState, press, pressUntil, sendPlayerInput, settle, waitForBoardHome,
} from './consoleStart';
import {answerGateAs, turnTo, waitSittingAtRest} from './parliamentDrive';

/**
 * AQUIFER CONTEST (Turmoil Redux, RX01) — the first REAL resolution, end to
 * end at the console's real surface, on the three display profiles:
 *
 *   · the FACE: its own 3:2 art (the RX01 pack), the printed code in the
 *     corner stamp, the animal / influence formula and the winner's ocean;
 *   · the VOTE: the info surface reads the viewer's own payout — the estimate
 *     by the current influence and, apart from it, the «if you win» forecast
 *     (the Agenda step of the phase counts first); the fullscreen inspector's
 *     footer reads the same numbers beside the standing chip;
 *   · the ENACTMENT: the political phase asks the viewer where its animals
 *     go — first as an HONEST MANDATORY PROMPT (the board-home plate names
 *     the ask and the resolution as its source; nothing opens by itself), A
 *     opens the Parliament around the SHARED recipient picker (its stage
 *     names the amount, the picker shows Fish and Pets with their own
 *     `current → resulting` and VP readings), the answer pays exactly that,
 *     the winner's ocean is announced the same way and A starts the STANDARD
 *     board placement whose dossier names the resolution as its source, the
 *     other seat is paid by ITS influence, and the generation moves on.
 *
 * Fixtures: `parliament-aquifer-vote` (blue's delegate on the card, blue at
 * Agenda step 2 with Fish + Pets, red at step 5 with Birds) and
 * `parliament-aquifer-enact` (the same table, the phase stopped inside blue's
 * 2-animal pick). Screenshots under screenshots/parliament-aquifer/<preset>/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-aquifer');
const VIDEO = process.env.PARL_VIDEO === '1';
if (VIDEO) {
  test.use({video: {mode: 'on', size: {width: 1920, height: 1080}}});
}

const AQUIFER_ID = 'RDX_GREENS_AQUIFER_CONTEST';
const AQUIFER_INSTANCE = `${AQUIFER_ID}#0`;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
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

type Wire = {
  thisPlayer: {color: string, tableau: Array<{name: string, resources?: number}>, terraformRating: number, megaCredits: number},
  game: {generation: number, phase: string, oceans: number, parliament: {enacted?: {resolution: string}, phase?: {step: string}, lastPhase?: {outcomes?: Array<{player: string, step: string, kind: string, amount?: number, card?: string, space?: string}>}}},
  waitingFor?: {type?: string, title?: unknown, cards?: Array<{name: string}>},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

/** The readings the yield block prints, by context. */
const yieldReadings = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    context: el.getAttribute('data-yield-context'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
  }));
}, scope);

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
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__info, .con-parl__info-block, .con-parl__info-own, .con-parl__stage, .con-iyield, .con-cards__slot';
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

/**
 * The mandatory plate reads WHOLE: no ellipsized line, and the plate stays
 * inside the viewport. (An absolute `left: 50%` box shrink-to-fits into half
 * the root, which cut the Deck's ocean ask to «Выберите место для размещения …».)
 */
async function expectPlateReadsWhole(page: Page, label: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const plate = document.querySelector<HTMLElement>('.con-mandatory');
    if (plate === null) {
      return ['no plate'];
    }
    const out: Array<string> = [];
    const r = plate.getBoundingClientRect();
    if (r.left < -1 || r.right > window.innerWidth + 1) {
      out.push(`off-screen plate ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    for (const el of Array.from(plate.querySelectorAll<HTMLElement>('.con-mandatory__kicker, .con-mandatory__ask, .con-mandatory__src-name'))) {
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push(`cut ${el.className} ${el.scrollWidth}>${el.clientWidth} «${el.textContent?.trim()}»`);
      }
    }
    return out;
  });
  expect(problems, `${label}: the plate does not read whole`).toEqual([]);
}

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

for (const preset of PRESETS) {
  test.describe(`Aquifer Contest · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the face (art, code, formula), the vote's own reading and the inspector's footer (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      // The printed card number is technical information — an opt-in («Настройки» → «Номера карт»).
      // THIS test opts in (the stamp's own rendering is its subject); the enactment test keeps the default.
      await page.addInitScript(() => window.localStorage.setItem('tm_console_card_numbers', '1'));
      await bootFixture(page, request, 'parliament-aquifer-vote', {query: preset.query});
      await openParliament(page);

      // ── THE FACE in the voting area: its own art, its printed code (opted in), both rows of its formula.
      const face = page.locator(`.con-parl__slot[data-instance="${AQUIFER_INSTANCE}"] .pcard`);
      await expect(face, 'Aquifer Contest stands in the voting area').toHaveCount(1);
      await expect(face).toHaveClass(/pcard--resolution-art/);
      await expect(face.locator('.pcard__code'), 'with «card numbers» enabled the code is stamped').toHaveText('RX01');
      const art = await face.locator('.pcard__art img').getAttribute('src');
      expect(art, 'the 3:2 art is keyed by the printed code').toContain('RX01');
      await expect(face.locator('.pcard__party-emblem'), 'the Greens\' emblem').toHaveCount(1);
      await expect(face.locator('.pcard__quest-graphic'), 'the animal-tag quest as a graphic').toHaveCount(1);
      await shoot(page, preset.id, '01-overview');

      // ── THE VOTE MODE: the own-effect block reads the viewer's number.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'the vote mode opens').toBe(true);
      await settle(page, {timeoutMs: 15_000});
      await expect(page.locator('[data-parl-vote-yield]'), 'the influence → animals block').toHaveCount(1);
      const readings = await yieldReadings(page, '[data-parl-vote-yield]');
      // Blue stands at step 2 (influence 1) → 1 animal now; winning advances to step 3 (influence 2) → 2 —
      // ONE NUMBER on the panel, the win's +1 riding it as a suffix (the forecast plate is the inspector's).
      expect(readings).toEqual([
        {context: 'estimate', influence: '1', amount: '1'},
      ]);
      await expect(page.locator('[data-parl-vote-yield] [data-parl-vote-suffix]'), 'the win\'s difference is a suffix of the one reading').toHaveAttribute('data-parl-vote-suffix', '1');
      await expect(page.locator('[data-parl-vote-yield] [data-parl-vote-suffix]')).toHaveAttribute('data-suffix-step', '3');
      await expect(page.locator('[data-parl-vote-yield] [data-yield-note]'), 'blue holds Fish + Pets — no «no recipient» note').toHaveCount(0);
      await expectFits(page, `${preset.id} vote mode`);
      await shoot(page, preset.id, '02-vote-reading');

      // ── THE FULLSCREEN INSPECTOR: the footer carries the same readings beside the standing chip.
      await openZoomViewer(page);
      await expect(page.locator('dialog.con-zoom[open] [data-zoom-yield]'), 'the footer\'s yield chip').toHaveCount(1);
      const footer = await yieldReadings(page, 'dialog.con-zoom[open] [data-zoom-yield]');
      expect(footer.map((r) => r.amount)).toEqual(['1', '2']);
      await expect(page.locator('dialog.con-zoom[open] .card-zoom-stage .pcard .pcard__code')).toHaveText('RX01');
      await shoot(page, preset.id, '03-fullscreen');
      await closeZoomViewer(page);
      await press(page, 'Escape', 900);
    });

    test(`the enactment: the shared picker inside the Parliament, the payout, the winner's ocean, the other seat, the next generation (${preset.id})`, async ({page, request}) => {
      test.setTimeout(360_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-aquifer-enact', {query: preset.query, landing: 'prompt'});
      const before = await wireOf(request, playerId);
      expect(before.game.phase, 'the political phase stands').toBe('parliament');
      expect(before.waitingFor?.cards?.map((c) => c.name).sort()).toEqual(['Fish', 'Pets']);

      // ── AN HONEST MANDATORY PROMPT FIRST: the plate on the board home names the ask and the resolution as its
      //    source; nothing has opened by itself — no Parliament, no picker — until the player presses A.
      const plate = page.locator('.con-mandatory');
      // ONE announce per generation (Э3, law 1): the sitting's own plate covers every ask of the enacted
      // resolution — the pick is a STEP inside it, never a plate of its own.
      await expect(plate, 'the sitting is announced on the board home').toHaveCount(1, {timeout: 30_000});
      await expect(plate.locator('.con-mandatory__kicker')).toHaveText(/Парламент|Parliament/i);
      await expect(page.locator('.con-parl'), 'the Parliament does not open by itself').toHaveCount(0);
      await expect(page.locator('.con-cards__slot'), 'no picker before the press').toHaveCount(0);
      await expectPlateReadsWhole(page, `${preset.id} payout plate`);
      await shoot(page, preset.id, '04a-enact-announce');
      expect(await openMandatoryAnnounce(page), 'A on the plate opens the choice').toBe(true);

      // ── THE PARLIAMENT OPENS AROUND THE PICK: the enactment stage names the payout, the picker stands in its zone.
      await expect(page.locator('.con-sit'), 'the sitting surface').toHaveCount(1, {timeout: 30_000});
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator('.con-sit [data-sit-reward-state]'), 'the reward reads «this payout» until the record lands').toHaveAttribute('data-sit-reward-state', 'This payout');
      const slots = page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-cards__slot');
      await expect(slots, 'the two animal holders, inside the Parliament').toHaveCount(2);
      // ONE instance: the government's own card stands on the payout stage (teleported), none is left behind.
      const enactedFace = page.locator('.con-parl__gov-card .pcard');
      await expect(enactedFace, 'exactly one enacted card on screen').toHaveCount(1);
      await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'carried onto the payout stage').toHaveClass(/rdx-greens-aquifer-contest/);
      await expect(page.locator('[data-parl-sit-hero] .pcard__art img'), 'its own art (keyed by the code)').toHaveAttribute('src', /RX01/);
      await expect(page.locator('.pcard__code, .con-src__plate-code'), 'card numbers are OFF by default — technical information').toHaveCount(0);
      expect(await crumbText(page), 'the crumb names the pick stage of the sitting').toMatch(/ВЫБОР|CHOICE/i);
      // The focused candidate's own reading: current → resulting + VP.
      const impacts = await page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-cards__verdict--impact').allTextContents();
      expect(impacts.length, 'the resource and VP readings of the focused card').toBeGreaterThan(0);
      await expectFits(page, `${preset.id} enactment`);
      await shoot(page, preset.id, '04-enact-picker');

      // ── L3 = THE SOURCE: the resolution inspector lifts the stage's own face; closing it leaves the pick standing.
      await openZoomViewer(page, 'KeyC');
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]'), 'L3 opens the RESOLUTION inspector').toHaveCount(1);
      await expect(page.locator('dialog.con-zoom[open] .card-zoom-stage .pcard'), 'the resolution face on the stage').toHaveClass(/rdx-greens-aquifer-contest/);
      await expect(page.locator('dialog.con-zoom[open] .pcard__code'), 'no number in the inspector either (default off)').toHaveCount(0);
      await shoot(page, preset.id, '04b-enact-source');
      await closeZoomViewer(page);
      await expect(page.locator('.con-sit'), 'inspection does not cancel the payout').toHaveCount(1);
      await expect(slots).toHaveCount(2);
      // ── B = COLLAPSE, never a cancel: the board home offers the return card, A resumes the SAME payout.
      await press(page, 'Escape', 1400);
      await expect(page.locator('.con-mandatory'), 'the return card after the park').toHaveCount(1, {timeout: 15_000});
      expect((await wireOf(request, playerId)).waitingFor?.type, 'the pick still stands on the server').toBe('card');
      await press(page, 'Enter', 2000);
      await expect(page.locator('.con-sit'), 'the payout stage is back').toHaveCount(1, {timeout: 20_000});
      await expect(slots, 'the same two holders').toHaveCount(2, {timeout: 15_000});
      await expect(page.locator('.con-parl__gov-card .pcard'), 'still exactly one enacted card').toHaveCount(1);
      await settle(page, {timeoutMs: 20_000});

      // ── A on the focused card commits the pick. THE PAYOUT FLIES: one chip «+2» leaves the stage's
      //    payout reading and lands on the chosen candidate, whose capsule ticks WHILE the pick is still
      //    on screen; then the flow leaves and the WINNER'S OCEAN is the board's own placement.
      const focusedName = await page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-cards__slot--focused').getAttribute('data-zoom-slot');
      // A MutationObserver + setInterval probe (never rAF — headless starves it on a quiet screen), armed BEFORE the press.
      await page.evaluate((card) => {
        const w = window as unknown as {__payoutProbe: {samples: number, chips: number, chipText: string, tick: string}};
        w.__payoutProbe = {samples: 0, chips: 0, chipText: '', tick: ''};
        const sample = () => {
          const probe = w.__payoutProbe;
          probe.samples++;
          const chips = document.querySelectorAll('.con-transfer__chip');
          if (chips.length > probe.chips) {
            probe.chips = chips.length;
            probe.chipText = (chips[0]?.textContent ?? '').trim();
          }
          const capsule = document.querySelector(`.con-parl [data-embed-slot="parliament-stage"] .con-cards__slot[data-zoom-slot="${card}"] .pcard__res-count`);
          if (capsule !== null && (capsule.textContent ?? '').trim() !== '0') {
            probe.tick = (capsule.textContent ?? '').trim();
          }
        };
        new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, characterData: true});
        window.setInterval(sample, 16);
      }, focusedName);
      await press(page, 'Enter', 1200);
      await expect.poll(async () => page.evaluate(() => (window as unknown as {__payoutProbe: {tick: string}}).__payoutProbe.tick), {
        timeout: 20_000, message: 'the chosen card\'s capsule ticks to the payout while the pick is on screen',
      }).toBe('2');
      const probe = await page.evaluate(() => (window as unknown as {__payoutProbe: {samples: number, chips: number, chipText: string}}).__payoutProbe);
      expect(probe.samples, 'the probe ran').toBeGreaterThan(10);
      expect(probe.chips, `one payout chip flew (${JSON.stringify(probe)})`).toBe(1);
      expect(probe.chipText).toContain('+2');
      // ── THE WINNER'S OCEAN is a STEP of the same sitting (Э3/Э5): the reward stage yields the stack to the
      //    board — no second plate, no second press — and the standard placement comes alive.
      await expect.poll(async () => await placementState(page), {timeout: 60_000, message: 'the winner\'s ocean placement stands'}).not.toBe('none');
      const mid = await wireOf(request, playerId);
      const holder = mid.thisPlayer.tableau.find((c) => c.name === focusedName);
      expect(holder?.resources, `the animals landed on ${focusedName}`).toBe(2);
      expect(mid.waitingFor?.type).toBe('space');
      await expect(plate, 'no plate of its own for a step inside the sitting').toHaveCount(0);
      await settle(page, {timeoutMs: 20_000});
      // The dossier names the resolution as the placement's source (the shared source plate).
      const dossier = page.locator('.con-context');
      await expect(dossier.locator('.con-src__plate-name, .con-src__card'), 'the placement\'s source is the resolution').toHaveCount(1);
      await shoot(page, preset.id, '05-ocean-placement');
      expect(await placeTile(page), 'the ocean is placed through the standard two-press flow').toBe(true);
      await settle(page, {timeoutMs: 30_000});

      // ── RED is paid by ITS influence (step 5 = 3 animals onto Birds); the phase then finishes.
      const red = seats[1];
      await expect.poll(async () => (await wireOf(request, red)).waitingFor?.type, {timeout: 30_000}).toBe('card');
      const redPick = await wireOf(request, red);
      expect(redPick.waitingFor?.cards?.map((c) => c.name)).toEqual(['Birds']);
      await sendPlayerInput(request, red, {type: 'card', cards: ['Birds']});
      // Э1/Э3: the phase ends through the ADJOURN gate — the sitting comes back to the viewer (renewal → closing),
      // A on the closing answers the viewer's gate, the other seat answers over the API.
      await expect(parliament(page), 'the sitting is back after the board').toHaveCount(1, {timeout: 60_000});
      await waitSittingAtRest(page, 30_000);
      expect(await turnTo(page, 'closing'), 'the closing page').toBe(true);
      await press(page, 'Enter', 1200);
      await answerGateAs(request, red, 'adjourn');
      await expect.poll(async () => (await wireOf(request, playerId)).game.generation, {timeout: 60_000}).toBe(2);
      const after = await wireOf(request, playerId);
      expect(after.game.oceans, 'one ocean on Mars').toBe(1);
      expect(after.thisPlayer.terraformRating, 'the ocean\'s TR').toBe(mid.thisPlayer.terraformRating + 1);
      expect(after.game.parliament.enacted?.resolution).toBe(AQUIFER_ID);
      const outcomes = after.game.parliament.lastPhase?.outcomes ?? [];
      expect(outcomes.map((o) => `${o.player}:${o.step}:${o.kind}:${o.amount ?? ''}`).sort()).toEqual([
        `${after.thisPlayer.color}:animals:cardResource:2`,
        `${after.thisPlayer.color}:ocean:ocean:`,
        // Э1: the ruling party's answer is a RECORD too (the Greens: 2 M€ per TR step of the ocean).
        `${after.thisPlayer.color}:ocean:reaction:2`,
        `${redPick.thisPlayer.color}:animals:cardResource:3`,
      ].sort());
      const redAfter = await wireOf(request, red);
      expect(redAfter.thisPlayer.tableau.find((c) => c.name === 'Birds')?.resources).toBe(3);
      await waitForBoardHome(page);
      await shoot(page, preset.id, '06-after');
    });
  });
}
