import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, openMandatoryAnnounce, press, pressUntil, reloadConsole, sendPlayerInput, settle,
} from './consoleStart';

/**
 * THE PARLIAMENT'S SITTING — the STRUCTURAL half (Э3 of
 * docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md; docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md):
 * the political phase is ONE flow, «ПАРЛАМЕНТ › ЗАСЕДАНИЕ › <СТАДИЯ>», on the
 * three display profiles.
 *
 *   · ONE announce per generation: the plate says the Parliament is in
 *     session, A opens the sitting; nothing opens by itself;
 *   · the pages: ВЕРДИКТ → ПРИНЯТИЕ → НАГРАДА walked by A, and A on the last
 *     page ANSWERS gate 1 (the server receives the option — never an
 *     auto-answer); the wait pose names the seat still to answer;
 *   · B past the commit = «свернуть»: the board-home card brings the SAME
 *     stage back;
 *   · a reload lands on the server's stage (the plate re-announces the same
 *     sitting, A re-opens it);
 *   · the enacted resolution's ask (Climate Research's take) arrives as a
 *     STEP inside the open sitting — no second plate, no standalone band, the
 *     take stands in the stage's own zone under a continuous crumb;
 *   · the other seat answers over the API, the renewal and the closing
 *     follow, A on the closing answers gate 2, and the workspace leaves with
 *     the phase.
 *
 * The motion half (the director's beats, the 3D deal, the flights) is Э4's
 * `console-parliament-sitting-motion.spec.ts`.
 * Screenshots under screenshots/parliament-sitting/<preset>/.
 */
const OUT_ROOT = path.resolve('screenshots', 'parliament-sitting');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Wire = {
  waitingFor?: {type: string; promptId?: number; cards?: Array<{name: string}>; parliamentPhasePrompt?: {stage: string; awaiting: Array<string>}};
  game: {phase: string; generation: number; parliament?: {phase?: {step: string; awaiting?: Array<string>; pending?: {player: string}}}};
  thisPlayer: {color: string; cardsInHandNbr: number};
};
const wireOf = async (request: APIRequestContext, id: string): Promise<Wire> => await fetchPlayerModel(request, id) as unknown as Wire;

const parliament = (page: Page) => page.locator('.con-parl');
const sitting = (page: Page) => page.locator('.con-sit');
const plate = (page: Page) => page.locator('.con-mandatory');

/** The sitting's stage on screen (the section's own attribute — the server's step under the page cursor). */
async function sittingStage(page: Page): Promise<string> {
  return (await page.locator('.con-parl').getAttribute('data-sitting-stage')) ?? '';
}

/** The command bar's HOT verb (the sitting's A), by its label. */
async function hotVerb(page: Page): Promise<string> {
  const labels = await page.locator('.con-cmdbar__cmd--hot .con-cmdbar__label').allTextContents();
  return labels.map((l) => l.trim()).join(' | ');
}

/** Turn the sitting's page by A until `stage` is on screen (a positive, specific witness). */
async function turnTo(page: Page, stage: string): Promise<boolean> {
  return pressUntil(page, 'Enter', async () => await sittingStage(page) === stage, {tries: 4, settleMs: 1100});
}

/** Nothing of the sitting sticks out of the viewport and no block spills. */
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
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__stage, .con-sit__panel--on, .con-sit__row, .con-sit__closing,' +
      ' .con-iyield, .con-iyield__reading, .con-preact, .con-sit__skip, .con-sit__zone--on, .con-extdraw__cards, .con-cards__slot, .con-task';
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
      if (el.scrollHeight > el.clientHeight + 2 && getComputedStyle(el).overflowY !== 'visible') {
        out.push(`clipped-y ${name(el)} ${el.scrollHeight}>${el.clientHeight}`);
      }
    }
    return out;
  });
  expect(problems, `${label}: layout problems`).toEqual([]);
}

/** The leak detector's own verdict: no stranded prompt was ever reported on this page. */
async function armLeakWitness(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__stranded: Array<string>};
    w.__stranded = [];
    const orig = console.warn.bind(console);
    console.warn = (...args: Array<unknown>) => {
      const text = args.map(String).join(' ');
      if (text.includes('STRANDED PROMPT')) {
        w.__stranded.push(text);
      }
      orig(...args);
    };
  });
}
async function strandedReports(page: Page): Promise<Array<string>> {
  return page.evaluate(() => (window as unknown as {__stranded?: Array<string>}).__stranded ?? []);
}

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

