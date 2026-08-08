import {test, expect, Page} from '@playwright/test';
import {press, stepKind, stepSubject, waitPressable, summaryVisible, fillPicks, pickCards} from './consoleStart';

/**
 * «КОРПОРАТИВНЫЕ АРХИВЫ» — the DRAW & SELECT flow, as a step of the Game Start
 * Workspace.
 *
 * What this probe defends. The prompt the prelude raises («посмотри 7 верхних
 * карт колоды, оставь 2») is a bare `SelectCard` on the wire — indistinguishable
 * from «point at a card in someone's tableau» — so the console classified it as
 * `cardSelect/target` and served it with the GENERIC CARD BROWSER: seven cards
 * appeared out of nothing inside the prelude workspace's narrow embed column,
 * overflowing it; the crumb read «ЦЕЛЬ НА КАРТЕ» (nothing was being targeted);
 * the start scene kept the pad, so the bar advertised «A РАЗЫГРАТЬ» over cards
 * the player could not pick; and the deck never moved.
 *
 * The contract now:
 *   · the SERVER marks the prompt (`deckPickPrompt`) — never a title match;
 *   · it is served by its OWN surface (`.con-deckpick`), EMBEDDED in the start
 *     workspace's zone beside the source card, never as a second screen;
 *   · the crumb names the CARD and advances only in its tail;
 *   · that surface owns the pad, so the seven cards are actually pickable;
 *   · confirming sends the picks to the HAND DOCK and only then clears the rest;
 *   · the workspace comes back around «Корпоративные архивы», which then
 *     finishes its ordinary play into «РАЗЫГРАНО».
 */

function cfg(opts: {preludes: Array<string>}) {
  return {
    players: [{name: 'Archivist', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: true, venus: false, colonies: false,
      prelude: true, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed: 0.42, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false, showOtherPlayersVP: false,
    testMode: true, aresExtremeVariant: false, politicalAgendasExtension: 'Standard',
    solarPhaseOption: false, removeNegativeGlobalEventsOption: false, modularMA: false,
    draftVariant: false, initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false,
    customCorporationsList: ['CrediCor', 'Teractor'],
    bannedCards: [], includedCards: [], customColoniesList: [],
    // FORCE the deal: the whole probe is about this one prelude.
    customPreludes: opts.preludes,
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [],
  };
}

/** Structural readout of the flow — never a title match, never a screenshot diff. */
async function surfaces(page: Page) {
  return page.evaluate(() => {
    const vis = (sel: string): boolean => {
      const el = document.querySelector(sel);
      if (el === null) {
        return false;
      }
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity) > 0.02;
    };
    const pick = document.querySelector('.con-deckpick');
    const slots = Array.from(document.querySelectorAll('.con-deckpick__slot'));
    return {
      startUp: vis('.con-start'),
      pickUp: pick !== null,
      /** …INSIDE the start workspace's own zone, never a band of its own. */
      pickEmbedded: pick !== null && pick.closest('.con-start__embed') !== null,
      /** …and therefore wearing the host's shell: no second breadcrumb. */
      headCount: document.querySelectorAll('.con-wshead').length,
      crumb: (document.querySelector('.con-wshead')?.textContent ?? '')
        .replace(/\s+/g, ' ').trim().toLowerCase(),
      /** The generic card browser must never appear for this prompt. */
      taskHost: document.querySelectorAll('.con-task-host').length,
      legacyModal: document.querySelectorAll('.wf-modal, .waitingfor-modal, .mandatory-input-modal').length,
      cards: slots.length,
      /** PAINTED, not merely rendered — the defect this replaces was a row
       *  that existed but overflowed its column and was clipped away. */
      painted: slots.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 40 && r.height > 60 &&
          r.top >= -1 && r.bottom <= window.innerHeight + 1;
      }).length,
      picked: document.querySelectorAll('.con-deckpick__slot.con-cards__slot--picked').length,
      /** The SOURCE card presides over the draw in the workspace's own seat. */
      sourceSeat: vis('.con-start__embedsource'),
      /** The deck the cards must physically come from. */
      deckPile: document.querySelector('.con-deckstack__pile') !== null,
      /** The dock is never hidden, and it is the picks' destination. */
      dockMounted: document.querySelector('.con-handdock') !== null,
      dockCards: document.querySelectorAll('[data-hand-dock-card]').length,
      /** …in its COMPACT pose while a decision owns the screen, and OUT of it
       *  while cards are physically arriving (the intake accent lease). */
      dockCompact: document.querySelector('.con-handdock')?.classList.contains('con-handdock--compact') ?? false,
      /** No native scrollbar may ever appear inside a console surface. */
      overflowing: slots.some((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > window.innerHeight + 2 || r.top < -2;
      }),
      /** The deployment's own queue/played chrome — the flow's way back. */
      startQueue: document.querySelectorAll('.con-start__queue').length,
      played: Array.from(document.querySelectorAll('.con-start__played [data-played-key]'))
        .map((el) => el.getAttribute('data-played-key')),
      handCount: (document.querySelector('.con-handdock')?.textContent ?? '').trim(),
      flow: pick?.getAttribute('data-flow') ?? '',
      /** The bottom command bar's live contract. */
      bar: (document.querySelector('.con-cmdbar, .con-commandbar')?.textContent ?? '')
        .replace(/\s+/g, ' ').trim().toLowerCase(),
    };
  });
}

