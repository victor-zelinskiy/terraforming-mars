import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootFixtureSeats, crumbText, fetchPlayerModel, openMandatoryAnnounce, press, pressUntil, reloadConsole, sendPlayerInput, settle,
} from './consoleStart';
import {turnTo, waitSittingAtRest} from './parliamentDrive';

/**
 * THE PARLIAMENT'S SITTING — the STRUCTURAL half (Э3 of
 * docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md; docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md):
 * the political phase is ONE flow, «ПАРЛАМЕНТ › ЗАСЕДАНИЕ › <СТАДИЯ>», on the
 * three display profiles.
 *
 *   · ONE announce per generation: the plate says the Parliament is in
 *     session, A opens the sitting; nothing opens by itself;
 *   · «Заседание v2»: A on the ВЕРДИКТ ANSWERS gate 1 (the server receives the
 *     option — never an auto-answer); the wait pose names the seat still to
 *     answer; ПРИНЯТИЕ and НАГРАДА are turned by the DIRECTOR once every seat
 *     has answered — the player presses nothing between the verdict and the
 *     results;
 *   · B past the commit = «свернуть»: the board-home card brings the SAME
 *     stage back;
 *   · a reload lands on the server's stage (the plate re-announces the same
 *     sitting, A re-opens it);
 *   · the enacted resolution's ask (Climate Research's take) arrives as a
 *     STEP inside the open sitting — no second plate, no standalone band, the
 *     take stands in the stage's own zone under a continuous crumb;
 *   · the other seat answers over the API, the ИТОГИ follow as ONE stage
 *     (the renewal's beats, then the results card), A on the results answers
 *     gate 2, and the workspace leaves with the phase.
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
      await expect(plate(page).locator('.con-mandatory__ask')).toHaveText(/^\s*Заседание\s*$|^\s*Sitting\s*$/i);
      await expect(plate(page).locator('.con-mandatory__open'), 'the family\'s own verb on the plate (the bar carries «Открыть заседание»)').toContainText(/Открыть|Open/i);
      await expect(plate(page).locator('.con-mandatory__open')).not.toContainText(/заседание|sitting/i);
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
      // v5: THE VERDICT IS READ IN THE BAND — the row of parties stays on screen for it, and the line names the
      // resolution, its delegates, the winner of the vote BY NAME and that they take an Agenda step.
      await expect(page.locator('.con-band[data-parl-band-kicker="Verdict"]'), 'the band is on the verdict').toHaveCount(1);
      await expect(page.locator('.con-band [data-parl-band-chip="player"]'), 'the verdict names the winning player').toHaveCount(1);
      await expect(page.locator('.con-band [data-parl-band-chip="resolution"]'), '…and the resolution being enacted').toHaveCount(1);
      await expect(page.locator('.con-parl [data-parl-row-shown]'), 'the row of parties is the body: nothing stands over it').toHaveCount(1);
      // THE DECIDED TABLE: the server already re-ranked the losers for the NEXT vote — no card is badged «принимается» until the refresh (P-17).
      await expect(page.locator('.con-parl__slot--winning'), 'no «принимается» on the decided table').toHaveCount(0);
      await expect(page.locator('.con-parl__slot-win'), 'no winning badge on the decided table').toHaveCount(0);
      // The government's basis while the card is still on its way: the PREVIOUS one, never «принятая резолюция» over an empty seat (P-16).
      await expect(page.locator('.con-parl__gov-basis'), 'the seat keeps the starting rule until the card lands').toHaveText(/Стартовое правило|Starting rule/i);
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

      // ── A ON THE VERDICT ANSWERS GATE 1 («Заседание v2»: the enactment and the reward turn by THEMSELVES once
      //    every seat has answered — nothing turns yet): the server receives the option; the other seat is still
      //    awaited, the verdict shows its wait pose, and nothing else has happened — the decided table, the
      //    previous government.
      await press(page, 'Enter', 1500);
      await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt, {timeout: 20_000, message: 'the gate is answered'}).toBeUndefined();
      const answered = await wireOf(request, playerId);
      expect(answered.game.parliament?.phase?.step, 'one answer moves nothing').toBe('assembly');
      expect(answered.game.parliament?.phase?.awaiting).toEqual([(await wireOf(request, red)).thisPlayer.color]);
      expect(await sittingStage(page), 'the verdict stands until the others answer').toBe('verdict');
      await expect(page.locator('.con-band [data-sit-awaiting]'), 'the wait pose names the seat still to answer').toHaveCount(1, {timeout: 15_000});
      await expect(parliament(page), 'the sitting stays open while the others read').toHaveCount(1);
      await expect(page.locator('.con-parl__gov-basis'), 'the seat keeps the starting rule — nothing changed yet').toHaveText(/Стартовое правило|Starting rule/i);
      crumb = (await crumbText(page)).toUpperCase();
      expect(crumb).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      expect(crumb).toMatch(/ВЕРДИКТ|VERDICT/);
      await expectFits(page, `${preset.id} verdict wait`);
      await shoot(page, preset.id, '04-await-others');

      // ── A RELOAD LANDS ON THE SERVER'S STAGE: the sitting is announced again (the device remembers
      //    nothing), A re-opens it on the gate's wait pose — nothing answered is re-asked.
      await reloadConsole(page);
      await armLeakWitness(page);
      await expect(plate(page), 'the same sitting is announced after the reload').toHaveCount(1, {timeout: 30_000});
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
      await expect(page.locator('.con-band [data-sit-awaiting]'), 'the wait pose again').toHaveCount(1, {timeout: 15_000});

      // ── THE OTHER SEAT ANSWERS OVER THE API: the barrier opens — the walk plays ПРИНЯТИЕ (the Agenda, the
      //    support, the enactment) and НАГРАДА by itself, Climate Research draws for blue, and the TAKE arrives
      //    as a STEP INSIDE the open sitting: no second plate, no standalone band.
      const redGate = await wireOf(request, red);
      expect(redGate.waitingFor?.parliamentPhasePrompt?.stage).toBe('assembly');
      await sendPlayerInput(request, red, {type: 'option', promptId: redGate.waitingFor?.promptId} as never);
      expect(await turnTo(page, 'enact'), 'the walk reached the enactment by itself').toBe(true);
      await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-extdraw--embedded'), 'the take stands in the sitting\'s own zone').toHaveCount(1, {timeout: 60_000});
      await expect(page.locator('.con-extdraw.con-ws'), 'never a standalone take workspace').toHaveCount(0);
      await expect(plate(page), 'no second announce inside the sitting').toHaveCount(0);
      await settle(page, {timeoutMs: 20_000});
      expect(await sittingStage(page), 'the take is a step of the REWARD page').toBe('reward');
      crumb = (await crumbText(page)).toUpperCase();
      expect(crumb, `the crumb keeps the sitting, got «${crumb}»`).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      expect(crumb).toMatch(/ПОЛУЧЕНИЕ|INTAKE/);
      await expect(page.locator('.con-parl__slot--winning'), 'still no «принимается» on the decided table').toHaveCount(0);
      await expect(page.locator('.con-parl__gov-basis'), 'the card has landed — the seat reads the enacted resolution').toHaveText(/Принятая резолюция|Enacted resolution/i);
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

      // ── THE RESULTS — ONE stage (v2): the renewal's beats play over the table by themselves, then the card of
      //    the generation's results reveals; A on it answers gate 2.
      await expect.poll(async () => (await wireOf(request, playerId)).game.parliament?.phase?.step, {timeout: 60_000}).toBe('adjourn');
      // The reward page is HELD until its wave run ends — and under two headless workers rAF starves, so the run
      // falls to its named nets (the director's stage ceiling, the ledger's own): the bound is the nets' sum with headroom.
      await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
      await waitSittingAtRest(page, 40_000);
      await settle(page, {timeoutMs: 20_000});
      crumb = (await crumbText(page)).toUpperCase();
      expect(crumb).toMatch(/ЗАСЕДАНИЕ|SITTING/);
      expect(crumb).toMatch(/ИТОГИ|RESULTS/);
      await expect(sitting(page).locator('[data-sit-panel="results"].con-sit__panel--on [data-sit-results]'), 'the results card').toHaveCount(1);
      await expect(sitting(page).locator('[data-sit-results-hidden]'), 'revealed at rest').toHaveCount(0);
      await expect(sitting(page).locator('[data-sit-results] [data-sit-fresh]'), 'the fresh resolutions').not.toHaveCount(0);
      // The refreshed table has its leader back; the lobby refilled is a row of CUBES, one per seat (P-23: a sentence stood there).
      await expect(page.locator('.con-parl__slot--winning'), 'the refreshed table shows its leader').toHaveCount(1);
      const lobbyRefilled = ((await wireOf(request, playerId)).game.parliament?.phase as {summary?: {lobbyRefilled?: Array<unknown>}} | undefined)?.summary?.lobbyRefilled?.length ?? 0;
      await expect(sitting(page).locator('[data-sit-results] [data-sit-row="results-lobby"] .player-cube'), 'the lobby row: one cube per refilled seat').toHaveCount(lobbyRefilled);
      await expect(sitting(page).locator('[data-sit-payout]'), 'a payout row per participating seat — the one thing seen nowhere else').toHaveCount(2);
      await expect(sitting(page).locator('[data-sit-results]'), 'no sentence on the results').not.toContainText(/возвращаются в лобби/);
      // A loser dealt straight back from the reshuffled discard never left the table: its fresh chip says «остаётся ·
      // перетасована» (final polish P-22 / P-28). The losers that LEFT are not listed — they left physically, in the beat.
      const renewal = ((await wireOf(request, playerId)).game.parliament?.phase as {summary?: {discarded?: Array<{instance: string}>, refreshed?: Array<{instance: string}>}} | undefined)?.summary;
      const dealt = new Set((renewal?.refreshed ?? []).map((f) => f.instance));
      const returning = (renewal?.discarded ?? []).filter((d) => dealt.has(d.instance)).length;
      await expect(sitting(page).locator('[data-sit-results] [data-sit-stays]'), `the ${returning} returning resolutions say they stay`).toHaveCount(returning);
      // «Итоги: честность»: the LAW section is GONE — the enacted resolution, the party that rules by it
      // and the chairman's new quest all stand in the government's own zone on this very screen, and the
      // panel states only what is nowhere else (the payouts and the table).
      await expect(sitting(page).locator('[data-sit-law]'), 'no law member survives').toHaveCount(0);
      expect(await sitting(page).locator('[data-sit-section]').evaluateAll((els) => els.map((el) => el.getAttribute('data-sit-section'))),
        'two sections, and nothing beside them').toEqual(['payouts', 'table']);
      // …and every lobby chip NAMES its seat: a bare colour cube is not an assertion.
      await expect(sitting(page).locator('[data-sit-results] [data-sit-lobby] .con-sit__lobby-name'), 'one name per returned delegate')
        .toHaveCount(lobbyRefilled);
      expect(await hotVerb(page)).toMatch(/Закрыть заседание|Close the sitting/i);
      expect((await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt?.stage, 'gate 2 stands until A').toBe('adjourn');
      await expectFits(page, `${preset.id} results`);
      await shoot(page, preset.id, '06-results');
      // B on the terminal results page is NONE — the workspace stays.
      await press(page, 'Escape', 1000);
      await expect(parliament(page), 'B does nothing on the results').toHaveCount(1);
      await press(page, 'Enter', 1500);
      await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.parliamentPhasePrompt, {timeout: 20_000, message: 'gate 2 is answered'}).toBeUndefined();
      await expect(page.locator('.con-band [data-sit-awaiting]'), 'the results wait for the other seat').toHaveCount(1, {timeout: 15_000});

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
