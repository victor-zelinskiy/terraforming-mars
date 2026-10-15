import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootSeededGame, reloadConsole} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE PROMPT-MODAL FAMILY, over the real DOM (`console_prompt.less`, `promptTone.ts`, `promptSequence.ts`).
 *
 * The owner's case: ONE tile placement by a «Philares» player beside an Ares hazard asks a REWARD («gain a standard
 * resource of your choice») and then — LAST, by the deferred queue's own priorities (GAIN 21 before LOSE 22) — a
 * PENALTY («reduce a production»). The two surfaces used to read as the same thing (six resource rows, a cyan frame,
 * A → X), so a player who took the reward by rhythm gave the income away by the same rhythm. What is proven here:
 *
 *   A · the reward reads as a GAIN (crest, emblem, «▲ ВЫГОДА», «ВЫ ПОЛУЧИТЕ», «ЗАБРАТЬ» glowing on the bar);
 *   B · the penalty arriving as the answer to that press reads as a LOSS (the hazard-tape crest, the warning emblem,
 *       «▼ УБЫТОК», «ВЫ ПОТЕРЯЕТЕ», «ПРИНЯТЬ УБЫТОК» in the danger ink), names itself «РЕШЕНИЕ 2», plays the tone-shift
 *       beat — and SWALLOWS the presses that arrive by inertia (no row is marked, nothing is posted) until it settles;
 *   C · the two plates are ONE family: the same padding, radius, rim, kicker and title type;
 *   D · the rest of the family (a gift, a bill, a free choice, a card's attack on production) wears the same plate and
 *       the tone its structure says — never a title match.
 *
 * Route interception drives the chain (the decision / source / composite probes' harness): the SERVER half — that the
 * reward is asked before the loss — is the deferred queue's priority order, pinned by the Priority enum; the subject
 * here is the client layer. The submit is intercepted too, so the answer to the reward IS the response that carries
 * the penalty, exactly as the transport sees it after a real placement.
 */

const OUT = path.resolve('screenshots', 'prompt-family');

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'Tonal', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
    automa: undefined,
  };
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return (model.players.find((p) => p.name === 'Tonal') ?? model.players[0]).id;
}

/** Philares' reward — exactly as the server builds it (`Philares.onTilePlaced`, the OWN-tile phrasing). */
const philaresReward = (promptId: number) => ({
  type: 'resources',
  promptId,
  title: {message: 'Gain ${0} standard resources', data: [{type: 1, value: '1'}]},
  buttonLabel: 'Select',
  count: 1,
  choiceContext: {
    source: {kind: 'corporation', card: 'Philares'},
    trigger: {message: 'Your tile landed next to another player\'s. New adjacencies: ${0}', data: [{type: 1, value: '1'}]},
    mode: 'reward',
  },
});

/** The Ares hazard's production loss (`AresHandler.payAdjacencyAndHazardCosts` → `{type: 'hazard'}`). Two incomes can
 *  fall, so NOTHING is pre-selected: an inertial A would mark the focused row. */
const hazardLoss = (promptId: number) => ({
  type: 'productionToLose',
  promptId,
  title: 'Choose 1 unit(s) of production to lose',
  buttonLabel: 'Save',
  payProduction: {cost: 1, units: {megacredits: 4, steel: 1, titanium: 0, plants: 2, energy: 0, heat: 0}},
  source: {type: 'hazard'},
});

type Chain = {stage: number, posts: Array<{type?: string}>};

/**
 * Serve `prompts[stage]` on every view read; a submit records its body, advances the stage and is answered with the
 * view that carries the NEXT prompt — the transport applies it exactly like a real follow-up. Past the last prompt the
 * real view (the action menu) comes back.
 */
