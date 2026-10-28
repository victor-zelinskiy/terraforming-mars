import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, crumbText, fetchPlayerModel, focusCard, openMandatoryAnnounce, press, settle} from './consoleStart';
import {closeSitting, closeSittingAs, enterSittingByPass, turnTo, waitSittingAtRest} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR78 ARWIND INC. — a WALK OF THE CAREER owes a fighter per step (`ICard.onAgendaWalked`: ONE answer per walk), the
 * answer plays on ONE stage («ОТВЕТ СТОЛА» — the asker's face on the hero, the receipt / the question in its zone),
 * wherever the marker walked (docs/TURMOIL_REDUX_ARWIND_INC.md, the rework of 2026-10-28). The owner's three laws:
 *   · the asker ALONE is no question — the fighters LAND and the scene plays (the corporation lifted in its place, the
 *     fighters born on its printed effect, landing in its capsule); the player never presses the one card they could
 *     choose;
 *   · the player's own answer is told ONCE — the receive scene off the asker's face; the framework's chain never
 *     rises a second time after it;
 *   · a walk of several steps is ONE question — the LAYOUT in the composer (LB/RB per holder), never one row per step.
 *   A  — the corporation alone, TR04 from the hand: the composer asks nothing («Сработает: +2»), ONE POST, both
 *        fighters land, and the hand's КАРЬЕРА step plays the receipt — born on the asker's effect row, landed in its
 *        own capsule on the stage.
 *   A2 — a second holder: ONE layout row with two lanes; RB on the corporation's lane, → to the ships', RB — the
 *        commit opens; ONE POST; the receipt shows the ships beside the asker and lands on both.
 *   B  — the chairman quest, a second holder: the question on the quest's own stage (the asker on the hero, the pick
 *        in the zone), the crumb «ПРЕДСЕДАТЕЛЬСТВО › ИСТРЕБИТЕЛЬ», the fighter lands on the chosen card, the stage
 *        folds, A ends the flow; no band, no second scene.
 *   B2 — the chairman quest, the corporation alone: NO pick anywhere — the receipt plays on the quest's stage.
 *   C  — the sitting, a second holder: after ПОВЕСТКА the chain WAITS; the question stands as a LAYER of the sitting
 *        (the asker on the hero), «ЗАСЕДАНИЕ › ИСТРЕБИТЕЛЬ»; the answer continues the SAME sitting to its results.
 *   C2 — the sitting, the corporation alone: no pause, the receipt on the enactment page, the sitting runs through.
 *   D  — the payment: a Space card offers the fighters' lane (protected: the opening mix does not seed it).
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT = path.resolve('screenshots', 'arwind', 'tv');
const ARWIND = 'Arwind Inc.';
const SHIPS = 'Mars Army Ships';
const STAGE = '.con-parl [data-parl-answer]';
const ANSWER_ZONE = '.con-parl [data-embed-slot="parliament-answer"]';
const LAYER = '.con-parl [data-sit-answer-layer] [data-parl-answer]';

type Wire = {
  thisPlayer: {color: string, tableau: Array<{name: string, resources?: number}>},
  waitingFor?: {type?: string, agendaWalkPrompt?: {reason: string, from: number, to: number}, chairmanQuestPrompt?: unknown, parliamentPhasePrompt?: unknown},
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
    const stage = document.querySelector('[data-parl-answer]');
    return JSON.stringify({
      ready: w.__conReady?.() ?? null,
      parl: parl === null ? null : {stage: parl.getAttribute('data-stage'), quest: parl.getAttribute('data-quest-beat'), sitting: parl.getAttribute('data-sitting-stage'),
        motion: parl.getAttribute('data-sitting-motion'), page: parl.getAttribute('data-sitting-page'), walk: parl.getAttribute('data-walk-beat')},
      answer: stage === null ? null : {mode: stage.getAttribute('data-tans-mode'), phase: stage.getAttribute('data-tans-phase'), asker: stage.getAttribute('data-tans-asker')},
      bands: Array.from(document.querySelectorAll('.con-ws')).map((el) => el.className.slice(0, 80)),
      plate: document.querySelectorAll('.con-mandatory').length,
    }).slice(0, 3000);
  });
}

