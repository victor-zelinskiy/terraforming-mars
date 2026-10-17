import {test, expect, Page} from './consoleTest';
import {cinematicBeat, press, pressUntil, reloadConsole, summaryVisible, walkToSummary, fillPicks, pickCards} from './consoleStart';

/**
 * «КОРПОРАТИВНЫЕ АРХИВЫ» — «свернуть» → «вернуться» и перезагрузка посреди
 * выбора (field blocker 2026-10-18).
 *
 * The draw & select step stands INSIDE the start workspace (the shell's ONE
 * `ConsoleDeckPick` teleported into `.con-start__embed`). B minimizes the
 * hosting workspace — the start frame is PARKED, so the scene and its zone
 * unmount — and A on the board home restores it. The field report: after that
 * round trip only the start screen stood, with no cards to choose, and a
 * reload did not recover it; the game was unplayable.
 *
 * The contract this pins:
 *   · after B → A the seven cards stand again, embedded in the start zone,
 *     pickable, and the pick can be answered;
 *   · after a RELOAD in the middle of the pick, the same.
 */

function cfg(corps: ReadonlyArray<string> = ['CrediCor', 'Teractor']) {
  return {
    players: [{name: 'Archivist', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: true, venus: false, colonies: false,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false,
    customCorporationsList: [...corps],
    bannedCards: [], includedCards: [], customColoniesList: [],
    customPreludes: ['Corporate Archives', 'Metals Company', 'Supplier', 'Business Empire'],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

/** Structural readout — never a title match. */
async function pickState(page: Page) {
  return page.evaluate(() => {
    const vis = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) {
        return false;
      }
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const st = getComputedStyle(n);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.05) {
          return false;
        }
      }
      return true;
    };
    const pick = document.querySelector('.con-deckpick');
    const slots = Array.from(document.querySelectorAll('.con-deckpick__slot'));
    return {
      startUp: vis(document.querySelector('.con-start')),
      pickUp: pick !== null,
      pickVisible: vis(pick),
      pickEmbedded: pick !== null && pick.closest('.con-start__embed') !== null,
      pickInDocument: pick !== null && document.body.contains(pick),
      cards: slots.length,
      painted: slots.filter((el) => vis(el)).length,
      /** PAINTED ON TOP — the pick is what the player SEES at its cards, not a
       *  layer under the start scene (the field defect: the pick was mounted,
       *  pickable and invisible). */
      onTop: slots.length > 0 && slots.every((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit !== null && pick !== null && pick.contains(hit);
      }),
      flow: pick?.getAttribute('data-flow') ?? '',
      picked: document.querySelectorAll('.con-deckpick__slot.con-cards__slot--picked').length,
      mandatoryCard: vis(document.querySelector('.con-mandatory')),
      stranded: document.querySelectorAll('.con-stranded').length,
      crumb: (document.querySelector('.con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase(),
      handCards: document.querySelectorAll('[data-hand-dock-card]').length,
      waiting: (window as unknown as {__conReady?: () => {transport?: {waitingForType?: string}}})
        .__conReady?.().transport?.waitingForType ?? '',
    };
  });
}

async function waitUntil(
  page: Page,
  pred: (s: Awaited<ReturnType<typeof pickState>>) => boolean,
  budgetMs = 12_000,
): Promise<boolean> {
  try {
    await expect.poll(async () => pred(await pickState(page)), {timeout: budgetMs, intervals: [200]}).toBe(true);
    return true;
  } catch {
    return false;
  }
}

async function reachDeployment(page: Page): Promise<void> {
  await walkToSummary(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 600);
      } else if (kind === 'prelude') {
        const got = await pickCards(p, ['Corporate Archives']);
        expect(got, 'the archives were offered and picked').toContain('Corporate Archives');
        await fillPicks(p, 2);
      } else if (kind === 'project') {
        await fillPicks(p, 4, 30);
      }
    },
  });
  if (await summaryVisible(page)) {
    await press(page, 'Enter', 2500); // НАЧАТЬ ПАРТИЮ
  }
  await cinematicBeat(page, 4000, 'the deployment materializes before the queue takes A');
}

async function openDeckPick(page: Page, maxPresses = 14): Promise<boolean> {
  for (let i = 0; i < maxPresses; i++) {
    if ((await pickState(page)).pickUp) {
      return true;
    }
    await press(page, 'Enter', 2200);
  }
  return (await pickState(page)).pickUp;
}

/** The pick is ON SCREEN, inside the start zone, all seven cards painted, and
 *  its pad open. */
function pickStands(s: Awaited<ReturnType<typeof pickState>>): boolean {
  return s.pickVisible && s.onTop && s.pickEmbedded && s.cards === 7 && s.painted === 7 && s.flow === 'choosing';
}

/** After a RELOAD the claim that embedded the pick is gone with the page. If the
 *  start workspace stands, the pick must be INSIDE it (adopted); if it does not,
 *  the pick's own band is the honest home — either way it is on top. */
function pickStandsAfterReload(s: Awaited<ReturnType<typeof pickState>>): boolean {
  return s.pickVisible && s.onTop && (s.pickEmbedded || !s.startUp) &&
    s.cards === 7 && s.painted === 7 && s.flow === 'choosing';
}