async function installChain(page: Page, prompts: ReadonlyArray<unknown>): Promise<Chain> {
  const chain: Chain = {stage: 0, posts: []};
  let lastView: Record<string, unknown> | undefined;
  let realWaitingFor: unknown;
  const dress = (body: Record<string, unknown>) => {
    if (realWaitingFor === undefined) {
      realWaitingFor = body.waitingFor;
    }
    body.waitingFor = chain.stage < prompts.length ? prompts[chain.stage] : realWaitingFor;
    return body;
  };
  await page.route('**/api/player*', async (route) => {
    const response = await route.fetch();
    const body = dress(await response.json() as Record<string, unknown>);
    lastView = body;
    await route.fulfill({response, json: body});
  });
  await page.route('**/player/input*', async (route) => {
    const posted = route.request().postDataJSON() as {type?: string};
    chain.posts.push(posted);
    chain.stage++;
    const view = dress({...(lastView ?? {})});
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(view)});
  });
  return chain;
}

/** The plate has MATERIALIZED — the band surface's entrance is over (a state, never a duration). */
async function plateStands(page: Page): Promise<void> {
  await expect.poll(() => page.locator('[data-prompt-panel]').first().evaluate((el) => Number(getComputedStyle(el).opacity)),
    {timeout: 10_000}).toBeGreaterThan(0.99);
}

type HandoffSample = {t: number, from: number, to: number, ask: number};

/**
 * THE HANDOFF WITNESS (PL-384): from the press on, every sample (a `setInterval` tick and every DOM mutation — never
 * rAF, which stops on a quiet screen) reads the EFFECTIVE opacity (the ancestor chain, `visibility` included) of the
 * answered plate, of the arriving one, and of the arriving one's ask line (the compose cascade).
 */
async function armHandoffWitness(page: Page, from: string, to: string): Promise<void> {
  await page.evaluate(([fromSel, toSel]) => {
    const seen = (el: Element | null): number => {
      let o = 1;
      for (let n = el as HTMLElement | null; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        o *= Number(cs.opacity);
      }
      return el === null ? -1 : o;
    };
    const samples: Array<{t: number, from: number, to: number, ask: number}> = [];
    const t0 = performance.now();
    const sample = () => {
      const target = document.querySelector(toSel);
      samples.push({
        t: Math.round(performance.now() - t0),
        from: seen(document.querySelector(fromSel)),
        to: seen(target),
        ask: seen(target === null ? null : target.querySelector('.con-prompt-head__ask')),
      });
    };
    const timer = window.setInterval(sample, 12);
    const observer = new MutationObserver(sample);
    observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class']});
    (window as unknown as {__handoff: {samples: typeof samples, stop: () => void}}).__handoff = {
      samples,
      stop: () => {
        window.clearInterval(timer);
        observer.disconnect();
      },
    };
  }, [from, to]);
}

async function readHandoffWitness(page: Page): Promise<Array<HandoffSample>> {
  return page.evaluate(() => {
    const w = (window as unknown as {__handoff: {samples: Array<HandoffSample>, stop: () => void}}).__handoff;
    w.stop();
    return w.samples;
  });
}

/** The plate's identity and geometry, read off the live DOM — what the family promises to keep equal. */
async function plateReading(page: Page) {
  return page.locator('[data-prompt-panel]').first().evaluate((panel) => {
    const head = panel.querySelector('.con-prompt-head') as HTMLElement | null;
    const crest = panel.querySelector('.con-prompt-head__crest') as HTMLElement | null;
    const title = panel.querySelector('.con-prompt-head__title') as HTMLElement | null;
    const kicker = panel.querySelector('.con-prompt-head__kicker') as HTMLElement | null;
    const cs = getComputedStyle(panel);
    return {
      tone: head?.dataset.promptTone,
      ordinal: head?.dataset.promptOrdinal,
      shift: head?.dataset.promptShift ?? '',
      settling: head?.dataset.promptSettling ?? '',
      padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      radius: cs.borderTopLeftRadius,
      rim: cs.boxShadow,
      crestImage: crest === null ? '' : getComputedStyle(crest).backgroundImage,
      titleFont: title === null ? '' : `${getComputedStyle(title).fontFamily}|${getComputedStyle(title).fontSize}`,
      kickerFont: kicker === null ? '' : getComputedStyle(kicker).fontSize,
      width: panel.getBoundingClientRect().width,
    };
  });
}