/** Walk the setup wizard and commit, landing in the deployment. */
async function reachDeployment(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  for (let round = 0; round < 8 && !(await summaryVisible(page)); round++) {
    await waitPressable(page);
    await page.waitForTimeout(250);
    const kind = stepKind(await stepSubject(page));
    if (kind === 'corporation') {
      await press(page, 'Enter', 600);
    } else if (kind === 'prelude') {
      const got = await pickCards(page, ['Corporate Archives']);
      expect(got, 'the archives were offered and picked').toContain('Corporate Archives');
      await fillPicks(page, 2);
    } else if (kind === 'project') {
      await fillPicks(page, 4, 30);
    }
    await press(page, 'Period', 1600);
    for (let w = 0; w < 20 && !(await summaryVisible(page)) &&
         stepKind(await stepSubject(page)) === kind; w++) {
      await page.waitForTimeout(250);
    }
  }
  expect(await summaryVisible(page), 'reached the summary').toBeTruthy();
  await press(page, 'Enter', 2500); // НАЧАТЬ ПАРТИЮ
  await page.waitForTimeout(4000);
}

/** Press A on the deployment queue until the draw & select surface stands. */
async function openDeckPick(page: Page, maxPresses = 14): Promise<boolean> {
  for (let i = 0; i < maxPresses; i++) {
    if ((await surfaces(page)).pickUp) {
      return true;
    }
    await press(page, 'Enter', 2200);
  }
  return (await surfaces(page)).pickUp;
}

/**
 * Wait for the DEAL to finish. The surface mounts before its cards have left
 * the deck, and it deliberately swallows the pad until they have landed — a
 * press accepted mid-flight would select a card that is not there yet. So the
 * probe waits for the flow's own readiness signal rather than for a duration.
 */
async function waitPickable(page: Page, budgetMs = 12_000): Promise<boolean> {
  const until = Date.now() + budgetMs;
  while (Date.now() < until) {
    if ((await surfaces(page)).flow === 'choosing') {
      return true;
    }
    await page.waitForTimeout(200);
  }
  return (await surfaces(page)).flow === 'choosing';
}