async function answerPick(page: Page): Promise<void> {
  const before = (await pickState(page)).handCards;
  await press(page, 'Enter', 400);
  await press(page, 'ArrowRight', 300);
  await press(page, 'Enter', 400);
  expect((await pickState(page)).picked, 'two cards are selected').toBe(2);
  await press(page, 'Period', 400); // RT = «Подтвердить»
  const landed = await waitUntil(page, (s) => !s.pickUp && s.handCards >= before + 2, 15_000);
  expect(landed, `the pick was answered and the two cards reached the hand — ${JSON.stringify(await pickState(page))}`)
    .toBeTruthy();
}

test.describe('console — «посмотри 7, оставь 2» survives «свернуть» and a reload', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('B → A brings the seven cards back, embedded and pickable', async ({page, request}) => {
    test.setTimeout(420_000);
    const created = await request.post('/api/creategame', {data: cfg()});
    expect(created.ok(), 'game created').toBeTruthy();
    const game = await created.json();
    await page.goto(`/player?id=${game.players[0].id}&console=1`);
    await reachDeployment(page);

    expect(await openDeckPick(page), `the pick opened — ${JSON.stringify(await pickState(page))}`).toBeTruthy();
    expect(await waitUntil(page, pickStands, 15_000),
      `the pick stands before the round trip — ${JSON.stringify(await pickState(page))}`).toBeTruthy();

    // B — «свернуть»: the start workspace parks, the board home shows the way back.
    const collapsed = await pressUntil(page, 'Escape',
      async () => {
        const s = await pickState(page);
        return !s.pickVisible && !s.startUp;
      }, {tries: 3, settleMs: 1200});
    const atBoard = await pickState(page);
    await page.screenshot({path: 'test-results/deckpick-collapse-01-board.png'});
    expect(collapsed, `B minimized the workspace — ${JSON.stringify(atBoard)}`).toBeTruthy();
    expect(atBoard.waiting, 'the server still asks the pick').toBe('card');

    // A — back to the decision.
    const restored = await pressUntil(page, 'Enter',
      async () => (await pickState(page)).startUp, {tries: 3, settleMs: 1500});
    expect(restored, `A restored the start workspace — ${JSON.stringify(await pickState(page))}`).toBeTruthy();
    const back = await waitUntil(page, pickStands, 15_000);
    await page.screenshot({path: 'test-results/deckpick-collapse-02-restored.png'});
    expect(back, `the seven cards stand again, embedded and pickable — ${JSON.stringify(await pickState(page))}`)
      .toBeTruthy();
    expect((await pickState(page)).stranded, 'no stranded prompt').toBe(0);

    // …a second round trip too: the fix may not be a one-shot.
    await pressUntil(page, 'Escape', async () => !(await pickState(page)).startUp, {tries: 3, settleMs: 1200});
    await pressUntil(page, 'Enter', async () => (await pickState(page)).startUp, {tries: 3, settleMs: 1500});
    expect(await waitUntil(page, pickStands, 15_000),
      `the second round trip — ${JSON.stringify(await pickState(page))}`).toBeTruthy();

    await answerPick(page);
  });

  // Two tables, because a reload restores the start workspace only when it
  // still OWES something the server can name: CrediCor / Teractor owe nothing
  // after their preludes (the pick then stands as its own band — honest, there
  // is no workspace to be inside), while a corporation with a mandatory FIRST
  // ACTION keeps the workspace serving across the reload — and that scene used
  // to stand OVER the unowned pick, hiding it (no claim survives a reload).
  for (const table of [
    {tag: 'plain', corps: ['CrediCor', 'Teractor']},
    {tag: 'first-action', corps: ['Inventrix', 'Tharsis Republic']},
  ]) {
    test(`a reload in the middle of the pick brings the seven cards back · ${table.tag}`, async ({page, request}) => {
      test.setTimeout(420_000);
      const created = await request.post('/api/creategame', {data: cfg(table.corps)});
      expect(created.ok(), 'game created').toBeTruthy();
      const game = await created.json();
      await page.goto(`/player?id=${game.players[0].id}&console=1`);
      await reachDeployment(page);

      expect(await openDeckPick(page), `the pick opened — ${JSON.stringify(await pickState(page))}`).toBeTruthy();
      expect(await waitUntil(page, pickStands, 15_000),
        `the pick stands before the reload — ${JSON.stringify(await pickState(page))}`).toBeTruthy();

      await reloadConsole(page);
      const back = await waitUntil(page, pickStandsAfterReload, 30_000);
      await page.screenshot({path: `test-results/deckpick-collapse-03-reloaded-${table.tag}.png`});
      expect(back, `after the reload the seven cards stand on top and pickable — ${JSON.stringify(await pickState(page))}`)
        .toBeTruthy();

      // …and minimized BEFORE the reload: the parked state must not come back
      // as a dead end either.
      await pressUntil(page, 'Escape', async () => !(await pickState(page)).pickVisible, {tries: 3, settleMs: 1200});
      await reloadConsole(page);
      if (!(await waitUntil(page, (st) => st.pickVisible, 8000))) {
        await pressUntil(page, 'Enter', async () => (await pickState(page)).pickVisible, {tries: 3, settleMs: 1500});
      }
      const again = await waitUntil(page, pickStandsAfterReload, 30_000);
      const s = await pickState(page);
      await page.screenshot({path: `test-results/deckpick-collapse-04-collapsed-reload-${table.tag}.png`});
      expect(again, `minimized → reload → back: the cards stand — ${JSON.stringify(s)}`).toBeTruthy();

      await answerPick(page);
    });
  }
});