for (const profile of PROFILES) {
  test.describe(`console — the prompt-modal family · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('Philares → Ares hazard: a reward and then a loss read as two different decisions, and the loss cannot be answered by rhythm', async ({page, request}) => {
      test.setTimeout(300_000);
      page.on('pageerror', (e) => console.log('[pageerror]', e.message));
      const shoot = async (name: string) => {
        fs.mkdirSync(OUT, {recursive: true});
        await page.screenshot({path: path.join(OUT, `${profile.tag}-${name}.png`)});
      };
      await bootSeededGame(page, request, await createGame(request), {buy: 2, query: profile.query});
      const chain = await installChain(page, [philaresReward(9101), hazardLoss(9102)]);
      await reloadConsole(page);

      // ── A · THE REWARD ──────────────────────────────────────────────────────
      await page.waitForSelector('.con-task[data-prompt-panel]', {state: 'visible', timeout: 40_000});
      await plateStands(page);
      const reward = await plateReading(page);
      expect(reward.tone, 'Philares\' distribution is a GAIN').toBe('gain');
      await expect(page.locator('.con-task [data-prompt-emblem="gain"]').first()).toBeVisible();
      await expect(page.locator('.con-task [data-prompt-tag]')).toContainText(/ВЫГОДА/i);
      await expect(page.locator('.con-task [data-prompt-outcome]')).toHaveAttribute('data-prompt-outcome-tone', 'gain');
      await expect(page.locator('.con-task [data-prompt-outcome]')).toContainText(/ВЫ ПОЛУЧИТЕ/i);
      expect(reward.crestImage, 'a gain\'s crest is a band, not hazard tape').not.toContain('repeating');
      await expect(page.locator('.con-task .con-prompt-head__trigger')).toContainText(/рядом/i);
      await shoot('1-reward');

      // A places the one resource; the footer says what it becomes; the bar's commit COLLECTS, glowing.
      await page.keyboard.press('Enter');
      await expect(page.locator('.con-task [data-prompt-outcome-item]')).toHaveCount(1, {timeout: 5000});
      const bar = page.locator('.con-cmdbar').first();
      await expect(bar.locator('.con-cmdbar__cmd--hot')).toContainText(/ЗАБРАТЬ/i);
      await shoot('2-reward-placed');
      await armHandoffWitness(page, '.con-task[data-prompt-panel]', '.con-prodloss [data-prompt-panel], .con-prodloss[data-prompt-panel]');
      await page.keyboard.press('KeyX');
      await expect.poll(() => chain.posts.length, {timeout: 10_000}).toBe(1);
      expect(chain.posts[0].type, 'the reward was answered as a resource distribution').toBe('resources');

      // ── B · THE LOSS, as the answer to that very press ─────────────────────
      const loss = page.locator('.con-prodloss[data-prompt-panel], .con-prodloss [data-prompt-panel]').first();
      await expect(loss).toBeVisible({timeout: 20_000});
      // THE HANDOFF (PL-384) — one decision gives way to the next as ONE phrase: the two plates are never both legible,
      // the stage is never empty for longer than a beat, the arriving plate composes from inside (its ask still rising
      // while the plate already reads), and the phrase is not drawn out.
      await expect.poll(async () => (await page.evaluate(() =>
        (window as unknown as {__handoff: {samples: Array<HandoffSample>}}).__handoff.samples.some((x) => x.to >= 0.99))), {timeout: 10_000}).toBe(true);
      const handoff = await readHandoffWitness(page);
      // The release begins at the first sample in which the answered plate is no longer whole (fading, or already
      // gone — a long 4K frame can swallow the whole 130 ms between two samples; the samples are the page's own
      // clock, so the claim is about what was painted, never about a beat the probe could not see).
      const released = handoff.find((x) => x.from < 0.99);
      const arrived = handoff.find((x) => x.to >= 0.99);
      expect(released, `the answered plate LET GO (samples: ${handoff.length})`).toBeDefined();
      expect(arrived, 'the next plate arrived').toBeDefined();
      const sawFade = handoff.some((x) => x.from > 0 && x.from < 0.99);
      if (profile.tag === 'fhd') {
        expect(sawFade, 'the answered plate is seen LETTING GO — a release, never a cut').toBe(true);
      }
      const both = handoff.filter((x) => x.from >= 0.5 && x.to >= 0.5);
      expect(both, 'never two legible plates at once').toEqual([]);
      const startedAt = released!.t;
      const blank = handoff.filter((x) => x.t > startedAt && x.t < arrived!.t && x.from <= 0.05 && x.to <= 0.05);
      const blankMs = blank.length === 0 ? 0 : blank[blank.length - 1].t - blank[0].t;
      const phraseMs = arrived!.t - startedAt;
      test.info().annotations.push({type: 'handoff', description: `release→legible ${phraseMs} ms, empty stage ${blankMs} ms, fade seen ${sawFade}, ${handoff.length} samples`});
      expect(blankMs, 'the stage is never empty for longer than a beat').toBeLessThan(profile.tag === 'fhd' ? 120 : 400);
      expect(phraseMs, 'the phrase is not drawn out').toBeLessThan(profile.tag === 'fhd' ? 900 : 1800);
      const composing = handoff.some((x) => x.to >= 0.5 && x.ask >= 0 && x.ask < 0.95);
      if (profile.tag === 'fhd') {
        expect(composing, 'the arriving plate COMPOSES — its ask rises while the plate already reads').toBe(true);
      }
      // The settle window is open — and THIS is where a rhythm press lands. A and X arrive at once (before anything
      // slow, a 4K screenshot included, can let the window close under the probe).
      await expect(page.locator('.con-prodloss [data-prompt-settling="1"]')).toHaveCount(1, {timeout: 2000});
      const settle = await page.evaluate(() =>
        (window as unknown as {__conPromptSequence?: () => {settleLeftMs: number}}).__conPromptSequence?.());
      await page.keyboard.press('Enter');
      await page.keyboard.press('KeyX');
      expect(settle?.settleLeftMs ?? 0, 'the presses landed INSIDE the window').toBeGreaterThan(200);
      await expect(bar.locator('.con-cmdbar__cmd--disabled').first()).toBeVisible();
      await shoot('3-loss-arrives');
      expect(await page.locator('.con-prodloss__row--active').count(), 'an inertial A marks NO production').toBe(0);
      expect(chain.posts.length, 'an inertial X posts NOTHING').toBe(1);
      // …and the absorbed press is answered on the tag, never silently lost.
      await expect(page.locator('.con-prodloss .con-prompt-head[class*="con-prompt-head--nudge"]')).toHaveCount(1);

      const lossReading = await plateReading(page);
      expect(lossReading.tone, 'the hazard\'s production loss is a LOSS').toBe('loss');
      expect(lossReading.ordinal, 'the second decision of the press').toBe('2');
      expect(lossReading.shift, 'the character flipped — gain → loss').toBe('1');
      expect(lossReading.crestImage, 'a loss\'s crest is HAZARD TAPE — a pattern, not only a hue').toContain('repeating-linear-gradient');
      await expect(page.locator('.con-prodloss [data-prompt-emblem="loss"]').first()).toBeVisible();
      await expect(page.locator('.con-prodloss [data-prompt-seq]')).toContainText(/РЕШЕНИЕ 2/i);
      await expect(page.locator('.con-prodloss [data-prompt-tag]')).toContainText(/УБЫТОК/i);
      await expect(page.locator('.con-prodloss [data-prompt-outcome]')).toHaveAttribute('data-prompt-outcome-tone', 'loss');
      await expect(page.locator('.con-prodloss [data-prompt-outcome]')).toContainText(/ВЫ ПОТЕРЯЕТЕ/i);
      // The cause is named: the hazard plate in the source dock.
      await expect(page.locator('.con-prodloss .con-src--hazard')).toHaveCount(1);

      // The settle ends by itself; the decision is then answered deliberately.
      await expect(page.locator('.con-prodloss [data-prompt-settling="1"]')).toHaveCount(0, {timeout: 3000});
      await shoot('4-loss-settled');
      await page.keyboard.press('Enter');
      await expect(page.locator('.con-prodloss [data-prompt-outcome-item]')).toHaveCount(1, {timeout: 5000});
      await expect(page.locator('.con-prodloss [data-prompt-outcome-item]')).toContainText('−1');
      await expect(bar.locator('.con-cmdbar__cmd--danger')).toContainText(/ПРИНЯТЬ УБЫТОК/i);
      await shoot('5-loss-chosen');
      await page.keyboard.press('KeyX');
      await expect.poll(() => chain.posts.length, {timeout: 10_000}).toBe(2);
      expect(chain.posts[1].type, 'the loss was answered deliberately').toBe('productionToLose');

      // ── C · ONE FAMILY: the two plates differ in character only, never in chassis ──
      expect(lossReading.padding, 'one padding').toBe(reward.padding);
      expect(lossReading.radius, 'one radius').toBe(reward.radius);
      expect(lossReading.rim, 'one rim — the frame is never the tone').toBe(reward.rim);
      expect(lossReading.titleFont, 'one title voice').toBe(reward.titleFont);
      expect(lossReading.kickerFont, 'one kicker size').toBe(reward.kickerFont);
      expect(Math.abs(lossReading.width - reward.width), 'one size tier (both `m`)').toBeLessThan(2);
    });

    test('the rest of the family wears the same plate and the tone its STRUCTURE says', async ({page, request}) => {
      test.setTimeout(420_000);
      page.on('pageerror', (e) => console.log('[pageerror]', e.message));
      await bootSeededGame(page, request, await createGame(request), {buy: 2, query: profile.query});
      const amount = (title: string, max: number) =>
        ({type: 'amount', title, buttonLabel: 'Select', min: 0, max, maxByDefault: false});
      const gallery: ReadonlyArray<{name: string, root: string, tone: string, prompt: unknown}> = [
        {name: 'venus-gift', root: '.con-venus', tone: 'gain', prompt: {
          type: 'and', promptId: 9201, title: 'Gain 2 resource(s) for your Venus track bonus.', buttonLabel: 'Save',
          venusBonusPrompt: {kind: 'standard', baseCount: 2},
          // The base bonus is `GainResources`'s bare six-amount `and`, in unit order.
          options: [amount('M€', 2), amount('Steel', 2), amount('Titanium', 2), amount('Plants', 2), amount('Energy', 2), amount('Heat', 2)],
        }},
        {name: 'heat-bill', root: '.con-heat', tone: 'neutral', prompt: {
          type: 'and', promptId: 9202, title: {message: 'Select how to spend ${0} heat', data: [{type: 1, value: '6'}]}, buttonLabel: 'Save',
          spendHeatPrompt: {amount: 6},
          choiceContext: {source: {kind: 'corporation', card: 'Stormcraft Incorporated'}, mode: 'effect-choice'},
          options: [amount('Heat', 8), amount('Stormcraft Incorporated Floaters (2 heat each)', 3)],
        }},
        {name: 'caesar-attack', root: '.con-prodloss', tone: 'loss', prompt: {
          ...hazardLoss(9203), source: {type: 'card', card: 'Caesar'},
          payProduction: {cost: 2, units: {megacredits: 4, steel: 2, titanium: 1, plants: 3, energy: 2, heat: 2}},
        }},
        // A REWARD offered as options (a contextual choice whose every answer only gives) — whichever surface the
        // adapter picks for it (the effect decision or the host's contextual choice), it reads as a GAIN.
        {name: 'reward-choice', root: '', tone: 'gain', prompt: {
          type: 'or', promptId: 9204, title: 'Select one option', buttonLabel: 'Confirm',
          choiceContext: {source: {kind: 'card', card: 'Arctic Algae'}, trigger: 'An ocean was placed.', mode: 'reward'},
          options: [
            {type: 'option', title: 'Gain 2 plants', buttonLabel: 'Confirm',
              metadata: {kind: 'resourceGain', effects: [{direction: 'gain', icon: 'plants', amount: 2, current: 500, resulting: 502}]}},
            {type: 'option', title: 'Gain 1 steel', buttonLabel: 'Confirm',
              metadata: {kind: 'resourceGain', effects: [{direction: 'gain', icon: 'steel', amount: 1, current: 500, resulting: 501}]}},
          ],
        }},
        {name: 'planetary-thresholds', root: '.con-ares', tone: 'neutral', prompt: {
          type: 'aresGlobalParameters', promptId: 9205, title: 'Adjust Ares global parameters up to 1 step.', buttonLabel: 'Save',
          aresData: {
            includeHazards: true,
            milestoneResults: [],
            hazardData: {
              erosionOceanCount: {threshold: 3, available: true},
              removeDustStormsOceanCount: {threshold: 6, available: true},
              severeErosionTemperature: {threshold: -6, available: true},
              severeDustStormOxygen: {threshold: 8, available: false},
            },
          },
        }},
        {name: 'government-support', root: '.con-govsupport', tone: 'neutral', prompt: {
          type: 'or', promptId: 9206, title: 'Select action for World Government Terraforming', buttonLabel: 'Confirm',
          options: [
            {type: 'option', title: 'Increase temperature', buttonLabel: 'Confirm'},
            {type: 'option', title: 'Increase oxygen', buttonLabel: 'Confirm'},
          ],
        }},
      ];
      const readings: Array<Awaited<ReturnType<typeof plateReading>> & {name: string}> = [];
      let current: unknown = gallery[0].prompt;
      await page.route('**/api/player*', async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        body.waitingFor = current;
        await route.fulfill({response, json: body});
      });
      for (const item of gallery) {
        current = item.prompt;
        await reloadConsole(page);
        await page.waitForSelector(item.root === '' ? '[data-prompt-panel]' : `${item.root} [data-prompt-panel], ${item.root}[data-prompt-panel]`,
          {state: 'visible', timeout: 40_000});
        await plateStands(page);
        const reading = await plateReading(page);
        expect(reading.tone, `${item.name} reads ${item.tone}`).toBe(item.tone);
        expect(await page.locator('[data-prompt-panel] .con-prompt-head__crest').count(), `${item.name} wears the crest`).toBe(1);
        if (item.tone === 'neutral') {
          expect(await page.locator('[data-prompt-tag]').count(), 'a free choice wears no tone tag').toBe(0);
        } else {
          await expect(page.locator('[data-prompt-panel] [data-prompt-tag]')).toContainText(item.tone === 'gain' ? /ВЫГОДА/i : /УБЫТОК/i);
        }
        readings.push({...reading, name: item.name});
        // THE ANSWERS ARE THE VARIANT GRAMMAR (PL-383): options on a family plate are its tiles, and a stacked group's
        // «ИЛИ» stands on the seam's CENTRE (PL-399 — a profile width rule once pinned it to the column's left edge).
        const medals = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(
          '[data-prompt-panel] .con-vchoice--column .con-vchoice__or-medal')).map((medal) => {
          const group = medal.closest<HTMLElement>('.con-vchoice')!.getBoundingClientRect();
          const m = medal.getBoundingClientRect();
          return Math.round(Math.abs((m.left + m.width / 2) - (group.left + group.width / 2)));
        }));
        for (const off of medals) {
          expect(off, `${item.name}: «ИЛИ» is centred on its seam (off by ${off} px)`).toBeLessThan(4);
        }
        if (item.name === 'reward-choice') {
          expect(await page.locator('[data-prompt-panel] .con-vchoice__opt').count(), 'the reward\'s answers are the grammar\'s tiles').toBe(2);
        }
        fs.mkdirSync(OUT, {recursive: true});
        await page.screenshot({path: path.join(OUT, `${profile.tag}-gallery-${item.name}.png`)});
      }
      // ONE chassis across the family.
      for (const r of readings.slice(1)) {
        expect(r.padding, `${r.name}: one padding`).toBe(readings[0].padding);
        expect(r.radius, `${r.name}: one radius`).toBe(readings[0].radius);
        expect(r.rim, `${r.name}: one rim`).toBe(readings[0].rim);
        expect(r.titleFont, `${r.name}: one title voice`).toBe(readings[0].titleFont);
        expect(r.kickerFont, `${r.name}: one kicker size`).toBe(readings[0].kickerFont);
      }
    });
  });
}
