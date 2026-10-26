import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, crumbText, fetchPlayerModel, focusCard, openMandatoryAnnounce, press, settle} from './consoleStart';
import {closeSitting, closeSittingAs, enterSittingByPass, turnTo, waitSittingAtRest} from './parliamentDrive';

/**
 * TR78 ARWIND INC. — a STEP OF THE CAREER asks where a fighter goes (`ICard.onAgendaStep`), and the fighters on the
 * corporation pay 4 M€ for a Space tag (docs/TURMOIL_REDUX_ARWIND_INC.md). ONE question, three hosts — never a band of
 * its own:
 *   A — A CARD'S WALK (TR04 from the hand): the play's composer PRE-COLLECTS both questions (the corporation is the
 *       sole holder — both rows seeded), the play is ONE POST, nothing is asked after it, both fighters land.
 *   B — THE CHAIRMAN QUEST: plate → «ПРЕДСЕДАТЕЛЬСТВО» → the office → the step → the quest's zone «ИСТРЕБИТЕЛЬ» unfolds
 *       over the table with the pick inside it (the crumb keeps «ПРЕДСЕДАТЕЛЬСТВО», only the tail moves) → A → the
 *       fighter lands on the chosen card → the flow ends; no announce plate for the pick.
 *   C — THE SITTING: blue wins → ВЕРДИКТ → ПРИНЯТИЕ: ПОВЕСТКА → the chain WAITS (the server's `support` with the pending
 *       key) and the enactment page's field hosts the pick «ИСТРЕБИТЕЛЬ» → A → the SAME sitting goes on: ПОДДЕРЖКА,
 *       ПРИНЯТИЕ, … ИТОГИ.
 *   D — THE PAYMENT: Satellites (a Space card) with 3 fighters on the corporation — the payment offers the fighters'
 *       lane (protected: the opening mix does not seed it).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'arwind', 'tv');
const ARWIND = 'Arwind Inc.';
const SHIPS = 'Mars Army Ships';
const QUEST_ZONE = '.con-parl [data-embed-slot="parliament-reaction"]';
const STAGE_ZONE = '.con-parl [data-embed-slot="parliament-stage"]';

type Wire = {
  thisPlayer: {color: string, tableau: Array<{name: string, resources?: number}>},
  waitingFor?: {type?: string, agendaStepPrompt?: {reason: string, step: number, index: number, of: number}, chairmanQuestPrompt?: unknown, parliamentPhasePrompt?: unknown},
  game: {phase: string, generation: number, parliament?: {phase?: {step: string, pending?: {player: string, key: string, input?: string}}, players: Array<{color: string, agenda: number}>}},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}

function fightersOn(wire: Wire, card: string): number {
  return wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The readiness of the console, for a failure's message. */
async function diag(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const w = window as unknown as {__conReady?: () => unknown};
    const parl = document.querySelector('.con-parl');
    return JSON.stringify({
      ready: w.__conReady?.() ?? null,
      parl: parl === null ? null : {stage: parl.getAttribute('data-stage'), quest: parl.getAttribute('data-quest-beat'), sitting: parl.getAttribute('data-sitting-stage'),
        motion: parl.getAttribute('data-sitting-motion'), page: parl.getAttribute('data-sitting-page')},
      bands: Array.from(document.querySelectorAll('.con-ws')).map((el) => el.className.slice(0, 80)),
      plate: document.querySelectorAll('.con-mandatory').length,
    }).slice(0, 3000);
  });
}

/** Every sample the crumb read and every band / plate that stood, from the arming on. */
async function armFlowProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__arwind: {crumbs: Array<string>, bands: number, plates: number, picks: number}};
    w.__arwind = {crumbs: [], bands: 0, plates: 0, picks: 0};
    const sample = () => {
      const heads = Array.from(document.querySelectorAll('.con-wshead'))
        .filter((el) => (el as HTMLElement).offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
      const crumb = (heads[heads.length - 1]?.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (crumb !== '' && w.__arwind.crumbs[w.__arwind.crumbs.length - 1] !== crumb) {
        w.__arwind.crumbs.push(crumb);
      }
      // A pick standing OUTSIDE the Parliament (a task band of its own) is the defect this spec exists for.
      const loose = Array.from(document.querySelectorAll('.con-cards__slot')).some((el) => el.closest('.con-parl') === null && el.closest('.con-hand') === null);
      if (loose) {
        w.__arwind.bands++;
      }
      if (document.querySelector('.con-mandatory') !== null) {
        w.__arwind.plates++;
      }
      if (document.querySelector('.con-parl [data-embed-slot] .con-cards__slot') !== null) {
        w.__arwind.picks++;
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 40);
  });
}

