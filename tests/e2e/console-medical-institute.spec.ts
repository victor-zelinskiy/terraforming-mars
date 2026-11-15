import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  createGameWithCards, crumbText, fetchPlayerModel, openConsole, pickCards, playCardFromHand, playQueueCard, press,
  pressUntil, sendPlayerInput, settle, soloGameConfig, submitSummary, waitQueueIdle, walkToSummary,
} from './consoleStart';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';
import {armWitness, witnessOf} from './witness';

/**
 * TRP9 «MEDICAL INSTITUTE» — the first PRELUDE-REACTOR of Turmoil Redux: draw 1 card; «after you play a Science tag
 * (including this), add 1 microbe or data resource to ANY card». Against a real server, on the TV, ONE journey:
 *
 *   (A) THE START (the real UI start — TRP1 / TRP8's precedent): Psychrophiles first (a microbe holder on the shelf),
 *       then TRP9 → the card is drawn, «КУДА» stands INSIDE the start (its zone, the start's crumb growing a tail — never
 *       a band of its own) over Psychrophiles; A → ONE POST → Psychrophiles +1 microbe; the Institute RISES on the shelf
 *       «РАЗЫГРАНО» (its own face, never a second instance at the reaction stage) and its token lands on Psychrophiles.
 *   (B) THE HAND (`Research`, two Science tags): the play composer says «Сработает» twice for the Institute, the
 *       pre-collected «КУДА» answered in the composer (a sole candidate is SEEDED, T14) → A → ONE batch POST → +2.
 *
 * The rules (per tag, including this, the union of the holders, the named skip) are the unit spec's
 * (`tests/cards/turmoilRedux/MedicalInstitute.spec.ts`); this asserts the journey.
 */

const CARD = 'Medical Institute';
const HOLDER = 'Psychrophiles';
const RESEARCH = 'Research';
const OUT = path.resolve('screenshots', 'medical', process.env.TM_E2E_SHOTS_TAG ?? '');
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

