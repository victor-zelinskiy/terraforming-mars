import {test, expect, APIRequestContext, Page} from '@playwright/test';
import {
  createGameWithCards,
  openConsole,
  pickCards,
  playQueueCard,
  press,
  submitSummary,
  walkToSummary,
} from './consoleStart';

// Regression: Established Methods makes the player perform TWO standard
// projects in sequence. Both top-level projectCard prompts must be served by
// the console-native Standard Projects workspace, never the stranded guard.

const EM = 'Established Methods';
const PRELUDES = [EM, 'Donation'];

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: true, venus: false, colonies: false,
    prelude: true, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'EMTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions, board: 'tharsis', seed: 0.42, randomFirstPlayer: false,
    clonedGamedId: undefined, undoOption: false, showTimers: false,
    fastModeOption: false, showOtherPlayersVP: false, testMode: true,
    aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false,
    modularMA: false, draftVariant: false, initialDraft: false,
    preludeDraftVariant: false, ceosDraftVariant: false, startingCorporations: 1,
    shuffleMapOption: false, randomMA: 'No randomization', includeFanMA: false,
    soloTR: false, customCorporationsList: ['Ecoline'], bannedCards: [], includedCards: [],
    customColoniesList: [],
    customPreludes: [EM, 'Donation', 'Loan', 'Martian Industries'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false,
    customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function prepareEstablishedMethods(page: Page, request: APIRequestContext): Promise<string> {
  const playerId = await createGameWithCards(request, [], {config: newGameConfig()});
  await openConsole(page, playerId);
  await walkToSummary(page, {
    onStep: async (stepPage, kind) => {
      if (kind === 'corporation') {
        const picked = await pickCards(stepPage, ['Ecoline']);
        expect(picked, 'the controlled corporation must be offered').toContain('Ecoline');
      } else if (kind === 'prelude') {
        const picked = await pickCards(stepPage, PRELUDES);
        expect(picked, 'the start deal must offer both controlled preludes')
          .toEqual(expect.arrayContaining(PRELUDES));
      }
    },
  });
  await submitSummary(page);

  // Resolve the known corporation first, then press precisely Established
  // Methods. Its first projectCard prompt is the next server demand; no blind
  // Enter can consume that demand accidentally. Drive these identities
  // directly: during a queue reflow cards briefly leave the DOM, so the generic
  // "play everything until target" helper can mistake that seam for absence.
  const queued = (name: string) => page.locator(`.con-start__queue [data-queue-slot="${name}"]`);
  await expect(queued('Ecoline'), 'Ecoline arrived in the deployment queue')
    .toBeVisible({timeout: 30_000});
  expect(await playQueueCard(page, 'Ecoline'),
    'Ecoline never left the deployment queue').toBeTruthy();
  await expect(queued(EM),
    'Established Methods arrived in the deployment queue').toBeVisible({timeout: 30_000});
  expect(await playQueueCard(page, EM),
    'Established Methods never left the deployment queue').toBeTruthy();
  return playerId;
}

async function openStandardProjectPrompt(page: Page, ordinal: string): Promise<void> {
  const standardProjects = page.locator('.con-stdp');
  const mandatory = page.locator('.con-mandatory');
  const stranded = page.locator('.con-stranded');
  const started = Date.now();

  // A new interruptive prompt may first be announced. Only acknowledge that
  // structural surface; never press through an animation or a start-queue card.
  while (Date.now() - started < 30_000 && !(await standardProjects.isVisible().catch(() => false))) {
    await expect(stranded, `${ordinal} prompt was declared stranded before opening`).toHaveCount(0);
    if (await mandatory.isVisible().catch(() => false)) {
      await press(page, 'Enter', 700);
    } else {
      await page.waitForTimeout(250);
    }
  }

  await expect(standardProjects, `${ordinal} prompt opened the Standard Projects workspace`)
    .toBeVisible({timeout: 5_000});
  await expect(page.locator('.con-stdp__card--focused.con-stdp__card--go'),
    `${ordinal} prompt focused an available standard project`).toHaveCount(1);

  // The leak detector confirms a stranded prompt after two one-second ticks.
  // Keep the real workspace standing beyond that boundary and prove the guard
  // never competes with it.
  await page.waitForTimeout(2_750);
  await expect(standardProjects).toBeVisible();
  await expect(stranded, `${ordinal} prompt showed the stranded guard`).toHaveCount(0);
}

test('EstablishedMethods: both std-project prompts served by .con-stdp, never stranded', async ({page, request}) => {
  test.setTimeout(300_000);
  const playerId = await prepareEstablishedMethods(page, request);

  await openStandardProjectPrompt(page, 'first');

  // The first server-authorized row is Power Plant (the energy icon). Test mode
  // supplies ample M€, so A submits it directly. The workspace intentionally
  // stays mounted and accepts the second prompt in place; prove the boundary
  // from authoritative game state, not from a transient DOM unmount.
  await expect(page.locator('.con-stdp__card--focused .std-icon--energy')).toHaveCount(1);
  const before = await (await request.get(`/api/player?id=${playerId}`)).json() as
    {thisPlayer: {energyProduction: number}};
  await press(page, 'Enter', 900);
  await expect.poll(async () => {
    const view = await (await request.get(`/api/player?id=${playerId}`)).json() as
      {thisPlayer: {energyProduction: number}, waitingFor?: {type?: string}};
    return {
      energyProduction: view.thisPlayer.energyProduction,
      promptType: view.waitingFor?.type,
    };
  }, {timeout: 20_000, message: 'the first project resolved and the second projectCard prompt became current'})
    .toEqual({energyProduction: before.thisPlayer.energyProduction + 1, promptType: 'projectCard'});

  await openStandardProjectPrompt(page, 'second');
});