async function readFlowProbe(page: Page): Promise<{crumbs: Array<string>, bands: number, plates: number, picks: number}> {
  return await page.evaluate(() => (window as unknown as {__arwind: {crumbs: Array<string>, bands: number, plates: number, picks: number}}).__arwind);
}

/** Focus `card` in the hosted pick and press A — the slot's own focus, walked by the d-pad. */
async function pickHosted(page: Page, zone: string, card: string): Promise<void> {
  const focused = () => page.locator(`${zone} .con-cards__slot--focused`).getAttribute('data-zoom-slot');
  for (let i = 0; i < 6 && await focused() !== card; i++) {
    await press(page, 'ArrowRight', 400);
  }
  expect(await focused(), `the pick focuses «${card}»`).toBe(card);
  await press(page, 'Enter', 1200);
}

test.describe('Arwind Inc. · a step of the Career asks where a fighter goes', () => {
  test.use({viewport: PRESET.viewport});

  test('A — a card\'s walk: the composer pre-collects BOTH questions, the play is ONE POST, both fighters land', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'arwind-walker', {query: PRESET.query});
    const before = await wireOf(request, playerId);
    expect(fightersOn(before, ARWIND), 'the fixture: no fighter yet').toBe(0);
    const posts: Array<string> = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
        posts.push(r.postData() ?? '');
      }
    });
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
    await page.locator('.con-hand [data-zoom-slot="Minority Representation"]').waitFor({timeout: 20_000});
    expect(await focusCard(page, 'Minority Representation', 24), 'the walker is focused').toBeTruthy();
    await press(page, 'Enter', 1200);
    const composer = page.locator('.con-composer--play');
    await composer.waitFor({timeout: 15_000});
    await settle(page);
    const rows = page.locator(`.con-composer--play [data-reaction-card="${ARWIND}"]`);
    await expect(rows, 'two table questions — one per step of the walk, the corporation the asker').toHaveCount(2, {timeout: 15_000});
    await shoot(page, 'A1-composer-two-questions');
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 400);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    await expect.poll(async () => fightersOn(await wireOf(request, playerId), ARWIND), {timeout: 60_000, message: 'both fighters land on the sole holder'}).toBe(2);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.agendaStepPrompt, {timeout: 20_000, message: 'nothing is asked after the press'}).toBe(undefined);
    await settle(page, {timeoutMs: 60_000});
    await shoot(page, 'A2-after-walk');
    expect(posts.length, 'and nothing else was sent').toBe(1);
  });

  test('B — the chairman quest: the office, the step, then «ИСТРЕБИТЕЛЬ» inside the quest\'s own zone — one flow', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'arwind-chairman-quest', {landing: 'prompt', query: PRESET.query});
    const before = await wireOf(request, playerId);
    await expect(page.locator('.con-mandatory'), 'the quest\'s plate').toHaveCount(1, {timeout: 25_000});
    expect(await openMandatoryAnnounce(page), 'A on the plate opens the Parliament').toBeTruthy();
    await armFlowProbe(page);
    try {
      await expect(page.locator(`${QUEST_ZONE} .con-cards__slot`), 'the pick stands in the quest\'s zone').toHaveCount(2, {timeout: 60_000});
    } catch (e) {
      console.log('[arwind-quest]', await diag(page), '| wire:', JSON.stringify((await wireOf(request, playerId)).waitingFor ?? null).slice(0, 400));
      throw e;
    }
    const wf = (await wireOf(request, playerId)).waitingFor;
    expect(wf?.agendaStepPrompt, 'the server asks — the quest\'s step').toMatchObject({reason: 'quest', step: 2});
    await settle(page, {timeoutMs: 20_000});
    const crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, 'the crumb: the quest\'s flow, the stage «ИСТРЕБИТЕЛЬ»').toMatch(/ПРЕДСЕДАТЕЛЬСТВО.*ИСТРЕБИТЕЛЬ/);
    await shoot(page, 'B1-quest-fighter-pick');
    await pickHosted(page, QUEST_ZONE, SHIPS);
    await expect.poll(async () => fightersOn(await wireOf(request, playerId), SHIPS), {timeout: 30_000, message: 'the fighter lands on the chosen card'}).toBe(1);
    expect(fightersOn(await wireOf(request, playerId), ARWIND), 'and nowhere else').toBe(fightersOn(before, ARWIND));
    await expect(page.locator(`${QUEST_ZONE} .con-cards__slot`), 'the pick leaves with its answer').toHaveCount(0, {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, 'B2-quest-after');
    const probe = await readFlowProbe(page);
    test.info().annotations.push({type: 'quest crumbs', description: probe.crumbs.join(' ‖ ')});
    expect(probe.bands, 'the pick never stood as a band of its own').toBe(0);
    expect(probe.picks, 'the pick stood inside the Parliament').toBeGreaterThan(0);
    expect(probe.crumbs.filter((c) => !c.toUpperCase().includes('ПРЕДСЕДАТЕЛЬСТВО')), 'the crumb named the flow on every sample').toEqual([]);
    // The flow ends: A closes it and the workspace leaves.
    await press(page, 'Enter', 900);
    await settle(page, {timeoutMs: 20_000});
    await expect(page.locator('.con-parl'), 'the finished flow LEAVES').toHaveCount(0, {timeout: 20_000});
  });

  test('C — the sitting: ПОВЕСТКА → the chain waits on «ИСТРЕБИТЕЛЬ» in the stage → the SAME sitting goes on', async ({page, request}) => {
    test.setTimeout(360_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'arwind-sitting-win', {query: PRESET.query});
    const before = await wireOf(request, playerId);
    await armFlowProbe(page);
    await enterSittingByPass(page, request, playerId);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.agendaStepPrompt?.reason, {timeout: 60_000, message: 'the winner is asked'}).toBe('phase');
    const paused = await wireOf(request, playerId);
    expect(paused.game.parliament?.phase?.step, 'the support has not run — the chain waits on the fighter').toBe('support');
    expect(paused.game.parliament?.phase?.pending?.key, 'published as the sitting\'s pending question').toBe('agenda-reaction');
    try {
      await expect(page.locator(`${STAGE_ZONE} .con-cards__slot`), 'the pick stands in the stage\'s zone').toHaveCount(2, {timeout: 90_000});
    } catch (e) {
      console.log('[arwind-sitting]', await diag(page));
      throw e;
    }
    await settle(page, {timeoutMs: 20_000});
    expect((await crumbText(page)).toUpperCase(), 'the crumb: the sitting, the stage «ИСТРЕБИТЕЛЬ»').toMatch(/ЗАСЕДАНИЕ.*ИСТРЕБИТЕЛЬ/);
    await shoot(page, 'C1-sitting-fighter-pick');
    await pickHosted(page, STAGE_ZONE, SHIPS);
    await expect.poll(async () => fightersOn(await wireOf(request, playerId), SHIPS), {timeout: 30_000, message: 'the fighter lands'}).toBe(1);
    // THE SAME SITTING GOES ON: the support and the enactment, then the results — nothing replays the verdict.
    await expect.poll(async () => (await wireOf(request, playerId)).game.parliament?.phase?.step ?? 'closed-or-done',
      {timeout: 30_000, message: 'the chain ran past the enactment'}).not.toBe('support');
    await waitSittingAtRest(page, 60_000);
    expect(await turnTo(page, 'results', 90_000), 'the walk reaches the results').toBe(true);
    await shoot(page, 'C2-sitting-results');
    const probe = await readFlowProbe(page);
    test.info().annotations.push({type: 'sitting crumbs', description: probe.crumbs.join(' ‖ ')});
    expect(probe.bands, 'the pick never stood as a band of its own').toBe(0);
    expect(probe.picks, 'the pick stood inside the Parliament').toBeGreaterThan(0);
    // THE SAME SITTING: past the fighter's stage the walk never goes back to the verdict — it goes on from the support.
    const fighterAt = probe.crumbs.findIndex((c) => /ИСТРЕБИТЕЛЬ/i.test(c));
    expect(fighterAt, `the crumb named the fighter's stage (${probe.crumbs.join(' ‖ ')})`).toBeGreaterThan(-1);
    const after = probe.crumbs.slice(fighterAt);
    expect(after.filter((c) => /ВЕРДИКТ/i.test(c)), `the verdict was not replayed after the answer (${probe.crumbs.join(' ‖ ')})`).toEqual([]);
    expect(after.some((c) => /ИТОГИ/i.test(c)), 'the same walk reached the results').toBe(true);
    expect(fightersOn(await wireOf(request, playerId), ARWIND), 'the corporation kept its count').toBe(fightersOn(before, ARWIND));
    await closeSitting(page, request, playerId);
    const other = seats.find((s) => s !== playerId);
    if (other !== undefined) {
      await closeSittingAs(request, other);
    }
  });

  test('D — the payment: a Space card offers the fighters\' lane', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'arwind-pay-space', {query: PRESET.query});
    await press(page, 'Period', 600);
    await press(page, 'Enter', 1600);
    await page.locator('.con-hand [data-zoom-slot="Satellites"]').waitFor({timeout: 20_000});
    expect(await focusCard(page, 'Satellites', 24), 'Satellites is focused').toBeTruthy();
    await press(page, 'Enter', 1200);
    await page.locator('.con-composer--play').waitFor({timeout: 15_000});
    await settle(page);
    await shoot(page, 'D1-pay-composer');
    const lane = page.locator('.con-composer--play .card-resource-fighter, .con-composer--play [class*="fighter"]');
    expect(await lane.count(), 'the payment shows the fighters\' lane').toBeGreaterThan(0);
  });
});