type Wire = {
  cardsInHand?: Array<{name: string}>,
  thisPlayer: {tableau: Array<{name: string, resources?: number}>},
  waitingFor?: {type?: string, coloniesModel?: Array<{name: string}>, cards?: Array<{name: string}>},
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  return await fetchPlayerModel(request, playerId) as unknown as Wire;
}
const CLAIM_WITNESS = 'medical-claim';
const ROWS_WITNESS = 'medical-composer-rows';
const countOn = (wire: Wire, card: string) => wire.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? -1;
const onTable = (wire: Wire, card: string) => wire.thisPlayer.tableau.some((c) => c.name === card);

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${PRESET.id}-${name}.png`)});
}

function watchPosts(page: Page): Array<string> {
  const posts: Array<string> = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      // The BODY, not just the path: a stray answer must name WHAT it answered (CI 2026-10-30 printed a bare path).
      posts.push(`${new URL(r.url()).pathname} ${r.postData() ?? ''}`);
    }
  });
  return posts;
}

/**
 * Any face of the Institute: lifted in its place (the shelf «РАЗЫГРАНО» or the start's seat «Источник» — it holds the
 * card while its «where?» stands), or a SECOND instance at the reaction layer's stage — RECORDED (FLAKE ZERO —
 * `armWitness`, armed before the press): «did it rise» is caught in the task that lifts it; «never a second instance»
 * is a claim about two faces painted at once, so that record is `settled` (the state a task leaves).
 */
const RISE_IN_PLACE = 'medical-rise';
const RISE_AT_STAGE = 'medical-rise-at-stage';
async function armRiseProbe(page: Page): Promise<void> {
  await armWitness<boolean, string>(page, RISE_IN_PLACE, (card) =>
    document.querySelector(`[data-played-key="${card}"][data-reaction-lifted], [data-played-key="${card}"] [data-reaction-lifted], ` +
      `[data-start-seat-card="${card}"][data-reaction-lifted], [data-start-seat-card="${card}"] [data-reaction-lifted]`) !== null, {args: CARD});
  await armWitness<boolean, string>(page, RISE_AT_STAGE, (card) =>
    document.querySelector(`.con-reaction__face[data-reaction-card="${card}"]`) !== null, {args: CARD, settled: true});
}

const riseOf = async (page: Page) => ({
  inPlace: await witnessOf<boolean>(page, RISE_IN_PLACE).ever((up) => up),
  atStage: await witnessOf<boolean>(page, RISE_AT_STAGE).ever((up) => up),
});

/** The server's own colony-removal step of a solo start, when it stands — answered over the API (not the subject). */
async function answerSoloColony(request: APIRequestContext, playerId: string): Promise<void> {
  const wf = (await wireOf(request, playerId)).waitingFor;
  if (wf?.type === 'colony') {
    await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (wf.coloniesModel ?? [])[0]?.name ?? ''});
  }
}

test.describe(`console · TRP9 Medical Institute · ${PRESET.id}`, () => {
  test.use({viewport: PRESET.viewport, deviceScaleFactor: 1, screen: PRESET.viewport});

  test('A · B — the start asks «КУДА» inside the start and the Institute rises on its shelf; Research says «Сработает» twice', async ({page, request}) => {
    test.setTimeout(420_000);
    const errors: Array<string> = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const corp = 'Teractor';
    const playerId = await createGameWithCards(request, [RESEARCH], {attempts: 240, config: soloGameConfig({
      expansions: {colonies: true, turmoilRedux: true, prelude: true},
      startingCorporations: 1,
      customCorporationsList: [corp],
      customPreludes: [CARD, HOLDER, 'Mohole', 'Loan'],
    })});
    await openConsole(page, playerId, PRESET.query);
    await walkToSummary(page, {
      onStep: async (p, kind) => {
        if (kind === 'corporation') {
          expect(await pickCards(p, [corp]), 'the corporation was offered and picked').toContain(corp);
        } else if (kind === 'prelude') {
          expect(await pickCards(p, [CARD, HOLDER]), 'both Preludes were picked').toEqual(expect.arrayContaining([CARD, HOLDER]));
        } else if (kind === 'project') {
          expect(await pickCards(p, [RESEARCH]), 'Research was bought').toContain(RESEARCH);
        }
      },
    });
    await submitSummary(page);
    await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
    await settle(page, {timeoutMs: 30_000});

    expect(await playQueueCard(page, corp), 'the corporation was played from the queue').toBe(true);
    await expect.poll(async () => {
      await answerSoloColony(request, playerId);
      return onTable(await wireOf(request, playerId), corp);
    }, {timeout: 40_000, message: 'the corporation is on the table'}).toBe(true);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});

    // The holder first — Psychrophiles stands on «РАЗЫГРАНО» before the Institute answers its own Science tag.
    expect(await playQueueCard(page, HOLDER), 'Psychrophiles was played from the queue').toBe(true);
    await expect.poll(async () => onTable(await wireOf(request, playerId), HOLDER), {timeout: 40_000}).toBe(true);
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, 'a1-queue');

    // (A) TRP9 from the queue: the card drawn first, then «КУДА» INSIDE the start.
    const handBefore = (await wireOf(request, playerId)).cardsInHand?.length ?? 0;
    // THE CLAIM'S STORY from the queue press to the pick (PL-1117) — every change of the outcome claim and its last
    // release, RECORDED off the product's own writes (`armWitness` keeps a value only when it changes).
    await armWitness<string>(page, CLAIM_WITNESS, () => {
      const w = window as unknown as {__conColonyDiag?: () => Record<string, unknown>, __conReady?: () => {outcome?: unknown}};
      const diag = w.__conColonyDiag?.();
      return JSON.stringify({release: diag?.lastRelease, outcome: w.__conReady?.()?.outcome, start: (diag?.start as {frameLive?: unknown, serves?: unknown} | undefined)});
    });
    await armRiseProbe(page);
    expect(await playQueueCard(page, CARD), 'the Institute was played from the queue').toBe(true);
    await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.cards?.map((c) => c.name) ?? [],
      {timeout: 40_000, message: 'the server asks ONE pick over the holders'}).toEqual([HOLDER]);
    expect((await wireOf(request, playerId)).cardsInHand?.length ?? 0, 'the card was drawn before the pick').toBe(handBefore + 1);
    // The draw is presented FIRST, inside the start (the crumb «… › МЕДИЦИНСКИЙ ИНСТИТУТ › ДОБОР КАРТ») — A takes it.
    await expect.poll(() => crumbText(page), {timeout: 30_000, message: 'the draw stands inside the start'}).toMatch(/ИНСТИТУТ.*ДОБОР/i);
    await shoot(page, 'a2-draw-in-start');
    // The LIVE «on which card» pick is the task host's card strip (`resourceGainPrompt`), hosted in the start's zone.
    const candidate = page.locator(`.con-task-host .con-cards__slot[data-zoom-slot="${HOLDER}"]`);
    const posts = watchPosts(page);
    await settle(page, {timeoutMs: 30_000});
    // ACT → VERIFY on the TAKE ITSELF, never on its consequence alone. The crumb leaves «ДОБОР» only once the card has
    // flown into the dock and «КУДА» stands; on a loaded 4K SwiftShader runner that is past the retry window, and the
    // retry's A then landed ON «КУДА» — its sole candidate answered, the stray POST below (CI 2026-10-30, attempt 0).
    // The take is witnessed the moment it starts: the drawn card's slot held by its intake proxy (`con-deal-hold`),
    // the delivery's own hold, or anything later (the crumb moved on, the candidate stands).
    const tookDrawn = async (): Promise<boolean> => !/ДОБОР/i.test(await crumbText(page)) || await candidate.isVisible() ||
      await page.evaluate(() => {
        const holds = (window as unknown as {__conReady?: () => {holds?: Array<string>}}).__conReady?.().holds ?? [];
        return holds.some((h) => h.includes('hand-delivery')) ||
          document.querySelector('.con-reveal .con-cards__slot.con-deal-hold, .con-reveal .con-cards__slot--taken') !== null;
      });
    expect(await pressUntil(page, 'Enter', tookDrawn, {tries: 3, settleMs: 2500}), 'A took the drawn card').toBe(true);
    await expect(candidate, '«КУДА» stood after the card was taken').toBeVisible({timeout: 30_000});
    expect(posts, 'taking the drawn card answered nothing on the server').toEqual([]);
    await settle(page, {timeoutMs: 30_000});
    await shoot(page, 'a3-where-in-start');
    // PL-1117: the play's claim survives the take — the pick stands INSIDE the start's zone, the start's crumb on screen.
    const claimSamples = await witnessOf<string>(page, CLAIM_WITNESS).stop();
    const claimStory = claimSamples.map((s) => `${s.t - (claimSamples[0]?.t ?? 0)} ${s.v}`).join('\n');
    fs.mkdirSync('test-results', {recursive: true});
    fs.writeFileSync(`test-results/medical-claim-${PRESET.id}.txt`, claimStory);
    const crumb = await crumbText(page); // named in the message below — the claims themselves are polled
    await expect.poll(() => page.evaluate((card) => document.querySelector(`.con-task-host .con-cards__slot[data-zoom-slot="${card}"]`)?.closest('.con-start') !== null, HOLDER),
      {timeout: 10_000, message: `«КУДА» is embedded in the start, never a band of its own (crumb «${crumb}»)\n${claimStory.slice(-3000)}`}).toBe(true);
    await expect.poll(() => crumbText(page), {timeout: 10_000, message: 'the start crumb keeps the card'}).toMatch(/ИНСТИТУТ/i);
    await expect(page.locator('.con-task-host .con-cards__slot'), 'Psychrophiles is the only candidate').toHaveCount(1);

    await armTransferWitness(page);
    await pressUntil(page, 'Enter', async () => posts.length > 0, {tries: 3, settleMs: 1500});
    expect(posts, 'ONE POST answers the pick').toHaveLength(1);
    await expect.poll(async () => countOn(await wireOf(request, playerId), HOLDER), {timeout: 30_000, message: 'Psychrophiles +1 microbe'}).toBe(1);
    await expect.poll(async () => (await riseOf(page)).inPlace, {timeout: 30_000, message: 'the Institute rose in its place (the seat or the shelf)'}).toBe(true);
    await shoot(page, 'a4-rises-on-shelf');
    await waitQueueIdle(page);
    await settle(page, {timeoutMs: 60_000});
    expect((await riseOf(page)).atStage, 'never a second instance at the reaction stage').toBe(false);
    const witnessA = await transferWitness(page);
    fs.mkdirSync('test-results', {recursive: true});
    fs.writeFileSync(`test-results/medical-a-${PRESET.id}.txt`, transferTrail(witnessA));
    expect(endsOverGlass(witnessA), `every end visible\n${transferTrail(witnessA)}`).toEqual([]);
    const landedA = witnessA.landings.map((l) => l.under).filter((u) => u.includes(HOLDER));
    expect(landedA.length, `the microbe landed on Psychrophiles' face\n${transferTrail(witnessA)}`).toBeGreaterThan(0);
    await shoot(page, 'a5-landed');

    // Finish the opening (the two other preludes stay in the queue only if dealt — Mohole / Loan were not picked).
    for (let i = 0; i < 30 && await page.locator('.con-start').count() > 0; i++) {
      const wf = (await wireOf(request, playerId)).waitingFor;
      if (wf?.type === 'or') {
        break;
      }
      await press(page, 'Enter', 900);
      await settle(page, {timeoutMs: 20_000});
    }
    await settle(page, {timeoutMs: 30_000});

    // (B) Research (two Science tags) from the hand: «Сработает» ×2 for the Institute, the pick pre-collected.
    const posts2 = watchPosts(page);
    await armTransferWitness(page);
    // The play composer's «КУДА» rows the Institute asks — one per Science tag, each seeded with the sole candidate
    // (T14) — RECORDED from before the press (the driver confirms the play): the most rows that ever stood at once,
    // so `settled` (the state a task leaves — never the gap between a row's leave and its successor's entry).
    await armWitness<number, string>(page, ROWS_WITNESS, (card) =>
      document.querySelectorAll(`.con-composer--play .con-composer__row--reaction[data-reaction-card="${card}"]`).length, {args: CARD, settled: true});
    expect(await playCardFromHand(page, RESEARCH), 'Research was played from the hand (the seeded picks answer the Institute)').toBe(true);
    expect(Math.max(0, ...(await witnessOf<number>(page, ROWS_WITNESS).stop()).map((s) => s.v)),
      'the composer asked the Institute\'s «КУДА» once per Science tag, before the press').toBe(2);
    await expect.poll(async () => countOn(await wireOf(request, playerId), HOLDER), {timeout: 40_000, message: 'Psychrophiles +2 more'}).toBe(3);
    expect(posts2.length, 'the play and its two picks ride ONE POST').toBe(1);
    await settle(page, {timeoutMs: 60_000});
    const witnessB = await transferWitness(page);
    fs.writeFileSync(`test-results/medical-b-${PRESET.id}.txt`, transferTrail(witnessB));
    expect(endsOverGlass(witnessB), `every end visible\n${transferTrail(witnessB)}`).toEqual([]);
    await shoot(page, 'b2-landed');
    expect(errors, 'no page errors').toEqual([]);
  });
});