test.describe('console — «посмотри N карт колоды, оставь K»', () => {
  test('the draw & select surface stands INSIDE the start workspace and answers the pick', async ({page, request}) => {
    test.setTimeout(300_000);
    const created = await request.post('/api/creategame', {
      data: cfg({preludes: ['Corporate Archives', 'Metals Company', 'Supplier', 'Business Empire']}),
    });
    expect(created.ok(), 'game created').toBeTruthy();
    const game = await created.json();
    const id = game.players[0].id;

    await page.setViewportSize({width: 1920, height: 1080});
    await page.goto(`/player?id=${id}&console=1`);
    await reachDeployment(page);

    const opened = await openDeckPick(page);
    expect(opened, `the surface opened — ${JSON.stringify(await surfaces(page))}`).toBeTruthy();
    const dealt = await waitPickable(page);
    const at = await surfaces(page);
    expect(dealt, `the deal finished and the pad opened — ${JSON.stringify(at)}`).toBeTruthy();
    await page.screenshot({path: 'test-results/deckpick-01-dealt.png'});

    // ── 1. IT IS A STEP OF THE WORKSPACE, not a screen of its own ────────
    expect(at.startUp, 'the start workspace is still the screen').toBeTruthy();
    expect(at.pickEmbedded, 'the surface renders inside the start embed zone').toBeTruthy();
    expect(at.headCount, 'exactly ONE breadcrumb — the host\'s').toBe(1);
    expect(at.taskHost, 'the generic card browser never serves this prompt').toBe(0);
    expect(at.legacyModal, 'no desktop fallback modal').toBe(0);

    // ── 2. THE CRUMB NAMES THE CARD ─────────────────────────────────────
    expect(at.crumb, `crumb names the source card — «${at.crumb}»`)
      .toContain('корпоративные архивы');
    expect(at.sourceSeat, 'the source card presides over the draw').toBeTruthy();

    // ── 3. SEVEN CARDS, ALL READABLE ────────────────────────────────────
    expect(at.cards, 'all seven revealed cards are on the stage').toBe(7);
    expect(at.painted, `every card is painted inside the viewport — ${JSON.stringify(at)}`).toBe(7);
    expect(at.overflowing, 'no card is clipped by the viewport').toBeFalsy();
    expect(at.deckPile, 'the deck they came from is on screen').toBeTruthy();
    expect(at.dockMounted, 'the hand dock is never hidden').toBeTruthy();
    expect(at.dockCompact, 'the dock steps back into its compact pose while the pick owns the screen').toBeTruthy();

    // ── 4. THE PAD IS THE SURFACE'S — the cards are actually pickable ────
    const dockBefore = at.dockCards;
    await press(page, 'Enter', 400); // A on the focused card
    await press(page, 'ArrowRight', 300);
    await press(page, 'Enter', 400);
    const chosen = await surfaces(page);
    expect(chosen.picked, `two cards are selected — ${JSON.stringify(chosen)}`).toBe(2);
    await page.screenshot({path: 'test-results/deckpick-02-picked.png'});

    // ── 5. CONFIRM → the picks reach the DOCK, then the rest clears ──────
    await press(page, 'Period', 1200); // RT = «Подтвердить»
    const sending = await surfaces(page);
    await page.screenshot({path: 'test-results/deckpick-03-sending.png'});
    // The dock comes OUT of its compact pose to receive them — the accent of
    // receiving, and the pose those flights measure their landing rects in.
    expect(sending.dockCompact, 'the dock opens up to receive the picks').toBeFalsy();
    await page.waitForTimeout(4500);
    const after = await surfaces(page);
    expect(after.dockCards, 'the two kept cards are physically in the dock')
      .toBeGreaterThanOrEqual(dockBefore + 2);

    // ── 6. …and the workspace comes back around its source card ─────────
    await page.waitForTimeout(3000);
    await page.screenshot({path: 'test-results/deckpick-04-returned.png'});
    const back = await surfaces(page);
    expect(back.pickUp, 'the draw & select step is gone').toBeFalsy();
    expect(back.startUp, 'the start workspace never left').toBeTruthy();
    expect(back.played, `«Корпоративные архивы» finished its ordinary play — ${JSON.stringify(back)}`)
      .toContain('Corporate Archives');
  });
});