type FlowProbe = {
  crumbs: Array<string>, bands: number, plates: number, picks: number, stages: Array<string>,
  /** Samples with the ASKER's face standing at the reaction layer, every layer face's name, the director's `reaction:*` trail. */
  reactionFaces: number, reactionFaceNames: Array<string>, reactions: Array<string>,
};

/** Every sample the crumb read, every band / plate that stood, every answer stage seen (mode), the asker at the reaction layer. */
async function armFlowProbe(page: Page): Promise<void> {
  await page.evaluate((asker: string) => {
    const w = window as unknown as {__arwind: FlowProbeLike};
    type FlowProbeLike = {
      crumbs: Array<string>, bands: number, plates: number, picks: number, stages: Array<string>,
      reactionFaces: number, reactionFaceNames: Array<string>, reactions: Array<string>,
    };
    w.__arwind = {crumbs: [], bands: 0, plates: 0, picks: 0, stages: [], reactionFaces: 0, reactionFaceNames: [], reactions: []};
    const seenTrail = new Set<number>();
    const sample = () => {
      const heads = Array.from(document.querySelectorAll('.con-wshead'))
        .filter((el) => (el as HTMLElement).offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
      const crumb = (heads[heads.length - 1]?.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (crumb !== '' && w.__arwind.crumbs[w.__arwind.crumbs.length - 1] !== crumb) {
        w.__arwind.crumbs.push(crumb);
      }
      // A pick standing OUTSIDE the Parliament / the hand (a task band of its own) is the defect this spec exists for.
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
      const stage = document.querySelector('[data-parl-answer]');
      if (stage !== null) {
        const tag = `${stage.getAttribute('data-tans-mode')}:${stage.getAttribute('data-tans-asker')}`;
        if (w.__arwind.stages[w.__arwind.stages.length - 1] !== tag) {
          w.__arwind.stages.push(tag);
        }
      }
      // The ASKER's face at the reaction LAYER (the framework's stage at the rail's edge) — a SECOND telling of the same
      // answer. Another reactor of the same response (the ruling party's charter answering the Career's M€) rises there
      // legitimately: the framework's own place for a card with no painted face in this flow.
      const faces = Array.from(document.querySelectorAll('.con-reaction__face[data-reaction-card]'));
      for (const face of faces) {
        const name = face.getAttribute('data-reaction-card') ?? '?';
        if (!w.__arwind.reactionFaceNames.includes(name)) {
          w.__arwind.reactionFaceNames.push(name);
        }
      }
      if (faces.some((f) => f.getAttribute('data-reaction-card') === asker)) {
        w.__arwind.reactionFaces++;
      }
      // The director's own trail (`reaction:seed` / `reaction:rise` with its `via` and the places it refused) — read on
      // every sample, because the readiness tail keeps only the last 40 transfer events.
      const ready = (window as unknown as {__conReady?: () => {transfer?: {trail?: ReadonlyArray<{t: number, ev: string, detail?: unknown}>}}}).__conReady?.();
      for (const e of ready?.transfer?.trail ?? []) {
        if (e.ev.startsWith('reaction:') && !seenTrail.has(e.t)) {
          seenTrail.add(e.t);
          w.__arwind.reactions.push(`${Math.round(e.t)} ${e.ev} ${JSON.stringify(e.detail ?? null)}`);
        }
      }
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 40);
  }, ARWIND);
}

async function readFlowProbe(page: Page): Promise<FlowProbe> {
  return await page.evaluate(() => (window as unknown as {__arwind: FlowProbe}).__arwind);
}

/** The answer is told ONCE — never a second face at the reaction layer's stage; a red names the face and the director's trail. */
function expectToldOnce(probe: FlowProbe, why: string): void {
  expect(probe.reactionFaces, `${why}\nfaces: ${probe.reactionFaceNames.join(', ') || '—'}\n${probe.reactions.join('\n')}`).toBe(0);
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

/** Open the hand from the board home and the play composer of `card`. */
async function openPlay(page: Page, card: string): Promise<void> {
  await press(page, 'Period', 600);
  await press(page, 'Enter', 1600);
  await page.locator(`.con-hand [data-zoom-slot="${card}"]`).waitFor({timeout: 20_000});
  expect(await focusCard(page, card, 24), `${card} is focused`).toBeTruthy();
  await press(page, 'Enter', 1200);
  await page.locator('.con-composer--play').waitFor({timeout: 15_000});
  await settle(page);
}

/** The answer stage's receipt: born on the asker's own effect row, landed on `cards` on the stage, no end over glass. */
function expectReceipt(witness: Awaited<ReturnType<typeof transferWitness>>, cards: ReadonlyArray<string>): void {
  const trail = transferTrail(witness);
  expect(witness.births.some((b) => b.under.startsWith(`reactor:${ARWIND}:`)), `the fighters are born on the asker's effect row\n${trail}`).toBe(true);
  for (const card of cards) {
    expect(witness.landings.some((l) => l.under === `answer:${card}`), `a fighter landed on «${card}» on the answer stage\n${trail}`).toBe(true);
  }
  expect(endsOverGlass(witness), `no end over glass\n${trail}`).toEqual([]);
}

test.describe('Arwind Inc. · a walk of the Career answered by the table, on one stage', () => {
  test.use({viewport: PRESET.viewport});

  test('A — the corporation alone: the composer asks nothing, ONE POST, both fighters land — and the hand\'s walk plays the receipt', async ({page, request}) => {
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
    await openPlay(page, 'Minority Representation');
    await expect(page.locator(`.con-composer--play [data-reaction-card="${ARWIND}"]`), 'no question — the asker alone lands them').toHaveCount(0);
    await shoot(page, 'A1-composer-no-question');
    await armFlowProbe(page);
    await armTransferWitness(page);
    for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 400);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    await expect.poll(async () => fightersOn(await wireOf(request, playerId), ARWIND), {timeout: 60_000, message: 'both fighters land on the corporation'}).toBe(2);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.agendaWalkPrompt, {timeout: 20_000, message: 'nothing is asked after the press'}).toBe(undefined);
    try {
      await expect(page.locator(`${STAGE}[data-tans-mode="receipt"][data-tans-asker="${ARWIND}"]`), 'the receipt stands on the walk\'s answer stage').toHaveCount(1, {timeout: 60_000});
    } catch (e) {
      console.log('[arwind-walker]', await diag(page));
      throw e;
    }
    await shoot(page, 'A2-walk-receipt');
    await expect(page.locator(STAGE), 'the stage folds when its work is over').toHaveCount(0, {timeout: 60_000});
    await settle(page, {timeoutMs: 60_000});
    const witness = await transferWitness(page);
    expectReceipt(witness, [ARWIND]);
    const probe = await readFlowProbe(page);
    expect(probe.bands, 'no band of its own').toBe(0);
    expectToldOnce(probe, 'the framework never tells the same answer a second time at the rail\'s edge');
    expect(posts.length, 'and nothing else was sent').toBe(1);
  });

  test('A2 — a second holder: ONE layout row (LB/RB per lane) pre-collects the whole walk; ONE POST; the receipt lands on both', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'arwind-walker-two', {query: PRESET.query});
    const posts: Array<string> = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
        posts.push(r.postData() ?? '');
      }
    });
    await openPlay(page, 'Minority Representation');
    const row = page.locator(`.con-composer--play [data-reaction-card="${ARWIND}"]`);
    await expect(row, 'ONE question for the whole walk — never one per step').toHaveCount(1, {timeout: 15_000});
    const lanes = row.locator('[data-composer-lanes]');
    await expect(lanes, 'the layout row').toHaveCount(1);
    await expect(lanes, 'two fighters to lay out').toHaveAttribute('data-lanes-left', '2');
    await expect(row, 'the row holds the commit while the layout is incomplete').toHaveClass(/con-composer__row--missing/);
    // Walk the cursor onto the row (the composer's own stops), then lay the units out: RB here, → to the ships, RB.
    const onRow = () => page.locator(`.con-composer--play .con-composer__row--focused[data-reaction-card="${ARWIND}"]`).count();
    for (let i = 0; i < 8 && await onRow() === 0; i++) {
      await press(page, 'ArrowDown', 250);
    }
    expect(await onRow(), 'the cursor stands on the layout row').toBe(1);
    await shoot(page, 'A2-1-layout-empty');
    await press(page, 'KeyE', 300);
    await expect(row.locator(`[data-lane-card="${ARWIND}"]`), 'RB: one fighter on the corporation\'s lane').toHaveAttribute('data-lane-amount', '1');
    await press(page, 'ArrowRight', 300);
    await expect(row.locator(`.con-composer__lane--focused[data-lane-card="${SHIPS}"]`), '→: the ships\' lane').toHaveCount(1);
    await press(page, 'KeyE', 300);
    await expect(lanes, 'laid out').toHaveAttribute('data-lanes-left', '0');
    await expect(row, 'the row no longer holds the commit').not.toHaveClass(/con-composer__row--missing/);
    await shoot(page, 'A2-2-layout-done');
    await armFlowProbe(page);
    await armTransferWitness(page);
    // A on the row lands the cursor on the commit; A there plays — ONE POST either way.
    for (let attempt = 0; attempt < 4 && posts.length === 0; attempt++) {
      await press(page, 'Enter', 500);
      await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
    }
    expect(posts.length, 'the play is ONE POST').toBe(1);
    expect(posts[0], 'the layout rides the batch as ONE and-answer').toMatch(/"type":"and"/);
    await expect.poll(async () => fightersOn(await wireOf(request, playerId), SHIPS), {timeout: 60_000, message: 'one fighter on the ships'}).toBe(1);
    expect(fightersOn(await wireOf(request, playerId), ARWIND), 'one on the corporation').toBe(1);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.agendaWalkPrompt, {timeout: 20_000, message: 'nothing is asked after the press'}).toBe(undefined);
    try {
      await expect(page.locator(`${STAGE}[data-tans-mode="receipt"] [data-receipt-card="${SHIPS}"]`), 'the receipt shows the ships beside the asker').toHaveCount(1, {timeout: 60_000});
    } catch (e) {
      console.log('[arwind-walker-two]', await diag(page));
      throw e;
    }
    await shoot(page, 'A2-3-walk-receipt');
    await expect(page.locator(STAGE)).toHaveCount(0, {timeout: 60_000});
    await settle(page, {timeoutMs: 60_000});
    expectReceipt(await transferWitness(page), [ARWIND, SHIPS]);
    const probe = await readFlowProbe(page);
    expect(probe.bands, 'no band of its own').toBe(0);
    expectToldOnce(probe, 'told once');
    expect(posts.length).toBe(1);
  });

  test('B — the chairman quest, a second holder: the question on the quest\'s own stage, the asker on its hero — one flow', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'arwind-chairman-quest', {landing: 'prompt', query: PRESET.query});
    const before = await wireOf(request, playerId);
    await expect(page.locator('.con-mandatory'), 'the quest\'s plate').toHaveCount(1, {timeout: 25_000});
    expect(await openMandatoryAnnounce(page), 'A on the plate opens the Parliament').toBeTruthy();
    await armFlowProbe(page);
    try {
      await expect(page.locator(`${ANSWER_ZONE} .con-cards__slot`), 'the pick stands in the answer stage\'s zone').toHaveCount(2, {timeout: 60_000});
    } catch (e) {
      console.log('[arwind-quest]', await diag(page), '| wire:', JSON.stringify((await wireOf(request, playerId)).waitingFor ?? null).slice(0, 400));
      throw e;
    }
    await expect(page.locator(`${STAGE}[data-tans-mode="question"] [data-tans-asker-face] .pcard`), 'the asker stands on the stage\'s hero').toHaveCount(1);
    const wf = (await wireOf(request, playerId)).waitingFor;
    expect(wf?.agendaWalkPrompt, 'the server asks — the quest\'s walk').toMatchObject({reason: 'quest', from: 1, to: 2});
    await settle(page, {timeoutMs: 20_000});
    const crumb = (await crumbText(page)).toUpperCase();
    expect(crumb, 'the crumb: the quest\'s flow, the stage «ИСТРЕБИТЕЛЬ»').toMatch(/ПРЕДСЕДАТЕЛЬСТВО.*ИСТРЕБИТЕЛЬ/);
    await shoot(page, 'B1-quest-question');
    await armTransferWitness(page);
    await pickHosted(page, ANSWER_ZONE, SHIPS);
    await expect.poll(async () => fightersOn(await wireOf(request, playerId), SHIPS), {timeout: 30_000, message: 'the fighter lands on the chosen card'}).toBe(1);
    expect(fightersOn(await wireOf(request, playerId), ARWIND), 'and nowhere else').toBe(fightersOn(before, ARWIND));
    await expect(page.locator(STAGE), 'the stage folds with its answer').toHaveCount(0, {timeout: 30_000});
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, 'B2-quest-after');
    const witness = await transferWitness(page);
    const trail = transferTrail(witness);
    expect(witness.births.some((b) => b.under.startsWith('asker:')), `the fighter is born on the asker's face on the stage\n${trail}`).toBe(true);
    expect(witness.landings.some((l) => l.under === `slot:${SHIPS}`), `and lands on the chosen candidate's capsule\n${trail}`).toBe(true);
    const probe = await readFlowProbe(page);
    test.info().annotations.push({type: 'quest crumbs', description: probe.crumbs.join(' ‖ ')});
    expect(probe.bands, 'the pick never stood as a band of its own').toBe(0);
    expect(probe.picks, 'the pick stood inside the Parliament').toBeGreaterThan(0);
    expectToldOnce(probe, 'the player\'s own answer is told once — no second scene at the rail\'s edge');
    expect(probe.crumbs.filter((c) => !c.toUpperCase().includes('ПРЕДСЕДАТЕЛЬСТВО')), 'the crumb named the flow on every sample').toEqual([]);
    await press(page, 'Enter', 900);
    await settle(page, {timeoutMs: 20_000});
    await expect(page.locator('.con-parl'), 'the finished flow LEAVES').toHaveCount(0, {timeout: 20_000});
  });

  test('B2 — the chairman quest, the corporation alone: no pick anywhere — the receipt plays on the quest\'s stage', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'arwind-chairman-quest-solo', {landing: 'prompt', query: PRESET.query});
    await expect(page.locator('.con-mandatory'), 'the quest\'s plate').toHaveCount(1, {timeout: 25_000});
    await armFlowProbe(page);
    await armTransferWitness(page);
    expect(await openMandatoryAnnounce(page), 'A on the plate opens the Parliament').toBeTruthy();
    try {
      await expect(page.locator(`${STAGE}[data-tans-mode="receipt"][data-tans-asker="${ARWIND}"]`), 'the receipt stands on the quest\'s stage').toHaveCount(1, {timeout: 60_000});
    } catch (e) {
      console.log('[arwind-quest-solo]', await diag(page));
      throw e;
    }
    await shoot(page, 'B2-1-quest-receipt');
    await expect.poll(async () => fightersOn(await wireOf(request, playerId), ARWIND), {timeout: 30_000, message: 'the fighter landed with the step'}).toBe(1);
    expect((await wireOf(request, playerId)).waitingFor?.agendaWalkPrompt, 'nothing is asked').toBe(undefined);
    await expect(page.locator(STAGE), 'the stage folds').toHaveCount(0, {timeout: 60_000});
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, 'B2-2-quest-after');
    expectReceipt(await transferWitness(page), [ARWIND]);
    const probe = await readFlowProbe(page);
    expect(probe.picks, 'no pick stood anywhere — the player never pressed the one card they could choose').toBe(0);
    expect(probe.bands).toBe(0);
    expectToldOnce(probe, 'told once, on the stage');
    await press(page, 'Enter', 900);
    await settle(page, {timeoutMs: 20_000});
    await expect(page.locator('.con-parl'), 'the finished flow LEAVES').toHaveCount(0, {timeout: 20_000});
  });

  test('C — the sitting, a second holder: ПОВЕСТКА → the chain waits on the question in the sitting\'s layer → the SAME sitting goes on', async ({page, request}) => {
    test.setTimeout(360_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'arwind-sitting-win', {query: PRESET.query});
    const before = await wireOf(request, playerId);
    await armFlowProbe(page);
    await enterSittingByPass(page, request, playerId);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.agendaWalkPrompt?.reason, {timeout: 60_000, message: 'the winner is asked'}).toBe('phase');
    const paused = await wireOf(request, playerId);
    expect(paused.game.parliament?.phase?.step, 'the support has not run — the chain waits on the fighter').toBe('support');
    expect(paused.game.parliament?.phase?.pending?.key, 'published as the sitting\'s pending question').toBe('agenda-reaction');
    try {
      await expect(page.locator(`${LAYER}[data-tans-mode="question"] [data-embed-slot="parliament-answer"] .con-cards__slot`), 'the pick stands in the sitting\'s answer layer').toHaveCount(2, {timeout: 90_000});
    } catch (e) {
      console.log('[arwind-sitting]', await diag(page));
      throw e;
    }
    await expect(page.locator(`${LAYER} [data-tans-asker-face] .pcard`), 'the asker on the layer\'s hero').toHaveCount(1);
    await settle(page, {timeoutMs: 20_000});
    expect((await crumbText(page)).toUpperCase(), 'the crumb: the sitting, the stage «ИСТРЕБИТЕЛЬ»').toMatch(/ЗАСЕДАНИЕ.*ИСТРЕБИТЕЛЬ/);
    await shoot(page, 'C1-sitting-question');
    await pickHosted(page, ANSWER_ZONE, SHIPS);
    await expect.poll(async () => fightersOn(await wireOf(request, playerId), SHIPS), {timeout: 30_000, message: 'the fighter lands'}).toBe(1);
    await expect.poll(async () => (await wireOf(request, playerId)).game.parliament?.phase?.step ?? 'closed-or-done',
      {timeout: 30_000, message: 'the chain ran past the enactment'}).not.toBe('support');
    await waitSittingAtRest(page, 60_000);
    expect(await turnTo(page, 'results', 90_000), 'the walk reaches the results').toBe(true);
    await shoot(page, 'C2-sitting-results');
    const probe = await readFlowProbe(page);
    test.info().annotations.push({type: 'sitting crumbs', description: probe.crumbs.join(' ‖ ')});
    expect(probe.bands, 'the pick never stood as a band of its own').toBe(0);
    expect(probe.picks, 'the pick stood inside the Parliament').toBeGreaterThan(0);
    expectToldOnce(probe, 'the player\'s own answer is told once');
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

  test('C2 — the sitting, the corporation alone: no pause — the receipt on the enactment page, the sitting runs through', async ({page, request}) => {
    test.setTimeout(360_000);
    const {playerId, seats} = await bootFixtureSeats(page, request, 'arwind-sitting-win-solo', {query: PRESET.query});
    await armFlowProbe(page);
    await armTransferWitness(page);
    await enterSittingByPass(page, request, playerId);
    await expect.poll(async () => fightersOn(await wireOf(request, playerId), ARWIND), {timeout: 60_000, message: 'the fighter landed with the winner\'s step'}).toBe(1);
    const wire = await wireOf(request, playerId);
    expect(wire.waitingFor?.agendaWalkPrompt, 'nothing is asked').toBe(undefined);
    expect(wire.game.parliament?.phase?.pending?.key, 'no pause at the Career').not.toBe('agenda-reaction');
    try {
      await expect(page.locator(`${LAYER}[data-tans-mode="receipt"][data-tans-asker="${ARWIND}"]`), 'the receipt stands as a layer of the sitting').toHaveCount(1, {timeout: 90_000});
    } catch (e) {
      console.log('[arwind-sitting-solo]', await diag(page));
      throw e;
    }
    expect((await crumbText(page)).toUpperCase(), 'the crumb names the stage').toMatch(/ЗАСЕДАНИЕ.*ИСТРЕБИТЕЛЬ/);
    await shoot(page, 'C2-1-sitting-receipt');
    await expect(page.locator(LAYER), 'the layer folds').toHaveCount(0, {timeout: 60_000});
    await waitSittingAtRest(page, 60_000);
    expect(await turnTo(page, 'results', 90_000), 'the walk reaches the results').toBe(true);
    await shoot(page, 'C2-2-sitting-results');
    expectReceipt(await transferWitness(page), [ARWIND]);
    const probe = await readFlowProbe(page);
    expect(probe.picks, 'no pick anywhere').toBe(0);
    expect(probe.bands).toBe(0);
    expectToldOnce(probe, 'told once, on the stage');
    await closeSitting(page, request, playerId);
    const other = seats.find((s) => s !== playerId);
    if (other !== undefined) {
      await closeSittingAs(request, other);
    }
  });

  test('D — the payment: a Space card offers the fighters\' lane', async ({page, request}) => {
    test.setTimeout(240_000);
    await bootFixtureSeats(page, request, 'arwind-pay-space', {query: PRESET.query});
    await openPlay(page, 'Satellites');
    await shoot(page, 'D1-pay-composer');
    const lane = page.locator('.con-composer--play .card-resource-fighter, .con-composer--play [class*="fighter"]');
    expect(await lane.count(), 'the payment shows the fighters\' lane').toBeGreaterThan(0);
  });
});