for (const preset of PRESETS) {
  test.describe(`the sitting (${preset.id})`, () => {
    test.use({viewport: preset.viewport});

    test(`the assembly: one announce, the pages by A, gate 1 by A, the wait pose, «свернуть», the reload, the take INSIDE, the closing (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-climate-assembly', {query: preset.query, landing: 'prompt'});
      const red = seats[1];
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(before.game.phase, 'the political phase stands').toBe('parliament');
      expect(before.game.parliament?.phase?.step).toBe('assembly');
      expect(before.waitingFor?.parliamentPhasePrompt?.stage, 'the assembly gate stands for the viewer').toBe('assembly');

      // ── ONE ANNOUNCE: the plate says the Parliament is in session; nothing opened by itself.
      await expect(plate(page), 'the sitting is announced on the board home').toHaveCount(1, {timeout: 30_000});
      await expect(plate(page).locator('.con-mandatory__ask')).toHaveText(/Парламент собрался|is in session/i);
      await expect(plate(page).locator('.con-mandatory__open')).toHaveText(/Открыть заседание|Open the sitting/i);
      await expect(parliament(page), 'the Parliament does not open by itself').toHaveCount(0);
      await shoot(page, preset.id, '00-announce');
      expect(await openMandatoryAnnounce(page), 'A opens the sitting').toBe(true);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      await settle(page, {timeoutMs: 20_000});

      // ── THE CRUMB IS CONTINUOUS: ПАРЛАМЕНТ › ЗАСЕДАНИЕ › ВЕРДИКТ.
      await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
      let crumb = (await crumbText(page)).toUpperCase();
      expect(crumb, `the crumb, got «${crumb}»`).toMatch(/ПАРЛАМЕНТ|PARLIAMENT/);
      expect(crumb).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      expect(crumb).toMatch(/ВЕРДИКТ|VERDICT/);
      await expect(sitting(page).locator('[data-sit-panel="verdict"].con-sit__panel--on [data-sit-row="winner"]'), 'the verdict names the winning player').toHaveCount(1);
      await expect(page.locator('.con-parl__gov--lit'), 'the government is lit at the verdict').toHaveCount(1);
      expect(await hotVerb(page)).toMatch(/Продолжить|Continue/i);
      await expectFits(page, `${preset.id} verdict`);
      await shoot(page, preset.id, '01-verdict');

      // ── B PAST THE COMMIT = «СВЕРНУТЬ»: the board-home card brings the SAME stage back.
      await press(page, 'Escape', 1400);
      await expect(parliament(page), 'the workspace parked').toHaveCount(0, {timeout: 15_000});
      await expect(plate(page), 'the return card on the board home').toHaveCount(1, {timeout: 15_000});
      await expect(plate(page).locator('.con-mandatory__open')).toHaveText(/Вернуться к заседанию|Return to the sitting/i);
      expect((await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt?.stage, 'nothing was answered by the park').toBe('assembly');
      await press(page, 'Enter', 2000);
      await expect(parliament(page), 'the sitting is back').toHaveCount(1, {timeout: 20_000});
      await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
      await settle(page, {timeoutMs: 20_000});

      // ── THE PAGES BY A: ПРИНЯТИЕ, then НАГРАДА — the crumb only ever gains a tail.
      expect(await turnTo(page, 'enact'), 'A turns to the enactment').toBe(true);
      crumb = (await crumbText(page)).toUpperCase();
      expect(crumb).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      expect(crumb).toMatch(/ПРИНЯТИЕ|ENACTMENT/);
      await expect(sitting(page).locator('[data-sit-panel="enact"].con-sit__panel--on'), 'the enactment panel').toHaveCount(1);
      await expect(page.locator('.con-parl__party--lit'), 'the ruling party is lit').toHaveCount(1);
      await expectFits(page, `${preset.id} enactment`);
      await shoot(page, preset.id, '02-enact');
      expect(await turnTo(page, 'reward'), 'A turns to the reward').toBe(true);
      crumb = (await crumbText(page)).toUpperCase();
      expect(crumb).toMatch(/НАГРАДА|REWARD/);
      await expect(sitting(page).locator('[data-sit-panel="reward"].con-sit__panel--on [data-parl-sit-yield]'), 'the reading of what is coming').toHaveCount(1);
      // Climate Research pays this seat (influence 2 → +2 heat production, then cards) — the verb says so.
      expect(await hotVerb(page), 'A on the reward page answers the gate').toMatch(/К награде|To the reward/i);
      expect((await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt?.stage, 'turning the pages answered NOTHING').toBe('assembly');
      await expectFits(page, `${preset.id} reward reading`);
      await shoot(page, preset.id, '03-reward-reading');

      // ── A ON THE LAST PAGE ANSWERS GATE 1: the server receives the option; the other seat is still awaited.
      await press(page, 'Enter', 1500);
      await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt, {timeout: 20_000, message: 'the gate is answered'}).toBeUndefined();
      const answered = await wireOf(request, playerId);
      expect(answered.game.parliament?.phase?.step, 'one answer moves nothing').toBe('assembly');
      expect(answered.game.parliament?.phase?.awaiting).toEqual([(await wireOf(request, red)).thisPlayer.color]);
      await expect(sitting(page).locator('.con-sit__panel--on [data-sit-awaiting]'), 'the wait pose names the seat still to answer').toHaveCount(1, {timeout: 15_000});
      await expect(parliament(page), 'the sitting stays open while the others read').toHaveCount(1);
      expect((await crumbText(page)).toUpperCase()).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      await shoot(page, preset.id, '04-await-others');

      // ── A RELOAD LANDS ON THE SERVER'S STAGE: the sitting is announced again (the device remembers
      //    nothing), A re-opens it on the gate's wait pose — nothing answered is re-asked.
      await reloadConsole(page);
      await armLeakWitness(page);
      await expect(plate(page), 'the same sitting is announced after the reload').toHaveCount(1, {timeout: 30_000});
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('reward');
      await expect(sitting(page).locator('.con-sit__panel--on [data-sit-awaiting]'), 'the wait pose again').toHaveCount(1, {timeout: 15_000});

      // ── THE OTHER SEAT ANSWERS OVER THE API: the effects run — Climate Research draws for blue, and the
      //    TAKE arrives as a STEP INSIDE the open sitting: no second plate, no standalone band.
      const redGate = await wireOf(request, red);
      expect(redGate.waitingFor?.parliamentPhasePrompt?.stage).toBe('assembly');
      await sendPlayerInput(request, red, {type: 'option', promptId: redGate.waitingFor?.promptId} as never);
      await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded'), 'the take stands in the sitting\'s own zone').toHaveCount(1, {timeout: 60_000});
      await expect(page.locator('.con-extdraw.con-ws'), 'never a standalone take workspace').toHaveCount(0);
      await expect(plate(page), 'no second announce inside the sitting').toHaveCount(0);
      await settle(page, {timeoutMs: 20_000});
      crumb = (await crumbText(page)).toUpperCase();
      expect(crumb, `the crumb keeps the sitting, got «${crumb}»`).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      expect(crumb).toMatch(/ПОЛУЧЕНИЕ|INTAKE/);
      await expect(page.locator('.con-parl__gov-card .pcard'), 'exactly one enacted card on screen (carried onto the stage)').toHaveCount(1);
      await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'the card stands on the stage\'s hero slot').toHaveCount(1);
      await expect(page.locator('.con-extdraw .con-cards__slot'), 'two cards were drawn').toHaveCount(2);
      await expectFits(page, `${preset.id} take inside`);
      await shoot(page, preset.id, '05-take-inside');

      // ── THE TAKE: A per card until the surface leaves; the cards reach the hand.
      const handBefore = (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr;
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-extdraw').count() === 0, {tries: 6, settleMs: 2200}), 'the take is taken').toBe(true);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, {timeout: 20_000}).toBe(handBefore + 2);
      await settle(page, {timeoutMs: 30_000});
      await expect(parliament(page), 'the sitting is still on screen after the take').toHaveCount(1);

      // ── RED'S OWN HALF (its draw) over the API; the sitting reads the honest wait meanwhile.
      for (let i = 0; i < 6; i++) {
        const redNow = await wireOf(request, red);
        if (redNow.waitingFor?.type !== 'card') {
          break;
        }
        await sendPlayerInput(request, red, {type: 'card', cards: redNow.waitingFor.cards?.map((c) => c.name) ?? []} as never);
      }

      // ── THE RENEWAL, then the CLOSING; A on the closing answers gate 2.
      await expect.poll(async () => (await wireOf(request, playerId)).game.parliament?.phase?.step, {timeout: 60_000}).toBe('adjourn');
      await expect.poll(() => sittingStage(page), {timeout: 30_000}).toBe('renewal');
      await settle(page, {timeoutMs: 20_000});
      crumb = (await crumbText(page)).toUpperCase();
      expect(crumb).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      expect(crumb).toMatch(/ОБНОВЛЕНИЕ|RENEWAL/);
      await expect(sitting(page).locator('[data-sit-panel="renewal"].con-sit__panel--on [data-sit-row="fresh"]'), 'the fresh resolutions').not.toHaveCount(0);
      await expectFits(page, `${preset.id} renewal`);
      await shoot(page, preset.id, '06-renewal');
      expect(await turnTo(page, 'closing'), 'A turns to the closing').toBe(true);
      crumb = (await crumbText(page)).toUpperCase();
      expect(crumb).toMatch(/ЗАКРЫТИЕ|CLOSING/);
      await expect(sitting(page).locator('[data-sit-panel="closing"].con-sit__panel--on .con-sit__closing'), 'the closing card').toHaveCount(1);
      expect(await hotVerb(page)).toMatch(/Закрыть заседание|Close the sitting/i);
      expect((await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt?.stage, 'gate 2 stands until A').toBe('adjourn');
      await expectFits(page, `${preset.id} closing`);
      await shoot(page, preset.id, '07-closing');
      // B on the terminal closing page is NONE — the workspace stays.
      await press(page, 'Escape', 1000);
      await expect(parliament(page), 'B does nothing on the closing').toHaveCount(1);
      await press(page, 'Enter', 1500);
      await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt, {timeout: 20_000, message: 'gate 2 is answered'}).toBeUndefined();
      await expect(sitting(page).locator('.con-sit__panel--on [data-sit-awaiting]'), 'the closing waits for the other seat').toHaveCount(1, {timeout: 15_000});

      // ── THE OTHER SEAT CLOSES TOO: the phase ends and the workspace LEAVES with it.
      const redAdjourn = await wireOf(request, red);
      expect(redAdjourn.waitingFor?.parliamentPhasePrompt?.stage).toBe('adjourn');
      await sendPlayerInput(request, red, {type: 'option', promptId: redAdjourn.waitingFor?.promptId} as never);
      await expect.poll(async () => (await wireOf(request, playerId)).game.phase, {timeout: 60_000}).not.toBe('parliament');
      await expect(parliament(page), 'the sitting leaves with the phase').toHaveCount(0, {timeout: 30_000});
      expect(await strandedReports(page), 'the leak detector never reported a stranded prompt').toEqual([]);
      await shoot(page, preset.id, '08-after');
    });

    test(`a payout pick arrives INSIDE the sitting under its own stage name; a reload returns to it (${preset.id})`, async ({page, request}) => {
      test.setTimeout(240_000);
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-aquifer-enact', {query: preset.query, landing: 'prompt'});
      await armLeakWitness(page);
      expect((await wireOf(request, playerId)).waitingFor?.type).toBe('card');
      // The plate announces the SITTING (the resolution asking is named as its source), never the pick alone.
      await expect(plate(page)).toHaveCount(1, {timeout: 30_000});
      await expect(plate(page).locator('.con-mandatory__ask')).toHaveText(/Парламент собрался|is in session/i);
      await expect(plate(page).locator('[data-source-resolution="RDX_GREENS_AQUIFER_CONTEST"]'), 'the resolution asking is the plate\'s source').toHaveCount(1);
      await expect(parliament(page)).toHaveCount(0);
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-cards__slot'), 'the two animal holders, inside the sitting').toHaveCount(2, {timeout: 30_000});
      await settle(page, {timeoutMs: 20_000});
      await expect.poll(() => sittingStage(page)).toBe('reward');
      const crumb = (await crumbText(page)).toUpperCase();
      expect(crumb).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      expect(crumb).toMatch(/ВЫБОР|CHOICE/);
      await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'the enacted card carried onto the stage').toHaveClass(/rdx-greens-aquifer-contest/);
      await expect(page.locator('.con-parl__gov-card .pcard'), 'one instance').toHaveCount(1);
      await expect(plate(page), 'no second plate').toHaveCount(0);
      await expectFits(page, `${preset.id} pick inside`);
      await shoot(page, preset.id, '10-pick-inside');
      // A reload returns to the same stage: the same announce, A, the same pick in the same zone.
      await reloadConsole(page);
      await armLeakWitness(page);
      await expect(plate(page)).toHaveCount(1, {timeout: 30_000});
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-cards__slot')).toHaveCount(2, {timeout: 30_000});
      await expect.poll(() => sittingStage(page)).toBe('reward');
      expect((await crumbText(page)).toUpperCase()).toMatch(/ВЫБОР|CHOICE/);
      expect((await wireOf(request, playerId)).waitingFor?.type, 'the pick still stands — nothing was answered for the player').toBe('card');
      expect(await strandedReports(page)).toEqual([]);
    });
  });
}
