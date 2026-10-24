import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, openMandatoryAnnounce, press, pressUntil, reloadConsole, sendPlayerInput, settle,
} from './consoleStart';
import {closeSitting, closeSittingAs, enterSittingByPass, waitSittingAtRest} from './parliamentDrive';


/**
 * THE PARLIAMENT'S SITTING — the STRUCTURAL half (Э3 of
 * docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md; docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md):
 * the political phase is ONE flow, «ПАРЛАМЕНТ › ЗАСЕДАНИЕ › <СТАДИЯ>», on the
 * three display profiles.
 *
 *   · the soft gates: ONE PASS carries the whole sitting; it comes up (risen by
 *     the generation scene, or behind its plate) and the DIRECTOR turns the
 *     pages — the ВЕРДИКТ is read by itself, nothing is pressed until a stop;
 *   · the enacted resolution's ask (Climate Research's take) arrives as a
 *     STEP inside the open sitting — no plate, no standalone band, the take
 *     stands in the stage's own zone under a continuous crumb;
 *   · B past the commit = «свернуть»: the board-home card brings the SAME
 *     stage back;
 *   · a reload lands on the server's stage (the plate re-announces the same
 *     sitting, A re-opens it on the take);
 *   · the other seat answers over the API, the ИТОГИ follow as ONE stop (the
 *     renewal's beats, then the results card), A on the results is the seat's
 *     ONE confirmation «Закрыть заседание» — the viewer is admitted alone, the
 *     other seat still reads its own sitting until it closes it.
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
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__stage, .con-sit__panel--on, .con-sit__row, .con-sit__results,' +
      ' .con-iyield, .con-iyield__reading, .con-preact, .con-band__line, .con-sit__zone--on, .con-extdraw__cards, .con-cards__slot, .con-task';
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

    test(`the sitting: one pass, the verdict read by itself, the take INSIDE, «свернуть», the reload, the results, «Закрыть заседание» (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      // ONE PASS before its sitting (the soft gates): red has passed, blue holds its action menu.
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-climate-assembly', {query: preset.query});
      const red = seats[1];
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      expect(before.game.phase, 'one pass before the sitting').toBe('action');
      expect(before.game.parliament?.phase, 'no sitting yet').toBeUndefined();
      // THE VERDICT PAGE turns by itself (the director's read), so what it shows is SAMPLED on a task clock — never read late.
      await page.evaluate(() => {
        const w = window as unknown as {__verdict: Array<Record<string, unknown>>};
        w.__verdict = [];
        window.setInterval(() => {
          if (document.querySelector('.con-parl')?.getAttribute('data-sitting-stage') !== 'verdict') {
            return;
          }
          w.__verdict.push({
            crumb: (Array.from(document.querySelectorAll('.con-wshead')).map((el) => el.textContent ?? '').join(' ')).toUpperCase(),
            band: document.querySelectorAll('.con-band[data-parl-band-kicker="Verdict"]').length,
            player: document.querySelectorAll('.con-band [data-parl-band-chip="player"]').length,
            resolution: document.querySelectorAll('.con-band [data-parl-band-chip="resolution"]').length,
            row: document.querySelectorAll('.con-parl [data-parl-row-shown]').length,
            winning: document.querySelectorAll('.con-parl__slot--winning').length,
            liveBadge: document.querySelectorAll('.con-parl__slot-win:not(.con-parl__slot-win--verdict)').length,
            verdictSign: document.querySelectorAll('[data-parl-slot-verdict]').length,
            basis: document.querySelector('[data-parl-gov]')?.getAttribute('data-parl-gov-basis') ?? '',
            lit: document.querySelectorAll('.con-parl__gov--lit').length,
          });
        }, 40);
      });

      // ── THE PASS: the whole sitting rides it — up to the law's take of this seat — and the sitting comes up.
      await enterSittingByPass(page, request, playerId);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      const asked = await wireOf(request, playerId);
      expect(asked.game.parliament?.phase?.step, 'the law asks: the phase stands at its effects').toBe('effects');
      expect(asked.waitingFor?.type, 'blue holds the take').toBe('card');

      // ── B DURING THE WALK = «СВЕРНУТЬ» (a reading page — the take's own B is «забрать все»): the board-home card brings
      //    the SAME sitting back, nothing is answered by the park, and the walk goes on where it stood.
      await press(page, 'Escape', 1400);
      await expect(parliament(page), 'the workspace parked').toHaveCount(0, {timeout: 15_000});
      await expect(plate(page), 'the return card on the board home').toHaveCount(1, {timeout: 15_000});
      await expect(plate(page).locator('.con-mandatory__open')).toHaveText(/Вернуться к заседанию|Return to the sitting/i);
      expect((await wireOf(request, playerId)).waitingFor?.type, 'the take still stands on the server').toBe('card');
      await press(page, 'Enter', 2000);
      await expect(parliament(page), 'the sitting is back').toHaveCount(1, {timeout: 20_000});

      // ── THE VERDICT, read on the samples: the crumb continuous, the row of parties the body, the decided table with
      //    the verdict's own sign, the previous government — nothing has happened yet.
      await expect.poll(async () => (await page.evaluate(() => (window as unknown as {__verdict: Array<unknown>}).__verdict.length)), {timeout: 20_000,
        message: 'the verdict page was sampled'}).toBeGreaterThan(0);
      await expect.poll(() => sittingStage(page), {timeout: 30_000, message: 'the verdict turns by itself'}).not.toBe('verdict');
      const verdict = await page.evaluate(() => (window as unknown as {__verdict: Array<Record<string, unknown>>}).__verdict);
      const first = verdict[0];
      expect(String(first.crumb), `the crumb, got «${String(first.crumb)}»`).toMatch(/ПАРЛАМЕНТ|PARLIAMENT/);
      expect(verdict.some((s) => /ЗАСЕДАНИЕ|SITTING/.test(String(s.crumb)) && /ВЕРДИКТ|VERDICT/.test(String(s.crumb))), 'ПАРЛАМЕНТ › ЗАСЕДАНИЕ › ВЕРДИКТ').toBe(true);
      expect(verdict.some((s) => s.band === 1 && s.player === 1 && s.resolution === 1), 'the band reads the verdict: the winning player and the resolution').toBe(true);
      expect(verdict.every((s) => s.row === 1), 'the row of parties is the body: nothing stands over it').toBe(true);
      expect(verdict.every((s) => s.winning === 0 && s.liveBadge === 0), 'no «принимается» on the decided table').toBe(true);
      expect(verdict.some((s) => s.verdictSign === 1), 'the verdict names the winning card with its own sign').toBe(true);
      expect(verdict.every((s) => s.basis === 'Starting rule'), 'the seat keeps the starting rule until the card lands').toBe(true);
      expect(verdict.every((s) => s.lit === 0), 'the government lights only once its new set has landed').toBe(true);

      // ── THE TAKE arrives as a STEP INSIDE the open sitting — no plate, no standalone band — on the REWARD page.
      await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded'), 'the take stands in the sitting\'s own zone').toHaveCount(1, {timeout: 60_000});
      await expect(page.locator('.con-extdraw.con-ws'), 'never a standalone take workspace').toHaveCount(0);
      await expect(plate(page), 'no announce over the open sitting').toHaveCount(0);
      await settle(page, {timeoutMs: 20_000});
      expect(await sittingStage(page), 'the take is a step of the REWARD page').toBe('reward');
      let crumb = (await crumbText(page)).toUpperCase();
      expect(crumb, `the crumb keeps the sitting, got «${crumb}»`).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      expect(crumb).toMatch(/ПОЛУЧЕНИЕ|INTAKE/);
      await expect(page.locator('[data-parl-gov]'), 'the card has landed — the seat reads the enacted resolution').toHaveAttribute('data-parl-gov-basis', 'Enacted resolution');
      await expect(page.locator('.con-parl__gov-card .pcard'), 'exactly one enacted card on screen (carried onto the stage)').toHaveCount(1);
      await expect(page.locator('[data-parl-sit-hero] .con-parl__gov-card .pcard'), 'the card stands on the stage\'s hero slot').toHaveCount(1);
      await expect(page.locator('.con-extdraw .con-cards__slot'), 'two cards were drawn').toHaveCount(2);
      await expectFits(page, `${preset.id} take inside`);
      await shoot(page, preset.id, '05-take-inside');


      // ── A RELOAD LANDS ON THE SERVER'S STAGE: the sitting is announced again (the device remembers nothing), A re-opens
      //    it on the take — nothing answered is re-asked, nothing replays.
      await reloadConsole(page);
      await armLeakWitness(page);
      await expect(plate(page), 'the same sitting is announced after the reload').toHaveCount(1, {timeout: 30_000});
      await expect(plate(page).locator('.con-mandatory__ask')).toHaveText(/^\s*Заседание\s*$|^\s*Sitting\s*$/i);
      await expect(plate(page).locator('.con-mandatory__open'), 'the family\'s own verb on the plate').toContainText(/Открыть|Open/i);
      await shoot(page, preset.id, '00-announce');
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded'), 'the take after the reload').toHaveCount(1, {timeout: 60_000});

      // ── THE TAKE: A per card until the surface leaves; the cards reach the hand.
      const handBefore = (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr;
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-extdraw').count() === 0, {tries: 6, settleMs: 2200}), 'the take is taken').toBe(true);
      await expect.poll(async () => (await wireOf(request, playerId)).thisPlayer.cardsInHandNbr, {timeout: 20_000}).toBe(handBefore + 2);
      await settle(page, {timeoutMs: 30_000});
      await expect(parliament(page), 'the sitting is still on screen after the take').toHaveCount(1);

      // ── RED'S OWN HALF (its draw) over the API; the sitting reads the honest «asking» meanwhile.
      for (let i = 0; i < 6; i++) {
        const redNow = await wireOf(request, red);
        if (redNow.waitingFor?.type !== 'card') {
          break;
        }
        await sendPlayerInput(request, red, {type: 'card', cards: redNow.waitingFor.cards?.map((c) => c.name) ?? []} as never);
      }

      // ── THE RESULTS — ONE stop: the renewal's beats play over the table by themselves, then the card of the
      //    generation's results reveals; the seat's ONE confirmation stands.
      await expect.poll(async () => (await wireOf(request, playerId)).game.parliament?.phase?.step, {timeout: 60_000}).toBe('done');
      await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
      await waitSittingAtRest(page, 40_000);
      await settle(page, {timeoutMs: 20_000});
      crumb = (await crumbText(page)).toUpperCase();
      expect(crumb).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      expect(crumb).toMatch(/ИТОГИ|RESULTS/);
      await expect(sitting(page).locator('[data-sit-panel="results"].con-sit__panel--on [data-sit-results]'), 'the results card').toHaveCount(1);
      await expect(sitting(page).locator('[data-sit-results-hidden]'), 'revealed at rest').toHaveCount(0);
      await expect(sitting(page).locator('[data-sit-results] [data-sit-fresh]'), 'the fresh resolutions').not.toHaveCount(0);
      await expect(page.locator('.con-parl__slot--winning'), 'the refreshed table shows its leader').toHaveCount(1);
      const lobbyRefilled = ((await wireOf(request, playerId)).game.parliament?.phase as {summary?: {lobbyRefilled?: Array<unknown>}} | undefined)?.summary?.lobbyRefilled?.length ?? 0;
      expect(lobbyRefilled, 'the server did refill somebody (the row it replaced was not vacuous)').toBeGreaterThan(0);
      await expect(sitting(page).locator('[data-sit-row="results-lobby"]'), 'no lobby row survives').toHaveCount(0);
      await expect(sitting(page).locator('[data-sit-payout]'), 'a payout row per participating seat — the one thing seen nowhere else').toHaveCount(2);
      await expect(sitting(page).locator('[data-sit-results]'), 'no sentence on the results').not.toContainText(/возвращаются в лобби/);
      expect(await sitting(page).locator('[data-sit-section]').evaluateAll((els) => els.map((el) => el.getAttribute('data-sit-section'))),
        'three sections, and nothing beside them').toEqual(['enacted', 'payouts', 'table']);
      await expect(sitting(page).locator('[data-sit-row="results-nodelegate"]'), 'nobody is voteless, so no row').toHaveCount(0);
      expect(await hotVerb(page)).toMatch(/Закрыть заседание|Close the sitting/i);
      expect((await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt?.stage, 'the seat\'s confirmation stands until A').toBe('close');
      await expectFits(page, `${preset.id} results`);
      await shoot(page, preset.id, '06-results');
      // B on the terminal results page is NONE — the workspace stays.
      await press(page, 'Escape', 1000);
      await expect(parliament(page), 'B does nothing on the results').toHaveCount(1);

      // ── «ЗАКРЫТЬ ЗАСЕДАНИЕ»: blue is admitted to the next generation alone; red still reads its own sitting.
      await closeSitting(page, request, playerId);
      await expect(parliament(page), 'the sitting leaves with its close').toHaveCount(0, {timeout: 30_000});
      expect((await wireOf(request, red)).waitingFor?.parliamentPhasePrompt?.stage, 'red still holds its own confirmation').toBe('close');
      await closeSittingAs(request, red);
      await expect.poll(async () => (await wireOf(request, playerId)).game.parliament?.phase, {timeout: 30_000, message: 'nothing of the sitting is left for blue'}).toBeUndefined();
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
      await expect(plate(page).locator('.con-mandatory__ask')).toHaveText(/Заседание|Sitting/i);
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
